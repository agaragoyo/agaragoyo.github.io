// 기본 앱: 방 꾸미기. 1280×840 크기의 방과 선반을 창 크기에 맞춰 줄여 보여 준다.
import { ROOM_W, STAGE_H } from '../config.js';
import { renderItems, mountRoom } from '../room.js';
import { mountShelf } from '../shelf.js';

const ROOT_H = STAGE_H; // 방 720 + 선반 120

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
    title: visiting ? `${os.room.owner}의 방` : '방 꾸미기',
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
            <p class="shelf-visit">친구 방의 가구는 옮길 수 없습니다. 가구를 눌러 구경해 보세요.</p>
          </div>
          <div class="hud">
            <span class="owner"></span>
            <button type="button" class="btn edit-only" data-act="share">공유 링크</button>
            <button type="button" class="btn visit-only" data-act="mine">나도 만들기</button>
          </div>
        </div>`;
      const root = body.querySelector('.room-root');
      root.dataset.mode = os.mode;
      let fit = { s: 1, tx: 0, ty: 0 };

      const ctx = {
        root,
        roomEl: root.querySelector('.room'),
        itemsEl: root.querySelector('.items'),
        itemEls: new Map(),
        dragging: false,
        get room() { return os.room; },
        get mode() { return os.mode; },
        // 화면 좌표 → 방 좌표 (1280×840)
        toLocal(clientX, clientY) {
          const p = os.toStage(clientX, clientY);
          const o = stageOffset(root, os.stage);
          return { x: (p.x - o.x - fit.tx) / fit.s, y: (p.y - o.y - fit.ty) / fit.s };
        },
        commit() {
          os.saveRoom();
          render();
        },
        openItem: item => os.openFurniture(item),
      };

      function render() {
        renderItems(ctx);
        root.querySelector('.owner').textContent = visiting ? `${os.room.owner}의 방에 놀러 왔습니다` : `${os.room.owner}의 방`;
        const empty = !visiting && os.room.items.length === 0;
        root.querySelector('.shelf').classList.toggle('hint', empty);
        if (empty) os.toast('아래 선반에서 가구를 끌어 방에 놓아 보세요.', 0);
        else os.hideStickyToast();
      }

      // 창 크기가 바뀌면 방을 다시 맞춘다.
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

      mountRoom(ctx);
      mountShelf(ctx);
      render();
      return () => {
        ro.disconnect();
        os.hideStickyToast();
      };
    },
  });
}
