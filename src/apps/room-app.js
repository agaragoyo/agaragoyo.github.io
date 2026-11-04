// 기본 앱: 방 꾸미기. 집 안의 공간(내 방, 놀이터 ...)을 탭으로 오가며 꾸민다.
// 1280×840 크기의 공간과 선반을 창 크기에 맞춰 줄여 보여 준다.
import { ROOM_W, STAGE_H, SCENES } from '../config.js';
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

// 처음 열 때는 바탕화면에 보이는 공간(os.place)의 탭부터 보여 준다. 놀이터에 나가 있으면 놀이터부터 꾸민다.
// 방 꾸미기 창은 하나뿐이라, 이미 열려 있으면 고르던 탭 그대로 그 창을 앞으로 가져온다.
export function openRoomApp(os, appInfo) {
  const opened = os.wm.get('room');
  if (opened) {
    opened.focus();
    return opened;
  }
  const visiting = os.mode === 'visit';
  return os.wm.open({
    key: 'room',
    app: appInfo,
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
            <p class="shelf-visit">친구 집의 가구는 옮길 수 없습니다. 바탕화면에서 가구를 두 번 누르면 써 볼 수 있습니다.</p>
          </div>
          <p class="rotate-tip">가구를 끄는 동안 R 키나 마우스 휠로 돌릴 수 있어요</p>
          <p class="room-hint" hidden></p>
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
        // 꾸미는 화면에서는 가구를 눌러도 기믹을 쓰지 않고, 바탕화면에서 쓰라고 알려 준다.
        pressItem() {
          os.toast('가구는 바탕화면에서 두 번 눌러 써 볼 수 있어요');
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
        setSceneBg(ctx, scene);
        filterShelf(ctx, scene.id);
        render();
      }

      function render() {
        renderItems(ctx);
        root.querySelector('.owner').textContent = visiting ? `${os.home.owner}의 집에 놀러 왔습니다` : `${os.home.owner}의 집`;
        const empty = !visiting && ctx.room.items.length === 0;
        root.querySelector('.shelf').classList.toggle('hint', empty);
        // 안내는 창 안에 둔다. 창을 최소화하거나 다른 창으로 가리면 같이 보이지 않아야 한다.
        const hint = root.querySelector('.room-hint');
        hint.hidden = !empty;
        hint.textContent = `아래 선반에서 가구를 끌어 ${scene.name}에 놓아 보세요.`;
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
      showScene(os.place);
      return () => {
        ro.disconnect();
      };
    },
  });
}
