// 가구 기믹: 게임기(F7, F12). 누르면 바닥의 게임기를 들어 올리듯 컴퓨터 화면 안에 크게 들고(src/closeup.js), 게임기 화면에 게임 폴더의 게임이 폴더와 같은 묶음으로 나뉘어 늘어선다.
// 게임을 고르면 게임기 화면 쪽으로 한 번 더 당겨 바탕화면을 거의 채운 큰 화면에서 한다(PLAY_W, PLAY_H).
// 단추는 셋이고 하는 일을 옆에 새겨 둔다. 십자 단추는 고르기(방향키), A는 시작(Enter), B는 나가기(Backspace)다.
// B는 게임이나 새 탭 안내에서는 게임기 첫 화면으로 돌아오고(게임 안의 그만하기 단추도 같다), 첫 화면에서는 게임기를 내려놓는다.
// 게임기 바깥을 눌러도 게임기를 내려놓는다(src/closeup.js). 새 탭으로 여는 플래시 게임은 화면 안에서 어디로 가는지 먼저 보여 준다(known-issues 32).
// 주인은 게임 하나를 추천 게임으로 고를 수 있다(likes.console). 추천 게임은 자기 묶음의 맨 앞에 서고 "추천" 표시를 달며, 게임기를 열면 먼저 그 칸에 초점이 간다.
// 바탕화면의 게임 폴더 아이콘은 그대로 둔다(게임기를 놓지 않은 방에서도 게임을 하게).
import { APPS, groupGames, hostTip } from '../../data/apps.js';
import { h, clamp, reduceMotion } from '../util.js';
import { iconEl } from '../icons.js';
import { holdMusic } from '../sound.js';
import { openCloseup } from '../closeup.js';
import { linkPrompt } from './link-app.js';
import { setLike, isOwner } from '../likes.js';

// 게임하는 화면 크기(무대 px). 게임은 들고 있는 게임기의 가운데 화면(940×600, 게임 고르기)에서 하지 않고,
// 화면 쪽으로 한 번 더 당겨 바탕화면을 거의 채운 큰 화면에서 한다. 팀 게임(레포 밖)이 1040×660~1120×700이라 이 크기에서 원래 크기로 보인다.
// 우리 게임(apps/)은 이 크기에 맞춰 스스로 게임판을 맞추고(AGA.fitCanvas), 다른 사이트의 게임은 원래 창 크기(data/apps.js의 size)로 띄운 뒤
// 화면에 들어가게 줄인다. 두 화면의 크기는 style.css의 "게임기" 절(.console-screen, .console-screen.play)과 같다.
const PLAY_W = 1120;
const PLAY_H = 700;
// 당기기와 되돌리기(0.3초). 큰 화면은 게임기 화면 자리에서 커지고, 들고 있던 게임기는 같은 길로 커지며 사라진다(머티리얼 3 emphasized)
const PULL = { duration: 300, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'forwards' };

export function openConsoleApp(os, app) {
  const owner = isOwner(os);
  // 게임 폴더와 같은 묶음과 순서. 주인이 고른 추천 게임은 자기 묶음의 맨 앞에 선다
  const games = () => groupGames(APPS.filter(a => a.folder === 'games' && os.canSee(a))).map(g => {
    const i = g.apps.findIndex(a => a.id === os.home.likes.console);
    if (i > 0) g.apps.unshift(...g.apps.splice(i, 1));
    return g;
  });

  return openCloseup(os, {
    key: app.id,
    title: app.title,
    className: 'console-closeup',
    closeLabel: '내려놓기',
    closeTip: '바깥을 누르면 게임기를 내려놓습니다.',
    lift: true, // 바닥에 누운 게임기를 들어 올리듯 일어서며 다가온다(src/closeup.js)
    build(panel, cu) {
      const screen = h('div', { className: 'console-screen' });
      // 게임기의 단추를 눌러도 키보드 초점은 화면의 게임 칸에 남긴다(단추로 옮겨 가면 어느 칸을 골랐는지 잃는다)
      const keep = e => e.preventDefault();
      const pad = (dir, label) => h('button', { type: 'button', className: `console-pad ${dir}`, 'aria-label': label, onmousedown: keep, onclick: () => move(dir) });
      // A와 B: 게임보이처럼 B는 왼쪽 아래, A는 오른쪽 위에 두고 단추 아래에 하는 일을 새긴다. 장식 단추는 무슨 일을 하는지 헷갈리게만 해서 두지 않는다
      const face = (key, word, keyName, onclick) => h('div', { className: `console-key ${key.toLowerCase()}` },
        h('button', { type: 'button', className: 'console-face', title: `${word} (${keyName})`, 'aria-label': `${key} ${word}`, onmousedown: keep, onclick }, key),
        h('span', { className: 'console-key-word' }, word));
      const device = h('div', { className: 'console-device' },
        h('div', { className: 'console-left' },
          h('div', { className: 'console-dpad' }, pad('up', '위'), pad('left', '왼쪽'), pad('right', '오른쪽'), pad('down', '아래')),
          h('span', { className: 'console-key-word' }, '고르기')),
        h('div', { className: 'console-bezel' }, screen),
        h('div', { className: 'console-right' },
          h('div', { className: 'console-keys' },
            face('B', '나가기', 'Backspace', () => pressB()),
            face('A', '시작', 'Enter', () => pressA()))));
      panel.append(device);
      // 게임하는 큰 화면. 아래 줄에 하는 게임의 이름과 B(나가기)를 둔다. 판 밖(가까이 보기 화면)에 두어 바탕화면 가운데에 놓는다
      const playScreen = h('div', { className: 'console-screen play' });
      const barTitle = h('span', { className: 'console-bar-title' });
      const big = h('div', { className: 'console-big', hidden: true },
        h('div', { className: 'console-bezel' }, playScreen),
        h('div', { className: 'console-bar' }, barTitle, face('B', '나가기', 'Backspace', () => pressB())));
      cu.el.append(big);

      let tiles = [];      // 첫 화면의 게임 단추. 첫 화면이 아니면 비어 있다
      let selected = null; // 첫 화면에서 고른 칸. null이면 첫 화면을 그릴 때 추천 게임(없으면 첫 칸)으로 정한다
      let release = null;  // 게임이 트는 배경음악을 놓는 함수
      let playing = false; // 큰 화면에서 게임하는 중인지
      let settle = null;   // 도는 당기기를 끝 자리로 마무리하는 함수

      const stop = () => {
        cu.frames = [];
        release?.();
        release = null;
        playScreen.replaceChildren(); // 게임(iframe)을 빼서 소리까지 바로 멈춘다
      };

      // 큰 화면으로 당기기(on)와 들고 있던 게임기로 되돌리기. 두 화면의 자리를 재서, 큰 화면은 게임기 화면 자리에서 커지고
      // 게임기는 제 화면이 큰 화면 자리에 닿도록 커지며 사라진다(되돌릴 때는 거꾸로). 변형의 기준점은 각자의 화면 가운데다
      function setPlay(on, instant = false) {
        if (on === playing) return;
        settle?.();
        playing = on;
        let anims = [];
        const end = () => {
          if (settle !== end) return;
          settle = null;
          for (const a of anims) a.cancel();
          cu.el.classList.toggle('console-playing', on);
          big.hidden = !on;
        };
        settle = end;
        const desk = cu.el.parentElement;
        if (instant || reduceMotion || !desk) return end();
        big.hidden = false;
        cu.el.classList.remove('console-playing');
        for (const a of panel.getAnimations()) a.finish(); // 가까이 보기가 열리는 중이면 다 열린 자리에서 잰다
        const s = desk.getBoundingClientRect().width / desk.offsetWidth; // 무대 배율
        const a = screen.getBoundingClientRect();
        const b = playScreen.getBoundingClientRect();
        const center = r => [r.left + r.width / 2, r.top + r.height / 2];
        const origin = (box, r) => {
          const o = box.getBoundingClientRect();
          const [x, y] = center(r);
          return `${(x - o.left) / s}px ${(y - o.top) / s}px`;
        };
        const onto = (p, q) => { // p 화면을 q 화면 자리로
          const [px, py] = center(p), [qx, qy] = center(q);
          return `translate(${(qx - px) / s}px, ${(qy - py) / s}px) scale(${q.width / p.width})`;
        };
        device.style.transformOrigin = origin(device, a);
        big.style.transformOrigin = origin(big, b);
        const toBig = onto(a, b), toSmall = onto(b, a);
        anims = on
          ? [device.animate([{ transform: 'none', opacity: 1 }, { transform: toBig, opacity: 0 }], PULL),
            big.animate([{ transform: toSmall, opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: 'none', opacity: 1 }], PULL)]
          : [device.animate([{ transform: toBig, opacity: 0 }, { transform: 'none', opacity: 1 }], PULL),
            big.animate([{ transform: 'none', opacity: 1 }, { opacity: 1, offset: 0.7 }, { transform: toSmall, opacity: 0 }], PULL)];
        anims[1].finished.then(end, () => {});
      }

      const focusTile = i => {
        if (!tiles.length) return;
        selected = clamp(i, 0, tiles.length - 1);
        tiles[selected].focus({ preventScroll: false });
      };

      // 왼쪽과 오른쪽은 한 칸씩(묶음이 바뀌어도 이어진다). 위와 아래는 묶음마다 줄 끝이 다르므로 화면 위치로 옮긴다:
      // 바로 위(아래) 줄 가운데 가로로 가장 가까운 칸. 위(아래)에 줄이 없으면 그대로 둔다
      function move(dir) {
        if (!tiles.length) return;
        if (dir === 'left' || dir === 'right') return focusTile(selected + (dir === 'left' ? -1 : 1));
        const cur = tiles[selected].getBoundingClientRect();
        const sign = dir === 'up' ? -1 : 1;
        const beyond = tiles.map((t, i) => ({ i, r: t.getBoundingClientRect() })).filter(c => (c.r.top - cur.top) * sign > 1);
        if (!beyond.length) return;
        const row = beyond.reduce((best, c) => (Math.abs(c.r.top - cur.top) < Math.abs(best - cur.top) ? c.r.top : best), beyond[0].r.top);
        const near = beyond.filter(c => Math.abs(c.r.top - row) <= 1);
        focusTile(near.reduce((a, c) => (Math.abs(c.r.left - cur.left) < Math.abs(a.r.left - cur.left) ? c : a)).i);
      }

      // 첫 화면: 게임 목록
      function home() {
        stop();
        setPlay(false); // 큰 화면에서 돌아오면 들고 있던 게임기로 되돌린다
        const pick = os.home.likes.console;
        const groups = games();
        const list = groups.flatMap(g => g.apps);
        tiles = list.map((g, i) => h('button', {
          type: 'button',
          className: g.href ? 'console-game external' : 'console-game',
          dataset: { app: g.id },
          title: hostTip(g),
          onclick: () => start(g),
          onfocus: () => { selected = i; },
        }, iconEl(g, 48), h('span', { className: 'console-game-name' }, g.title), g.id === pick ? h('span', { className: 'console-pick' }, '추천') : null));
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
            onclick: () => { setLike(os, 'console', on ? null : g.id); selected = null; home(); },
          }, on ? '★' : '☆'));
        });
        let at = 0; // 묶음마다 slots에서 자기 몫을 잘라 낸다
        const sections = groups.map(g => {
          const mine = slots.slice(at, at += g.apps.length);
          return h('section', { className: 'console-group' }, h('h3', { className: 'console-group-title' }, g.title), h('div', { className: 'console-tiles' }, ...mine));
        });
        if (selected === null) selected = Math.max(0, list.findIndex(g => g.id === pick));
        screen.replaceChildren(
          h('div', { className: 'console-head' },
            h('span', {}, '게임 고르기'),
            owner ? h('span', { className: 'console-hint' }, '별을 누르면 손님에게 보여 줄 추천 게임이 됩니다.') : null),
          h('div', { className: 'console-grid' }, ...sections));
        focusTile(selected);
      }

      // 게임 하나를 큰 화면에서 한다(게임기 화면 쪽으로 한 번 더 당긴다)
      function start(g) {
        if (g.href) return ask(g);
        stop();
        tiles = [];
        const own = g.src.startsWith('apps/');
        const [w, hgt] = own ? [PLAY_W, PLAY_H] : (g.size || [PLAY_W, PLAY_H]);
        const s = Math.min(1, PLAY_W / w, PLAY_H / hgt);
        const frame = h('iframe', { title: g.title, allow: 'autoplay; fullscreen; gamepad; clipboard-write' });
        Object.assign(frame.style, { width: `${w}px`, height: `${hgt}px`, transform: s < 1 ? `scale(${s})` : '' });
        const box = h('div', { className: 'console-play' }, frame);
        Object.assign(box.style, { width: `${Math.floor(w * s)}px`, height: `${Math.floor(hgt * s)}px` });
        frame.addEventListener('load', () => frame.focus(), { once: true }); // 키보드로 하는 게임이 바로 키를 받게
        frame.src = g.src;
        playScreen.replaceChildren(box);
        barTitle.replaceChildren(iconEl(g, 24), h('span', {}, g.title));
        setPlay(true);
        // 앱 SDK의 닫기(AGA.close)는 게임기 첫 화면으로 돌아가기다. 제목 바꾸기는 게임기에 제목 줄이 없어 받지 않는다
        cu.frames = [{ iframe: frame, close: home, setTitle: () => {} }];
        release = g.music ? holdMusic(`console:${g.id}`, g.music) : null;
      }

      // 새 탭으로 여는 게임: 게임기 화면 안에서 어디로 가는지 먼저 보여 준다(link-app.js와 같은 안내와 단추)
      function ask(g) {
        stop();
        tiles = [];
        const links = g.links || [{ label: '새 탭에서 열기', href: g.href }];
        const card = h('div', { className: 'console-ask' },
          h('div', { className: 'console-ask-title' }, iconEl(g, 32), h('span', {}, g.title)),
          ...linkPrompt({ text: `이 ${g.noun || '게임'}은 원작 사이트의 새 탭에서 열립니다.`, links, onOpen: home, onCancel: home }));
        screen.replaceChildren(card);
        card.querySelector('a.btn')?.focus();
      }

      // A: 첫 화면에서는 고른 칸의 게임을 시작하고, 새 탭 안내에서는 초점이 있는 단추(처음에는 "새 탭에서 열기")를 누른다
      function pressA() {
        if (tiles.length) return tiles[selected].click();
        const f = document.activeElement;
        if (f && screen.contains(f) && (f.tagName === 'A' || f.tagName === 'BUTTON')) f.click();
      }
      // B(나가기): 게임이나 새 탭 안내에서는 첫 화면으로 돌아가고, 첫 화면에서는 게임기를 내려놓는다(게임기의 "뒤로" 단추처럼)
      function pressB() {
        if (tiles.length) cu.close();
        else home();
      }

      cu.onKey = e => {
        if (e.key === 'Backspace') {
          e.preventDefault();
          return pressB();
        }
        const dir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
        if (!dir || !tiles.length) return;
        e.preventDefault();
        move(dir);
      };

      home();
      // 내려놓으면 게임과 음악도 멈추고, 큰 화면이었으면 움직임 없이 게임기로 되돌려 그 게임기가 바닥으로 돌아가게 한다(src/closeup.js)
      return () => {
        stop();
        setPlay(false, true);
      };
    },
  });
}
