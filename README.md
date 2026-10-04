# WEEKLINE 주간 플래너 (베타) · Weekly Planner (beta)

**한국어** · [English](#english)

목표에서 오늘까지 한 줄로 잇는 주간 플래너입니다. 휴대폰과 PC 홈 화면에 설치해서 앱처럼 쓸 수 있습니다.

- **목표 표지**: 개인·회사(이름 변경 가능) 두 구분의 연간·분기 목표와 달성도(%)
- **오늘**: 요일별 기본 틀, 6영역 블록 체크
- **이번 주**: 역할별 큰 돌, 주간 달성률
- **일정·미팅·출장**: 빈 시간 추천, 이동 시간, 준비·출발 알림

### 설치
- **Android (Chrome)**: 주소를 연 뒤 메뉴 → "앱 설치" 또는 "홈 화면에 추가"
- **iPhone (Safari)**: 공유 버튼 → "홈 화면에 추가"
- **PC (Chrome·Edge)**: 주소창 오른쪽 설치 아이콘

### 데이터
회원가입이 없고 서버로 데이터를 보내지 않습니다. 기록은 기기 브라우저에만 저장되며, 목표 화면 아래 "백업 파일 받기 / 백업에서 복원"으로 옮길 수 있습니다. 자세한 내용은 [개인정보 처리방침](privacy.html)을 보세요.

---

## English

A weekly planner that links your goals to today. Install it on your phone or computer and use it like an app.

- **Goals cover**: yearly and quarterly goals on two tracks (Personal · Company, renamable) with progress in %
- **Today**: weekday templates and checks across 6 areas
- **This week**: Big Rocks by role and weekly completion
- **Schedule · meetings · trips**: free-time suggestions, travel time, prep and leave alerts

### Install
- **Android (Chrome)**: open the address, then menu → "Install app" or "Add to Home screen"
- **iPhone (Safari)**: Share → "Add to Home Screen"
- **Computer (Chrome · Edge)**: the install icon at the right of the address bar

### Your data
No sign-up, and nothing is sent to a server. Records stay in your device’s browser; move them with "Download backup / Restore from backup" at the bottom of the Goals page. See the [privacy policy](en/privacy.html).

The app opens in English automatically when your browser language is not Korean. Switch any time with the link at the bottom of the Goals page.

---

## 배포 · Deploy
정적 파일만으로 동작하며 GitHub Pages(Settings → Pages → `main`, `/ (root)`)로 배포합니다. 새 버전을 올릴 때는 `sw.js`의 `VERSION` 값을 바꿔야 설치된 앱이 업데이트를 받습니다.

Static files only, deployed with GitHub Pages. Bump `VERSION` in `sw.js` on every release so installed apps pick up the update.
