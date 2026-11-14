// 아이소메트릭 투영과 그리기. 바닥 칸 좌표 (x, y)와 벽 좌표 (벽, u, v)를 무대 px로 바꾼다.
//   바닥: x는 뒤 꼭짓점에서 오른쪽 아래로, y는 왼쪽 아래로 늘어난다.
//   벽:   'R'은 x축을 따라 선 오른쪽 벽, 'L'은 y축을 따라 선 왼쪽 벽이다.
//         u는 두 벽이 만나는 모서리에서 벽을 따라간 칸, v는 바닥에서 올라간 줄이다.
import { N, TW, TH, WALL_ROWS, WH, ORIGIN as O, SCENES } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { dims } from './rules.js';
import { neighborGates } from './neighbors.js';
import { batchim } from './util.js';
import { WALL_PATTERNS } from '../data/wall-patterns.js';

const SKEW = (Math.atan(TH / TW) * 180) / Math.PI; // 벽의 기울기 (2:1이면 26.565도)

export const tile = (x, y) => ({ x: O.x + ((x - y) * TW) / 2, y: O.y + ((x + y) * TH) / 2 });

// 무대 px → 바닥 칸 (소수). elev: 그 점이 바닥에서 떠 있는 높이(px). 책상 윗면을 가리킬 때 쓴다.
export function toTile(px, py, elev = 0) {
  const a = (px - O.x) / (TW / 2);
  const b = (py + elev - O.y) / (TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

export function wallPoint(wall, u, v) {
  const p = wall === 'R' ? tile(u, 0) : tile(0, u);
  return { x: p.x, y: p.y - v * WH };
}

// 무대 px → 벽 좌표 (소수). 뒤 꼭짓점 오른쪽이면 오른쪽 벽이다.
export function fromWall(px, py) {
  const wall = px >= O.x ? 'R' : 'L';
  const u = Math.abs(px - O.x) / (TW / 2);
  return { wall, u, v: (O.y + (u * TH) / 2 - py) / WH };
}

// 가구 그림 한 장이 차지하는 상자 크기 (px). 아트 팀이 PNG를 그릴 때도 이 크기를 쓴다.
// r: 돌려 놓았으면 1 (가로와 세로 칸 수가 바뀐다)
export function boxSize(def, r = 0) {
  if (def.zone === 'wall') return { w: (def.size[0] * TW) / 2, h: def.size[1] * WH };
  const [w, d] = r ? [def.size[1], def.size[0]] : def.size;
  return { w: ((w + d) * TW) / 2, h: ((w + d) * TH) / 2 + def.height };
}

// 바닥 쪽 가구가 그려지는 순서. 앞(화면 아래)에 있을수록 크다.
export const depthOf = item => {
  const [w, d] = dims(item);
  return item.x + w / 2 + item.y + d / 2;
};

// 가구 한 개가 놓이는 자리: 가구 상자의 왼쪽 위(무대 px)와, 벽 가구를 벽에 눕히는 기울기(skewY 도, 바닥 가구는 0).
// elev: 책상 위에 올라가 있으면 책상 높이. 방 그림을 파일로 만들 때(room-image.js)도 이 값으로 그린다.
export function placementOf(item, elev = 0) {
  const def = BY_ID[item.id];
  if (def.zone === 'wall') {
    const [w, h] = def.size;
    const left = item.wall === 'R' ? item.x : item.x + w; // 화면에서 왼쪽 끝이 되는 쪽
    const p = wallPoint(item.wall, left, item.y + h);
    return { left: p.x, top: p.y, skew: item.wall === 'R' ? SKEW : -SKEW };
  }
  const p = tile(item.x, item.y);
  return { left: p.x - (dims(item)[1] * TW) / 2, top: p.y - def.height - elev, skew: 0 };
}

// el(가구 그림)을 방 안 제자리에 놓는다. elev: 책상 위에 올라가 있으면 책상 높이.
export function placeEl(el, item, elev = 0) {
  const { left, top, skew } = placementOf(item, elev);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  el.style.transform = skew ? `skewY(${skew}deg)` : '';
}

const pts = list => list.map(p => `${p.x},${p.y}`).join(' ');
const mix = (c, other, pct) => `color-mix(in srgb, ${c} ${pct}%, ${other})`;

// 그림이 없는 동안 쓰는 임시 모양: 바닥 가구는 입체 상자, 벽 가구는 액자.
export function placeholderSVG(def, r = 0) {
  const { w: bw, h: bh } = boxSize(def, r);
  const c = def.color;
  const label = `<text x="${bw / 2}" y="__Y__" class="furn-label">${def.name}</text>`;
  if (def.zone === 'wall') {
    return `<svg width="${bw}" height="${bh}" viewBox="0 0 ${bw} ${bh}">
      <rect class="hit" x="1" y="1" width="${bw - 2}" height="${bh - 2}" rx="3"
        style="fill:${mix(c, 'black', 55)}; stroke:#0005; stroke-width:2" />
      <rect x="8" y="8" width="${bw - 16}" height="${bh - 16}" style="fill:${c}" />
      ${label.replace('__Y__', bh / 2 + 5)}
    </svg>`;
  }
  const [w, d] = r ? [def.size[1], def.size[0]] : def.size;
  const H = def.height;
  const dx = (d * TW) / 2;
  const back = { x: dx, y: 0 };
  const right = { x: dx + (w * TW) / 2, y: (w * TH) / 2 };
  const front = { x: dx + ((w - d) * TW) / 2, y: ((w + d) * TH) / 2 };
  const left = { x: 0, y: (d * TH) / 2 };
  const down = p => ({ x: p.x, y: p.y + H });
  const labelY = H >= 40 ? front.y + H / 2 + 5 : (back.y + front.y) / 2 + 5;
  return `<svg width="${bw}" height="${bh}" viewBox="0 0 ${bw} ${bh}">
    <g class="hit" style="stroke:#0006; stroke-width:1.5; stroke-linejoin:round">
      <polygon points="${pts([left, front, down(front), down(left)])}" style="fill:${c}" />
      <polygon points="${pts([front, right, down(right), down(front)])}" style="fill:${mix(c, 'black', 72)}" />
      <polygon points="${pts([back, right, front, left])}" style="fill:${mix(c, 'white', 70)}" />
    </g>
    ${label.replace('__Y__', labelY).replace(`x="${bw / 2}"`, `x="${front.x}"`)}
  </svg>`;
}

// 불빛이 퍼져 나오는 점 (무대 px). 가구 그림 윗면의 가운데다.
export function lightPoint(item, elev = 0) {
  const def = BY_ID[item.id];
  const p = tile(item.x, item.y);
  const left = p.x - (dims(item)[1] * TW) / 2;
  const top = p.y - def.height - elev;
  return { x: left + boxSize(def, item.r).w / 2, y: top + TH / 2 };
}

// 공간 배경. scene: config.js의 SCENES 한 줄. kind가 'outdoor'면 울타리, 땅, 뒤쪽 아파트와 울타리 문(gate, 이웃집 문)을,
// 'indoor'면 벽과 바닥과 현관문(door)을 그린다. owner: 그 공간이 있는 집의 주인 이름(그 집의 이웃집 문패는 달지 않는다).
// decor: 그 집의 방 꾸밈(src/share.js의 sanitizeHome). 지금은 벽지(decor.wall)만 있고, 없으면 기본 벽이다.
export function sceneSVG(scene, owner = '', decor = null) {
  return scene.kind === 'outdoor' ? outdoorSVG(scene.gate, scene.neighbors ? neighborGates(owner) : []) : roomSVG(scene.door, decor?.wall);
}

const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

// 문패 글자: 문 폭(width px)에 들어가게 12px에서 9px까지 줄이고, 그래도 넘치면 뒤를 줄임표로 줄인다.
// 글꼴(갈무리)에서 한글과 한자는 글자 크기만큼, 나머지는 그 0.6배쯤 차지한다고 셈한다.
function fitLabel(text, width) {
  const unit = ch => (/[ᄀ-ᇿ㄰-㆏㐀-鿿가-힯＀-￯]/.test(ch) ? 1 : 0.6);
  const chars = Array.from(text);
  const size = Math.min(12, Math.floor(width / chars.reduce((n, ch) => n + unit(ch), 0)));
  if (size >= 9) return { text, size };
  let out = '';
  let used = 1; // 줄임표 자리
  for (const ch of chars) {
    if ((used + unit(ch)) * 9 > width) break;
    out += ch;
    used += unit(ch);
  }
  return { text: `${out}…`, size: 9 };
}

// 바깥 공간: 잔디 바닥, 낮은 울타리, 뒤로 보이는 아파트. 울타리에는 문을 낸다.
//   gate: 오른쪽 뒤 울타리(y = 0 줄)의 아파트 문. 이 컴퓨터의 방으로 돌아가는 문이다
//   neighbors: 왼쪽 울타리(x = 0 줄)의 이웃집 문(src/neighbors.js의 neighborGates). 문마다 닉네임을 쓴 문패를 단다
function outdoorSVG(gate, neighbors = []) {
  const SLAB = 16;
  const below = p => ({ x: p.x, y: p.y + SLAB });
  const ground = [];
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      const fill = (x + y) % 2 ? 'var(--grass-a)' : 'var(--grass-b)';
      ground.push(`<polygon points="${pts([tile(x, y), tile(x + 1, y), tile(x + 1, y + 1), tile(x, y + 1)])}" style="fill:${fill}" />`);
    }
  }
  const gridLines = [];
  for (let i = 0; i <= N; i++) {
    gridLines.push(`<polyline points="${pts([tile(i, 0), tile(i, N)])}" />`, `<polyline points="${pts([tile(0, i), tile(N, i)])}" />`);
  }
  // 아파트 세 동: 화면 기준 사각형과 창문 무늬
  const blocks = [[150, 70, 280, 300], [470, 30, 340, 300], [860, 80, 270, 290]]
    .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" style="fill:var(--apt)" />
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#apt-windows)" />
      <rect x="${x}" y="${y - 10}" width="${w}" height="10" style="fill:var(--apt-roof)" />`).join('');
  // 울타리의 문: 오른쪽 울타리의 아파트 문(.gate-*)과 왼쪽 울타리의 이웃집 문(.neighbor-*). wall 'R'은 y = 0 줄, 'L'은 x = 0 줄이다.
  const doors = [
    ...(gate ? [{ wall: 'R', x: gate.x, w: gate.w, cls: 'gate', text: '아파트', size: 12, title: '두 번 눌러 집으로 돌아가기' }] : []),
    ...neighbors.map(n => ({
      wall: 'L', x: n.x, w: n.w, cls: 'neighbor', id: n.id,
      ...fitLabel(n.name, (n.w * TW) / 2 - 8), title: `두 번 눌러 ${n.name}의 집에 놀러 가기`,
    })),
  ];
  // 울타리: 뒤쪽 두 변을 따라 기둥과 가로대. 문 자리는 비운다.
  const H = 34;
  const up = (p, h) => ({ x: p.x, y: p.y - h });
  const post = (p, h, cls = '') => `<line${cls && ` class="${cls}"`} x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y - h}" />`;
  const at = (wall, i) => (wall === 'R' ? tile(i, 0) : tile(0, i));
  const isOpen = (wall, i) => doors.some(d => d.wall === wall && i >= d.x && i <= d.x + d.w);
  const fence = [];
  for (let i = 0; i <= N; i += 0.5) {
    for (const wall of ['R', 'L']) if (!isOpen(wall, i)) fence.push(post(at(wall, i), H));
  }
  // 가로대: 한 변에서 문 사이사이의 막힌 구간 [a, b]마다 긋는다. 두 변의 첫 구간이 뒤 모서리(0)에서 시작하면 모서리를 지나는 한 줄로 잇는다.
  const spans = wall => {
    const out = [];
    let from = 0;
    for (const d of doors.filter(o => o.wall === wall).sort((p, q) => p.x - q.x)) {
      if (d.x > from) out.push([from, d.x]);
      from = Math.max(from, d.x + d.w);
    }
    if (from < N) out.push([from, N]);
    return out;
  };
  const rail = h => {
    const L = spans('L');
    const R = spans('R');
    const join = L[0]?.[0] === 0 && R[0]?.[0] === 0;
    const lines = join ? [[up(at('L', L[0][1]), h), up(tile(0, 0), h), up(at('R', R[0][1]), h)]] : [];
    for (const [a, b] of join ? L.slice(1) : L) lines.push([up(at('L', a), h), up(at('L', b), h)]);
    for (const [a, b] of join ? R.slice(1) : R) lines.push([up(at('R', a), h), up(at('R', b), h)]);
    return lines.map(p => `<polyline points="${pts(p)}" />`).join('');
  };
  // 문: 양쪽 높은 기둥과 팻말. 팻말 글자는 울타리 비탈(가로 2 : 세로 1, 26.57도)을 따라 기울인다(왼쪽 울타리는 반대쪽으로).
  // .gate-hit와 .neighbor-hit는 문 자리 전체를 덮는 투명한 판이다. 바탕화면에서 두 번 누르면 아바타가 걸어가
  // 아파트 문은 이 컴퓨터의 방으로 돌아가고, 이웃집 문은 그 집에 놀러 갈지 묻는다(room.js의 renderStatic).
  const G = 60; // 문 기둥 높이(px)
  const S = 18; // 팻말 높이(px)
  const doorSVG = doors.map(d => {
    const a = at(d.wall, d.x);
    const b = at(d.wall, d.x + d.w);
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - G + S / 2 };
    fence.push(post(a, G, 'gate-post'), post(b, G, 'gate-post'));
    const size = d.size === 12 ? '' : ` style="font-size:${d.size}px"`;
    const data = d.id ? ` data-neighbor="${esc(d.id)}"` : '';
    return `<polygon class="${d.cls}-sign" points="${pts([up(a, G), up(b, G), up(b, G - S), up(a, G - S)])}" />
    <text class="${d.cls}-text"${size} transform="translate(${c.x} ${c.y}) skewY(${d.wall === 'R' ? 26.57 : -26.57})" text-anchor="middle" dominant-baseline="central">${esc(d.text)}</text>
    <polygon class="${d.cls}-hit"${data} points="${pts([a, b, up(b, G), up(a, G)])}"><title>${esc(d.title)}</title></polygon>`;
  }).join('');
  return `<svg class="room-bg" width="1280" height="720" viewBox="0 0 1280 720">
    <defs>
      <pattern id="apt-windows" width="34" height="30" patternUnits="userSpaceOnUse">
        <rect x="8" y="9" width="18" height="12" style="fill:var(--apt-window)" />
      </pattern>
    </defs>
    ${blocks}
    <polygon points="${pts([tile(0, N), tile(N, N), below(tile(N, N)), below(tile(0, N))])}" style="fill:var(--dirt-a)" />
    <polygon points="${pts([tile(N, N), tile(N, 0), below(tile(N, 0)), below(tile(N, N))])}" style="fill:var(--dirt-b)" />
    ${ground.join('')}
    <g class="fence">${fence.join('')}${rail(12)}${rail(28)}</g>
    <g class="grid">${gridLines.join('')}</g>
    ${doorSVG}
  </svg>`;
}

// 현관문: 벽에 붙은 문틀과 문짝, 위아래 두 칸 무늬, 손잡이. 가구가 아니라 방 그림의 일부라 늘 같은 자리에 있다(config.js의 SCENES door).
// .door-hit는 문 전체를 덮는 투명한 판이다. 바탕화면에서 두 번 누르면 아바타가 걸어가 바깥 공간으로 나간다(room.js의 renderStatic).
function doorSVG(door) {
  const { wall, x: u, w, h } = door;
  const q = (du, v) => wallPoint(wall, u + du, v);
  const quad = (u0, u1, v0, v1) => pts([q(u0, v0), q(u1, v0), q(u1, v1), q(u0, v1)]);
  const F = 0.16; // 문틀 두께(칸)
  const knob = q(w - F - 0.3, h * 0.45);
  const to = SCENES.find(s => s.id === door.to)?.name || '밖';
  return `<polygon class="door-frame" points="${quad(0, w, 0, h)}" />
    <polygon class="door-leaf" points="${quad(F, w - F, 0, h - F)}" />
    <polygon class="door-panel" points="${quad(F + 0.25, w - F - 0.25, h * 0.55, h - F - 0.3)}" />
    <polygon class="door-panel" points="${quad(F + 0.25, w - F - 0.25, 0.3, h * 0.45 - 0.25)}" />
    <circle class="door-knob" cx="${knob.x}" cy="${knob.y}" r="3.5" />
    <polygon class="door-hit" points="${quad(0, w, 0, h)}"><title>두 번 눌러 ${esc(to)}${batchim(to) ? '으로' : '로'} 나가기</title></polygon>`;
}

// ---------- 벽지 (data/wall-patterns.js) ----------
const WALL_PX = 3; // 벽지 그림 한 칸의 무대 px

// 벽지 그림 한 장을 SVG 조각으로. 같은 색 칸이 가로로 이어지면 한 조각으로 묶는다(src/icons.js의 pixelSvg와 같은 방식).
function tileMarkup(p) {
  const paths = {};
  p.rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      let n = 1;
      while (row[x + n] === row[x]) n++;
      if (row[x] !== '.') (paths[row[x]] ??= []).push(`M${x} ${y}h${n}v1h-${n}z`);
      x += n;
    }
  });
  return `<rect width="${p.rows[0].length}" height="${p.rows.length}" fill="${p.bg}" />`
    + Object.entries(paths).map(([c, d]) => `<path fill="${p.colors[c]}" d="${d.join('')}" />`).join('');
}

// 방 그림 한 장에 넣을 벽지 무늬 두 개(왼쪽 벽, 오른쪽 벽). 무늬를 벽의 기울기만큼 비틀어 두 벽이 만나는 윗모서리 top에서 시작한다.
// 한 문서에 방 그림이 여럿(바탕화면, 방 꾸미기 창, 내려받는 그림을 만드는 동안) 들어가므로 무늬 id는 그릴 때마다 새로 붙인다.
// 같은 id를 여러 그림이 나눠 쓰면 앞의 그림이 지워지거나 숨을 때 뒤의 그림의 무늬까지 사라진다.
let paintSeq = 0;
function wallPaint(p, top) {
  const id = `wall-paint-${++paintSeq}`;
  const w = p.rows[0].length;
  const h = p.rows.length;
  const art = tileMarkup(p);
  const one = (wall, k) => `<pattern id="${id}-${wall}" patternUnits="userSpaceOnUse" width="${w * WALL_PX}" height="${h * WALL_PX}"
    viewBox="0 0 ${w} ${h}" patternTransform="translate(${top.x} ${top.y}) skewY(${k * SKEW})">${art}</pattern>`;
  return { defs: `<defs>${one('L', -1)}${one('R', 1)}</defs>`, L: `url(#${id}-L)`, R: `url(#${id}-R)` };
}

// 벽지를 고르는 단추에 넣을 작은 그림. 무늬의 왼쪽 위 12×12칸을 비틀지 않고 보여 준다.
// 기본 벽은 style.css의 --wall-l 색에 반 칸마다 세로줄이다(단추는 방 상자 밖이라 변수 대신 같은 색을 적었다).
export function wallSwatchSVG(id) {
  const p = WALL_PATTERNS.find(w => w.id === id);
  const art = p?.rows
    ? tileMarkup(p)
    : '<rect width="12" height="12" fill="#f2e6cb" /><path d="M3 0v12M9 0v12" stroke="#0000001f" stroke-width="0.6" />';
  return `<svg viewBox="0 0 12 12" aria-hidden="true">${art}</svg>`;
}

// 방의 벽과 바닥 (가구를 놓아도 바뀌지 않는 배경). door가 있으면 벽에 현관문을 그린다.
// wall: 벽지 id(data/wall-patterns.js). 비었거나 모르는 id면 기본 벽이다.
export function roomSVG(door, wall = 'plain') {
  const up = WALL_ROWS * WH;
  const raise = p => ({ x: p.x, y: p.y - up });
  const T = 0.18; // 벽 두께 (칸)
  const SLAB = 16; // 바닥판 두께 (px)
  const below = p => ({ x: p.x, y: p.y + SLAB });

  const floorTiles = [];
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      const fill = (x + y) % 2 ? 'var(--floor-a)' : 'var(--floor-b)';
      floorTiles.push(`<polygon points="${pts([tile(x, y), tile(x + 1, y), tile(x + 1, y + 1), tile(x, y + 1)])}" style="fill:${fill}" />`);
    }
  }

  const gridLines = [];
  for (let i = 0; i <= N; i++) {
    gridLines.push(`<polyline points="${pts([tile(i, 0), tile(i, N)])}" />`, `<polyline points="${pts([tile(0, i), tile(N, i)])}" />`);
    gridLines.push(`<polyline points="${pts([wallPoint('R', i, 0), wallPoint('R', i, WALL_ROWS)])}" />`);
    gridLines.push(`<polyline points="${pts([wallPoint('L', i, 0), wallPoint('L', i, WALL_ROWS)])}" />`);
  }
  for (let v = 1; v <= WALL_ROWS; v++) {
    gridLines.push(`<polyline points="${pts([wallPoint('L', N, v), wallPoint('L', 0, v), wallPoint('R', N, v)])}" />`);
  }

  const corner = tile(0, 0);
  const capCorner = raise(tile(-T, -T));
  const wallL = pts([corner, tile(0, N), raise(tile(0, N)), raise(corner)]);
  const wallR = pts([corner, tile(N, 0), raise(tile(N, 0)), raise(corner)]);
  const pattern = WALL_PATTERNS.find(w => w.id === wall && w.rows);
  let walls;
  if (pattern) {
    // 무늬 아래에 바탕색을 한 번 더 깔아 무늬 조각 사이로 틈이 비치지 않게 하고, 오른쪽 벽은 기본 벽처럼 조금 어둡게 덮는다
    const paint = wallPaint(pattern, raise(corner));
    walls = `${paint.defs}
    <polygon points="${wallL}" style="fill:${pattern.bg}" />
    <polygon points="${wallL}" style="fill:${paint.L}" />
    <polygon points="${wallR}" style="fill:${pattern.bg}" />
    <polygon points="${wallR}" style="fill:${paint.R}" />
    <polygon points="${wallR}" style="fill:#5c3d14;fill-opacity:0.1" />`;
  } else {
    // 기본 벽: 세로 줄무늬 (반 칸마다)
    const stripes = [];
    for (let i = 0.5; i < N; i += 0.5) {
      stripes.push(`<polyline points="${pts([wallPoint('R', i, 0), wallPoint('R', i, WALL_ROWS)])}" />`);
      stripes.push(`<polyline points="${pts([wallPoint('L', i, 0), wallPoint('L', i, WALL_ROWS)])}" />`);
    }
    walls = `<polygon points="${wallL}" style="fill:var(--wall-l)" />
    <polygon points="${wallR}" style="fill:var(--wall-r)" />
    <g class="stripes">${stripes.join('')}</g>`;
  }

  return `<svg class="room-bg" width="1280" height="720" viewBox="0 0 1280 720">
    <polygon points="${pts([tile(0, N), tile(N, N), below(tile(N, N)), below(tile(0, N))])}" style="fill:var(--slab-a)" />
    <polygon points="${pts([tile(N, N), tile(N, 0), below(tile(N, 0)), below(tile(N, N))])}" style="fill:var(--slab-b)" />
    ${floorTiles.join('')}
    ${walls}
    <polygon points="${pts([corner, tile(0, N), wallPoint('L', N, 0.35), wallPoint('L', 0, 0.35)])}" style="fill:var(--baseboard)" />
    <polygon points="${pts([corner, tile(N, 0), wallPoint('R', N, 0.35), wallPoint('R', 0, 0.35)])}" style="fill:var(--baseboard-dark)" />
    <polygon points="${pts([tile(0, N), raise(tile(0, N)), raise(tile(-T, N)), tile(-T, N)])}" style="fill:var(--wall-edge)" />
    <polygon points="${pts([tile(N, 0), raise(tile(N, 0)), raise(tile(N, -T)), tile(N, -T)])}" style="fill:var(--wall-edge)" />
    <polygon points="${pts([raise(corner), raise(tile(0, N)), raise(tile(-T, N)), capCorner])}" style="fill:var(--wall-cap)" />
    <polygon points="${pts([raise(corner), raise(tile(N, 0)), raise(tile(N, -T)), capCorner])}" style="fill:var(--wall-cap)" />
    ${door ? doorSVG(door) : ''}
    <g class="grid">${gridLines.join('')}</g>
  </svg>`;
}
