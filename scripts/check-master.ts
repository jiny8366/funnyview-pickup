/**
 * 진단: 마스터 매칭 + 환경 변수 확인.
 * 사용: source .env.local; npx tsx scripts/check-master.ts
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { users } from '../src/db/schema';
import { isMasterUser } from '../src/lib/auth/permissions';

async function main() {
  console.log('\n=== 환경 변수 ===');
  console.log(`MASTER_USERNAMES env: ${process.env.MASTER_USERNAMES ?? '(미설정 — default ["jiny8366"])'}`);

  console.log('\n=== jiny8366 행 조회 ===');
  const r = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      phone: users.phone,
      role: users.role,
      permissions: users.permissions,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.username, 'jiny8366'))
    .limit(1);

  if (!r[0]) {
    console.log('❌ username=jiny8366 행 없음');
    console.log('\n전체 admin role 사용자 (username/email 일부):');
    const admins = await db
      .select({ username: users.username, email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.role, 'admin'));
    admins.forEach((a) =>
      console.log(`  - username='${a.username}' email='${a.email}' phone='${a.phone}'`),
    );
    return;
  }

  const u = r[0];
  console.log('✅ 행 발견');
  console.log(`  id          : ${u.id}`);
  console.log(`  username    : '${u.username}'`);
  console.log(`  email       : ${u.email ?? 'null'}`);
  console.log(`  phone       : ${u.phone ?? 'null'}`);
  console.log(`  role        : ${u.role}`);
  console.log(`  isActive    : ${u.isActive}`);
  console.log(`  permissions : ${JSON.stringify(u.permissions)}`);

  const masterCheck = isMasterUser(u.username);
  console.log(`\n  isMasterUser('${u.username}'): ${masterCheck} ← true 여야 정상`);

  if (!masterCheck) {
    console.log('  ⚠️  마스터 매칭 실패. MASTER_USERNAMES env 와 username 비교 확인 필요.');
  }
}

main()
  .catch((e) => {
    console.error('ERROR:', e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
