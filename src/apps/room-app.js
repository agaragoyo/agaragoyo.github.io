// 기본 앱: 방 꾸미기. 집 안의 공간(내 방, 놀이터 ...)을 탭으로 오가며 꾸민다.
// 1280×840 크기의 공간과 선반을 창 크기에 맞춰 줄여 보여 준다.
import { ROOM_W, STAGE_H, SCENES } from '../config.js';
import { APP_BY_ID } from '../../data/apps.js';
import { renderItems, setSceneBg } from '../room.js';
import { mountShelf, filterShelf } from '../shelf.js';
import { mountAvatar } from '../avatar.js';

const ROOT_H = STAGE_H; // 공간 720 + 선반 120

// el 의 왼쪽 위가 무대(1280×840)의 어디에 있는지. 변형(transform)은 세지 않는 레이아웃 위치다.
function stageOffset(el, stage) {
  let x = 0;
  let y = 0;
  while (el && el !== stage) {
    const parent = el.offsetParent;
    x += el.offsetLeft + (parent?.clientLeft || 0);
    y += el.offsetTop + (parent?.clientTop || 0);
    el = parent;
  }
  return { x, y };
}

// sceneId: 처음 보여 줄 공간. 놀이터 바로 가기(앱 목록의 scene)와 바탕화면 배경의 창문이 넘긴다.
// 방 꾸미기 창은 하나뿐이라, 이미 열려 있으면 그 창을 앞으로 가져와 공간만 바꾼다.
export function openRoomApp(os, appInfo, sceneId = appInfo.scene) {
  const opened = os.wm.get('room');
  if (opened) {
    opened.focus();
    if (sceneId) opened.showScene(sceneId);
    return opened;
  }
  const visiting = os.mode === 'visit';
  return os.wm.open({
    key: 'room',
    app: APP_BY_ID.room, // 바로 가기로 열어도 창과 작업 표시줄에는 방 꾸미기 아이콘을 쓴다
    title: visiting ? `${os.home.owner}의 집` : '방 꾸미기',
    width: 1100,
    height: 700,
    maximized: true,
    flush: true,
    build(body, win) {
      body.classList.add('room-app');
      body.innerHTML = `
        <div class="room-root">
          <div class="room"><div class="items"></div></div>
          <div class="shelf">
            <button type="button" class="shelf-arrow" aria-label="앞 가구">◀</button>
            <div class="shelf-track"></div>
            <button type="button" class="shelf-arrow" aria-label="뒤 가구">▶</button>
            <p class="shelf-visit">친구 집의 가구는 옮길 수 없습니다. 가구를 눌러 구경해 보세요.</p>
          </div>
          <p class="rotate-tip">가구를 끄는 동안 R 키나 마우스 휠로 돌릴 수 있어요</p>
          <p class="walk-tip">바닥을 누르거나 방향키로 걷고, Enter로 말해요</p>
          <div class="hud">
            <span class="owner"></span>
            <span class="scene-tabs" role="tablist"></span>
            <button type="button" class="btn" data-act="say">말하기</button>
            <button type="button" class="btn edit-only" data-act="share">공유 링크</button>
            <button type="button" class="btn visit-only" data-act="mine">나도 만들기</button>
          </div>
        </div>`;
      const root = body.querySelector('.room-root');
      root.dataset.mode = os.mode;
      let fit = { s: 1, tx: 0, ty: 0 };
      let scene = SCENES[0];

      const ctx = {
        root,
        roomEl: root.querySelector('.room'),
        itemsEl: root.querySelector('.items'),
        itemEls: new Map(),
        dragging: false,
        // room.js 는 "지금 공간의 가구 목록"만 안다.
        room: {
          get items() { return os.home.scenes[scene.id]; },
          set items(v) { os.home.scenes[scene.id] = v; },
        },
        get mode() { return os.mode; },
        // 화면 좌표 → 공간 좌표 (1280×840)
        toLocal(clientX, clientY) {
          const p = os.toStage(clientX, clientY);
          const o = stageOffset(root, os.stage);
          return { x: (p.x - o.x - fit.tx) / fit.s, y: (p.y - o.y - fit.ty) / fit.s };
        },
        commit() {
          os.saveHome();
          render();
        },
        openItem(item) {
          os.openFurniture(item);
        },
      };

      // 방 안을 걷는 내 아바타(src/avatar.js). 가구를 다시 그릴 때마다 attach로 다시 붙인다.
      const avatar = mountAvatar(ctx);

      // 공간 탭
      const tabs = root.querySelector('.scene-tabs');
      for (const sc of SCENES) {
        const t = document.createElement('button');
        t.type = 'button';
        t.className = 'scene-tab';
        t.setAttribute('role', 'tab');
        t.dataset.scene = sc.id;
        t.textContent = sc.name;
        t.addEventListener('click', () => showScene(sc.id));
        tabs.append(t);
      }

      function showScene(id) {
        scene = SCENES.find(sc => sc.id === id) || SCENES[0];
        for (const t of tabs.children) t.setAttribute('aria-selected', String(t.dataset.scene === scene.id));
        setSceneBg(ctx, scene.kind);
        filterShelf(ctx, scene.id);
        avatar.reset();
        render();
      }

      function render() {
        renderItems(ctx);
        avatar.attach();
        root.querySelector('.owner').textContent = visiting ? `${os.home.owner}의 집에 놀러 왔습니다` : `${os.home.owner}의 집`;
        const empty = !visiting && ctx.room.items.length === 0;
        root.querySelector('.shelf').classList.toggle('hint', empty);
        if (empty) os.toast(`아래 선반에서 가구를 끌어 ${scene.name}에 놓아 보세요.`, 0);
        else os.hideStickyToast();
      }

      // 창 크기가 바뀌면 공간을 다시 맞춘다.
      const ro = new ResizeObserver(() => {
        const bw = body.clientWidth;
        const bh = body.clientHeight;
        const s = Math.min(bw / ROOM_W, bh / ROOT_H);
        fit = { s, tx: (bw - ROOM_W * s) / 2, ty: (bh - ROOT_H * s) / 2 };
        root.style.transform = `translate(${fit.tx}px, ${fit.ty}px) scale(${s})`;
      });
      ro.observe(body);

      root.querySelector('[data-act="share"]').addEventListener('click', () => os.openApp('share'));
      root.querySelector('[data-act="mine"]').addEventListener('click', () => os.goHome());
      root.querySelector('[data-act="say"]').addEventListener('click', () => avatar.openSay());

      win.showScene = showScene;
      mountShelf(ctx);
      showScene(sceneId || SCENES[0].id);
      return () => {
        ro.disconnect();
        avatar.destroy();
        os.hideStickyToast();
      };
    },
  });
}
