// 키 파생, 복호화, 오류 구분 (ADR-026, ADR-040, ADR-042).
// 파라미터는 코드 상수입니다. 봉투(JSON)의 값은 상수와 같을 때만 신뢰합니다.

export const ENVELOPE_VERSION = 1;
export const KDF = { name: 'PBKDF2', hash: 'SHA-256', iter: 600000 };
export const CIPHER = { name: 'AES-GCM', keyBits: 256 };
export const SALT_BYTES = 16;
export const IV_BYTES = 12;

// 바우처 8개 키 (ADR-026). 02-content.md 바우처 표의 행 순서와 같습니다.
export const VOUCHER_KEYS = [
  'label', 'badge', 'title', 'subtitle', 'recipient', 'occasion', 'center', 'careType',
];

// 오류 종류 (ADR-040, ADR-042).
//   wrong     틀린 답 (GCM 인증 실패)
//   data      데이터 오류 (JSON, 필드, 길이, 평문 구조)
//   version   지원하지 않는 봉투 버전
//   network   파일을 받지 못함
//   insecure  보안 컨텍스트가 아님
export class UnlockError extends Error {
  constructor(kind, message) {
    super(message || kind);
    this.name = 'UnlockError';
    this.kind = kind;
  }
}

export function base64ToBytes(b64) {
  if (typeof b64 !== 'string') throw new UnlockError('data', 'base64 not string');
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    throw new UnlockError('data', 'invalid base64');
  }
}

export function bytesToBase64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function getSubtle() {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new UnlockError('insecure', 'crypto.subtle unavailable');
  return subtle;
}

// 정규화된 정답 "MMDD"(UTF-8 바이트)로 AES-256 키를 만듭니다.
export async function deriveKey(mmdd, salt) {
  const subtle = getSubtle();
  const material = await subtle.importKey(
    'raw', new TextEncoder().encode(mmdd), 'PBKDF2', false, ['deriveKey'],
  );
  return subtle.deriveKey(
    { name: KDF.name, hash: KDF.hash, salt, iterations: KDF.iter },
    material,
    { name: CIPHER.name, length: CIPHER.keyBits },
    false,
    ['encrypt', 'decrypt'],
  );
}

// 봉투 구조와 파라미터를 검사합니다. 문제가 있으면 UnlockError를 던집니다.
export function parseEnvelope(env) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) throw new UnlockError('data', 'envelope not object');
  if (!('v' in env)) throw new UnlockError('data', 'missing v');
  if (env.v !== ENVELOPE_VERSION) throw new UnlockError('version', `unsupported v: ${env.v}`);

  const { kdf, cipher } = env;
  if (!kdf || !cipher) throw new UnlockError('data', 'missing kdf/cipher');
  if (kdf.name !== KDF.name || kdf.hash !== KDF.hash || kdf.iter !== KDF.iter) {
    throw new UnlockError('data', 'kdf params mismatch');
  }
  if (cipher.name !== CIPHER.name) throw new UnlockError('data', 'cipher params mismatch');

  const salt = base64ToBytes(kdf.salt);
  const iv = base64ToBytes(cipher.iv);
  const ct = base64ToBytes(env.ct);
  if (salt.length !== SALT_BYTES) throw new UnlockError('data', 'salt length');
  if (iv.length !== IV_BYTES) throw new UnlockError('data', 'iv length');
  if (ct.length < 16) throw new UnlockError('data', 'ct too short');
  return { salt, iv, ct };
}

// 복호화한 평문의 구조를 검사합니다. (ADR-042)
export function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') throw new UnlockError('data', 'payload not object');
  const { voucher, letter } = payload;
  if (!voucher || typeof voucher !== 'object') throw new UnlockError('data', 'voucher missing');
  for (const key of VOUCHER_KEYS) {
    if (typeof voucher[key] !== 'string') throw new UnlockError('data', `voucher.${key}`);
  }
  if (!Array.isArray(letter) || letter.length < 2 || !letter.every((p) => typeof p === 'string')) {
    throw new UnlockError('data', 'letter');
  }
  return payload;
}

// 봉투를 정규화된 정답으로 복호화합니다. 성공하면 평문 객체를 돌려줍니다.
export async function decryptEnvelope(env, mmdd) {
  const subtle = getSubtle();
  const { salt, iv, ct } = parseEnvelope(env);
  const key = await deriveKey(mmdd, salt);

  let plain;
  try {
    plain = await subtle.decrypt({ name: CIPHER.name, iv }, key, ct);
  } catch (error) {
    // GCM 인증 실패(OperationError)만 틀린 답으로 봅니다. 틀린 답과 파일 변조는 구분되지 않습니다.
    // 그 밖의 예외는 데이터 오류입니다. (ADR-042, ADR-051)
    if (error && error.name === 'OperationError') throw new UnlockError('wrong', 'decrypt failed');
    throw new UnlockError('data', 'decrypt error');
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new UnlockError('data', 'payload not json');
  }
  return validatePayload(payload);
}
