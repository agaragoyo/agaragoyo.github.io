// CRT 화면 효과: 볼록하게 휘는 화면과 그레인.
//
// 볼록 효과는 SVG 필터(feDisplacementMap)로 .crt 를 실제로 휘게 만든다.
// 브라우저는 클릭 대상을 휘기 전 위치로 판단하므로, 화면 위에 투명한 층(.crt-input)을 깔고
// 마우스 입력을 같은 공식으로 휘기 전 위치로 고친 뒤 그 자리의 요소에 다시 보낸다.
// 그래서 왜곡 공식은 warp() 한 곳에만 두고, 필터 그림과 입력 보정이 같이 쓴다.

// 휘는 정도. 클수록 가장자리가 많이 휜다. 시대 설정에 따라 바뀐다(평면 CRT는 덜 휜다).
let K = 0.06;

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
  let size = { w: 0, h: 0, k: 0 };

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
    if (on && (w !== size.w || h !== size.h || K !== size.k)) {
      buildMap(w, h);
      size = { w, h, k: K };
    }
    warpEl.style.filter = on ? 'url(#crt-warp)' : '';
    input.hidden = !on;
    window.__agaWarpOn = on; // 같은 사이트 앱(iframe)이 포인터 캡처를 흉내 낼지 정할 때 본다
    updateHoles();
    startGrain();
  }

  // ---------- iframe 앱 ----------
  // 같은 사이트의 앱은 보정한 좌표를 iframe 안 문서까지 넣어 준다.
  // 다른 사이트의 앱은 안을 건드릴 수 없으므로, 그 창 영역만 보정 층에 구멍을 내서 클릭이 그대로 들어가게 한다.
  const sameOrigin = frame => {
    try { return new URL(frame.src, location.href).origin === location.origin; } catch { return false; }
  };

  function updateHoles() {
    if (input.hidden) { input.style.clipPath = ''; return; }
    const r = screen.getBoundingClientRect();
    const holes = [];
    for (const frame of screen.querySelectorAll('iframe')) {
      if (sameOrigin(frame) || !frame.offsetParent) continue;
      const f = frame.getBoundingClientRect();
      const x = f.left - r.left;
      const y = f.top - r.top;
      holes.push(`M${x} ${y}h${f.width}v${f.height}h${-f.width}Z`);
    }
    input.style.clipPath = holes.length
      ? `path(evenodd, "M0 0H${r.width}V${r.height}H0Z ${holes.join(' ')}")`
      : '';
  }

  // 같은 사이트 앱이 setPointerCapture를 부르면, 우리가 보내는 가짜 포인터 이벤트에는 진짜 캡처가 안 되어 오류가 난다.
  // 화면이 휘어 있는 동안만 캡처를 흉내 내서, 이후 이벤트를 그 요소로 보낸다.
  function prepareFrame(frame) {
    let w;
    try { w = frame.contentWindow; if (!w.document) return; } catch { return; }
    if (w.__agaPrepared) return;
    w.__agaPrepared = true;
    const proto = w.Element.prototype;
    const orig = {
      set: proto.setPointerCapture,
      release: proto.releasePointerCapture,
      has: proto.hasPointerCapture,
    };
    const fake = () => window.__agaWarpOn;
    proto.setPointerCapture = function (id) { if (fake()) w.__agaCapture = this; else orig.set.call(this, id); };
    proto.releasePointerCapture = function (id) {
      if (fake()) { if (w.__agaCapture === this) w.__agaCapture = null; } else orig.release.call(this, id);
    };
    proto.hasPointerCapture = function (id) { return fake() ? w.__agaCapture === this : orig.has.call(this, id); };
  }

  const MOUSE_TWIN = { pointerdown: 'mousedown', pointermove: 'mousemove', pointerup: 'mouseup' };

  // 무대 위 iframe 안으로 이벤트를 넣는다. 성공하면 true.
  function intoFrame(frame, type, x, y, e) {
    let w;
    let doc;
    try { w = frame.contentWindow; doc = w.document; } catch { return false; }
    if (!doc) return false;
    const f = frame.getBoundingClientRect();
    const sc = f.width / frame.clientWidth || 1;
    const ix = (x - f.left) / sc;
    const iy = (y - f.top) / sc;
    const target = (type !== 'click' && type !== 'wheel' && w.__agaCapture) || doc.elementFromPoint(ix, iy) || doc.body;
    if (!target) return true;
    const init = {
      bubbles: true, cancelable: true, composed: true, view: w,
      clientX: ix, clientY: iy, screenX: e.screenX, screenY: e.screenY,
      button: e.button, buttons: e.buttons,
      ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
    };
    if (type === 'wheel') {
      target.dispatchEvent(new w.WheelEvent('wheel', { ...init, deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode }));
      return true;
    }
    if (type === 'click') {
      target.dispatchEvent(new w.MouseEvent('click', init));
      return true;
    }
    if (type === 'pointerdown') {
      w.focus();
      const field = target.closest?.('input, textarea, select, [tabindex], button, a');
      if (field) field.focus();
    }
    target.dispatchEvent(new w.PointerEvent(type, {
      ...init, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary,
    }));
    if (MOUSE_TWIN[type]) target.dispatchEvent(new w.MouseEvent(MOUSE_TWIN[type], init));
    if (type === 'pointerup' || type === 'pointercancel') w.__agaCapture = null;
    return true;
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
  let activeFrame = null;
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
    // 앞서 누른 곳이 iframe 이었으면 손을 뗄 때까지 그 iframe 으로 보낸다(창 밖으로 끌어도 놓치지 않게).
    const frame = activeFrame || (target?.tagName === 'IFRAME' ? target : null);
    if (e.type === 'pointerdown') activeFrame = frame;
    if (e.type === 'pointerup' || e.type === 'pointercancel') activeFrame = null;
    if (frame && intoFrame(frame, e.type, x, y, e)) return;
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
    const [x, y] = fix(e.clientX, e.clientY);
    const target = under(x, y);
    if (target?.tagName === 'IFRAME' && intoFrame(target, 'click', x, y, e)) return;
    const clickable = target?.closest('button, a, label');
    if (clickable) clickable.click();
  });
  input.addEventListener('wheel', e => {
    e.preventDefault();
    e.stopPropagation();
    const [x, y] = fix(e.clientX, e.clientY);
    const target = under(x, y);
    if (target?.tagName === 'IFRAME' && intoFrame(target, 'wheel', x, y, e)) return;
    target?.dispatchEvent(new WheelEvent('wheel', {
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

  window.addEventListener('resize', updateHoles);
  const setStrength = k => { K = k; apply(); };
  return { apply, updateHoles, prepareFrame, setStrength };
}
