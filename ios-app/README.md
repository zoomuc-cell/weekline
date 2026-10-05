# WEEKLINE iOS 앱

웹(PWA) 위클라인을 그대로 감싼 아이폰·아이패드 앱입니다 (Capacitor 8, Swift Package Manager).
화면과 기능은 저장소 루트의 `index.html`, `en/index.html` 과 같고, 아이폰 앱에서만 되는 두 가지가 더해집니다.

| | 웹(PWA) | iOS 앱 |
|---|---|---|
| 미팅 준비·출발 알림 | 앱이 열려 있을 때만 | **앱을 닫아도 iOS가 제시간에 알림** (다가오는 60건) |
| 백업 | 파일 다운로드 | **공유 시트** (파일 앱 · AirDrop · 메일) |
| 노치 · 다이내믹 아일랜드 | – | 화면 위 안전 영역 확보 |

기록은 지금처럼 기기 안에만 저장되고 서버로 가지 않습니다.

## 구조

- `build_www.py` — 루트의 PWA 파일로 앱용 `www/` 를 만듭니다 (iOS 전용 코드 주입).
- `ios/` — Xcode 프로젝트. 번들 ID `io.github.zoomuc.weekline` (App Store Connect에서 앱을 만들 때 바꿀 수 있음).
- `resources/make-assets.js` — 앱 아이콘(1024)과 시작 화면 생성.
- `qa/test_native.js` — iOS 연결부(알림 예약·취소, 백업 공유)를 브라우저에서 시험.
- `.github/workflows/ios.yml` — 푸시마다 macOS에서 시뮬레이터용으로 컴파일해 확인합니다.

## 웹을 고친 뒤

루트의 `index.html` 이 바뀌면 워크플로가 자동으로 앱도 다시 빌드합니다. 수동으로는:

```sh
cd ios-app
npm ci
python3 build_www.py
npx cap sync ios
```

## App Store / TestFlight 올리기 (대표님이 할 일)

1. **Apple Developer Program 가입** — developer.apple.com, 연 US$99 (약 13만 원). 개인 또는 사업자(D-U-N-S 번호 필요).
2. **App Store Connect에서 앱 만들기** — 번들 ID `io.github.zoomuc.weekline` (또는 원하는 ID로 바꾸고 알려 주세요), 이름 WEEKLINE.
3. **API 키 만들기** — App Store Connect › 사용자 및 액세스 › 통합 › App Store Connect API › 키 추가 (역할: 관리자). `.p8` 파일을 받습니다.
4. **GitHub 저장소 Secrets 등록** — Settings › Secrets and variables › Actions
   - `APPLE_TEAM_ID` — 멤버십 페이지의 팀 ID (10자리)
   - `ASC_KEY_ID` — 키 ID
   - `ASC_ISSUER_ID` — 발급자 ID
   - `ASC_KEY_P8` — `.p8` 파일 내용 전체
5. **Actions › iOS app › Run workflow** 에서 `testflight` 를 체크하고 실행 → 10~20분 뒤 TestFlight에 빌드가 올라옵니다.
6. TestFlight에서 테스터(최대 1만 명)를 초대하거나, 심사 제출.

맥(Mac)이 없어도 위 과정만으로 올릴 수 있습니다. 심사용 개인정보 처리방침 주소: https://zoomuc-cell.github.io/weekline/privacy.html
