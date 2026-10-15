// 정답 정규화 (ADR-025). 페이지와 도구가 같은 파일을 씁니다. 순수 함수만 둡니다.

// 입력을 "MMDD" 문자열로 바꿉니다. 해석할 수 없으면 null을 돌려줍니다.
export function normalizeAnswer(input) {
  if (typeof input !== 'string') return null;

  // 1. NFKC 적용 뒤, ASCII 숫자 연속 구간을 숫자 묶음으로 추출합니다.
  //    그 밖의 글자(공백, 구두점, "월", "일", 비 ASCII 숫자)는 구분자입니다.
  const groups = input.normalize('NFKC').match(/[0-9]+/g) || [];

  let month;
  let day;

  if (groups.length === 1) {
    // 2. 숫자 묶음 하나: 3~4자리여야 하며 뒤 2자리가 일, 앞 1~2자리가 월입니다.
    const g = groups[0];
    if (g.length < 3 || g.length > 4) return null;
    month = g.slice(0, -2);
    day = g.slice(-2);
  } else if (groups.length === 2) {
    // 3. 숫자 묶음 둘: 첫 번째가 월, 두 번째가 일입니다. 자릿수는 제한하지 않고 값만 봅니다. (예: 003/05)
    [month, day] = groups;
  } else {
    // 4. 그 밖의 경우(0개, 3개 이상, 연도 포함 등)는 틀린 답입니다.
    return null;
  }

  // 5. 월 1~12, 일 1~31. 월별 일수는 보지 않습니다(2/31 허용).
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  // 6. 두 자리씩 맞춰 "MMDD"로 돌려줍니다.
  return String(m).padStart(2, '0') + String(d).padStart(2, '0');
}
