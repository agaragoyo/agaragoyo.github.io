// 방 그리기와 가구 끌어 놓기.
import { CELL, COLS, ROWS, ROOM_H, DRAG_THRESHOLD } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { canPlace, supportOf, sizeOf } from './rules.js';

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
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 가구 한 개의 겉모습. assets/furniture/<id>.png 가 있으면 그림을, 없으면 색 상자를 보여 준다.
export function furnitureEl(id) {
  const def = BY_ID[id];
  const el = document.createElement('div');
  el.className = 'furn';
  el.style.width = def.size[0] * CELL + 'px';
  el.style.height = def.size[1] * CELL + 'px';
  el.style.setProperty('--c', def.color);
  const label = document.createElement('span');
  label.className = 'furn-label';
  label.textContent = def.name;
  el.append(label);
  hasImage(id).then(ok => {
    if (!ok) return;
    const img = new Image();
    img.alt = '';
    img.draggable = false;
    img.src = `assets/furniture/${id}.png`;
    el.prepend(img);
    el.classList.add('has-img');
  });
  return el;
}

function place(el, item) {
  const [, h] = sizeOf(item);
  el.style.left = item.x * CELL + 'px';
  el.style.top = item.y * CELL + 'px';
  // 정면 시점이라 밑변이 화면 아래쪽에 있는 가구일수록 앞에 그린다.
  el.style.zIndex = BY_ID[item.id].zone === 'wall' ? 1 + item.y : 20 + item.y + h;
}

export function renderItems(app) {
  app.itemEls.clear();
  app.itemsEl.replaceChildren();
  for (const item of app.room.items) {
    const el = furnitureEl(item.id);
    el.classList.add('item');
    place(el, item);
    el.addEventListener('pointerdown', e => onItemDown(app, item, e));
    app.itemEls.set(item, el);
    app.itemsEl.append(el);
  }
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
    beginDrag(app, { item, grab: { x: start.x - item.x * CELL, y: start.y - item.y * CELL }, ev });
  };
  const up = () => {
    cleanup();
    if (!dragging) app.openItem(item);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

// 선반에서 새 가구를 꺼낼 때는 id 를, 방의 가구를 옮길 때는 item 을 넘긴다.
// grab: 가구 왼쪽 위 모서리에서 잡은 지점까지의 거리(px)
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
  ghost.append(furnitureEl(leadId));
  for (const c of group.slice(1)) {
    const ce = furnitureEl(c.id);
    ce.style.position = 'absolute';
    ce.style.left = (c.x - item.x) * CELL + 'px';
    ce.style.top = (c.y - item.y) * CELL + 'px';
    ghost.append(ce);
  }
  app.stage.append(ghost);
  for (const g of group) app.itemEls.get(g)?.classList.add('lifted');
  app.roomEl.classList.add('dragging');
  document.body.classList.add('grabbing');

  let result = null; // { action: 'place' | 'remove', moved }
  const [w, h] = lead.size;

  const update = (clientX, clientY) => {
    const p = app.toLocal(clientX, clientY);
    if (p.y > ROOM_H) {
      // 선반 위로 가져가면 치우기
      ghost.style.left = p.x - grab.x + 'px';
      ghost.style.top = p.y - grab.y + 'px';
      ghost.dataset.state = item ? 'remove' : 'idle';
      result = item ? { action: 'remove' } : null;
      return;
    }
    let x = clamp(Math.round((p.x - grab.x) / CELL), 0, COLS - w);
    let y = clamp(Math.round((p.y - grab.y) / CELL), 0, ROWS - h);
    if (lead.zone === 'top') {
      // 책상 근처로 가져가면 책상 위에 얹는다.
      const s = others.find(o => {
        if (!BY_ID[o.id].surface) return false;
        const [sw, sh] = sizeOf(o);
        const bottom = y + h - 1;
        return x < o.x + sw && x + w > o.x && bottom >= o.y - 2 && bottom <= o.y + sh - 1;
      });
      if (s) {
        x = clamp(x, s.x, s.x + sizeOf(s)[0] - w);
        y = s.y - h;
      }
    }
    const moved = [{ id: leadId, x, y }];
    for (const c of group.slice(1)) moved.push({ id: c.id, x: x + c.x - item.x, y: y + c.y - item.y });
    const ok = moved.every((m, i) => canPlace([...others, ...moved.filter((_, j) => j !== i)], m));
    ghost.style.left = x * CELL + 'px';
    ghost.style.top = y * CELL + 'px';
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
    if (result?.action === 'place') {
      const now = app.room.items.filter(o => !group.includes(o));
      const ok = result.moved.every((m, i) => canPlace([...now, ...result.moved.filter((_, j) => j !== i)], m));
      if (!ok) result = null;
    }
    if (commit && result?.action === 'remove') {
      app.room.items = app.room.items.filter(o => !group.includes(o));
    } else if (commit && result?.action === 'place') {
      if (item) group.forEach((g, i) => { g.x = result.moved[i].x; g.y = result.moved[i].y; });
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
