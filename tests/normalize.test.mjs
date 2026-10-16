// ADR-095 정답 처리 테스트. 예시는 실제 정답과 무관한 중립 문자열이며 실제 정답이나 정답의 표기 형식을 쓰지 않습니다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnswer } from '../src/js/normalize.js';

const same = [
  ['가나 다라', '가나 다라'],           // 글자 그대로
  ['  가나 다라  ', '가나 다라'],       // 앞뒤 공백은 지움
  ['\t가나 다라\n', '가나 다라'],
  [' 가나 다라　', '가나 다라'], // 줄바꿈 없는 공백, 전각 공백도 앞뒤에서는 지움
  ['가나 다라'.normalize('NFD'), '가나 다라'], // NFC로 합침(자모가 풀린 입력)
];

// 안쪽 글자는 바꾸지 않습니다. 서로 다른 입력은 서로 다른 값으로 남고 하나로 합쳐지지 않습니다.
const distinct = ['가나 다라', '가나다라', '가나  다라', '가나-다라', '가나/다라', 'abcd', 'ab cd', 'ＡＢ ＣＤ', '가나 다라 마바', '다라 가나'];

for (const [input, expected] of same) {
  test(`그대로/앞뒤 공백 제거/NFC: ${JSON.stringify(input)}`, () => {
    assert.equal(normalizeAnswer(input), expected);
  });
}

test('서로 다른 입력은 서로 다른 값으로 남는다(하나로 합치지 않음)', () => {
  const values = distinct.map((v) => normalizeAnswer(v));
  assert.equal(new Set(values).size, distinct.length);
  assert.deepEqual(values, distinct.map((v) => v.normalize('NFC').trim()));
});

test('안쪽 공백은 바꾸지 않는다', () => {
  assert.equal(normalizeAnswer('가나  다라'), '가나  다라');
  assert.equal(normalizeAnswer('가나다라'), '가나다라');
});

test('NFKC는 쓰지 않는다(전각 글자는 그대로 다른 글자)', () => {
  assert.equal(normalizeAnswer('ＡＢ ＣＤ'), 'ＡＢ ＣＤ');
});

for (const [input, why] of [['', '빈 입력'], ['   ', '공백뿐'], ['\n\t', '공백뿐']]) {
  test(`비어 있으면 null: ${JSON.stringify(input)} (${why})`, () => {
    assert.equal(normalizeAnswer(input), null);
  });
}

test('문자열이 아니면 null', () => {
  assert.equal(normalizeAnswer(undefined), null);
  assert.equal(normalizeAnswer(null), null);
  assert.equal(normalizeAnswer(305), null);
});

test('같은 입력은 같은 키 입력 바이트가 된다(UTF-8)', () => {
  const a = new TextEncoder().encode(normalizeAnswer(' 가나 다라 '));
  const b = new TextEncoder().encode(normalizeAnswer('가나 다라'));
  assert.deepEqual([...a], [...b]);
});
