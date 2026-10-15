// 화면과 카드 전환, 상태 문구, 포커스 이동, 바우처 표시 (ADR-047, ADR-053, ADR-054, ADR-055).
// 잠금, 오류, 선물 상자, 카드를 한 화면 단위로 바꿉니다. 뒤로 가기는 없습니다.

import { burstConfetti } from './confetti.js';
import { VOUCHER_KEYS } from './crypto.js';

const SCREEN_IDS = {
  lock: 'screen-lock',
  error: 'screen-error',
  gift: 'screen-gift',
  cards: 'screen-cards',
};

const OPEN_ANIMATION_MS = 900; // 상자 뚜껑 연출(CSS 0.8초) 뒤 약간의 여유. style.css의 transition과 짝입니다.
const CARD_IDS = ['card-voucher', 'card-temp']; // 카드 순서는 이 배열 하나로 정합니다. (ADR-054)
const CARD_GUARD_MS = 400; // 카드가 나타난 직후의 "다음" 탭은 무시합니다. (ADR-054) 등장 연출(0.7초)의 "밤!" 지점 뒤까지 막습니다.

const form = document.getElementById('lock-form');
const input = document.getElementById('answer');
const submit = document.getElementById('submit');
const status = document.getElementById('status');
const errorMessage = document.getElementById('error-message');
const giftButton = document.getElementById('gift-button');
const cardsScreen = document.getElementById(SCREEN_IDS.cards);

let statusTimer = null;
let cardIndex = 0;
let cardShownAt = 0;

function focusHeading(root) {
  const heading = root.querySelector('[tabindex="-1"]');
  if (heading) heading.focus();
}

// 화면을 바꾸고, 새 화면의 제목으로 포커스를 옮깁니다. 카드 화면은 카드 단위로 포커스를 옮깁니다.
export function showScreen(name) {
  for (const [key, id] of Object.entries(SCREEN_IDS)) {
    document.getElementById(id).hidden = key !== name;
  }
  if (name !== 'cards') focusHeading(document.getElementById(SCREEN_IDS[name]));
}

// 상태 문구를 바꿉니다. 같은 문구가 반복돼도 스크린리더가 다시 읽도록
// 먼저 비운 뒤 잠시 후에 넣습니다. (ADR-051)
export function setStatus(text) {
  clearTimeout(statusTimer);
  status.textContent = '';
  if (!text) return;
  statusTimer = setTimeout(() => { status.textContent = text; }, 40);
}

// 복호화 중에는 입력과 버튼을 잠급니다. busy=false는 제출 버튼을 처음 활성화하는 데도 씁니다.
export function setBusy(busy) {
  submit.disabled = busy;
  input.disabled = busy;
}

export function showError(text) {
  errorMessage.textContent = text;
  showScreen('error');
}

export function focusInput() {
  input.focus();
}

export function getAnswer() {
  return input.value;
}

export function clearAnswer() {
  input.value = '';
}

export function onSubmit(handler) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handler();
  });
}

// 복호화한 바우처 값을 화면에 채웁니다. textContent만 씁니다. (ADR-026)
export function renderVoucher(voucher) {
  for (const key of VOUCHER_KEYS) {
    document.getElementById(`voucher-${key}`).textContent = voucher[key];
  }
}

export function onGiftOpen(handler) {
  giftButton.addEventListener('click', handler);
}

// 상자 뚜껑이 열리는 연출과 폭죽. 모션 감소 설정이면 둘 다 생략하고 기다리지 않습니다. (ADR-055)
export function playOpening({ reducedMotion }) {
  giftButton.classList.add('opening');
  giftButton.disabled = true;
  if (reducedMotion) return Promise.resolve();
  try {
    burstConfetti(giftButton);
  } catch {
    // 폭죽은 장식이므로 실패해도 흐름을 막지 않습니다.
  }
  return new Promise((resolve) => setTimeout(resolve, OPEN_ANIMATION_MS));
}

function cardElements() {
  return CARD_IDS.map((id) => document.getElementById(id));
}

// 카드를 보여 주고 카드 자체로 포커스를 옮깁니다. 제목 앞의 로고와 라벨을 건너뛰지 않게 하기 위해서입니다.
function showCard(index) {
  const cards = cardElements();
  cardIndex = Math.min(Math.max(index, 0), cards.length - 1);
  cards.forEach((card, i) => { card.hidden = i !== cardIndex; });
  cardShownAt = performance.now();
  cards[cardIndex].focus();
}

// 카드 화면으로 넘어가 첫 카드를 보여 줍니다.
export function startCards() {
  showScreen('cards');
  showCard(0);
}

// 카드는 "다음" 버튼으로만 넘어갑니다. 카드의 빈 곳을 눌러도 넘어가지 않습니다. (ADR-055)
// 카드가 나타난 직후(0.4초)의 탭은 무시해, 연타로 카드를 건너뛰지 않게 합니다. (ADR-054)
// 마지막 카드에는 "다음" 버튼이 없습니다. 뒤로 가기는 없습니다.
cardsScreen.addEventListener('click', (event) => {
  if (!event.target.closest('[data-next]')) return;
  if (performance.now() - cardShownAt < CARD_GUARD_MS) return;
  if (cardIndex < cardElements().length - 1) showCard(cardIndex + 1);
});
