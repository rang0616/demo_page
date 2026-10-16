// 정답 처리 (ADR-095, 이전 날짜 정규화 ADR-025를 대체). 페이지와 도구가 같은 파일을 씁니다. 순수 함수만 둡니다.

// 입력을 정답 비교용 문자열로 바꿉니다. 날짜로 해석하지 않고, 앞뒤 공백을 지운 뒤 유니코드 NFC로 합칩니다.
// 안쪽 글자는 바꾸지 않으므로 정답과 한 글자라도 다르면 키가 달라집니다. (NFKC는 쓰지 않습니다)
// 문자열이 아니거나 앞뒤 공백을 지운 뒤 비어 있으면 null을 돌려줍니다.
export function normalizeAnswer(input) {
  if (typeof input !== 'string') return null;
  const value = input.normalize('NFC').trim();
  return value.length > 0 ? value : null;
}
