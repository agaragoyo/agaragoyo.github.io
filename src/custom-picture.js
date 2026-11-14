// 내 그림: 사용자가 고른 그림 파일을 24×24칸, 16색 이하의 픽셀 그림으로 줄인 사용자 사진(F26 시험).
// 줄이는 일은 이 브라우저 안에서만 하고 원본 파일은 어디에도 저장하거나 보내지 않는다. 남는 것은 줄인 그림뿐이다.
// 사진 값(src/user-pictures.js)은 목록 사진의 id('dog')이거나, 내 그림이면 'my:' 뒤에 아래 바이트를 base64url로 적은 글이다.
// 이 글을 이 컴퓨터(agarago.picture)에 저장하고 짧은 링크의 방에 담는다(src/share.js의 짧은 형식 5).
// 긴 링크에는 담지 않는다(카카오톡 500자, known-issues 57). 그래서 긴 링크로 온 손님은 이름의 첫 글자를 본다.
//
// 바이트: [머리] 뒤로는 비트를 앞에서부터 채운다(끝에 남는 비트는 0).
//   머리: 아래 4비트는 색 수 - 1(1~16색), 위 4비트는 0이다. 부호화를 바꾸게 되면 위 4비트를 쓰고, 모르는 값이면 그림이 없는 것으로 연다.
//   색: 색마다 12비트(빨강, 초록, 파랑 각 4비트로 #rgb 한 자리씩). 그 시절 컴퓨터처럼 4096색 가운데서 고른다.
//   칸: 왼쪽 위 칸부터 한 줄씩. 0이면 왼쪽 칸과 같은 색(줄 첫 칸은 위 칸), 10이면 위 칸과 같은 색, 11이면 뒤에 색 번호가 온다.
//       색 번호는 색 수를 담는 비트 수만큼이다(16색이면 4비트). 첫 줄의 위 칸과 맨 첫 칸의 왼쪽은 0번 색으로 친다.
// 사진은 이웃한 칸끼리 같은 색인 일이 많아 칸 576개가 보통 100~230바이트에 든다(2026-11-14 사진 8장으로 잼).
// 링크에 붙는 덧붙임 바이트는 모두 255바이트까지라 그림은 MAX_BYTES 안으로 맞추고, 넘으면 색을 하나씩 줄여 다시 만든다.
// 이 파일은 tools/link-fuzz.mjs가 Node에서도 불러오므로, 브라우저에만 있는 것(캔버스)은 함수 안에서만 쓴다.

export const CUSTOM = 'my:'; // 사진 값이 내 그림이라는 표시
export const MAX_BYTES = 240; // 덧붙임 바이트 255개 가운데 벽지, 표시, 길이 3바이트를 빼고, 나중에 더할 칸을 위해 12바이트를 남긴다
const GRID = 24;
const CELLS = GRID * GRID;
const MAX_COLORS = 16;

export const isCustom = v => typeof v === 'string' && v.startsWith(CUSTOM);

// src/share.js와 같은 base64url(주소에 그대로 쓰는 글자)
const toB64 = bytes => {
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

const bitsFor = n => (n > 1 ? Math.ceil(Math.log2(n)) : 0); // 색 번호 하나를 담는 비트 수

// 칸 i의 왼쪽 칸과 위 칸의 색. 줄 첫 칸의 왼쪽은 위 칸이고, 없는 칸은 0번 색으로 친다
function neighbours(cells, i) {
  const up = i >= GRID ? cells[i - GRID] : 0;
  return [i % GRID ? cells[i - 1] : up, up];
}

// 색(12비트 수의 목록)과 칸(색 번호 576개)을 바이트로
function pack(colors, cells) {
  const out = [colors.length - 1];
  let acc = 0;
  let used = 0;
  const put = (value, bits) => {
    for (let i = bits - 1; i >= 0; i--) {
      acc = (acc << 1) | ((value >> i) & 1);
      if (++used === 8) {
        out.push(acc);
        acc = 0;
        used = 0;
      }
    }
  };
  for (const c of colors) put(c, 12);
  const b = bitsFor(colors.length);
  cells.forEach((c, i) => {
    const [left, up] = neighbours(cells, i);
    if (c === left) put(0, 1);
    else if (c === up) put(0b10, 2);
    else {
      put(0b11, 2);
      put(c, b);
    }
  });
  if (used) out.push(acc << (8 - used));
  return Uint8Array.from(out);
}

// 바이트를 그림으로. 규칙에 맞지 않거나(모르는 머리, 없는 색 번호, 끊기거나 남는 바이트) MAX_BYTES를 넘으면 null
function unpack(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 2 || bytes.length > MAX_BYTES || bytes[0] >= MAX_COLORS) return null;
  const n = bytes[0] + 1;
  const b = bitsFor(n);
  let pos = 8;
  const end = bytes.length * 8;
  const get = bits => {
    let v = 0;
    for (let i = 0; i < bits; i++, pos++) {
      if (pos >= end) throw new RangeError('그림이 중간에 끊겼다');
      v = (v << 1) | ((bytes[pos >> 3] >> (7 - (pos & 7))) & 1);
    }
    return v;
  };
  try {
    const colors = Array.from({ length: n }, () => get(12));
    const cells = new Uint8Array(CELLS);
    for (let i = 0; i < CELLS; i++) {
      const [left, up] = neighbours(cells, i);
      const c = !get(1) ? left : !get(1) ? up : get(b);
      if (c >= n) return null;
      cells[i] = c;
    }
    return Math.ceil(pos / 8) === bytes.length ? { colors, cells } : null;
  } catch {
    return null;
  }
}

// 색(12비트 수, 0~4095)과 칸(색 번호 576개)을 사진 값으로. 바이트가 MAX_BYTES를 넘으면 null
export function customValue(colors, cells) {
  if (!colors.length || colors.length > MAX_COLORS || cells.length !== CELLS) return null;
  const bytes = pack(colors, cells);
  return bytes.length <= MAX_BYTES ? CUSTOM + toB64(bytes) : null;
}

// 사진 값을 링크에 담을 바이트로. 내 그림이 아니거나 풀 수 없으면 null
export function customBytes(v) {
  if (!isCustom(v) || v.length > CUSTOM.length + Math.ceil(MAX_BYTES * 4 / 3)) return null;
  try {
    const bytes = fromB64(v.slice(CUSTOM.length));
    return unpack(bytes) ? bytes : null;
  } catch {
    return null;
  }
}

// 링크에서 읽은 바이트를 사진 값으로. 풀 수 없으면 null. 같은 바이트는 늘 같은 글로 적는다(집 검사가 이걸로 사진 값을 다시 쓴다)
export const customFromBytes = bytes => (bytes && unpack(bytes) ? CUSTOM + toB64(bytes) : null);

// 그리는 쪽(src/user-pictures.js)이 쓰는 그림: { colors: ['#rgb', ...], cells: 색 번호 576개 }. 내 그림이 아니거나 풀 수 없으면 null
const read = new Map();
export function readCustom(v) {
  if (!isCustom(v)) return null;
  if (!read.has(v)) {
    const bytes = customBytes(v);
    const pic = bytes && unpack(bytes);
    read.set(v, pic && { colors: pic.colors.map(c => `#${c.toString(16).padStart(3, '0')}`), cells: pic.cells });
  }
  return read.get(v);
}

// ---------- 그림 파일 줄이기 ----------

const BIG = GRID * 4; // 먼저 96×96으로 줄인 뒤 4×4픽셀씩 평균을 내 한 칸으로 만든다
const W = [2, 4, 3]; // 색 거리의 빨강, 초록, 파랑 무게. 눈은 초록의 차이를 가장 잘 알아본다
const dist = (a, b) => W[0] * (a[0] - b[0]) ** 2 + W[1] * (a[1] - b[1]) ** 2 + W[2] * (a[2] - b[2]) ** 2;
const nearest = (p, palette) => {
  let best = 0;
  let gap = Infinity;
  palette.forEach((q, i) => {
    const d = dist(p, q);
    if (d < gap) {
      gap = d;
      best = i;
    }
  });
  return best;
};
const mean = list => [0, 1, 2].map(c => list.reduce((s, p) => s + p[c], 0) / list.length);

function context(size, opts) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d', opts);
  g.imageSmoothingQuality = 'high';
  return g;
}

// 그림의 가운데를 정사각형으로 잘라 24×24칸의 [빨강, 초록, 파랑]으로. 투명한 곳은 흰 바탕으로 본다
function shrink(img) {
  let size = Math.min(img.width, img.height);
  let src = img;
  let sx = (img.width - size) / 2;
  let sy = (img.height - size) / 2;
  // 큰 그림을 한 번에 줄이면 브라우저에 따라 건너뛰는 픽셀이 생겨 거칠어지므로 반씩 줄여 간다
  while (size > BIG * 2) {
    const half = Math.ceil(size / 2);
    const g = context(half);
    g.drawImage(src, sx, sy, size, size, 0, 0, half, half);
    src = g.canvas;
    sx = 0;
    sy = 0;
    size = half;
  }
  const g = context(BIG, { willReadFrequently: true });
  g.imageSmoothingEnabled = size > BIG; // 96픽셀보다 작은 그림(픽셀 그림 등)은 흐리지 않게 칸 그대로 키운다
  g.fillStyle = '#fff';
  g.fillRect(0, 0, BIG, BIG);
  g.drawImage(src, sx, sy, size, size, 0, 0, BIG, BIG);
  const d = g.getImageData(0, 0, BIG, BIG).data;
  const px = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const sum = [0, 0, 0];
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          const o = ((y * 4 + j) * BIG + x * 4 + i) * 4;
          for (let c = 0; c < 3; c++) sum[c] += d[o + c];
        }
      }
      px.push(sum.map(s => s / 16));
    }
  }
  return px;
}

// 칸 576개의 색을 n색 이하로 줄인다. 색이 가장 넓게 퍼진 묶음을 반으로 가르기를 n묶음이 될 때까지 되풀이하고(중앙값 자르기),
// 묶음마다 평균 색에서 시작해 칸마다 가장 가까운 색으로 다시 묶기를 여덟 번 한다(k-평균).
// 끝으로 4096색에 맞추고, 쓰지 않는 색은 빼고, 많이 쓴 색부터 번호를 붙인다(0번이 가장 흔한 색이라 첫 줄의 '위 칸'과 잘 맞는다).
function quantize(px, n) {
  const boxes = [px.map((_, i) => i)];
  while (boxes.length < n) {
    let wide = 0;
    let at = -1;
    let ch = 0;
    boxes.forEach((box, i) => {
      for (let c = 0; c < 3; c++) {
        let lo = 255;
        let hi = 0;
        for (const p of box) {
          lo = Math.min(lo, px[p][c]);
          hi = Math.max(hi, px[p][c]);
        }
        const spread = (hi - lo) * Math.sqrt(W[c] * box.length);
        if (spread > wide) {
          wide = spread;
          at = i;
          ch = c;
        }
      }
    });
    if (at < 0) break; // 남은 묶음이 모두 한 색이다
    const box = boxes[at].sort((a, b) => px[a][ch] - px[b][ch]);
    boxes.splice(at, 1, box.slice(0, box.length >> 1), box.slice(box.length >> 1));
  }
  let palette = boxes.map(box => mean(box.map(i => px[i])));
  for (let round = 0; round < 8; round++) {
    const idx = px.map(p => nearest(p, palette));
    palette = palette.map((q, j) => {
      const members = px.filter((_, i) => idx[i] === j);
      return members.length ? mean(members) : q;
    });
  }
  const twelve = [...new Set(palette.map(q => q.reduce((v, x) => v * 16 + Math.round(x / 17), 0)))];
  const rgb = twelve.map(c => [(c >> 8) * 17, ((c >> 4) & 15) * 17, (c & 15) * 17]);
  const idx = px.map(p => nearest(p, rgb));
  const count = twelve.map((_, j) => idx.filter(v => v === j).length);
  const order = twelve.map((_, j) => j).filter(j => count[j]).sort((a, b) => count[b] - count[a] || twelve[a] - twelve[b]);
  const number = new Map(order.map((j, k) => [j, k]));
  return { colors: order.map(j => twelve[j]), cells: Uint8Array.from(idx, j => number.get(j)) };
}

// 그림 파일을 내 그림(사진 값)으로 줄인다. 그림이 아니거나 이 브라우저가 열 수 없는 파일(HEIC 등)이면 예외를 던진다.
// 16색으로 만든 그림이 MAX_BYTES를 넘으면 색을 하나씩 줄여 다시 만든다. 1색이면 칸마다 1비트라 늘 들어간다.
export async function makeCustom(file) {
  const img = await createImageBitmap(file);
  try {
    if (!img.width || !img.height) throw new Error('크기가 없는 그림이다');
    const px = shrink(img);
    for (let n = MAX_COLORS; n > 0; n--) {
      const { colors, cells } = quantize(px, n);
      const v = customValue(colors, cells);
      if (v) return v;
    }
    throw new Error('그림을 담을 크기로 줄이지 못했다');
  } finally {
    img.close();
  }
}
