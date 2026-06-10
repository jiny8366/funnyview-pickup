import { NextResponse } from 'next/server';
import { asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { businessInfo, customers, orderItems, orders, stores } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

const schema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(500),
});

/**
 * 가맹점 청구용 묶음 거래명세서·송장 집계 (JINY 확정: 픽리스트/배송배치 묶음, 일자무관).
 * 선택한 주문들(픽리스트 1~N장분)을 가맹점별로 묶어, 가맹점 단위 명세서·송장 데이터로 반환.
 * 발행자 정보는 business_info(싱글톤)에서 읽음. 인쇄 레이아웃 = M1.
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me || (me.role !== 'warehouse_staff' && me.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  const { orderIds } = parsed.data;

  const [heads, items, issuerRows] = await Promise.all([
    withDbRetry(() =>
      db
        .select({
          orderId: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          total: orders.total,
          createdAt: orders.createdAt,
          customerName: customers.name,
          customerPhone: customers.phone,
          storeId: stores.id,
          storeName: stores.name,
          storePhone: stores.phone,
          storeAddress1: stores.addressLine1,
          storeAddress2: stores.addressLine2,
          storeBizNo: stores.businessNumber,
          storeRep: stores.representativeName,
        })
        .from(orders)
        .innerJoin(customers, eq(customers.id, orders.customerId))
        .innerJoin(stores, eq(stores.id, orders.pickupStoreId))
        .where(inArray(orders.id, orderIds))
        .orderBy(asc(orders.orderNumber)),
    ),
    withDbRetry(() =>
      db
        .select({
          orderId: orderItems.orderId,
          variantId: orderItems.variantId,
          lensName: orderItems.lensName,
          lensBrand: orderItems.lensBrand,
          sku: orderItems.skuSnapshot,
          eyeSide: orderItems.eyeSide,
          sphere: orderItems.sphere,
          cylinder: orderItems.cylinder,
          axis: orderItems.axis,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
          lineTotal: orderItems.lineTotal,
        })
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds))
        .orderBy(asc(orderItems.eyeSide)),
    ),
    withDbRetry(() => db.select().from(businessInfo).where(eq(businessInfo.id, 1)).limit(1)),
  ]);

  const itemsByOrder = new Map<string, typeof items>();
  for (const it of items) {
    if (!itemsByOrder.has(it.orderId)) itemsByOrder.set(it.orderId, []);
    itemsByOrder.get(it.orderId)!.push(it);
  }

  // 가맹점별 그룹 — 가맹점 1곳 = 명세서 1장 + 송장 1장
  const byStore = new Map<string, {
    store: {
      id: string; name: string; phone: string; address: string;
      businessNumber: string | null; representativeName: string | null;
    };
    orders: {
      orderId: string; orderNumber: string; status: string; total: number;
      createdAt: Date; customerName: string; customerPhone: string;
      items: typeof items;
    }[];
    totals: { orderCount: number; itemCount: number; quantity: number; amount: number };
  }>();

  for (const h of heads) {
    if (!byStore.has(h.storeId)) {
      byStore.set(h.storeId, {
        store: {
          id: h.storeId,
          name: h.storeName,
          phone: h.storePhone,
          address: [h.storeAddress1, h.storeAddress2].filter(Boolean).join(' '),
          businessNumber: h.storeBizNo,
          representativeName: h.storeRep,
        },
        orders: [],
        totals: { orderCount: 0, itemCount: 0, quantity: 0, amount: 0 },
      });
    }
    const g = byStore.get(h.storeId)!;
    const its = itemsByOrder.get(h.orderId) ?? [];
    g.orders.push({
      orderId: h.orderId,
      orderNumber: h.orderNumber,
      status: h.status,
      total: h.total,
      createdAt: h.createdAt,
      customerName: h.customerName,
      customerPhone: h.customerPhone,
      items: its,
    });
    g.totals.orderCount += 1;
    g.totals.itemCount += its.length;
    g.totals.quantity += its.reduce((s, x) => s + x.quantity, 0);
    g.totals.amount += h.total;
  }

  const issuer = issuerRows[0] ?? null;

  return NextResponse.json({
    requested: orderIds.length,
    found: heads.length,
    stores: [...byStore.values()],
    issuer: issuer
      ? {
          company: issuer.companyName,
          service: issuer.serviceName,
          bizNo: issuer.bizNo ?? '',
          ceo: issuer.ceo ?? '',
          address: issuer.address ?? '',
          phone: issuer.phone ?? '',
          sealUrl: issuer.sealUrl ?? '',
        }
      : { company: '(주)퍼니뷰', service: 'Funnyview Pickup', bizNo: '', ceo: '', address: '', phone: '', sealUrl: '' },
    issuedAt: new Date().toISOString(),
  });
}
