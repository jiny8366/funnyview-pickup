# Funnyview Pickup — Claude 세션 진입점

> 이 파일은 **새 Claude Code 세션이 처음 읽어야 할 단일 진입점** 입니다.
> 모든 확정 사항의 상세는 `docs/spec.json` 을 참조.

## 한 줄 요약

**(주)퍼니뷰의 한국 콘택트렌즈 픽업 플랫폼** — Next.js 14 + Drizzle + Neon + Vercel + 카카오 로컬 API. 4 portal (customer/admin/staff/store) hostname 분리.

## 작업 시작 전 필수 읽기

| 파일 | 용도 |
|---|---|
| `docs/spec.json` | **모든 확정 사항 단일 진실의 출처** — 새 작업 전 반드시 검토 |
| `docs/spec.html` | 사람용 시각화 보고서 (브라우저로 열기) |
| `CLAUDE.md` (이 파일) | 새 세션 진입점 |
| `README.md` | 운영자/개발자 셋업 가이드 |
| `.env.example` | 환경변수 템플릿 |

## 절대 원칙

1. **frame-ops 와 완전 무관** — 이 repo (jiny8366/funnyview-pickup) 단독. 매개 push 금지.
2. **확정 사항 변경 불가** — `docs/spec.json` 변경은 사용자 명시 동의 후. 임의 변경 ❌
3. **분리된 portal 4개** — customer / admin / staff / store. 코드 작성 시 portal 별 영향 명확히
4. **Light 모드 고정** — 다크모드 대응 안 함 (input 가독성 보장)
5. **PAT 사용 push** — sandbox 가 funnyview-pickup repo 에 직접 push (frame-ops 매개 X)

## 통합 테스트 계정 (모든 portal 진입)

```
ID:  jiny8366
PW:  2282
```

→ admin role 이라 customer/admin/staff/store 모두 로그인 가능. 다른 시드 계정은 `docs/spec.json` 의 `auth.testAccounts.seeded` 참조.

## 접속 URL (4 portal)

| 역할 | URL |
|---|---|
| 고객 (메인) | https://funnyview-pickup.vercel.app |
| 관리자 | https://admin-funnyview-pickup.vercel.app |
| 픽업서비스 운영 | https://staff-funnyview-pickup.vercel.app |
| 픽업가맹점 | https://store-funnyview-pickup.vercel.app |

## 핵심 기술 스택

- **Frontend**: Next.js 14 (App Router) + TypeScript strict + Tailwind
- **DB**: PostgreSQL (Neon Singapore Pooled) + Drizzle ORM
- **Cache**: Redis (Upstash, 선택)
- **Auth**: jose (JWT), 4-role + hostname-based portal middleware
- **Geo**: 카카오 로컬 API (`KAKAO_REST_API_KEY`)
- **Deploy**: Vercel (`main` 자동 배포, `drizzle-kit migrate` build-time)

## 작업 디렉토리

```
/home/user/funnyview-pickup    (sandbox)
~/funnyview-pickup             (사용자 PC)
```

**다음 세션은 ~/funnyview-pickup 에서 시작** → sandbox UI 가 frame-ops 표시 영구 종료.

## 빠른 명령 reference

```bash
# 개발
npm run dev

# 타입 체크 / 빌드
npx tsc --noEmit
npm run build

# DB
npm run db:generate          # 스키마 변경 → 마이그레이션 SQL
npm run db:migrate           # 마이그레이션 적용
npm run db:seed              # 시드 (idempotent)
npm run db:import-jinys      # 지니스안경 매장 import (~/jinys-pages 필요)

# 배포
git push origin main         # → Vercel 자동 빌드 (2-4분)
```

## 새 세션 시작 시 체크리스트

1. [ ] `docs/spec.json` 읽고 모든 확정 사항 파악
2. [ ] 사용자에게 "어느 부분 작업" 인지 명확히 받기
3. [ ] 작업 영향 portal 식별 (customer / admin / staff / store)
4. [ ] DB 스키마 변경 필요시 → 마이그레이션 0008+ 추가
5. [ ] 코드 변경 후 `npx tsc --noEmit` 통과 확인
6. [ ] commit + push (사용자 명시적 요청 후)
7. [ ] Vercel 빌드 결과 사용자에게 확인 요청

## 빌드 실패 자주 발생하는 원인

- ESLint `react/no-unescaped-entities` — JSX 텍스트의 작은따옴표 → `{"..."}` 로 감싸기
- 타입 에러 — `npx tsc --noEmit` 로 사전 검증
- 마이그레이션 충돌 — 새 컬럼 이름 중복

## 운영 후 추가 작업 (TODO)

`docs/spec.json` 의 `todos` 섹션 참조. 우선순위 high/medium/low 로 분류.

---

**작업 시작 전 사용자에게 항상 확인**:
- 이 세션에서 무엇을 진행할지
- 변경 범위 (어느 파일/portal)
- 새 환경변수 필요 여부
- DB 마이그레이션 필요 여부

질문 없이 임의 변경 ❌
