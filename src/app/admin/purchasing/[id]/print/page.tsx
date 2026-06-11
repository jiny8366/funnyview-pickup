import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { businessInfo, supplierOrderItems, supplierOrders, suppliers } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';
import { PrintButton } from '@/components/admin/print-button';

export const dynamic = 'force-dynamic';

function doseLabel(it: { sphere: string | null; cylinder: string | null; axis: number | null; addPower: string | null }) {
  const parts: string[] = [];
  if (it.sphere) parts.push(`SPH ${it.sphere}`);
  if (it.cylinder) parts.push(`CYL ${it.cylinder}`);
  if (it.axis !== null) parts.push(`AX ${it.axis}`);
  if (it.addPower) parts.push(`ADD ${it.addPower}`);
  return parts.join(' · ');
}

/** 매입 발주서 — 미리보기 / 인쇄 / PDF (브라우저 인쇄). 문서는 .doc-light 고정. */
export default async function PurchaseOrderPrintPage({ params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') notFound();

  const [head] = await db
    .select({
      id: supplierOrders.id,
      orderNumber: supplierOrders.orderNumber,
      status: supplierOrders.status,
      totalCost: supplierOrders.totalCost,
      note: supplierOrders.note,
      createdAt: supplierOrders.createdAt,
      supplierName: suppliers.name,
      supplierBizNo: suppliers.bizNo,
      supplierAddress: suppliers.address,
      supplierContact: suppliers.contact,
      supplierPhone: suppliers.phone,
    })
    .from(supplierOrders)
    .leftJoin(suppliers, eq(suppliers.id, supplierOrders.supplierId))
    .where(eq(supplierOrders.id, params.id))
    .limit(1);
  if (!head) notFound();

  const items = await db
    .select()
    .from(supplierOrderItems)
    .where(eq(supplierOrderItems.orderId, params.id))
    .orderBy(asc(supplierOrderItems.brand), asc(supplierOrderItems.productName), asc(supplierOrderItems.sphere));

  const [biz] = await db.select().from(businessInfo).where(eq(businessInfo.id, 1)).limit(1);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="doc-light min-h-screen bg-white p-8 font-sans text-sm text-gray-900 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold">발주서 미리보기 — 인쇄 / PDF</h1>
        <div className="flex gap-2">
          <PrintButton />
          <a
            href={`/api/admin/purchasing/${head.id}?format=csv`}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            ⬇ 엑셀
          </a>
          <a
            href="/admin/purchasing"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            ← 매입 관리
          </a>
        </div>
      </div>

      {/* 문서 본문 */}
      <div className="mx-auto max-w-3xl">
        <h1 className="text-center text-2xl font-bold tracking-widest">발 주 서</h1>
        <p className="mt-1 text-center text-xs text-gray-500">{head.orderNumber}</p>

        <div className="mt-6 grid grid-cols-2 gap-4 text-xs">
          <div className="rounded border border-gray-300 p-3">
            <p className="mb-1 font-bold text-gray-500">수신 (매입처)</p>
            <p className="text-sm font-semibold">{head.supplierName ?? '—'}</p>
            {head.supplierBizNo && <p>사업자번호: {head.supplierBizNo}</p>}
            {head.supplierAddress && <p>{head.supplierAddress}</p>}
            {(head.supplierContact || head.supplierPhone) && (
              <p>
                담당 {head.supplierContact ?? ''} {head.supplierPhone ?? ''}
              </p>
            )}
          </div>
          <div className="rounded border border-gray-300 p-3">
            <p className="mb-1 font-bold text-gray-500">발신 (발주자)</p>
            <p className="text-sm font-semibold">{biz?.companyName ?? '(주)퍼니뷰'}</p>
            {biz?.bizNo && <p>사업자번호: {biz.bizNo}</p>}
            {biz?.address && <p>{biz.address}</p>}
            {biz?.phone && <p>연락처: {biz.phone}</p>}
            <p>발주일: {new Date(head.createdAt).toLocaleDateString('ko-KR')}</p>
          </div>
        </div>

        <table className="mt-5 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-gray-700 text-left">
              <th className="py-1.5 pr-2">No</th>
              <th className="py-1.5 pr-2">브랜드</th>
              <th className="py-1.5 pr-2">제품명</th>
              <th className="py-1.5 pr-2">도수</th>
              <th className="py-1.5 pr-2">사유</th>
              <th className="py-1.5 pr-2 text-right">수량(팩)</th>
              <th className="py-1.5 pr-2 text-right">단가</th>
              <th className="py-1.5 text-right">금액</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className="border-b border-gray-200">
                <td className="py-1.5 pr-2 text-gray-500">{i + 1}</td>
                <td className="py-1.5 pr-2">{it.brand}</td>
                <td className="py-1.5 pr-2">
                  {it.productName}
                  <span className="ml-1 font-mono text-[10px] text-gray-400">{it.sku}</span>
                </td>
                <td className="py-1.5 pr-2">{doseLabel(it)}</td>
                <td className="py-1.5 pr-2 text-gray-600">{it.reason ?? ''}</td>
                <td className="py-1.5 pr-2 text-right">{it.quantity}</td>
                <td className="py-1.5 pr-2 text-right">{it.unitCost.toLocaleString()}</td>
                <td className="py-1.5 text-right">{(it.quantity * it.unitCost).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-700 font-semibold">
              <td colSpan={5} className="py-2 pr-2">
                합계 ({items.length}종)
              </td>
              <td className="py-2 pr-2 text-right">{totalQty}</td>
              <td />
              <td className="py-2 text-right">{head.totalCost.toLocaleString()}원</td>
            </tr>
          </tfoot>
        </table>

        {head.note && <p className="mt-3 text-xs text-gray-600">비고: {head.note}</p>}
        <p className="mt-6 text-center text-[10px] text-gray-400">
          단가·금액은 예상 매입가(참고)이며, 실제 매입원가는 입고 시 전표 기준으로 확정됩니다.
        </p>
      </div>
    </div>
  );
}
