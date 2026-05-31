# 협업 동기화 프로토콜 (M1 · M3 · web)

> 레포를 **메시지 버스**로 쓰는 비동기 turn 기반 협업 약속.
> 직접 통신 불가 → `push`(보내기) / `pull`(받기)로만 소통. 같은 일을 양쪽에서 중복하지 않는다.

## 식별
- 자기 역할은 **hostname**으로 판별: `M1`/`M3` 문자열 포함. (M3 = `…M318M`, M1 = `…M1…`)
- 확실치 않으면 사용자에게 1회 확인.

## 채널 파일
| 파일 | 용도 |
|---|---|
| `docs/sync/PROTOCOL.md` | 이 룰북(공통) |
| `docs/sync/channel.jsonl` | append-only 메시지 로그 (= 대화 기록) |
| `docs/sync/state.json` | turn 토큰 `{ "turn": "M1"\|"M3", "seq": N, "updatedBy", "updatedAt" }` |

## 메시지 스키마 (channel.jsonl 한 줄 = JSON 1개)
```json
{"seq":N,"ts":"<ISO8601>","from":"M3","to":"M1",
 "type":"handoff|ack|claim|update|question|answer|done|blocked",
 "summary":"한 줄 요약","body":"상세/결과",
 "claim":"내가 맡는 일감(없으면 \"\")","trigger":"상대가 할 일 한 줄","next_turn":"M1"}
```

## 규칙 (핵심)
1. **턴 락** — `state.json.turn == 나` 일 때만 행동한다. 아니면 대기. (동시 작업·충돌 방지)
2. **인지** — 내 턴이면 `channel.jsonl`의 마지막 미처리 메시지를 읽고 그 `trigger` 를 수행.
3. **교대** — 끝나면 ① `channel.jsonl` 에 답신 append ② `state.json` 의 `turn` 을 상대로, `seq`+1 ③ commit & push.
4. **순서** — 항상 `git pull --ff-only origin main` 먼저 → 작업 → `git push`. push 거부되면 pull 후 재시도(append-only라 보통 자동 병합).
5. **분담** — 같은 일감을 둘이 동시에 잡지 않는다. 맡을 때 `claim` 표기, 끝나면 `type:"done"`. 의문은 `question` → 상대가 `answer`.
6. **품질** — 코드 push 전 `npx tsc --noEmit` + `npm run lint` 통과.
7. **보호** — `docs/spec.json` 임의변경·prod 스키마/데이터 변경은 사용자 동의 후. `db:generate` 금지(메타 손상, known-issues.md) → 로컬은 `drizzle-kit push`. frame-ops 무관.

## 턴 공급(누가 깨우나) — 둘 중 택1
- **수동 릴레이**: 상대가 push하면 사용자가 그쪽 세션에 "동기화 채널 확인해" 한 줄.
- **자율 루프**: 각 머신에서 한 번 켜두면 폴링.
  ```
  /loop 5m 동기화 채널 확인 — git pull --ff-only 후 docs/sync/state.json turn 이 내 쪽이면
  docs/sync/channel.jsonl 마지막 메시지 처리하고 PROTOCOL.md 대로 답신 append + turn 교대 + push, 아니면 대기
  ```

## 보고
- 작업/응답 시 사용자에게 요약 보고. 셋업/동기화 시 `bash scripts/sync-check.sh` 출력 첨부.
