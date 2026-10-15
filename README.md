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
├── docs/                  # 배포 폴더 (GitHub Pages 소스, 구현 예정)
├── tests/                 # 정규화 테스트 (구현 예정, 배포 안 함)
├── tools/                 # 암호문 생성 도구와 바우처 값 (encrypt.mjs, voucher.json, 구현 예정, 배포 안 함)
├── package.json           # 모듈 설정 (type: module, 구현 예정, 배포 안 함)
├── .claude/               # Claude Code 설정과 커맨드
│   ├── settings.json      # 공유 권한 설정
│   └── commands/          # 슬래시 커맨드 (/preview-check, /check-links)
├── index.html             # 초기 데모 페이지 (구현 기준 아님, 정식 배포 전 제거 예정)
├── 리스파이어랩.png        # 데모에서 쓰던 로고
├── .gitignore             # 커밋에서 제외할 파일
└── .DS_Store              # macOS 파일 (추적하지 않음)
```

### 주요 폴더 설명

- **design/**: 무엇을 어떻게 만들지 적은 문서입니다. 코드보다 먼저 이 문서를 고칩니다.
- **docs/**: 실제로 배포되는 파일만 둡니다. 설계 문서와 도구는 들어가지 않습니다.
- **tools/**: 편지 원문을 암호화해 `docs/data/letter.enc.json`을 만드는 일회성 스크립트와 바우처 값(`voucher.json`)을 둡니다.
- **tests/**: 정규화 테스트입니다. 배포하지 않습니다.
- **design/private/**: 정답과 편지 원문이 있습니다. Git에서 제외되어 있으며 커밋하지 않습니다.

## 브랜치

- `main`: 완성본만 둡니다. GitHub Pages가 `main`의 `/docs`를 배포합니다.
- `v0.x`: 중간 버전 작업 브랜치입니다. 로컬에서 확인하며, `main`에는 머지하지 않습니다.
- 태그 `v1.0.0`: 완성본을 `main`에 머지한 뒤 붙이는 릴리스 태그입니다.

자세한 절차는 [design/08-dev-flow.md](design/08-dev-flow.md)를 참고합니다.
