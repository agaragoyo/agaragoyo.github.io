// CRT 화면 효과: 볼록하게 휘는 화면과 그레인.
//
// 볼록 효과는 SVG 필터(feDisplacementMap)로 .crt 를 실제로 휘게 만든다.
// 브라우저는 클릭 대상을 휘기 전 위치로 판단하므로, 화면 위에 투명한 층(.crt-input)을 깔고
// 마우스 입력을 같은 공식으로 휘기 전 위치로 고친 뒤 그 자리의 요소에 다시 보낸다.
// 그래서 왜곡 공식은 warp() 한 곳에만 두고, 필터 그림과 입력 보정이 같이 쓴다.

const K = 0.06; // 휘는 정도. 클수록 가장자리가 많이 휜다.

// 화면에 보이는 점 (x, y) → 그 자리에 실제로 그려지는 원래 점. w, h: 화면 크기(px)
function warp(x, y, w, h) {
  const nx = (x / w) * 2 - 1;
  const ny = (y / h) * 2 - 1;
  const m = 1 + K * (nx * nx + ny * ny);
  return [((nx * m + 1) / 2) * w, ((ny * m + 1) / 2) * h];
}

export function initCRT({ screen, warpEl, input, grain, isWarpOn, isGrainOn }) {
  const filter = document.getElementById('crt-warp');
  const feImage = document.getElementById('crt-map');
  const feMap = filter.querySelector('feDisplacementMap');
  let size = { w: 0, h: 0 };

  // 왜곡 지도: 픽셀마다 "원래 점까지의 거리"를 빨강(가로), 초록(세로)에 담는다.
  function buildMap(w, h) {
    const cw = Math.ceil(w / 2);
    const ch = Math.ceil(h / 2);
    const scale = Math.ceil(2 * K * Math.max(w, h)) + 4; // 가장 멀리 밀리는 거리의 두 배보다 크게
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    const data = ctx.createImageData(cw, ch);
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const x = ((i + 0.5) / cw) * w;
        const y = ((j + 0.5) / ch) * h;
        const [sx, sy] = warp(x, y, w, h);
        const k = (j * cw + i) * 4;
        data.data[k] = Math.round(((sx - x) / scale + 0.5) * 255);
        data.data[k + 1] = Math.round(((sy - y) / scale + 0.5) * 255);
        data.data[k + 2] = 0;
        data.data[k + 3] = 255;
      }
    }
    ctx.putImageData(data, 0, 0);
    for (const el of [filter, feImage]) {
      el.setAttribute('width', w);
      el.setAttribute('height', h);
    }
    feImage.setAttribute('href', canvas.toDataURL());
    feMap.setAttribute('scale', scale);
  }

  function apply() {
    const r = screen.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    const on = isWarpOn();
    if (on && (w !== size.w || h !== size.h)) {
      buildMap(w, h);
      size = { w, h };
    }
    warpEl.style.filter = on ? 'url(#crt-warp)' : '';
    input.hidden = !on;
    startGrain();
  }

  // ---------- 입력 보정 ----------
  const fix = (clientX, clientY) => {
    const r = screen.getBoundingClientRect();
    const [x, y] = warp(clientX - r.left, clientY - r.top, r.width, r.height);
    return [r.left + x, r.top + y];
  };
  const under = (x, y) => {
    input.style.pointerEvents = 'none';
    const el = document.elementFromPoint(x, y);
    input.style.pointerEvents = '';
    return el && screen.contains(el) ? el : null;
  };
  let hovered = null;
  const setHover = el => {
    const item = el?.closest('.item') || null;
    if (item === hovered) return;
    hovered?.classList.remove('hover');
    item?.classList.add('hover');
    hovered = item;
  };

  const forwardPointer = e => {
    e.stopPropagation();
    const [x, y] = fix(e.clientX, e.clientY);
    const target = under(x, y);
    if (e.type === 'pointerdown') {
      e.preventDefault();
      input.setPointerCapture(e.pointerId);
      const field = target?.closest('input, textarea, select');
      if (field) field.focus();
      else if (document.activeElement?.matches('input, textarea')) document.activeElement.blur();
    }
    if (e.type === 'pointermove') {
      setHover(target);
      input.style.cursor = target ? getComputedStyle(target).cursor : '';
    }
    (target || window).dispatchEvent(new PointerEvent(e.type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: x,
      clientY: y,
      button: e.button,
      buttons: e.buttons,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      isPrimary: e.isPrimary,
    }));
  };
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    input.addEventListener(type, forwardPointer);
  }
  input.addEventListener('pointerleave', () => setHover(null));
  input.addEventListener('click', e => {
    e.stopPropagation();
    const target = under(...fix(e.clientX, e.clientY));
    const clickable = target?.closest('button, a, label');
    if (clickable) clickable.click();
  });
  input.addEventListener('wheel', e => {
    e.preventDefault();
    e.stopPropagation();
    const [x, y] = fix(e.clientX, e.clientY);
    under(x, y)?.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, clientX: x, clientY: y,
      deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode,
    }));
  }, { passive: false });

  // ---------- 그레인 ----------
  // 작은 캔버스에 노이즈 몇 장을 미리 만들어 두고 번갈아 보여 준다. 같은 얼룩이 눈에 띄지 않게 장마다 새로 뿌린다.
  const FRAMES = 8;
  const FPS = 24;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frames = [];
  let timer = 0;
  function startGrain() {
    clearInterval(timer);
    if (!isGrainOn()) return;
    const r = screen.getBoundingClientRect();
    const gw = Math.ceil(r.width / 2);
    const gh = Math.ceil(r.height / 2);
    if (grain.width !== gw || grain.height !== gh || !frames.length) {
      grain.width = gw;
      grain.height = gh;
      const ctx = grain.getContext('2d');
      frames = Array.from({ length: FRAMES }, () => {
        const img = ctx.createImageData(gw, gh);
        const d = img.data;
        for (let k = 0; k < d.length; k += 4) {
          const v = (Math.random() * 255) | 0;
          d[k] = d[k + 1] = d[k + 2] = v;
          d[k + 3] = 255;
        }
        return img;
      });
    }
    const ctx = grain.getContext('2d');
    let n = 0;
    ctx.putImageData(frames[0], 0, 0);
    if (reduceMotion) return;
    timer = setInterval(() => {
      n = (n + 1 + ((Math.random() * (FRAMES - 1)) | 0)) % FRAMES;
      ctx.putImageData(frames[n], 0, 0);
    }, 1000 / FPS);
  }

  return { apply };
}
