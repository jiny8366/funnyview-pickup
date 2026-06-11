import { NextResponse } from 'next/server';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  businessInfo,
  inboundShipments,
  inventoryLots,
  lensVariants,
  lenses,
  suppliers,
  urgentPurchases,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

interface POItem {
  brand: string;
  name: string;
  spec: string;
  sku: string;
  quantity: number;
  unitCost: number;
  amount: number;
}
interface POGroup {
  supplier: {
    id: string | null;
    name: string;
    bizNo: string | null;
    address: string | null;
    contact: string | null;
    phone: string | null;
  };
  items: POItem[];
  totalQty: number;
  totalAmount: number;
}

function specOf(r: { sphere: string; cylinder: string | null; axis: number | null }) {
  let s = `SPH ${r.sphere}`;
  if (r.cylinder) s += ` · CYL ${r.cylinder}`;
  if (r.axis != null) s += ` · AX ${r.axis}`;
  return s;
}

/**
 * GET /api/admin/urgent-purchases/purchase-order?ids=a,b,c&format=csv
 * 발주서 데이터셋 — 매입처별 그룹. unitCost = 해당 도수의 최신 입고 로트 단가(없으면 0).
 */
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const ids = (url.searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const format = url.searchParams.get('format');

  if (ids.length === 0) {
    return NextResponse.json({ error: 'NO_IDS' }, { status: 400 });
  }

  const rows = await withDbRetry(() =>
    db
      .select({
        id: urgentPurchases.id,
        quantityShort: urgentPurchases.quantityShort,
        variantId: urgentPurchases.variantId,
        sku: lensVariants.sku,
        sphere: lensVariants.sphere,
        cylinder: lensVariants.cylinder,
        axis: lensVariants.axis,
        lensName: lenses.name,
        lensBrand: lenses.brand,
        supplierId: urgentPurchases.supplierId,
        supplierName: suppliers.name,
        supplierBizNo: suppliers.bizNo,
        supplierAddress: suppliers.address,
        supplierAddressDetail: suppliers.addressDetail,
        supplierContact: suppliers.contact,
        supplierPhone: suppliers.phone,
      })
      .from(urgentPurchases)
      .innerJoin(lensVariants, eq(lensVariants.id, urgentPurchases.variantId))
      .innerJoin(lenses, eq(lenses.id, lensVariants.lensId))
      .leftJoin(suppliers, eq(suppliers.id, urgentPurchases.supplierId))
      .where(inArray(urgentPurchases.id, ids)),
  );

  // 도수별 최신 로트 단가 (confirmed lot, inboundDate desc)
  const variantIds = [...new Set(rows.map((r) => r.variantId))];
  const costMap = new Map<string, number>();
  if (variantIds.length > 0) {
    const lots = await withDbRetry(() =>
      db
        .select({
          variantId: inventoryLots.variantId,
          unitCostIncVat: inventoryLots.unitCostIncVat,
          inboundDate: inboundShipments.inboundDate,
        })
        .from(inventoryLots)
        .innerJoin(inboundShipments, eq(inboundShipments.id, inventoryLots.shipmentId))
        .where(inArray(inventoryLots.variantId, variantIds))
        .orderBy(desc(inboundShipments.inboundDate), desc(inventoryLots.createdAt)),
    );
    // 첫 등장(가장 최신)만 채택
    for (const l of lots) {
      if (!costMap.has(l.variantId)) costMap.set(l.variantId, l.unitCostIncVat);
    }
  }

  // 발행자 = business_info 싱글톤
  const [biz] = await withDbRetry(() =>
    db.select().from(businessInfo).where(eq(businessInfo.id, 1)).limit(1),
  );

  // 매입처별 그룹화
  const groupMap = new Map<string, POGroup>();
  for (const r of rows) {
    const key = r.supplierId ?? '__none__';
    let g = groupMap.get(key);
    if (!g) {
      g = {
        supplier: {
          id: r.supplierId,
          name: r.supplierName ?? '(매입처 미지정)',
          bizNo: r.supplierBizNo ?? null,
          address: [r.supplierAddress, r.supplierAddressDetail].filter(Boolean).join(' ') || null,
          contact: r.supplierContact ?? null,
          phone: r.supplierPhone ?? null,
        },
        items: [],
        totalQty: 0,
        totalAmount: 0,
      };
      groupMap.set(key, g);
    }
    const unitCost = costMap.get(r.variantId) ?? 0;
    const quantity = r.quantityShort;
    const amount = unitCost * quantity;
    g.items.push({
      brand: r.lensBrand,
      name: r.lensName,
      spec: specOf(r),
      sku: r.sku,
      quantity,
      unitCost,
      amount,
    });
    g.totalQty += quantity;
    g.totalAmount += amount;
  }
  const groups = [...groupMap.values()];

  const issuer = {
    company: biz?.companyName ?? '(주)퍼니뷰',
    bizNo: biz?.bizNo ?? '',
    ceo: biz?.ceo ?? '',
    address: biz?.address ?? '',
    phone: biz?.phone ?? '',
  };

  if (format === 'csv') {
    const header = ['매입처', '브랜드', '제품명', '도수', 'SKU', '수량', '단가', '금액'];
    const lines: string[] = [];
    for (const g of groups) {
      for (const it of g.items) {
        lines.push(
          [g.supplier.name, it.brand, it.name, it.spec, it.sku, it.quantity, it.unitCost, it.amount]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(','),
        );
      }
    }
    const BOM = String.fromCharCode(0xfeff);
    const csv = BOM + [header.join(','), ...lines].join('\r\n');
    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="purchase-order-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ issuer, groups });
}
