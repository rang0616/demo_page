// 암호 왕복 테스트. 가짜 정답과 가짜 본문만 씁니다. 실제 정답과 원문은 쓰지 않습니다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptPayload, readLetterFromSecrets, validateVoucher, verifyEnvelope } from '../tools/encrypt.mjs';
import {
  CIPHER, ENVELOPE_VERSION, IV_BYTES, KDF, SALT_BYTES, UnlockError, VOUCHER_KEYS,
  bytesToBase64, decryptEnvelope, deriveKey, getSubtle,
} from '../src/js/crypto.js';

const MMDD = '0305';
const voucher = Object.fromEntries(VOUCHER_KEYS.map((k) => [k, `값-${k}`]));
const payload = { voucher, letter: ['호칭', '문단 하나', '문단 둘\n둘째 줄', '맺음말'] };

// 키 파생이 느리므로 봉투는 한 번만 만듭니다.
const envelope = await encryptPayload(payload, MMDD);

async function kindOf(promise) {
  try {
    await promise;
  } catch (e) {
    assert.ok(e instanceof UnlockError, `UnlockError가 아님: ${e}`);
    return e.kind;
  }
  return 'no-error';
}

test('올바른 정답이면 원문과 일치', async () => {
  assert.deepEqual(await decryptEnvelope(envelope, MMDD), payload);
});

test('틀린 정답은 wrong', async () => {
  assert.equal(await kindOf(decryptEnvelope(envelope, '0306')), 'wrong');
});

test('ct 한 바이트 변조는 wrong', async () => {
  const raw = Buffer.from(envelope.ct, 'base64');
  raw[0] ^= 0xff;
  assert.equal(await kindOf(decryptEnvelope({ ...envelope, ct: raw.toString('base64') }, MMDD)), 'wrong');
});

test('verifyEnvelope 세 케이스 통과', async () => {
  await verifyEnvelope(envelope, MMDD, payload);
});

test('v가 1이 아니면 version', async () => {
  assert.equal(await kindOf(decryptEnvelope({ ...envelope, v: 2 }, MMDD)), 'version');
});

test('kdf 반복 횟수가 다르면 data', async () => {
  const bad = { ...envelope, kdf: { ...envelope.kdf, iter: 1000 } };
  assert.equal(await kindOf(decryptEnvelope(bad, MMDD)), 'data');
});

test('salt 길이가 다르면 data', async () => {
  const bad = { ...envelope, kdf: { ...envelope.kdf, salt: Buffer.alloc(8).toString('base64') } };
  assert.equal(await kindOf(decryptEnvelope(bad, MMDD)), 'data');
});

test('iv 길이가 다르면 data', async () => {
  const bad = { ...envelope, cipher: { ...envelope.cipher, iv: Buffer.alloc(8).toString('base64') } };
  assert.equal(await kindOf(decryptEnvelope(bad, MMDD)), 'data');
});

test('필드 누락은 data', async () => {
  assert.equal(await kindOf(decryptEnvelope({ v: 1 }, MMDD)), 'data');
  assert.equal(await kindOf(decryptEnvelope(null, MMDD)), 'data');
});

test('복호화는 되지만 평문 구조가 틀리면 data', async () => {
  const noKey = await encryptPayload({ voucher: { ...voucher, title: undefined }, letter: payload.letter }, MMDD);
  assert.equal(await kindOf(decryptEnvelope(noKey, MMDD)), 'data');
  const shortLetter = await encryptPayload({ voucher, letter: ['하나뿐'] }, MMDD);
  assert.equal(await kindOf(decryptEnvelope(shortLetter, MMDD)), 'data');
});

test('같은 입력도 암호화할 때마다 salt, iv, ct가 달라진다', async () => {
  const other = await encryptPayload(payload, MMDD);
  assert.notEqual(other.kdf.salt, envelope.kdf.salt);
  assert.notEqual(other.cipher.iv, envelope.cipher.iv);
  assert.notEqual(other.ct, envelope.ct);
  assert.deepEqual(await decryptEnvelope(other, MMDD), payload);
});

test('secrets.md 파싱: 코드 블록을 빈 줄 기준 문단으로 나눈다', () => {
  const md = [
    '# 제목', '', '## 잠금 정답', '', '- 정답: 가짜', '',
    '## 편지 원문', '', '설명 문장', '',
    '```', '호칭', '', '문단1 첫 줄', '문단1 둘째 줄', '', '맺음말', '```', '',
    '## 다른 절', '```', '무시', '```',
  ].join('\n');
  assert.deepEqual(readLetterFromSecrets(md), ['호칭', '문단1 첫 줄\n문단1 둘째 줄', '맺음말']);
});

test('secrets.md 파싱: 제목이나 코드 블록이 없으면 오류', () => {
  assert.throws(() => readLetterFromSecrets('## 다른 제목\n```\na\n\nb\n```'), /편지 원문/);
  assert.throws(() => readLetterFromSecrets('## 편지 원문\n문장만 있음'), /코드 블록/);
  assert.throws(() => readLetterFromSecrets('## 편지 원문\n```\n하나뿐\n```'), /2개 미만/);
});

test('voucher 검증: 키가 모두 있어야 한다', () => {
  assert.deepEqual(validateVoucher(voucher), voucher);
  assert.throws(() => validateVoucher({ ...voucher, title: '' }), /title/);
});

// ---- ADR-040, ADR-042, ADR-051 추가 테스트 ----

// 임의의 평문 바이트로 봉투를 만듭니다. (평문 JSON이 아닌 경우를 검증하기 위해)
async function envelopeFromBytes(bytes, mmdd) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(mmdd, salt);
  const ct = new Uint8Array(await getSubtle().encrypt({ name: CIPHER.name, iv }, key, bytes));
  return {
    v: ENVELOPE_VERSION,
    kdf: { name: KDF.name, hash: KDF.hash, iter: KDF.iter, salt: bytesToBase64(salt) },
    cipher: { name: CIPHER.name, iv: bytesToBase64(iv) },
    ct: bytesToBase64(ct),
  };
}

test('잘못된 base64는 data', async () => {
  assert.equal(await kindOf(decryptEnvelope({ ...envelope, ct: '!!!' }, MMDD)), 'data');
});

test('ct가 16바이트 미만이면 data', async () => {
  assert.equal(await kindOf(decryptEnvelope({ ...envelope, ct: Buffer.alloc(8).toString('base64') }, MMDD)), 'data');
});

test('cipher 이름이 다르면 data', async () => {
  assert.equal(await kindOf(decryptEnvelope({ ...envelope, cipher: { ...envelope.cipher, name: 'AES-CBC' } }, MMDD)), 'data');
});

test('v가 없거나 배열·문자열 봉투는 data (version 아님)', async () => {
  const { v, ...noV } = envelope;
  assert.equal(await kindOf(decryptEnvelope(noV, MMDD)), 'data');
  assert.equal(await kindOf(decryptEnvelope([], MMDD)), 'data');
  assert.equal(await kindOf(decryptEnvelope('봉투', MMDD)), 'data');
});

test('복호화는 되지만 평문이 JSON이 아니면 data', async () => {
  const bad = await envelopeFromBytes(new TextEncoder().encode('이건 JSON이 아님'), MMDD);
  assert.equal(await kindOf(decryptEnvelope(bad, MMDD)), 'data');
});

test('letter에 문자열이 아닌 항목이 있으면 data', async () => {
  const bad = await encryptPayload({ voucher, letter: ['호칭', 5, '맺음말'] }, MMDD);
  assert.equal(await kindOf(decryptEnvelope(bad, MMDD)), 'data');
});

test('secrets.md 파싱: 편지 원문 절에 코드 블록이 없으면 다음 절의 블록을 읽지 않는다', () => {
  const md = '## 편지 원문\n\n설명만 있음\n\n## 다른 절\n```\n호칭\n\n맺음말\n```';
  assert.throws(() => readLetterFromSecrets(md), /절 안에서/);
});

test('secrets.md 파싱: 문단 앞뒤 공백은 보존한다', () => {
  const md = '## 편지 원문\n```\n  들여쓴 호칭  \n\n본문\n\n맺음말\n```';
  assert.deepEqual(readLetterFromSecrets(md), ['  들여쓴 호칭  ', '본문', '맺음말']);
});
