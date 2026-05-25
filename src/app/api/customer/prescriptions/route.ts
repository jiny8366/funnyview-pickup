import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { prescriptionPostSchema } from '@/lib/prescription/schema';
import { listPrescriptions, savePrescription } from '@/lib/prescription/service';

export const dynamic = 'force-dynamic';

/** 고객 본인 도수 — 세션의 customerId 기준. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me?.customerId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const prescriptions = await listPrescriptions(me.customerId);
  return NextResponse.json({ prescriptions });
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me?.customerId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = prescriptionPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });
  }
  if (!parsed.data.left && !parsed.data.right) {
    return NextResponse.json({ error: '좌/우 중 하나 이상 입력하세요.' }, { status: 400 });
  }
  await savePrescription(me.customerId, parsed.data);
  return NextResponse.json({ ok: true });
}
