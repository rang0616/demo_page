`src/index.html`에 들어 있는 외부 URL이 허용 목록 안에 있고 응답하는지 확인합니다.

허용 호스트는 `design/05-architecture.md`의 "허용 외부 리소스"가 기준입니다: `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com`(리소스 로드), `map.naver.com`(이동 링크만, 센터 주소 검색용. 리소스로 불러오면 위반입니다), `rang0616.github.io`(이 사이트 자신. 미리보기 이미지 `og:image`의 절대 주소에만 씀, ADR-064).

1. `src/` 아래 파일에서 `http://`, `https://`로 시작하는 URL을 모두 찾습니다. (Grep 사용)
2. 중복을 제거하고, 호스트가 허용 목록 밖이면 그 URL을 먼저 표시합니다. `map.naver.com`은 HTML/JS 소스에 주소 조각(`https://map.naver.com/p/search/`)으로 들어 있으며, 실제 링크는 JS가 만듭니다. 검색 주소 뒤에 센터 주소를 붙여 응답을 확인합니다.
3. 각 URL을 `curl -sI -o /dev/null -w "%{http_code}"`로 확인합니다.
4. 결과를 표로 보고합니다.

| 상태 | URL | 용도 (글꼴, 스크립트 등) | 허용 호스트 |
|------|-----|---------------------------|-------------|

5. 4xx, 5xx, 연결 실패는 파일과 줄 번호와 함께 강조합니다.
6. 버전이 고정되지 않은 URL(예: `@latest`)이 있으면 함께 알립니다.

URL을 고치는 작업은 사용자가 요청할 때만 합니다.
