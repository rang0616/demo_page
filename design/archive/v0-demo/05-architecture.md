# 05. 아키텍처

상태: 초안

## 기술 선택

| 영역 | 선택 | 이유 |
|------|------|------|
| 마크업·스타일 | HTML, CSS (인라인 `<style>`) | 파일 하나로 공유와 배포가 쉽습니다 |
| 스크립트 | Vanilla JS (인라인 `<script>`) | 빌드 도구가 필요 없습니다 |
| 오디오 | Web Audio API | 외부 음원 파일 없이 BGM과 효과음을 만듭니다 |
| 연출 | canvas-confetti 1.9.2 | 콘페티 효과 |
| 폰트 | Pretendard v1.3.9, Cormorant Garamond | 한국어 본문과 영문 장식 |
| 호스팅 | GitHub Pages | `main` 푸시 시 자동 배포 |

## 파일 구성

```
index.html         # 페이지 전체 (HTML + CSS + JS)
리스파이어랩.png    # 바우처 로고 이미지
README.md          # 배포 주소 등 최소 정보
design/            # 설계 문서 (SoT)
CLAUDE.md          # Claude Code 헌법과 작업 규칙
.claude/           # 설정과 커맨드
```

### 단일 파일 원칙

- 페이지 본문, 스타일, 스크립트는 `index.html` 한 파일에 둡니다.
- 파일을 나누는 것은 다음 조건 중 하나를 만족할 때만 허용합니다.
  1. `index.html`이 2,500줄을 넘어 탐색이 어려워졌을 때
  2. 두 개 이상의 페이지가 필요해졌을 때
  3. 이 결정을 `06-decisions.md`에 먼저 기록했을 때

## 코드 구획 (JS)

`index.html` 하단 `<script>`의 순서입니다. 이 순서와 이름은 설계 문서에서 관리하며, 바꿀 때는 `06-decisions.md`에 기록합니다.

1. 편지 토글 — `toggleLetter()`
2. 오디오 엔진 — `initAudio`, `playNote`, `startRomanticBGM`, `stopRomanticBGM`
3. 효과음 — `playUnboxingChime()`
4. 상자 열기 — `openGift()`, 콘페티 `launchCelebrationConfetti`, `launchMiniConfetti`
5. 예약 캘린더 — `openCalendarModal`, `renderCalendar`, `selectTimeSlot`, `updateScheduleSummary`, `sendScheduleToBoyfriend`
6. 주소 복사 — `copyAddress()`

## 외부 리소스 정책

- 허용 호스트: `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com`
- 새 CDN은 **버전을 고정**하고, 이 목록에 먼저 추가한 뒤 사용합니다.
- 외부 스크립트는 실패해도 페이지가 열려야 합니다. (`confetti` 미정의 시 연출만 건너뜀 — 현재 구현 방식 유지)

## 상태 관리

- 전역 변수로 최소한만 씁니다: `isOpened`, `isPlaying`, `selectedDate`, `selectedTime`, `calDate`.
- 서버 상태, 로컬 저장소는 사용하지 않습니다. 새로고침하면 처음부터 다시 시작합니다. (의도된 동작)

## 배포

1. 변경 → 로컬에서 `open index.html`로 확인 (`/preview-check`)
2. 사용자 승인 후 `main`에 커밋·푸시
3. GitHub Pages가 반영하는 데 몇 분 걸릴 수 있으니 실제 URL을 다시 확인합니다.

## 접근성·성능 기준

- 뷰포트에서 `user-scalable=no`를 쓰지 않습니다. (현재 위반 — `07-open-questions.md` 참고)
- 이미지에는 `alt`를 씁니다.
- 아이콘 버튼에는 `aria-label`을 씁니다.
- `index.html` 전체 크기는 150KB 이하를 목표로 합니다. 현재 약 50KB입니다.
