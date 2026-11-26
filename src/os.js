// 아가라고요 OS. 전원을 켜면 부팅, 로그인, 바탕화면 순서로 진행하고 앱을 창으로 띄운다.
//   mode: 'edit'  내 컴퓨터 (방을 꾸미고 저장한다)
//         'visit' 공유 링크로 들어온 친구 컴퓨터 (가구는 옮기지 못하고, 바탕화면에서 아바타로 걸으며 써 본다)
// 앱은 src/apps/(기본 앱)와 apps/(팀원 앱, iframe)에 있고, 여기서는 목록대로 열어 주기만 한다.
import { STORAGE_ROOM, STORAGE_SEAT, SCENES, NEW_ROOM_DECOR } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { APPS, APP_BY_ID, hostTip } from '../data/apps.js';
import { createWM } from './win.js';
import { iconEl } from './icons.js';
import { renderStatic, preloadFurniture, staticItem } from './room.js';
import { mountAvatar, mountOwner, preloadAvatars } from './avatar.js';
import { mountPet, NO_PET, patted, petChoice } from './pet.js';
import { visitFlock } from './pigeon.js';
import { BUILTIN_APPS, openFrameApp, openLinkApp } from './apps/index.js';
import { startHomeMusic, syncHomeMusic } from './apps/radio-app.js';
import { openLinkLost } from './apps/share-app.js';
import { createSdkHost } from './sdk-host.js';
import { createScreensaver } from './screensaver.js';
import { createIdleTalk } from './idle-talk.js';
import { labsOpen } from './labs.js';
import { trySecret } from './secrets.js';
import { createHorror, CLOCK as HORROR_CLOCK } from './horror.js';
import { sanitizeHome, encodeHome, linkCode, linkId } from './share.js';
import { sharedId, syncLater, latestNoteAt, notesSeenAt, lostRoom, onLost, markEdited, signedOut, onSignedOut, onMoved, dropUploads } from './cloud.js';
import { sit, moved } from './seat.js';
import { createTutorial } from './tutorial.js';
import { openNeighbors, prefetchNeighbors, rememberVisit } from './neighbors.js';
import { createLogin } from './login.js';
import { ownPicture, withPicture, openPictureWindow } from './user-pictures.js';
import { withRecords } from './records.js';
import { withPet } from './pet-link.js';
import { createHomeSync } from './home-sync.js';
import { openNameWindow } from './user-name.js';
import { openAccountWindow, openLoginNews, newsDue } from './user-account.js';
import { h, wait, reduceMotion, saveJSON, doubleClick, isField } from './util.js';
import { furnitureLine } from './furniture-line.js';
import { play, setPlace } from './sound.js';
import { openMenu, closeMenu } from './context-menu.js';

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
    closeupFrom: null, // 가구를 두 번 눌러 가까이 보기를 여는 동안만 그 가구의 상자. 판이 그 자리에서 커지며 다가온다(src/closeup.js)
    noteDraft: null, // 미니게임의 쪽지 단추로 코르크 보드를 여는 동안만 쪽지 칸에 넣어 둘 글(os.openNoteDraft, F34)
    mode: null,
    hasOwnHome: false, // 이 컴퓨터에 저장된 내 집이 있는지. 손님 바탕화면에서 나도 만들기와 내 컴퓨터로 가운데 무엇을 보일지 정한다
    boardId: null, // 짧은 링크(#s=)나 서버에서 받은 이웃집으로 온 손님이면 그 방 번호. 코르크 보드의 쪽지가 이 번호의 방에 붙는다(src/apps/corkboard-app.js)
    place: SCENES[0].id, // 바탕화면 배경에 보이는 공간(SCENES의 id). 아바타도 이 공간에 있다
    wm: createWM({
      layer: $('#windows'),
      tasks: $('#tasks'),
      toLocal: toStage,
      onVisible: (win, visible) => os.sdk?.tellVisible(win, visible), // 최소화하면 미니게임이 멈춘다(AGA.onHide, known-issues 75)
    }),
  };
  os.tutorial = createTutorial(os);
  let run = 0; // 전원을 끄거나 로그아웃하면 늘려서, 진행 중이던 연출을 멈춘다
  let walker = null; // 바탕화면 방을 걷는 내 아바타(src/avatar.js). 바탕화면에 있는 동안만 있다(avatar는 로그인 사용자 그림 함수 이름)
  let ownerAvatar = null; // 친구 집을 구경할 때 방에 서 있는 주인 아바타(src/avatar.js의 mountOwner). 그 밖에는 null
  let pet = null; // 내 집의 방에 사는 펫(src/pet.js). 내 바탕화면에 있고 펫 설정이 "없음"이 아닐 때만 있다(syncPet)
  let flock = null; // 말풍선에 999999999를 말하면 날아오는 비둘기 떼(src/pigeon.js, F32). 다녀가는 동안만 있다(callPigeon)
  // 말풍선 암호로 여는 숨은 기능(분신사바, 비둘기)이 켜지는 곳. 내 컴퓨터의 진짜 집 바탕화면에서만 켠다.
  // 손님 화면, 친구 집과 이웃집, 튜토리얼과 그 연습 방에서는 켜지 않는다
  const ownRoom = () => os.mode === 'edit' && !os.realHome && !os.tutorial.active && !el.desktop.hidden && !!walker;
  // 분신사바(F29, src/horror.js). 말풍선에 "분신사바"를 말하면(src/secrets.js) 방의 불이 꺼지고 공포 모드가 된다. 메모리에만 있고 불을 켜면 풀린다
  const horror = os.horror = createHorror({
    layer: el.wallpaper,
    avatar: () => walker,
    items: () => os.home?.scenes[os.place] || [],
    figures: () => [walker?.spot(), ...(pet?.claims() || []), ...(flock?.claims() || [])].filter(Boolean), // 빈칸의 말풍선은 아바타와 펫(따라오는 중이어도), 비둘기들이 선 칸을 피한다
    canStart: ownRoom,
    // 다른 탭에 있거나 화면 보호기, 가구 가까이 보기가 방을 가리는 동안은 이상한 일이 늘어나는 시간을 세지 않는다
    canSee: () => !el.desktop.hidden && document.visibilityState === 'visible' && !os.closeup && !os.saver?.showing(),
    onChange: () => {
      syncTheme();
      tick();
    },
  });
  // 방의 불이 꺼져 있는지. 밤 설정(저장된다)이나 공포 모드(저장되지 않는다)이면 꺼져 있다
  const lightsOff = () => !!settings.get('night') || horror.on();

  // 밤 모드: 스탠드나 탁상 조명으로 켜고 끈다. 화면 안쪽(방 그림과 OS 창) 색이 바뀐다.
  // 밤은 방의 불을 끈 상태라 바탕화면에서만 쓴다. 부팅과 로그인 화면은 늘 낮 색이다(known-issues 38).
  function syncTheme() {
    stage.dataset.theme = lightsOff() && !el.desktop.hidden ? 'night' : 'day';
  }
  settings.subscribe(syncTheme);

  function show(...names) {
    for (const k of ['boot', 'login', 'desktop', 'taskbar']) el[k].hidden = !names.includes(k);
    syncTheme();
    el.startMenu.hidden = true;
    closeMenu(); // 떠 있던 오른쪽 단추 메뉴(src/context-menu.js)
    if (!names.includes('desktop')) {
      os.closeup?.close(true);
      walker?.destroy();
      walker = null;
      ownerAvatar?.destroy();
      ownerAvatar = null;
      pet?.destroy();
      pet = null;
      flock?.destroy();
      flock = null;
      os.tutorial.hide();
      setPlace(null); // 배경음악은 바탕화면에서만 튼다
      horror.stop(); // 바탕화면을 떠나면 공포 모드도 풀린다
    }
  }

  // ---------- 부팅 ----------
  // 2005년식 부팅: 검은 화면에 로고와 진행 막대를 2초 보여 준다. 움직임 줄이기를 켠 사람에게는 바로 로그인 화면을 보여 준다.
  os.boot = async () => {
    const my = ++run;
    show('boot');
    preloadFurniture(loginHomes()); // 부팅 화면과 로그인 화면을 지나는 동안 가구 그림을 받아 둔다(바탕화면에 임시 상자가 비치지 않게)
    preloadAvatars(); // 아바타 그림도 같다(바탕화면이 뜬 뒤에 아바타가 늦게 나타나지 않게)
    const sid = linkId(location.hash);
    if (sid) cloudHome(sid).then(home => home && preloadFurniture([home])); // 짧은 링크의 방은 부팅하는 동안 서버에서 받아 온다
    prefetchNeighbors(home => preloadFurniture([home])); // link 이웃집의 방도 같다(로그인 화면과 이웃집 목록 창이 받은 값을 같이 쓴다)
    sync.prefetch(); // 비밀번호가 있는 사용자는 다른 브라우저에서 고친 내 방도 서버에서 미리 읽는다(F36)
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
    os, el, show, enter, toast, clearHash, takeSeat,
    nextRun: () => ++run,
    isCurrent: my => my === run,
    forgetSync: () => sync.forget(),
  });
  // 저장된 사용자를 새로 읽을 때(로그인 화면, 내 컴퓨터로 돌아가기) 부른다. 지금 앉은 사용자의 표시를 기억하고(src/seat.js), 다른 탭에서 바뀌었을 수 있는 펫을 다시 읽는다
  function takeSeat() {
    sit();
    settings.rereadUser();
  }
  // 다른 탭에서 로그인하거나 이 컴퓨터에서 지우거나 초기화해 사용자가 바뀌었다. 이 탭이 들고 있던 앞 사용자의 집은 저장하지도 올리지도 않고 로그인 화면으로 돌아간다(F36).
  // 저장하고 올리기 바로 앞(saveHome, src/cloud.js의 checkStamp)과 storage 이벤트에서 알게 된다. 저장을 부른 쪽이 하던 일을 마친 뒤에 창을 닫는다.
  // 내 컴퓨터에 앉아 있을 때만 돌아간다. 친구 집은 남의 집이라 그대로 두고, 내 컴퓨터로 돌아올 때 저장된 사용자를 새로 읽는다(goHome)
  let leaving = 0;
  os.leave = () => {
    if (!moved()) return; // 이 탭에서 다른 아이디로 로그인하기 전에 줄 세운 올리기가 이제 멈춘 것이다. 지금 사용자의 일은 버리지 않는다
    dropUploads();
    sync.forget();
    clearTimeout(leaving);
    leaving = setTimeout(() => {
      if (!moved()) return;
      const sitting = os.mode === 'edit';
      if (!sitting && (os.mode || el.login.hidden)) return;
      showLogin();
      if (!sitting) return;
      const tell = () => toast('다른 탭에서 사용자가 바뀌었습니다.', 7000);
      if (document.visibilityState === 'visible') tell();
      else document.addEventListener('visibilitychange', tell, { once: true }); // 뒤에 있는 탭이면 돌아왔을 때 알린다
    });
  };
  onMoved(os.leave);
  addEventListener('storage', e => { if (e.key === STORAGE_SEAT && moved()) os.leave(); });
  // 이 컴퓨터에 사는 사람의 닉네임. 손님으로 쪽지를 붙일 때 닉네임 칸에 미리 넣는다(src/apps/corkboard-app.js)
  os.ownName = () => ownHome()?.owner || '';

  // 서버의 방에 올리는 글자. 내 사진(F25)과 미니게임 최고 기록(F34), 고른 펫(F36)을 붙여 담는다(공유하기 창도 같다, src/apps/share-app.js)
  const petNow = () => {
    const v = settings.get('pet');
    return { id: v && v !== NO_PET ? petChoice(v).value : v, pats: settings.get('petPats') };
  };
  const roomCode = os.roomCode = home => encodeHome(withPet(withRecords(withPicture(home)), petNow()));
  // 이 집을 서버에 따라 올린다. 링크가 없거나 연습 방과 친구 집이면 하지 않는다
  const upHome = () => {
    if (os.mode !== 'edit' || os.realHome) return;
    const home = os.home;
    syncLater(() => roomCode(home));
  };
  // 펫은 설정에 있어 saveHome을 지나지 않으므로, 펫을 바꾸거나 쓰다듬으면 여기서 따라 올린다(F36). 비밀번호가 있는지는 상관없다
  settings.subscribe(patch => { if ('pet' in patch || 'petPats' in patch) upHome(); });
  // 이 집의 코르크 보드(방에 건 가구). 없으면 undefined
  const corkboardOf = home => Object.values(home.scenes).flat().find(it => BY_ID[it.id]?.gimmick === 'app:corkboard');

  // boardId: 손님이 코르크 보드에 쪽지를 붙일 서버의 방 번호. 짧은 링크(#s=)로 왔으면 그 링크의 번호, 서버에서 받은 이웃집이면 그 집의 link 번호다
  // (src/neighbors.js의 neighborBoard). 긴 링크로 온 손님과 room 이웃집, 복사본으로 연 이웃집은 없다. 손님이 들어오는 길을 새로 만들면 여기까지 넘긴다.
  async function enter(mode, home, my, boardId = null) {
    if (my !== run) return;
    os.mode = mode;
    os.home = home;
    os.hasOwnHome = mode === 'edit' || !!ownHome();
    os.boardId = mode === 'visit' ? boardId : null;
    // 비밀번호가 있는 사용자는 서버의 방을 읽어 어느 방으로 들어갈지 정한다(F36, 환영 화면에서 최대 4초). 그 밖의 사용자는 null이다
    const reading = mode === 'edit' ? sync.read() : null;
    if (mode === 'edit' && !reading) syncLater(() => roomCode(home)); // 지난번에 탭을 닫느라 서버에 못 올린 고침(친구 집에서 세운 게임 기록 포함)이 있으면 올린다(src/cloud.js)
    el.login.querySelector('.welcome').textContent = '환영합니다';
    el.login.classList.add('entering');
    if (!reduceMotion) await wait(700);
    if (reading) {
      const got = await reading;
      if (my !== run) return; // 기다리는 사이에 전원을 끄거나 로그아웃했다. 환영 화면은 새 로그인 화면이 걷는다(src/login.js의 showLogin)
      os.home = sync.enter(got, home);
    }
    el.login.classList.remove('entering');
    if (my !== run) return;
    // 짧은 링크나 아이디로 들어간 서버의 방은 로그인 화면의 "최근에 놀러 간 집"으로 기억한다. 이웃집과 내가 올린 방은 거기서 거른다(src/neighbors.js)
    if (mode === 'visit' && boardId) rememberVisit(home, boardId);
    showDesktop();
    if (mode !== 'edit') return;
    checkNotes(my);
    tellLost(my);
    tellSignedOut(my);
    tellNews(my);
    if (reading) sync.arrived(my); // 다르게 고친 방이 있으면 묻고, 없으면 지금 방을 올린다
  }

  // 이 컴퓨터가 올린 방을 더는 고칠 수 없게 되어 번호를 잊었으면(src/cloud.js의 forget) 내 바탕화면에 안내 창을 띄운다(src/apps/share-app.js의 openLinkLost).
  // 저절로 뜨는 창이라 튜토리얼 연습 방, 가구 가까이 보기, 화면 보호기, 말하기, 앱(iframe)을 쓰는 동안에는 끼어들지 않고 1초마다 다시 본다.
  // 튜토리얼은 건너뛰지 않으면 계속 떠 있으므로 기다리지 않는다.
  // 친구 집이나 로그인 화면에서 잊었으면 내 컴퓨터로 들어올 때(enter) 띄운다.
  let lostTimer = 0;
  function tellLost(my) {
    clearTimeout(lostTimer);
    const lost = lostRoom();
    if (!lost || my !== run || os.mode !== 'edit') return;
    if (busy()) lostTimer = setTimeout(() => tellLost(my), 1000);
    else openLinkLost(os, APP_BY_ID.share, lost);
  }
  onLost(() => tellLost(run));
  // 저절로 뜨는 창(공유 링크 끊김, 두 곳에서 고친 방, 다시 로그인)이 끼어들면 안 되는 때
  const busy = () => el.desktop.hidden || !!os.realHome || !!os.closeup || os.saver.showing() || !!walker?.typing() || document.activeElement?.tagName === 'IFRAME';

  // 로그인이 풀렸으면(다른 브라우저에서 비밀번호를 바꿈, src/cloud.js의 signedOut) 다시 로그인하는 창을 띄운다(F36, src/user-account.js).
  // 내 컴퓨터로 들어올 때와 앉아 있는 동안 풀린 것을 알게 된 때에 한 번만 저절로 띄운다. 닫은 뒤에는 시작 메뉴의 "아이디와 비밀번호"로 연다.
  // 공유 링크 끊김 창처럼 끼어들면 안 되는 때와 다른 칸에 글을 치는 동안에는 1초마다 다시 본다
  let outTimer = 0;
  let outTold = 0; // 창을 저절로 띄운 실행 번호
  function tellSignedOut(my) {
    clearTimeout(outTimer);
    if (!signedOut() || my !== run || os.mode !== 'edit' || outTold === my) return;
    if (busy() || isField(document.activeElement)) {
      outTimer = setTimeout(() => tellSignedOut(my), 1000);
      return;
    }
    outTold = my;
    openAccountWindow(os, { auto: true });
  }
  onSignedOut(() => tellSignedOut(run));

  // 아이디와 비밀번호가 생기기 전부터 있던 사용자에게 새 기능 안내를 한 번 띄운다(F36, src/user-account.js의 openLoginNews).
  // 다른 저절로 뜨는 창처럼 끼어들면 안 되는 때와 다른 칸에 글을 치는 동안, 공유 링크 끊김 창이 떠 있는 동안에는 1초마다 다시 본다.
  // 튜토리얼을 하는 중이면 끝 카드가 같은 것을 알리므로 띄우지 않는다
  let newsTimer = 0;
  function tellNews(my) {
    clearTimeout(newsTimer);
    if (!newsDue() || my !== run || os.mode !== 'edit' || os.tutorial.active) return;
    if (busy() || isField(document.activeElement) || os.wm.get('link-lost')) {
      newsTimer = setTimeout(() => tellNews(my), 1000);
      return;
    }
    openLoginNews(os);
  }

  // 서버의 방과 맞추기(F36, src/home-sync.js). 비밀번호가 있는 사용자만 해당한다
  const sync = createHomeSync({
    os, roomCode, busy, notice,
    runOf: () => run,
    isCurrent: my => my === run,
    redraw() { // 방이 바뀌었으면 예전 방을 보던 창을 닫고 바탕화면 방을 다시 그린다. 게임 같은 다른 창은 둔다
      for (const key of ['room', 'share', 'user-name', 'user-picture']) os.wm.get(key)?.close();
      renderWallpaper();
      for (const w of os.wm.all()) w.refreshOwner?.();
    },
  });
  // 다시 로그인한 뒤 서버의 방과 맞춘다(src/user-account.js). 로그인이 또 풀리면 창을 다시 띄운다
  os.syncAgain = () => {
    outTold = 0;
    return sync.again();
  };
  // 저절로 생긴 일을 알린다. 다른 알림이 떠 있으면 그것이 사라진 뒤에 띄우고, 바탕화면이 아직 뜨지 않았으면 기다린다
  function notice(text, my = run) {
    if (my !== run || os.mode !== 'edit') return;
    if (el.desktop.hidden) setTimeout(() => notice(text, my), 500);
    else setTimeout(() => { if (my === run && !el.desktop.hidden) toast(text, 5000); }, Math.max(0, toastEnds - Date.now()));
  }

  // 주인이 내 컴퓨터로 들어오면 코르크 보드에 새 쪽지가 붙었는지 본다. 서버에서 가장 최근 쪽지 한 장만 읽는다(src/cloud.js의 latestNoteAt).
  // 짧은 링크가 있고 보드를 방에 걸어 두었을 때만 묻는다. 걷는 법 안내가 떠 있으면 그 안내가 사라진 뒤에 알리고,
  // 그사이에 주인이 보드를 열어 쪽지를 봤으면(notesSeenAt) 알리지 않는다.
  function checkNotes(my) {
    if (!corkboardOf(os.home) || !sharedId()) return;
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
    takeSeat();
    const own = ownHome();
    if (own) switchTo('edit', own);
    else showLogin();
  };

  // 이웃집에 손님으로 들어간다(src/neighbors.js의 openNeighbors). 방의 현관문으로 여는 이웃집 목록 창에서 이웃을 고르거나 아이디로 찾아온다. boardId는 enter와 같다.
  // 아이디로 찾은 방은 부팅할 때 받아 두지 않았으므로 환영 화면을 지나는 동안 가구 그림을 받는다(known-issues 54). 이미 받은 그림은 다시 받지 않는다
  os.visit = (home, boardId = null) => {
    clearHash();
    preloadFurniture([home]);
    switchTo('visit', home, boardId);
  };

  // 바탕화면에서 곧장 다른 컴퓨터(또는 내 컴퓨터)로 옮겨 간다. 로그인할 때처럼 환영 화면을 거친다.
  // 로그인 화면을 보이면서 바탕화면을 떠나므로 하던 튜토리얼은 멈추고(돌아오면 이어진다), 연습 방이었으면 연습을 끝낸다.
  function switchTo(mode, home, boardId = null) {
    const my = ++run;
    os.wm.closeAll();
    show('login');
    enter(mode, home, my, boardId);
  }

  // ---------- 바탕화면 ----------
  function showDesktop() {
    os.closeup?.close(true);
    horror.stop(); // 바탕화면을 새로 만들면(튜토리얼 연습 방을 열고 닫을 때) 공포 모드는 풀린다
    show('desktop', 'taskbar');
    stage.dataset.mode = os.mode;
    os.place = SCENES[0].id;
    setPlace(os.place);
    walker?.destroy();
    ownerAvatar?.destroy();
    pet?.destroy();
    pet = null;
    flock?.destroy();
    flock = null;
    // 친구 집을 구경하면 주인 아바타가 방에 서 있고, 손님인 내 아바타는 손님 옷 색을 입는다(2026-11-17까지 실험실 host-avatar)
    const withOwner = os.mode === 'visit';
    ownerAvatar = withOwner ? mountOwner({ layer: el.wallpaper, items: () => os.home.scenes[os.place] }, os.home.owner) : null;
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
      // 튜토리얼의 말하기 단계를 넘기고, 내 컴퓨터에서 암호를 말하면 숨은 기능이 열린다(src/secrets.js. 실험실 아이콘은 아래 설정 구독이 그린다).
      // 튜토리얼에서 한 말은 암호로 듣지 않는다(trySecret이 튜토리얼을 거른다)
      onSay: text => {
        if (!text) return;
        os.tutorial.said();
        trySecret(os, text);
      },
      others: () => [ownerAvatar, pet, ...(flock?.birds() || [])].filter(Boolean),
    }, 'basic', { guest: withOwner });
    renderWallpaper();
    syncPet();
    greetGuest();
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
    startHomeMusic(os); // 실험실의 친구 집 배경음악(home-bgm)을 켰으면 친구 집에서 주인 라디오의 첫 유튜브 CD를 튼다
  }

  // 친구 컴퓨터를 구경할 때는 editOnly 앱을 숨기고, visitOnly 앱(나도 만들기, 내 컴퓨터로)은 그때만 보인다.
  // ownHome이 적힌 앱은 이 컴퓨터에 내 집이 있는 손님(true)이나 없는 손님(false)에게만 보인다.
  // noPractice 앱(펫)은 튜토리얼 연습 방에서 숨긴다. 연습 방에는 펫이 없고, 연습에서 한 일은 남지 않아야 한다(known-issues 40).
  // 공간 바로 가기(data/apps.js의 scene)는 지금 있는 공간의 것을 숨긴다.
  // 실험실 앱(labs: true)은 실험실을 연 브라우저에서만 보인다(src/labs.js).
  os.canSee = app => (os.mode === 'visit'
    ? !app.editOnly && (app.ownHome === undefined || app.ownHome === os.hasOwnHome)
    : !app.visitOnly) && !(app.noPractice && os.realHome) && app.scene !== os.place && (!app.labs || labsOpen());
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
    renderStatic(el.wallpaper, os.home.scenes[scene.id], scene, { use: os.useFurniture, door: os.useDoor }, os.home.decor);
    ownerAvatar?.attach(scene.id === SCENES[0].id, doorstep(scene)); // 주인은 방에만 선다. 손님이 주인이 선 칸을 피하도록 손님보다 먼저 세운다
    walker?.attach();
    pet?.attach(scene.id === SCENES[0].id); // 펫은 방에만 있다. 아바타가 선 칸을 피해 앉도록 아바타 다음에 세운다
    petChanged(); // 방이 가구로 꽉 차 펫이 앉을 칸이 없으면 펫 창이 그렇다고 쓴다
    flock?.attach(scene.id === SCENES[0].id); // 날아온 비둘기들은 펫 둘레를 피해 앉도록 펫 다음에 세운다
    markLiked();
    horror.attach(); // 공포 모드의 어둠과 기운 벽 가구도 다시 붙인다
  }

  // 내 집의 방에 사는 펫(src/pet.js). 고르기 전에는 기본 펫이 살고, 펫 창(src/apps/pet-app.js)에서 "없음"을 고르면 바로 사라진다.
  // 내 컴퓨터의 진짜 집에만 둔다. 친구 집과 이웃집, 튜토리얼 연습 방에는 없다(2026-11-17까지 실험실 pet).
  // 바탕화면을 만든 뒤와 펫 설정이 바뀔 때 부른다. 종류나 색만 바뀌면 그 자리에서 그림만 바꾼다
  function syncPet() {
    const want = settings.get('pet') !== NO_PET && os.mode === 'edit' && !os.realHome && !!walker;
    if (!want) {
      pet?.destroy();
      pet = null;
    } else if (!pet) {
      pet = mountPet({
        layer: el.wallpaper,
        items: () => os.home.scenes[os.place],
        avatar: () => walker,
        others: () => flock?.birds() || [], // 날아온 비둘기들과 붙어 앉지 않는다
        look: () => settings.get('pet'),
        pat: petPatted,
        menu: { root: stage, toStage }, // 오른쪽 단추로 누르면 쓰다듬기가 든 메뉴를 시작 메뉴처럼 무대에 띄운다
      });
      pet.attach(os.place === SCENES[0].id);
    }
    petChanged();
  }
  // 펫 창(src/apps/pet-app.js)이 방의 펫을 읽고 단추로 쓰다듬는다. 방에 펫이 없으면 null이다
  os.pet = () => pet;
  // 펫이 생기거나 사라지거나 방을 다시 그리면 열린 펫 창을 다시 그린다(win.refreshPet). 종류가 바뀌어 하는 일이 바뀐 것은 창이 설정 구독으로 안다
  function petChanged() {
    for (const w of os.wm.all()) w.refreshPet?.();
  }

  // 말풍선에 999999999를 말하면(src/secrets.js) 비둘기 떼가 창문이나 현관문으로 날아와 조금 있다 간다(src/pigeon.js, F32).
  // 분신사바와 같은 곳(ownRoom)의 내 방에서만 오고, 한 번에 한 떼다. 이미 와 있으면 한 마리가 한 번 더 "구구" 한다
  os.callPigeon = () => {
    if (flock) return flock.coo();
    if (!ownRoom() || os.place !== SCENES[0].id) return;
    const visitor = visitFlock({
      layer: el.wallpaper,
      items: () => os.home.scenes[os.place],
      avatar: () => walker,
      pet: () => pet,
      door: SCENES[0].door,
      gone: () => {
        if (flock === visitor) flock = null;
      },
    });
    flock = visitor;
  };

  // 펫을 쓰다듬을 때마다 부른다(src/pet.js). 쓰다듬은 횟수를 설정(petPats)에 세고(펫 창이 보인다), 병아리처럼 자라는 펫이 다 자라면
  // 펫 설정을 자란 종류로 바꿔 그 자리에서 그림이 바뀌게 하고(아래 구독의 restyle) 아바타가 한마디 한다(data/pets.js의 grown)
  function petPatted() {
    const next = patted(settings.get('pet'), settings.get('petPats'));
    settings.set(next);
    if (next.pet) walker?.say(petChoice(next.pet).species.grown || '');
  }
  settings.subscribe(patch => {
    if (!('pet' in patch)) return;
    syncPet();
    pet?.restyle();
  });

  // 손님이 방에 들어오면(친구 집에 들어올 때와 다른 공간에서 돌아올 때) 주인 아바타가 인사말을 한 번 말한다. 인사말이 비었으면 말하지 않는다
  function greetGuest() {
    ownerAvatar?.greet(os.home.greeting, walker?.spot());
  }

  // 담긴 가구 반짝임(2026-11-17까지 실험실 like-sparkle). 주인이 무언가 담아 둔 바탕화면 가구에 has-like를 달면 style.css가 그 가구 위에 작은 별을 띄운다.
  // 주인 화면과 손님 화면 모두에 띄워 주인이 손님과 같은 방을 본다.
  // 별은 가구 요소의 ::after라서, 가구 그림이 늦게 와 가구 상자를 다시 채워도(room.js의 furnitureEl) 지워지지 않는다(known-issues 22).
  // 방을 다시 그린 뒤와 담아 둔 것이 바뀐 뒤(saveHome)에 부른다. 방 꾸미기 창(renderItems)에는 달지 않고, 튜토리얼 연습 방에서도 뺀다.
  // 별마다 깜박이는 때를 0.4초씩 어긋나게 해서 한꺼번에 깜박이지 않게 한다. 담긴 것은 집 상태의 likes에서 읽기만 한다(코르크 보드의 쪽지는 서버에 있어 알 수 없다).
  function markLiked() {
    if (!os.home) return;
    const on = !os.realHome;
    let n = 0;
    for (const furn of el.wallpaper.querySelectorAll('.furn.static')) {
      const liked = on && Object.hasOwn(os.home.likes ?? {}, furn.dataset.id);
      furn.classList.toggle('has-like', liked);
      if (liked) furn.style.setProperty('--twinkle', `${-0.4 * n++}s`);
    }
  }
  settings.subscribe(patch => {
    if (!('labs' in patch || 'labsOpen' in patch)) return;
    syncHomeMusic(os); // 친구 집에서 친구 집 배경음악(home-bgm)을 켜면 바로 틀고, 끄면 저절로 연 음악 창을 닫는다
  });

  // 바탕화면의 공간을 옮긴다(data/apps.js의 공간 바로 가기). 아바타도 같이 가서, 문이 있는 공간에서는 그 문 앞 칸에 선다(내 방은 현관문 앞).
  // 지금은 공간이 내 방 하나라 부르는 곳이 없다.
  // 방 꾸미기 창의 탭과는 따로 움직인다(꾸미는 화면은 꾸밀 공간을 탭으로 고른다).
  const doorstep = scene => {
    if (scene.door) return scene.door.wall === 'R' ? { x: scene.door.x, y: 1 } : { x: 1, y: scene.door.x };
    return undefined;
  };
  os.goScene = id => {
    const scene = SCENES.find(s => s.id === id);
    if (!scene || id === os.place) return;
    os.closeup?.close(true); // 가구를 가까이 보는 동안에도 공간을 옮길 수 있다
    os.place = id;
    play('enter'); // 공간을 옮길 때 문 닫히는 소리를 낸다
    setPlace(id);
    walker?.moveTo(doorstep(scene));
    renderWallpaper();
    renderDesktopIcons();
    greetGuest();
  };

  // 공유하기의 방 그림에 세울 아바타의 칸과 방향(src/room-image.js). 아바타가 그 공간에 있으면 지금 선 칸, 없으면 그 공간에 들어갈 때 서는 칸이다.
  // 튜토리얼 연습 방을 걷는 동안에는 그림에 담는 집(저장된 집)과 가구가 달라서 들어갈 때 서는 칸을 쓴다.
  os.avatarSpot = scene => (!os.realHome && scene.id === os.place && walker?.spot()) || doorstep(scene) || null;

  // 방의 현관문을 두 번 눌렀을 때. 아바타가 문 앞까지 걸어간 뒤 이웃집 목록 창을 띄우고, 그 창에서 갈 집을 고른다(src/neighbors.js).
  // 지금 바탕화면에 있는 집은 목록에 넣지 않는다.
  os.useDoor = door => {
    const list = () => openNeighbors(os);
    if (walker) walker.approachWall(door.wall, door.x, door.w, list);
    else list();
  };
  let walkTipShown = false; // 걷는 법 안내는 페이지를 열고 처음 바탕화면에 왔을 때 한 번만

  // 튜토리얼 다시 보기의 연습 방(src/tutorial.js). 저장된 집을 realHome에 두고 빈 집으로 바꿔 낀다.
  // 화면과 창은 모두 os.home을 읽으므로 바꿔 끼우기만 하면 따라온다. 저장(os.saveHome)만 막고, 공유는 realHome을 읽는다.
  // 바탕화면을 다시 만들어 가구로 걸어가던 아바타의 예약도 버린다. 남아 있으면 연습이 끝난 뒤 진짜 밤낮을 바꾼다.
  // 모두 메모리에만 있어서 새로 고침을 하면 저장된 집으로 돌아온다(known-issues 40).
  os.startPractice = () => {
    os.realHome = os.home;
    os.home = sanitizeHome({ owner: os.home.owner, decor: NEW_ROOM_DECOR });
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

  // ---------- 오른쪽 단추 메뉴 ----------
  // 화면 안에서는 브라우저의 메뉴 대신 그 자리의 메뉴(src/context-menu.js)를 띄운다. 윈도우 XP의 바로 가기 메뉴처럼 자리마다
  // 이 사이트에 이미 있는 일 가운데 그 자리에서 할 수 있는 것만 담고, 맨 위의 굵은 줄은 그 자리를 두 번 누를 때 하는 일이다.
  // 친구 집의 손님에게는 손님이 할 수 있는 줄만 보인다(방 꾸미기는 os.canSee가 가린다).
  // 메뉴가 없는 자리(창 안, 작업 표시줄의 빈 곳과 시작 단추, 시작 메뉴, 로그인 화면)에서는 아무것도 띄우지 않는다. 윈도우도 대화 상자의 빈 곳처럼
  // 할 일이 없는 자리에서는 메뉴를 띄우지 않았다.
  // 글을 치는 칸과 링크에서는 복사, 붙여 넣기, 링크 주소 복사를 쓰도록 브라우저의 메뉴를 그대로 둔다.
  // 펫은 자기 메뉴를 스스로 띄우고 막아 둔다(src/pet.js). 창 안의 미니게임(iframe)은 다른 문서라 여기까지 오지 않고,
  // 모니터 테두리와 페이지 바탕은 컴퓨터 바깥이라 브라우저의 메뉴가 뜬다
  stage.addEventListener('contextmenu', e => {
    if (e.defaultPrevented || isField(e.target) || e.target.closest('a[href]')) return;
    e.preventDefault();
    const menu = menuFor(e.target);
    if (menu) openMenu({ root: stage, toStage }, e, menu.lines, menu.label);
  });
  const lightLabel = () => (lightsOff() ? '불 켜기 (낮)' : '불 끄기 (밤)');
  const decorate = () => os.canSee(APP_BY_ID.room) && { label: '방 꾸미기', run: () => os.openApp('room') };

  // 누른 자리의 메뉴 { label: 메뉴 이름, lines: 줄 목록 }. 메뉴가 없는 자리면 null
  function menuFor(t) {
    // 창 제목 줄과 작업 표시줄 단추는 그 창의 창 메뉴(src/win.js의 win.menu)
    const bar = t.closest('.win-bar');
    const task = t.closest('.task');
    if (bar || task) {
      const win = os.wm.all().find(w => w.el.contains(bar) || w.task === task);
      return win ? { label: '창 메뉴', lines: win.menu() } : null;
    }
    // 아이콘(바탕화면과 게임 폴더 창)은 두 번 누를 때처럼 연다. 윈도우처럼 누른 아이콘을 고른 것으로 표시한다.
    // 새 탭으로 열리는 앱(href)은 아이콘처럼 바깥 화살표를 달고 마우스를 올리면 열리는 곳을 보여 준다(known-issues 32)
    const icon = t.closest('.desk-icon');
    if (icon) {
      const app = APP_BY_ID[icon.dataset.app];
      if (!app) return null;
      for (const o of (icon.closest('.folder-grid') || icon.parentElement).querySelectorAll('.desk-icon')) o.classList.toggle('selected', o === icon);
      return { label: `${app.title} 메뉴`, lines: [{ label: '열기', main: true, external: !!app.href, tip: hostTip(app), run: () => os.openApp(app.id) }] };
    }
    if (!el.desktop.contains(t) || t.closest('.win, .closeup, .closeup-out')) return null;
    // 내 아바타는 누를 때처럼 말하기. 친구 집의 주인 아바타는 누르기를 받지 않아 그 뒤의 가구나 바닥이 눌린다
    if (t.closest('.room-avatar:not(.room-owner), .say-cue')) {
      return walker ? { label: '아바타 메뉴', lines: [{ label: '말하기', main: true, run: () => walker.openSay() }] } : null;
    }
    if (t.closest('.room-pet')) return null; // 날아온 비둘기에는 메뉴가 없다. 내 펫의 메뉴는 펫이 띄운다
    if (t.closest('.door-hit')) {
      const door = SCENES.find(s => s.id === os.place)?.door;
      return door ? { label: '현관문 메뉴', lines: [{ label: '이웃집 놀러 가기', main: true, run: () => os.useDoor(door) }] } : null;
    }
    // 방의 가구는 두 번 누를 때처럼 아바타가 가서 쓴다. 불빛 가구는 쓰면 무슨 일이 생기는지 시작 메뉴와 같은 말로 적는다
    const furn = t.closest('.item.static');
    const item = furn && staticItem(furn);
    if (item) {
      const def = BY_ID[item.id];
      const use = { label: def.gimmick === 'night' ? lightLabel() : '사용하기', main: true, run: () => os.useFurniture(item, furn) };
      return { label: `${def.name} 메뉴`, lines: [use, '-', decorate()] };
    }
    // 바탕화면의 빈 곳(방의 바닥과 벽, 방 둘레). 윈도우 XP의 바탕화면 메뉴(아이콘 정렬, 새로 고침, 붙여넣기, 새로 만들기, 속성) 가운데
    // 이 사이트에 있는 것은 속성 창의 바탕 화면 탭과 디자인(창 색) 탭뿐이라, 방 꾸미기와 방의 불(끄면 창도 밤 색이 된다)을 둔다.
    // 속성처럼 창을 여는 방 꾸미기를 맨 아래에 둔다
    return { label: '바탕화면 메뉴', lines: [{ label: lightLabel(), run: os.toggleNight }, decorate()] };
  }

  // 밤과 낮. 스탠드나 탁상 조명을 누르면 바뀌고, OS 전체 색이 같이 바뀐다.
  // 공포 모드(src/horror.js)에서는 불을 켜는 쪽으로만 간다. 낮이 되고 공포 모드가 풀린다
  os.toggleNight = () => {
    if (horror.on()) {
      if (settings.get('night')) settings.set({ night: false });
      return horror.end();
    }
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
    // 맨 위의 사용자 그림과 이름. 내 컴퓨터에서는 내 사진과 내 이름이고, 사진을 누르면 사진 바꾸기 창(src/user-pictures.js)이,
    // 이름을 누르면 이름 바꾸기 창(src/user-name.js)이 열린다. 튜토리얼 연습 방에서는 보기만 한다(연습에서 한 일은 남지 않는다, known-issues 40).
    // 손님에게는 링크에 담긴 주인 사진이 보이고, 사진이 없는 링크(사진을 넣기 전에 만든 것, 내 그림을 쓰는 주인의 긴 링크)면 주인 이름의 첫 글자가 보인다
    const mine = os.mode === 'edit';
    const editable = mine && !os.realHome;
    const face = avatar(os.home.owner, mine ? ownPicture(os.home.owner) : os.home.picture);
    const head = editable
      ? h('button', {
        type: 'button',
        className: 'start-pic',
        title: '사진 바꾸기',
        'aria-label': '사진 바꾸기',
        onclick: () => { menu.hidden = true; openPictureWindow(os); },
      }, face)
      : face;
    const name = editable
      ? h('button', { type: 'button', className: 'start-name', title: '이름 바꾸기', onclick: () => { menu.hidden = true; openNameWindow(os); } }, os.home.owner)
      : os.mode === 'visit' ? `${os.home.owner} (손님)` : os.home.owner;
    // 밤과 소리는 누르면 바뀌는 모습을 그림으로 보여 준다(불 끄기는 달, 소리 끄기는 꺼진 스피커)
    const light = item({ title: '밤', icon: lightsOff() ? 'builtin:day' : 'builtin:night' }, lightLabel(), os.toggleNight);
    menu.replaceChildren(
      h('div', { className: 'start-head' }, head, name),
      ...APPS.filter(a => !a.folder && os.canSee(a)).map(app => item(app, app.title, () => os.openApp(app.id))),
      h('hr', { className: 'start-sep' }),
      light,
      item({ title: '소리', icon: settings.get('sound') ? 'builtin:soundOff' : 'builtin:soundOn' }, settings.get('sound') ? '소리 끄기' : '소리 켜기', () => settings.set({ sound: !settings.get('sound') })),
      ...(os.mode === 'edit' && !os.realHome ? [item(os.tutorial.app, '튜토리얼 다시 보기', os.tutorial.restart)] : []),
      // 2026-11-18까지 여기 있던 "펫 바꾸기" 줄은 펫 창(src/apps/pet-app.js)으로 합쳤다. 펫 창은 위의 앱 줄에 "펫"으로 나온다(known-issues 80)
      // 이름 바꾸기는 맨 위의 이름 말고도 글자로 된 줄로 둔다. 이름만 누르게 했을 때는 그냥 글자처럼 보여 찾기 어려웠다(known-issues 80).
      // 윈도우 10의 아바타 메뉴가 로그아웃 옆에 계정 설정을 두는 것처럼 로그아웃 바로 위에 둔다. 아이디와 비밀번호(F36, src/user-account.js)는 그 아래다
      ...(editable ? [
        item({ title: '이름 바꾸기', icon: 'builtin:rename' }, '이름 바꾸기', () => openNameWindow(os)),
        item({ title: '아이디와 비밀번호', icon: 'builtin:key' }, '아이디와 비밀번호', () => openAccountWindow(os)),
      ] : []),
      item({ title: '로그아웃', icon: 'builtin:logout' }, os.mode === 'visit' ? '구경 마치기' : '로그아웃', showLogin),
      item({ title: '끄기', icon: 'builtin:power' }, '컴퓨터 끄기', requestPowerOff),
    );
    menu.hidden = false;
    // 분신사바의 공포 모드가 menu 단계를 지났으면 불 켜기 글이 한 번 잠깐 바뀐다(src/horror.js). 아이콘(iconEl)도 span이라 마지막 span인 글을 넘긴다
    horror.menu(light.lastElementChild);
  }

  // 작업 표시줄 시계. 공포 모드에서는 04:44에 멈춘다(src/horror.js)
  function tick() {
    const d = new Date();
    el.taskbar.querySelector('.clock').textContent = horror.on()
      ? HORROR_CLOCK
      : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  setInterval(tick, 20000);

  // ---------- 앱 ----------
  // builtin이 있으면 src/apps/의 기본 앱으로, src가 있으면 iframe 창으로, href가 있으면 새 탭에서 열린다고 알린 뒤 새 탭으로 연다.
  os.openApp = id => {
    const app = APP_BY_ID[id];
    if (!app || !os.canSee(app)) return;
    if (app.scene) return os.goScene(app.scene); // 공간 바로 가기는 창 대신 바탕화면을 그 공간으로 옮긴다
    if (app.builtin) return BUILTIN_APPS[app.builtin]?.(os, app);
    if (app.src) return openFrameApp(os, app);
    if (app.href) return openLinkApp(os, app);
  };

  // 바탕화면에서 가구를 두 번 눌렀을 때. 아바타가 그 옆으로 걸어간 뒤 기믹을 쓴다(심즈처럼 캐릭터가 가서 쓴다).
  // 그 가구 위에 고양이가 올라가 있으면 아바타가 다 왔을 때 뛰어내려 비킨다(src/pet.js의 vacate).
  // from은 그 가구의 상자다. 가까이 보기를 열면 판이 그 자리에서 커지며 다가온다(src/closeup.js가 여는 동안에만 읽는다)
  os.useFurniture = (item, from) => {
    const use = () => {
      pet?.vacate(item);
      os.closeupFrom = from || null;
      try {
        os.openFurniture(item, from);
      } finally {
        os.closeupFrom = null;
      }
      os.tutorial.used(item.id);
    };
    if (walker) walker.approach(item, use);
    else use();
  };

  // 가구 기믹. 가구 목록의 gimmick 대로 하고, 아직 기믹이 없는 가구는 빈 창 대신 아바타가 그 가구의 혼잣말 한 줄(data/furniture.js의 say)을 말한다.
  // 공포 모드에서는 혼잣말이 src/horror.js의 줄로 바뀐다. 기믹은 그대로이고, 불빛 가구('night')는 불을 켜서 공포 모드를 푼다.
  // 'scene:' 기믹은 바탕화면을 그 공간으로 옮긴다(지금은 공간이 내 방 하나라 쓰는 가구가 없다).
  // el은 그 가구의 상자다. 쓰는 동안의 그림이 있는 가구(data/furniture.js의 open, 옷장)는 혼잣말이 떠 있는 동안 상자에 is-open을 달아
  // 그 그림(문이 열린 옷장)을 보인다. 다시 쓰면 그때부터 다시 센다
  const openTimers = new WeakMap();
  os.openFurniture = (item, el = null) => {
    const def = BY_ID[item.id];
    if (def.gimmick === 'night') return os.toggleNight();
    if (def.gimmick?.startsWith('scene:')) return os.goScene(def.gimmick.slice(6));
    if (def.gimmick?.startsWith('app:')) return os.openApp(def.gimmick.slice(4));
    const ms = walker?.say(horror.on() ? horror.line(item) : furnitureLine(def));
    if (!def.open || !el || !ms) return;
    clearTimeout(openTimers.get(el));
    el.classList.add('is-open');
    openTimers.set(el, setTimeout(() => el.classList.remove('is-open'), ms));
  };

  // redraw: 가구 배치가 바뀌었으면 바탕화면 방을 다시 그린다. 가구에 담아 둔 것(src/likes.js)만 바뀌었으면 false로 저장만 한다.
  // 짧은 링크를 만들어 둔 방이면 서버의 방도 따라 고친다(src/cloud.js의 syncLater). 연습 방은 저장도 올리기도 하지 않는다(known-issues 40).
  os.saveHome = (redraw = true) => {
    if (os.mode === 'edit' && !os.realHome) {
      if (moved()) return os.leave(); // 다른 탭에서 사용자가 바뀌었다. 이 탭의 집은 앞 사용자의 것이다
      saveJSON(STORAGE_ROOM, os.home);
      markEdited(); // 두 곳에서 고친 방 창이 보일 시각(F36). 비밀번호가 있는 사용자만 남는다
      upHome();
    }
    if (redraw) renderWallpaper();
    else markLiked(); // 담아 둔 것만 바뀌었으면 방은 그대로 두고 반짝임만 고친다
  };

  // 내 컴퓨터의 미니게임이 최고 기록을 새로 남겼다(src/sdk-host.js의 saved). 기록은 링크에 담기므로(F34) 짧은 링크를 만든 방이면
  // 서버의 방도 따라 고친다. 판이 이어지는 동안 기록이 계속 바뀌어도 syncLater가 3초 동안 바뀌지 않을 때 한 번만 올린다.
  // 친구 집에서 세운 내 기록은 내 컴퓨터로 돌아올 때 올린다(enter). 연습 방에서는 올리지 않는다(known-issues 40)
  os.recordChanged = upHome;

  // 손님이 이 집의 코르크 보드에 쪽지를 남길 수 있는지. 서버에 있는 방(boardId)이고 주인이 보드를 방에 걸어 두었을 때다
  os.canNote = () => os.mode === 'visit' && !!os.boardId && !!corkboardOf(os.home);

  // 친구 집 미니게임의 결과 화면에서 쪽지 단추를 누르면(src/sdk-host.js의 note) 그 집의 코르크 보드를 열고 쪽지 쓰기 칸에 기록을 넣어 둔다(F34).
  // 게임 창에서 바로 넘어오므로 아바타는 걸어가지 않고, 보드가 방의 그 가구 자리에서 커지며 다가온다(os.closeupFrom).
  // 넣어 둘 글은 열리는 동안만 os.noteDraft에 두고, 코르크 보드(src/apps/corkboard-app.js)가 읽어 간다
  os.openNoteDraft = text => {
    const board = corkboardOf(os.home);
    if (!os.canNote() || !board) return;
    os.noteDraft = text;
    os.closeupFrom = el.wallpaper.querySelector(`.furn[data-id="${board.id}"]`);
    try {
      os.openApp(BY_ID[board.id].gimmick.slice(4)); // 'app:corkboard'
    } finally {
      os.closeupFrom = null;
      os.noteDraft = null;
    }
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

  // 실험실의 '심심할 때 혼잣말'(idle-talk, src/idle-talk.js). 내 방과 친구 집에서 내 아바타가 한다.
  // 바탕화면을 그냥 둘 때만 하고, 최소화하지 않은 창이 하나라도 있거나 방 꾸미기 창이 열려 있으면(최소화해도) 쉰다.
  // 가구 가까이 보기, 튜토리얼과 연습 방, 화면 보호기, 말풍선에 쓰는 중에도 쉰다
  createIdleTalk({
    avatar: () => walker,
    items: () => (os.home?.scenes[os.place] || []).filter(item => BY_ID[item.id]),
    line: item => (horror.on() ? horror.line(item) : furnitureLine(BY_ID[item.id])), // 공포 모드에서는 가구를 두 번 누를 때와 같은 공포 모드의 줄
    canRun: () => !!os.mode && !el.desktop.hidden && !os.closeup && !os.tutorial?.active && !os.realHome && !os.saver.showing()
      && !walker?.typing() && document.visibilityState === 'visible' && !os.wm.get('room') && os.wm.all().every(w => w.minimized),
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
