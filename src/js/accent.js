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

// 편지 본문의 강조 표시 `[[강조할 문구]]`를 나눕니다. DOM을 쓰지 않는 순수 함수입니다. (ADR-098)
// 반환 값은 `{ text, accent }` 조각이며, 이어 붙이면 표시 문자를 뺀 원래 글이 됩니다.
// 짝이 맞지 않으면(markersBalanced가 거짓) 표시 문자를 그대로 둔 원문 한 조각을 돌려줍니다.
const MARK_PAIR = /\[\[|\]\]/g;

// 왼쪽부터 `[[`와 `]]`가 번갈아 나오고 열린 채로 끝나지 않아야 짝이 맞습니다.
// 같은 괄호가 세 개 이상 이어지거나(`[[[`, `]]]`) 빈 표시(`[[]]`)는 짝 불일치입니다. 줄바꿈이 걸쳐도 됩니다.
export function markersBalanced(text) {
  const value = String(text);
  if (/\[{3,}|\]{3,}/.test(value)) return false;
  let openedAt = -1;
  for (const match of value.matchAll(MARK_PAIR)) {
    if (match[0] === '[[') {
      if (openedAt >= 0) return false;
      openedAt = match.index + 2;
    } else {
      if (openedAt < 0 || value.slice(openedAt, match.index).trim() === '') return false; // 빈 표시와 공백뿐인 표시는 오타로 봅니다.
      openedAt = -1;
    }
  }
  return openedAt < 0;
}

export function splitMarked(value) {
  const text = String(value);
  if (!markersBalanced(text)) return [{ text, accent: false }];
  const result = [];
  let cursor = 0;
  for (const match of text.matchAll(/\[\[([\s\S]*?)\]\]/g)) {
    if (match.index > cursor) result.push({ text: text.slice(cursor, match.index), accent: false });
    result.push({ text: match[1], accent: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor), accent: false });
  return result.length ? result : [{ text: '', accent: false }];
}

