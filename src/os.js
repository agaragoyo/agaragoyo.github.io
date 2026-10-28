// 아가라고요 OS. 전원을 켜면 부팅, 로그인, 바탕화면 순서로 진행하고 앱을 창으로 띄운다.
//   mode: 'edit'  내 컴퓨터 (방을 꾸미고 저장한다)
//         'visit' 공유 링크로 들어온 친구 컴퓨터 (보기만 한다)
import { STORAGE_ROOM, STORAGE_ROOM_OLD, STORAGE_SETTINGS } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { APPS, APP_BY_ID } from '../data/apps.js';
import { createWM } from './win.js';
import { iconEl } from './icons.js';
import { renderStatic } from './room.js';
import { openRoomApp } from './apps/room-app.js';
import { loadJSON, saveJSON, sanitizeHome, encodeHome, decodeHome } from './share.js';

const DOUBLE_CLICK_MS = 400;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, ms));

export function createOS({ stage, toStage, requestPowerOff, crt, getNight, setNight, getEra }) {
  const $ = sel => stage.querySelector(sel);
  const el = {
    boot: $('#boot'),
    login: $('#login'),
    desktop: $('#desktop'),
    wallpaper: $('#wallpaper'),
    icons: $('#icons'),
    taskbar: $('#taskbar'),
    startMenu: $('#start-menu'),
    toast: $('#toast'),
  };

  const os = {
    stage,
    toStage,
    home: null,
    mode: null,
    wm: createWM({
      layer: $('#windows'),
      tasks: $('#tasks'),
      toLocal: toStage,
      onChange: () => crt.updateHoles(),
    }),
  };
  let run = 0; // 전원을 끄거나 로그아웃하면 늘려서, 진행 중이던 연출을 멈춘다

  function show(...names) {
    for (const k of ['boot', 'login', 'desktop', 'taskbar']) el[k].hidden = !names.includes(k);
    el.startMenu.hidden = true;
  }

  // ---------- 부팅 ----------
  os.boot = async () => {
    const my = ++run;
    show('boot');
    const text = el.boot.querySelector('.boot-text');
    const logo = el.boot.querySelector('.boot-logo');
    text.textContent = '';
    logo.hidden = true;
    let skip = reduceMotion;
    // 1998년식만 BIOS 글자가 지나가고, 2005, 2010년식은 로고와 진행 표시만 보여 준다.
    const textBoot = getEra() === '1998';
    const onSkip = () => { skip = true; };
    el.boot.addEventListener('pointerdown', onSkip);
    const lines = [
      'AGA BIOS v1.02    (C) 2026 아가라고요 팀',
      '',
      'CPU : 아가 486DX2-66',
      '메모리 검사 : 640K OK',
      '마우스 . . . . . . 찾음',
      '모니터 . . . . . . AGA-15 볼록 화면',
      '',
      '아가라고요 OS를 불러오는 중',
    ];
    for (const line of textBoot ? lines : []) {
      if (skip || my !== run) break;
      text.textContent += line + '\n';
      await wait(110);
    }
    if (!skip && my === run) {
      text.textContent = '';
      logo.hidden = false;
      await wait(textBoot ? 1100 : 2000);
    }
    el.boot.removeEventListener('pointerdown', onSkip);
    if (my === run) showLogin();
  };

  os.reset = () => {
    run++;
    os.wm.closeAll();
    os.mode = null;
    show();
    hideToast();
  };

  // ---------- 로그인 ----------
  function showLogin() {
    const my = ++run;
    os.wm.closeAll();
    os.mode = null;
    show('login');
    const users = el.login.querySelector('.users');
    users.replaceChildren();
    const own = sanitizeHome(loadJSON(STORAGE_ROOM) || loadJSON(STORAGE_ROOM_OLD));
    const hasOwn = own && own.owner;

    const m = location.hash.match(/^#room=(.+)$/);
    if (m) {
      const friend = decodeHome(m[1]);
      if (friend) {
        users.append(userTile(friend.owner, '손님으로 구경하기', () => enter('visit', friend, my)));
      } else {
        toast('링크가 깨져서 친구 컴퓨터를 열 수 없었습니다.');
      }
    }
    if (hasOwn) {
      users.append(userTile(own.owner, m ? '내 컴퓨터로 가기' : '내 컴퓨터', () => {
        clearHash();
        enter('edit', own, my);
      }));
    } else {
      users.append(newUserTile(name => {
        clearHash();
        const home = sanitizeHome({ owner: name });
        saveJSON(STORAGE_ROOM, home);
        enter('edit', home, my);
      }));
    }
    if (hasOwn) users.append(resetButton());
  }

  // 이 컴퓨터 초기화: 저장된 집(계정)과 게임 최고 점수를 지운다. 모니터 설정(시대, 그레인, 볼록, 밤)은 남긴다.
  // 새 계정 만들기와 친구 링크 구경을 다시 시험할 때 쓴다.
  // 배포 주소는 김수민의 다른 게임(Be the Bee 등)과 저장소를 같이 쓰므로, 우리 키만 골라 지운다.
  // 우리 키: 'agarago.'로 시작하는 것과, apps/ 안 앱이 자기 id로 시작하게 만든 것('tidy-up.best').
  const ownApps = APPS.filter(a => a.src?.startsWith('apps/')).map(a => a.id + '.');
  const ownKey = key => key.startsWith('agarago.') || ownApps.some(p => key.startsWith(p));
  function resetButton() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'reset-link';
    b.textContent = '이 컴퓨터 초기화';
    b.addEventListener('click', () => {
      if (!confirm('이 컴퓨터에 저장된 집과 게임 기록을 모두 지울까요? 되돌릴 수 없습니다.')) return;
      try {
        for (const key of Object.keys(localStorage)) if (ownKey(key) && key !== STORAGE_SETTINGS) localStorage.removeItem(key);
      } catch { /* 저장소를 못 쓰는 환경 */ }
      showLogin();
    });
    return b;
  }

  function avatar(name) {
    const a = document.createElement('span');
    a.className = 'avatar';
    a.textContent = [...name][0] || '?';
    return a;
  }

  function userTile(name, sub, onPick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'user';
    const label = document.createElement('span');
    label.className = 'user-name';
    label.textContent = name;
    const small = document.createElement('small');
    small.textContent = sub;
    label.append(small);
    b.append(avatar(name), label);
    b.addEventListener('click', onPick);
    return b;
  }

  function newUserTile(onCreate) {
    const f = document.createElement('form');
    f.className = 'user new';
    f.innerHTML = `
      <span class="avatar">+</span>
      <span class="user-name">새 사용자 만들기
        <span class="new-row">
          <input maxlength="12" autocomplete="off" placeholder="닉네임 (최대 12글자)" aria-label="닉네임">
          <button type="submit" class="btn">확인</button>
        </span>
      </span>`;
    const input = f.querySelector('input');
    f.addEventListener('submit', e => {
      e.preventDefault();
      const name = input.value.trim().slice(0, 12);
      if (name) onCreate(name);
      else input.focus();
    });
    setTimeout(() => input.focus(), 50);
    return f;
  }

  async function enter(mode, home, my) {
    if (my !== run) return;
    os.mode = mode;
    os.home = home;
    const welcome = el.login.querySelector('.welcome');
    welcome.textContent = '환영합니다';
    el.login.classList.add('entering');
    if (!reduceMotion) await wait(700);
    el.login.classList.remove('entering');
    if (my !== run) return;
    showDesktop();
    // 친구는 방을 보러 왔으니 방 꾸미기를 바로 열어 준다.
    if (mode === 'visit') os.openApp('room');
  }

  const clearHash = () => {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  };

  // 친구 컴퓨터를 구경하다가 내 컴퓨터로 간다.
  os.goHome = () => {
    clearHash();
    showLogin();
  };

  // ---------- 바탕화면 ----------
  function showDesktop() {
    show('desktop', 'taskbar');
    stage.dataset.mode = os.mode;
    renderWallpaper();
    renderIcons(el.icons, APPS.filter(a => !a.folder && visible(a)));
    tick();
  }

  const visible = app => !(app.editOnly && os.mode === 'visit');

  function renderWallpaper() {
    renderStatic(el.wallpaper, os.home.scenes.room, 'indoor', os.toggleNight);
  }

  // 밤과 낮. 스탠드나 가로등을 누르면 바뀌고, OS 전체 색이 같이 바뀐다.
  os.toggleNight = () => setNight(!getNight());

  // 아이콘 묶음. 한 번 누르면 고르고, 두 번 누르면 연다.
  function renderIcons(container, apps) {
    container.replaceChildren();
    let last = { id: null, t: 0 };
    for (const app of apps) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'desk-icon';
      const label = document.createElement('span');
      label.textContent = app.title;
      b.append(iconEl(app, 48), label);
      b.addEventListener('click', () => {
        const now = performance.now();
        for (const o of container.querySelectorAll('.desk-icon')) o.classList.toggle('selected', o === b);
        if (last.id === app.id && now - last.t < DOUBLE_CLICK_MS) {
          last = { id: null, t: 0 };
          os.openApp(app.id);
        } else {
          last = { id: app.id, t: now };
        }
      });
      b.addEventListener('keydown', e => { if (e.key === 'Enter') os.openApp(app.id); });
      container.append(b);
    }
  }

  // ---------- 작업 표시줄과 시작 메뉴 ----------
  const startBtn = el.taskbar.querySelector('.start-btn');
  startBtn.addEventListener('click', () => {
    if (el.startMenu.hidden) openStartMenu();
    else el.startMenu.hidden = true;
  });
  stage.addEventListener('pointerdown', e => {
    if (!el.startMenu.hidden && !el.startMenu.contains(e.target) && !startBtn.contains(e.target)) el.startMenu.hidden = true;
  });

  function openStartMenu() {
    const menu = el.startMenu;
    menu.replaceChildren();
    const head = document.createElement('div');
    head.className = 'start-head';
    head.append(avatar(os.home.owner), document.createTextNode(os.mode === 'visit' ? `${os.home.owner} (손님)` : os.home.owner));
    menu.append(head);
    const item = (app, label, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'start-item';
      const t = document.createElement('span');
      t.textContent = label;
      b.append(iconEl(app, 24), t);
      b.addEventListener('click', () => { menu.hidden = true; onClick(); });
      menu.append(b);
    };
    for (const app of APPS.filter(a => !a.folder && visible(a))) item(app, app.title, () => os.openApp(app.id));
    menu.append(Object.assign(document.createElement('hr'), { className: 'start-sep' }));
    item({ title: '밤', color: '#2c2a6b' }, getNight() ? '불 켜기 (낮)' : '불 끄기 (밤)', os.toggleNight);
    item({ title: '로그아웃', color: '#6b6f8f' }, os.mode === 'visit' ? '구경 마치기' : '로그아웃', showLogin);
    item({ title: '끄기', color: '#b5483f' }, '컴퓨터 끄기', requestPowerOff);
    menu.hidden = false;
  }

  function tick() {
    const d = new Date();
    el.taskbar.querySelector('.clock').textContent =
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  setInterval(tick, 20000);

  // ---------- 앱 ----------
  os.openApp = id => {
    const app = APP_BY_ID[id];
    if (!app || !visible(app)) return;
    if (app.builtin === 'room') return openRoomApp(os, app);
    if (app.builtin === 'folder') return openFolder(app);
    if (app.builtin === 'share') return openShare(app);
    if (app.src) return openFrame(app);
  };

  function openFolder(app) {
    const inside = APPS.filter(a => a.folder === app.opens && visible(a));
    os.wm.open({
      key: app.id,
      app,
      title: app.title,
      width: 560,
      height: 360,
      build(body) {
        body.classList.add('folder');
        const grid = document.createElement('div');
        grid.className = 'folder-grid';
        renderIcons(grid, inside);
        const hint = document.createElement('p');
        hint.className = 'folder-hint';
        hint.textContent = `${inside.length}개 항목. 아이콘을 두 번 누르면 실행됩니다.`;
        body.append(grid, hint);
      },
    });
  }

  // iframe이 앱 폴더 밖으로 나갔는지. 앱 안에서 페이지를 옮기는 것은 괜찮다(같은 폴더 아래면 앱으로 본다).
  // 다른 사이트의 앱은 안을 볼 수 없으므로 판단하지 않는다.
  function leftApp(frame, src) {
    const home = new URL(src, location.href);
    const folder = home.pathname.replace(/[^/]*$/, '');
    let now;
    try { now = frame.contentWindow.location; now.href; } catch {
      // 같은 사이트 앱인데 안을 볼 수 없으면 data:, blob: 같은 다른 문서로 바뀐 것이다.
      return home.origin === location.origin;
    }
    return now.origin !== home.origin || !now.pathname.startsWith(folder);
  }

  // 앱 페이지를 iframe으로 띄운다. 앱은 apps/aga-sdk.js 로 창을 닫거나 제목을 바꿀 수 있다.
  function openFrame(app) {
    const [w, h] = app.size || [800, 560];
    os.wm.open({
      key: app.id,
      app,
      title: app.title,
      width: w,
      height: h,
      flush: true,
      build(body, win) {
        body.classList.add('frame-app');
        const frame = document.createElement('iframe');
        frame.title = app.title;
        frame.allow = 'autoplay; fullscreen; gamepad; clipboard-write';
        // 앱 화면이 엉뚱한 페이지로 넘어가면(흰 화면 제보, 2026-10-28) 다시 열기 안내를 띄운다.
        const lost = document.createElement('div');
        lost.className = 'frame-lost';
        lost.hidden = true;
        lost.innerHTML = `
          <p>앱 화면이 다른 페이지로 넘어갔습니다.</p>
          <p class="meta">다시 열기를 누르면 처음 화면부터 다시 불러옵니다.</p>
          <button class="btn" type="button">다시 열기</button>`;
        lost.querySelector('button').addEventListener('click', () => {
          lost.hidden = true;
          frame.style.visibility = '';
          frame.src = app.src;
        });
        frame.addEventListener('load', () => {
          crt.prepareFrame(frame);
          crt.updateHoles();
          if (leftApp(frame, app.src)) {
            lost.hidden = false;
            frame.style.visibility = 'hidden';
          }
        });
        frame.src = app.src;
        win.iframe = frame;
        body.append(frame, lost);
      },
    });
  }

  function openShare(app) {
    const link = `${location.origin}${location.pathname}#room=${encodeHome(os.home)}`;
    os.wm.open({
      key: app.id,
      app,
      title: '공유 링크',
      width: 540,
      height: 150,
      build(body) {
        body.innerHTML = `
          <p>이 링크를 받은 친구는 내 컴퓨터에 손님으로 들어와 지금 모습 그대로 방을 구경할 수 있습니다.
          방을 고친 뒤에는 링크를 다시 복사해서 보내 주세요.</p>
          <div class="share-row">
            <input type="text" readonly aria-label="공유 링크">
            <button type="button" class="btn">복사</button>
          </div>`;
        const input = body.querySelector('input');
        input.value = link;
        body.querySelector('button').addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(link); } catch { input.select(); document.execCommand('copy'); }
          toast('링크를 복사했습니다.');
        });
      },
    });
  }

  // 방 안의 가구를 눌렀을 때. 가구 목록의 gimmick 대로 하고, 없으면 기믹이 들어갈 빈 창을 띄운다.
  // ('scene:' 기믹은 공간을 바꿔야 하므로 방 꾸미기 앱이 먼저 처리한다.)
  os.openFurniture = item => {
    const def = BY_ID[item.id];
    if (def.gimmick === 'night') return os.toggleNight();
    if (def.gimmick?.startsWith('app:')) return os.openApp(def.gimmick.slice(4));
    const zone = { wall: '벽에 거는 가구', floor: '바닥 가구', top: '책상 위에도 올릴 수 있는 가구' }[def.zone];
    const size = def.zone === 'wall' ? `가로 ${def.size[0]}칸, 높이 ${def.size[1]}줄` : `${def.size[0]}×${def.size[1]}칸`;
    os.wm.open({
      key: item,
      app: { icon: 'builtin:furniture', title: def.name },
      title: def.name,
      width: 400,
      height: 120,
      build(body) {
        body.innerHTML = `
          <p>이 가구를 누르면 열리는 창입니다.
          나중에 미니게임이나 가구 기믹이 이 자리에 들어갑니다.</p>
          <p class="meta"></p>`;
        body.querySelector('.meta').textContent = `${size}, ${zone}`;
      },
    });
  };

  os.saveHome = () => {
    if (os.mode === 'edit') saveJSON(STORAGE_ROOM, os.home);
    renderWallpaper();
  };

  // ---------- 앱 SDK 메시지 ----------
  window.addEventListener('message', e => {
    const d = e.data;
    if (!d || d.aga !== 1) return;
    const win = os.wm.all().find(w => w.iframe && w.iframe.contentWindow === e.source);
    if (!win) return;
    if (d.type === 'close') win.close();
    else if (d.type === 'title') win.setTitle(String(d.title).slice(0, 40));
    else if (d.type === 'hello') {
      e.source.postMessage({ aga: 1, type: 'info', info: { owner: os.home?.owner || '', visitor: os.mode === 'visit' } }, '*');
    }
  });

  // 켜 둔 채로 다른 방 링크를 붙여 넣으면 로그인 화면으로 돌아간다(이미 로그인 화면이면 사용자 목록을 다시 만든다).
  window.addEventListener('hashchange', () => {
    if ((os.mode || !el.login.hidden) && location.hash.startsWith('#room=')) showLogin();
  });

  // ---------- 알림 ----------
  let toastTimer = 0;
  let toastSticky = false;
  function toast(msg, ms = 2400) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastSticky = ms === 0;
    if (ms) toastTimer = setTimeout(hideToast, ms);
  }
  function hideToast() {
    toastSticky = false;
    el.toast.classList.remove('show');
  }
  os.toast = toast;
  os.hideStickyToast = () => { if (toastSticky) hideToast(); };

  return os;
}
