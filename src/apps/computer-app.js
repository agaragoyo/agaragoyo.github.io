// 가구 기믹: 옛날 컴퓨터(F12). 주인이 넣어 둔 좋아하는 웹 게임을 새 탭으로 연다.
// 게임 폴더의 플래시 게임(link-app.js)과 같은 창으로, 그 게임이 어느 사이트의 새 탭에서 열리는지 먼저 보여 준다(known-issues 32).
// 주인(내 컴퓨터)에게는 게임을 넣고 고치는 칸이 있고 손님에게는 없다. 아무것도 넣지 않은 컴퓨터를 손님이 쓰면 아바타가 한마디 한다.
// 넣은 게임은 집 상태의 likes.computer에 저장되고 공유 링크에도 담긴다(src/likes.js).
import { h, batchim } from '../util.js';
import { CHROME_H } from '../win.js';
import { linkPrompt } from './link-app.js';
import { LIMIT, safeLink, setLike, isOwner } from '../likes.js';

const VIEW_H = 190; // 새 탭 안내(link-app.js의 창과 같은 높이)
const FORM_H = 236; // 주인이 게임을 넣는 칸(오류 한 줄이 떠도 들어가는 높이)

export function openComputerApp(os, app) {
  const owner = isOwner(os);
  const saved = () => os.home.likes.computer;
  if (!owner && !saved()) return os.say('넣어 둔 게임이 없네.');

  return os.wm.open({
    key: app.id,
    app,
    title: app.title,
    width: 380,
    height: saved() ? VIEW_H : FORM_H,
    build(body, win) {
      body.classList.add('computer-app');
      // 보기와 넣기 칸의 높이가 달라서 바꿀 때마다 창 높이를 맞춘다(최대화한 창은 그대로 둔다).
      const fit = height => { if (!win.maximized) win.el.style.height = `${height + CHROME_H}px`; };

      const view = () => {
        const game = saved();
        if (!game) return form();
        fit(VIEW_H);
        const what = game.name ? `${game.name}${batchim(game.name) ? '은' : '는'}` : '이 게임은';
        const parts = linkPrompt({
          text: `${what} 새 탭에서 열립니다.`,
          links: [{ label: '새 탭에서 열기', href: game.url }],
          rel: 'noopener noreferrer',
          onOpen: () => win.close(),
          onCancel: () => win.close(),
        });
        if (owner) parts[2].prepend(h('button', { className: 'btn like-edit', type: 'button', onclick: form }, '고치기'));
        body.replaceChildren(...parts);
      };

      const form = () => {
        fit(FORM_H);
        const game = saved();
        const name = h('input', { type: 'text', maxLength: LIMIT.gameName, value: game?.name || '', placeholder: '없어도 됩니다' });
        const url = h('input', { type: 'text', inputMode: 'url', value: game?.url || '', placeholder: 'https://' });
        url.spellcheck = false; // h()는 false 값을 건너뛰므로 따로 끈다
        const error = h('p', { className: 'like-error', hidden: true });
        const submit = e => {
          e.preventDefault();
          const text = url.value.trim();
          // 주소창에서 https://를 빼고 옮겨 적는 일이 많아서, 앞에 붙은 것이 없으면 https://로 본다
          const href = safeLink(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
          if (!text || !href) {
            error.textContent = '주소를 알아보지 못했습니다. https://로 시작하는 주소를 넣어 주세요.';
            error.hidden = false;
            url.focus();
            return;
          }
          setLike(os, 'computer', { url: href, name: name.value });
          view();
        };
        body.replaceChildren(h('form', { className: 'like-form', onsubmit: submit },
          h('p', {}, '좋아하는 웹 게임의 주소를 넣어 주세요.'),
          h('label', { className: 'like-field' }, h('span', {}, '게임 이름'), name),
          h('label', { className: 'like-field' }, h('span', {}, '주소'), url),
          error,
          h('div', { className: 'link-row' },
            game ? h('button', { className: 'btn like-edit', type: 'button', onclick: () => { setLike(os, 'computer', null); form(); } }, '게임 빼기') : null,
            h('button', { className: 'btn', type: 'submit' }, '넣기'),
            h('button', { className: 'btn', type: 'button', onclick: () => (saved() ? view() : win.close()) }, '취소'))));
        setTimeout(() => (game ? name : url).focus(), 50);
      };

      view();
    },
  });
}
