// 아이소메트릭 투영과 그리기. 바닥 칸 좌표 (x, y)와 벽 좌표 (벽, u, v)를 무대 px로 바꾼다.
//   바닥: x는 뒤 꼭짓점에서 오른쪽 아래로, y는 왼쪽 아래로 늘어난다.
//   벽:   'R'은 x축을 따라 선 오른쪽 벽, 'L'은 y축을 따라 선 왼쪽 벽이다.
//         u는 두 벽이 만나는 모서리에서 벽을 따라간 칸, v는 바닥에서 올라간 줄이다.
import { N, TW, TH, WALL_ROWS, WH, ORIGIN as O } from './config.js';
import { BY_ID } from '../data/furniture.js';

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
export function boxSize(def) {
  if (def.zone === 'wall') return { w: (def.size[0] * TW) / 2, h: def.size[1] * WH };
  const [w, d] = def.size;
  return { w: ((w + d) * TW) / 2, h: ((w + d) * TH) / 2 + def.height };
}

// 바닥 쪽 가구가 그려지는 순서. 앞(화면 아래)에 있을수록 크다.
export const depthOf = item => {
  const [w, d] = BY_ID[item.id].size;
  return item.x + w / 2 + item.y + d / 2;
};

// el(가구 그림)을 방 안 제자리에 놓는다. elev: 책상 위에 올라가 있으면 책상 높이.
export function placeEl(el, item, elev = 0) {
  const def = BY_ID[item.id];
  if (def.zone === 'wall') {
    const [w, h] = def.size;
    const left = item.wall === 'R' ? item.x : item.x + w; // 화면에서 왼쪽 끝이 되는 쪽
    const p = wallPoint(item.wall, left, item.y + h);
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.style.transform = `skewY(${item.wall === 'R' ? SKEW : -SKEW}deg)`;
    return;
  }
  const p = tile(item.x, item.y);
  el.style.left = p.x - (def.size[1] * TW) / 2 + 'px';
  el.style.top = p.y - def.height - elev + 'px';
  el.style.transform = '';
}

const pts = list => list.map(p => `${p.x},${p.y}`).join(' ');
const mix = (c, other, pct) => `color-mix(in srgb, ${c} ${pct}%, ${other})`;

// 그림이 없는 동안 쓰는 임시 모양: 바닥 가구는 입체 상자, 벽 가구는 액자.
export function placeholderSVG(def) {
  const { w: bw, h: bh } = boxSize(def);
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
  const [w, d] = def.size;
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
  const left = p.x - (def.size[1] * TW) / 2;
  const top = p.y - def.height - elev;
  return { x: left + boxSize(def).w / 2, y: top + TH / 2 };
}

// 공간 배경. kind: 'indoor'(벽과 바닥) 또는 'outdoor'(울타리, 땅, 뒤쪽 아파트)
export function sceneSVG(kind) {
  return kind === 'outdoor' ? outdoorSVG() : roomSVG();
}

// 바깥 공간: 잔디 바닥, 낮은 울타리, 뒤로 보이는 아파트
function outdoorSVG() {
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
  // 울타리: 뒤쪽 두 변을 따라 기둥과 가로대
  const H = 34;
  const fence = [];
  for (let i = 0; i <= N; i += 0.5) {
    for (const p of [tile(i, 0), tile(0, i)]) fence.push(`<line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y - H}" />`);
  }
  const rail = (h) => `<polyline points="${pts([{ x: tile(0, N).x, y: tile(0, N).y - h }, { x: tile(0, 0).x, y: tile(0, 0).y - h }, { x: tile(N, 0).x, y: tile(N, 0).y - h }])}" />`;
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
  </svg>`;
}

// 방의 벽과 바닥 (가구를 놓아도 바뀌지 않는 배경)
export function roomSVG() {
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

  // 벽지의 세로 줄무늬 (반 칸마다)
  const stripes = [];
  for (let i = 0.5; i < N; i += 0.5) {
    stripes.push(`<polyline points="${pts([wallPoint('R', i, 0), wallPoint('R', i, WALL_ROWS)])}" />`);
    stripes.push(`<polyline points="${pts([wallPoint('L', i, 0), wallPoint('L', i, WALL_ROWS)])}" />`);
  }

  const corner = tile(0, 0);
  const capCorner = raise(tile(-T, -T));
  return `<svg class="room-bg" width="1280" height="720" viewBox="0 0 1280 720">
    <polygon points="${pts([tile(0, N), tile(N, N), below(tile(N, N)), below(tile(0, N))])}" style="fill:var(--slab-a)" />
    <polygon points="${pts([tile(N, N), tile(N, 0), below(tile(N, 0)), below(tile(N, N))])}" style="fill:var(--slab-b)" />
    ${floorTiles.join('')}
    <polygon points="${pts([corner, tile(0, N), raise(tile(0, N)), raise(corner)])}" style="fill:var(--wall-l)" />
    <polygon points="${pts([corner, tile(N, 0), raise(tile(N, 0)), raise(corner)])}" style="fill:var(--wall-r)" />
    <g class="stripes">${stripes.join('')}</g>
    <polygon points="${pts([corner, tile(0, N), wallPoint('L', N, 0.35), wallPoint('L', 0, 0.35)])}" style="fill:var(--baseboard)" />
    <polygon points="${pts([corner, tile(N, 0), wallPoint('R', N, 0.35), wallPoint('R', 0, 0.35)])}" style="fill:var(--baseboard-dark)" />
    <polygon points="${pts([tile(0, N), raise(tile(0, N)), raise(tile(-T, N)), tile(-T, N)])}" style="fill:var(--wall-edge)" />
    <polygon points="${pts([tile(N, 0), raise(tile(N, 0)), raise(tile(N, -T)), tile(N, -T)])}" style="fill:var(--wall-edge)" />
    <polygon points="${pts([raise(corner), raise(tile(0, N)), raise(tile(-T, N)), capCorner])}" style="fill:var(--wall-cap)" />
    <polygon points="${pts([raise(corner), raise(tile(N, 0)), raise(tile(N, -T)), capCorner])}" style="fill:var(--wall-cap)" />
    <g class="grid">${gridLines.join('')}</g>
  </svg>`;
}
