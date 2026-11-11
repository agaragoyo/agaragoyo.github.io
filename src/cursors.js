// 화면 안 커서. 그림을 여기서 만들어 CSS 변수(--cur-arrow, --cur-hand, --cur-grab, --cur-grabbing, --cur-wait)로 넣는다.
// style.css는 이 변수만 쓰고(cursor: var(--cur-hand)), 미니게임 창에는 sdk-host.js가 같은 값을 나눠 준다.
// 그림은 모두 직접 그렸다(실제 운영체제 커서 그림은 쓰지 않는다). 2005년식 모양 한 벌만 쓴다.
// 마우스 앱에서 커서 색과 크기를 고르고 직접 그리던 기능은 2026-11-10에 뺐다(알파 테스트 피드백).

const SIZE = 32; // 커서 그림 한 장의 칸 수(가로 = 세로)
const LINE = '#000000'; // 테두리 색
const FILL = '#ffffff'; // 속 색

// ---------- 그림 ----------
// 화살표: 오른쪽 아래로 옅은 그림자를 둔다.
const ARROW = 'M2 2 L2 23 L7.5 18 L11 26.5 L14.5 25 L11 16.5 L18 16.5 Z';
const arrowSVG = () => `<path d='${ARROW}' fill='#000' opacity='.28' transform='translate(1.6 1.6)'/>`
  + `<path d='${ARROW}' fill='${FILL}' stroke='${LINE}' stroke-width='1.4' stroke-linejoin='round'/>`;

// 기다림: 모래시계
const hourglassSVG = () => `<path d='M9 4h14M9 28h14' stroke='${LINE}' stroke-width='2.4' stroke-linecap='round'/>`
  + "<path d='M10.5 5h11v3.5c0 3-3.6 5.5-5.5 7.5 1.9 2 5.5 4.5 5.5 7.5V27h-11v-3.5c0-3 3.6-5.5 5.5-7.5-1.9-2-5.5-4.5-5.5-7.5Z' "
  + `fill='${FILL}' stroke='${LINE}' stroke-width='1.3' stroke-linejoin='round'/>`
  + "<path d='M13 26h6l-3-3.5Z M13.2 9h5.6c-.8 1.5-1.8 2.4-2.8 3.4-1-1-2-1.9-2.8-3.4Z' fill='#c56c96'/>";

// 손 세 개는 그 시절 커서처럼 1px 픽셀 그림이다. '1' 테두리, '0' 속, '.' 투명.
const MAPS = {
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

// 픽셀 지도(rows, 그림이 놓이는 왼쪽 위 자리 x, y) → SVG 조각. 한 줄에서 같은 색이 이어진 칸은 사각형 하나로 묶는다.
function pixelSVG({ x: left, y: top, rows }) {
  const runs = { 1: '', 0: '' };
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === c) end++;
      if (c === '1' || c === '0') runs[c] += `M${left + x} ${top + y}h${end - x}v1h${x - end}Z`;
      x = end;
    }
  });
  // 픽셀 그림만 또렷하게(crispEdges) 그린다. 매끈한 화살표와 모래시계는 그대로 부드럽게 둔다.
  return `<path d='${runs[0]}' fill='${FILL}' shape-rendering='crispEdges'/><path d='${runs[1]}' fill='${LINE}' shape-rendering='crispEdges'/>`;
}

const url = body => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${SIZE}' height='${SIZE}' viewBox='0 0 ${SIZE} ${SIZE}'>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

// 커서 한 개의 그림(SVG 조각)
function shape(key) {
  if (key === 'arrow') return arrowSVG();
  if (key === 'wait') return hourglassSVG();
  return pixelSVG(MAPS[key]);
}

// CSS cursor 값 묶음 { arrow: 'url(...) 2 2, default', ... }. 숫자 둘은 클릭 위치(HOT)다
export function cursorSet() {
  const set = {};
  for (const key of Object.keys(FALLBACK)) set[key] = `${url(shape(key))} ${HOT[key][0]} ${HOT[key][1]}, ${FALLBACK[key]}`;
  return set;
}

// 커서를 만들어 body의 CSS 변수로 넣는다.
export function initCursors() {
  const set = cursorSet();
  for (const key in set) document.body.style.setProperty(`--cur-${key}`, set[key]);
}
