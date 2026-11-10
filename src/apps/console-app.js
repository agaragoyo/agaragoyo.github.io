// 가구 기믹: 게임기(F7, F12). 누르면 컴퓨터 화면 안에 게임기를 크게 들고, 게임기 화면에 미니게임 폴더의 게임이 늘어선다.
// 하나를 고르면 게임기 화면 안에서 하고, 나가기 단추(게임 안의 그만하기 단추도 같다)를 누르면 게임기 첫 화면으로 돌아온다.
// 게임기 바깥을 누르면 게임기를 내려놓는다(src/closeup.js). 새 탭으로 여는 플래시 게임은 화면 안에서 어디로 가는지 먼저 보여 준다(known-issues 32).
// 주인은 게임 하나를 추천 게임으로 고를 수 있다(likes.console). 추천 게임은 맨 앞에 서고 "추천" 표시를 단다.
// 방향키와 게임기의 십자 단추로 고르고 Enter로 시작한다. 바탕화면의 미니게임 폴더 아이콘은 그대로 둔다(게임기를 놓지 않은 방에서도 게임을 하게).
import { APPS } from '../../data/apps.js';
import { h, clamp } from '../util.js';
import { iconEl } from '../icons.js';
import { holdMusic } from '../sound.js';
import { openCloseup } from '../closeup.js';
import { linkPrompt } from './link-app.js';
import { setLike, isOwner } from '../likes.js';

// 게임기 화면 크기(무대 px). 우리 게임(apps/)은 이 크기에 맞춰 스스로 게임판을 맞추고(AGA.fitCanvas),
// 다른 사이트의 게임은 원래 창 크기(data/apps.js의 size)로 띄운 뒤 화면에 들어가게 줄인다.
const SCREEN_W = 760;
const SCREEN_H = 470;
const COLS = 4; // 첫 화면 한 줄의 게임 수(방향키 위아래로 한 줄씩 옮긴다)

export function openConsoleApp(os, app) {
  const owner = isOwner(os);
  // 미니게임 폴더와 같은 목록. 주인이 고른 추천 게임이 맨 앞에 선다
  const games = () => {
    const list = APPS.filter(a => a.folder === 'games' && os.canSee(a));
    const i = list.findIndex(a => a.id === os.home.likes.console);
    if (i > 0) list.unshift(...list.splice(i, 1));
    return list;
  };

  return openCloseup(os, {
    key: app.id,
    title: app.title,
    className: 'console-closeup',
    build(panel, cu) {
      const screen = h('div', { className: 'console-screen' });
      const exit = h('button', { type: 'button', className: 'console-exit', disabled: true, onclick: () => home() }, '나가기');
      const pad = (dir, label) => h('button', { type: 'button', className: `console-pad ${dir}`, 'aria-label': label, onclick: () => move(dir) });
      panel.append(h('div', { className: 'console-device' },
        h('div', { className: 'console-left' },
          h('div', { className: 'console-dpad' }, pad('up', '위'), pad('left', '왼쪽'), pad('right', '오른쪽'), pad('down', '아래'))),
        h('div', { className: 'console-bezel' }, screen),
        h('div', { className: 'console-right' },
          h('div', { className: 'console-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
          exit)));

      let tiles = [];      // 첫 화면의 게임 단추. 첫 화면이 아니면 비어 있다
      let selected = 0;    // 첫 화면에서 고른 칸
      let release = null;  // 게임이 트는 배경음악을 놓는 함수

      const stop = () => {
        cu.frames = [];
        release?.();
        release = null;
      };

      const focusTile = i => {
        if (!tiles.length) return;
        selected = clamp(i, 0, tiles.length - 1);
        tiles[selected].focus({ preventScroll: false });
      };

      function move(dir) {
        if (!tiles.length) return;
        const step = { left: -1, right: 1, up: -COLS, down: COLS }[dir];
        focusTile(selected + step);
      }

      // 첫 화면: 게임 목록
      function home() {
        stop();
        exit.disabled = true;
        const pick = os.home.likes.console;
        const list = games();
        tiles = list.map((g, i) => h('button', {
          type: 'button',
          className: g.href ? 'console-game external' : 'console-game',
          dataset: { app: g.id },
          title: g.href ? `새 탭에서 열립니다(${new URL(g.href).host})` : null,
          onclick: () => start(g),
          onfocus: () => { selected = i; },
        }, iconEl(g, 40), h('span', { className: 'console-game-name' }, g.title), g.id === pick ? h('span', { className: 'console-pick' }, '추천') : null));
        // 주인은 칸마다 별을 눌러 추천 게임을 고르거나 뺀다. 별은 게임 단추 밖에 겹쳐 두어 누르면 게임이 시작되지 않는다
        const slots = tiles.map((tile, i) => {
          const g = list[i];
          if (!owner) return tile;
          const on = g.id === pick;
          return h('div', { className: 'console-slot' }, tile, h('button', {
            type: 'button',
            className: on ? 'console-star on' : 'console-star',
            title: on ? '추천 게임에서 빼기' : '추천 게임으로 고르기',
            'aria-label': on ? `${g.title} 추천에서 빼기` : `${g.title} 추천으로 고르기`,
            onclick: () => { setLike(os, 'console', on ? null : g.id); selected = 0; home(); },
          }, on ? '★' : '☆'));
        });
        screen.replaceChildren(
          h('div', { className: 'console-head' },
            h('span', {}, '게임 고르기'),
            owner ? h('span', { className: 'console-hint' }, '별을 누르면 손님에게 보여 줄 추천 게임이 됩니다.') : null),
          h('div', { className: 'console-grid' }, ...slots));
        focusTile(selected);
      }

      // 게임 하나를 게임기 화면 안에서 한다
      function start(g) {
        if (g.href) return ask(g);
        stop();
        tiles = [];
        exit.disabled = false;
        const own = g.src.startsWith('apps/');
        const [w, hgt] = own ? [SCREEN_W, SCREEN_H] : (g.size || [SCREEN_W, SCREEN_H]);
        const s = Math.min(1, SCREEN_W / w, SCREEN_H / hgt);
        const frame = h('iframe', { title: g.title, allow: 'autoplay; fullscreen; gamepad; clipboard-write' });
        Object.assign(frame.style, { width: `${w}px`, height: `${hgt}px`, transform: s < 1 ? `scale(${s})` : '' });
        const box = h('div', { className: 'console-play' }, frame);
        Object.assign(box.style, { width: `${Math.floor(w * s)}px`, height: `${Math.floor(hgt * s)}px` });
        frame.addEventListener('load', () => frame.focus(), { once: true }); // 키보드로 하는 게임이 바로 키를 받게
        frame.src = g.src;
        screen.replaceChildren(box);
        // 앱 SDK의 닫기(AGA.close)는 게임기 첫 화면으로 돌아가기다. 제목 바꾸기는 게임기에 제목 줄이 없어 받지 않는다
        cu.frames = [{ iframe: frame, close: home, setTitle: () => {} }];
        release = g.music ? holdMusic(`console:${g.id}`, g.music) : null;
      }

      // 새 탭으로 여는 게임: 게임기 화면 안에서 어디로 가는지 먼저 보여 준다(link-app.js와 같은 안내와 단추)
      function ask(g) {
        stop();
        tiles = [];
        exit.disabled = false;
        const links = g.links || [{ label: '새 탭에서 열기', href: g.href }];
        const card = h('div', { className: 'console-ask' },
          h('div', { className: 'console-ask-title' }, iconEl(g, 32), h('span', {}, g.title)),
          ...linkPrompt({ text: `이 ${g.noun || '게임'}은 원작 사이트의 새 탭에서 열립니다.`, links, onOpen: home, onCancel: home }));
        screen.replaceChildren(card);
        card.querySelector('a.btn')?.focus();
      }

      cu.onKey = e => {
        const dir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
        if (!dir || !tiles.length) return;
        e.preventDefault();
        move(dir);
      };

      home();
      return stop; // 내려놓으면 게임과 음악도 멈춘다(iframe은 화면과 같이 빠진다)
    },
  });
}
