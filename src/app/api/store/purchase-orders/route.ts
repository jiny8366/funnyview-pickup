import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  groupProductCommissions,
  lensVariants,
  lenses,
  storeOrderItems,
  storeOrders,
  storeProductCommissions,
  stores,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { resolveStoreSupplyPrice } from '@/lib/pricing/store-supply-price';

export const dynamic = 'force-dynamic';

/**
 * 가맹점 → 본사 B2B 발주 API.
 *
 * ⚠️ 고객 픽업주문 API(/api/store/orders) 와 완전히 별개.
 *    이 라우트는 가맹점이 본사로 콘택트렌즈를 발주하는 경로이며 금액은
 *    **공급가(supply price)** 기준이다. retail 가격은 절대 다루지 않는다.
 *
 * 두 역할(owner/optician) 모두 발주 가능. me.storeId 로 스코프 고정.
 */

interface OrderItemInput {
  variantId: string;
  lensId: string;
  quantity: number;
}

/** GET — 이 매장의 발주 목록. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'store_staff' || !me.storeId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const rows = await db
    .select({
      id: storeOrders.id,
      orderNumber: storeOrders.orderNumber,
      status: storeOrders.status,
      totalSupplyAmount: storeOrders.totalSupplyAmount,
      note: storeOrders.note,
      createdAt: storeOrders.createdAt,
      itemCount: sql<number>`(SELECT COUNT(*) FROM ${storeOrderItems} WHERE ${storeOrderItems.orderId} = ${storeOrders.id})::int`,
    })
    .from(storeOrders)
    .where(eq(storeOrders.storeId, me.storeId))
    .orderBy(desc(storeOrders.createdAt));

  // 라인 항목(도수 포함) — 발주 상세 펼침용
  const orderIds = rows.map((r) => r.id);
  const itemRows = orderIds.length
    ? await db
        .select({
          orderId: storeOrderItems.orderId,
          brand: storeOrderItems.brand,
          productName: storeOrderItems.productName,
          sphere: storeOrderItems.sphere,
          cylinder: storeOrderItems.cylinder,
          axis: storeOrderItems.axis,
          addPower: storeOrderItems.addPower,
          quantity: storeOrderItems.quantity,
          unitSupplyPrice: storeOrderItems.unitSupplyPrice,
          lineTotal: storeOrderItems.lineTotal,
        })
        .from(storeOrderItems)
        .where(inArray(storeOrderItems.orderId, orderIds))
    : [];

  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const it of itemRows) {
    const list = itemsByOrder.get(it.orderId) ?? [];
    list.push(it);
    itemsByOrder.set(it.orderId, list);
  }

  const orders = rows.map((r) => ({
    ...r,
    items: itemsByOrder.get(r.id) ?? [],
  }));

  return NextResponse.json({ orders });
}

/** 발주번호 생성: SO-YYYYMMDD-NNN (당일 순번). */
async function nextOrderNumber(storeId: string): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const datePart = `${y}${m}${d}`;
  const prefix = `SO-${datePart}-`;

  const [{ cnt }] = await db
    .select({ cnt: sql<number>`COUNT(*)::int` })
    .from(storeOrders)
    .where(
      and(
        eq(storeOrders.storeId, storeId),
        sql`${storeOrders.orderNumber} LIKE ${prefix + '%'}`,
      ),
    );

  const seq = String((cnt ?? 0) + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

/** POST — 발주 생성. 서버에서 공급가 재해석(클라이언트 가격 불신). */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'store_staff' || !me.storeId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const storeId = me.storeId;

  const body = (await req.json().catch(() => ({}))) as {
    items?: OrderItemInput[];
    note?: string;
  };

  const rawItems = Array.isArray(body.items) ? body.items : [];
  // 동일 variantId(도수) 합치기 + 유효성. lensId 는 서버에서 variant 로부터 재검증.
  const qtyByVariant = new Map<string, number>();
  for (const it of rawItems) {
    if (!it || typeof it.variantId !== 'string') continue;
    const q = Math.floor(Number(it.quantity));
    if (!Number.isFinite(q) || q <= 0) continue;
    qtyByVariant.set(it.variantId, (qtyByVariant.get(it.variantId) ?? 0) + q);
  }
  if (qtyByVariant.size === 0) {
    return NextResponse.json({ error: 'EMPTY_ITEMS' }, { status: 400 });
  }

  const variantIds = [...qtyByVariant.keys()];

  // variant → lensId/도수 스냅샷 (활성 variant 만). 클라이언트 lensId 불신.
  const variantRows = await db
    .select({
      variantId: lensVariants.id,
      lensId: lensVariants.lensId,
      sphere: lensVariants.sphere,
      cylinder: lensVariants.cylinder,
      axis: lensVariants.axis,
      addPower: lensVariants.addPower,
      isActive: lensVariants.isActive,
    })
    .from(lensVariants)
    .where(inArray(lensVariants.id, variantIds));
  const variantMap = new Map(variantRows.map((r) => [r.variantId, r]));

  for (const vid of variantIds) {
    const v = variantMap.get(vid);
    if (!v || !v.isActive) {
      return NextResponse.json({ error: 'INVALID_VARIANT', variantId: vid }, { status: 400 });
    }
  }

  const lensIds = [...new Set(variantRows.map((r) => r.lensId))];

  // 매장 소속 그룹
  const [storeRow] = await db
    .select({ groupId: stores.groupId })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);
  const groupId = storeRow?.groupId ?? null;

  // 제품 마스터 + 오버라이드 조회 (공급가 재해석용, retail 미포함)
  const lensRows = await db
    .select({
      id: lenses.id,
      brand: lenses.brand,
      name: lenses.name,
      productCode: lenses.productCode,
      isActive: lenses.isActive,
      deletedAt: lenses.deletedAt,
      standardSupplyPrice: lenses.standardSupplyPrice,
      supplyDiscountAmount: lenses.supplyDiscountAmount,
      supplyDiscountPercent: lenses.supplyDiscountPercent,
    })
    .from(lenses)
    .where(inArray(lenses.id, lensIds));

  const storeOverrides = await db
    .select({
      lensId: storeProductCommissions.lensId,
      supplyPrice: storeProductCommissions.supplyPrice,
    })
    .from(storeProductCommissions)
    .where(
      and(
        eq(storeProductCommissions.storeId, storeId),
        inArray(storeProductCommissions.lensId, lensIds),
      ),
    );
  const storeOverrideMap = new Map(
    storeOverrides.map((r) => [r.lensId, r.supplyPrice]),
  );

  const groupOverrideMap = new Map<string, string | null>();
  if (groupId) {
    const groupOverrides = await db
      .select({
        lensId: groupProductCommissions.lensId,
        supplyPrice: groupProductCommissions.supplyPrice,
      })
      .from(groupProductCommissions)
      .where(
        and(
          eq(groupProductCommissions.groupId, groupId),
          inArray(groupProductCommissions.lensId, lensIds),
        ),
      );
    for (const r of groupOverrides) groupOverrideMap.set(r.lensId, r.supplyPrice);
  }

  const lensMap = new Map(lensRows.map((r) => [r.id, r]));

  // 라인 구성 + 공급가 재해석 (variant=도수 단위). 공급가는 제품(lensId) 단위.
  const lines: {
    variantId: string;
    lensId: string;
    brand: string | null;
    productName: string | null;
    productCode: string | null;
    sphere: string | null;
    cylinder: string | null;
    axis: number | null;
    addPower: string | null;
    quantity: number;
    unitSupplyPrice: number;
    lineTotal: number;
  }[] = [];

  for (const [variantId, quantity] of qtyByVariant) {
    const variant = variantMap.get(variantId);
    if (!variant) {
      return NextResponse.json({ error: 'INVALID_VARIANT', variantId }, { status: 400 });
    }
    const lensId = variant.lensId;
    const lens = lensMap.get(lensId);
    if (!lens || !lens.isActive || lens.deletedAt) {
      return NextResponse.json(
        { error: 'INVALID_PRODUCT', lensId },
        { status: 400 },
      );
    }
    const unit = resolveStoreSupplyPrice({
      storeProduct: storeOverrideMap.get(lensId) ?? null,
      groupProduct: groupId ? groupOverrideMap.get(lensId) ?? null : null,
      master: {
        standardSupplyPrice: lens.standardSupplyPrice,
        supplyDiscountAmount: lens.supplyDiscountAmount,
        supplyDiscountPercent: lens.supplyDiscountPercent,
      },
    });
    if (unit == null) {
      // 공급가 미설정 제품은 발주 불가 (가격문의 대상)
      return NextResponse.json(
        { error: 'NO_SUPPLY_PRICE', lensId },
        { status: 400 },
      );
    }
    lines.push({
      variantId,
      lensId,
      brand: lens.brand,
      productName: lens.name,
      productCode: lens.productCode,
      sphere: variant.sphere,
      cylinder: variant.cylinder,
      axis: variant.axis,
      addPower: variant.addPower,
      quantity,
      unitSupplyPrice: unit,
      lineTotal: unit * quantity,
    });
  }

  const totalSupplyAmount = lines.reduce((s, l) => s + l.lineTotal, 0);
  const note =
    typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;

  const created = await db.transaction(async (tx) => {
    const orderNumber = await nextOrderNumber(storeId);
    const [order] = await tx
      .insert(storeOrders)
      .values({
        storeId,
        orderNumber,
        status: 'placed',
        totalSupplyAmount,
        note,
        createdBy: me.id,
      })
      .returning();

    await tx.insert(storeOrderItems).values(
      lines.map((l) => ({
        orderId: order.id,
        variantId: l.variantId,
        lensId: l.lensId,
        brand: l.brand,
        productName: l.productName,
        productCode: l.productCode,
        sphere: l.sphere,
        cylinder: l.cylinder,
        axis: l.axis,
        addPower: l.addPower,
        quantity: l.quantity,
        unitSupplyPrice: l.unitSupplyPrice,
        lineTotal: l.lineTotal,
      })),
    );

    return order;
  });

  return NextResponse.json({ ok: true, order: created }, { status: 201 });
}
