import { NextResponse } from 'next/server';
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { inboundShipments, inventoryLots, lenses, lensVariants, users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== 'warehouse_staff' && user.role !== 'admin') return null;
  return user;
}

/**
 * GET /api/warehouse/inbound/history
 *   ?page=1&limit=20&status=confirmed&q=검색어&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * 입고 전표 이력 조회 (헤더 + 도수별 로트 라인 포함).
 */
export async function GET(req: Request) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const limit = Math.min(50, Math.max(5, Number(url.searchParams.get('limit') ?? 20)));
  const offset = (page - 1) * limit;
  const status = url.searchParams.get('status') ?? '';
  const q = url.searchParams.get('q') ?? '';
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';

  const conditions = [];
  if (status === 'confirmed' || status === 'draft') {
    conditions.push(eq(inboundShipments.status, status));
  }
  if (from) conditions.push(gte(inboundShipments.inboundDate, from));
  if (to) conditions.push(lte(inboundShipments.inboundDate, to));
  if (q) {
    conditions.push(
      or(
        ilike(lenses.name, `%${q}%`),
        ilike(lenses.brand, `%${q}%`),
        ilike(inboundShipments.invoiceRef, `%${q}%`),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // 전표 헤더 페이지
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(DISTINCT ${inboundShipments.id})::int` })
    .from(inboundShipments)
    .innerJoin(lenses, eq(lenses.id, inboundShipments.lensId))
    .where(where);

  const shipmentRows = await db
    .select({
      id: inboundShipments.id,
      inboundDate: inboundShipments.inboundDate,
      status: inboundShipments.status,
      confirmedAt: inboundShipments.confirmedAt,
      invoiceRef: inboundShipments.invoiceRef,
      note: inboundShipments.note,
      lensId: lenses.id,
      lensName: lenses.name,
      brand: lenses.brand,
      createdAt: inboundShipments.createdAt,
      createdByName: users.username,
    })
    .from(inboundShipments)
    .innerJoin(lenses, eq(lenses.id, inboundShipments.lensId))
    .leftJoin(users, eq(users.id, inboundShipments.createdBy))
    .where(where)
    .orderBy(desc(inboundShipments.inboundDate), desc(inboundShipments.createdAt))
    .limit(limit)
    .offset(offset);

  if (shipmentRows.length === 0) {
    return NextResponse.json({ shipments: [], total, page, limit });
  }

  const shipmentIds = shipmentRows.map((s) => s.id);

  // 각 전표의 도수별 로트 라인
  const lotRows = await db
    .select({
      shipmentId: inventoryLots.shipmentId,
      lotId: inventoryLots.id,
      variantId: inventoryLots.variantId,
      sku: lensVariants.sku,
      sphere: lensVariants.sphere,
      cylinder: lensVariants.cylinder,
      axis: lensVariants.axis,
      addPower: lensVariants.addPower,
      quantityReceived: inventoryLots.quantityReceived,
      quantityRemaining: inventoryLots.quantityRemaining,
      unitCostIncVat: inventoryLots.unitCostIncVat,
    })
    .from(inventoryLots)
    .innerJoin(lensVariants, eq(lensVariants.id, inventoryLots.variantId))
    .where(sql`${inventoryLots.shipmentId} = ANY(ARRAY[${sql.join(shipmentIds.map((id) => sql`${id}::uuid`), sql`, `)}])`);

  // 로트를 전표별로 그룹핑
  const lotsByShipment: Record<string, typeof lotRows> = {};
  for (const lot of lotRows) {
    if (!lotsByShipment[lot.shipmentId]) lotsByShipment[lot.shipmentId] = [];
    lotsByShipment[lot.shipmentId].push(lot);
  }

  const shipments = shipmentRows.map((s) => ({
    ...s,
    lots: lotsByShipment[s.id] ?? [],
    totalQty: (lotsByShipment[s.id] ?? []).reduce((sum, l) => sum + l.quantityReceived, 0),
    totalCost: (lotsByShipment[s.id] ?? []).reduce(
      (sum, l) => sum + l.quantityReceived * l.unitCostIncVat,
      0,
    ),
  }));

  return NextResponse.json({ shipments, total, page, limit });
}
