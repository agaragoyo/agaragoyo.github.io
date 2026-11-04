// 튜토리얼(docs/requirements.md의 F17). 처음 온 사람이 기본 가구 세 개를 직접 놓고 써 보면서 가구 놓기, 가구 쓰기, 놀이터를 배운다.
// 화면 구석의 작은 안내 카드가 한 번에 한 가지 행동만 부탁하고 화살표가 그 자리를 가리킨다. 글을 읽고 넘기는 "다음" 단추는 없다.
//
// 지금이 몇 단계인지는 저장하지 않고, 매 화면 지금 상태(방의 가구, 열린 창, 공간, 밤낮)를 읽어 아직 하지 않은 첫 단계를 고른다.
// 그래서 순서를 바꿔 해도, 놓은 가구를 치워도, 새로 고침을 해도 맞는 단계로 돌아온다. 가구, 창, 탭이 바뀌는 길이 여럿이라
// 길마다 알림을 심는 대신 이렇게 읽는다. 읽기만 하고 달라진 것이 없으면 그리지 않으므로 볼록 화면의 필터를 다시 계산하지 않는다.
// 스탠드를 썼는지처럼 상태로 남지 않는 일만 passed에 적어 저장한다.
//
// 가구는 data/furniture.js의 TUTORIAL_FURNITURE 한곳에서 바꾼다. 안내 카드는 무대에 붙고 클릭을 흘려보낸다(건너뛰기 단추만 받는다).
import { STORAGE_TUTORIAL } from './config.js';
import { BY_ID, TUTORIAL_FURNITURE } from '../data/furniture.js';
import { batchim, h, loadJSON, saveJSON } from './util.js';

const HOME = 'room';
const OUTSIDE = 'playground';
const LESSONS = ['가구 놓기', '가구 쓰기', '놀이터 가기'];
const ARROW_H = 56; // 화살표가 차지하는 높이(그림 48px, 튀는 폭 8px). 대상 위쪽에 이만큼 자리가 없으면 아래에 둔다
const CARD = { left: 860, top: 470, bottom: 628 }; // 안내 카드의 기본 자리(style.css의 .coach-card). 대상이 여기에 걸리면 카드가 왼쪽으로 비킨다

const eul = word => `${word}${batchim(word) ? '을' : '를'}`;
const newState = active => ({ active, passed: {} });

export function createTutorial(os) {
  const { first, light, door } = TUTORIAL_FURNITURE;
  const lightName = eul(BY_ID[light].name);
  const doorName = eul(BY_ID[door].name);
  let state = { ...newState(false), ...loadJSON(STORAGE_TUTORIAL) };
  const save = () => saveJSON(STORAGE_TUTORIAL, state);

  // ---------- 지금 상태 읽기 ----------
  const has = id => os.home.scenes[HOME].some(it => it.id === id);
  const roomWin = () => {
    const w = os.wm.get('room');
    return w && !w.minimized ? w : null;
  };
  const inWallpaper = selector => os.stage.querySelector(`#wallpaper ${selector}`);
  const notHome = () => (os.place === HOME ? null : GATE);
  const shelfCard = id => roomWin()?.el.querySelector(`.card .furn[data-id="${id}"]`)?.closest('.card');
  // 사용자가 선반을 넘겨서 가구 카드가 밖으로 나갔으면, 그 카드 쪽으로 넘기는 단추를 대신 가리킨다.
  function cardOrArrow(card) {
    const track = card?.parentElement;
    if (!track) return null;
    const t = track.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const middle = c.left + c.width / 2;
    if (middle < t.left) return track.previousElementSibling;
    if (middle > t.right) return track.nextElementSibling;
    return card;
  }

  // ---------- 단계 ----------
  // text: 안내 문구. 카드 폭이 고정이라 \n으로 의미 단위마다 직접 줄을 나눈다.
  // done: 끝났는지. target: 화살표로 가리킬 요소. lesson: LESSONS의 몇 번째인지.
  // once: 한 번 끝나면 되돌아가지 않는다(passed에 적는다). detour: 먼저 해야 할 다른 단계(없으면 null).
  // card: 선반에서 끌어 놓을 가구 카드. side: 화살표를 대상 오른쪽에 둔다(없으면 위, 위에 자리가 없으면 아래). use: 바탕화면에서 쓰는 단계.
  const place = (id, lead) => ({
    id: `place-${id}`,
    lesson: 0,
    card: () => shelfCard(id),
    text: () => `${lead} ${eul(BY_ID[id].name)} 끌어다\n${BY_ID[id].zone === 'wall' ? '벽에 거세요' : '바닥에 놓으세요'}.`,
    done: () => has(id),
    target: () => cardOrArrow(shelfCard(id)),
    detour: () => (roomWin()?.el.querySelector('.scene-tab[aria-selected="true"]')?.dataset.scene === HOME ? null : TAB),
  });
  // 놀이터 탭을 보고 있으면 선반에 내 방 가구가 없다.
  const TAB = {
    id: 'tab',
    text: () => '위쪽 내 방 탭을 누르면\n선반에 내 방 가구가 나옵니다.',
    target: () => roomWin()?.el.querySelector(`.scene-tab[data-scene="${HOME}"]`),
  };
  const GATE = {
    id: 'gate',
    lesson: 2,
    use: true,
    text: () => '내 방으로 돌아가려면 울타리의\n아파트 문을 두 번 누르세요.',
    done: () => os.place === HOME,
    target: () => inWallpaper('.gate-hit'),
  };
  const STEPS = [
    {
      id: 'open',
      lesson: 0,
      text: () => '방 꾸미기 아이콘을 두 번 누르면\n가구를 놓는 창이 열립니다.',
      done: () => roomWin() || [first, light, door].every(has),
      target: () => os.stage.querySelector('#icons [data-app="room"]'),
      side: true, // 첫 아이콘은 위에 자리가 없고 아래에는 다음 아이콘이 있어서 화살표를 옆에 둔다
    },
    place(first, '아래 선반의'),
    place(light, '이번에는'),
    place(door, '마지막으로'),
    {
      id: 'close',
      lesson: 0,
      text: () => '놓은 가구는 바로 저장됩니다.\n× 단추를 눌러 창을 닫으세요.',
      done: () => !roomWin(),
      target: () => roomWin()?.el.querySelector('.win-close'),
    },
    {
      id: 'night',
      lesson: 1,
      use: true,
      text: () => `${lightName} 두 번 누르면 아바타가\n걸어가서 방을 ${os.settings.get('night') ? '낮' : '밤'}으로 바꿉니다.`,
      done: () => false, // 쓰면 used()가 passed에 적는다
      target: () => inWallpaper(`.furn[data-id="${light}"]`),
      detour: notHome,
    },
    {
      id: 'day',
      lesson: 1,
      use: true,
      text: () => `${lightName} 다시 두 번 누르면\n낮으로 돌아옵니다.`,
      done: () => !os.settings.get('night'),
      target: () => inWallpaper(`.furn[data-id="${light}"]`),
      detour: notHome,
    },
    {
      id: 'out',
      lesson: 2,
      use: true,
      once: true,
      text: () => `${doorName} 두 번 누르면 아바타가\n놀이터로 나갑니다.`,
      done: () => os.place === OUTSIDE,
      target: () => inWallpaper(`.furn[data-id="${door}"]`),
    },
    GATE,
  ];
  const END = {
    id: 'end',
    title: '튜토리얼 끝',
    text: () => '튜토리얼을 마쳤습니다.\n바닥을 누르면 아바타가 걷고,\nEnter를 누르면 말합니다.\n이 안내는 시작 메뉴에서\n다시 볼 수 있습니다.',
    target: () => null,
  };

  function current() {
    for (const step of STEPS) {
      if (state.passed[step.id]) continue;
      if (!step.done()) return step;
      if (step.once) pass(step.id);
    }
    return null;
  }

  function pass(id) {
    state.passed[id] = true;
    save();
  }

  // ---------- 그리기 ----------
  const title = h('span', { className: 'coach-title' });
  const blocks = h('span', { className: 'coach-blocks', 'aria-hidden': 'true' }, STEPS.map(() => h('i')));
  const action = h('button', { type: 'button', className: 'btn coach-btn', onclick: () => (shown === END ? hide() : skip()) });
  const text = h('p', { className: 'coach-text' });
  const hint = h('p', { className: 'coach-hint', hidden: true }, '빨갛게 보이는 자리에는 놓을 수 없습니다.');
  const card = h('div', { className: 'coach-card', role: 'status', hidden: true },
    h('div', { className: 'coach-head' }, title, blocks, action), text, hint);
  const ring = h('div', { className: 'coach-ring', hidden: true });
  const arrow = h('div', { className: 'coach-arrow', hidden: true });
  arrow.innerHTML = '<svg viewBox="0 0 40 48" width="40" height="48"><path d="M12 2h16v21h10L20 46 2 23h10z" fill="#ffd23c" stroke="#2b2b33" stroke-width="3" stroke-linejoin="round"/></svg>';
  os.stage.append(card, ring, arrow);

  let raf = 0;
  let shown = null;  // 카드에 보이는 단계
  let aimed = null;  // 화살표가 가리키는 자리. 그대로면 다시 그리지 않는다

  function render(view, index) {
    shown = view;
    aimed = null;
    title.textContent = view.title || LESSONS[STEPS[index].lesson];
    text.textContent = view.text();
    [...blocks.children].forEach((b, i) => b.classList.toggle('on', i < index));
    action.textContent = view === END ? '닫기' : '건너뛰기';
    action.title = view === END ? '' : '튜토리얼을 끝냅니다. 시작 메뉴에서 다시 볼 수 있습니다';
    hint.hidden = true;
    card.hidden = false;
    // 가구를 쓰고 나면 아바타가 그 옆에 서 있어서, 다시 쓰라고 할 때 가구 대신 아바타(말하기)가 눌리지 않게 한다.
    os.stage.classList.toggle('coach-use', !!view.use);
    card.animate([{ background: '#fff' }, { background: '#ffffe1' }], 300);
    if (view.card) centerCard(view.card());
  }

  // 놓을 가구의 카드가 선반 가운데에 오게 넘긴다(스탠드와 창문은 처음에 선반 밖에 있다).
  function centerCard(el) {
    const track = el?.parentElement;
    track?.scrollTo({ left: el.offsetLeft - track.offsetLeft - (track.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
  }

  // 대상의 자리를 무대 좌표로. 크기가 바뀐 창이나 선반 안의 요소도 화면 좌표를 거쳐 맞춘다.
  function boxOf(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width) return null; // 숨겨져 있다
    const a = os.toStage(r.left, r.top);
    const b = os.toStage(r.right, r.bottom);
    const x = Math.round(Math.min(a.x, b.x));
    const y = Math.round(Math.min(a.y, b.y));
    return { x, y, w: Math.round(Math.abs(b.x - a.x)), h: Math.round(Math.abs(b.y - a.y)) };
  }

  function aim(view) {
    const el = view.target();
    const box = boxOf(el);
    const key = box && [box.x, box.y, box.w, box.h].join();
    if (key === aimed) return;
    aimed = key;
    ring.hidden = arrow.hidden = !box;
    if (!box) return;
    Object.assign(ring.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
    const dir = el.matches('.card') ? 'rise' : view.side ? 'left' : box.y < ARROW_H + 8 ? 'up' : 'down';
    arrow.dataset.dir = dir;
    arrow.style.left = `${dir === 'left' ? box.x + box.w + 12 : box.x + box.w / 2 - 20}px`;
    arrow.style.top = `${{ left: box.y + box.h / 2 - 24, up: box.y + box.h + 8 }[dir] ?? box.y - ARROW_H}px`;
    card.classList.toggle('left', box.x + box.w > CARD.left && box.y + box.h > CARD.top && box.y - ARROW_H < CARD.bottom);
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    const step = current();
    if (!step) {
      finish();
      return;
    }
    const view = step.detour?.() || step;
    if (view !== shown) render(view, STEPS.indexOf(step));
    aim(view);
    const bad = !!view.card && !!os.stage.querySelector('.ghost[data-state="bad"]');
    if (hint.hidden === bad) hint.hidden = !bad;
  }

  function stop() {
    cancelAnimationFrame(raf);
    ring.hidden = arrow.hidden = true;
    os.stage.classList.remove('coach-use');
    shown = null;
  }

  function hide() {
    stop();
    card.hidden = true;
  }

  function finish() {
    stop();
    state = newState(false);
    save();
    render(END, STEPS.length);
  }

  function skip() {
    hide();
    state = newState(false);
    save();
    os.toast('튜토리얼은 시작 메뉴에서 다시 볼 수 있습니다', 4000);
  }

  return {
    get active() { return state.active; },
    // 새 사용자를 만들 때 부른다. 기존 사용자는 여기를 지나지 않으므로 튜토리얼이 저절로 나오지 않는다.
    arm() {
      state = newState(true);
      save();
    },
    // 내 컴퓨터의 바탕화면에 들어올 때 부른다. 하던 중이면 이어서 보여 준다(손님은 부르지 않는다).
    resume() {
      if (!state.active) return;
      stop();
      tick();
    },
    // 바탕화면을 떠날 때 부른다. 진행 상태는 그대로 둔다.
    hide,
    // 시작 메뉴의 다시 보기. 방을 건드리지 않으려고 이미 있는 가구를 지우지 않으므로, 놓는 단계는 없는 가구만 남는다.
    restart() {
      state = newState(true);
      save();
      stop();
      tick();
      if ([first, light, door].some(has)) os.toast('방에 있는 가구는 놓는 단계를 건너뜁니다', 4000);
    },
    // 바탕화면에서 가구를 쓴 뒤 부른다.
    used(id) {
      if (state.active && os.mode === 'edit' && id === light) pass('night');
    },
  };
}
