// 기본 앱: 방 꾸미기. 집 안의 공간(내 방, 놀이터 ...)을 탭으로 오가며 꾸민다.
// 1280×840 크기의 공간과 선반을 창 크기에 맞춰 줄여 보여 준다.
import { ROOM_W, STAGE_H, SCENES } from '../config.js';
import { BY_ID } from '../../data/furniture.js';
import { renderItems, setSceneBg } from '../room.js';
import { mountShelf, filterShelf } from '../shelf.js';

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

export function openRoomApp(os, appInfo) {
  const visiting = os.mode === 'visit';
  return os.wm.open({
    key: 'room',
    app: appInfo,
    title: visiting ? `${os.home.owner}의 집` : '방 꾸미기',
    width: 1100,
    height: 700,
    maximized: true,
    flush: true,
    build(body) {
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
          <div class="hud">
            <span class="owner"></span>
            <span class="scene-tabs" role="tablist"></span>
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
          const g = BY_ID[item.id].gimmick;
          if (g?.startsWith('scene:')) return showScene(g.slice(6));
          os.openFurniture(item);
        },
      };

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
        render();
      }

      function render() {
        renderItems(ctx);
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

      mountShelf(ctx);
      showScene(SCENES[0].id);
      return () => {
        ro.disconnect();
        os.hideStickyToast();
      };
    },
  });
}
