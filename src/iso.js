// 아이소메트릭 투영과 그리기. 바닥 칸 좌표 (x, y)와 벽 좌표 (벽, u, v)를 무대 px로 바꾼다.
//   바닥: x는 뒤 꼭짓점에서 오른쪽 아래로, y는 왼쪽 아래로 늘어난다.
//   벽:   'R'은 x축을 따라 선 오른쪽 벽, 'L'은 y축을 따라 선 왼쪽 벽이다.
//         u는 두 벽이 만나는 모서리에서 벽을 따라간 칸, v는 바닥에서 올라간 줄이다.
import { N, TW, TH, WALL_ROWS, WH, ORIGIN as O, SCENES } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { dims } from './rules.js';
import { neighborGate } from './neighbors.js';
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

// 공간 배경. scene: config.js의 SCENES 한 줄. kind가 'outdoor'면 울타리, 땅, 뒤쪽 아파트와 울타리의 문(fenceGates)을(앞쪽 끝의 문은 sceneFrontSVG),
// 'indoor'면 벽과 바닥과 현관문(door)을 그린다. owner: 그 공간이 있는 집의 주인 이름(이웃집 문을 달지 정한다, src/neighbors.js의 neighborGate).
// decor: 그 집의 방 꾸밈(src/share.js의 sanitizeHome). 지금은 벽지(decor.wall)만 있고, 없으면 기본 벽이다.
export function sceneSVG(scene, owner = '', decor = null) {
  return scene.kind === 'outdoor' ? outdoorSVG(fenceGates(scene, owner)) : roomSVG(scene.door, decor?.wall);
}

const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

// 바깥 공간의 문들. 그림(outdoorSVG, sceneFrontSVG), 방 꾸미기의 문 안쪽 칸(src/rules.js의 blocksGate), 문을 가리는 가구(coversGate)가 같이 쓴다.
//   오른쪽 뒤 울타리(wall 'R', y = 0 줄)의 아파트 문(scene.gate): 이 컴퓨터의 방으로 돌아가는 문이다. 뒤로 보이는 아파트 쪽이라 울타리에 단다
//   앞쪽 끝(wall 'F', y = N 줄)의 이웃집 문(scene.neighborGate): 보여 줄 이웃이 있을 때만 단다(src/neighbors.js의 neighborGate).
//     울타리가 없는 쪽이고, 가구보다 위층에 그려 가구에 가리지 않는다(sceneFrontSVG)
// 왼쪽 뒤 울타리(wall 'L', x = 0 줄)에는 지금 문이 없다. 2026-11-16까지 이웃집 문이 있었는데 팀원 놀이터의 그네와 나무에 가렸다(known-issues 90).
// x, w: 그 변을 따라 왼쪽 끝(R과 L은 뒤 모서리, F는 왼쪽 모서리)에서 센 칸과 폭. cls: 그림의 클래스 앞머리(.gate-*, .neighbor-*), text: 팻말 글, title: 마우스를 올리면 보이는 글
export function fenceGates(scene, owner = '') {
  if (scene.kind !== 'outdoor') return [];
  const near = neighborGate(scene, owner);
  return [
    ...(scene.gate ? [{ wall: 'R', x: scene.gate.x, w: scene.gate.w, cls: 'gate', text: '아파트', title: '두 번 눌러 집으로 돌아가기' }] : []),
    ...(near ? [{ ...near, cls: 'neighbor', text: '이웃집', title: '두 번 눌러 이웃집 목록 보기' }] : []),
  ];
}

const GATE_POST = 60; // 울타리 문 기둥 높이(px)
const GATE_SIGN = 18; // 문 위 팻말 높이(px)
const fenceAt = (wall, i) => (wall === 'R' ? tile(i, 0) : wall === 'F' ? tile(i, N) : tile(0, i));
const isFront = g => g.wall === 'F'; // 앞쪽 끝의 문. 배경이 아니라 가구 위층(sceneFrontSVG)에 그린다

// 울타리 문 하나가 화면에서 차지하는 자리(무대 px): 양쪽 기둥의 밑동과 꼭대기를 잇는 평행사변형이다. 팻말도 이 안에 든다.
// 문을 두 번 누르는 판(.gate-hit, .neighbor-hit)과 문을 가리는 가구를 재는 곳(coversGate)이 같이 쓴다
export function gateOutline(g) {
  const a = fenceAt(g.wall, g.x);
  const b = fenceAt(g.wall, g.x + g.w);
  return [a, b, { x: b.x, y: b.y - GATE_POST }, { x: a.x, y: a.y - GATE_POST }];
}

// 바닥 가구 상자가 화면에서 차지하는 자리(무대 px): 바닥 마름모를 가구 높이만큼 세운 육각형이다. elev: 책상 위에 올라가 있으면 책상 높이.
// 그림은 이 상자 안에 그린다(boxSize). 상자의 네모난 테두리로 재면 상자 모서리의 빈 곳까지 세어 문 옆에 붙은 벤치까지 문을 가린다고 여긴다
export function boxOutline(item, elev = 0) {
  const def = BY_ID[item.id];
  const [w, d] = dims(item);
  const at = (x, y, up) => { const p = tile(x, y); return { x: p.x, y: p.y - elev - up }; };
  return [at(item.x, item.y + d, 0), at(item.x + w, item.y + d, 0), at(item.x + w, item.y, 0),
    at(item.x + w, item.y, def.height), at(item.x, item.y, def.height), at(item.x, item.y + d, def.height)];
}

// 볼록 다각형 subject를 볼록 다각형 clip으로 자른 넓이(px²). 둘 다 꼭짓점을 한 방향으로 돈다(서덜랜드-호지먼 자르기와 신발끈 공식)
function overlapArea(subject, clip) {
  const side = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const turn = Math.sign(clip.reduce((s, p, i) => s + side(clip[0], p, clip[(i + 1) % clip.length]), 0)) || 1;
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const inside = p => side(a, b, p) * turn >= 0;
    const cut = (p, q) => {
      const t = side(a, b, p) / (side(a, b, p) - side(a, b, q));
      return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
    };
    const next = [];
    out.forEach((p, j) => {
      const q = out[(j + 1) % out.length];
      if (inside(p)) {
        next.push(p);
        if (!inside(q)) next.push(cut(p, q));
      } else if (inside(q)) next.push(cut(p, q));
    });
    out = next;
  }
  return Math.abs(out.reduce((s, p, i) => { const q = out[(i + 1) % out.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
}

// 바닥 가구 item이 뒤쪽 울타리의 문(gates, fenceGates)을 가리는가. 가구 상자(boxOutline)가 문 자리(gateOutline)와 겹치는 넓이가
// 문 자리의 COVER(8분의 1) 넘게 겹치면 가린다고 본다. 울타리는 바닥 뒤 끝에 있어 바닥 가구는 늘 문보다 앞에 그려진다.
// 가리는 가구는 반쯤 비치게 그려 문과 팻말이 보이게 한다(src/room.js의 markCover, 심즈가 앞쪽 벽을 낮추는 것과 같은 까닭).
// 앞쪽 끝의 문(F)은 가구보다 위층에 그려 가릴 일이 없으므로 보지 않는다.
// 2026-11-16에 그때 왼쪽 울타리에 있던 이웃집 문(칸 5~6)으로 잰 값: 문 옆 칸 (0, 7)의 벤치는 기둥 밑동만 스쳐 10%, (4, 9)와 (4, 10)의 나무는 문 아래 모서리만 덮어 5%라 그대로 두고,
// (3, 10)의 나무(20%), (0, 8)의 미끄럼틀(42%), 문 앞 둘째 줄 (1, 6)의 가로등(50%)부터 비친다. 아파트 문(칸 5~6)은 좌우만 바뀐 자리라 x와 y를 맞바꾼 칸에서 같은 값이다
const COVER = 1 / 8;
export function coversGate(item, elev, gates) {
  const back = gates.filter(g => !isFront(g));
  if (BY_ID[item.id].zone === 'wall' || !back.length) return false;
  const box = boxOutline(item, elev);
  return back.some(g => overlapArea(box, gateOutline(g)) > COVER * g.w * (TW / 2) * GATE_POST);
}

// 바깥 공간: 잔디 바닥, 낮은 울타리, 뒤로 보이는 아파트. 울타리에는 문(doors, fenceGates)을 낸다.
function outdoorSVG(doors) {
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
  // 울타리: 뒤쪽 두 변을 따라 기둥과 가로대. 뒤쪽 문 자리는 비운다(앞쪽 끝의 문은 sceneFrontSVG가 가구 위층에 그린다).
  const H = 34;
  const at = fenceAt;
  const back = doors.filter(d => !isFront(d));
  const isOpen = (wall, i) => back.some(d => d.wall === wall && i >= d.x && i <= d.x + d.w);
  const fence = [];
  for (let i = 0; i <= N; i += 0.5) {
    for (const wall of ['R', 'L']) if (!isOpen(wall, i)) fence.push(postLine(at(wall, i), H));
  }
  // 가로대: 한 변에서 문 사이사이의 막힌 구간 [a, b]마다 긋는다. 두 변의 첫 구간이 뒤 모서리(0)에서 시작하면 모서리를 지나는 한 줄로 잇는다.
  const spans = wall => {
    const out = [];
    let from = 0;
    for (const d of back.filter(o => o.wall === wall).sort((p, q) => p.x - q.x)) {
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
    const lines = join ? [[lift(at('L', L[0][1]), h), lift(tile(0, 0), h), lift(at('R', R[0][1]), h)]] : [];
    for (const [a, b] of join ? L.slice(1) : L) lines.push([lift(at('L', a), h), lift(at('L', b), h)]);
    for (const [a, b] of join ? R.slice(1) : R) lines.push([lift(at('R', a), h), lift(at('R', b), h)]);
    return lines.map(p => `<polyline points="${pts(p)}" />`).join('');
  };
  const gates = back.map(gateParts);
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
    <g class="fence">${fence.join('')}${gates.map(g => g.posts).join('')}${rail(12)}${rail(28)}</g>
    <g class="grid">${gridLines.join('')}</g>
    ${gates.map(g => g.sign).join('')}
  </svg>`;
}

const lift = (p, h) => ({ x: p.x, y: p.y - h });
const postLine = (p, h, cls = '') => `<line${cls && ` class="${cls}"`} x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y - h}" />`;

// 문 하나의 그림 조각. posts: 양쪽 높은 기둥(울타리 무리 .fence 안에 넣는다), sign: 팻말과 글, 두 번 누르는 판.
// 팻말 글자는 문이 선 변의 비탈(가로 2 : 세로 1, 26.57도)을 따라 기울인다. 오른쪽 뒤 울타리(R)와 앞쪽 끝(F)은 같은 쪽으로, 왼쪽 울타리(L)는 반대쪽으로 기운다.
// .gate-hit와 .neighbor-hit는 문 자리 전체(gateOutline)를 덮는 투명한 판이다. 바탕화면에서 두 번 누르면 아바타가 걸어가
// 아파트 문은 이 컴퓨터의 방으로 돌아가고, 이웃집 문은 이웃집 목록 창을 띄운다(room.js의 renderStatic).
function gateParts(d) {
  const G = GATE_POST;
  const S = GATE_SIGN;
  const a = fenceAt(d.wall, d.x);
  const b = fenceAt(d.wall, d.x + d.w);
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - G + S / 2 };
  return {
    posts: postLine(a, G, 'gate-post') + postLine(b, G, 'gate-post'),
    sign: `<polygon class="${d.cls}-sign" points="${pts([lift(a, G), lift(b, G), lift(b, G - S), lift(a, G - S)])}" />
    <text class="${d.cls}-text" transform="translate(${c.x} ${c.y}) skewY(${d.wall === 'L' ? -26.57 : 26.57})" text-anchor="middle" dominant-baseline="central">${esc(d.text)}</text>
    <polygon class="${d.cls}-hit" points="${pts(gateOutline(d))}"><title>${esc(d.title)}</title></polygon>`,
  };
}

// 앞쪽 끝(F)의 문 그림(지금은 이웃집 문). 바닥 앞 끝에 서 있어 놓인 가구와 아바타가 모두 그 뒤에 있으므로, 배경(sceneSVG)이 아니라
// 가구 위층(.room-fg)에 그린다. 그래서 어떤 가구도 문과 팻말을 가리지 않는다(known-issues 90). 포켓몬, 스타듀 밸리, 동물의 숲이
// 방의 출구를 화면 아래 끝에 두는 것과 같은 까닭이다. 앞쪽 끝에 문이 없으면 빈 글자다.
// 바탕화면(src/room.js의 renderStatic), 방 꾸미기(setSceneBg), 공유하기의 방 그림(src/room-image.js)이 가구 위에 놓는다.
export function sceneFrontSVG(scene, owner = '') {
  const gates = fenceGates(scene, owner).filter(isFront).map(gateParts);
  if (!gates.length) return '';
  return `<svg class="room-fg" width="1280" height="720" viewBox="0 0 1280 720">
    <g class="fence">${gates.map(g => g.posts).join('')}</g>
    ${gates.map(g => g.sign).join('')}
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
