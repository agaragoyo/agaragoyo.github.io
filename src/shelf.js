// 화면 아래 가구 선반. 좌우 화살표나 마우스 휠로 넘기고, 카드를 끌어 방에 놓는다.
import { CELL, DRAG_THRESHOLD } from './config.js';
import { FURNITURE } from '../data/furniture.js';
import { furnitureEl, beginDrag } from './room.js';

const THUMB = 60; // 카드 안 미리보기 크기 (px)

export function mountShelf(app) {
  const shelf = app.stage.querySelector('.shelf');
  const track = shelf.querySelector('.shelf-track');
  const [prev, next] = shelf.querySelectorAll('.shelf-arrow');

  for (const def of FURNITURE) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    const thumb = document.createElement('div');
    thumb.className = 'card-thumb';
    const f = furnitureEl(def.id);
    const s = Math.min(THUMB / (def.size[0] * CELL), THUMB / (def.size[1] * CELL));
    f.style.transform = `translate(-50%, -50%) scale(${s})`;
    thumb.append(f);
    const name = document.createElement('span');
    name.textContent = def.name;
    card.append(thumb, name);
    card.addEventListener('pointerdown', e => onCardDown(app, def, e));
    track.append(card);
  }

  const step = () => track.clientWidth * 0.8;
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  track.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { track.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false });
  const syncArrows = () => {
    prev.disabled = track.scrollLeft <= 0;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
  };
  track.addEventListener('scroll', syncArrows);
  window.addEventListener('resize', syncArrows);
  syncArrows();
}

function onCardDown(app, def, e) {
  if (e.button !== 0 || app.mode !== 'edit') return;
  e.preventDefault();
  const start = { x: e.clientX, y: e.clientY };
  const cleanup = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', cleanup);
  };
  const move = ev => {
    if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD) return;
    cleanup();
    const [w, h] = def.size;
    beginDrag(app, { id: def.id, grab: { x: (w * CELL) / 2, y: (h * CELL) / 2 }, ev });
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', cleanup);
}
