import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { businessInfo, supplierOrderItems, supplierOrders, suppliers } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { withDbRetry } from '@/lib/db/retry';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

async function loadOrder(id: string) {
  const [head] = await withDbRetry(() =>
    db
      .select({
        id: supplierOrders.id,
        orderNumber: supplierOrders.orderNumber,
        status: supplierOrders.status,
        totalCost: supplierOrders.totalCost,
        note: supplierOrders.note,
        createdAt: supplierOrders.createdAt,
        receivedAt: supplierOrders.receivedAt,
        supplierId: supplierOrders.supplierId,
        supplierName: suppliers.name,
        supplierBizNo: suppliers.bizNo,
        supplierAddress: suppliers.address,
        supplierContact: suppliers.contact,
        supplierPhone: suppliers.phone,
      })
      .from(supplierOrders)
      .leftJoin(suppliers, eq(suppliers.id, supplierOrders.supplierId))
      .where(eq(supplierOrders.id, id))
      .limit(1),
  );
  if (!head) return null;
  const items = await withDbRetry(() =>
    db
      .select()
      .from(supplierOrderItems)
      .where(eq(supplierOrderItems.orderId, id))
      .orderBy(asc(supplierOrderItems.brand), asc(supplierOrderItems.productName), asc(supplierOrderItems.sphere)),
  );
  return { head, items };
}

function doseLabel(it: { sphere: string | null; cylinder: string | null; axis: number | null; addPower: string | null }) {
  const parts: string[] = [];
  if (it.sphere) parts.push(`SPH ${it.sphere}`);
  if (it.cylinder) parts.push(`CYL ${it.cylinder}`);
  if (it.axis !== null) parts.push(`AX ${it.axis}`);
  if (it.addPower) parts.push(`ADD ${it.addPower}`);
  return parts.join(' ');
}

/** 발주서 상세 (+ format=csv 엑셀 다운로드) */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const data = await loadOrder(params.id);
  if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const { head, items } = data;

  const url = new URL(req.url);
  if (url.searchParams.get('format') === 'csv') {
    const headerRow = ['브랜드', '제품명', 'SKU', '도수', '수량(팩)', '예상단가', '금액'];
    const lines = items.map((it) =>
      [
        it.brand ?? '',
        it.productName ?? '',
        it.sku ?? '',
        doseLabel(it),
        it.quantity,
        it.unitCost,
        it.quantity * it.unitCost,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv =
      '﻿' +
      [
        `"발주서 ${head.orderNumber} · 매입처 ${head.supplierName ?? ''} · 발주일 ${new Date(head.createdAt).toLocaleDateString('ko-KR')}"`,
        headerRow.join(','),
        ...lines,
      ].join('\r\n');
    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${head.orderNumber}.csv"`,
      },
    });
  }

  // 발행자(본사) 정보 — 발주서 문서용
  const [biz] = await withDbRetry(() => db.select().from(businessInfo).where(eq(businessInfo.id, 1)).limit(1));

  return NextResponse.json({
    order: head,
    items,
    issuer: {
      company: biz?.companyName ?? '(주)퍼니뷰',
      bizNo: biz?.bizNo ?? '',
      address: biz?.address ?? '',
      phone: biz?.phone ?? '',
      ceo: biz?.ceo ?? '',
    },
  });
}

/** 상태 변경 — received(입고완료) / cancelled */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { status?: string };
  if (body.status !== 'received' && body.status !== 'cancelled') {
    return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 400 });
  }

  const [cur] = await withDbRetry(() =>
    db.select({ status: supplierOrders.status }).from(supplierOrders).where(eq(supplierOrders.id, params.id)).limit(1),
  );
  if (!cur) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (cur.status !== 'ordered') {
    return NextResponse.json({ error: 'INVALID_TRANSITION', from: cur.status }, { status: 409 });
  }

  const [updated] = await db
    .update(supplierOrders)
    .set({
      status: body.status,
      updatedAt: new Date(),
      receivedAt: body.status === 'received' ? new Date() : null,
    })
    .where(eq(supplierOrders.id, params.id))
    .returning();

  return NextResponse.json({ ok: true, order: updated });
}
