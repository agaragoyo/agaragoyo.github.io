// 아가라고요 OS. 전원을 켜면 부팅, 로그인, 바탕화면 순서로 진행하고 앱을 창으로 띄운다.
//   mode: 'edit'  내 컴퓨터 (방을 꾸미고 저장한다)
//         'visit' 공유 링크로 들어온 친구 컴퓨터 (가구는 옮기지 못하고, 바탕화면에서 아바타로 걸으며 써 본다)
// 앱은 src/apps/(기본 앱)와 apps/(팀원 앱, iframe)에 있고, 여기서는 목록대로 열어 주기만 한다.
import { STORAGE_ROOM, STORAGE_ROOM_OLD, STORAGE_SETTINGS, DOUBLE_CLICK_MS, SCENES } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { APPS, APP_BY_ID } from '../data/apps.js';
import { createWM } from './win.js';
import { iconEl } from './icons.js';
import { renderStatic } from './room.js';
import { mountAvatar } from './avatar.js';
import { BUILTIN_APPS, openFrameApp, openLinkApp } from './apps/index.js';
import { createSdkHost } from './sdk-host.js';
import { sanitizeHome, decodeHome } from './share.js';
import { createTutorial } from './tutorial.js';
import { NEIGHBOR_LIST, neighborHome, askVisit } from './neighbors.js';
import { batchim, h, wait, reduceMotion, loadJSON, saveJSON } from './util.js';
import { play, setPlace } from './sound.js';

export function createOS({ stage, toStage, requestPowerOff, settings }) {
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
    settings,
    home: null,
    realHome: null, // 튜토리얼 연습 중이면 저장된 진짜 집. 그동안 os.home은 빈 연습 방이다
    closeup: null, // 가구를 가까이 보는 화면(src/closeup.js)이 열려 있으면 그 화면
    mode: null,
    hasOwnHome: false, // 이 컴퓨터에 저장된 내 집이 있는지. 손님 바탕화면에서 나도 만들기와 내 컴퓨터로 가운데 무엇을 보일지 정한다
    place: SCENES[0].id, // 바탕화면 배경에 보이는 공간(SCENES의 id). 아바타도 이 공간에 있다
    wm: createWM({
      layer: $('#windows'),
      tasks: $('#tasks'),
      toLocal: toStage,
    }),
  };
  os.tutorial = createTutorial(os);
  let run = 0; // 전원을 끄거나 로그아웃하면 늘려서, 진행 중이던 연출을 멈춘다
  let walker = null; // 바탕화면 방을 걷는 내 아바타(src/avatar.js). 바탕화면에 있는 동안만 있다(avatar는 로그인 사용자 그림 함수 이름)

  // 밤 모드: 스탠드나 가로등으로 켜고 끈다. 화면 안쪽(방 그림과 OS 창) 색이 바뀐다.
  // 밤은 방의 불을 끈 상태라 바탕화면에서만 쓴다. 부팅과 로그인 화면은 늘 낮 색이다(known-issues 38).
  function syncTheme() {
    stage.dataset.theme = settings.get('night') && !el.desktop.hidden ? 'night' : 'day';
  }
  settings.subscribe(syncTheme);

  function show(...names) {
    for (const k of ['boot', 'login', 'desktop', 'taskbar']) el[k].hidden = !names.includes(k);
    syncTheme();
    el.startMenu.hidden = true;
    if (!names.includes('desktop')) {
      os.closeup?.close();
      walker?.destroy();
      walker = null;
      os.tutorial.hide();
      setPlace(null); // 배경음악은 바탕화면에서만 튼다
    }
  }

  // ---------- 부팅 ----------
  // 2005년식 부팅: 검은 화면에 로고와 진행 막대를 2초 보여 준다. 움직임 줄이기를 켠 사람에게는 바로 로그인 화면을 보여 준다.
  os.boot = async () => {
    const my = ++run;
    show('boot');
    el.boot.querySelector('.boot-logo').hidden = reduceMotion;
    if (!reduceMotion) await wait(2000);
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
  // 이 컴퓨터에 저장된 내 집. 없거나 이름이 없으면 null이다.
  function ownHome() {
    const own = sanitizeHome(loadJSON(STORAGE_ROOM) || loadJSON(STORAGE_ROOM_OLD));
    return own && own.owner ? own : null;
  }

  function showLogin() {
    const my = ++run;
    os.wm.closeAll();
    os.mode = null;
    show('login');
    const users = el.login.querySelector('.users');
    users.replaceChildren();
    const own = ownHome();

    const m = location.hash.match(/^#room=(.+)$/);
    if (m) {
      const friend = decodeHome(m[1]);
      if (friend) users.append(userTile(friend.owner, '손님으로 구경하기', () => enter('visit', friend, my)));
      else toast('링크가 깨져서 친구 컴퓨터를 열 수 없었습니다.');
    }
    // 이웃집(data/neighbors.js)은 친구 링크로 오지 않았을 때 사용자처럼 늘어선다. 누르면 바로 손님으로 들어간다.
    // 처음 온 사람에게는 새 사용자 만들기보다 위에 두어, 빈 방을 꾸미기 전에 채워진 방을 먼저 볼 수 있게 한다.
    const nearby = m ? [] : NEIGHBOR_LIST.map(n => userTile(n.name, '이웃집 구경하기', () => enter('visit', neighborHome(n), my), 'neighbor'));
    if (own) {
      users.append(userTile(own.owner, m ? '내 컴퓨터로 가기' : '내 컴퓨터', () => {
        clearHash();
        enter('edit', own, my);
      }));
      users.append(...nearby, resetButton());
    } else {
      users.append(...nearby);
      users.append(newUserTile(name => {
        clearHash();
        const home = sanitizeHome({ owner: name });
        saveJSON(STORAGE_ROOM, home);
        os.tutorial.arm();
        enter('edit', home, my);
      }));
    }
  }

  // 이 컴퓨터 초기화: 저장된 집(계정)과 게임 최고 점수를 지운다. 이 컴퓨터의 설정(밤, 소리, 배경음악)은 남긴다.
  // 새 계정 만들기와 친구 링크 구경을 다시 시험할 때 쓴다.
  // 배포 주소에 따라 다른 사이트와 저장소를 같이 쓸 수 있으므로, 우리 키만 골라 지운다.
  // 우리 키: 'agarago.'로 시작하는 것과, apps/ 안 앱이 자기 id로 시작하게 만든 것('tidy-up.best').
  const ownApps = APPS.filter(a => a.src?.startsWith('apps/')).map(a => a.id + '.');
  const ownKey = key => key.startsWith('agarago.') || ownApps.some(p => key.startsWith(p));
  // 되돌릴 수 없는 일이라 바로 지우지 않고, 지울 것을 보여 준 뒤 결과를 말하는 단추로 받는다(known-issues 32).
  function resetButton() {
    const box = h('div', { className: 'reset-box' });
    const wipe = () => {
      try {
        for (const key of Object.keys(localStorage)) if (ownKey(key) && key !== STORAGE_SETTINGS) localStorage.removeItem(key);
      } catch { /* 저장소를 못 쓰는 환경 */ }
      showLogin();
    };
    const ask = () => box.replaceChildren(
      h('p', {}, '이 컴퓨터에 저장된 집과 게임 기록을 지웁니다. 되돌릴 수 없습니다.'),
      h('div', { className: 'reset-row' },
        h('button', { type: 'button', className: 'btn', onclick: wipe }, '지우기'),
        h('button', { type: 'button', className: 'btn', onclick: idle }, '그대로 두기')),
    );
    const idle = () => box.replaceChildren(h('button', { type: 'button', className: 'reset-link', onclick: ask }, '이 컴퓨터 초기화'));
    idle();
    return box;
  }

  const avatar = name => h('span', { className: 'avatar' }, [...name][0] || '?');

  function userTile(name, sub, onPick, kind = '') {
    return h('button', { type: 'button', className: kind ? `user ${kind}` : 'user', onclick: onPick },
      avatar(name),
      h('span', { className: 'user-name' }, name, h('small', {}, sub)));
  }

  function newUserTile(onCreate) {
    const input = h('input', { maxLength: 12, autocomplete: 'off', placeholder: '닉네임 (최대 12글자)', 'aria-label': '닉네임' });
    // 아이디를 칠 때 한 글자마다 키보드 소리(사운드 정리표의 "ID 입력 사운드"). 누르고 있어 되풀이되는 키와 Enter, 조합 키는 빼고, 한글 입력 중(Process)도 소리를 낸다.
    input.addEventListener('keydown', e => {
      if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key.length === 1 || ['Backspace', 'Delete', 'Process'].includes(e.key))) play('key');
    });
    // 빈 칸으로 확인을 누르면 입력칸을 빨갛게 두르고 그 아래에 풍선 안내를 띄운다. 글자를 치면 거둔다.
    const tip = h('p', { className: 'name-tip', id: 'name-tip', role: 'alert', hidden: true }, '닉네임을 입력해 주세요.');
    const showTip = on => {
      tip.hidden = !on;
      if (on) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    };
    input.setAttribute('aria-describedby', 'name-tip');
    input.addEventListener('input', () => { if (input.value.trim()) showTip(false); });
    const form = h('form', {
      className: 'user new',
      onsubmit: e => {
        e.preventDefault();
        const name = input.value.trim().slice(0, 12);
        if (name) onCreate(name);
        else {
          showTip(true);
          input.focus();
        }
      },
    },
    h('span', { className: 'avatar' }, '+'),
    h('span', { className: 'user-name' }, '새 사용자 만들기',
      h('span', { className: 'new-row' }, input, h('button', { type: 'submit', className: 'btn' }, '확인'), tip)));
    setTimeout(() => input.focus(), 50);
    return form;
  }

  async function enter(mode, home, my) {
    if (my !== run) return;
    os.mode = mode;
    os.home = home;
    os.hasOwnHome = mode === 'edit' || !!ownHome();
    el.login.querySelector('.welcome').textContent = '환영합니다';
    el.login.classList.add('entering');
    if (!reduceMotion) await wait(700);
    el.login.classList.remove('entering');
    if (my !== run) return;
    showDesktop();
  }

  const clearHash = () => {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  };

  // 친구 컴퓨터를 구경하다가 돌아간다(손님 바탕화면의 나도 만들기와 내 컴퓨터로, src/apps/mine-app.js).
  // 이 컴퓨터에 내 집이 있으면 로그인 화면을 거치지 않고 곧장 내 바탕화면으로 가고, 없으면 사용자를 만들 수 있는 로그인 화면으로 간다.
  os.goHome = () => {
    clearHash();
    const own = ownHome();
    if (own) switchTo('edit', own);
    else showLogin();
  };

  // 이웃집에 손님으로 들어간다(src/neighbors.js의 askVisit). 놀이터의 이웃집 문에서 온다.
  os.visit = home => {
    clearHash();
    switchTo('visit', home);
  };

  // 바탕화면에서 곧장 다른 컴퓨터(또는 내 컴퓨터)로 옮겨 간다. 로그인할 때처럼 환영 화면을 거친다.
  // 로그인 화면을 보이면서 바탕화면을 떠나므로 하던 튜토리얼은 멈추고(돌아오면 이어진다), 연습 방이었으면 연습을 끝낸다.
  function switchTo(mode, home) {
    const my = ++run;
    os.wm.closeAll();
    show('login');
    enter(mode, home, my);
  }

  // ---------- 바탕화면 ----------
  function showDesktop() {
    os.closeup?.close();
    show('desktop', 'taskbar');
    stage.dataset.mode = os.mode;
    os.place = SCENES[0].id;
    setPlace(os.place);
    walker?.destroy();
    walker = mountAvatar({
      layer: el.wallpaper,
      items: () => os.home.scenes[os.place],
      toLocal: (x, y) => {
        const p = toStage(x, y);
        return { x: p.x - el.desktop.offsetLeft - el.wallpaper.offsetLeft, y: p.y - el.desktop.offsetTop - el.wallpaper.offsetTop };
      },
      input: el.desktop,
      sayRoot: el.desktop,
      active: () => !el.desktop.hidden && !os.wm.focusedWin() && !os.closeup, // 가구를 가까이 보는 동안의 방향키는 그 화면 것이다(책장 넘기기)
    });
    renderWallpaper();
    // 친구 집도 바탕화면에서 시작한다. 친구 방이 배경이 되고, 손님은 내 아바타로 걸으며 가구를 써 본다.
    if (os.mode === 'visit') {
      toast(`${os.home.owner}의 집에 놀러 왔습니다. 바닥을 눌러 걷고, 가구를 두 번 눌러 사용해 보세요`, 6000);
    } else if (!walkTipShown && !os.tutorial.active) { // 튜토리얼을 하는 동안에는 걷는 법을 튜토리얼 끝에서 알려 준다
      walkTipShown = true;
      toast('방 바닥을 누르거나 방향키로 걷고, Enter로 말할 수 있습니다', 5000);
    }
    renderDesktopIcons();
    tick();
    if (os.mode === 'edit') os.tutorial.resume();
  }

  // 친구 컴퓨터를 구경할 때는 editOnly 앱을 숨기고, visitOnly 앱(나도 만들기, 내 컴퓨터로)은 그때만 보인다.
  // ownHome이 적힌 앱은 이 컴퓨터에 내 집이 있는 손님(true)이나 없는 손님(false)에게만 보인다.
  // 공간 바로 가기는 지금 있는 공간의 것을 숨긴다(놀이터에서는 놀이터 대신 집으로가 보인다).
  os.canSee = app => (os.mode === 'visit'
    ? !app.editOnly && (app.ownHome === undefined || app.ownHome === os.hasOwnHome)
    : !app.visitOnly) && app.scene !== os.place;
  function renderDesktopIcons() {
    os.renderIcons(el.icons, APPS.filter(a => !a.folder && os.canSee(a)));
  }

  // 바탕화면 배경: 지금 공간(처음에는 내 방)의 그림과 그곳을 걷는 아바타. 그림을 다시 그리면 상자가 비워지므로 아바타를 다시 넣는다.
  function renderWallpaper() {
    const scene = SCENES.find(s => s.id === os.place);
    renderStatic(el.wallpaper, os.home.scenes[scene.id], scene, { use: os.useFurniture, gate: os.useGate, door: os.useDoor, neighbor: os.useNeighbor }, os.home.owner);
    walker?.attach();
  }

  // 바탕화면의 공간을 옮긴다(현관문, 놀이터 아이콘, 놀이터 문). 아바타도 같이 가서, 문이 있는 공간에서는 그 문으로 막 들어온 칸
  // (문 바로 앞 칸에 서면 키 큰 아바타가 팻말을 가려서 한 칸 더 안쪽)에 선다. 놀이터는 아파트 문 앞, 내 방은 현관문 앞이다.
  // 방 꾸미기 창의 탭과는 따로 움직인다(꾸미는 화면은 꾸밀 공간을 탭으로 고른다).
  const doorstep = scene => {
    if (scene.gate) return { x: scene.gate.x, y: 1 };
    if (scene.door) return scene.door.wall === 'R' ? { x: scene.door.x, y: 1 } : { x: 1, y: scene.door.x };
    return undefined;
  };
  os.goScene = id => {
    const scene = SCENES.find(s => s.id === id);
    if (!scene || id === os.place) return;
    os.closeup?.close(); // 시작 메뉴의 놀이터처럼 가구를 가까이 보는 동안에도 공간을 옮길 수 있다
    os.place = id;
    play('enter'); // 방과 놀이터를 오갈 때 같은 소리를 낸다
    setPlace(id);
    walker?.moveTo(doorstep(scene));
    renderWallpaper();
    renderDesktopIcons();
  };

  // 놀이터 문을 두 번 눌렀을 때. 아바타가 문 앞까지 걸어간 뒤 내 방으로 돌아간다.
  os.useGate = gate => {
    const home = () => os.goScene(SCENES[0].id);
    if (walker) walker.approachWall('R', gate.x, gate.w, home);
    else home();
  };

  // 방의 현관문을 두 번 눌렀을 때. 아바타가 문 앞까지 걸어간 뒤 바깥 공간(놀이터)으로 나간다.
  os.useDoor = door => {
    const out = () => os.goScene(door.to);
    if (walker) walker.approachWall(door.wall, door.x, door.w, out);
    else out();
  };

  // 놀이터 왼쪽 울타리의 이웃집 문을 두 번 눌렀을 때(src/neighbors.js). 아바타가 문 앞까지 걸어간 뒤 그 집에 놀러 갈지 묻는다.
  // 지금 이 컴퓨터의 집 문패는 놀이터에 달지 않으므로(아파트 문이 그 집으로 가는 문이다) 여기 오는 문은 늘 다른 집이다.
  os.useNeighbor = n => {
    const ask = () => askVisit(os, n);
    if (walker) walker.approachWall(n.wall, n.x, n.w, ask);
    else ask();
  };
  let walkTipShown = false; // 걷는 법 안내는 페이지를 열고 처음 바탕화면에 왔을 때 한 번만

  // 튜토리얼 다시 보기의 연습 방(src/tutorial.js). 저장된 집을 realHome에 두고 빈 집으로 바꿔 낀다.
  // 화면과 창은 모두 os.home을 읽으므로 바꿔 끼우기만 하면 따라온다. 저장(os.saveHome)만 막고, 공유는 realHome을 읽는다.
  // 바탕화면을 다시 만들어 가구로 걸어가던 아바타의 예약도 버린다. 남아 있으면 연습이 끝난 뒤 진짜 밤낮을 바꾼다.
  // 모두 메모리에만 있어서 새로 고침을 하면 저장된 집으로 돌아온다(known-issues 40).
  os.startPractice = () => {
    os.realHome = os.home;
    os.home = sanitizeHome({ owner: os.home.owner });
    settings.hold({ night: false });
    os.wm.closeAll();
    showDesktop();
  };

  // redraw: 바탕화면으로 돌아오는 길이면 true, 로그아웃이나 전원 끄기로 바탕화면을 떠나는 길이면 false다.
  os.endPractice = redraw => {
    os.home = os.realHome;
    os.realHome = null;
    settings.release();
    if (!redraw) return;
    for (const key of ['room', 'share']) os.wm.get(key)?.close(); // 연습 방을 보여 주던 창만 닫는다. 연습 중에 연 게임은 그대로 둔다
    showDesktop();
  };

  // 바탕화면(창 바깥)을 누르면 어느 창도 앞에 두지 않는다. 그동안 키는 바탕화면의 아바타가 받는다.
  el.desktop.addEventListener('pointerdown', e => {
    if (!e.target.closest('.win')) os.wm.blur();
  });

  // 밤과 낮. 스탠드나 가로등을 누르면 바뀌고, OS 전체 색이 같이 바뀐다.
  os.toggleNight = () => {
    play('light');
    settings.set({ night: !settings.get('night') });
  };

  // 아이콘 묶음(바탕화면, 폴더 창). 한 번 누르면 고르고, 두 번 누르면 연다.
  os.renderIcons = (container, apps) => {
    container.replaceChildren();
    let last = { id: null, t: 0 };
    for (const app of apps) {
      // 새 탭으로 열리는 앱(href)은 누르기 전에 알 수 있게 아이콘에 바깥 화살표를 달고, 마우스를 올리면 열리는 곳을 보여 준다(known-issues 32).
      const b = h('button', {
        type: 'button',
        className: app.href ? 'desk-icon external' : 'desk-icon',
        dataset: { app: app.id },
        title: app.href ? `새 탭에서 열립니다(${new URL(app.href).host})` : null,
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
        onkeydown: e => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          e.stopPropagation(); // 고른 아이콘의 Enter는 아이콘을 여는 것이다. 아바타 말하기까지 같이 열리지 않게 한다
          os.openApp(app.id);
        },
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
      item({ title: '소리', color: '#3d7a72' }, settings.get('sound') ? '소리 끄기' : '소리 켜기', () => settings.set({ sound: !settings.get('sound') })),
      ...(os.mode === 'edit' && !os.realHome ? [item(os.tutorial.app, '튜토리얼 다시 보기', os.tutorial.restart)] : []),
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
  // builtin이 있으면 src/apps/의 기본 앱으로, src가 있으면 iframe 창으로, href가 있으면 새 탭에서 열린다고 알린 뒤 새 탭으로 연다.
  os.openApp = id => {
    const app = APP_BY_ID[id];
    if (!app || !os.canSee(app)) return;
    if (app.scene) return os.goScene(app.scene); // 공간 바로 가기(놀이터 아이콘)는 창 대신 바탕화면을 그 공간으로 옮긴다
    if (app.builtin) return BUILTIN_APPS[app.builtin]?.(os, app);
    if (app.src) return openFrameApp(os, app);
    if (app.href) return openLinkApp(os, app);
  };

  // 바탕화면에서 가구를 두 번 눌렀을 때. 아바타가 그 옆으로 걸어간 뒤 기믹을 쓴다(심즈처럼 캐릭터가 가서 쓴다).
  os.useFurniture = item => {
    const use = () => {
      os.openFurniture(item);
      os.tutorial.used(item.id);
    };
    if (walker) walker.approach(item, use);
    else use();
  };

  // 가구 기믹. 가구 목록의 gimmick 대로 하고, 아직 기믹이 없는 가구는 빈 창 대신 아바타가 가구 이름을 말한다.
  // 'scene:' 기믹은 바탕화면을 그 공간으로 옮긴다(2026-11-10까지 창문이 놀이터로 나가던 길. 지금은 현관문이 맡아 쓰는 가구가 없다).
  os.openFurniture = item => {
    const def = BY_ID[item.id];
    if (def.gimmick === 'night') return os.toggleNight();
    if (def.gimmick?.startsWith('scene:')) return os.goScene(def.gimmick.slice(6));
    if (def.gimmick?.startsWith('app:')) return os.openApp(def.gimmick.slice(4));
    walker?.say(`${def.name}${batchim(def.name) ? '이네' : '네'}.`);
  };

  // redraw: 가구 배치가 바뀌었으면 바탕화면 방을 다시 그린다. 가구에 담아 둔 것(src/likes.js)만 바뀌었으면 false로 저장만 한다.
  os.saveHome = (redraw = true) => {
    if (os.mode === 'edit' && !os.realHome) saveJSON(STORAGE_ROOM, os.home);
    if (redraw) renderWallpaper();
  };

  // 아바타가 말풍선으로 한마디 한다(가구에 담아 둔 것이 없을 때 등). 바탕화면이 아니면 아무 일도 하지 않는다.
  os.say = text => walker?.say(text);

  // 앱(iframe)과 주고받는 메시지
  os.sdk = createSdkHost(os);

  // 켜 둔 채로 다른 방 링크를 붙여 넣으면 로그인 화면으로 돌아간다(이미 로그인 화면이면 사용자 목록을 다시 만든다).
  window.addEventListener('hashchange', () => {
    if ((os.mode || !el.login.hidden) && location.hash.startsWith('#room=')) showLogin();
  });

  // ---------- 알림 ----------
  let toastTimer = 0;
  function toast(msg, ms = 2400) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, ms);
  }
  function hideToast() {
    el.toast.classList.remove('show');
  }
  os.toast = toast;

  return os;
}
