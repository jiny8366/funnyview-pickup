# Funnyview Pickup — 신규 개발자(Windows/WSL) 온보딩

> **대상**: `w1` 등 Windows + WSL 환경 신규 합류 개발자(또는 그 Claude Code 세션).
> Mac 환경은 [CLAUDE.md](../CLAUDE.md) 의 "새 머신 온보딩" 참고. 이 문서는 **Windows 전용 차이**를 채운다.
> 순서대로 따라 하면 합류가 끝난다. 막히면 Genius Talk 에 `@M3 @M1` 로 질문.

## 0) 사전 — 사람(JINY)이 준비해 주는 것
- **시크릿 `.env.local`** — git 에 안 올라가는 민감정보. Mac↔Win 은 AirDrop 불가이니 **암호화 메모/1Password/USB** 등 안전 경로로 전달. (키 목록은 `.env.example`)
  - 핵심: `DATABASE_URL`(로컬 docker postgres 주소), `JWT_SECRET`, (선택) OAuth/SOLAPI 키.
  - ※ prod DB(Supabase 6543)는 로컬 개발에 직접 쓰지 않음 — 로컬은 docker postgres 사용(머신별 독립).
- **Genius Talk 토큰** — M1 이 `GT_TOKENS` 에 `w1-...` 발급함. 그 값을 받아 `GT_TOKEN` 으로 사용.

## 1) WSL2 + Ubuntu (PowerShell 관리자)
```powershell
wsl --install -d Ubuntu
# 재부팅 → Ubuntu 사용자 계정 생성
```

## 2) 도구 설치 (Ubuntu/WSL 터미널)
```bash
sudo apt update && sudo apt install -y git curl build-essential
# Node 20 (nvm 권장)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
. ~/.nvm/nvm.sh && nvm install 20 && nvm use 20
node -v   # v20.x 확인
```
**Docker** — 둘 중 하나:
- (권장) **Docker Desktop**(Windows) 설치 → Settings → Resources → **WSL Integration** 에서 해당 배포판 켜기.
- 또는 WSL 안에 직접: `sudo apt install -y docker.io docker-compose-plugin && sudo usermod -aG docker $USER` (재로그인).
- 확인: `docker info` 가 에러 없이 나오면 OK.

## 3) 레포 클론
```bash
cd ~ && git clone https://github.com/jiny8366/funnyview-pickup.git
cd funnyview-pickup
```
> ⚠️ **WSL 안 리눅스 파일시스템(`~/`)** 에 클론할 것. `/mnt/c/...`(윈도우 드라이브)는 I/O 가 느리고 권한 이슈가 있음.

## 4) 시크릿 배치
`~/funnyview-pickup/.env.local` 에 JINY 가 준 내용을 붙여넣는다. (`.env.example` 의 키 구조와 동일)

## 5) 한 방 셋업 (크로스플랫폼)
```bash
bash scripts/dev-up.sh
```
이게 자동으로: 엔진 확인(docker 직접/colima) → `npm install` → postgres+redis(docker compose) → `drizzle-kit push`(스키마) → `db:seed`.
> 마이그레이션 메타가 0013 에서 깨져 있어 **로컬은 `drizzle-kit migrate` 말고 `drizzle-kit push`** 를 쓴다(dev-up.sh 가 처리).

## 6) 개발 서버 + 동기화 검증
```bash
npm run dev          # http://localhost:3001
bash scripts/sync-check.sh   # HEAD·behind/ahead(0/0)·docker=running·seed-counts·env-keys 확인
```
M1/M3 의 sync-check 출력과 **HEAD·seed-counts·env-keys 가 같으면 동일 컨디션**.

## 7) Genius Talk 합류 (gt CLI)
```bash
git clone <genius-talk repo>   # 또는 M1/M3 와 동일 위치(~/genius-talk)
export GT_URL="https://genius-talk.vercel.app"
export GT_TOKEN="w1-...(M1 발급분)"
~/genius-talk/bin/gt feed          # 피드 보임 = 인증 OK
~/genius-talk/bin/gt post "🟢 [w1] 합류 완료 — WSL 셋업·sync-check 통과. 운영 루프 진입합니다."
```

## 8) 작업 규약 (전 멤버 공통)
- **동기화 의식**: 작업 전 `git pull --ff-only origin main`, 작업 후 즉시 `git push`.
- **검증**: `npx tsc --noEmit` + `npm run lint` 통과 후 커밋. main 은 실서비스 영향 → 신중히.
- **단일 파일 오너 / 동시편집 회피**: 비주얼=M1, 로직/백엔드/인프라=M3. 겹치는 파일은 Talk 로 사전 조율.
- **복명복창**: JINY 지시 → `gt copy <지시#> "인지내용"`.
- 의사결정 Yes/No 는 Talk 로 상대에게 질문. 배포 간격은 넓게(연속 배포 시 DB 연결 블립).

## 막히는 지점 빠른 해결
- `dev-up.sh` 가 "docker 데몬 못 찾음" → Docker Desktop WSL 통합 켜기 / `docker info` 확인.
- `drizzle-kit push` 실패 → `.env.local` 의 `DATABASE_URL` 이 로컬 postgres(`localhost:5432`) 를 가리키는지 확인.
- `gt feed` 401 → `GT_TOKEN` 오타/만료 → M1 에게 재발급 요청.
- 빌드 ESLint `react/no-unescaped-entities` → JSX 따옴표를 `{"..."}` 로 감싸기.
