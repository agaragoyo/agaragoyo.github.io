// 가구 기믹: 책장(F12). 누르면 책장을 가까이 보며, 고른 책의 표지와 주인이 남긴 구절이나 고른 이유가 크게 뜬다.
// 표지는 모든 책이 같은 디자인이다. 제목과 작가는 표지 안의 정해 둔 자리(이름표)에 들어가고, 책 색은 넣을 때 무작위로 정한다(요구 사항).
// 책은 5권까지 꽂고, 2권 이상이면 방향키(←, →)나 아래 선반의 책등을 눌러 옆 책으로 넘어간다.
// 주인(내 컴퓨터)에게는 책 넣기, 고치기, 빼기 단추가 있고 손님에게는 없다. 책이 없는 책장을 손님이 쓰면 아바타가 한마디 한다.
// 넣은 책은 집 상태의 likes.bookshelf에 저장되고 공유 링크에도 담긴다(src/likes.js).
import { h, clamp } from '../util.js';
import { openCloseup } from '../closeup.js';
import { LIMIT, setLike, isOwner } from '../likes.js';

// 표지 색(likes의 color 번호). 가구 그림의 책장(assets/furniture/bookshelf.png)에 꽂힌 책처럼 바랜 색이다. 개수는 LIMIT.bookColors와 같다
export const BOOK_COLORS = ['#c9766a', '#7f9a6c', '#5d84b8', '#d4a12a', '#8b72b8', '#a07a4a', '#c06c94', '#4f8f86'];

// 책 색을 CSS 변수(--book)로 넣는다. h()의 style은 Object.assign이라 사용자 정의 속성은 setProperty로 따로 넣는다
const tint = (el, book) => { el.style.setProperty('--book', BOOK_COLORS[book.color]); return el; };

// 표지 하나. 제목이 길면 글자를 줄인다(이름표 자리는 늘 같다)
function cover(book) {
  return tint(h('div', { className: 'book-cover' },
    h('div', { className: 'book-band top' }),
    h('div', { className: 'book-label' },
      h('b', { className: Array.from(book.title).length > 12 ? 'book-title long' : 'book-title' }, book.title),
      book.author ? h('span', { className: 'book-author' }, book.author) : null),
    h('div', { className: 'book-band bottom' })), book);
}

export function openBookshelfApp(os, app) {
  const owner = isOwner(os);
  const books = () => os.home.likes.bookshelf || [];
  if (!owner && !books().length) return os.say('꽂아 둔 책이 없네.');

  return openCloseup(os, {
    key: app.id,
    title: app.title,
    className: 'shelf-closeup',
    build(panel, cu) {
      let at = 0; // 지금 보는 책

      const go = i => {
        const n = books().length;
        if (!n) return;
        at = clamp(i, 0, n - 1);
        show();
      };

      // 고른 책 보기
      function show() {
        const list = books();
        at = clamp(at, 0, Math.max(0, list.length - 1));
        const book = list[at];
        const main = book
          ? h('div', { className: 'shelf-stage' },
            cover(book),
            h('div', { className: 'shelf-info' },
              h('div', { className: 'shelf-note' },
                h('p', { className: 'shelf-note-head' }, '좋아하는 구절이나 고른 이유'),
                book.note ? h('p', { className: 'shelf-note-text' }, book.note) : h('p', { className: 'shelf-note-none' }, '남긴 말이 없습니다.')),
              owner ? h('div', { className: 'shelf-tools' },
                h('button', { type: 'button', className: 'btn', onclick: () => form(at) }, '고치기'),
                h('button', { type: 'button', className: 'btn', onclick: remove }, '이 책 빼기')) : null))
          : h('div', { className: 'shelf-empty' }, h('p', {}, '아직 꽂은 책이 없습니다.'),
            h('button', { type: 'button', className: 'btn', onclick: () => form(-1) }, '책 넣기'));

        // 아래 선반: 책등을 누르면 그 책으로 넘어간다. 주인은 빈 자리를 눌러 책을 더 꽂는다
        const spines = list.map((b, i) => tint(h('button', {
          type: 'button',
          className: i === at ? 'book-spine on' : 'book-spine',
          'aria-label': `${i + 1}번째 책 ${b.title}`,
          onclick: () => go(i),
        }, h('span', {}, b.title)), b));
        if (owner && list.length < LIMIT.books) {
          spines.push(h('button', { type: 'button', className: 'book-spine add', title: '책 넣기', 'aria-label': '책 넣기', onclick: () => form(-1) }, '+'));
        }
        const row = h('div', { className: 'shelf-row' },
          h('button', { type: 'button', className: 'shelf-arrow', 'aria-label': '앞 책', disabled: at <= 0, onclick: () => go(at - 1) }, '◀'),
          h('div', { className: 'shelf-board' }, ...spines),
          h('button', { type: 'button', className: 'shelf-arrow', 'aria-label': '다음 책', disabled: at >= list.length - 1, onclick: () => go(at + 1) }, '▶'));
        const count = list.length > 1 ? h('p', { className: 'shelf-count' }, h('b', {}, `${at + 1} / ${list.length}`), '방향키로 넘겨 보세요.') : null;
        panel.replaceChildren(main, count, row);
      }

      // 주인이 책을 넣거나 고친다. i가 -1이면 새 책
      function form(i) {
        const old = i >= 0 ? books()[i] : null;
        const title = h('input', { type: 'text', maxLength: LIMIT.bookTitle, value: old?.title || '' });
        const author = h('input', { type: 'text', maxLength: LIMIT.bookAuthor, value: old?.author || '' });
        const note = h('textarea', { rows: 3, maxLength: LIMIT.bookNote, value: old?.note || '' });
        const error = h('p', { className: 'like-error', hidden: true });
        const submit = e => {
          e.preventDefault();
          if (!title.value.trim()) {
            error.textContent = '책 제목이 비어 있습니다. 제목을 넣어 주세요.';
            error.hidden = false;
            title.focus();
            return;
          }
          const list = [...books()];
          // 새 책의 색은 무작위로 고르되, 바로 앞 책과 같은 색은 피한다(선반에서 책등이 붙어 보이지 않게)
          const prev = list[list.length - 1]?.color;
          let color = old?.color;
          if (color == null) do { color = Math.floor(Math.random() * LIMIT.bookColors); } while (color === prev);
          const book = { title: title.value, author: author.value, note: note.value, color };
          if (old) list[i] = book;
          else list.push(book);
          setLike(os, 'bookshelf', list);
          at = old ? i : books().length - 1;
          show();
        };
        panel.replaceChildren(h('form', { className: 'like-form like-card shelf-form', onsubmit: submit },
          h('p', { className: 'like-card-head' }, old ? '책 고치기' : '책 넣기'),
          h('p', {}, '제목과 작가를 쓰면 같은 디자인의 표지가 만들어집니다.'),
          h('label', { className: 'like-field' }, h('span', {}, '책 제목'), title),
          h('label', { className: 'like-field' }, h('span', {}, '작가'), author),
          h('label', { className: 'like-field tall' }, h('span', {}, '좋아하는 구절이나 고른 이유'), note),
          error,
          h('div', { className: 'link-row' },
            h('button', { className: 'btn', type: 'submit' }, old ? '고치기' : '넣기'),
            h('button', { className: 'btn', type: 'button', onclick: () => (books().length ? show() : cu.close()) }, '취소'))));
        setTimeout(() => title.focus(), 50);
      }

      function remove() {
        const list = books().filter((_, i) => i !== at);
        setLike(os, 'bookshelf', list.length ? list : null);
        at = Math.min(at, Math.max(0, list.length - 1));
        show(); // 다 빼면 빈 책장과 책 넣기 단추가 뜬다
      }

      cu.onKey = e => {
        if (!panel.querySelector('.shelf-stage')) return; // 넣는 칸에서는 방향키를 쓰지 않는다
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1); }
      };

      if (books().length) show();
      else form(-1); // 책이 없는 주인은 바로 넣는 칸
    },
  });
}
