import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { businessInfo, customers, orderItems, orders, stores } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

/**
 * 팩킹 동봉용 거래명세서 집계 (보드 #2 — M3 집계 API, M1 인쇄/동봉 UI).
 * 가격은 VAT 포함 정책 → 공급가액/부가세는 10% 역산(공급가=round(총액/1.1)).
 * 권한: warehouse_staff·admin.
 */
export async function GET(
  _req: Request,
  ctx: { params: { id: string } },
) {
  const me = await getCurrentUser();
  if (!me || (me.role !== 'warehouse_staff' && me.role !== 'admin')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const orderId = ctx.params.id;

  const head = await withDbRetry(() =>
    db
      .select({
        orderNumber: orders.orderNumber,
        createdAt: orders.createdAt,
        status: orders.status,
        subtotal: orders.subtotal,
        discount: orders.discount,
        total: orders.total,
        customerNote: orders.customerNote,
        customerName: customers.name,
        customerPhone: customers.phone,
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
      .where(eq(orders.id, orderId))
      .limit(1),
  );
  if (!head[0]) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  const h = head[0];

  const items = await withDbRetry(() =>
    db
      .select({
        lensName: orderItems.lensName,
        lensBrand: orderItems.lensBrand,
        sku: orderItems.skuSnapshot,
        eyeSide: orderItems.eyeSide,
        sphere: orderItems.sphere,
        cylinder: orderItems.cylinder,
        axis: orderItems.axis,
        addPower: orderItems.addPower,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        lineTotal: orderItems.lineTotal,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.eyeSide)),
  );

  // 발행자 = business_info 싱글톤 (admin 사업장정보, 보드 #18)
  const [biz] = await withDbRetry(() =>
    db.select().from(businessInfo).where(eq(businessInfo.id, 1)).limit(1),
  );

  return NextResponse.json({
    order: {
      orderNumber: h.orderNumber,
      createdAt: h.createdAt,
      status: h.status,
      customerName: h.customerName,
      customerPhone: h.customerPhone,
      customerNote: h.customerNote,
    },
    store: {
      name: h.storeName,
      phone: h.storePhone,
      address: [h.storeAddress1, h.storeAddress2].filter(Boolean).join(' '),
      businessNumber: h.storeBizNo,
      representativeName: h.storeRep,
    },
    items,
    totals: {
      subtotal: h.subtotal,
      discount: h.discount,
      total: h.total,
    },
    issuer: {
      company: biz?.companyName ?? '(주)퍼니뷰',
      service: biz?.serviceName ?? '퍼니뷰 예약시스템',
      bizNo: biz?.bizNo ?? '',
      address: biz?.address ?? '',
      phone: biz?.phone ?? '',
      ceo: biz?.ceo ?? '',
      mailOrderNo: biz?.mailOrderNo ?? '',
      sealUrl: biz?.sealUrl ?? '',
      issuedAt: new Date().toISOString(),
    },
  });
}
