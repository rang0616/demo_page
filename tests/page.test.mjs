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
const css = await read('src/css/style.css');
const content = await read('design/02-content.md');
const flow = await read('design/01-experience-flow.md');

// <article id="..."> ... </article> 조각을 꺼냅니다.
function article(id) {
  const match = html.match(new RegExp(`<article id="${id}"[\\s\\S]*?</article>`));
  assert.ok(match, `${id} 카드가 index.html에 없습니다.`);
  return match[0];
}

// 카드 묶음 안의 내용 프레임(<div class="card ...">...</div>)만 꺼냅니다. 프레임은 다음 구역(.card-actions)이나 </article> 바로 앞에서 끝납니다.
// 이전 버튼과 다음 구역은 프레임 밖입니다. (ADR-081) 들여쓰기에 기대지 않습니다.
function frameOf(id) {
  const stack = article(id);
  const start = stack.search(/<div class="card [a-z]+">/);
  assert.ok(start >= 0, `${id}에 내용 프레임(div.card)이 없습니다.`);
  const actions = stack.search(/<div class="card-actions"/);
  const end = actions >= 0 ? actions : stack.lastIndexOf('</article>');
  assert.ok(end > start, `${id}의 내용 프레임 끝을 찾지 못했습니다.`);
  return stack.slice(start, end).trimEnd().replace(/<\/div>$/, '');
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

test('카드 묶음 구조: article.card-stack 안에 내용 프레임 하나, 다음 버튼은 프레임 밖 .card-actions (ADR-081)', () => {
  for (const id of cardIds) {
    const stack = article(id);
    assert.match(stack.match(/<article[^>]*>/)[0], /class="card-stack"/, `${id}는 card-stack이어야 합니다.`);
    assert.equal((stack.match(/<div class="card [a-z]+">/g) || []).length, 1, `${id}에는 내용 프레임이 하나여야 합니다.`);
    assert.ok(!frameOf(id).includes('data-next'), `${id}의 다음 버튼은 프레임 밖 구역에 있어야 합니다.`);
    const last = id === cardIds[cardIds.length - 1];
    assert.equal(/<div class="card-actions"[^>]*>\s*<button[^>]*data-next[^>]*>다음<\/button>\s*<\/div>/.test(stack), !last, `${id}의 다음 구역 여부가 규칙과 다릅니다.`);
    if (id !== 'card-letter' && !last) assert.ok(!/<div class="card-actions"[^>]*hidden/.test(stack), `${id}의 다음 구역은 처음부터 보여야 합니다.`);
    // 마크업 순서: 이전 버튼(있다면) → 프레임 → 다음 구역
    const backAt = stack.search(/<button[^>]*data-back/), frameAt = stack.search(/<div class="card [a-z]+">/), actionsAt = stack.search(/<div class="card-actions"/);
    if (backAt >= 0) assert.ok(backAt < frameAt, `${id}: 이전 버튼이 프레임보다 앞에 있어야 합니다.`);
    if (actionsAt >= 0) assert.ok(frameAt < actionsAt, `${id}: 다음 구역이 프레임 뒤에 있어야 합니다.`);
  }
  assert.ok(!article('card-voucher').includes('data-back'), '바우처 카드에는 이전 버튼이 없습니다.');
  assert.match(css, /\.card-stack \{[^}]*display: flex;[^}]*flex-direction: column;[^}]*gap: 16px;/);
  const letterFrame = css.match(/#card-letter \.letter \{([^}]*)\}/)?.[1] ?? '';
  assert.match(letterFrame, /background: none;/, '편지 카드는 봉투 상태에서도 프레임(흰 배경)이 없어야 합니다. (ADR-086)');
  assert.match(letterFrame, /box-shadow: none;/, '편지 카드는 봉투 상태에서도 프레임 그림자가 없어야 합니다. (ADR-086)');
  assert.ok(!/padding/.test(letterFrame), '봉투 상태의 프레임 여백(레이아웃)은 바꾸지 않습니다. 여백은 열렸을 때 규칙에서만 줄입니다.');
  assert.match(css, /#card-letter\[data-state="open"\] \.letter \{[^}]*padding-right: 0;[^}]*padding-bottom: 0;[^}]*padding-left: 0;/, '열린 편지의 좌우·아래 안쪽 여백은 0이어야 합니다(위쪽 64px은 이전 버튼 자리).');
  // 프레임을 없애는 규칙(background: none, box-shadow: none)은 편지 카드에만 있어야 합니다. 다른 카드의 프레임 선택자가 들어 있으면 안 됩니다.
  const frameSelector = /(^|[\s,])(\.card|\.center|\.booking|\.voucher|#card-center|#card-booking|#card-voucher)(?![-\w])/;
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^}]*(?:background: none|box-shadow: none)[^}]*)\}/g)) {
    const own = selector.trim();
    if (own.includes('#card-letter')) continue;
    assert.ok(!frameSelector.test(own), `다른 카드의 프레임에 배경·그림자 제거 규칙이 있습니다: ${own}`);
  }
  assert.match(css, /\.back-button \{[^}]*position: absolute;[^}]*top: 12px;[^}]*left: 12px;/, '이전 버튼은 프레임 왼쪽 위 12px에 겹쳐 놓입니다.');
  assert.match(css, /\.card\.letter,\s*\.card\.center,\s*\.card\.booking \{[^}]*padding-top: 64px;/, '이전 버튼이 있는 프레임은 위쪽 안쪽 여백이 64px이어야 합니다.');
});

test('마지막 카드를 뺀 모든 카드에는 "다음" 버튼이 있고, 마지막 카드에는 없다 (ADR-047, ADR-061)', () => {
  const last = cardIds[cardIds.length - 1];
  for (const id of cardIds) {
    const hasNext = article(id).includes('data-next');
    assert.equal(hasNext, id !== last, `${id}의 "다음" 버튼 여부가 규칙과 다릅니다.`);
  }
});

test('예약 안내 카드: 링크와 입력창이 없고, 내용 프레임 안의 버튼은 월 이동 점 둘뿐이다. 이전 버튼은 프레임 밖 카드 묶음에 있다 (ADR-011, ADR-061, ADR-077, ADR-081)', () => {
  const booking = article('card-booking');
  for (const tag of ['<a ', '<input', '<textarea', '<select']) {
    assert.ok(!booking.includes(tag), `예약 안내 카드에 ${tag}가 있습니다.`);
  }
  const frame = frameOf('card-booking');
  const frameButtons = frame.match(/<button[^>]*>/g) || [];
  assert.equal(frameButtons.length, 2);
  assert.ok(frameButtons.every((b) => b.includes('class="calendar-dot') && b.includes('aria-label="')), '프레임 안의 버튼은 이름이 있는 월 이동 점이어야 합니다.');
  assert.equal((booking.match(/<button[^>]*data-back[^>]*>/g) || []).length, 1, '이전 버튼은 카드 묶음에 하나 있어야 합니다.');
  assert.ok(!booking.includes('data-next'), '마지막 카드에는 다음 버튼 구역이 없습니다.');
});

test('맺음말은 암호문을 다시 만들기 전까지 서명으로 대신 보인다 (ADR-076)', () => {
  assert.match(screens, /const CLOSING_OVERRIDE = '남자친구 휘❤️';/);
  assert.match(screens, /textContent = CLOSING_OVERRIDE \?\? letter\[letter\.length - 1\]/);
});

test('바우처의 "20회"는 강조 요소로 나뉘어 채워진다. 값은 바꾸지 않는다 (ADR-085)', async () => {
  const { splitAccent } = await import(join(ROOT, 'src/js/accent.js'));
  const joined = (pieces) => pieces.map((p) => p.text).join('');
  const cases = ['', 'A', '20회', 'x20회y20회', '(20회)', '❤️20회✨', '패시브 스트레칭 20회 회원권', '1:1 맞춤 컨디셔닝 (20회)', 'SPECIAL 20 SESSIONS'];
  for (const value of cases) {
    const pieces = splitAccent(value, '20회');
    assert.equal(joined(pieces), value, `이어 붙인 글이 원래 값과 같아야 합니다: ${JSON.stringify(value)}`);
    assert.equal(pieces.filter((p) => p.accent).length, value.split('20회').length - 1);
    assert.ok(pieces.filter((p) => p.accent).every((p) => p.text === '20회'));
  }
  assert.deepEqual(splitAccent('패시브 스트레칭 20회 회원권', '20회'), [{ text: '패시브 스트레칭 ', accent: false }, { text: '20회', accent: true }, { text: ' 회원권', accent: false }]);
  assert.deepEqual(splitAccent('(20회)', '20회'), [{ text: '(', accent: false }, { text: '20회', accent: true }, { text: ')', accent: false }]);
  assert.deepEqual(splitAccent('', '20회'), [{ text: '', accent: false }]);
  assert.deepEqual(splitAccent('SPECIAL 20 SESSIONS', '20회').filter((p) => p.accent), [], '영문 배지는 강조 대상이 아닙니다.');
  assert.equal(splitAccent(123, '20회')[0].text, '123');
  assert.match(screens, /const VOUCHER_ACCENT = '20회';/);
  assert.match(screens, /splitAccent\(voucher\[key\], VOUCHER_ACCENT\)/);
  assert.match(screens, /span\.className = 'voucher-accent'/);
  assert.match(screens, /document\.createTextNode\(text\)/);
  assert.match(css, /--voucher-accent: #B03A52;/);
  assert.match(css, /\.voucher-accent \{[^}]*color: var\(--voucher-accent\);[^}]*font-weight: 800;/);
  assert.ok(!html.includes('voucher-accent'), '강조 요소는 JS가 만듭니다. HTML에 값을 미리 쓰지 않습니다.');
});

test('두 기기를 위한 밝은 색 구성 알림과 글자 자동 확대 방지 (ADR-083)', () => {
  assert.match(html, /<meta name="color-scheme" content="only light">/);
  const block = (selector) => css.match(new RegExp(`(?:^|\\n)${selector} \\{([^}]*)\\}`))?.[1] ?? '';
  assert.match(block(':root'), /color-scheme: only light;/, ':root 안에 color-scheme: only light가 있어야 합니다.');
  assert.match(block('html'), /-webkit-text-size-adjust: 100%;/);
  assert.match(block('html'), /(?<!-webkit-)text-size-adjust: 100%;/);
  assert.match(block('\\.field'), /font-size: 2\.2rem;/, '입력창 글자는 16px 이상이어야 iOS가 확대하지 않습니다. 답란은 손글씨 2.2rem입니다. (ADR-083, ADR-089)');
});

test('선물 상자 화면: 보이는 글 없이 화면 읽기용 제목만, 프레임 없이 흔들림과 둥근 물결 (ADR-089)', () => {
  assert.match(html, /<h1 id="gift-hint" class="question sr-only" tabindex="-1">선물 확인하기<\/h1>/);
  assert.ok(content.includes('| 선물 확인하기 |'), '02 문구 표와 일치해야 합니다.');
  assert.ok(!html.includes('상자를 눌러 선물을 확인하세요'), '옛 안내 문구는 없어야 합니다.');
  const gift = html.match(/<section id="screen-gift"[\s\S]*?<\/section>/)[0];
  assert.ok(!/class="card/.test(gift), '선물 상자 화면에는 프레임(.card)이 없어야 합니다.');
  assert.equal((gift.match(/class="gift-ring[^"]*" aria-hidden="true"/g) || []).length, 3, '파동은 세 겹이며 장식이어야 합니다.');
  assert.match(gift, /<span class="gift-sway" aria-hidden="true">\s*<span class="gift-box">/, '상자는 흔들리는 래퍼 안에 있어야 합니다.');
  assert.match(css, /\.gift-ring \{[^}]*border-radius: 50%;[^}]*opacity: 0;/, '파동은 원이고 기본 불투명도가 0이어야 합니다.');
  assert.match(css, /\.gift\.opening \.gift-sway,\s*\.gift\.opening \.gift-ring \{[^}]*animation: none;/, '상자를 누르면 흔들림과 파동이 멈춰야 합니다.');
  assert.match(css, /@keyframes gift-wave \{[\s\S]*?scale\(2\.6\)/, '파동은 최대 2.6배(약 312px)입니다.');
  assert.ok(content.includes('편지가 도착했습니다!'), '02 문구 표에 편지 봉투 제목이 있어야 합니다.');
});

test('편지는 봉투로 시작한다: 본문과 "다음" 버튼 hidden, 봉인 버튼 이름, 접기 버튼 없음 (ADR-066)', () => {
  const letter = article('card-letter');
  assert.match(letter.match(/<article[^>]*>/)[0], /data-state="sealed"/);
  assert.match(letter, /<h1 id="letter-heading" class="letter-heading">편지가 도착했습니다!<\/h1>/, '봉투 위에 보이는 제목이 있어야 합니다. (ADR-074)');
  assert.match(screens, /letterHeading\.className = 'sr-only'/, '열린 뒤에는 제목이 보이지 않는 글로 바뀌어야 합니다.');
  assert.match(screens, /const ENVELOPE_OPEN_MS = 800;/, '봉투 여는 시간은 ADR-075의 0.8초입니다.');
  const seal = letter.match(/<button id="seal-button"([^>]*)>\s*([^<]*?)\s*<\/button>/);
  assert.ok(seal, '봉인 버튼이 없습니다.');
  assert.ok(seal[1].includes('aria-label="편지 봉투 열기"') && seal[1].includes('aria-controls="letter-body"'));
  assert.equal(seal[2], '열기');
  assert.match(letter, /<div id="letter-body"[^>]*\shidden[\s>]/);
  assert.match(letter, /<div class="card-actions" hidden>\s*<button[^>]*data-next/, '"다음" 버튼 구역은 편지가 열릴 때까지 숨겨져야 합니다.');
  assert.match(screens, /letterActions\.hidden = false/, '편지가 열리면 다음 구역을 보여 줘야 합니다.');
  assert.ok(!letter.includes('letter-toggle'), '접기/펼치기 버튼은 ADR-066에서 없앴습니다.');
  const decorative = letter.match(/<div class="envelope-(back|paper|pocket|flap)" aria-hidden="true">/g) || [];
  assert.equal(decorative.length, 4, '봉투 그림 4조각은 aria-hidden이어야 합니다.');
});

test('이전 카드 버튼은 편지·센터·예약 카드 묶음마다 하나씩 있고 이름이 있다. 바우처에는 없다 (ADR-065, ADR-081)', () => {
  const buttons = html.match(/<button[^>]*data-back[^>]*>/g) || [];
  assert.equal(buttons.length, 3);
  assert.ok(buttons.every((b) => b.includes('class="back-button"') && b.includes('aria-label="이전 카드로"') && !b.includes('hidden')), '이전 버튼은 이름이 있고 숨기지 않습니다.');
  assert.ok(!html.includes('id="back-button"'), '단일 #back-button은 카드마다 하나씩으로 바뀌었습니다.');
  for (const id of ['card-letter', 'card-center', 'card-booking']) {
    assert.equal((article(id).match(/<button[^>]*data-back[^>]*>/g) || []).length, 1, `${id}에 이전 버튼이 하나 있어야 합니다.`);
    assert.match(article(id), /<button[^>]*data-back[^>]*>\s*<svg[^>]*aria-hidden="true"/, '"<" 그림은 장식(aria-hidden)이어야 합니다.');
  }
  assert.ok(!/backButton/.test(screens), '이전 버튼을 보이고 숨기는 JS는 없어야 합니다. (ADR-081)');
  assert.match(screens, /cardIndex > 0\) showCard\(cardIndex - 1\)/, '이전 카드로는 첫 카드보다 앞으로 가지 않아야 합니다.');
});

test('센터 카드: 이름 아래 로고, 소개 문구 없음, 초록 지도 버튼과 장식 N 아이콘 (ADR-068, ADR-084)', () => {
  const center = article('card-center');
  const order = [...frameOf('card-center').matchAll(/class="(center-name|logo|center-notice|center-address|center-access|center-actions)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['center-name', 'logo', 'center-notice', 'center-address', 'center-access', 'center-actions'], '센터 카드의 순서는 이름, 로고, 안내, 주소, 교통, 버튼입니다. (ADR-084)');
  assert.match(center, /<div class="card center">\s*<h1 id="center-name"[^>]*>[^<]*<\/h1>\s*<img class="logo" src="img\/logo\.jpg"[^>]*alt="리스파이어랩 로고">/, '센터 이름이 프레임 맨 위, 로고가 그 바로 아래에 있어야 합니다. (ADR-084)');
  assert.ok(!center.includes('center-benefits') && !center.includes('<li'), '소개 문구 3개는 삭제되었습니다.');
  assert.ok(!html.includes('애쓰지 않고 누워서') && !html.includes('프라이빗한 힐링 리커버리'), '삭제한 소개 문구가 남아 있습니다.');
  const map = center.match(/<a id="map-link"([^>]*)>([\s\S]*?)<\/a>/);
  assert.ok(map, '지도 링크가 없습니다.');
  assert.ok(map[1].includes('button-naver') && map[1].includes('rel="noopener noreferrer"') && map[1].includes('target="_blank"'));
  assert.match(map[2], /^<svg class="naver-mark"[^>]*aria-hidden="true"/, 'N 아이콘은 글자 앞의 장식(aria-hidden)이어야 합니다.');
  assert.equal(textOf(map[2]), '지도로 보기', '보이는 글은 "지도로 보기"입니다. (ADR-090)');
  assert.match(map[1], /aria-label="네이버 지도로 보기"/, '접근성 이름은 보이는 글을 포함한 "네이버 지도로 보기"입니다. (WCAG 2.5.3)');
  const actions = center.match(/<div class="center-actions">([\s\S]*?)<\/div>/)[1];
  assert.ok(actions.indexOf('id="map-link"') < actions.indexOf('id="copy-address"'), '지도 링크가 왼쪽(앞), 주소 복사가 오른쪽입니다. (ADR-090)');
  assert.match(css, /\.center-actions \{[^}]*flex-flow: row wrap;/, '두 버튼은 한 줄에 나란히 놓입니다(좁으면 쌓임). (ADR-090)');
  assert.match(css, /\.center \{[^}]*var\(--center-metal-1\)[^}]*var\(--center-metal-3\)[^}]*var\(--center-edge-a\)/s, '센터 카드는 하늘색 은빛 메탈입니다. (ADR-090)');
  assert.match(css, /--center-metal-3: #CFE0F2;/);
  assert.match(css, /--muted-on-center: #5E5252;/);
  assert.match(css, /\.center::before \{[^}]*animation: center-shimmer 9s/s, '센터 카드 반사광은 9초 주기입니다.');
  assert.match(css, /prefers-reduced-motion[\s\S]*\.center::before \{\s*display: none;/, '모션 감소 설정에서는 반사광 띠가 남지 않아야 합니다.');
  assert.match(css, /--naver: #03C75A;/);
  assert.match(css, /\.button\.button-naver \{[^}]*background: var\(--naver\)/);
});

test('예약 카드의 달력: 10월·11월, 보기 전용 영역, 월 이동 점 버튼 (ADR-069, ADR-077)', () => {
  const booking = article('card-booking');
  assert.match(booking, /<div id="calendar" class="calendar" role="region" aria-label="10월과 11월 달력" tabindex="0"><\/div>/);
  assert.match(booking, /<div class="calendar-dots" role="group" aria-label="달력 월 이동"><button type="button" class="calendar-dot is-current" aria-label="10월 달력 보기" aria-current="true"><\/button><button type="button" class="calendar-dot" aria-label="11월 달력 보기"><\/button><\/div>/, '월 이동 점은 이름이 있는 버튼이고 처음에는 10월 점이 켜져 있어야 합니다. (ADR-077)');
  assert.match(screens, /calendar\.scrollTo\(\{ left: calendar\.children\[i\]\.offsetLeft/);
  assert.match(css, /\.calendar-dot \{[^}]*width: 44px;[^}]*height: 44px;/, '점의 눌러지는 영역은 44px이어야 합니다.');
  assert.match(screens, /const CALENDAR_MONTHS = \[\{ year: 2026, month: 10 \}, \{ year: 2026, month: 11 \}\];/);
  assert.match(screens, /new Date\(year, month - 1, 1\)\.getDay\(\)/);
  assert.match(css, /\.calendar \{[^}]*scroll-snap-type: x mandatory/);
  assert.match(css, /\.calendar-month \{[^}]*flex: 0 0 100%/, '한 번에 한 달만 보이려면 슬라이드 폭이 100%여야 합니다. (ADR-072)');
});

test('달력: 11월 18일 하트(장식)와 읽어 줄 글, 지난 날짜 표시 (ADR-072)', () => {
  assert.match(screens, /const CALENDAR_BIRTHDAY = \{ month: 11, day: 18 \};/);
  assert.match(screens, /heart\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(screens, /heart\.textContent = '❤️'/);
  assert.match(screens, /note\.textContent = ' 윰댕 생일'/);
  assert.match(screens, /new Date\(year, month - 1, day\) < TODAY_START/);
  assert.match(css, /\.calendar-month td\.is-past \{[^}]*color: var\(--past-day\)/);
  assert.match(css, /--past-day: #A39494;/);
  assert.match(css, /--sat: #1565C0;/);
  assert.match(css, /--sun: #C62828;/);
  assert.match(screens, /if \(i === 0\) cell\.classList\.add\('is-sun'\)/);
  assert.match(screens, /if \(i === 6\) cell\.classList\.add\('is-sat'\)/);
  assert.match(css, /td\.is-sat\.is-past \{[^}]*var\(--sat-past\)/);
  assert.match(css, /td\.is-sun\.is-past \{[^}]*var\(--sun-past\)/);
});

test('편지지에 세로 여백선이 없다 (ADR-073)', () => {
  assert.ok(!css.includes('--paper-margin'), '세로 여백선 변수는 삭제되었습니다.');
  assert.match(css, /\.letter-body \{\s*padding: calc\(var\(--letter-line\) \* 0\.6\) 16px calc\(var\(--letter-line\) \* 0\.4\);/);
});

test('편지지와 메탈 바우처의 핵심 스타일이 있다 (ADR-070, ADR-071)', () => {
  assert.match(css, /--letter-line: 2\.5rem;/);
  assert.match(css, /\.letter-salutation \{[^}]*line-height: var\(--letter-line\)/, '호칭의 line-height는 --letter-line이어야 합니다.');
  assert.match(css, /\.letter-paragraphs p,\s*\.letter-closing \{[^}]*line-height: var\(--letter-line\)/, '문단과 맺음말의 line-height는 --letter-line이어야 합니다.');
  assert.match(css, /\.letter-body \{[\s\S]*?var\(--paper-line\)[\s\S]*?var\(--paper\)/);
  assert.match(css, /\.voucher \{[\s\S]*?var\(--metal-1\)[\s\S]*?var\(--metal-edge-a\)/);
  assert.match(css, /\.voucher::before \{[\s\S]*?animation: holo-shimmer 7s infinite linear/);
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
  for (const phrase of ['지금 바로 확인하기', '열어 보기', '다음', '| 열기 (접근성 이름: 편지 봉투 열기)', '접근성 이름만 "이전 카드로"', '주소 복사하기', '네이버 지도로 보기', '주소를 복사했어!', '복사가 안 됐어. 주소를 길게 눌러서 복사해 줘.', '신원을 확인하겠습니다.', '아래 질문에 답을 해주세요.', '휘와 윰댕이 사귄 날은?']) {
    assert.ok(docs.includes(phrase), `설계 문서에 "${phrase}"가 없습니다.`);
  }
});

test('메타 정보: 중립 제목과 설명, noindex, 미리보기 이미지는 선물 그림, 파비콘 없음 (ADR-021, ADR-030, ADR-064)', async () => {
  assert.match(html, /<title>선물이 도착했어요<\/title>/);
  assert.match(html, /<meta property="og:title" content="선물이 도착했어요">/);
  assert.match(html, /<meta property="og:description" content="열어 보려면 링크를 눌러 주세요">/);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/rang0616\.github\.io\/demo_page\/img\/og\.jpg">/);
  assert.match(html, /<meta property="og:image:width" content="800">/);
  assert.match(html, /<meta property="og:image:height" content="400">/);
  assert.ok((await stat(join(ROOT, 'src/img/og.jpg'))).size <= 40 * 1024, '미리보기 이미지가 40KB를 넘었습니다.');
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
  const allowed = new Set(['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'map.naver.com', 'rang0616.github.io']);
  const files = ['src/index.html', 'src/css/style.css', ...(await readdir(join(ROOT, 'src/js'))).map((f) => `src/js/${f}`)];
  for (const file of files) {
    for (const [url] of (await read(file)).matchAll(/https?:\/\/[^\s"')<>]+/g)) {
      assert.ok(allowed.has(new URL(url).hostname), `${file}: 허용되지 않은 호스트 ${url}`);
    }
  }
});

test('JS가 찾는 id가 모두 HTML에 있다 (id가 어긋나면 모듈이 죽어 화면이 멈춤)', async () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const file of await readdir(join(ROOT, 'src/js'))) {
    for (const [, id] of (await read(`src/js/${file}`)).matchAll(/getElementById\('([^']+)'\)/g)) {
      assert.ok(ids.has(id), `src/js/${file}: HTML에 없는 id ${id}`);
    }
  }
});

test('CSS·JS 주소의 버전 쿼리(?v=)가 모든 위치에서 같다 (ADR-078)', async () => {
  const targets = [
    [html, /href="css\/style\.css\?v=([^"]+)"/],
    [html, /src="js\/app\.js\?v=([^"]+)"/],
    [await read('src/js/app.js'), /from '\.\/normalize\.js\?v=([^']+)'/],
    [await read('src/js/app.js'), /from '\.\/crypto\.js\?v=([^']+)'/],
    [await read('src/js/app.js'), /from '\.\/sound\.js\?v=([^']+)'/],
    [await read('src/js/app.js'), /from '\.\/screens\.js\?v=([^']+)'/],
    [screens, /from '\.\/confetti\.js\?v=([^']+)'/],
    [screens, /from '\.\/crypto\.js\?v=([^']+)'/],
    [screens, /from '\.\/accent\.js\?v=([^']+)'/],
  ];
  const versions = targets.map(([text, pattern]) => {
    const match = text.match(pattern);
    assert.ok(match, `버전 쿼리가 없는 주소: ${pattern}`);
    return match[1];
  });
  assert.equal(new Set(versions).size, 1, `?v= 값이 서로 다릅니다: ${versions}`);
  assert.match(versions[0], /^\d+\.\d+\.\d+$/);
  const all = [...html.matchAll(/\.(?:css|js)\?v=/g)].length + [...(await read('src/js/app.js')).matchAll(/\.js\?v=/g)].length + [...screens.matchAll(/\.js\?v=/g)].length;
  assert.equal(all, targets.length, '버전 쿼리를 붙이지 않은 모듈 주소가 있거나 위 목록에 없는 주소가 있습니다.');
});

test('src/js의 모든 상대 import에 버전 쿼리가 있다: 같은 모듈이 두 번 로드되지 않게 (ADR-078)', async () => {
  for (const file of await readdir(join(ROOT, 'src/js'))) {
    for (const [, spec] of (await read(`src/js/${file}`)).matchAll(/from '(\.\/[^']+)'/g)) {
      assert.match(spec, /\.js\?v=\d+\.\d+\.\d+$/, `src/js/${file}: 버전 쿼리가 없는 import ${spec}`);
    }
  }
});

test('편지지는 흰색이고, 이전 버튼에 올림·누름 효과가 있다 (ADR-086)', () => {
  assert.match(css, /--paper: #FFFFFF;/);
  assert.ok(!css.includes('#FFFDF8'), '옛 아이보리 색이 남아 있습니다.');
  const back = css.match(/(?:^|\n)\.back-button \{([^}]*)\}/)[1];
  assert.match(back, /transition: background 0\.15s ease, transform 0\.1s ease;/, '"다음" 버튼과 같은 속도여야 합니다.');
  assert.match(css, /@media \(hover: hover\) \{\s*\.back-button:hover \{\s*background: var\(--accent-hover\);\s*\}\s*\}/, '마우스를 올리면 분홍색이어야 합니다(마우스가 있는 기기에서만).');
  assert.match(css, /\.back-button:active \{\s*background: var\(--accent-hover\);\s*transform: scale\(0\.95\);\s*\}/, '누르는 동안 분홍색이고 살짝 작아져야 합니다.');
  assert.match(css, /\.button:active:not\(:disabled\) \{\s*transform: scale\(0\.98\);/, '"다음" 버튼의 기준 값입니다.');
});

test('편지 봉투 알림 연출: 제목 깜빡임과 봉투 흔들림, 열기 시작하면 멈춤 (ADR-087)', () => {
  const block = (selector) => css.match(new RegExp(`(?:^|\\n)${selector} \\{([^}]*)\\}`))?.[1] ?? '';
  assert.match(block('\\.letter-heading'), /animation: notice-blink 1\.6s ease-in-out 0\.7s infinite;/, '제목은 1.6초 주기로, 카드 등장 뒤(0.7초 지연)부터 깜빡여야 합니다.');
  assert.match(css, /@keyframes notice-blink \{\s*0%, 100% \{ opacity: 1; \}\s*50%\s+\{ opacity: 0\.15; \}/, '불투명도는 1 ↔ 0.15이어야 합니다(완전히 사라지지 않음).');
  assert.match(block('\\.envelope'), /animation: envelope-wiggle 2\.4s ease-in-out 0\.7s infinite;/, '봉투는 2.4초 주기로, 0.7초 지연 뒤 흔들려야 합니다.');
  assert.match(block('\\.envelope'), /transform-origin: 50% 100%;/, '아래 가운데를 축으로 흔들립니다.');
  const keyframes = css.match(/@keyframes envelope-wiggle \{([\s\S]*?)\n\}/)[1];
  const angles = [...keyframes.matchAll(/rotate\((-?[\d.]+)deg\)/g)].map((m) => Math.abs(Number(m[1])));
  assert.ok(angles.length > 0 && Math.max(...angles) <= 2.5, '흔들림은 ±2.5도를 넘지 않아야 합니다.');
  assert.match(keyframes, /0%, 33\.3%, 100% \{ transform: rotate\(0deg\); \}/, '앞 0.8초(33.3%)만 흔들리고 나머지는 멈춰야 합니다.');
  const openingHeading = block('#card-letter\\[data-state="opening"\\] \\.letter-heading');
  assert.match(openingHeading, /opacity: 0;/, '열기 시작하면 제목은 사라져야 합니다.');
  assert.match(openingHeading, /transition: none;/, '번쩍임이 없게 전환 없이 사라져야 합니다.');
  assert.match(openingHeading, /animation: none;/, '열기 시작하면 깜빡임이 멈춰야 합니다.');
  assert.ok(!/transition/.test(block('\\.letter-heading')), '제목의 옛 0.15초 페이드 전환은 ADR-087로 대체되었습니다.');
  assert.match(block('#card-letter\\[data-state="opening"\\] \\.envelope'), /animation: none;/, '열기 시작하면 봉투 흔들림이 멈춰야 합니다.');
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {'));
  assert.ok(reduced.length > 0, '모션 감소 규칙이 있어야 합니다.');
  const reducedBlock = reduced.slice(0, reduced.indexOf('\n}\n') + 3);
  assert.match(reducedBlock, /animation: none !important;/, '모션 감소 설정에서는 모든 애니메이션이 꺼져야 합니다.');
  assert.match(reducedBlock, /transition: none !important;/);
  assert.ok(!screens.includes('notice-blink') && !screens.includes('envelope-wiggle'), '이 연출은 CSS만 씁니다(JS 관여 없음).');
});

test('첫 화면은 알림 배너 카드: 구조, 장식 aria-hidden, 제목만 읽힘, 시작 버튼은 카드 밖 (ADR-088)', () => {
  const intro = html.match(/<section id="screen-intro"[\s\S]*?<\/section>/)[0];
  assert.match(intro, /<div class="intro-stack">\s*(?:<!--[\s\S]*?-->\s*)?<div class="notice-card">/);
  assert.match(intro, /<div class="notice-icon-box" aria-hidden="true">\s*<span class="notice-ring"><\/span>\s*<span class="notice-ring notice-ring-2"><\/span>\s*<span class="notice-ring notice-ring-3"><\/span>\s*<span class="notice-icon">🎁<span class="notice-badge">1<\/span><\/span>\s*<\/div>/, '아이콘 상자(물결 셋, 🎁, 배지)는 장식(aria-hidden)이어야 합니다.');
  assert.match(intro, /<div class="notice-head" aria-hidden="true"><span>선물 도착<\/span><span>지금<\/span><\/div>/, '머리글은 장식(aria-hidden)이고 문구는 02에 있습니다.');
  assert.match(intro, /<h1 id="intro-title" class="notice-title" tabindex="-1">윰댕님<span aria-hidden="true">❤️<\/span>!<br>선물<span aria-hidden="true">🎁<\/span>이 도착했습니다\.<\/h1>/, '제목 문구는 그대로여야 합니다.');
  const noComments = intro.replace(/<!--[\s\S]*?-->/g, '');
  const cardOnly = noComments.slice(noComments.indexOf('<div class="notice-card">'), noComments.search(/<\/div>\s*<button id="start-button"/));
  assert.ok(cardOnly.length > 0 && !cardOnly.includes('start-button'), '시작 버튼은 알림 카드 밖(카드 아래)에 있어야 합니다.');
  assert.match(noComments, /<\/div>\s*<button id="start-button"/);
  assert.match(intro, /<button id="start-button" type="button" class="button" disabled>지금 바로 확인하기<\/button>/);
  assert.ok(content.includes('선물 도착 (왼쪽) / 지금 (오른쪽)'), '02에 머리글 문구가 있어야 합니다.');
  assert.ok(!intro.includes('class="card intro-card"') && !intro.includes('class="question"'), '옛 안내 화면 카드와 제목 클래스는 쓰지 않습니다.');
});

test('첫 화면 알림 연출의 CSS: 내려옴, 시작 버튼 나타남, 벨 울림, 물결, 색과 변수 (ADR-088)', () => {
  const block = (selector) => css.match(new RegExp(`(?:^|\\n)${selector} \\{([^}]*)\\}`))?.[1] ?? '';
  assert.match(block('\\.notice-card'), /animation: notice-in 0\.7s ease-out backwards;/);
  assert.match(block('\\.notice-card'), /border-radius: 22px;/);
  assert.match(block('\\.notice-card'), /box-shadow: var\(--shadow-notice\);/);
  assert.match(block('\\.notice-icon'), /animation: bell-ring 3s ease-in-out 1\.2s infinite;/, '아이콘은 1.2초 뒤부터 3초 주기로 울립니다.');
  assert.match(block('\\.notice-icon'), /transform-origin: 50% 12%;/);
  assert.match(block('\\.notice-ring'), /animation: ring-pulse 3s ease-out 1\.2s infinite;/);
  assert.match(block('\\.notice-ring-2'), /animation-delay: 1\.32s;/);
  assert.match(block('\\.notice-ring-3'), /animation-delay: 1\.44s;/);
  const bell = css.match(/@keyframes bell-ring \{([\s\S]*?)\n\}/)[1];
  const angles = [...bell.matchAll(/rotate\((-?[\d.]+)deg\)/g)].map((m) => Math.abs(Number(m[1])));
  assert.ok(Math.max(...angles) <= 14, '벨 울림은 ±14도를 넘지 않아야 합니다.');
  assert.match(bell, /0%, 30%, 100% \{ transform: rotate\(0deg\); \}/, '앞 0.9초(30%)만 울리고 나머지는 멈춥니다.');
  assert.match(css, /--notify-red: #D32F45;/);
  assert.match(css, /--shadow-notice: /);
  assert.match(block('\\.notice-badge'), /color: var\(--on-seal\);[^}]*background: var\(--notify-red\);/);
  assert.match(block('\\.intro-stack'), /gap: 28px;[^}]*margin-bottom: 140px;/, '가운데보다 약 70px 위에 놓되 잘리지 않아야 합니다.');
  assert.match(css, /@keyframes notice-in \{\s*0%\s+\{ opacity: 0; transform: translateY\(-150px\); \}\s*60%\s+\{ opacity: 1; transform: translateY\(14px\); \}/, '카드는 -150px 위에서 14px 지나쳤다 돌아와야 합니다.');
  assert.match(css, /@keyframes ring-pulse \{\s*0%\s+\{ opacity: 0\.85; transform: scale\(1\); \}\s*30%\s+\{ opacity: 0; transform: scale\(1\.6\); \}/, '물결은 1배에서 1.6배로 퍼지며 옅어져야 합니다.');
  assert.match(block('#start-button'), /animation: start-in 0\.4s ease-out 0\.7s backwards;/, '시작 버튼은 카드 등장(0.7초) 뒤에 0.4초 동안 나타나야 합니다.');
  assert.ok(!/opacity: 0/.test(block('#start-button')), '시작 버튼의 기본 상태는 보이는 상태여야 모션 감소에서 처음부터 보입니다.');
  assert.match(block('#start-button:focus-visible'), /animation: none;/, '키보드 포커스를 받으면 바로 보여야 합니다. (WCAG 2.4.7)');
  assert.match(css, /@keyframes start-in \{\s*from \{ opacity: 0; transform: translateY\(12px\); \}\s*to\s+\{ opacity: 1; transform: none; \}/);
  assert.ok(!/\.intro-card/.test(css), '옛 안내 카드 스타일은 지웁니다.');
  assert.ok(!screens.includes('bell-ring') && !screens.includes('notice-in') && !screens.includes('ring-pulse'), '이 연출은 CSS만 씁니다(JS 관여 없음).');
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

test('신원 확인 화면: 안내는 프레임 밖, 질문·답란만 흰 프레임, 버튼은 프레임 밖 (ADR-059, ADR-089)', () => {
  const lock = html.match(/<form id="lock-form"[\s\S]*?<\/form>/)[0];
  assert.match(lock, /<form id="lock-form" class="lock-stack"/);
  const guideAt = lock.indexOf('id="lock-guide"'), frameAt = lock.indexOf('class="card lock-frame"'), submitAt = lock.indexOf('id="submit"');
  assert.ok(guideAt >= 0 && guideAt < frameAt && frameAt < submitAt, '순서는 안내, 프레임, 버튼입니다.');
  const frame = lock.match(/<div class="card lock-frame">([\s\S]*?)\n        <\/div>/)[1];
  assert.ok(frame.includes('id="lock-question"') && frame.includes('id="answer"') && frame.includes('id="status"'), '프레임 안에는 질문, 답란, 상태 문구가 있습니다.');
  assert.ok(!frame.includes('class="lock-guide"') && !frame.includes('id="submit"'), '안내 문구와 버튼은 프레임 밖입니다.');
  assert.match(lock, /<h1 id="lock-heading"[^>]*aria-labelledby="lock-guide lock-question"/, '제목은 안내와 질문을 이어서 읽습니다.');
  assert.match(lock, /<input id="answer"[^>]*aria-labelledby="lock-question"/, '입력창의 이름은 질문만 씁니다.');
  assert.match(html, /<section id="screen-lock"[^>]*aria-labelledby="lock-guide lock-question"/);
  assert.match(css, /\.lock-frame \{[^}]*background: var\(--card\);[^}]*box-shadow: var\(--shadow-card\)/s, '질문·답란 프레임은 흰 프레임입니다.');
  const field = css.match(/\n\.field \{([^}]*)\}/)[1];
  assert.match(field, /border: 0;/);
  assert.match(field, /border-bottom: 2px solid var\(--accent-border\);/, '답란은 밑줄만 있습니다.');
  assert.match(field, /font-family: var\(--font-letter\);/, '답란 글자는 손글씨입니다.');
  assert.ok(!/border-radius: var\(--radius-pill\)/.test(field), '답란은 알약 모양이 아닙니다.');
});

test('프레임은 바우처, 센터, 신원 확인 질문·답란, 달력에만 있다 (ADR-089)', () => {
  const card = css.match(/\n\.card \{([^}]*)\}/)[1];
  assert.ok(!/background:|box-shadow:/.test(card), '.card 기본 틀에는 바탕과 그림자가 없어야 합니다.');
  const booking = article('card-booking');
  assert.match(booking, /<div class="calendar-frame">\s*<div id="calendar"/, '달력만 흰 프레임 안에 있습니다.');
  assert.ok(booking.indexOf('class="booking-label"') < booking.indexOf('class="calendar-frame"') && booking.indexOf('id="booking-message"') < booking.indexOf('class="calendar-frame"'), '라벨과 본문은 달력 프레임 밖입니다.');
  assert.match(css, /\.calendar-frame \{[^}]*background: var\(--card\);[^}]*box-shadow: var\(--shadow-card\)/s);
});

test('프레임이 없어야 하는 블록에는 바탕·그림자가 없고, 센터 버튼 줄과 신원 확인 수치는 설계대로이다 (ADR-089, ADR-090)', () => {
  for (const sel of ['\\.booking', '\\.gift-card', '\\.lock-stack', '\\.lock-guide', '\\.center-actions']) {
    const body = css.match(new RegExp('\\n' + sel + ' \\{([^}]*)\\}'))?.[1] ?? '';
    assert.ok(!/background:|box-shadow:/.test(body), `${sel.replace(/\\/g, '')}에는 바탕과 그림자가 없어야 합니다.`);
  }
  assert.match(css, /\.lock-stack \{[^}]*gap: 20px;/s);
  assert.match(css, /\.lock-frame \{[^}]*gap: 6px;[^}]*padding: 24px 20px 12px;/s);
  assert.match(css, /\.center-actions \.button \{[^}]*flex: 1 1 0;[^}]*min-width: max-content;[^}]*padding-right: 8px;[^}]*padding-left: 8px;[^}]*white-space: nowrap;/s, '320px에서 버튼이 쌓이되 글자가 줄바꿈되지 않아야 합니다.');
  for (const v of ['--center-metal-1: #FFFFFF', '--center-metal-2: #EDF4FB', '--center-edge-a: #BCD0E6', '--center-edge-b: #FAFDFF', '--center-edge-c: #9DB6D2', '--center-shade: rgba(110, 150, 190, 0.22)']) assert.ok(css.includes(v), `${v}`);
  assert.match(css, /\.gift-sway \{[^}]*gift-bell 3s ease-in-out 0\.3s infinite/s);
  assert.match(css, /\.gift-ring-2 \{[^}]*0\.45s/s);
  assert.match(css, /\.gift-ring-3 \{[^}]*0\.6s/s);
});
