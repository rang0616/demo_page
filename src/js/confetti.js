// 폭죽 (ADR-055). 외부 라이브러리 없이 전체 화면 캔버스에 종이 꽃가루를 그립니다.
// 상자 위치에서 위쪽으로 터지고, 약 1.8초 뒤 캔버스를 비우고 숨깁니다.
// 모션 감소 설정에서는 호출하지 않습니다. (호출하는 쪽에서 막습니다)

const COLORS = ['#F4A7A7', '#F8BDBD', '#BFD8C8', '#C4757D']; // 디자인 토큰 색 (design/04)
const COUNT = 200; // 양은 이 값 하나로 정합니다. (ADR-092, 처음 80)
const DURATION_MS = 1800;
const FADE_MS = 400;
const GRAVITY = 0.28; // 프레임(약 16.7ms)당 가속
const DRAG = 0.985;
const FRAME_MS = 1000 / 60;

let running = false;

function makeParticle(originX, originY) {
  // 위쪽 부채꼴(-160°~-20°)로 퍼집니다.
  const angle = (-160 + Math.random() * 140) * (Math.PI / 180);
  const speed = 6 + Math.random() * 8;
  return {
    x: originX,
    y: originY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 5 + Math.random() * 5,
    round: Math.random() < 0.35,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

export function burstConfetti(originElement) {
  if (running) return;
  const canvas = document.getElementById('confetti');
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const width = globalThis.innerWidth;
  const height = globalThis.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const rect = originElement.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height * 0.35;
  const particles = Array.from({ length: COUNT }, () => makeParticle(originX, originY));

  running = true;
  canvas.hidden = false;
  let startedAt = null;
  let lastAt = null;

  function frame(now) {
    if (startedAt === null) { startedAt = now; lastAt = now; }
    const elapsed = now - startedAt;
    const step = Math.min((now - lastAt) / FRAME_MS, 3); // 느린 기기에서도 움직임의 속도를 유지합니다.
    lastAt = now;

    ctx.clearRect(0, 0, width, height);
    const alpha = elapsed > DURATION_MS - FADE_MS ? Math.max(0, (DURATION_MS - elapsed) / FADE_MS) : 1;

    for (const p of particles) {
      p.vx *= DRAG ** step;
      p.vy = p.vy * DRAG ** step + GRAVITY * step;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.rotation += p.spin * step;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }

    if (elapsed < DURATION_MS) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, width, height);
      canvas.hidden = true;
      canvas.width = 0; // 끝난 뒤 캔버스 메모리를 돌려줍니다.
      canvas.height = 0;
      running = false;
    }
  }

  requestAnimationFrame(frame);
}
