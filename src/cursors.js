// 화면 안 커서. 그림을 여기서 만들어 CSS 변수(--cur-arrow, --cur-hand, --cur-grab, --cur-grabbing, --cur-wait)로 넣는다.
// style.css는 이 변수만 쓰고(cursor: var(--cur-hand)), 미니게임 창에는 sdk-host.js가 같은 값을 나눠 준다.
// 마우스 앱(src/apps/mouse-app.js)에서 고른 색, 크기, 직접 그린 그림이 settings의 cursor에 저장되고, 바뀌면 바로 다시 만든다.
//   settings.cursor = { line: 테두리 색 | null(시대 기본), fill: 속 색 | null, size: 1 | 1.5,
//                       custom: { arrow?: { px, hot: [x, y] }, hand?: { ... } } }
//   px는 32×32칸을 한 줄로 이은 글자 1024개다. '1' 테두리 색, '0' 속 색, '.' 투명
// 그림은 모두 직접 그렸다(실제 운영체제 커서 그림은 쓰지 않는다).

export const SIZE = 32; // 커서 그림 한 장의 칸 수(가로 = 세로)

// ---------- 그림 ----------
// 화살표: 시대마다 모양이 조금 다르다(1998 또렷한 테두리, 2005 그림자, 2010 날렵한 모양과 흐린 그림자).
const ARROW = 'M2 2 L2 23 L7.5 18 L11 26.5 L14.5 25 L11 16.5 L18 16.5 Z';
const SLIM = 'M3 2.5 L3 22 L8 17.6 L11.4 25.4 L14 24.3 L10.8 16.6 L17 16.6 Z';
const ARROWS = {
  1998: (line, fill) => `<path d='${ARROW}' fill='${fill}' stroke='${line}' stroke-width='1.5' stroke-linejoin='miter' shape-rendering='crispEdges'/>`,
  2005: (line, fill) => `<path d='${ARROW}' fill='#000' opacity='.28' transform='translate(1.6 1.6)'/>`
    + `<path d='${ARROW}' fill='${fill}' stroke='${line}' stroke-width='1.4' stroke-linejoin='round'/>`,
  2010: (line, fill) => "<defs><filter id='s' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='1.1'/></filter></defs>"
    + `<path d='${SLIM}' fill='#000' opacity='.35' transform='translate(1 1.6)' filter='url(#s)'/>`
    + `<path d='${SLIM}' fill='${fill}' stroke='${line}' stroke-width='1.3' stroke-linejoin='round'/>`,
};
const ERA_LINE = { 1998: '#000000', 2005: '#000000', 2010: '#1d2733' };

// 기다림: 1998, 2005는 모래시계, 2010은 도는 고리
const HOURGLASS = (line, fill) => `<path d='M9 4h14M9 28h14' stroke='${line}' stroke-width='2.4' stroke-linecap='round'/>`
  + "<path d='M10.5 5h11v3.5c0 3-3.6 5.5-5.5 7.5 1.9 2 5.5 4.5 5.5 7.5V27h-11v-3.5c0-3 3.6-5.5 5.5-7.5-1.9-2-5.5-4.5-5.5-7.5Z' "
  + `fill='${fill}' stroke='${line}' stroke-width='1.3' stroke-linejoin='round'/>`
  + "<path d='M13 26h6l-3-3.5Z M13.2 9h5.6c-.8 1.5-1.8 2.4-2.8 3.4-1-1-2-1.9-2.8-3.4Z' fill='#c56c96'/>";
const RING = () => "<circle cx='16' cy='16' r='10' fill='none' stroke='#fff' stroke-width='5'/>"
  + "<circle cx='16' cy='16' r='10' fill='none' stroke='#9fd2ff' stroke-width='3.4'/>"
  + "<path d='M16 6a10 10 0 0 1 10 10' fill='none' stroke='#2b6fc2' stroke-width='3.4' stroke-linecap='round'/>";

// 손 세 개와 직접 그리기용 화살표는 그 시절 커서처럼 1px 픽셀 그림이다. '1' 테두리, '0' 속, '.' 투명.
const MAPS = {
  arrow: { x: 2, y: 2, rows: [
    '1...........',
    '11..........',
    '101.........',
    '1001........',
    '10001.......',
    '100001......',
    '1000001.....',
    '10000001....',
    '100000001...',
    '1000000001..',
    '10000011111.',
    '1001001.....',
    '101.1001....',
    '11..1001....',
    '1....1001...',
    '.....1001...',
    '......1001..',
    '......1001..',
    '.......11...',
  ] },
  hand: { x: 4, y: 2, rows: [
    '.....11..........',
    '....1001.........',
    '....1001.........',
    '....1001.........',
    '....1001.........',
    '....1001.........',
    '....1001.........',
    '....100111.......',
    '....100100111....',
    '....100100100111.',
    '.11.1001001001001',
    '10011001001001001',
    '10000000000000001',
    '.1000000000000001',
    '.1000000000000001',
    '..100000000000001',
    '..100000000000001',
    '...10000000000001',
    '...10000000000001',
    '....100000000001.',
    '....100000000001.',
    '....100000000001.',
    '....111111111111.',
  ] },
  grab: { x: 4, y: 2, rows: [
    '........11.......',
    '.....11100111....',
    '....1001001001...',
    '....1001001001...',
    '....100100100111.',
    '....1001001001001',
    '....1001001001001',
    '....1001001001001',
    '....1001001001001',
    '....1001001001001',
    '.11.1001001001001',
    '10011001001001001',
    '10011001001001001',
    '10000000000000001',
    '.1000000000000001',
    '.1000000000000001',
    '..100000000000001',
    '..100000000000001',
    '...10000000000001',
    '...1000000000001.',
    '....100000000001.',
    '....100000000001.',
    '....111111111111.',
  ] },
  grabbing: { x: 4, y: 6, rows: [
    '.....11.11.11.11.',
    '....1001001001001',
    '....1001001001001',
    '....1001001001001',
    '..110000000000001',
    '.1000000000000001',
    '.1000000000000001',
    '.1000111110000001',
    '.1000000000000001',
    '..100000000000001',
    '..100000000000001',
    '...10000000000001',
    '...10000000000001',
    '....100000000001.',
    '....100000000001.',
    '....100000000001.',
    '....111111111111.',
  ] },
};
const HOT = { arrow: [2, 2], hand: [10, 2], grab: [12, 13], grabbing: [12, 14], wait: [16, 16] };
const FALLBACK = { arrow: 'default', hand: 'pointer', grab: 'grab', grabbing: 'grabbing', wait: 'wait' };
export const KEYS = Object.keys(FALLBACK);

// 픽셀 지도(rows, 왼쪽 위 자리) → 32×32칸 글자 1024개
export function defaultPixels(key) {
  const m = MAPS[key];
  const cells = Array(SIZE * SIZE).fill('.');
  m.rows.forEach((row, y) => [...row].forEach((c, x) => { cells[(m.y + y) * SIZE + m.x + x] = c; }));
  return { px: cells.join(''), hot: HOT[key] };
}

// 글자 1024개 → SVG 조각. 같은 색이 이어진 칸은 한 줄의 사각형으로 묶는다.
function pixelSVG(px, line, fill) {
  const runs = { 1: '', 0: '' };
  for (let y = 0; y < SIZE; y++) {
    let x = 0;
    while (x < SIZE) {
      const c = px[y * SIZE + x];
      let end = x + 1;
      while (end < SIZE && px[y * SIZE + end] === c) end++;
      if (c === '1' || c === '0') runs[c] += `M${x} ${y}h${end - x}v1h${x - end}Z`;
      x = end;
    }
  }
  // 픽셀 그림만 또렷하게(crispEdges) 그린다. 매끈한 화살표와 모래시계는 그대로 부드럽게 둔다.
  return `<path d='${runs[0]}' fill='${fill}' shape-rendering='crispEdges'/><path d='${runs[1]}' fill='${line}' shape-rendering='crispEdges'/>`;
}

const url = (body, size) => {
  const px = Math.round(SIZE * size);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${px}' height='${px}' viewBox='0 0 ${SIZE} ${SIZE}'>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

// 커서 한 개의 그림(SVG 조각)과 클릭 위치
function shape(key, era, prefs) {
  const line = prefs.line || ERA_LINE[era] || '#000000';
  const fill = prefs.fill || '#ffffff';
  const custom = prefs.custom?.[key];
  if (custom?.px?.length === SIZE * SIZE) return { body: pixelSVG(custom.px, line, fill), hot: custom.hot || [0, 0] };
  if (key === 'arrow') return { body: (ARROWS[era] || ARROWS[1998])(line, fill), hot: HOT.arrow };
  if (key === 'wait') return { body: era === '2010' ? RING() : HOURGLASS(line, fill), hot: HOT.wait };
  return { body: pixelSVG(defaultPixels(key).px, line, fill), hot: HOT[key] };
}

// 미리보기용 그림 주소(url(...)) 하나
export function cursorImage(key, era, prefs = {}) {
  return url(shape(key, era, prefs).body, 1);
}

// CSS cursor 값 묶음 { arrow: 'url(...) 2 2, default', ... }
export function cursorSet(era, prefs = {}) {
  const size = prefs.size === 1.5 ? 1.5 : 1;
  const set = {};
  for (const key of KEYS) {
    const { body, hot } = shape(key, era, prefs);
    set[key] = `${url(body, size)} ${Math.round(hot[0] * size)} ${Math.round(hot[1] * size)}, ${FALLBACK[key]}`;
  }
  return set;
}

// 지금 설정대로 커서를 만들어 body에 넣고, 시대나 커서 설정이 바뀌면 다시 넣는다.
export function initCursors(settings) {
  const apply = () => {
    const set = cursorSet(settings.get('era'), settings.get('cursor') || {});
    for (const key of KEYS) document.body.style.setProperty(`--cur-${key}`, set[key]);
  };
  apply();
  settings.subscribe(patch => { if ('era' in patch || 'cursor' in patch) apply(); });
}
