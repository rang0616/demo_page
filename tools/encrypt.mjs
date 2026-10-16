// 암호문 생성 도구 (ADR-038, ADR-042). 일회성 도구이며 배포하지 않습니다.
//
//   node tools/encrypt.mjs              암호문을 만들어 src/data/letter.enc.json에 씁니다.
//   node tools/encrypt.mjs --self-test  기존 암호문을 정답으로 다시 풀어 확인합니다.
//
// - 입력: design/private/secrets.md의 "편지 원문" 아래 첫 코드 블록, tools/voucher.json
// - 정답은 TTY 프롬프트에서 입력합니다(화면에 보이지 않음). 인자나 환경 변수로 받지 않습니다.
// - 출력은 src/data/letter.enc.json 하나뿐입니다. 임시 파일에 쓴 뒤 이름을 바꿉니다.
// - 실패하면 종료 코드 1이며, 메시지에 정답이나 원문을 담지 않습니다.

import { readFile, writeFile, rename, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizeAnswer } from '../src/js/normalize.js';
import { markersBalanced } from '../src/js/accent.js';
import {
  CIPHER, ENVELOPE_VERSION, IV_BYTES, KDF, SALT_BYTES, VOUCHER_KEYS, UnlockError,
  bytesToBase64, decryptEnvelope, deriveKey, getSubtle,
} from '../src/js/crypto.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SECRETS_PATH = resolve(ROOT, 'design/private/secrets.md');
const VOUCHER_PATH = resolve(ROOT, 'tools/voucher.json');
const OUT_PATH = resolve(ROOT, 'src/data/letter.enc.json');

// "## 편지 원문" 아래 첫 코드 블록을 읽어, 빈 줄 기준으로 문단 배열을 만듭니다.
// 첫 블록은 호칭, 마지막 블록은 맺음말입니다. 블록 안의 줄바꿈은 그대로 둡니다.
export function readLetterFromSecrets(markdown) {
  const lines = markdown.split(/\r?\n/);
  const heading = lines.findIndex((l) => /^##\s*편지 원문\s*$/.test(l));
  if (heading < 0) throw new Error('secrets.md에서 "편지 원문" 제목을 찾지 못했습니다.');

  const start = lines.findIndex((l, i) => i > heading && /^```/.test(l));
  if (start < 0) throw new Error('"편지 원문" 아래에서 코드 블록을 찾지 못했습니다.');
  // 다음 제목을 먼저 만나면 이 절에는 코드 블록이 없는 것입니다. 다른 절의 블록은 읽지 않습니다. (ADR-051)
  const nextHeading = lines.findIndex((l, i) => i > heading && /^#{1,6}\s/.test(l));
  if (nextHeading >= 0 && nextHeading < start) throw new Error('"편지 원문" 절 안에서 코드 블록을 찾지 못했습니다.');
  const end = lines.findIndex((l, i) => i > start && /^```/.test(l));
  if (end < 0) throw new Error('코드 블록이 닫히지 않았습니다.');

  const body = lines.slice(start + 1, end).join('\n');
  // 문단 앞뒤의 공백은 보존하고, 앞뒤의 빈 줄만 제거합니다. (ADR-007, ADR-051)
  const blocks = body.split(/\n\s*\n/).map((b) => b.replace(/^\n+|\n+$/g, '')).filter((b) => b.trim().length > 0);
  if (blocks.length < 2) throw new Error('편지 문단이 2개 미만입니다.');
  validateMarkers(blocks);
  return blocks;
}

// 강조 표시 `[[ ]]`의 짝을 검사합니다. 실패 메시지에는 번호만 담고 내용은 담지 않습니다. (ADR-098)
export function validateMarkers(blocks) {
  const last = blocks.length - 1;
  for (const index of [0, last]) {
    if (/\[\[|\]\]/.test(blocks[index])) throw new Error(`${index === 0 ? '호칭' : '맺음말'}에 [[ ]] 표시 문자가 있습니다. 본문 문단에만 쓸 수 있습니다.`);
  }
  for (let i = 1; i < last; i += 1) {
    if (!markersBalanced(blocks[i])) throw new Error(`${i + 1}번째 블록(본문 ${i}번째 문단)의 [[ ]] 표시 짝이 맞지 않습니다.`);
  }
}

export function validateVoucher(voucher) {
  for (const key of VOUCHER_KEYS) {
    if (typeof voucher[key] !== 'string' || voucher[key].length === 0) {
      throw new Error(`voucher.json의 "${key}" 값이 문자열이 아니거나 비어 있습니다.`);
    }
  }
  return Object.fromEntries(VOUCHER_KEYS.map((key) => [key, voucher[key]]));
}

// 평문 객체를 봉투(JSON)로 암호화합니다. (ADR-026)
export async function encryptPayload(payload, answer) {
  const subtle = getSubtle();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(answer, salt);
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const ct = new Uint8Array(await subtle.encrypt({ name: CIPHER.name, iv }, key, plain));
  return {
    v: ENVELOPE_VERSION,
    kdf: { name: KDF.name, hash: KDF.hash, iter: KDF.iter, salt: bytesToBase64(salt) },
    cipher: { name: CIPHER.name, iv: bytesToBase64(iv) },
    ct: bytesToBase64(ct),
  };
}

// 세 가지를 확인합니다. 실패하면 Error를 던집니다. (ADR-038)
//   1. 올바른 정답 → 원문과 일치
//   2. 틀린 정답 → 복호화 실패
//   3. ct 한 바이트 변조 → 복호화 실패
export async function verifyEnvelope(envelope, answer, expected) {
  const decrypted = await decryptEnvelope(envelope, answer);
  if (JSON.stringify(decrypted) !== JSON.stringify(expected)) {
    throw new Error('1번 실패: 복호화 결과가 원문과 다릅니다.');
  }

  const wrongAnswer = answer + '!';
  try {
    await decryptEnvelope(envelope, wrongAnswer);
    throw new Error('2번 실패: 틀린 정답으로 복호화가 성공했습니다.');
  } catch (e) {
    if (!(e instanceof UnlockError) || e.kind !== 'wrong') throw e;
  }

  const raw = Uint8Array.from(Buffer.from(envelope.ct, 'base64'));
  raw[0] ^= 0xff;
  const tampered = { ...envelope, ct: Buffer.from(raw).toString('base64') };
  try {
    await decryptEnvelope(tampered, answer);
    throw new Error('3번 실패: 변조된 암호문이 복호화되었습니다.');
  } catch (e) {
    if (!(e instanceof UnlockError) || e.kind !== 'wrong') throw e;
  }
}

// 입력이 화면에 보이지 않는 프롬프트입니다. TTY에서만 동작합니다.
function promptHidden(label) {
  return new Promise((resolvePrompt, rejectPrompt) => {
    const stdin = process.stdin;
    process.stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let buffer = '';
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      process.stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') { cleanup(); resolvePrompt(buffer); return; }
        if (ch === '\u0003') { cleanup(); rejectPrompt(new Error('취소되었습니다.')); return; }
        if (ch === '\u007f' || ch === '\b') { buffer = Array.from(buffer).slice(0, -1).join(''); continue; }
        buffer += ch;
      }
    };
    stdin.on('data', onData);
  });
}

function fail(message) {
  console.error(`실패: ${message}`);
  process.exit(1);
}

async function main() {
  const selfTest = process.argv.includes('--self-test');

  if (Number(process.versions.node.split('.')[0]) < 20) fail('Node 20 이상이 필요합니다.');
  if (!process.stdin.isTTY) fail('TTY에서 실행해야 합니다. 정답을 직접 입력합니다.');

  let expected;
  try {
    const letter = readLetterFromSecrets(await readFile(SECRETS_PATH, 'utf8'));
    const voucher = validateVoucher(JSON.parse(await readFile(VOUCHER_PATH, 'utf8')));
    expected = { voucher, letter };
  } catch (e) {
    fail(e.message);
  }

  let answer;
  try {
    answer = await promptHidden('정답을 정해진 표기 그대로 입력하세요. 한글은 마지막 글자 뒤에 공백을 한 번 눌러 확정한 뒤 Enter를 누르세요 (화면에 보이지 않습니다): ');
  } catch (e) {
    fail(e.message);
  }
  const normalized = normalizeAnswer(answer);
  if (!normalized) fail('정답이 비어 있습니다.');
  // 한글 입력기에서는 마지막 글자가 빠질 수 있어, 내용은 보이지 않고 글자 수만 알려 줍니다. (ADR-095)
  console.log(`입력한 글자 수(앞뒤 공백 제외): ${Array.from(normalized).length}자 — 정답의 글자 수와 같은지 확인하세요.`);

  try {
    if (selfTest) {
      const envelope = JSON.parse(await readFile(OUT_PATH, 'utf8'));
      await verifyEnvelope(envelope, normalized, expected);
      console.log('셀프 테스트 통과: 정답 일치, 틀린 정답 거부, 변조 거부');
      return;
    }

    const envelope = await encryptPayload(expected, normalized);

    await mkdir(dirname(OUT_PATH), { recursive: true });
    const tmp = `${OUT_PATH}.tmp`;
    try {
      await writeFile(tmp, `${JSON.stringify(envelope)}\n`, 'utf8');
      // 쓴 파일을 다시 읽어 검증한 뒤에 이름을 바꿉니다. (ADR-042, ADR-051)
      await verifyEnvelope(JSON.parse(await readFile(tmp, 'utf8')), normalized, expected);
      await rename(tmp, OUT_PATH);
    } catch (e) {
      await rm(tmp, { force: true });
      throw e;
    }
    console.log('완료: src/data/letter.enc.json 을 만들었습니다. 쓴 파일을 다시 읽어 셀프 테스트를 통과했습니다.');
  } catch (e) {
    // 정답이나 원문이 메시지에 들어가지 않도록 종류만 알립니다.
    fail(e instanceof UnlockError ? `복호화 단계 오류(${e.kind})` : e.message);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
