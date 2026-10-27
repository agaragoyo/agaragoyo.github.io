// 시작점. 모니터 크기 맞추기, 전원, 모드(꾸미기/구경) 전환을 맡는다.
import { STAGE_W, STAGE_H, STORAGE_ROOM, STORAGE_SETTINGS } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { renderItems } from './room.js';
import { mountShelf } from './shelf.js';
import { openWindow, closeAllWindows } from './win.js';
import { loadJSON, saveJSON, sanitizeRoom, encodeRoom, decodeRoom } from './share.js';

const $ = sel => document.querySelector(sel);
const stage = $('#stage');

const app = {
  stage,
  roomEl: $('#room'),
  itemsEl: $('#items'),
  winLayer: $('#windows'),
  itemEls: new Map(),
  scale: 1,
  mode: null, // 'edit' | 'visit'
  room: null,
  // 화면 좌표를 1280×840 무대 좌표로 바꾼다.
  toLocal(clientX, clientY) {
    const r = stage.getBoundingClientRect();
    return { x: (clientX - r.left) / app.scale, y: (clientY - r.top) / app.scale };
  },
  commit() {
    if (app.mode === 'edit') saveJSON(STORAGE_ROOM, app.room);
    render();
  },
  openItem(item) {
    const def = BY_ID[item.id];
    const zone = { wall: '벽에 거는 가구', floor: '바닥 가구', top: '책상 위에도 올릴 수 있는 가구' }[def.zone];
    openWindow(app, {
      key: item,
      title: def.name,
      build: body => {
        body.innerHTML = `
          <p>이 가구를 누르면 열리는 창입니다.
          나중에 미니게임이나 가구 기믹이 이 자리에 들어갑니다.</p>
          <p class="meta"></p>`;
        body.querySelector('.meta').textContent = `${def.size[0]}×${def.size[1]}칸, ${zone}`;
      },
    });
  },
};

// ---------- 화면 맞추기 ----------
// MARGIN: 화면 가장자리와 모니터 사이, PAD: 모니터 테두리 두께, CTRL: 테두리 아래 버튼 줄 높이.
// 폰처럼 짧은 변이 500px 미만인 화면에서는 테두리를 얇게 해 방을 조금이라도 크게 보여 준다.
function fit() {
  const small = Math.min(innerWidth, innerHeight) < 500;
  const [MARGIN, PAD, CTRL] = small ? [4, 8, 40] : [16, 26, 58];
  const root = document.documentElement.style;
  root.setProperty('--margin', MARGIN + 'px');
  root.setProperty('--pad', PAD + 'px');
  root.setProperty('--ctrl', CTRL + 'px');
  const availW = innerWidth - 2 * (MARGIN + PAD);
  const availH = innerHeight - 2 * MARGIN - PAD - CTRL;
  const s = Math.max(0.2, Math.min(availW / STAGE_W, availH / STAGE_H));
  app.scale = s;
  const screen = $('#screen');
  screen.style.width = STAGE_W * s + 'px';
  screen.style.height = STAGE_H * s + 'px';
  stage.style.transform = `scale(${s})`;
}
addEventListener('resize', fit);
fit();

// ---------- 테두리 버튼 설정 ----------
const settings = { grain: true, curve: true, ...loadJSON(STORAGE_SETTINGS) };
function applySettings() {
  for (const key of ['grain', 'curve']) {
    document.body.classList.toggle(key, !!settings[key]);
    $(`[data-toggle="${key}"]`).setAttribute('aria-pressed', String(!!settings[key]));
  }
}
document.querySelectorAll('[data-toggle]').forEach(btn => {
  btn.addEventListener('click', () => {
    settings[btn.dataset.toggle] = !settings[btn.dataset.toggle];
    saveJSON(STORAGE_SETTINGS, settings);
    applySettings();
  });
});
applySettings();

// ---------- 전원 ----------
// 소리를 나중에 넣을 때를 생각해, 사용자가 전원 버튼을 직접 누르게 해서 켠다.
// (브라우저는 첫 클릭 전까지 소리 재생을 막는다.)
const powerFx = $('#power-fx');
const powerBtn = $('#power');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let powered = false;
let booted = false;

function setPowerState(state) { powerFx.className = `power-fx ${state}`; }

powerFx.querySelector('.beam').addEventListener('animationend', () => {
  setPowerState(powered ? 'on' : 'off');
});

powerBtn.addEventListener('click', () => {
  powered = !powered;
  powerBtn.setAttribute('aria-pressed', String(powered));
  if (reduceMotion) setPowerState(powered ? 'on' : 'off');
  else setPowerState(powered ? 'turning-on' : 'turning-off');
  if (powered && !booted) { booted = true; boot(); }
});

// ---------- 모드 ----------
function boot() {
  const m = location.hash.match(/^#room=(.+)$/);
  if (m) {
    const room = decodeRoom(m[1]);
    if (room) { app.room = room; setMode('visit'); return; }
    toast('링크가 깨져서 친구 방을 열 수 없었습니다.');
  }
  enterOwnRoom();
}

function enterOwnRoom() {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  const saved = sanitizeRoom(loadJSON(STORAGE_ROOM));
  if (saved && saved.owner) { app.room = saved; setMode('edit'); }
  else showStart();
}

function setMode(mode) {
  closeAllWindows();
  app.mode = mode;
  document.body.dataset.mode = mode;
  $('#start').hidden = true;
  render();
}

function render() {
  renderItems(app);
  $('#owner').textContent = app.mode === 'visit'
    ? `${app.room.owner}의 방에 놀러 왔습니다`
    : `${app.room.owner}의 방`;
  const empty = app.mode === 'edit' && app.room.items.length === 0;
  $('.shelf').classList.toggle('hint', empty);
  if (empty) toast('아래 선반에서 가구를 끌어 방에 놓아 보세요.', 0);
  else if (toastSticky) hideToast();
}

function showStart() {
  delete document.body.dataset.mode;
  app.mode = null;
  $('#start').hidden = false;
  setTimeout(() => $('#nickname').focus(), 50);
}

$('#start-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#nickname').value.trim().slice(0, 12);
  if (!name) { $('#nickname').focus(); return; }
  app.room = { v: 1, owner: name, items: [] };
  saveJSON(STORAGE_ROOM, app.room);
  setMode('edit');
});

$('#btn-share').addEventListener('click', () => {
  const link = `${location.origin}${location.pathname}#room=${encodeRoom(app.room)}`;
  openWindow(app, {
    key: 'share',
    title: '공유 링크',
    width: 560,
    build: body => {
      body.innerHTML = `
        <p>이 링크를 받은 친구는 지금 모습 그대로 방을 구경할 수 있습니다.
        방을 고친 뒤에는 링크를 다시 복사해서 보내 주세요.</p>
        <div class="share-row">
          <input type="text" readonly aria-label="공유 링크">
          <button type="button" class="btn">복사</button>
        </div>`;
      const input = body.querySelector('input');
      input.value = link;
      body.querySelector('button').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(link); }
        catch { input.select(); document.execCommand('copy'); }
        toast('링크를 복사했습니다.');
      });
    },
  });
});

$('#btn-mine').addEventListener('click', enterOwnRoom);

// 열어 둔 채로 다른 방 링크를 붙여 넣은 경우
addEventListener('hashchange', () => { if (booted && location.hash.startsWith('#room=')) boot(); });

// ---------- 알림 ----------
let toastTimer = 0;
let toastSticky = false;
function toast(msg, ms = 2400) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastSticky = ms === 0;
  if (ms) toastTimer = setTimeout(hideToast, ms);
}
function hideToast() {
  toastSticky = false;
  $('#toast').classList.remove('show');
}

mountShelf(app);
