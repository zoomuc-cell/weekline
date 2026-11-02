# 메모 받기(Memo Inbox) 설계

- 작성일: 2026-11-02
- 상태: 검토 대기
- 후속 예정: 기기 캘린더 연동(별도 스펙), 웹 `.ics` 내보내기(선택)

## 1. 목표

다른 앱(Claude, ChatGPT, 카카오톡, 메모장 등)의 글을 위클라인의 **오늘 메모** 또는 **이번 주 메모**에 **덧붙인다**. AI 비서가 정리한 업무 일지를 사용자가 손쉽게 위클라인에 쌓는 것이 1차 사용 사례다.

성공 기준:
- 갤럭시(안드로이드 앱)에서 다른 앱의 글을 **공유 → WEEKLINE** 으로 보내면 확인 화면이 뜨고, 확인 시 오늘/이번 주 메모 끝에 덧붙는다.
- 모든 환경(안드로이드·아이폰 앱, 웹 앱, PC)에서 메모 카드의 **붙여넣기로 추가** 버튼으로 같은 확인 화면을 쓸 수 있다.
- 기존 메모 내용은 어떤 경우에도 지워지거나 덮어써지지 않는다.
- 사용자가 확인 버튼을 누르기 전에는 아무것도 저장되지 않는다.

## 2. 범위

| 환경 | ① 공유하기로 받기 | ③ 붙여넣기 버튼 |
|---|---|---|
| 안드로이드 앱 (Capacitor) | ✅ 이번 범위 | ✅ |
| 웹 앱 — 안드로이드 크롬에 설치(PWA) | ✅ 이번 범위 (Web Share Target) | ✅ |
| PC 웹 | – | ✅ |
| 아이폰 앱·웹 | ⏳ 2차 (Share Extension, Apple 개발자 등록 후) | ✅ |

범위 외: 아이폰 Share Extension, 링크(딥링크)로 받기, 과거 날짜 메모에 넣기(앱이 오늘/이번 주 메모만 보여 주므로), 이미지·파일 받기(텍스트만).

## 3. 사용자 흐름

1. 진입: 공유로 받은 글, 또는 붙여넣기 버튼(클립보드 읽기 → 실패 시 빈 입력칸).
2. **메모 받기 시트**(화면 하단 시트, 기존 카드 스타일):
   - 제목 `메모 받기` / 영어 `Add to memo`
   - 받은 글 미리보기 — 수정 가능한 `textarea`
   - 버튼: `[오늘 메모에 추가]` `[이번 주 메모에 추가]` `[취소]` / `Add to today` `Add to this week` `Cancel`
3. 추가 시 대상 메모 끝에 아래 형식으로 덧붙이고 토스트 `오늘 메모에 추가했습니다` / `이번 주 메모에 추가했습니다`, 해당 화면(`#today` / `#week`)으로 이동.

덧붙이는 형식(기존 메모가 비어 있으면 구분선 없이 본문만):
```
{기존 메모}

— 14:05 가져옴
{받은 글}
```
영어: `— 14:05 imported`. 시각은 앱 기존 기준(KST, `kstNow()`·`hm()`).

## 4. 규칙

- **덧붙이기 전용:** 기존 `text` 앞부분은 절대 바꾸지 않는다.
- **중복 방지:** 정리(trim)한 받은 글이 대상 메모에 이미 그대로 들어 있으면 저장하지 않고 토스트 `이미 메모에 있는 내용입니다` / `Already in your memo`.
- **빈 글:** 정리 후 비어 있으면 추가 버튼 비활성화.
- **길이 제한:** 받은 글 10,000자까지. 넘으면 잘라서 미리보기에 표시하고 `앞 10,000자만 가져옵니다` 안내.
- **텍스트만 취급:** 화면 표시는 기존 `esc()` 로 이스케이프 — HTML로 해석하지 않는다.
- 공유 데이터의 `title`·`url` 이 함께 오면 본문 앞뒤에 한 줄씩 붙인다(`title` 은 첫 줄, `url` 은 마지막 줄; 본문에 이미 포함돼 있으면 생략).

## 5. 구성

### 5.1 공통 웹 로직 — `index.html`, `en/index.html` (두 파일 동일 로직, 문구만 언어별)
- `memoAppend(kind, text)` — 대상 메모 ID(`memoId(kind)`)의 현재 `text` 뒤에 4장 형식으로 덧붙이고 기존 저장 경로 `save('memos/'+id, {text, updated, kind})` 사용. 결과: `'added' | 'duplicate' | 'empty'`.
- `inboxOpen(text, source)` — 메모 받기 시트 표시. `source` 는 `'share' | 'paste'`(문구 차이 없음, 테스트용).
- 메모 카드(`memoCard`) 오른쪽 위에 `붙여넣기로 추가` / `Paste to add` 작은 버튼 추가 → `navigator.clipboard.readText()` 성공 시 그 글로, 실패·거부 시 빈 입력칸으로 `inboxOpen`.
- **웹 공유 진입:** 시작 시 `location.search` 에 `share-target` 이 있으면 `text`·`title`·`url` 파라미터를 읽어 `inboxOpen(...,'share')` 후 `history.replaceState` 로 쿼리 제거.
- **언어 자동 이동 보존:** 맨 위 `wl-lang-redirect` 스크립트가 `en/` 으로 옮길 때 `location.hash` 만 넘기므로 `location.search` 도 함께 넘기도록 수정(공유 내용 유실 방지).
- 저장소 준비 전(`S.db` 없음)에 받은 글은 대기열에 두었다가 준비되면 시트를 연다.

### 5.2 웹 앱 매니페스트 — `manifest.webmanifest`, `en/manifest.webmanifest`
```json
"share_target": { "action": "./?share-target", "method": "GET",
  "params": { "title": "title", "text": "text", "url": "url" } }
```
`sw.js` 의 `VERSION` 을 올려 설치된 앱이 갱신되게 한다.

### 5.3 안드로이드 앱
- `AndroidManifest.xml` — `MainActivity` 에 `ACTION_SEND`, `text/plain` intent-filter 추가(앱 시작 액티비티 재사용, `launchMode="singleTask"` 확인).
- `MainActivity.java` — 작은 로컬 Capacitor 플러그인 `ShareInbox` 등록:
  - 받은 intent(`onCreate`·`onNewIntent`)의 `EXTRA_TEXT`/`EXTRA_SUBJECT` 를 대기 값으로 보관
  - JS 메서드 `take()` → 대기 값을 돌려주고 비움(한 번만 소비)
  - 앱이 열려 있는 중 새로 받으면 `received` 이벤트 발생
- `app/build_www.py` NATIVE 블록 — 앱 시작·재개 시 `ShareInbox.take()` 확인, `received` 이벤트 구독 → `inboxOpen(text,'share')`.
- 아이폰 빌드에는 영향 없음(플러그인 미등록 시 조용히 건너뜀).

## 6. 오류 처리

| 상황 | 처리 |
|---|---|
| 클립보드 권한 거부/미지원 | 빈 입력칸으로 시트 열기, 안내 `여기에 붙여 넣으세요` |
| 저장 실패(용량 부족 등) | 기존 `save()` 의 토스트 그대로, 시트는 닫지 않음 |
| 공유 글이 비어 있음 | 시트 열지 않고 토스트 `가져올 글이 없습니다` |
| 시트가 열린 상태에서 새 공유 도착 | 열린 시트의 입력칸 내용을 새 글로 교체 |

## 7. 테스트

- 자동(`app/qa/` Playwright, 기존 방식):
  - 빈 메모 + 추가 → 본문만 저장
  - 기존 메모 + 추가 → 기존 내용 보존 + 구분선 + 본문
  - 같은 글 두 번 → 두 번째는 저장 안 됨
  - 취소 → 저장 안 됨
  - `?share-target&text=...` 로 열기 → 시트 표시, 쿼리 제거
  - 언어 이동 시 쿼리 보존
  - 영어 페이지 동일 동작
- 수동(개발자 갤럭시): Claude 앱 글 → 공유 → WEEKLINE → 오늘 메모 확인 / 앱이 꺼진 상태·켜진 상태 각각.

## 8. 문서·정책

- `README.md`, `app/README.md` 에 사용법 한 줄.
- 개인정보처리방침: 받은 글은 기기 안 메모에만 저장, 서버 전송 없음 — 기존 문구로 충분한지 확인 후 필요 시 한 줄 추가.
