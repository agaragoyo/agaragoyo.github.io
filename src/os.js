// 아가라고요 OS. 전원을 켜면 부팅, 로그인, 바탕화면 순서로 진행하고 앱을 창으로 띄운다.
//   mode: 'edit'  내 컴퓨터 (방을 꾸미고 저장한다)
//         'visit' 공유 링크로 들어온 친구 컴퓨터 (보기만 한다)
// 앱은 src/apps/(기본 앱)와 apps/(팀원 앱, iframe)에 있고, 여기서는 목록대로 열어 주기만 한다.
import { STORAGE_ROOM, STORAGE_ROOM_OLD, STORAGE_SETTINGS, DOUBLE_CLICK_MS } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { APPS, APP_BY_ID } from '../data/apps.js';
import { createWM } from './win.js';
import { iconEl } from './icons.js';
import { renderStatic } from './room.js';
import { mountAvatar } from './avatar.js';
import { BUILTIN_APPS, openFrameApp } from './apps/index.js';
import { createSdkHost } from './sdk-host.js';
import { sanitizeHome, decodeHome } from './share.js';
import { h, wait, reduceMotion, loadJSON, saveJSON } from './util.js';

// 볼록 화면(1998)은 가장자리가 휘어 들어가고 어두워서, 그 자리에 놓인 창의 제목 줄 단추가 보이지 않는다.
// 방송 화면의 자막 안전 영역(가운데 90%)처럼 위와 양옆을 5%씩(무대 840의 5%, 1280의 5%) 비우고 그 안에만 창을 둔다.
// 아래는 작업 표시줄이 원래 자리를 지키므로 비우지 않는다(known-issues 21).
const CURVE_INSET = { top: 42, right: 64, bottom: 0, left: 64 };

export function createOS({ stage, toStage, requestPowerOff, crt, settings }) {
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

  // 기본 앱들이 쓰는 것을 os 하나에 모아 넘긴다(src/apps/*.js의 open...App(os, app)).
  const os = {
    stage,
    toStage,
    crt,
    settings,
    home: null,
    mode: null,
    wm: createWM({
      layer: $('#windows'),
      tasks: $('#tasks'),
      toLocal: toStage,
      onChange: () => crt.updateHoles(),
      inset: () => (crt.isWarpOn() ? CURVE_INSET : null),
    }),
  };
  settings.subscribe(() => os.wm.fit());
  let run = 0; // 전원을 끄거나 로그아웃하면 늘려서, 진행 중이던 연출을 멈춘다
  let walker = null; // 바탕화면 방을 걷는 내 아바타(src/avatar.js). 바탕화면에 있는 동안만 있다(avatar는 로그인 사용자 그림 함수 이름)

  function show(...names) {
    for (const k of ['boot', 'login', 'desktop', 'taskbar']) el[k].hidden = !names.includes(k);
    el.startMenu.hidden = true;
    if (!names.includes('desktop')) {
      walker?.destroy();
      walker = null;
    }
  }

  // ---------- 부팅 ----------
  const BIOS = [
    'AGA BIOS v1.02    (C) 2026 아가라고요 팀',
    '',
    'CPU : 아가 486DX2-66',
    '메모리 검사 : 640K OK',
    '마우스 . . . . . . 찾음',
    '모니터 . . . . . . AGA-15 볼록 화면',
    '',
    '아가라고요 OS를 불러오는 중',
  ];
  os.boot = async () => {
    const my = ++run;
    show('boot');
    const text = el.boot.querySelector('.boot-text');
    const logo = el.boot.querySelector('.boot-logo');
    text.textContent = '';
    logo.hidden = true;
    let skip = reduceMotion;
    // 1998년식만 BIOS 글자가 지나가고, 2005, 2010년식은 로고와 진행 표시만 보여 준다.
    const textBoot = settings.get('era') === '1998';
    const onSkip = () => { skip = true; };
    el.boot.addEventListener('pointerdown', onSkip);
    for (const line of textBoot ? BIOS : []) {
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
      if (friend) users.append(userTile(friend.owner, '손님으로 구경하기', () => enter('visit', friend, my)));
      else toast('링크가 깨져서 친구 컴퓨터를 열 수 없었습니다.');
    }
    if (hasOwn) {
      users.append(userTile(own.owner, m ? '내 컴퓨터로 가기' : '내 컴퓨터', () => {
        clearHash();
        enter('edit', own, my);
      }));
      users.append(resetButton());
    } else {
      users.append(newUserTile(name => {
        clearHash();
        const home = sanitizeHome({ owner: name });
        saveJSON(STORAGE_ROOM, home);
        enter('edit', home, my);
      }));
    }
  }

  // 이 컴퓨터 초기화: 저장된 집(계정)과 게임 최고 점수를 지운다. 모니터 설정(시대, 그레인, 볼록, 밤)은 남긴다.
  // 새 계정 만들기와 친구 링크 구경을 다시 시험할 때 쓴다.
  // 배포 주소에 따라 다른 사이트와 저장소를 같이 쓸 수 있으므로, 우리 키만 골라 지운다.
  // 우리 키: 'agarago.'로 시작하는 것과, apps/ 안 앱이 자기 id로 시작하게 만든 것('tidy-up.best').
  const ownApps = APPS.filter(a => a.src?.startsWith('apps/')).map(a => a.id + '.');
  const ownKey = key => key.startsWith('agarago.') || ownApps.some(p => key.startsWith(p));
  function resetButton() {
    return h('button', {
      type: 'button',
      className: 'reset-link',
      onclick: () => {
        if (!confirm('이 컴퓨터에 저장된 집과 게임 기록을 모두 지울까요? 되돌릴 수 없습니다.')) return;
        try {
          for (const key of Object.keys(localStorage)) if (ownKey(key) && key !== STORAGE_SETTINGS) localStorage.removeItem(key);
        } catch { /* 저장소를 못 쓰는 환경 */ }
        showLogin();
      },
    }, '이 컴퓨터 초기화');
  }

  const avatar = name => h('span', { className: 'avatar' }, [...name][0] || '?');

  function userTile(name, sub, onPick) {
    return h('button', { type: 'button', className: 'user', onclick: onPick },
      avatar(name),
      h('span', { className: 'user-name' }, name, h('small', {}, sub)));
  }

  function newUserTile(onCreate) {
    const input = h('input', { maxLength: 12, autocomplete: 'off', placeholder: '닉네임 (최대 12글자)', 'aria-label': '닉네임' });
    const form = h('form', {
      className: 'user new',
      onsubmit: e => {
        e.preventDefault();
        const name = input.value.trim().slice(0, 12);
        if (name) onCreate(name);
        else input.focus();
      },
    },
    h('span', { className: 'avatar' }, '+'),
    h('span', { className: 'user-name' }, '새 사용자 만들기',
      h('span', { className: 'new-row' }, input, h('button', { type: 'submit', className: 'btn' }, '확인'))));
    setTimeout(() => input.focus(), 50);
    return form;
  }

  async function enter(mode, home, my) {
    if (my !== run) return;
    os.mode = mode;
    os.home = home;
    el.login.querySelector('.welcome').textContent = '환영합니다';
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
    walker?.destroy();
    walker = mountAvatar({
      layer: el.wallpaper,
      items: () => os.home.scenes.room,
      toLocal: (x, y) => {
        const p = toStage(x, y);
        return { x: p.x - el.desktop.offsetLeft - el.wallpaper.offsetLeft, y: p.y - el.desktop.offsetTop - el.wallpaper.offsetTop };
      },
      input: el.desktop,
      sayRoot: el.desktop,
      active: () => !el.desktop.hidden && !os.wm.focusedWin(),
    });
    renderWallpaper();
    if (os.mode === 'edit' && !walkTipShown) {
      walkTipShown = true;
      toast('방 바닥을 누르거나 방향키로 걷고, Enter로 말해요', 5000);
    }
    os.renderIcons(el.icons, APPS.filter(a => !a.folder && os.canSee(a)));
    tick();
  }

  // 친구 컴퓨터를 구경할 때는 editOnly 앱을 숨긴다.
  os.canSee = app => !(app.editOnly && os.mode === 'visit');

  // 바탕화면 배경: 내 방 그림과 그 방을 걷는 아바타. 방 그림을 다시 그리면 상자가 비워지므로 아바타를 다시 넣는다.
  function renderWallpaper() {
    renderStatic(el.wallpaper, os.home.scenes.room, 'indoor', os.openFurniture);
    walker?.attach();
  }
  let walkTipShown = false; // 걷는 법 안내는 페이지를 열고 처음 바탕화면에 왔을 때 한 번만

  // 바탕화면(창 바깥)을 누르면 어느 창도 앞에 두지 않는다. 그동안 키는 바탕화면의 아바타가 받는다.
  el.desktop.addEventListener('pointerdown', e => {
    if (!e.target.closest('.win')) os.wm.blur();
  });

  // 밤과 낮. 스탠드나 가로등을 누르면 바뀌고, OS 전체 색이 같이 바뀐다.
  os.toggleNight = () => settings.set({ night: !settings.get('night') });

  // 아이콘 묶음(바탕화면, 폴더 창). 한 번 누르면 고르고, 두 번 누르면 연다.
  os.renderIcons = (container, apps) => {
    container.replaceChildren();
    let last = { id: null, t: 0 };
    for (const app of apps) {
      const b = h('button', {
        type: 'button',
        className: 'desk-icon',
        onclick: () => {
          const now = performance.now();
          for (const o of container.querySelectorAll('.desk-icon')) o.classList.toggle('selected', o === b);
          if (last.id === app.id && now - last.t < DOUBLE_CLICK_MS) {
            last = { id: null, t: 0 };
            os.openApp(app.id);
          } else {
            last = { id: app.id, t: now };
          }
        },
        onkeydown: e => { if (e.key === 'Enter') os.openApp(app.id); },
      }, iconEl(app, 48), h('span', {}, app.title));
      container.append(b);
    }
  };

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
    const item = (app, label, onClick) => h('button', {
      type: 'button',
      className: 'start-item',
      onclick: () => { menu.hidden = true; onClick(); },
    }, iconEl(app, 24), h('span', {}, label));
    menu.replaceChildren(
      h('div', { className: 'start-head' }, avatar(os.home.owner), os.mode === 'visit' ? `${os.home.owner} (손님)` : os.home.owner),
      ...APPS.filter(a => !a.folder && os.canSee(a)).map(app => item(app, app.title, () => os.openApp(app.id))),
      h('hr', { className: 'start-sep' }),
      item({ title: '밤', color: '#2c2a6b' }, settings.get('night') ? '불 켜기 (낮)' : '불 끄기 (밤)', os.toggleNight),
      item({ title: '로그아웃', color: '#6b6f8f' }, os.mode === 'visit' ? '구경 마치기' : '로그아웃', showLogin),
      item({ title: '끄기', color: '#b5483f' }, '컴퓨터 끄기', requestPowerOff),
    );
    menu.hidden = false;
  }

  function tick() {
    const d = new Date();
    el.taskbar.querySelector('.clock').textContent =
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  setInterval(tick, 20000);

  // ---------- 앱 ----------
  // builtin이 있으면 src/apps/의 기본 앱으로, src가 있으면 iframe 창으로 연다.
  os.openApp = id => {
    const app = APP_BY_ID[id];
    if (!app || !os.canSee(app)) return;
    if (app.builtin) return BUILTIN_APPS[app.builtin]?.(os, app);
    if (app.src) return openFrameApp(os, app);
  };

  // 가구를 눌렀을 때(방 꾸미기 창, 바탕화면 배경). 가구 목록의 gimmick 대로 하고, 없으면 기믹이 들어갈 빈 창을 띄운다.
  // 'scene:' 기믹은 방 꾸미기를 그 공간으로 연다. 방 꾸미기가 이미 열려 있으면 그 창의 공간만 바꾼다.
  os.openFurniture = item => {
    const def = BY_ID[item.id];
    if (def.gimmick === 'night') return os.toggleNight();
    if (def.gimmick?.startsWith('scene:')) return BUILTIN_APPS.room(os, APP_BY_ID.room, def.gimmick.slice(6));
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
        body.append(
          h('p', {}, '이 가구를 누르면 열리는 창입니다. 나중에 미니게임이나 가구 기믹이 이 자리에 들어갑니다.'),
          h('p', { className: 'meta' }, `${size}, ${zone}`),
        );
      },
    });
  };

  os.saveHome = () => {
    if (os.mode === 'edit') saveJSON(STORAGE_ROOM, os.home);
    renderWallpaper();
  };

  // 앱(iframe)과 주고받는 메시지
  os.sdk = createSdkHost(os);

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
