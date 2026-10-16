# 05. 아키텍처

상태: 초안

## 기술 선택

| 영역 | 선택 | 이유 |
|------|------|------|
| 호스팅 | GitHub Pages (정적) | 현재 저장소를 그대로 쓸 수 있고 무료입니다 |
| 구조 | HTML, CSS, Vanilla JS | 규모가 작고, 빌드 없이 관리합니다 |
| 잠금 | 브라우저에서 답을 확인해 본문을 복호화 | 잠금 전에는 본문이 암호문으로만 존재합니다 |
| 암호 | Web Crypto API (PBKDF2-SHA256 + AES-256-GCM) | 브라우저 기본 기능이라 외부 라이브러리가 필요 없습니다 (ADR-026) |

## 잠금 방식

### 원리
1. 편지와 바우처 같은 **본문 데이터를 답으로 암호화**해서 파일에 넣습니다. 센터 정보는 공개 HTML에 둡니다.
2. 윰댕이 질문에 답을 입력하면, 브라우저가 그 답으로 키를 만들어 본문을 복호화하고 화면에 그립니다.
3. 틀린 답이면 복호화에 실패하고, 격려 문구를 보여 줍니다. 횟수는 세지 않습니다.

### 한계 (반드시 인지)
- **답이 날짜(월·일)라면 후보가 365개뿐입니다.** 암호문을 가진 사람은 모든 날짜를 몇 초 만에 시도해 풀 수 있습니다.
- 이 잠금은 **가볍게 훑어보는 것을 막는 수준**입니다. 악의적인 사람을 막는 보안이 아닙니다.
- 이 한계는 윰댕 한 명을 상대로 하는 깜짝 선물이라는 목적에서는 실질적으로 문제가 되지 않을 가능성이 높습니다. 결정은 ADR-008로 확정했습니다. (`06-decisions.md` ADR-004, ADR-008)

### 보강 옵션 (ADR-008: A로 확정, 그대로 사용)
- A. 그대로 사용 (가볍게 막는 수준)
- B. 답 외에 고정 문구를 더해 키를 만든다. 소스를 보는 사람은 여전히 풀 수 있지만, 추측 한 번으로 풀리는 것은 막습니다.
- C. 질문을 더 어렵게 바꾼다. (예: 날짜에 연도 포함). 답이 길어지면 윰댕에게도 부담이 됩니다.

## 암호문 재생성 절차

1. `design/private/secrets.md`에서 정답과 편지 원문을 확인합니다. (이 파일은 저장소 밖으로 내보내지 않습니다)
2. `tools/encrypt.mjs`를 실행합니다(편지 문단의 `[[ ]]` 짝이 맞지 않으면 문단 번호만 알리고 실패합니다, ADR-098). 도구는 `secrets.md`의 `편지 원문` 아래 첫 코드 블록만 읽습니다. `정답:` 줄은 읽지 않습니다. 블록을 찾지 못하면 실패합니다. (ADR-042) 정답은 실행 중 프롬프트에 입력합니다(입력값이 화면에 보이지 않게). 한글로 입력할 때는 마지막 글자가 조합 중이라 빠질 수 있으므로 입력 뒤 공백을 한 번 누르고 Enter를 누르며, 도구가 알려 주는 글자 수(앞뒤 공백 제외)가 정답의 글자 수와 같은지 확인합니다. (ADR-095) 명령 인자나 환경 변수로 넘기지 않으며, 정답을 담은 파일을 만들지 않습니다.
3. 결과물 `src/data/letter.enc.json`만 갱신합니다. 정답이나 원문이 `src/`에 평문으로 들어가면 안 됩니다.
4. 복호화 테스트: 도구에 셀프 테스트 옵션으로 정답을 다시 넣어 본문이 원문과 같은지 확인하고, 틀린 정답에서는 실패하는지 확인합니다. Node는 내장 `crypto`만 씁니다.
5. 커밋 전에 `git diff --cached`로 평문 편지나 정답이 없는지 확인합니다.

## 암호문 생성

- 암호문은 **한 번 만들어서 파일에 넣는** 방식입니다. 생성 스크립트 하나(`tools/`)가 필요합니다.
- 프로젝트의 빌드 없음 방침(`CLAUDE.md` 검증 방법)과 충돌하지 않도록, 이 스크립트는 **본문이 바뀔 때만 실행하는 일회성 도구**로 둡니다. 배포 과정에 끼지 않습니다.
- 정답 처리(ADR-095, 날짜 정규화 ADR-025를 대체)와 암호문 포맷(ADR-026)을 따릅니다. 정답 입력은 암호문 도구에도 정답과 완전히 같은 표기로 해야 합니다.
- 편지를 고치면 암호문을 다시 만듭니다. 절차는 아래 '암호문 재생성 절차'를 따릅니다.

## 파일 구성 (ADR-020, ADR-050)

암호문의 내용은 ADR-026의 스키마를 따릅니다. 센터 정보는 잠금과 상관없이 공개 HTML에 둡니다.

```
src/                    # 배포 폴더 (GitHub Actions로 배포, ADR-050)
  index.html             # 구조와 문구
  css/style.css          # 스타일
  js/normalize.js        # 정답 처리 (NFC·trim, 순수 함수, 도구와 공유, ADR-039, ADR-095)
  js/accent.js           # 강조할 글자를 나누는 순수 함수: 바우처 "20회"(ADR-085), 편지 `[[ ]]` 표시(ADR-098)
  js/crypto.js           # 키 파생과 복호화 (ADR-040)
  js/screens.js          # 화면과 카드 전환(이전 카드 포함), 바우처·편지 표시, 편지 봉투 열기, 센터 주소 복사 (ADR-041, ADR-047, ADR-060, ADR-061, ADR-065, ADR-066)
  js/sound.js            # 효과음 합성: 뾱(버튼), 뿅(상자), 짜잔 (ADR-027, ADR-055, ADR-058)
  js/confetti.js         # 폭죽 (캔버스, ADR-055)
  js/app.js              # 시작점: 잠금 해제 흐름과 연결 (ADR-041)
  data/letter.enc.json   # 암호화된 본문 (생성 결과물)
  img/logo.jpg           # 센터 로고 (720×207 JPEG, 40KB 이하, ADR-048, ADR-056)
  img/og.jpg             # 링크 미리보기용 선물 상자 그림 (800×400 JPEG, 40KB 이하, ADR-064)
tools/encrypt.mjs        # 암호문 생성 (일회성, 배포 파일 아님, ADR-038)
tests/                   # 정규화·암호 왕복·페이지 구조 테스트 (배포 안 함, ADR-039, ADR-049, ADR-062)
tools/voucher.json       # 바우처 8개 값 (02 표와 같아야 함, ADR-042)
package.json             # {"type":"module"}, 의존성 없음 (ADR-043)
design/                  # 설계 문서 (SoT, 배포하지 않음)
design/private/          # 정답과 편지 원문 (Git 제외)
CLAUDE.md, .claude/      # 작업 규칙과 설정
```

- 배포되는 것은 `src/`뿐입니다. 설계 문서와 도구는 배포되지 않습니다.
- 데모의 단일 파일 원칙(`archive/v0-demo/05-architecture.md`)은 CSS와 JS를 분리하는 것으로 대체되었습니다. (ADR-020)

## 카카오톡 미리보기와 메타

- 링크 미리보기(og:title, og:description)는 중립 문구를 씁니다. 제목은 "선물이 도착했어요", 설명은 "열어 보려면 링크를 눌러 주세요"입니다. 수신자 이름을 넣지 않습니다. (ADR-021)
- og:image는 선물 상자 그림 `img/og.jpg`(800×400)이며 절대 주소(`https://rang0616.github.io/demo_page/img/og.jpg`)로 씁니다. 카카오톡이 로고를 대신 고르지 않게 하기 위해서입니다. `og:image:width`와 `og:image:height`를 함께 둡니다. 카카오톡이 이전 미리보기를 기억하면 카카오 공유 디버거에서 초기화합니다. (ADR-064)
- favicon 파일은 두지 않습니다. 브라우저의 `/favicon.ico` 404 응답은 허용합니다. `<meta name="robots" content="noindex">`를 넣습니다. (ADR-030)

## 허용 외부 리소스

| 호스트 | 용도 |
|--------|------|
| `cdn.jsdelivr.net` | Pretendard 본문 글꼴 (버전 고정) |
| `fonts.googleapis.com`, `fonts.gstatic.com` | 편지 글꼴 감자꽃(ADR-093)과 답란 글꼴 나눔손글씨 펜 (제공 확인 완료: 나눔손글씨 펜 2026-10-15, 감자꽃 2026-10-16, css2 응답 200) |
| `rang0616.github.io` | 링크 미리보기 이미지(`og:image`)의 절대 주소에만 씁니다. 이 사이트 자신입니다. (ADR-064) |
| `map.naver.com` | **이동 링크만** (센터 주소 검색). 리소스는 불러오지 않습니다. 새 탭, `rel="noopener noreferrer"` (ADR-012, ADR-060) |

이 목록에 없는 호스트는 추가하기 전에 `06-decisions.md`에 먼저 기록합니다.

## 배포 (ADR-050)

- Pages 소스는 "GitHub Actions"입니다. `.github/workflows/pages.yml`을 둡니다.
- 트리거: `main` push와 수동 실행. 단계: 체크아웃 → Node 22 설정 → `node --test tests/*.test.mjs` → 암호문 파일(`src/data/letter.enc.json`) 존재 확인 → `src/`를 아티팩트로 업로드 → Pages 배포.
- 권한: `contents: read`, `pages: write`, `id-token: write`. 동시 배포는 하나로 제한합니다.
- 배포되는 것은 `src/`뿐입니다. `design/`, `tools/`, `tests/`, `package.json`은 올라가지 않습니다.
- 사용 액션은 버전을 고정합니다.
- 사용자 설정: Settings → Pages → Source를 "GitHub Actions"로 바꿉니다. 워크플로 파일 push에는 토큰의 Workflows 쓰기 권한이 필요합니다.

## 저장소 공개 범위

- 현재 저장소는 공개입니다. 암호문과 페이지가 누구나 볼 수 있는 상태가 됩니다.
- 설계 문서(`design/`)도 공개되어 있어, 선물 내용이 검색될 수 있습니다. 프로젝트 규모와 임시 배포를 고려해 공개를 유지합니다. (ADR-034)
- 참고: 예전 데모(루트 `index.html`)에는 편지 원문이 평문으로 들어 있었습니다. v0.5에서 저장소에서 제거했고, Git 이력에는 남아 있습니다. 공개를 허용했습니다. (ADR-023)
- 로컬 확인은 `python3 -m http.server -d src`로 합니다. `file://`로 열면 암호문 `fetch`가 막힙니다.
- 비공개 저장소로 바꾸면 GitHub Pages 공개 방식이 달라질 수 있습니다. ADR-009: 공개 유지로 확정.

## 접근성·성능

- 확대 축소를 막지 않습니다.
- 로고 이미지의 alt는 "리스파이어랩 로고"입니다. (ADR-048)
- 파일 크기는 `src/` 합계 200KB 이하이며 글꼴은 제외합니다. (ADR-045)
- 암호문 복호화(PBKDF2 600,000회)는 중간 사양 기기(아이폰 14 Pro와 갤럭시 모두)에서 3초 이내여야 합니다. 로딩 표시로 대응합니다. (ADR-045)

## 도구 계약 (ADR-038)

- 실행 환경: Node 20 이상. 내장 모듈만 씁니다.
- 실행: 저장소 루트에서 `node tools/encrypt.mjs`. 셀프 테스트는 `node tools/encrypt.mjs --self-test`.
- 입력: `design/private/secrets.md`. 정답은 실행 중 TTY 프롬프트에서 입력하며 화면에 보이지 않습니다(에코 없음).
- 출력: `src/data/letter.enc.json` 하나뿐입니다. 임시 파일에 쓴 뒤 이름을 바꿔서, 실패하면 기존 파일을 건드리지 않습니다.
- 종료 코드: 성공 0, 실패 1. 실패 메시지에는 정답이나 원문을 담지 않습니다.
- `--self-test`: 정답을 다시 입력해 복호화하고 원문과 같은지 확인합니다. 아래 세 케이스를 모두 통과해야 합니다.
  1. 올바른 정답 → 원문과 일치
  2. 틀린 정답 → 복호화 실패
  3. 암호문 `ct`의 한 바이트 변조 → 복호화 실패(GCM 태그 검증)

## 테스트 (ADR-039)

- 정답 처리 함수(`normalizeAnswer`: NFC, 앞뒤 공백 제거, 빈 값은 null. ADR-095)는 `src/js/normalize.js` 한 곳에만 둡니다. 페이지와 도구가 같은 파일을 import합니다.
- `tests/normalize.test.mjs`가 `node --test tests/*.test.mjs`로 ADR-095의 규칙을 검증합니다(예시는 실제 정답과 무관한 값).
- 암호 왕복은 `--self-test`와 `tests/crypto.test.mjs`(가짜 정답과 가짜 본문 사용)가 맡습니다. 페이지의 복호화는 수동 체크리스트로 확인합니다(08 검증 절). (ADR-049)

## 복호화 오류 처리와 봉투 버전 (ADR-040)

- 세 가지 실패를 구분합니다. 메시지는 서로 다릅니다.
  - 네트워크 오류: `fetch` 실패 또는 HTTP 응답이 정상(2xx)이 아님. 메시지: "잠시 후 다시 열어 줘."
  - 데이터 오류: JSON 파싱 실패, 필드 누락·타입 불일치, salt·iv 길이 불일치, 복호화 후 평문 구조 불일치. 메시지: "선물 파일이 손상됐어. 나에게 알려 줘."
  - 틀린 답: `subtle.decrypt`가 `OperationError`를 던짐. 메시지: 격려 문구(ADR-033).
- 봉투 버전 `v`: `v`가 1이 아니면 복호화하지 않고 "페이지를 새로고침해 줘" 오류 화면을 보입니다.
- 알고리즘 파라미터(`kdf.name`, `kdf.hash`, `kdf.iter`, `cipher.name`)는 코드 상수와 다르면 진행하지 않습니다. JSON 값을 그대로 신뢰하지 않습니다.
- `fetch`에는 `cache: "no-cache"`를 씁니다. 재암호화 후 페이지와 파일이 엇갈리는 것을 줄이기 위해서입니다.

## 화면 구조와 전이 (ADR-041)

- 안내, 잠금, 상자, 카드들은 한 화면 단위로 바꿉니다. 카드에서는 바우처 다음 카드부터 이전 카드로 돌아갈 수 있고, 그 앞의 화면으로는 돌아가지 않습니다. (ADR-047, ADR-057, ADR-065)
- 상태 흐름: `intro → locked → decrypting → locked(틀림·네트워크 오류, 입력 유지) | error(데이터·버전)`, `decrypting → gift → opening → cards`. (ADR-053)
- 잠금 해제 후에는 카드를 한 장씩 넘깁니다: 효과음과 상자 연출 → 바우처 → 편지 → 센터 안내 → 예약 문구. 카드는 "다음" 버튼으로만 넘어갑니다. (ADR-047, ADR-055)
- 화면 전환 후 새 섹션 제목에 `tabindex="-1"`로 포커스를 옮깁니다. 대기·틀림 문구는 `role="status"`, 오류 화면은 `role="alert"`로 알립니다. (ADR-051)
- 지원 기기(ADR-083): 최종 수신자 윰댕의 갤럭시(S24로 알고 있음, 약 360×780, 안드로이드 크롬·삼성 인터넷·카카오톡 인앱)가 기준이고, 휘님의 아이폰 14 Pro(393×852, iOS 16 이상 Safari·카카오톡 인앱)에서도 같게 나옵니다. 그 밖에는 최근 2년 안의 버전이며 최소 폭은 320px입니다. 페이지는 밝은 색 구성만 지원한다고 알립니다(`<meta name="color-scheme" content="only light">`, CSS `color-scheme: only light`. 크롬의 강제 다크 모드 변환을 막고, 삼성 인터넷은 보장하지 못하는 한계). `-webkit-text-size-adjust`와 `text-size-adjust`는 100%입니다(브라우저의 글자 자동 확대 방지. 사용자의 글자 크기 설정은 막지 않음). iOS에서는 무음 모드에서 소리가 나지 않을 수 있고(한계), 입력창 글자는 16px 이상을 유지합니다.
- 모듈 역할: `normalize.js`(순수 함수), `accent.js`(강조할 글자를 나누는 순수 함수: 바우처 `splitAccent` ADR-085, 편지 `splitMarked`·`markersBalanced` ADR-098), `crypto.js`(키 파생, 복호화, 오류 구분), `screens.js`(화면과 카드 표시, 이동, 포커스, 바우처 채우기("20회" 강조, `VOUCHER_ACCENT`, ADR-085)와 편지 채우기, 편지 봉투 열기, 이전 카드, 예약 달력, 센터 주소 복사와 지도 링크), `sound.js`(효과음 합성), `confetti.js`(폭죽), `app.js`(흐름 연결).

## 보조 규칙 (ADR-042, ADR-043)

- 보안 컨텍스트 검사는 `fetch` 전에 수행합니다. 아니면 `error` 상태이며 문구는 01의 오류 문구 절을 따릅니다.
- `--self-test`는 TTY에서만 실행됩니다. 비TTY에서는 종료 코드 1입니다. 작성된 파일을 다시 읽어 검사합니다.

## 구현 세부 (ADR-051)

- 폼: 입력창에 `name` 속성을 두지 않고 제출 버튼은 HTML에서 비활성으로 시작합니다. JS가 연결되면 활성화합니다. JS가 꺼져 있으면 폼을 숨깁니다. 정답이 주소(URL)에 남지 않게 하기 위해서입니다.
- 요청: `fetch`는 12초 후 네트워크 오류로 처리합니다.
- 오류 분류: `v` 없음·배열 → 데이터 오류, `v`가 1이 아님 → 버전 오류, `OperationError` → 틀린 답, 그 밖 예외 → 데이터 오류.
- 도구: 절 경계를 넘어 코드 블록을 찾지 않습니다. 쓴 파일을 다시 읽어 검증하고, 실패하면 임시 파일을 지웁니다.

## 연출 구현 (ADR-053)

- 상자 연출은 CSS만 씁니다. 이미지 파일은 쓰지 않습니다. 뚜껑 이동과 회전, 투명도 변화로 0.8초 안에 끝납니다.
- 상자 버튼을 누르면 `gift → opening`(폭죽과 뿅 소리), 연출이 끝나면 `cards`(짜잔 소리)입니다. `opening` 중에는 다시 눌러도 반응하지 않습니다.
- 효과음은 `sound.js`가 WebAudio로 합성합니다. 셋입니다. (ADR-055, ADR-058)
  - `playTap`: 모든 버튼을 누를 때. 음높이가 빠르게 올라가는 짧은 소리 하나로 "뾱"을 만듭니다(약 0.1초, 음량 0.14).
  - `playPop`: 상자를 누르는 순간. 빠르게 떨어지는 음 하나로 "뿅"을 만들고 높은 반짝임 음 셋을 이어 붙입니다.
  - `playFanfare`: 바우처로 넘어갈 때. 짧은 도약음 둘 뒤에 밝은 장화음(C5, E5, G5, C6)을 울려 "짜잔"을 만듭니다. 장화음은 처음 0.35초 동안 음량을 유지한 뒤 줄어듭니다.
  - 음량은 작게 유지하며 최대 0.2 안쪽입니다.
- `AudioContext`는 첫 버튼 탭(안내 화면의 시작 버튼)의 이벤트 안에서 만들고 재개합니다. 이후 소리(뿅, 짜잔)는 같은 컨텍스트를 이어 씁니다. 실패하면 조용히 넘어갑니다. (ADR-058)
- 버튼 소리는 문서 전체의 클릭을 한 곳에서 받아 처리합니다(이벤트 위임). 비활성 버튼과 `data-own-sound`가 붙은 버튼(상자)은 제외합니다. 폼에서 Enter로 제출해도 브라우저가 제출 버튼의 클릭을 일으키므로 소리가 납니다.
- 폭죽은 `confetti.js`가 전체 화면 캔버스(`aria-hidden`, 클릭 통과)에 그립니다. 상자 위치에서 위쪽으로 터지고, 약 1.8초 뒤 캔버스를 비우고 숨깁니다. 모션 감소 설정이면 그리지 않습니다.
- 바우처와 편지는 복호화한 값을 `textContent`로 채웁니다. `innerHTML`은 쓰지 않습니다. 편지는 첫 항목을 호칭, 마지막 항목을 맺음말, 그 사이를 문단으로 나눠 넣고, 문단 안의 줄바꿈은 CSS로 보존합니다. (ADR-060)
- 카드는 `screens.js`가 관리합니다. 카드 목록의 순서는 코드의 배열 `CARD_IDS` 하나로 정합니다. 현재 순서는 바우처 → 편지 → 센터 안내 → 예약 안내입니다. (ADR-054, ADR-060, ADR-061)
- 모션 감소: `prefers-reduced-motion: reduce`이면 연출 대기 시간 없이 바로 `cards`로 갑니다.

## 카드 등장 연출과 로고 (ADR-056)

- 카드 묶음(`article.card-stack`)은 `hidden`이 풀려 나타날 때 CSS 애니메이션 하나(`card-pop`, 0.7초)로 등장하며, 이전 버튼과 "다음" 구역도 함께 움직입니다. (ADR-081) 별도의 JS 타이머는 쓰지 않습니다.
- 팡파레의 두 박자("빠" 약 0.14초, "밤" 약 0.28초)에 맞춰 키프레임의 두 지점(20%, 40%)에서 통통 튑니다. 연출이 끝난 뒤에는 연출 상태를 풀어 줍니다(`backwards`).
- 모션 감소 설정이면 이 애니메이션은 꺼집니다(전역 규칙).
- 로고는 `<img>`에 원본 크기(720×207)를 적어 레이아웃 흔들림을 막고, CSS로 카드 안쪽 폭에 맞춰 최대 300px로 보여 줍니다.

## 안내 화면 구현 (ADR-057)

- 상태 `intro`가 초기 상태입니다. 시작 버튼을 누르면 `locked`로 바꾸고 잠금 화면을 보여 줍니다.
- 안내 화면의 마크업(ADR-088): `section#screen-intro` 안에 `div.intro-stack`이 있고, 그 안에 알림 카드 `div.notice-card`(아이콘 상자 `div.notice-icon-box`: 물결 `span.notice-ring` 세 개와 아이콘 `span.notice-icon`(🎁와 배지 `span.notice-badge`), 글 `div.notice-text`: 머리글 `div.notice-head`와 제목 `h1#intro-title[tabindex="-1"]`)와 시작 버튼 `button#start-button`이 차례로 있습니다. 머리글, 아이콘, 배지, 물결은 `aria-hidden`입니다. 카드 뒤의 겹친 알림 두 장은 `.notice-card::before`와 `::after`로 그리는 그림(내용 없음)이라 읽히지 않습니다. 이름 구분: `notice-blink`는 편지 봉투 제목용(ADR-087), `.notice-*`와 `notice-in`은 안내 화면의 알림 카드용(ADR-088)입니다. 시작 버튼의 기본 상태는 보이는 상태(불투명)이고 `start-in`은 `animation: start-in 0.4s ease-out 0.7s backwards`로 지연 동안만 keyframes의 시작(투명, 12px 아래)을 적용합니다. 모션 감소 전역 규칙으로 애니메이션이 꺼지면 처음부터 보이고, 키보드 포커스를 받으면(`#start-button:focus-visible`) 애니메이션을 끄고 바로 보입니다(포커스 윤곽이 보이도록). 연출은 CSS 애니메이션만 쓰며(`notice-in`, `start-in`(시작 버튼, 0.7초 지연), `bell-ring`, `ring-pulse`) JS는 관여하지 않습니다. 포커스는 이전과 같이 제목(`#intro-title`)으로 갑니다.
- 시작 버튼은 HTML에서 비활성으로 시작해 JS가 연결된 뒤 활성화합니다. 잠금 화면은 HTML에서 `hidden`으로 시작합니다.
- 화면 목록(`SCREEN_IDS`)에 `intro`를 추가합니다. 잠금 화면으로 넘어가면 잠금 화면 제목(`#lock-heading`, 질문만 담고 이름은 `aria-labelledby`로 안내와 질문)으로 포커스를 옮깁니다. (ADR-059)
- 첫 로드에서는 포커스를 옮기지 않습니다. 안내 제목도 다른 화면처럼 `<h1 tabindex="-1">`로 둡니다. 스크린리더는 제목부터 읽습니다.
- 브라우저 히스토리를 쓰지 않습니다(`history.pushState` 금지). 브라우저의 뒤로 가기를 누르면 카드와 상관없이 페이지를 떠납니다. 화면 안의 "<" 버튼과는 별개입니다. (ADR-065)
- `<title>`은 화면마다 바꾸지 않고 "선물이 도착했어요"로 고정합니다. (ADR-030)
- 안내 화면 섹션은 `<main id="app">` 안에 둡니다. JS가 꺼져 있으면 기존 규칙(`#app` 숨김)으로 숨겨지고 noscript 안내만 보입니다.
- JS 모듈 로드가 실패하면 비활성 버튼만 남고 안내는 없습니다. 잠금 폼과 같은 한계이며 받아들입니다.

## 잠금 화면 제목의 구조 (ADR-059)

- 잠금 폼(`form#lock-form.lock-stack`)은 위에서 아래로 안내 문구 `p#lock-guide.lock-guide`(프레임 밖), 흰 프레임 `div.card.lock-frame`(안에 `h1#lock-heading`, 입력창 `input#answer`, 상태 문구 `p#status`), 제출 버튼 `button#submit`(프레임 밖)을 둡니다. (ADR-089)
- `h1#lock-heading`(`tabindex="-1"`)은 질문(`span#lock-question`)만 담고, `aria-labelledby="lock-guide lock-question"`로 안내 문구와 질문을 이어서 읽습니다. 화면에 들어오면 포커스가 이 제목으로 가서 전체를 읽습니다. (ADR-059, ADR-089) 화면 영역 `section#screen-lock`의 `aria-labelledby`도 같은 값(`lock-guide lock-question`)입니다.
- 입력창의 `aria-labelledby`는 질문(`#lock-question`)만 가리킵니다. 안내 문구까지 입력창 이름에 들어가지 않게 하기 위해서입니다. 상태 문구는 `aria-describedby="status"`로 연결합니다.
- 선물 상자 화면(`section#screen-gift`)은 프레임(`.card`)이 없습니다. 안에 화면 읽기용 `h1#gift-hint.sr-only[tabindex="-1"]`("선물 확인하기")와 `button#gift-button.gift`가 있고, 버튼 안에 파동 `span.gift-ring` 세 개(`.gift-ring-2`, `.gift-ring-3`로 지연을 줌)와 흔들리는 래퍼 `span.gift-sway`(그 안에 `span.gift-box`와 뚜껑·리본·몸통)가 있습니다. 모두 `aria-hidden`이고 CSS 애니메이션(`gift-bell`, `gift-wave`)만 쓰며 JS는 관여하지 않습니다. 상자 버튼에 `opening` 클래스가 붙으면 흔들림과 파동을 `animation: none`으로 멈춥니다. (ADR-089)

## 편지와 센터 안내 구현 (ADR-060)

- 편지 카드 묶음(`article#card-letter`)은 봉투(`#envelope`)와 편지 본문(`#letter-body`)을 함께 갖고, 이 `article`의 `data-state`가 `sealed → opening → open`으로 바뀌고, 열린 뒤 접기 버튼(`button#fold-button`, 마크업은 이전 버튼 다음, `hidden`으로 시작, `open`이 되면 보임, ADR-097)을 누르면 `open → sealed`로 돌아갑니다(봉투·제목을 다시 보이고 제목의 클래스를 `letter-heading`으로 되돌리며, 본문·"다음" 구역·접기 버튼을 숨기고, 포커스를 봉인 버튼으로 옮김). 처음에는 봉투만 보이고 본문(`hidden`)과 "다음" 버튼 구역(`.card-actions`, `hidden`)은 숨겨져 있습니다. 봉인 버튼(`#seal-button`)을 누르면 `opening`(덮개와 종이 움직임, CSS 전환)이 되고, 약 0.8초(`ENVELOPE_OPEN_MS`, ADR-075) 뒤 봉투를 숨기고 본문과 "다음" 버튼 구역을 보여 주며 `open`이 됩니다. 이때 포커스는 본문(`tabindex="-1"`)으로 옮깁니다. 모션 감소 설정이면 `opening`을 거치지 않고 바로 `open`입니다. 카드의 이름은 제목 `#letter-heading`(`h1`, 처음에는 "편지가 도착했습니다!"로 보이고 편지가 열리면 `sr-only`로 바뀜, ADR-074)이 맡습니다. (ADR-066) 봉투 상태(`sealed`)에서는 제목이 깜빡이고(`notice-blink`, 1.6초) 봉투가 좌우로 흔들리며(`envelope-wiggle`, 2.4초 주기) `opening`이 되면 둘 다 멈추고(제목은 전환 없이 바로 사라져 다시 진해지는 번쩍임이 없고, 봉투는 바로 반듯해짐), 모션 감소 설정에서는 없습니다. 둘 다 카드 등장 연출(0.7초)이 끝난 뒤 시작합니다. JS는 관여하지 않는 CSS 애니메이션입니다. (ADR-087)
- 예약 안내 카드의 달력(`#calendar`, ADR-069, ADR-072)은 이렇게 만듭니다.
  - JS가 `CALENDAR_MONTHS`(2026년 10월, 11월)로 만들어 채웁니다. 달마다 `div.calendar-month` 안의 `table`(`caption` "2026년 10월", 요일 `th`, 날짜 `td`)이고, 1일의 요일은 `new Date(연, 월-1, 1).getDay()`, 말일은 `new Date(연, 월, 0).getDate()`로 계산합니다. 슬라이드는 CSS 스크롤 스냅(가로)이며, 달력 영역은 `role="region"`, `tabindex="0"`, `aria-label="10월과 11월 달력"`입니다. 스크롤 비율로 아래 점의 현재 표시(`is-current`, `aria-current`)를 갱신합니다. 내용 프레임 안의 버튼은 아래의 월 이동 점 두 개(`button.calendar-dot`, 누르면 `calendar.scrollTo`로 그 달 슬라이드로 이동, ADR-077)뿐이고(이전 버튼은 카드 묶음에 있음, ADR-081) 링크와 입력창은 없습니다.
  - 한 장은 영역 폭의 100%이고, 열이 일요일(0번째)이면 `is-sun`, 토요일(6번째)이면 `is-sat` 클래스를 요일 머리글과 날짜 칸에 붙여 색을 정하며(ADR-079), 날짜 칸은 오늘(`new Date()`의 날짜, 시각 제외)보다 앞이면 `is-past` 클래스, 코드 상수 `CALENDAR_BIRTHDAY`(11월 18일)와 같으면 `is-birthday` 클래스와 하트 요소(`aria-hidden`), 보이지 않는 글 "윰댕 생일"(`sr-only`)을 갖습니다.
- 센터 카드(`div.card.center`(CSS가 메탈 모양을 입힘))의 버튼은 `.center-actions` 안에 한 줄로 지도 링크(`#map-link`, 보이는 글 "지도로 보기", `aria-label="네이버 지도로 보기"`)가 왼쪽, 주소 복사(`#copy-address`)가 오른쪽에 있고 복사 결과 문구 `#copy-status`는 그 아래입니다. (ADR-090) 지도 링크는 앞에 인라인 SVG "N" 아이콘(`aria-hidden`)을 두고, 색은 `--naver`, `--on-naver` 변수로 정합니다. 소개 문구 목록(`.center-benefits`)은 삭제했습니다. (ADR-068)
- 편지 본문 문단의 강조(ADR-098): 문단 안에서 `[[`와 `]]`로 감싼 문구를 `splitMarked`가 `{ text, accent }` 조각으로 나누고, 화면 코드가 텍스트 노드와 `span.letter-accent`(`textContent`만 사용)로 채워 표시 문자는 보이지 않게 합니다. 짝이 맞지 않는 문단(`markersBalanced`가 거짓)은 글자 그대로 보여 줍니다. 암호문 도구는 짝이 맞지 않는 문단이 있으면 몇 번째 문단인지(번호만)를 알리고 실패합니다. 호칭과 맺음말에는 적용하지 않습니다.
- 편지의 맺음말은 암호문의 마지막 항목(`letter[letter.length - 1]`)을 그대로 보여 줍니다. 임시로 서명을 대신 보여 주던 `CLOSING_OVERRIDE`는 2026-10-17에 암호문을 다시 만든 뒤 지웠습니다. (ADR-076)
- 카드 마크업(ADR-081): `article#card-…`(`class="card-stack"`, `data-card`, `tabindex="-1"`, `aria-labelledby`) 안에 이전 버튼(`button.back-button[data-back]`, 바우처 제외), (편지 카드만) 접기 버튼(`button#fold-button.fold-button`, ADR-097), 내용 프레임(`div.card`에 카드별 클래스 `voucher`/`letter`/`center`/`booking`), "다음" 버튼 구역(`div.card-actions`, 안에 `button[data-next]`, 마지막 카드 제외)을 차례로 둡니다. 등장 연출은 `article` 전체에 붙습니다. 편지 카드의 `data-state`는 `article`에 있고, 열리면(`open`) CSS가 프레임의 좌우·아래 여백을 없앱니다. 편지 카드의 프레임은 봉투 상태에서도 흰 바탕과 그림자가 없습니다(ADR-086).
- 이전 버튼은 카드마다 하나씩이며 보이고 숨기는 JS가 없습니다(바우처 카드에는 아예 없음). 누르면 한 장 앞 카드를 보여 줍니다. 편지 카드의 "다음" 버튼 구역(`.card-actions`)은 `hidden`으로 시작해 편지가 열리면 JS가 보여 주고, 접기 버튼을 누르면 다시 숨깁니다. 접기 버튼(`#fold-button`)도 `hidden`으로 시작해 `open`이 되면 보이고 접으면 숨깁니다. 접을 때 `article`에 `data-refold`를 붙여 `.letter`가 0.35초 페이드로 나타나게 하고(페이드가 끝나거나 `opening`이 되면 지움), 포커스는 봉인 버튼으로 옮깁니다. (ADR-065, ADR-081, ADR-097)
- 센터 정보는 공개 HTML에 정적으로 둡니다. 주소는 `<address>` 텍스트 한 곳이며, 복사할 값과 지도 링크의 검색어는 이 텍스트에서 읽습니다. 지도 링크의 주소(`href`)는 JS가 이 텍스트로 만듭니다.
- 주소 복사는 `navigator.clipboard.writeText`만 씁니다. 실패하면(API가 없거나 거부됨) 실패 문구를 보여 줍니다. 복사 결과 문구는 `role="status"` 영역에 같은 방식으로 다시 읽히게 갱신합니다.
- 지도 링크는 새 탭(`target="_blank"`)이며 `rel="noopener noreferrer"`를 붙입니다.

## 예약 안내 카드 구현 (ADR-061)

- `article#card-booking`(`tabindex="-1"`, `aria-labelledby="booking-message"`)에 작은 라벨(`.booking-label`)과 본문 `h1#booking-message`, 달력 영역을 감싸는 흰 프레임 `div.calendar-frame`(안에 `#calendar`와 `.calendar-dots`, ADR-089)만 둡니다. 예약 카드의 `div.card`는 프레임이 없습니다. 문장 사이는 `<br>`로 줄을 바꾸고, 💌는 앞에 줄바꿈하지 않는 공백(`&nbsp;`)을 두어 홀로 한 줄에 남지 않게 하며 `aria-hidden`입니다.
- 마지막 카드이므로 `data-next`가 없고, 달력의 월 이동 점 두 개(ADR-077)와 이전 버튼 외에는 버튼·링크·입력창을 두지 않습니다. `tests/page.test.mjs`가 이 규칙을 파일 검사로 지킵니다. (ADR-062)

## 페이지 구조 테스트 (ADR-062)

- `tests/page.test.mjs`가 `index.html`, `screens.js`, 설계 문서(02, 01)를 글자로 읽어 카드 순서와 속성, 편지 처음 상태(봉투, ADR-066), 이전 카드 버튼(ADR-065, 카드마다 하나씩 ADR-081), 카드 묶음 구조(ADR-081, 예약 카드의 버튼 검사는 내용 프레임 `div.card.booking` 기준), 미리보기 이미지(ADR-064), 센터 카드(로고, 지도 버튼, 소개 문구 없음, ADR-068), 예약 달력(ADR-069)과 월 이동 점 버튼(ADR-077), 요일 색(ADR-079), CSS·JS 주소의 `?v=` 일치(ADR-078), 문구 일치, 메타, 접근성 규칙, 외부 주소 허용 목록, 금지 API, 크기 예산, 암호문 구조를 검사합니다. 브라우저 동작은 `/preview-check`가 맡습니다.

## 배포 때의 캐시 대책 (ADR-078)

- GitHub Pages는 모든 파일을 `cache-control: max-age=600`(10분)으로 내려 줍니다. 새 HTML에 옛 CSS·JS가 섞이는 것을 막으려고 `index.html`의 CSS·JS 주소와 JS 모듈의 `import` 주소에 같은 `?v=버전` 쿼리를 붙입니다. 배포할 때 이 값을 새 버전으로 올립니다. 모든 위치의 값이 같은지는 `tests/page.test.mjs`가 검사합니다.
