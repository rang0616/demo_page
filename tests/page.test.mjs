// 페이지 구조, 문구, 메타, 접근성 규칙의 파일 검사 (ADR-062).
// 브라우저를 쓰지 않고 index.html, screens.js, 설계 문서를 글자로 읽어 검사합니다. 패키지가 필요 없습니다.
// 실제 클릭, 포커스, 연출은 이 테스트로 확인할 수 없으므로 /preview-check로 브라우저에서 확인합니다.
// 정답과 편지 원문은 읽지도 쓰지도 않습니다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(join(ROOT, path), 'utf8');

const html = await read('src/index.html');
const screens = await read('src/js/screens.js');
const content = await read('design/02-content.md');
const flow = await read('design/01-experience-flow.md');

// <article id="..."> ... </article> 조각을 꺼냅니다.
function article(id) {
  const match = html.match(new RegExp(`<article id="${id}"[\\s\\S]*?</article>`));
  assert.ok(match, `${id} 카드가 index.html에 없습니다.`);
  return match[0];
}

// 태그를 걷어내고 공백(nbsp 포함)을 정리한 글자만 남깁니다. <br>은 공백으로 봅니다.
const textOf = (fragment) => fragment
  .replace(/<br\s*\/?>/g, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;| /g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

const cardIds = (screens.match(/const CARD_IDS = \[([^\]]*)\]/) || [])[1]
  ?.split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean) ?? [];

test('카드 순서: 바우처 → 편지 → 센터 안내 → 예약 안내', () => {
  assert.deepEqual(cardIds, ['card-voucher', 'card-letter', 'card-center', 'card-booking']);
});

test('모든 카드는 data-card, tabindex=-1, hidden, aria-labelledby를 가진다', () => {
  for (const id of cardIds) {
    const tag = article(id).match(/<article[^>]*>/)[0];
    for (const attribute of ['data-card', 'tabindex="-1"', 'hidden', 'aria-labelledby=']) {
      assert.ok(tag.includes(attribute), `${id}에 ${attribute}가 없습니다.`);
    }
  }
});

test('마지막 카드를 뺀 모든 카드에는 "다음" 버튼이 있고, 마지막 카드에는 없다 (ADR-047, ADR-061)', () => {
  const last = cardIds[cardIds.length - 1];
  for (const id of cardIds) {
    const hasNext = article(id).includes('data-next');
    assert.equal(hasNext, id !== last, `${id}의 "다음" 버튼 여부가 규칙과 다릅니다.`);
  }
});

test('예약 안내 카드에는 버튼, 링크, 입력창이 없다 (ADR-011, ADR-061)', () => {
  const booking = article('card-booking');
  for (const tag of ['<button', '<a ', '<input', '<textarea', '<select']) {
    assert.ok(!booking.includes(tag), `예약 안내 카드에 ${tag}가 있습니다.`);
  }
});

test('편지는 접힌 상태로 시작한다: 본문 hidden, aria-expanded=false, 라벨 "펼쳐보기" (ADR-063)', () => {
  const letter = article('card-letter');
  const toggle = letter.match(/<button id="letter-toggle"([^>]*)>\s*([^<]*?)\s*<\/button>/);
  assert.ok(toggle, '편지 접기 버튼이 없습니다.');
  assert.ok(toggle[1].includes('aria-expanded="false"') && toggle[1].includes('aria-controls="letter-body"'));
  assert.equal(toggle[2], '펼쳐보기');
  assert.match(letter, /<div id="letter-body"[^>]*\shidden[\s>]/);
  assert.ok(letter.includes('data-next'), '접힌 상태에서도 "다음" 버튼이 보여야 합니다.');
});

test('예약 안내 문구가 02-content.md의 기준 문구와 같다', () => {
  const label = content.match(/작은 라벨: (.+)/)?.[1].trim();
  const body = content.match(/^> (첫 예약은 .+)$/m)?.[1].trim();
  assert.ok(label && body, '02-content.md에서 예약 안내 문구를 찾지 못했습니다.');
  const booking = article('card-booking');
  assert.equal(textOf(booking.match(/<p class="booking-label">([\s\S]*?)<\/p>/)[1]), label);
  assert.equal(textOf(booking.match(/<h1 id="booking-message"[^>]*>([\s\S]*?)<\/h1>/)[1]), body);
});

test('예약 안내의 이모지는 장식이라 aria-hidden이다 (ADR-028, ADR-061)', () => {
  assert.ok(article('card-booking').includes('<span aria-hidden="true">💌</span>'));
});

test('안내 화면 제목의 이모지 둘도 aria-hidden이다 (ADR-058)', () => {
  const intro = html.match(/<h1 id="intro-title"[\s\S]*?<\/h1>/)[0];
  assert.equal((intro.match(/<span aria-hidden="true">/g) || []).length, 2);
});

test('화면에 쓰는 주요 문구가 설계 문서(02, 01)에 있다', () => {
  const docs = content + flow;
  for (const phrase of ['지금 바로 확인하기', '열어 보기', '다음', '접어두기', '펼쳐보기', '주소 복사하기', '네이버 지도로 보기', '주소를 복사했어!', '복사가 안 됐어. 주소를 길게 눌러서 복사해 줘.', '신원을 확인하겠습니다.', '아래 질문에 답을 해주세요.', '휘와 윰댕이 사귄 날은?']) {
    assert.ok(docs.includes(phrase), `설계 문서에 "${phrase}"가 없습니다.`);
  }
});

test('메타 정보: 중립 제목과 설명, noindex, 미리보기 이미지·파비콘 없음 (ADR-021, ADR-030)', () => {
  assert.match(html, /<title>선물이 도착했어요<\/title>/);
  assert.match(html, /<meta property="og:title" content="선물이 도착했어요">/);
  assert.match(html, /<meta property="og:description" content="열어 보려면 링크를 눌러 주세요">/);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.ok(!/og:image/.test(html), 'og:image가 있습니다.');
  assert.ok(!/rel="(shortcut )?icon"/.test(html), '파비콘 링크가 있습니다.');
});

test('머리 정보(head)에 이름(윰댕, 휘)이 없다 (ADR-021, ADR-030)', () => {
  const head = html.match(/<head>[\s\S]*?<\/head>/)[0].replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(!/윰댕|휘/.test(head));
});

test('확대를 막지 않고 lang이 ko이다 (ADR-051, 접근성)', () => {
  const viewport = html.match(/<meta name="viewport" content="([^"]*)"/)[1];
  assert.ok(!/user-scalable|maximum-scale/.test(viewport));
  assert.match(html, /<html lang="ko">/);
});

test('id가 중복되지 않고 aria-labelledby가 가리키는 id가 모두 있다', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, `중복 id: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
  for (const [, value] of html.matchAll(/aria-labelledby="([^"]+)"/g)) {
    for (const id of value.split(/\s+/)) assert.ok(ids.includes(id), `없는 id 참조: ${id}`);
  }
});

test('모든 img에 alt가 있고 새 탭 링크에 noopener가 있다', () => {
  for (const [tag] of html.matchAll(/<img[^>]*>/g)) assert.match(tag, /alt="[^"]+"/, tag);
  for (const [tag] of html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) assert.match(tag, /rel="[^"]*noopener[^"]*"/, tag);
});

test('버튼에 이름이 있다 (글자 또는 aria-label)', () => {
  for (const [, attrs, inner] of html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)) {
    assert.ok(/aria-label="[^"]+"/.test(attrs) || textOf(inner).length > 0, `이름 없는 버튼: <button${attrs}>`);
  }
});

test('입력창은 aria-labelledby로 질문만 가리킨다 (ADR-059)', () => {
  assert.match(html, /<input id="answer"[\s\S]*?aria-labelledby="lock-question"/);
  assert.ok(!/<input id="answer"[^>]*\sname=/.test(html), '입력창에 name이 있으면 정답이 주소에 남을 수 있습니다. (ADR-051)');
});

test('외부 주소는 허용 목록 호스트뿐이다 (design/05 허용 외부 리소스)', async () => {
  const allowed = new Set(['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'map.naver.com']);
  const files = ['src/index.html', 'src/css/style.css', ...(await readdir(join(ROOT, 'src/js'))).map((f) => `src/js/${f}`)];
  for (const file of files) {
    for (const [url] of (await read(file)).matchAll(/https?:\/\/[^\s"')<>]+/g)) {
      assert.ok(allowed.has(new URL(url).hostname), `${file}: 허용되지 않은 호스트 ${url}`);
    }
  }
});

test('코드에 innerHTML, console, 저장소 접근, history 조작이 없다 (ADR-026, ADR-057)', async () => {
  for (const file of await readdir(join(ROOT, 'src/js'))) {
    const code = (await read(`src/js/${file}`)).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const banned of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'console.', 'localStorage', 'sessionStorage', 'pushState', 'document.cookie']) {
      assert.ok(!code.includes(banned), `src/js/${file}에 ${banned}가 있습니다.`);
    }
  }
});

test('루트에 옛 데모 index.html과 원본 로고가 없다 (ADR-023, ADR-048)', async () => {
  const rootFiles = await readdir(ROOT);
  assert.ok(!rootFiles.includes('index.html'), '루트 index.html은 제거 대상입니다.');
  assert.ok(!rootFiles.includes('리스파이어랩.png'), '루트의 원본 로고는 제거 대상입니다.');
});

test('src/ 전체 크기가 200KB 이하이고 로고는 40KB 이하이다 (ADR-045, ADR-056)', async () => {
  async function total(dir) {
    let sum = 0;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      sum += entry.isDirectory() ? await total(path) : (await stat(path)).size;
    }
    return sum;
  }
  assert.ok((await total(join(ROOT, 'src'))) <= 200 * 1024, 'src/ 크기가 예산을 넘었습니다.');
  assert.ok((await stat(join(ROOT, 'src/img/logo.jpg'))).size <= 40 * 1024, '로고가 40KB를 넘었습니다.');
});

test('암호문 파일의 구조가 맞다 (ADR-026, 내용은 풀지 않음)', async () => {
  const envelope = JSON.parse(await read('src/data/letter.enc.json'));
  assert.equal(envelope.v, 1);
  assert.equal(envelope.kdf.name, 'PBKDF2');
  assert.equal(envelope.kdf.iter, 600000);
  assert.equal(envelope.cipher.name, 'AES-GCM');
  for (const field of [envelope.kdf.salt, envelope.cipher.iv, envelope.ct]) assert.equal(typeof field, 'string');
});
