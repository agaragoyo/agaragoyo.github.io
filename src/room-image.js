// 방 그림을 PNG 파일로 만든다(공유하기 앱의 "그림 PNG로 내려받기").
// 화면의 방은 SVG 바탕(iso.js)과 DOM 가구 상자(room.js)를 CSS로 겹쳐 놓은 것이라 사진처럼 찍을 수 없다.
// 그래서 화면과 같은 함수가 정한 자리(placementOf)와 앞뒤 순서(zOf), 그림 고르는 규칙(imageFor)으로 캔버스에 다시 그린다.
//   바탕과 그림이 없는 가구의 임시 모양(SVG): 화면에서 보이는 색을 요소마다 읽어 적은 뒤 그림 한 장으로 바꿔 그린다
//   가구 그림(PNG): .furn img 처럼 상자 아래 가운데에 맞춰 줄이고, 돌린 그림이 없으면 좌우로 뒤집는다
//   글자(임시 모양의 이름, 놀이터 문 팻말): SVG 그림 안에서는 웹폰트를 쓸 수 없어서 캔버스에 따로 쓴다
// 크기는 화면의 방(1280×720)의 2배인 2560×1440px이다. 낮 모습이고 아바타는 넣지 않는다.
import { ROOM_W, ROOM_H } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { elevOf } from './rules.js';
import { boxSize, placementOf, placeholderSVG, sceneSVG } from './iso.js';
import { imageFor, zOf } from './room.js';

export const IMAGE_SCALE = 2;
export const IMAGE_W = ROOM_W * IMAGE_SCALE;
export const IMAGE_H = ROOM_H * IMAGE_SCALE;

// 그림 밖 바탕 색. style.css의 .room 배경(안: radial-gradient(ellipse at 50% 45%, A, B 75%), 바깥: linear-gradient(A, B 60%))과
// 같은 값이다. CSS 그라디언트는 값을 읽어 올 방법이 없어 여기에 따로 적었으므로 한쪽을 고치면 다른 쪽도 고친다(tools/check.py가 본다).
const BACKDROP = {
  indoor: ['#cfe6ea', '#8fb8c4'],
  outdoor: ['#9fd0ee', '#d9eef2'],
};

// SVG 그림에 옮겨 적을 화면 속성. 새 SVG 모양에 점선이나 그림자 같은 다른 속성을 쓰면 여기에 더한다.
const PAINT = [
  'display', 'opacity', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity',
  'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'paint-order',
];

const PAD = 4; // 임시 모양의 테두리가 상자 밖으로 조금 나가는 것(.furn svg { overflow: visible })을 담는 여백(px)

function paintBackdrop(g, kind) {
  const [a, b] = BACKDROP[kind] || BACKDROP.indoor;
  if (kind === 'outdoor') {
    const grad = g.createLinearGradient(0, 0, 0, ROOM_H);
    grad.addColorStop(0, a);
    grad.addColorStop(0.6, b);
    grad.addColorStop(1, b);
    g.fillStyle = grad;
    g.fillRect(0, 0, ROOM_W, ROOM_H);
    return;
  }
  // CSS의 ellipse farthest-corner: 가운데에서 먼 쪽 변까지의 거리 비율은 그대로 두고, 가장 먼 모서리를 지나도록 √2배 키운 타원이다.
  const cx = ROOM_W * 0.5;
  const cy = ROOM_H * 0.45;
  const rx = Math.max(cx, ROOM_W - cx) * Math.SQRT2;
  const ry = Math.max(cy, ROOM_H - cy) * Math.SQRT2;
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  grad.addColorStop(0, a);
  grad.addColorStop(0.75, b);
  grad.addColorStop(1, b);
  g.save();
  g.translate(cx, cy);
  g.scale(1, ry / rx);
  g.fillStyle = grad;
  g.fillRect(-cx, (-cy * rx) / ry, ROOM_W, (ROOM_H * rx) / ry);
  g.restore();
}

// onload만 기다린다. img.decode()는 탭이 가려져 있으면 끝나지 않아(내려받기를 누른 뒤 다른 탭으로 가면 멈춘다) 쓰지 않는다.
// drawImage가 그릴 때 알아서 해독한다.
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`그림을 불러오지 못했다: ${src.slice(0, 80)}`));
    img.src = src;
  });
}

// <text> 하나를 캔버스에 쓸 수 있게 화면에서 읽어 둔다.
function readText(el, cs) {
  const get = name => cs.getPropertyValue(name);
  const list = el.transform?.baseVal;
  const m = list && list.numberOfItems ? list.consolidate().matrix : null;
  const anchor = get('text-anchor');
  return {
    text: el.textContent,
    x: parseFloat(el.getAttribute('x')) || 0,
    y: parseFloat(el.getAttribute('y')) || 0,
    matrix: m ? [m.a, m.b, m.c, m.d, m.e, m.f] : null,
    font: `${get('font-style')} ${get('font-weight')} ${get('font-size')} ${get('font-family')}`,
    align: anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left',
    baseline: get('dominant-baseline') === 'central' ? 'middle' : 'alphabetic',
    fill: get('fill'),
    stroke: get('stroke'),
    strokeWidth: parseFloat(get('stroke-width')) || 0,
    strokeFirst: get('paint-order').startsWith('stroke'),
  };
}

// SVG 문자열을 화면에 보이는 모습 그대로 그림 한 장으로 만든다.
// 화면의 SVG는 style.css(클래스, 변수)와 color-mix 같은 CSS 값에 기대고 있어서, 문자열을 그대로 그림으로 쓰면 색이 빠진다.
// 그래서 방과 같은 CSS를 받는 숨은 상자에 붙여 놓고 요소마다 최종 값을 읽어 직접 적어 넣는다(격자처럼 투명한 것은 그대로 투명하다).
// 글자는 그림에서 빼고 따로 돌려준다. pad: 둘레에 더할 여백(px).
async function bakeSVG(markup, pad = 0) {
  const probe = document.createElement('div');
  probe.className = 'room'; // 방 색 변수(--floor-a ...)가 .room에 정의되어 있다
  probe.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none';
  probe.innerHTML = markup;
  document.body.append(probe);
  const texts = [];
  let xml;
  let w;
  let h;
  try {
    const svg = probe.firstElementChild;
    w = parseFloat(svg.getAttribute('width'));
    h = parseFloat(svg.getAttribute('height'));
    for (const el of [...svg.querySelectorAll('*')]) {
      if (!svg.contains(el)) continue; // 글자를 빼면서 같이 나간 것
      const cs = getComputedStyle(el);
      if (el.localName === 'text') {
        texts.push(readText(el, cs));
        el.remove();
        continue;
      }
      // 읽어 온 url("http://.../#id")는 이 SVG 안의 #id를 가리키도록 되돌린다(그림 안에서는 바깥 문서를 볼 수 없다)
      const decl = PAINT.map(p => `${p}:${cs.getPropertyValue(p).replace(/url\("?[^"#)]*(#[^")]*)"?\)/g, 'url($1)')}`);
      el.setAttribute('style', decl.join(';'));
    }
    // 그림 자체의 크기를 최종 픽셀 수로 맞춰 둔다. 그래야 어느 브라우저에서도 다시 늘이거나 줄이지 않고 그대로 옮겨 그린다.
    svg.setAttribute('width', (w + 2 * pad) * IMAGE_SCALE);
    svg.setAttribute('height', (h + 2 * pad) * IMAGE_SCALE);
    svg.setAttribute('viewBox', `${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`);
    xml = new XMLSerializer().serializeToString(svg);
  } finally {
    probe.remove();
  }
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`);
  return { img, texts, w, h, pad };
}

// 가구 한 개의 겉모습: 그림 파일이 있으면 그것, 없으면 임시 모양
async function makeSprite(item) {
  const def = BY_ID[item.id];
  const src = await imageFor(item.id, item.r);
  if (src) {
    try {
      return { kind: 'png', box: boxSize(def, item.r), mirror: src.mirror, img: await loadImage(`assets/furniture/${src.name}.png`) };
    } catch { /* 그림을 불러오지 못하면 임시 모양으로 */ }
  }
  return { kind: 'svg', ...(await bakeSVG(placeholderSVG(def, item.r), PAD)) };
}

function drawTexts(g, texts) {
  for (const t of texts) {
    g.save();
    if (t.matrix) g.transform(...t.matrix);
    g.font = t.font;
    g.textAlign = t.align;
    g.textBaseline = t.baseline;
    g.lineJoin = 'miter';
    g.miterLimit = 4; // SVG의 기본값
    g.lineWidth = t.strokeWidth;
    g.fillStyle = t.fill;
    g.strokeStyle = t.stroke;
    const stroke = () => { if (t.stroke !== 'none' && t.strokeWidth > 0) g.strokeText(t.text, t.x, t.y); };
    const fill = () => { if (t.fill !== 'none') g.fillText(t.text, t.x, t.y); };
    if (t.strokeFirst) { stroke(); fill(); } else { fill(); stroke(); }
    g.restore();
  }
}

// 상자(왼쪽 위가 원점) 안에 가구 한 개를 그린다.
function drawSprite(g, sp) {
  if (sp.kind === 'png') {
    // .furn img: object-fit contain, object-position bottom. 상자에 맞춰 줄이거나 늘이고 아래 가운데에 붙인다.
    const { w, h } = sp.box;
    const s = Math.min(w / sp.img.naturalWidth, h / sp.img.naturalHeight);
    const dw = sp.img.naturalWidth * s;
    const dh = sp.img.naturalHeight * s;
    g.save();
    if (sp.mirror) { g.translate(w, 0); g.scale(-1, 1); } // .mirror: 상자 가운데를 기준으로 좌우 뒤집기
    g.drawImage(sp.img, (w - dw) / 2, h - dh, dw, dh);
    g.restore();
  } else {
    g.drawImage(sp.img, -sp.pad, -sp.pad, sp.w + 2 * sp.pad, sp.h + 2 * sp.pad);
    drawTexts(g, sp.texts);
  }
}

// 한 공간의 그림을 캔버스로 만든다. items: 그 공간의 가구 목록, scene: config.js의 SCENES 한 줄
export async function renderRoomImage(items, scene) {
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_W;
  canvas.height = IMAGE_H;
  const g = canvas.getContext('2d');
  g.scale(IMAGE_SCALE, IMAGE_SCALE);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';

  // 화면은 z-index가 낮은 가구부터 쌓고, 같으면 목록에서 뒤에 있는 가구가 위에 온다(sort는 같은 값의 순서를 지킨다).
  const order = items.map((item, i) => ({ item, i, z: zOf(items, item) })).sort((a, b) => a.z - b.z || a.i - b.i);
  const cache = new Map(); // 같은 모양의 가구는 한 번만 준비한다
  const sprite = item => {
    const key = `${item.id}:${item.r ? 1 : 0}`;
    if (!cache.has(key)) cache.set(key, makeSprite(item));
    return cache.get(key);
  };
  const [back, ...sprites] = await Promise.all([bakeSVG(sceneSVG(scene.kind, scene.gate)), ...order.map(o => sprite(o.item))]);

  // 글자는 쓰기 전에 글꼴이 불려 와 있어야 한다(처음 쓰는 글자의 글꼴 조각이 늦게 오면 다른 글꼴로 써진다)
  const texts = [back, ...sprites].flatMap(s => s.texts || []);
  await Promise.all(texts.map(t => document.fonts.load(t.font, t.text).catch(() => {})));

  paintBackdrop(g, scene.kind);
  g.drawImage(back.img, 0, 0, ROOM_W, ROOM_H);
  drawTexts(g, back.texts);
  order.forEach(({ item }, k) => {
    const { left, top, skew } = placementOf(item, elevOf(items, item));
    g.save();
    g.translate(left, top);
    if (skew) g.transform(1, Math.tan((skew * Math.PI) / 180), 0, 1, 0, 0); // skewY, 벽 가구
    drawSprite(g, sprites[k]);
    g.restore();
  });
  return canvas;
}
