// 아가라고요 OS. 전원을 켜면 부팅, 로그인, 바탕화면 순서로 진행하고 앱을 창으로 띄운다.
//   mode: 'edit'  내 컴퓨터 (방을 꾸미고 저장한다)
//         'visit' 공유 링크로 들어온 친구 컴퓨터 (가구는 옮기지 못하고, 바탕화면에서 아바타로 걸으며 써 본다)
// 앱은 src/apps/(기본 앱)와 apps/(팀원 앱, iframe)에 있고, 여기서는 목록대로 열어 주기만 한다.
import { STORAGE_ROOM, SCENES } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { APPS, APP_BY_ID, hostTip } from '../data/apps.js';
import { createWM } from './win.js';
import { iconEl } from './icons.js';
import { renderStatic, preloadFurniture } from './room.js';
import { mountAvatar } from './avatar.js';
import { BUILTIN_APPS, openFrameApp, openLinkApp } from './apps/index.js';
import { createSdkHost } from './sdk-host.js';
import { createScreensaver } from './screensaver.js';
import { PASSWORD, labsOpen, openLabs } from './labs.js';
import { sanitizeHome, encodeHome, linkCode, linkId } from './share.js';
import { sharedId, syncLater, latestNoteAt, notesSeenAt } from './cloud.js';
import { createTutorial } from './tutorial.js';
import { askVisit } from './neighbors.js';
import { createLogin } from './login.js';
import { ownPicture, withPicture, openPictureWindow } from './user-pictures.js';
import { batchim, h, wait, reduceMotion, saveJSON, doubleClick } from './util.js';
import { play, setPlace } from './sound.js';

export function createOS({ stage, toStage, requestPowerOff, settings }) {
  const $ = sel => stage.querySelector(sel); // 무대(#stage) 안에서만 찾는다. 화면(#screen)과 화면 효과(.fx)는 무대 바깥이다
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
    boardId: null, // 짧은 링크(#s=)로 온 손님이면 그 방 번호. 코르크 보드의 쪽지가 이 번호의 방에 붙는다(src/apps/corkboard-app.js)
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
    preloadFurniture(loginHomes()); // 부팅 화면과 로그인 화면을 지나는 동안 가구 그림을 받아 둔다(바탕화면에 임시 상자가 비치지 않게)
    const sid = linkId(location.hash);
    if (sid) cloudHome(sid).then(home => home && preloadFurniture([home])); // 짧은 링크의 방은 부팅하는 동안 서버에서 받아 온다
    el.boot.querySelector('.boot-logo').hidden = reduceMotion;
    if (!reduceMotion) await wait(2000);
    if (my === run) showLogin();
  };

  os.reset = () => {
    run++;
    os.saver?.hide();
    os.wm.closeAll();
    os.mode = null;
    show();
    hideToast();
  };

  // ---------- 로그인 ----------
  // 로그인 화면(사용자 목록, 새 사용자 만들기, 이 컴퓨터 초기화)은 src/login.js가 만든다.
  // 실행 번호(run)는 여기 두고, 새 번호를 받는 함수와 아직 그 실행인지 묻는 함수를 넘긴다.
  const clearHash = () => {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  };
  const { ownHome, loginHomes, cloudHome, showLogin, avatar } = createLogin({
    os, el, show, enter, toast, clearHash,
    nextRun: () => ++run,
    isCurrent: my => my === run,
  });
  // 이 컴퓨터에 사는 사람의 닉네임. 손님으로 쪽지를 붙일 때 닉네임 칸에 미리 넣는다(src/apps/corkboard-app.js)
  os.ownName = () => ownHome()?.owner || '';

  // boardId: 짧은 링크(#s=)로 온 손님이면 그 방 번호(코르크 보드의 쪽지가 붙는 곳). 긴 링크와 이웃집 손님은 없다.
  async function enter(mode, home, my, boardId = null) {
    if (my !== run) return;
    os.mode = mode;
    os.home = home;
    os.hasOwnHome = mode === 'edit' || !!ownHome();
    os.boardId = mode === 'visit' ? boardId : null;
    if (mode === 'edit') syncLater(() => encodeHome(withPicture(home))); // 지난번에 탭을 닫느라 서버에 못 올린 고침이 있으면 올린다(src/cloud.js)
    el.login.querySelector('.welcome').textContent = '환영합니다';
    el.login.classList.add('entering');
    if (!reduceMotion) await wait(700);
    el.login.classList.remove('entering');
    if (my !== run) return;
    showDesktop();
    if (mode === 'edit') checkNotes(my);
  }

  // 주인이 내 컴퓨터로 들어오면 코르크 보드에 새 쪽지가 붙었는지 본다. 서버에서 가장 최근 쪽지 한 장만 읽는다(src/cloud.js의 latestNoteAt).
  // 짧은 링크가 있고 보드를 방에 걸어 두었을 때만 묻는다. 걷는 법 안내가 떠 있으면 그 안내가 사라진 뒤에 알리고,
  // 그사이에 주인이 보드를 열어 쪽지를 봤으면(notesSeenAt) 알리지 않는다.
  function checkNotes(my) {
    const hung = Object.values(os.home.scenes).flat().some(it => BY_ID[it.id]?.gimmick === 'app:corkboard');
    if (!hung || !sharedId()) return;
    latestNoteAt().then(latest => {
      if (latest <= notesSeenAt() || my !== run) return;
      setTimeout(() => {
        if (my === run && !el.desktop.hidden && latest > notesSeenAt()) toast('코르크 보드에 새 쪽지가 있습니다.', 5000);
      }, Math.max(0, toastEnds - Date.now()));
    }, err => console.warn('새 쪽지를 확인하지 못했다', err));
  }

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
      // 내 컴퓨터에서 암호를 말하면 실험실이 열린다(src/labs.js). 아이콘은 아래 설정 구독이 그린다
      onSay: text => {
        if (os.mode !== 'edit' || text !== PASSWORD || labsOpen()) return;
        openLabs();
        toast('바탕화면에 실험실 아이콘이 생겼습니다.', 4000);
      },
    });
    renderWallpaper();
    // 친구 집도 바탕화면에서 시작한다. 친구 방이 배경이 되고, 손님은 내 아바타로 걸으며 가구를 써 본다.
    if (os.mode === 'visit') {
      toast(`${os.home.owner}의 집에 놀러 왔습니다. 바닥을 눌러 걷고, 가구를 두 번 눌러 사용해 보세요.`, 6000);
    } else if (!walkTipShown && !os.tutorial.active) { // 튜토리얼을 하는 동안에는 걷는 법을 튜토리얼 끝에서 알려 준다
      walkTipShown = true;
      toast('방 바닥을 누르거나 방향키로 걷고, Enter로 말할 수 있습니다.', 5000);
    }
    renderDesktopIcons();
    tick();
    if (os.mode === 'edit') os.tutorial.resume();
  }

  // 친구 컴퓨터를 구경할 때는 editOnly 앱을 숨기고, visitOnly 앱(나도 만들기, 내 컴퓨터로)은 그때만 보인다.
  // ownHome이 적힌 앱은 이 컴퓨터에 내 집이 있는 손님(true)이나 없는 손님(false)에게만 보인다.
  // 공간 바로 가기는 지금 있는 공간의 것을 숨긴다(놀이터에서는 놀이터 대신 집으로가 보인다).
  // 실험실 앱(labs: true)은 실험실을 연 브라우저에서만 보인다(src/labs.js).
  os.canSee = app => (os.mode === 'visit'
    ? !app.editOnly && (app.ownHome === undefined || app.ownHome === os.hasOwnHome)
    : !app.visitOnly) && app.scene !== os.place && (!app.labs || labsOpen());
  function renderDesktopIcons() {
    os.renderIcons(el.icons, APPS.filter(a => !a.folder && os.canSee(a)));
  }
  // 실험실을 열거나 닫으면 아이콘을 다시 그리고, 닫을 때는 실험실 창도 닫는다
  settings.subscribe(patch => {
    if (!('labsOpen' in patch)) return;
    if (!patch.labsOpen) os.wm.get('labs')?.close();
    if (os.mode && !el.desktop.hidden) renderDesktopIcons();
  });

  // 바탕화면 배경: 지금 공간(처음에는 내 방)의 그림과 그곳을 걷는 아바타. 그림을 다시 그리면 상자가 비워지므로 아바타를 다시 넣는다.
  function renderWallpaper() {
    const scene = SCENES.find(s => s.id === os.place);
    el.desktop.dataset.kind = scene.kind; // 바깥 공간(놀이터)이면 바탕화면 뒤를 하늘색으로 칠한다(style.css의 .desktop[data-kind="outdoor"])
    renderStatic(el.wallpaper, os.home.scenes[scene.id], scene, { use: os.useFurniture, gate: os.useGate, door: os.useDoor, neighbor: os.useNeighbor }, os.home.owner, os.home.decor);
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

  // 공유하기의 방 그림에 세울 아바타의 칸과 방향(src/room-image.js). 아바타가 그 공간에 있으면 지금 선 칸, 없으면 그 공간에 들어갈 때 서는 칸이다.
  // 튜토리얼 연습 방을 걷는 동안에는 그림에 담는 집(저장된 집)과 가구가 달라서 들어갈 때 서는 칸을 쓴다.
  os.avatarSpot = scene => (!os.realHome && scene.id === os.place && walker?.spot()) || doorstep(scene) || null;

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
    const twice = doubleClick();
    for (const app of apps) {
      // 새 탭으로 열리는 앱(href)은 누르기 전에 알 수 있게 아이콘에 바깥 화살표를 달고, 마우스를 올리면 열리는 곳을 보여 준다(known-issues 32).
      // 다른 사이트의 게임을 창에 띄우는 앱(src가 https)도 마우스를 올리면 그 사이트 주소를 보여 준다.
      const b = h('button', {
        type: 'button',
        className: app.href ? 'desk-icon external' : 'desk-icon',
        dataset: { app: app.id },
        title: hostTip(app),
        onclick: () => {
          // 폴더 창은 묶음마다 아이콘 상자가 따로라서, 고른 표시는 창 전체(.folder-grid)에서 하나만 남긴다
          for (const o of (container.closest('.folder-grid') || container).querySelectorAll('.desk-icon')) o.classList.toggle('selected', o === b);
          if (twice(app.id)) os.openApp(app.id);
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
  // 시작 단추의 그림은 집으로 아이콘의 16칸 픽셀 그림이다(src/icons.js). 실제 윈도우 로고를 닮은 네 칸 깃발은 쓰지 않는다
  startBtn.querySelector('.start-logo').replaceChildren(iconEl({ title: '시작', icon: 'builtin:home' }, 16));
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
    // 맨 위의 사용자 그림. 내 컴퓨터에서는 내 사진이고, 누르면 사진 바꾸기 창이 열린다(src/user-pictures.js).
    // 튜토리얼 연습 방에서는 보기만 한다(연습에서 한 일은 남지 않는다, known-issues 40).
    // 손님에게는 링크에 담긴 주인 사진이 보이고, 사진이 없는 링크(사진을 넣기 전에 만든 것)면 주인 이름의 첫 글자가 보인다
    const mine = os.mode === 'edit';
    const face = avatar(os.home.owner, mine ? ownPicture(os.home.owner) : os.home.picture);
    const head = mine && !os.realHome
      ? h('button', {
        type: 'button',
        className: 'start-pic',
        title: '사진 바꾸기',
        'aria-label': '사진 바꾸기',
        onclick: () => { menu.hidden = true; openPictureWindow(os); },
      }, face)
      : face;
    menu.replaceChildren(
      h('div', { className: 'start-head' }, head, os.mode === 'visit' ? `${os.home.owner} (손님)` : os.home.owner),
      ...APPS.filter(a => !a.folder && os.canSee(a)).map(app => item(app, app.title, () => os.openApp(app.id))),
      h('hr', { className: 'start-sep' }),
      // 밤과 소리는 누르면 바뀌는 모습을 그림으로 보여 준다(불 끄기는 달, 소리 끄기는 꺼진 스피커)
      item({ title: '밤', icon: settings.get('night') ? 'builtin:day' : 'builtin:night' }, settings.get('night') ? '불 켜기 (낮)' : '불 끄기 (밤)', os.toggleNight),
      item({ title: '소리', icon: settings.get('sound') ? 'builtin:soundOff' : 'builtin:soundOn' }, settings.get('sound') ? '소리 끄기' : '소리 켜기', () => settings.set({ sound: !settings.get('sound') })),
      ...(os.mode === 'edit' && !os.realHome ? [item(os.tutorial.app, '튜토리얼 다시 보기', os.tutorial.restart)] : []),
      item({ title: '로그아웃', icon: 'builtin:logout' }, os.mode === 'visit' ? '구경 마치기' : '로그아웃', showLogin),
      item({ title: '끄기', icon: 'builtin:power' }, '컴퓨터 끄기', requestPowerOff),
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
  // 짧은 링크를 만들어 둔 방이면 서버의 방도 따라 고친다(src/cloud.js의 syncLater). 연습 방은 저장도 올리기도 하지 않는다(known-issues 40).
  os.saveHome = (redraw = true) => {
    if (os.mode === 'edit' && !os.realHome) {
      saveJSON(STORAGE_ROOM, os.home);
      const home = os.home;
      syncLater(() => encodeHome(withPicture(home)));
    }
    if (redraw) renderWallpaper();
  };

  // 아바타가 말풍선으로 한마디 한다(가구에 담아 둔 것이 없을 때 등). 바탕화면이 아니면 아무 일도 하지 않는다.
  os.say = text => walker?.say(text);

  // 앱(iframe)과 주고받는 메시지
  os.sdk = createSdkHost(os);

  // 유튜브 플레이어가 떠 있는 동안에는 그 앞에 아무것도 그리지 않는다(유튜브의 최소 기능 요건: 플레이어 앞에 다른 그림을 겹치지 않는다).
  // 화면 전체에 겹친 깜빡임과 구석 그늘(.fx)을 끄고 화면 보호기를 돌리지 않는다. 라디오의 음악 창이 켜고 끈다(src/apps/radio-app.js)
  os.videoOn = false;
  os.showingVideo = on => {
    os.videoOn = on;
    stage.closest('#screen').classList.toggle('video-on', on); // 화면 효과는 무대 바깥(#screen)에 있다
  };

  // 화면 보호기(src/screensaver.js). 바탕화면을 그냥 둘 때만 돈다. 앞에 고른 창이 있거나(음악, 영상, 게임을 쓰는 중)
  // 가구를 가까이 보는 중, 튜토리얼 중에는 돌지 않는다. 인사말이 없으면 "주인 이름의 컴퓨터"가 흘러간다.
  os.saver = createScreensaver({
    stage,
    canRun: () => !!os.mode && !el.desktop.hidden && !os.wm.focusedWin() && !os.closeup && !os.tutorial?.active && !os.videoOn && document.visibilityState === 'visible',
    text: () => os.home?.greeting || `${os.home?.owner || ''}의 컴퓨터`,
  });

  // 켜 둔 채로 다른 방 링크를 붙여 넣으면 로그인 화면으로 돌아간다(이미 로그인 화면이면 사용자 목록을 다시 만든다).
  window.addEventListener('hashchange', () => {
    if ((os.mode || !el.login.hidden) && (linkCode(location.hash) || linkId(location.hash))) showLogin();
  });

  // ---------- 알림 ----------
  let toastTimer = 0;
  let toastEnds = 0; // 지금 알림이 사라지는 시각. 기다릴 수 있는 알림(새 쪽지)은 앞의 알림을 덮지 않고 이 뒤에 띄운다
  function toast(msg, ms = 2400) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, ms);
    toastEnds = Date.now() + ms;
  }
  function hideToast() {
    el.toast.classList.remove('show');
  }
  os.toast = toast;
  os.hideToast = hideToast; // 가구를 가까이 보는 화면이 열릴 때 앞의 알림을 걷는다(src/closeup.js)

  return os;
}
