// 화면 아래 가구 선반. 좌우 화살표나 마우스 휠로 넘기고, 카드를 끌어 방에 놓는다.
import { DRAG_THRESHOLD } from './config.js';
import { FURNITURE } from '../data/furniture.js';
import { furnitureEl, beginDrag, shelfGrab } from './room.js';
import { boxSize } from './iso.js';

const THUMB = 60; // 카드 안 미리보기 크기 (px)

export function mountShelf(app) {
  const shelf = app.root.querySelector('.shelf');
  const track = shelf.querySelector('.shelf-track');
  const [prev, next] = shelf.querySelectorAll('.shelf-arrow');

  for (const def of FURNITURE) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    card.dataset.scene = def.scene;
    const thumb = document.createElement('div');
    thumb.className = 'card-thumb';
    const f = furnitureEl(def.id);
    const { w, h } = boxSize(def);
    const s = Math.min(THUMB / w, THUMB / h, 1);
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
  app.syncShelf = syncArrows;
  syncArrows();
}

// 지금 공간에 놓을 수 있는 가구만 선반에 남긴다.
export function filterShelf(app, sceneId) {
  const track = app.root.querySelector('.shelf-track');
  for (const card of track.children) card.hidden = card.dataset.scene !== sceneId;
  track.scrollLeft = 0;
  app.syncShelf?.();
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
    beginDrag(app, { id: def.id, grab: shelfGrab(def), ev });
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', cleanup);
}
