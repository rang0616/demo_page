# demo_page

비밀번호를 맞혀야 열리는 개인 웹 페이지 프로젝트입니다. 정적 HTML, CSS, JavaScript로 만들고 GitHub Pages로 배포합니다.

- 배포 주소: https://rang0616.github.io/demo_page/
- 설계 문서의 진입점: [design/README.md](design/README.md)
- 작업 규칙: [CLAUDE.md](CLAUDE.md)

## 저장소 구조

```
demo_page/
├── README.md              # 이 문서. 저장소 소개와 구조
├── CLAUDE.md              # Claude Code 작업 헌법과 규칙
├── design/                # 설계 문서 (단일 진실 공급원)
│   ├── README.md          # 설계 문서 목록과 작성 규칙
│   ├── 00~05 *.md         # 개요, 흐름, 콘텐츠, 예약, 디자인, 아키텍처
│   ├── 06-decisions.md    # 결정 기록 (ADR)
│   ├── 07-open-questions.md  # 미정 사항
│   ├── 08-dev-flow.md     # 개발 플로우와 브랜치 전략
│   ├── CHANGELOG.md       # 설계 변경 이력
│   ├── archive/v0-demo/   # 초기 데모 설계 (기준 아님)
│   └── private/           # 정답과 원문 (Git 제외, 커밋 금지)
├── src/                   # 배포되는 코드 (이 폴더만 배포됨)
│   ├── index.html         # 페이지 구조
│   ├── css/style.css      # 스타일
│   ├── js/                # 스크립트 (ES 모듈)
│   │   ├── app.js         #   시작점, 잠금 해제 흐름
│   │   ├── normalize.js   #   정답 정규화 (도구와 공유)
│   │   ├── crypto.js      #   키 파생, 복호화, 오류 구분
│   │   ├── screens.js     #   화면과 카드 전환, 상태 문구, 포커스, 바우처·편지 표시, 이전 카드, 편지 봉투 열기, 예약 달력, 센터 주소 복사
│   │   ├── sound.js       #   효과음 합성: 뾱, 뿅, 짜잔 (WebAudio)
│   │   └── confetti.js    #   폭죽 (캔버스)
│   ├── data/              # 암호화된 본문 (letter.enc.json, 도구가 생성)
│   └── img/               #   logo.jpg(센터 로고 720×207), og.jpg(링크 미리보기용 선물 그림 800×400)
├── tools/                 # 암호문 생성 도구 (배포 안 함)
│   ├── encrypt.mjs        #   암호문 생성과 셀프 테스트
│   └── voucher.json       #   바우처 값
├── tests/                 # 단위 테스트 (배포 안 함)
│   ├── normalize.test.mjs #   정답 정규화
│   ├── crypto.test.mjs    #   암호 왕복, 오류 구분, 파싱
│   └── page.test.mjs      #   페이지 구조, 문구, 메타, 접근성 규칙 (파일 검사)
├── .github/workflows/     # 배포 워크플로 (pages.yml)
├── schedule/              # 일정과 진척 관리 (일별 계획, 진행률, 배포 안 함)
├── package.json           # 모듈 설정과 명령 (type: module, 배포 안 함)
├── .claude/               # Claude Code 설정과 커맨드
│   ├── settings.json      # 공유 권한 설정
│   └── commands/          # 슬래시 커맨드 (/preview-check, /check-links, /design-review)
├── .gitignore             # 커밋에서 제외할 파일
└── .DS_Store              # macOS 파일 (추적하지 않음)
```

## 시작하기

Node 20 이상이 필요하며, 외부 패키지는 없습니다. 명령은 저장소 루트에서 실행합니다.

| 하는 일 | 명령 |
|---------|------|
| 단위 테스트 | `npm test` (`node --test tests/*.test.mjs`) |
| 로컬에서 페이지 보기 | `npm run serve` 실행 후 `http://localhost:8000` 접속 |
| 암호문 만들기 | `npm run encrypt` (정답을 화면에 보이지 않게 입력) |
| 암호문 확인 | `npm run self-test` |

- 페이지는 `file://`로 열면 암호문을 읽을 수 없습니다. 꼭 로컬 서버로 확인합니다.
- 암호문을 만들려면 `design/private/secrets.md`(정답과 편지 원문)가 있어야 합니다. 이 파일은 저장소에 없습니다.
- 편지나 바우처를 고쳤다면 암호문을 다시 만들어야 합니다.

### 주요 폴더 설명

- **design/**: 무엇을 어떻게 만들지 적은 문서입니다. 코드보다 먼저 이 문서를 고칩니다.
- **src/**: 실제로 배포되는 코드만 둡니다. 설계 문서, 도구, 테스트는 들어가지 않습니다. 배포는 GitHub Actions가 `src/`를 그대로 올립니다.
- **tools/**: 편지 원문을 암호화해 `src/data/letter.enc.json`을 만드는 일회성 스크립트와 바우처 값(`voucher.json`)을 둡니다.
- **tests/**: 정규화, 암호 왕복, 페이지 구조 테스트입니다. 배포하지 않습니다.
- **schedule/**: 목표 배포일(10/17 토)까지의 일별 계획과 진행률입니다. 작업이 끝날 때마다 갱신합니다.
- **design/private/**: 정답과 편지 원문이 있습니다. Git에서 제외되어 있으며 커밋하지 않습니다.

## 브랜치

- `main`: 완성본만 둡니다. `main`에 push되면 GitHub Actions가 테스트 후 `src/`를 배포합니다.
- `v0.x`: v1.0.0 이전의 중간 버전 작업 브랜치입니다. 로컬에서 확인하며, `main`에는 머지하지 않았습니다.
- `v1.x`: v1.0.0 이후의 변경 묶음 브랜치입니다(`v1.1`, `v1.2`, 버그 수정만이면 `v1.0.1`). 완성되면 `main`에 머지하고 같은 번호로 태그를 붙입니다. (ADR-067)
- 태그 `v1.0.0`: 완성본을 `main`에 머지한 뒤 붙인 첫 릴리스 태그입니다. 이후 `v1.1.0`처럼 이어집니다.
- 머지가 끝난 브랜치는 로컬과 원격에서 삭제합니다. 이력은 merge commit과 태그에 남습니다. (ADR-080)

자세한 절차는 [design/08-dev-flow.md](design/08-dev-flow.md)를 참고합니다.
