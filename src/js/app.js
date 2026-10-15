// 시작점: 잠금 해제 흐름을 연결합니다. (ADR-040, ADR-042, ADR-043, ADR-051)
// 상태는 단일 변수 state에 둡니다: 'locked' | 'decrypting' | 'error' | 'unlocked'

import { normalizeAnswer } from './normalize.js';
import { UnlockError, decryptEnvelope } from './crypto.js';
import {
  clearAnswer, focusInput, getAnswer, onSubmit, setBusy, setStatus, showError, showScreen,
} from './screens.js';

// 화면 문구 (design/01, ADR-033, ADR-043). 말투는 반말입니다. (ADR-029)
const MESSAGE = {
  empty: '날짜를 먼저 적어 줘.',
  wrong: '거의 다 왔어! 한 번 더 떠올려 볼래?',
  decrypting: '열고 있어…',
  network: '잠시 후 다시 열어 줘.',
  data: '선물 파일이 손상됐어. 나에게 알려 줘.',
  version: '페이지를 새로고침해 줘.',
  insecure: '다른 방법으로 열어 줘.',
};

const ENVELOPE_URL = 'data/letter.enc.json';
const FETCH_TIMEOUT_MS = 12000; // 응답이 없으면 네트워크 오류로 봅니다. (ADR-051)

let state = 'locked';
let envelope = null; // 성공한 봉투는 메모리에 보관합니다.
let unlockedPayload = null; // 복호화한 본문은 JS 변수에만 둡니다. DOM에 넣는 것은 v0.2 이후입니다.

function isSecureContextAvailable() {
  return globalThis.isSecureContext !== false && Boolean(globalThis.crypto && globalThis.crypto.subtle);
}

async function loadEnvelope() {
  // 시간 제한은 응답 헤더뿐 아니라 본문을 다 읽을 때까지 적용합니다. (ADR-051)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetch(ENVELOPE_URL, { cache: 'no-cache', signal: controller.signal });
    } catch {
      throw new UnlockError('network', 'fetch failed');
    }
    if (!response.ok) throw new UnlockError('network', `http ${response.status}`);
    try {
      return await response.json();
    } catch (error) {
      // 본문을 읽는 도중 시간이 초과되면 네트워크 오류, 내용이 JSON이 아니면 데이터 오류입니다.
      if (controller.signal.aborted) throw new UnlockError('network', 'body timeout');
      throw new UnlockError('data', 'envelope not json');
    }
  } finally {
    clearTimeout(timer);
  }
}

function backToLocked(message) {
  state = 'locked';
  setBusy(false);
  setStatus(message);
  focusInput(); // 입력값은 유지합니다.
}

async function handleSubmit() {
  if (state !== 'locked') return;

  const raw = getAnswer();
  if (raw.trim() === '') {
    setStatus(MESSAGE.empty);
    focusInput();
    return;
  }

  // 날짜로 해석할 수 없으면 틀린 답으로 봅니다. 파일은 받지 않습니다.
  const mmdd = normalizeAnswer(raw);
  if (mmdd === null) {
    setStatus(MESSAGE.wrong);
    focusInput();
    return;
  }

  state = 'decrypting';
  setBusy(true);
  setStatus(MESSAGE.decrypting);

  try {
    // 보안 컨텍스트 검사는 fetch 전에 합니다. (ADR-042)
    if (!isSecureContextAvailable()) throw new UnlockError('insecure');
    if (envelope === null) envelope = await loadEnvelope();
    unlockedPayload = await decryptEnvelope(envelope, mmdd);
  } catch (error) {
    const kind = error instanceof UnlockError ? error.kind : 'data';
    if (kind === 'wrong' || kind === 'network') {
      backToLocked(kind === 'wrong' ? MESSAGE.wrong : MESSAGE.network);
      return;
    }
    // data, version, insecure: 복구할 수 없으므로 오류 화면에 머뭅니다.
    state = 'error';
    showError(MESSAGE[kind] || MESSAGE.data);
    return;
  }

  state = 'unlocked';
  clearAnswer();
  setStatus('');
  showScreen('unlocked');
}

onSubmit(handleSubmit);
setBusy(false); // 제출 버튼은 HTML에서 비활성으로 시작합니다. 연결이 끝났으니 활성화합니다.
