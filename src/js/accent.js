// 바우처 값에서 강조할 글자를 나눕니다. DOM을 쓰지 않는 순수 함수입니다. (ADR-085)
// 반환 값을 이어 붙이면 항상 원래 값과 같습니다. 값 자체는 바꾸지 않습니다.
export function splitAccent(value, accent) {
  const text = String(value);
  if (!accent) return [{ text, accent: false }];
  const parts = text.split(accent);
  const result = [];
  parts.forEach((part, i) => {
    if (part) result.push({ text: part, accent: false });
    if (i < parts.length - 1) result.push({ text: accent, accent: true });
  });
  return result.length ? result : [{ text: '', accent: false }];
}
