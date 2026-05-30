import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { ensureCustomerForUser, findCustomerIdForUser } from '@/lib/orders/ensure-customer';
import { prescriptionPostSchema } from '@/lib/prescription/schema';
import { listPrescriptions, savePrescription } from '@/lib/prescription/service';

export const dynamic = 'force-dynamic';

/**
 * 고객 본인 도수. customer role 뿐 아니라 admin/마스터로 로그인해 테스트하는 경우도
 * customer 레코드를 보장(POST)하거나 조회(GET)하여 동작하게 한다.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const customerId = await findCustomerIdForUser(me.id);
  if (!customerId) {
    return NextResponse.json({ prescriptions: [] });
  }
  const prescriptions = await listPrescriptions(customerId);
  return NextResponse.json({ prescriptions });
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) {
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
  const customerId = await ensureCustomerForUser(me.id);
  await savePrescription(customerId, parsed.data);
  return NextResponse.json({ ok: true });
}
