// 효과음 합성 (ADR-027, ADR-055, ADR-058). 음원 파일 없이 WebAudio로 만듭니다.
//   playTap     모든 버튼을 누를 때: 짧은 "뾱" (enableTapSound가 문서 전체의 클릭을 받아 처리)
//   playPop     상자를 누르는 순간: "뿅" 하고 터지는 소리와 짧은 반짝임
//   playFanfare 바우처로 넘어갈 때: "짜잔" 팡파레
// 상자를 누르는 이벤트 안에서 playPop을 호출해야 모바일에서 소리가 납니다.
// 같은 AudioContext를 이어 쓰므로 playFanfare는 뒤에 호출해도 됩니다. 실패하면 조용히 넘어갑니다.

let context = null;

function getContext() {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!context) context = new AudioContextClass();
  if (context.state !== 'running') context.resume().catch(() => {}); // suspended, 그리고 일부 브라우저의 interrupted
  return context;
}

// 소리 하나. from에서 to로 음높이가 변하며 peak까지 커졌다가 줄어듭니다.
// hold(초)가 있으면 그 시간 동안 peak를 유지한 뒤 줄어듭니다.
function voice(ctx, { type = 'sine', from, to = from, start, length, peak, hold = 0 }) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(to, start + length);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
  if (hold > 0) gain.gain.setValueAtTime(peak, start + 0.015 + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + length + 0.05);
}

// 버튼 소리 "뾱": 음높이가 빠르게 올라가는 짧은 소리 하나. (ADR-058)
export function playTap() {
  try {
    const ctx = getContext();
    if (!ctx) return;
    voice(ctx, { from: 380, to: 980, start: ctx.currentTime + 0.005, length: 0.1, peak: 0.14 });
  } catch {
    // 효과음이 실패해도 페이지는 그대로 동작합니다.
  }
}

// 문서 전체의 클릭을 한 곳에서 받아, 모든 버튼에 "뾱" 소리를 냅니다. (이벤트 위임, ADR-058)
// 비활성 버튼과 자기 소리가 있는 버튼(data-own-sound, 상자)은 제외합니다.
export function enableTapSound() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest && event.target.closest('button');
    if (!button || button.disabled || button.hasAttribute('data-own-sound')) return;
    playTap();
  });
}

export function playPop() {
  try {
    const ctx = getContext();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    voice(ctx, { from: 720, to: 180, start: t, length: 0.16, peak: 0.2 }); // 뿅
    [1318.5, 1568, 2093].forEach((frequency, index) => { // 반짝임 (E6, G6, C7)
      voice(ctx, { from: frequency, start: t + 0.06 + index * 0.06, length: 0.25, peak: 0.05 });
    });
  } catch {
    // 효과음이 실패해도 페이지는 그대로 동작합니다.
  }
}

// delay(초): 앞 소리와 겹치지 않게 늦추고 싶을 때 씁니다. (모션 감소 설정에서는 바로 이어지므로)
// 박자(0.13초, 0.28초)는 style.css의 card-pop 키프레임(20%, 40%)과 짝입니다. 한쪽을 바꾸면 다른 쪽도 맞춥니다.
export function playFanfare({ delay = 0 } = {}) {
  try {
    const ctx = getContext();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02 + delay;
    voice(ctx, { type: 'triangle', from: 392, start: t, length: 0.14, peak: 0.12 }); // G4
    voice(ctx, { type: 'triangle', from: 523.25, start: t + 0.13, length: 0.14, peak: 0.12 }); // C5
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency) => { // 밝은 장화음 C5 E5 G5 C6
      // 네 음의 합이 0.2를 넘지 않도록 음마다 0.05로 두고, 처음 0.35초는 유지해 "짜잔"이 또렷하게 들리게 합니다.
      voice(ctx, { type: 'triangle', from: frequency, start: t + 0.28, length: 1.4, peak: 0.05, hold: 0.35 });
    });
  } catch {
    // 효과음이 실패해도 페이지는 그대로 동작합니다.
  }
}
