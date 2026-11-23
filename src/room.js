// 방 그리기와 가구 옮기기(끌어 놓기, 눌러서 집고 놓기).
import { N, WALL_ROWS, ROOM_H, DRAG_THRESHOLD, DOUBLE_CLICK_MS } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { canPlace, coversDoor, dims, supportOf, elevOf, isWall } from './rules.js';
import { toTile, fromWall, boxSize, placeEl, placeholderSVG, depthOf, sceneSVG, lightPoint } from './iso.js';
import { clamp, doubleClick } from './util.js';
import { play } from './sound.js';

// 가구 id마다 이미지가 있는지 한 번만 물어본다. 없으면 콘솔에 404가 가구당 한 줄 찍히는데 정상이다.
// 받은 그림(Image)은 kept에 붙잡아 둔다. 쓰는 곳이 없으면 브라우저가 메모리를 정리할 때 그림을 버리고, 방을 다시 그릴 때
// 서버에서 새로 받느라 가구가 늦게 뜬다(known-issues 56). 개발 서버(no-store)는 바로 버리고, 배포 사이트도 10분(max-age)이 지나면 다시 묻는다.
const probes = new Map();
const kept = new Map();
function hasImage(id) {
  if (!probes.has(id)) {
    probes.set(id, new Promise(resolve => {
      const img = new Image();
      img.onload = () => { kept.set(id, img); resolve(true); };
      img.onerror = () => resolve(false);
      img.src = `assets/furniture/${id}.png`;
    }));
  }
  return probes.get(id);
}

// 집들(homes)에 놓인 가구의 그림을 미리 받기 시작한다. 전원을 켤 때(os.js의 boot) 로그인 화면에서 고를 수 있는 집들을 넘긴다.
// 그림은 가구를 처음 그릴 때 받기 시작해서, 미리 받지 않으면 바탕화면이 처음 뜰 때 그림이 올 때까지 임시 상자가 보인다(known-issues 54).
// 부팅 화면(2초)과 로그인 화면을 지나는 동안 다 받아 두면 바탕화면에서는 처음부터 그림이 보인다.
// 놓인 가구만 받으므로 그림이 없는 가구의 404는 그 집을 그릴 때와 똑같이 찍히고 늘지 않는다. 돌려 놓은 가구는 돌린 그림(-r)부터 찾는다(imageFor).
export function preloadFurniture(homes) {
  for (const home of homes) {
    for (const it of Object.values(home.scenes || {}).flat()) {
      if (it.r) hasImage(`${it.id}-r`);
      hasImage(it.id);
    }
  }
}

// 가구 한 개에 쓸 그림 파일. 돌려 놓았으면(r: 1) 돌린 그림(<id>-r.png)이 있으면 그걸, 없으면 원래 그림을 좌우로 뒤집어(mirror) 쓴다.
// 그림이 하나도 없으면 null이고, 그때는 임시 모양을 보여 준다. 방 그림을 파일로 만들 때(room-image.js)도 이 규칙을 그대로 쓴다.
export async function imageFor(id, r = 0) {
  if (r) {
    if (await hasImage(`${id}-r`)) return { name: `${id}-r`, mirror: false };
    return (await hasImage(id)) ? { name: id, mirror: true } : null;
  }
  return (await hasImage(id)) ? { name: id, mirror: false } : null;
}

// 그림의 칠해진 모양(클릭을 받을 곳). 그림을 OUTLINE_BANDS개의 가로 띠로 나눠, 띠마다 칠해진 왼쪽 끝과 오른쪽 끝을
// 계단처럼 이은 다각형이다(그림 px). 칠해진 곳은 모두 들어가고, 다리 사이처럼 안쪽에 난 빈틈은 그대로 둔다.
const OUTLINE_BANDS = 40;
const outlines = new Map();
function outlineOf(name) {
  if (!outlines.has(name)) {
    outlines.set(name, new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const g = canvas.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        const data = g.getImageData(0, 0, w, h).data;
        const left = [];
        const right = [];
        for (let b = 0; b < OUTLINE_BANDS; b++) {
          const y0 = Math.floor((b * h) / OUTLINE_BANDS);
          const y1 = Math.floor(((b + 1) * h) / OUTLINE_BANDS);
          let l = w;
          let r = -1;
          for (let y = y0; y < y1; y++) {
            for (let x = 0; x < w; x++) {
              if (data[(y * w + x) * 4 + 3] > 8) { l = Math.min(l, x); r = Math.max(r, x); }
            }
          }
          if (r < 0) continue;
          left.push([l, y0], [l, y1]);
          right.push([r + 1, y0], [r + 1, y1]);
        }
        resolve(left.length ? { w, h, pts: [...left, ...right.reverse()] } : null);
      };
      img.onerror = () => resolve(null);
      img.src = `assets/furniture/${name}.png`;
    }));
  }
  return outlines.get(name);
}

// 가구 한 개의 겉모습. assets/furniture/<id>.png 가 있으면 그림을, 없으면 임시 모양을 보여 준다.
// r: 돌려 놓았으면 1. 어떤 그림 파일을 쓸지는 imageFor가 정한다.
export function furnitureEl(id, r = 0) {
  const def = BY_ID[id];
  const el = document.createElement('div');
  el.className = 'furn';
  el.dataset.id = id;
  const { w, h } = boxSize(def, r);
  el.style.width = w + 'px';
  el.style.height = h + 'px';
  el.innerHTML = placeholderSVG(def, r);
  const show = (name, mirror) => {
    const img = new Image();
    img.className = mirror ? 'mirror' : '';
    img.alt = '';
    img.draggable = false;
    img.src = `assets/furniture/${name}.png`;
    // 클릭은 그림 위에 겹친 상자가 받는다. 그림의 칠해진 모양대로 잘라 두어, 투명한 여백을 누르면 뒤의 가구가 눌린다.
    const hit = document.createElement('div');
    hit.className = mirror ? 'hit furn-hit mirror' : 'hit furn-hit';
    // 밤 그림(night)과 쓰는 동안의 그림(open)은 원래 그림 위에 겹쳐 두고, 그때만 CSS가 보인다(style.css의 .furn img.night)
    const layers = ['night', 'open'].filter(k => def[k]).map(k => {
      const layer = new Image();
      layer.className = mirror ? `${k} mirror` : k;
      layer.alt = '';
      layer.draggable = false;
      layer.src = `assets/furniture/${name}-${k}.png`;
      return layer;
    });
    el.replaceChildren(img, ...layers, hit);
    outlineOf(name).then(o => {
      if (!o) return;
      // 그림은 상자에 맞춰 줄고 아래 가운데에 붙는다(style.css의 .furn img)
      const s = Math.min(w / o.w, h / o.h);
      const dx = (w - o.w * s) / 2;
      const dy = h - o.h * s;
      hit.style.clipPath = `polygon(${o.pts.map(([x, y]) => `${(dx + x * s).toFixed(1)}px ${(dy + y * s).toFixed(1)}px`).join(', ')})`;
    });
  };
  imageFor(id, r).then(src => { if (src) show(src.name, src.mirror); });
  return el;
}

// 공간 배경을 그린다(공간을 바꿀 때도 부른다). scene: config.js의 SCENES 한 줄
export function setSceneBg(app, scene) {
  app.roomEl.querySelector('.room-bg')?.remove();
  app.roomEl.insertAdjacentHTML('afterbegin', sceneSVG(scene, app.decor));
}

// 밤 그늘: 공간 전체를 덮는 어두운 층에, 불빛 가구 둘레만 구멍을 낸다(밤이 아니면 CSS가 숨긴다).
function renderShade(container, items) {
  let shade = container.querySelector(':scope > .night-shade');
  if (!shade) {
    shade = document.createElement('div');
    shade.className = 'night-shade';
    container.append(shade);
  }
  const holes = items.filter(it => BY_ID[it.id].light).map(it => {
    const p = lightPoint(it, elevOf(items, it));
    return `radial-gradient(circle 260px at ${p.x}px ${p.y}px, transparent 0, transparent 22%, #000 100%)`;
  });
  const mask = holes.length ? holes.join(', ') : '';
  shade.style.maskImage = mask;
  shade.style.webkitMaskImage = mask;
}

// 바탕화면에 그린 가구 상자에서 그 가구 줄(item)을 찾는다. 오른쪽 단추 메뉴(src/os.js의 menuFor)가 누른 가구를 알아낼 때 쓴다
const STATIC_ITEMS = new WeakMap();
export const staticItem = el => STATIC_ITEMS.get(el);

// 바탕화면 배경의 공간 그림 한 장. container 는 1280×720 크기여야 한다. scene: config.js의 SCENES 한 줄.
// 두 번 누르면 on에 넘긴 함수를 부른다(아바타가 그 옆으로 걸어가 쓴다).
//   on.use(item, el)  가구          on.door(door)  방의 현관문(이웃집 목록 창을 띄운다)
// on.use의 el은 그 가구의 상자다. 가까이 보기가 그 자리에서 커지며 다가온다(src/closeup.js).
// 한 번 누르기는 바닥을 눌러 걷기와 헷갈리지 않게 아무것도 하지 않는다(바탕화면 아이콘처럼 두 번 눌러 연다).
// 두 번 누르기는 바탕화면 아이콘과 같이 클릭 간격으로 직접 잰다(src/util.js의 doubleClick).
// decor: 이 집의 방 꾸밈(벽지). 집 상태의 decor 그대로다
export function renderStatic(container, items, scene, on = {}, decor = null) {
  container.innerHTML = sceneSVG(scene, decor);
  const twice = doubleClick();
  const onTwice = (what, use) => () => { if (twice(what)) use(); };
  container.querySelector('.door-hit')?.addEventListener('click', onTwice(scene.door, () => on.door?.(scene.door)));
  for (const item of items) {
    const def = BY_ID[item.id];
    const el = furnitureEl(item.id, item.r);
    STATIC_ITEMS.set(el, item);
    el.classList.add('item', 'static', 'usable');
    if (def.light) el.classList.add('light');
    el.addEventListener('click', onTwice(item, () => on.use?.(item, el)));
    placeEl(el, item, elevOf(items, item));
    el.style.zIndex = zOf(items, item);
    container.append(el);
  }
  renderShade(container, items);
}

export function renderItems(app) {
  const items = app.room.items;
  app.itemEls.clear();
  app.itemsEl.replaceChildren();
  for (const item of items) {
    const el = furnitureEl(item.id, item.r);
    el.classList.add('item');
    if (BY_ID[item.id].light) el.classList.add('light');
    placeEl(el, item, elevOf(items, item));
    el.style.zIndex = zOf(items, item);
    el.addEventListener('pointerdown', e => onItemDown(app, item, e));
    app.itemEls.set(item, el);
    app.itemsEl.append(el);
  }
  renderShade(app.roomEl, items);
}

// 벽 가구는 늘 뒤에, 바닥 가구는 앞(화면 아래)에 있을수록 위에 그린다.
// 책상 위의 물건은 책상 바로 위 순서로 그린다.
export function zOf(items, item) {
  if (isWall(item)) return 1 + item.y;
  const s = supportOf(items, item);
  if (s) return zOf(items, s) + 1 + Math.round(depthOf(item) * 3);
  return 100 + Math.round(depthOf(item) * 100);
}

// 가구의 어느 칸을 쥐었는지(누른 자리 p와 가구 자리의 칸 좌표 차이). 끌기와 집기가 같이 쓴다
function grabOf(app, item, p) {
  if (isWall(item)) {
    const f = fromWall(p.x, p.y);
    return { u: f.u - item.x, v: f.v - item.y };
  }
  const t = toTile(p.x, p.y, elevOf(app.room.items, item));
  return { x: t.x - item.x, y: t.y - item.y, elev: 0 };
}

// 누르고 조금만 움직이면 끌기, 움직이지 않고 떼면 집기(beginDrag의 carry). 끌기를 정확히 하기 어려운 사람도 옮기도록
// 누르기로도 옮긴다(WCAG 2.5.7). 방 꾸미기는 꾸미는 화면이라 가구를 눌러도 기믹을 쓰지 않는다(바탕화면에서 쓴다).
// 친구 집을 구경하는 창에서는 가구를 옮기지 않고, 누르면 바탕화면에서 쓰라고 알려 준다.
function onItemDown(app, item, e) {
  if (e.button !== 0 || app.dragging) return;
  e.preventDefault();
  const start = app.toLocal(e.clientX, e.clientY);
  const cleanup = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  const move = ev => {
    if (app.mode !== 'edit') return;
    const p = app.toLocal(ev.clientX, ev.clientY);
    if (Math.hypot(p.x - start.x, p.y - start.y) < DRAG_THRESHOLD) return;
    cleanup();
    beginDrag(app, { item, grab: grabOf(app, item, start), ev });
  };
  const up = ev => {
    cleanup();
    if (app.mode === 'edit') beginDrag(app, { item, grab: grabOf(app, item, start), ev, carry: true });
    else app.pressItem(item);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

// 선반에서 꺼낼 때 가구를 어디쯤 잡은 것으로 볼지 (가구 그림의 가운데)
export function shelfGrab(def) {
  if (def.zone === 'wall') return { u: def.size[0] / 2, v: def.size[1] / 2 };
  return { x: def.size[0] / 2, y: def.size[1] / 2, elev: def.height / 2 };
}

// 선반에서 새 가구를 꺼낼 때는 id 를, 방의 가구를 옮길 때는 item 을 넘긴다.
// grab: 벽 가구는 { u, v }, 바닥 가구는 { x, y, elev } (잡은 지점의 칸 좌표 차이)
// carry: 눌렀다 떼서 집었다. 단추를 뗀 채로 그림이 포인터를 따라오고, 방을 누르면 놓고 선반을 누르면 선반에 넣는다(끌어서 선반에 놓을 때와 같다).
//   놓을 수 없는(빨간) 자리를 누르면 놓지 않고 계속 들고 있다. 오른쪽 단추, Esc 키, 방 꾸미기 창 밖을 누르면 그만둔다(가구는 제자리).
//   방의 가구를 집자마자 그 자리를 다시 누르면 두 번 누르기로 보고, 제자리에 둔 채 바탕화면에서 쓰라고 알린다(app.pressItem).
//   Esc는 끄는 동안에도 그만두기다.
// card: 꺼낸 선반 카드. 놓거나 그만둘 때까지 눌린 모양으로 둔다.
export function beginDrag(app, { id, item = null, grab, ev, carry = false, card = null }) {
  if (app.dragging) return; // 드래그는 한 번에 하나만
  app.dragging = true;
  const items = app.room.items;
  const leadId = item ? item.id : id;
  const lead = BY_ID[leadId];
  // 책상을 옮기면 그 위의 물건도 같이 옮긴다.
  const group = item ? [item, ...(lead.surface ? items.filter(o => supportOf(items, o) === item) : [])] : [];
  const others = items.filter(o => !group.includes(o));

  const ghost = document.createElement('div');
  ghost.className = carry ? 'ghost carry' : 'ghost'; // carry인 동안은 창 안의 누르기를 이 층이 모두 받는다(style.css)
  // 끄는 동안 R 키나 마우스 휠로 돌린다(바닥 가구만, 위에 물건을 얹은 책상은 빼고).
  // 칸이 정사각형인 가구도 돌린다. 차지하는 칸은 그대로지만 그림은 좌우로 뒤집혀 다른 쪽을 본다(1인 소파, 디카처럼 방향이 있는 그림).
  let rot = item?.r ? 1 : 0;
  const canRotate = lead.zone !== 'wall' && group.length <= 1;
  const ghostEls = [{ id: leadId, r: rot }, ...group.slice(1)].map(g => {
    const el = furnitureEl(g.id, g.r);
    el.classList.add('item');
    ghost.append(el);
    return el;
  });
  app.root.append(ghost);
  for (const g of group) app.itemEls.get(g)?.classList.add('lifted');
  card?.classList.add('picked');
  app.roomEl.classList.add('dragging');
  app.root.classList.toggle('carrying', carry); // 방 꾸미기 창의 안내 줄이 그만두는 법으로 바뀐다
  document.body.classList.add('grabbing');

  let result = null; // { action: 'place' | 'remove', moved }

  const candidate = p => {
    const [w, d] = rot ? [lead.size[1], lead.size[0]] : lead.size;
    if (lead.zone === 'wall') {
      const f = fromWall(p.x, p.y);
      return [{
        id: leadId,
        wall: f.wall,
        x: clamp(Math.round(f.u - grab.u), 0, N - w),
        y: clamp(Math.round(f.v - grab.v), 0, WALL_ROWS - d),
      }];
    }
    let x;
    let y;
    let placed = false;
    if (lead.zone === 'top') {
      // 책상 윗면을 가리키면 그 위에 얹는다. 앞쪽 책상부터 본다.
      const surfaces = others.filter(o => !isWall(o) && BY_ID[o.id].surface).sort((a, b) => depthOf(b) - depthOf(a));
      for (const s of surfaces) {
        const [sw, sd] = dims(s); // 돌려 놓은 책상은 가로와 세로가 바뀐다
        const t = toTile(p.x, p.y, BY_ID[s.id].height + grab.elev);
        if (t.x < s.x - 0.3 || t.x > s.x + sw + 0.3 || t.y < s.y - 0.3 || t.y > s.y + sd + 0.3) continue;
        x = clamp(Math.round(t.x - grab.x), s.x, s.x + sw - w);
        y = clamp(Math.round(t.y - grab.y), s.y, s.y + sd - d);
        placed = true;
        break;
      }
    }
    if (!placed) {
      const t = toTile(p.x, p.y, grab.elev);
      x = clamp(Math.round(t.x - grab.x), 0, N - w);
      y = clamp(Math.round(t.y - grab.y), 0, N - d);
    }
    const moved = [{ id: leadId, x, y, ...(rot ? { r: 1 } : {}) }];
    for (const c of group.slice(1)) moved.push({ id: c.id, x: x + c.x - item.x, y: y + c.y - item.y, ...(c.r ? { r: 1 } : {}) });
    return moved;
  };

  // 현관문 자리(config.js의 SCENES door)에는 벽 가구를 새로 걸 수 없다. 불러올 때는 막지 않으므로 여기서만 본다(src/rules.js의 coversDoor)
  const valid = (base, moved) =>
    moved.every((m, i) => canPlace([...base, ...moved.filter((_, j) => j !== i)], m) && !coversDoor(app.scene, m));

  const update = (clientX, clientY) => {
    const p = app.toLocal(clientX, clientY);
    if (p.y > ROOM_H) {
      // 선반 위로 가져가면 치우기
      ghost.dataset.state = item ? 'remove' : 'idle';
      result = item ? { action: 'remove' } : null;
      return;
    }
    const moved = candidate(p);
    const ok = valid(others, moved);
    const all = [...others, ...moved];
    moved.forEach((m, i) => placeEl(ghostEls[i], m, elevOf(all, m)));
    ghost.dataset.state = ok ? 'ok' : 'bad';
    result = ok ? { action: 'place', moved } : null;
  };

  let last = { x: ev.clientX, y: ev.clientY };
  let lastWheel = 0;
  const rotate = () => {
    if (!canRotate) return;
    rot ^= 1;
    const el = furnitureEl(leadId, rot);
    el.classList.add('item');
    ghostEls[0].replaceWith(el);
    ghostEls[0] = el;
    update(last.x, last.y);
  };
  // 한글 입력 상태에서도 같게 동작하도록 글자(e.key) 대신 자리(e.code)로 읽는다(아바타의 WASD와 같다).
  // Ctrl+R(새로 고침)처럼 조합 키를 누른 것은 브라우저 단축키라 건드리지 않는다(known-issues 37).
  const onKey = e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
      return;
    }
    if (e.code !== 'KeyR' || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    rotate();
  };
  const onWheel = e => {
    e.preventDefault();
    const now = performance.now();
    if (now - lastWheel > 180) { lastWheel = now; rotate(); }
  };

  // 들고 있는 동안(carry)의 누르기. 왼쪽 단추를 누르면 떼는 자리에 놓는다(누른 채 끌다가 떼도 된다).
  // 방 꾸미기 창 밖(제목 줄, 작업 표시줄, 튜토리얼 카드)을 누르면 그만두고, 그 누르기는 원래 받을 곳이 그대로 받는다.
  let armed = false;
  const picked = { at: performance.now(), x: ev.clientX, y: ev.clientY };
  const onDown = e => {
    if (!ghost.contains(e.target)) return finish(false);
    e.preventDefault();
    if (e.button === 0) {
      armed = true;
      move(e);
    } else if (e.button === 2) finish(false); // 뒤따르는 contextmenu는 창 안이라 메뉴를 띄우지 않는다(src/os.js의 menuFor)
  };
  // 다른 프로그램이나 다른 창 안의 게임(iframe)으로 초점이 넘어가도 그만둔다. iframe 안의 누르기는 이 문서에 오지 않는다(known-issues 36)
  const onBlur = () => finish(false);

  let done = false;
  // closing: 방 꾸미기 창이 닫힌다(app.stopDrag). 방은 그대로라 저장하고 다시 그리지 않는다
  const finish = (commit, closing = false) => {
    if (done) return;
    done = true;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('wheel', onWheel);
    ghost.remove();
    card?.classList.remove('picked');
    app.root.classList.remove('carrying');
    app.roomEl.classList.remove('dragging');
    document.body.classList.remove('grabbing');
    app.dragging = false;
    app.stopDrag = null;
    if (closing) return;
    // 드래그하는 사이에 방이 바뀌었을 수 있으니 놓는 순간 한 번 더 검사한다.
    if (result?.action === 'place' && !valid(app.room.items.filter(o => !group.includes(o)), result.moved)) {
      result = null;
    }
    if (commit && result?.action === 'remove') {
      app.room.items = app.room.items.filter(o => !group.includes(o));
    } else if (commit && result?.action === 'place') {
      play('furniture');
      if (item) {
        group.forEach((g, i) => {
          Object.assign(g, result.moved[i]);
          if (!result.moved[i].r) delete g.r;
        });
      }
      else app.room.items.push(result.moved[0]);
    }
    app.commit();
  };
  const move = e => { last = { x: e.clientX, y: e.clientY }; update(e.clientX, e.clientY); };
  const up = e => {
    if (!carry) return finish(true);
    if (!armed) return; // 집으려고 누른 단추를 뗀 것이다
    armed = false;
    move(e);
    if (ghost.dataset.state === 'bad') return;
    if (item && performance.now() - picked.at < DOUBLE_CLICK_MS && Math.hypot(e.clientX - picked.x, e.clientY - picked.y) < DRAG_THRESHOLD) {
      finish(false);
      app.pressItem(item);
      return;
    }
    finish(true);
  };
  const cancel = () => {
    if (carry) armed = false;
    else finish(false);
  };
  app.stopDrag = () => finish(false, true);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  if (carry) {
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('blur', onBlur);
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('wheel', onWheel, { passive: false });
  update(ev.clientX, ev.clientY);
}
