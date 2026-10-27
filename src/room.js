// 방 그리기와 가구 끌어 놓기.
import { N, WALL_ROWS, ROOM_H, DRAG_THRESHOLD } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { canPlace, supportOf, elevOf, isWall } from './rules.js';
import { toTile, fromWall, boxSize, placeEl, placeholderSVG, depthOf, roomSVG } from './iso.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 가구 id마다 이미지가 있는지 한 번만 물어본다. 없으면 콘솔에 404가 가구당 한 줄 찍히는데 정상이다.
const probes = new Map();
function hasImage(id) {
  if (!probes.has(id)) {
    probes.set(id, new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = `assets/furniture/${id}.png`;
    }));
  }
  return probes.get(id);
}

// 가구 한 개의 겉모습. assets/furniture/<id>.png 가 있으면 그림을, 없으면 임시 모양을 보여 준다.
export function furnitureEl(id) {
  const def = BY_ID[id];
  const el = document.createElement('div');
  el.className = 'furn';
  const { w, h } = boxSize(def);
  el.style.width = w + 'px';
  el.style.height = h + 'px';
  el.innerHTML = placeholderSVG(def);
  hasImage(id).then(ok => {
    if (!ok) return;
    const img = new Image();
    img.className = 'hit';
    img.alt = '';
    img.draggable = false;
    img.src = `assets/furniture/${id}.png`;
    el.replaceChildren(img);
  });
  return el;
}

export function mountRoom(app) {
  app.roomEl.insertAdjacentHTML('afterbegin', roomSVG());
}

export function renderItems(app) {
  const items = app.room.items;
  app.itemEls.clear();
  app.itemsEl.replaceChildren();
  for (const item of items) {
    const el = furnitureEl(item.id);
    el.classList.add('item');
    placeEl(el, item, elevOf(items, item));
    el.style.zIndex = zOf(items, item);
    el.addEventListener('pointerdown', e => onItemDown(app, item, e));
    app.itemEls.set(item, el);
    app.itemsEl.append(el);
  }
}

// 벽 가구는 늘 뒤에, 바닥 가구는 앞(화면 아래)에 있을수록 위에 그린다.
// 책상 위의 물건은 책상 바로 위 순서로 그린다.
function zOf(items, item) {
  if (isWall(item)) return 1 + item.y;
  const s = supportOf(items, item);
  if (s) return zOf(items, s) + 1 + Math.round(depthOf(item) * 3);
  return 100 + Math.round(depthOf(item) * 100);
}

// 누르고 조금만 움직이면 드래그, 그대로 떼면 클릭(창 열기).
function onItemDown(app, item, e) {
  if (e.button !== 0) return;
  e.preventDefault();
  const start = app.toLocal(e.clientX, e.clientY);
  let dragging = false;
  const cleanup = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  const move = ev => {
    if (app.mode !== 'edit') return;
    const p = app.toLocal(ev.clientX, ev.clientY);
    if (Math.hypot(p.x - start.x, p.y - start.y) < DRAG_THRESHOLD) return;
    dragging = true;
    cleanup();
    let grab;
    if (isWall(item)) {
      const f = fromWall(start.x, start.y);
      grab = { u: f.u - item.x, v: f.v - item.y };
    } else {
      const t = toTile(start.x, start.y, elevOf(app.room.items, item));
      grab = { x: t.x - item.x, y: t.y - item.y, elev: 0 };
    }
    beginDrag(app, { item, grab, ev });
  };
  const up = () => {
    cleanup();
    if (!dragging) app.openItem(item);
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
export function beginDrag(app, { id, item = null, grab, ev }) {
  if (app.dragging) return; // 드래그는 한 번에 하나만
  app.dragging = true;
  const items = app.room.items;
  const leadId = item ? item.id : id;
  const lead = BY_ID[leadId];
  // 책상을 옮기면 그 위의 물건도 같이 옮긴다.
  const group = item ? [item, ...(lead.surface ? items.filter(o => supportOf(items, o) === item) : [])] : [];
  const others = items.filter(o => !group.includes(o));

  const ghost = document.createElement('div');
  ghost.className = 'ghost';
  const ghostEls = [leadId, ...group.slice(1).map(g => g.id)].map(gid => {
    const el = furnitureEl(gid);
    el.classList.add('item');
    ghost.append(el);
    return el;
  });
  app.stage.append(ghost);
  for (const g of group) app.itemEls.get(g)?.classList.add('lifted');
  app.roomEl.classList.add('dragging');
  document.body.classList.add('grabbing');

  let result = null; // { action: 'place' | 'remove', moved }

  const candidate = p => {
    const [w, d] = lead.size;
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
        const [sw, sd] = BY_ID[s.id].size;
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
    const moved = [{ id: leadId, x, y }];
    for (const c of group.slice(1)) moved.push({ id: c.id, x: x + c.x - item.x, y: y + c.y - item.y });
    return moved;
  };

  const valid = (base, moved) =>
    moved.every((m, i) => canPlace([...base, ...moved.filter((_, j) => j !== i)], m));

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

  const finish = commit => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    ghost.remove();
    app.roomEl.classList.remove('dragging');
    document.body.classList.remove('grabbing');
    app.dragging = false;
    // 드래그하는 사이에 방이 바뀌었을 수 있으니 놓는 순간 한 번 더 검사한다.
    if (result?.action === 'place' && !valid(app.room.items.filter(o => !group.includes(o)), result.moved)) {
      result = null;
    }
    if (commit && result?.action === 'remove') {
      app.room.items = app.room.items.filter(o => !group.includes(o));
    } else if (commit && result?.action === 'place') {
      if (item) group.forEach((g, i) => Object.assign(g, result.moved[i]));
      else app.room.items.push(result.moved[0]);
    }
    app.commit();
  };
  const move = e => update(e.clientX, e.clientY);
  const up = () => finish(true);
  const cancel = () => finish(false);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  update(ev.clientX, ev.clientY);
}
