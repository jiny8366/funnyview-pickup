import { NextResponse } from 'next/server';
import { requirePermissionForApi } from '@/lib/auth/guards';
import { prescriptionPostSchema } from '@/lib/prescription/schema';
import { listPrescriptions, savePrescription } from '@/lib/prescription/service';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const me = await requirePermissionForApi('customers_read');
  if (!me) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  const prescriptions = await listPrescriptions(params.id);
  return NextResponse.json({ prescriptions });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const me = await requirePermissionForApi('customers_write');
  if (!me) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = prescriptionPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });
  }
  if (!parsed.data.left && !parsed.data.right) {
    return NextResponse.json({ error: '좌/우 중 하나 이상 입력하세요.' }, { status: 400 });
  }

  await savePrescription(params.id, parsed.data);
  return NextResponse.json({ ok: true });
}
