// 화면 표시, 상태 문구, 포커스 이동 (ADR-047).
// 잠금, 오류, 잠금 해제 후 화면을 한 화면 단위로 바꿉니다. 뒤로 가기는 없습니다.

const SCREEN_IDS = {
  lock: 'screen-lock',
  error: 'screen-error',
  unlocked: 'screen-unlocked',
};

const form = document.getElementById('lock-form');
const input = document.getElementById('answer');
const submit = document.getElementById('submit');
const status = document.getElementById('status');
const errorMessage = document.getElementById('error-message');

let statusTimer = null;

// 화면을 바꾸고, 새 화면의 제목으로 포커스를 옮깁니다.
export function showScreen(name) {
  for (const [key, id] of Object.entries(SCREEN_IDS)) {
    document.getElementById(id).hidden = key !== name;
  }
  const heading = document.getElementById(SCREEN_IDS[name]).querySelector('[tabindex="-1"]');
  if (heading) heading.focus();
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
