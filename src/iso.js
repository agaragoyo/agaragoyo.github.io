// 아이소메트릭 투영과 그리기. 바닥 칸 좌표 (x, y)와 벽 좌표 (벽, u, v)를 무대 px로 바꾼다.
//   바닥: x는 뒤 꼭짓점에서 오른쪽 아래로, y는 왼쪽 아래로 늘어난다.
//   벽:   'R'은 x축을 따라 선 오른쪽 벽, 'L'은 y축을 따라 선 왼쪽 벽이다.
//         u는 두 벽이 만나는 모서리에서 벽을 따라간 칸, v는 바닥에서 올라간 줄이다.
import { N, TW, TH, WALL_ROWS, WH, ORIGIN as O } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { dims, drawnAt } from './rules.js';
import { WALL_PATTERNS } from '../data/wall-patterns.js';
import { FLOOR_PATTERNS } from '../data/floor-patterns.js';
import { DOOR } from '../data/door.js';

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
// r: 돌려 놓았으면 1 (가로와 세로 칸 수가 바뀐다). 칸보다 넓은 그림(data/furniture.js의 bleed)은 상자를 좌우로 그만큼 넓힌다
export function boxSize(def, r = 0) {
  if (def.zone === 'wall') return { w: (def.size[0] * TW) / 2, h: def.size[1] * WH };
  const [w, d] = r ? [def.size[1], def.size[0]] : def.size;
  return { w: ((w + d) * TW) / 2 + 2 * (def.bleed || 0), h: ((w + d) * TH) / 2 + def.height };
}

// 바닥 쪽 가구가 그려지는 순서. 앞(화면 아래)에 있을수록 크다.
export const depthOf = item => {
  const [w, d] = dims(item);
  return item.x + w / 2 + item.y + d / 2;
};

// 가구 한 개가 놓이는 자리: 가구 상자의 왼쪽 위(무대 px)와, 벽 가구를 벽에 눕히는 기울기(skewY 도, 바닥 가구는 0).
// items: 같은 방의 가구들. 책상 위의 물건은 책상 윗면으로 올려 그린다(rules.js의 drawnAt). 방 그림을 파일로 만들 때(room-image.js)도 이 값으로 그린다.
export function placementOf(items, item) {
  const def = BY_ID[item.id];
  if (def.zone === 'wall') {
    const [w, h] = def.size;
    const left = item.wall === 'R' ? item.x : item.x + w; // 화면에서 왼쪽 끝이 되는 쪽
    const p = wallPoint(item.wall, left, item.y + h);
    return { left: p.x, top: p.y, skew: item.wall === 'R' ? SKEW : -SKEW };
  }
  const at = drawnAt(items, item);
  const p = tile(at.x, at.y);
  // 윗면에 모은 물건의 자리는 소수로 떨어진다. 그림의 한 점(무대 2px)에 맞춰 다른 가구와 점의 줄을 맞춘다
  const snap = at.elev ? v => Math.round(v / 2) * 2 : v => v;
  return { left: snap(p.x - (dims(item)[1] * TW) / 2 - (def.bleed || 0)), top: snap(p.y - def.height - at.elev), skew: 0 };
}

// el(가구 그림)을 방 안 제자리에 놓는다. items: 같은 방의 가구들
export function placeEl(el, items, item) {
  const { left, top, skew } = placementOf(items, item);
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
export function lightPoint(items, item) {
  const { left, top } = placementOf(items, item);
  return { x: left + boxSize(BY_ID[item.id], item.r).w / 2, y: top + TH / 2 };
}

// 공간 배경: 벽과 바닥과 현관문(door). scene: config.js의 SCENES 한 줄.
// decor: 그 집의 방 꾸밈(src/share.js의 sanitizeHome). 벽지(decor.wall)와 바닥(decor.floor)이고, 없으면 기본 벽과 기본 바닥이다.
export function sceneSVG(scene, decor = null) {
  return roomSVG(scene.door, decor?.wall, decor?.floor);
}

// 현관문: 정면에서 본 픽셀 그림(data/door.js)을 벽의 기울기(2:1)대로 두 점마다 한 점씩 어긋나게 세워 그린다.
// 벽지처럼 비틀면(skew) 점이 찌그러지므로, 가구 그림처럼 네모난 점을 계단으로 쌓는다. 가구가 아니라 방 그림의 일부라 늘 같은 자리에 있다(config.js의 SCENES door).
// .door-hit는 문 전체를 덮는 투명한 판이다. 바탕화면에서 두 번 누르면 아바타가 걸어간 뒤 이웃집 목록 창이 뜬다(room.js의 renderStatic).
function doorSVG(door) {
  const { wall, x: u, w, h } = door;
  const q = (du, v) => wallPoint(wall, u + du, v);
  const quad = (u0, u1, v0, v1) => pts([q(u0, v0), q(u1, v0), q(u1, v1), q(u0, v1)]);
  const { rows, colors, knob } = DOOR;
  const foot = q(wall === 'L' ? w : 0, 0); // 화면에서 문의 왼쪽 끝 바닥
  const lift = c => (wall === 'L' ? 1 : -1) * Math.floor(c / 2); // 오른쪽으로 갈수록 왼쪽 벽은 올라가고 오른쪽 벽은 내려간다
  const dots = (c, y, n, up) => `M${foot.x + c * WALL_PX} ${foot.y + (y - rows.length - up) * WALL_PX}h${WALL_PX}v${n * WALL_PX}h-${WALL_PX}z`;
  const art = {};
  const grip = {};
  let under = ''; // 겉선 안쪽 전체에 문짝 색을 한 번 깔아 점 사이로 벽이 비치지 않게 한다(벽지와 같다)
  for (let c = 0; c < rows[0].length; c++) {
    for (let y = 0; y < rows.length;) {
      const ch = rows[y][c];
      let n = 1;
      while (rows[y + n]?.[c] === ch) n++;
      const d = dots(c, y, n, lift(c));
      if (ch !== 'k') under += d;
      if (ch !== 'L') (art[ch] ??= []).push(d);
      y += n;
    }
  }
  const level = lift(knob.x + Math.floor(knob.rows[0].length / 2)); // 손잡이는 가운데 줄의 높이에 바로 세운다
  knob.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') (grip[ch] ??= []).push(dots(knob.x + x, knob.y + y, 1, level));
  }));
  const paint = parts => Object.entries(parts).map(([ch, d]) => `<path fill="${colors[ch]}" d="${d.join('')}" />`).join('');
  return `<g class="door-art"><path fill="${colors.L}" d="${under}" />${paint(art)}${paint(grip)}</g>
    <polygon class="door-hit" points="${quad(0, w, 0, h)}"><title>두 번 눌러 이웃집 놀러 가기</title></polygon>`;
}

// ---------- 벽지 (data/wall-patterns.js) ----------
const WALL_PX = 2; // 벽지 그림 한 칸의 무대 px. 가구 그림과 펫의 한 점(무대 2px)과 같은 굵기다

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

// ---------- 바닥 (data/floor-patterns.js) ----------
const FLOOR_DOTS = 18; // 바닥 그림에서 바닥 한 칸의 가장자리 칸 수. 그림 한 칸이 방에서 가로 4px, 세로 2px 마름모가 된다

// 방 그림 한 장에 넣을 바닥 무늬. 위에서 본 그림을 바닥 칸의 2:1 기울기로 눕혀, 바닥 마름모의 뒤 꼭짓점(두 벽이 만나는 곳)에서 시작한다.
// 그림의 가로는 바닥의 x축(오른쪽 아래), 세로는 y축(왼쪽 아래)을 따라간다. 무늬 id는 벽지처럼 그릴 때마다 새로 붙인다.
function floorPaint(p) {
  const id = `floor-paint-${++paintSeq}`;
  const a = TW / 2 / FLOOR_DOTS;
  const b = TH / 2 / FLOOR_DOTS;
  return {
    defs: `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${p.rows[0].length}" height="${p.rows.length}"
    patternTransform="matrix(${a} ${b} ${-a} ${b} ${O.x} ${O.y})">${tileMarkup(p)}</pattern></defs>`,
    fill: `url(#${id})`,
  };
}

// 벽지와 바닥을 고르는 단추에 넣을 작은 그림. 무늬에서 swatch가 가리키는 14×14칸(단추 안 28px에 한 칸 2px)을 비틀지 않고 보여 준다.
// 무늬 한 장은 단추보다 훨씬 커서 왼쪽 위만 보이면 바탕색뿐이라, 하트나 리본처럼 그 무늬를 알아볼 자리를 data/wall-patterns.js와 data/floor-patterns.js에 적어 둔다.
// 기본 벽은 style.css의 --wall-l 색에 반 칸마다 세로줄이고, 기본 바닥은 --floor-a와 --floor-b의 체크다(단추는 방 상자 밖이라 변수 대신 같은 색을 적었다).
const SWATCH = 14;
const PLAIN_WALL = `<rect width="${SWATCH}" height="${SWATCH}" fill="#f2e6cb" /><path d="M3.5 0v14M10.5 0v14" stroke="#0000001f" stroke-width="0.7" />`;
const PLAIN_FLOOR = `<rect width="${SWATCH}" height="${SWATCH}" fill="#c69a6b" /><path d="M0 0h7v7h-7zM7 7h7v7h-7z" fill="#bb8e60" />`;
function swatchSVG(p, plain) {
  if (!p?.rows) return `<svg viewBox="0 0 ${SWATCH} ${SWATCH}" aria-hidden="true">${plain}</svg>`;
  const [x, y] = p.swatch || [0, 0];
  return `<svg viewBox="${x} ${y} ${SWATCH} ${SWATCH}" aria-hidden="true">${tileMarkup(p)}</svg>`;
}
export const wallSwatchSVG = id => swatchSVG(WALL_PATTERNS.find(w => w.id === id), PLAIN_WALL);
export const floorSwatchSVG = id => swatchSVG(FLOOR_PATTERNS.find(f => f.id === id), PLAIN_FLOOR);

// 방의 벽과 바닥 (가구를 놓아도 바뀌지 않는 배경). door가 있으면 벽에 현관문을 그린다.
// wall: 벽지 id(data/wall-patterns.js), floor: 바닥 id(data/floor-patterns.js). 비었거나 모르는 id면 기본 벽과 기본 바닥이다.
export function roomSVG(door, wall = 'plain', floor = 'plain') {
  const up = WALL_ROWS * WH;
  const raise = p => ({ x: p.x, y: p.y - up });
  const T = 0.18; // 벽 두께 (칸)
  const SLAB = 16; // 바닥판 두께 (px)
  const below = p => ({ x: p.x, y: p.y + SLAB });

  const floorPattern = FLOOR_PATTERNS.find(f => f.id === floor && f.rows);
  const floorTiles = [];
  if (floorPattern) {
    // 무늬 아래에 바탕색을 한 번 더 깔아 무늬 조각 사이로 틈이 비치지 않게 한다(벽지와 같다)
    const paint = floorPaint(floorPattern);
    const whole = pts([tile(0, 0), tile(N, 0), tile(N, N), tile(0, N)]);
    floorTiles.push(paint.defs, `<polygon points="${whole}" style="fill:${floorPattern.bg}" />`, `<polygon points="${whole}" style="fill:${paint.fill}" />`);
  } else {
    // 기본 바닥: 칸마다 두 색을 번갈아 칠한다
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        const fill = (x + y) % 2 ? 'var(--floor-a)' : 'var(--floor-b)';
        floorTiles.push(`<polygon points="${pts([tile(x, y), tile(x + 1, y), tile(x + 1, y + 1), tile(x, y + 1)])}" style="fill:${fill}" />`);
      }
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
