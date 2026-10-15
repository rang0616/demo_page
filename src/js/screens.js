// 화면과 카드 전환, 상태 문구, 포커스 이동, 바우처·편지 표시, 편지 접기, 센터 주소 복사와 지도 링크
// (ADR-047, ADR-053, ADR-054, ADR-055, ADR-057, ADR-060).
// 안내, 잠금, 오류, 선물 상자, 카드를 한 화면 단위로 바꿉니다. 뒤로 가기는 없습니다.

import { burstConfetti } from './confetti.js';
import { VOUCHER_KEYS } from './crypto.js';

const SCREEN_IDS = {
  intro: 'screen-intro',
  lock: 'screen-lock',
  error: 'screen-error',
  gift: 'screen-gift',
  cards: 'screen-cards',
};

const OPEN_ANIMATION_MS = 900; // 상자 뚜껑 연출(CSS 0.8초) 뒤 약간의 여유. style.css의 transition과 짝입니다.
const CARD_IDS = ['card-voucher', 'card-letter', 'card-center', 'card-booking']; // 카드 순서는 이 배열 하나로 정합니다. (ADR-054, ADR-060, ADR-061)
const NAVER_MAP_SEARCH = 'https://map.naver.com/p/search/';
// 센터 카드의 안내 문구 (design/02 연출 문구). 시스템 문구라 반말입니다. (ADR-029)
const COPY_MESSAGE = { done: '주소를 복사했어!', failed: '복사가 안 됐어. 주소를 길게 눌러서 복사해 줘.' };
const CARD_GUARD_MS = 400; // 카드가 나타난 직후의 "다음" 탭은 무시합니다. (ADR-054) 등장 연출(0.7초)의 "밤!" 지점 뒤까지 막습니다.

const startButton = document.getElementById('start-button');
const form = document.getElementById('lock-form');
const input = document.getElementById('answer');
const submit = document.getElementById('submit');
const status = document.getElementById('status');
const errorMessage = document.getElementById('error-message');
const giftButton = document.getElementById('gift-button');
const cardsScreen = document.getElementById(SCREEN_IDS.cards);

const announceTimers = new WeakMap();
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
// 먼저 비운 뒤 잠시 후에 넣습니다. (ADR-051) 요소마다 따로 관리합니다.
function announce(element, text) {
  clearTimeout(announceTimers.get(element));
  element.textContent = '';
  if (!text) return;
  announceTimers.set(element, setTimeout(() => { element.textContent = text; }, 40));
}

export function setStatus(text) {
  announce(status, text);
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

// 안내 화면의 시작 버튼. HTML에서는 비활성으로 시작하고, 연결이 끝나면 활성화합니다. (ADR-057)
export function onStart(handler) {
  startButton.addEventListener('click', handler);
  startButton.disabled = false;
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

// 복호화한 편지를 채웁니다. 첫 항목은 호칭, 마지막 항목은 맺음말, 그 사이는 문단입니다. textContent만 씁니다. (ADR-026, ADR-060)
export function renderLetter(letter) {
  document.getElementById('letter-salutation').textContent = letter[0];
  document.getElementById('letter-closing').textContent = letter[letter.length - 1];
  const paragraphs = document.getElementById('letter-paragraphs');
  paragraphs.replaceChildren(...letter.slice(1, -1).map((text) => {
    const p = document.createElement('p');
    p.textContent = text;
    return p;
  }));
}

// 편지 접기/펼치기: 접으면 호칭만 남고 문단과 맺음말이 숨겨집니다. 처음 상태는 접힘입니다. (ADR-060, ADR-063)
const letterToggle = document.getElementById('letter-toggle');
const letterBody = document.getElementById('letter-body');
letterToggle.addEventListener('click', () => {
  const wasExpanded = letterToggle.getAttribute('aria-expanded') === 'true';
  letterBody.hidden = wasExpanded;
  letterToggle.setAttribute('aria-expanded', String(!wasExpanded));
  letterToggle.textContent = wasExpanded ? '펼쳐보기' : '접어두기';
});

// 센터 안내: 주소는 화면의 주소 텍스트 한 곳에서만 읽습니다. 복사할 값과 지도 링크가 모두 여기서 나옵니다. (ADR-060)
const addressElement = document.getElementById('center-address');
const mapLink = document.getElementById('map-link');
const copyStatus = document.getElementById('copy-status');
mapLink.href = NAVER_MAP_SEARCH + encodeURIComponent(addressElement.textContent.trim());
document.getElementById('copy-address').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(addressElement.textContent.trim());
    announce(copyStatus, COPY_MESSAGE.done);
  } catch {
    // 클립보드 API가 없거나 거부된 경우(일부 인앱 브라우저). 주소는 선택 가능한 텍스트로 항상 보입니다.
    announce(copyStatus, COPY_MESSAGE.failed);
  }
});

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
