// ADR-025 테스트 표. 예시 날짜는 실제 정답과 무관한 값입니다. 실제 정답을 쓰지 않습니다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnswer } from '../src/js/normalize.js';

const ok = [
  ['3월 5일', '0305'],
  ['3/5', '0305'],
  ['3.5', '0305'],
  ['305', '0305'],
  ['0305', '0305'],
  ['3 5', '0305'],
  ['3-5', '0305'],
  ['  3월   5일  ', '0305'],
  ['３／５', '0305'],       // 전각 숫자와 기호 (NFKC)
  ['115', '0115'],         // 3자리: 앞 1자리가 월 (1월 15일)
  ['1116', '1116'],
  ['12월 31일', '1231'],
  ['2/31', '0231'],        // 월별 일수는 보지 않음
  ['3월5일', '0305'],      // 공백 없음
  ['03/05', '0305'],
  ['003/5', '0305'],       // 두 묶음은 자릿수를 제한하지 않음 (ADR-051)
];

const wrong = [
  ['2026년 3월 5일', '연도 포함(숫자 묶음 3개)'],
  ['2026 3 5', '숫자 묶음 3개'],
  ['13/1', '월 범위 초과'],
  ['3/32', '일 범위 초과'],
  ['0/5', '월 0'],
  ['3/0', '일 0'],
  ['', '빈 입력'],
  ['abc', '숫자 없음'],
  ['5', '숫자 한 자리'],
  ['12345', '5자리 묶음'],
  ['٣/٥', '비 ASCII 숫자는 값이 아님'],
  ['2026/3', '월 값이 범위 밖'],
  ['3/5/7', '숫자 묶음 3개'],
];

for (const [input, expected] of ok) {
  test(`허용: ${JSON.stringify(input)} → ${expected}`, () => {
    assert.equal(normalizeAnswer(input), expected);
  });
}

for (const [input, why] of wrong) {
  test(`틀림: ${JSON.stringify(input)} (${why})`, () => {
    assert.equal(normalizeAnswer(input), null);
  });
}

test('문자열이 아니면 null', () => {
  assert.equal(normalizeAnswer(undefined), null);
  assert.equal(normalizeAnswer(null), null);
  assert.equal(normalizeAnswer(305), null);
});
