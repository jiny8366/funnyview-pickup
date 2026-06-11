import { NextResponse } from 'next/server';
import { and, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { lensVariants, urgentPurchases } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { createInboundShipment } from '@/lib/inventory-fifo';

export const dynamic = 'force-dynamic';

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== 'warehouse_staff' && user.role !== 'admin') return null;
  return user;
}

interface NormalizedLine {
  variantId: string;
  quantity: number;
  unitCostIncVat: number;
}

/**
 * POST /api/warehouse/inbound
 *
 *   신규(다중 라인) 바디:
 *   {
 *     inboundDate?: string  (YYYY-MM-DD, 기본 오늘),
 *     invoiceRef?:  string  (전표번호, 선택),
 *     supplierId?:  string  (매입처),
 *     note?:        string,
 *     lines: [{ variantId, lensId?, quantity, unitCostIncVat }]
 *   }
 *
 *   레거시(단일 라인) 바디:
 *   { variantId, quantity, unitCostIncVat, inboundDate?, invoiceRef?, supplierId?, note? }
 *
 *   동작 (FIFO 백엔드 사용):
 *     - 라인을 lensId 별로 그룹핑 → lensId 그룹마다 inbound_shipments 1행 헤더
 *     - inventory_lots: 라인별 1행 INSERT (quantityRemaining = quantity)
 *     - inventory:      quantity_on_hand += quantity (upsert)
 *     - inventory_movements: 'inbound' 이동 (lot_id, unit_cost_snapshot 포함)
 *
 *   결과: { ok, shipments: [...], lots: [...] }
 */
export async function POST(req: Request) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const inboundDate =
    typeof body.inboundDate === 'string' && body.inboundDate
      ? body.inboundDate
      : new Date().toISOString().slice(0, 10);
  const invoiceRef = typeof body.invoiceRef === 'string' ? body.invoiceRef : null;
  const supplierId = typeof body.supplierId === 'string' ? body.supplierId : null;
  const note = typeof body.note === 'string' ? body.note : null;

  // 라인 정규화 (신규 lines 배열 또는 레거시 단일 variantId)
  let rawLines: unknown[];
  if (Array.isArray(body.lines)) {
    rawLines = body.lines;
  } else if (typeof body.variantId === 'string') {
    rawLines = [
      {
        variantId: body.variantId,
        quantity: body.quantity,
        unitCostIncVat: body.unitCostIncVat,
      },
    ];
  } else {
    rawLines = [];
  }

  if (rawLines.length === 0) {
    return NextResponse.json({ error: 'INVALID_PARAMS', detail: '입고 라인이 비어있습니다' }, { status: 400 });
  }

  const lines: NormalizedLine[] = [];
  for (const r of rawLines) {
    const l = r as Record<string, unknown>;
    const variantId = typeof l.variantId === 'string' ? l.variantId : '';
    const quantity = Number(l.quantity);
    const unitCostIncVat = Number(l.unitCostIncVat);
    if (!variantId || !Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'INVALID_PARAMS' }, { status: 400 });
    }
    if (!Number.isFinite(unitCostIncVat) || unitCostIncVat < 0) {
      return NextResponse.json(
        { error: 'INVALID_UNIT_COST', detail: '단가는 0 이상의 숫자여야 합니다' },
        { status: 400 },
      );
    }
    lines.push({ variantId, quantity, unitCostIncVat: Math.round(unitCostIncVat) });
  }

  // variant → lensId 매핑 (라인이 lensId 를 주지 않아도 도출)
  const variantIds = Array.from(new Set(lines.map((l) => l.variantId)));
  const variantRows = await db
    .select({ id: lensVariants.id, lensId: lensVariants.lensId })
    .from(lensVariants)
    .where(inArray(lensVariants.id, variantIds));

  const lensByVariant = new Map(variantRows.map((v) => [v.id, v.lensId]));
  for (const l of lines) {
    if (!lensByVariant.has(l.variantId)) {
      return NextResponse.json({ error: 'VARIANT_NOT_FOUND', detail: l.variantId }, { status: 404 });
    }
  }

  // lensId 별 그룹핑 (1제품 × 1입고일 = 1전표 헤더)
  const groups = new Map<string, NormalizedLine[]>();
  for (const l of lines) {
    const lensId = lensByVariant.get(l.variantId)!;
    const arr = groups.get(lensId) ?? [];
    arr.push(l);
    groups.set(lensId, arr);
  }

  try {
    const result = await db.transaction(async (tx) => {
      const shipments = [];
      const lots = [];
      for (const [lensId, items] of groups) {
        const r = await createInboundShipment(tx, {
          lensId,
          inboundDate,
          supplierId,
          invoiceRef,
          note,
          createdBy: user.id,
          items,
          confirm: true,
        });
        shipments.push(r.shipment);
        lots.push(...r.lots);
      }

      // 입고/매입 시 선택한 매입처를, 동일 도수의 미해결 급매입(대기·발주)에 자동 반영.
      // 리스트에서 이후 매입처 수정도 가능(어드민 급매입 화면).
      if (supplierId) {
        await tx
          .update(urgentPurchases)
          .set({ supplierId })
          .where(
            and(
              inArray(urgentPurchases.variantId, variantIds),
              inArray(urgentPurchases.status, ['requested', 'ordered']),
            ),
          );
      }
      return { shipments, lots };
    });

    return NextResponse.json({
      ok: true,
      shipments: result.shipments,
      lots: result.lots,
      // 레거시 단일 라인 호출 호환
      shipment: result.shipments[0],
      lot: result.lots[0],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    console.error('inbound error:', e);
    return NextResponse.json({ error: 'INBOUND_FAILED', detail: msg }, { status: 500 });
  }
}
