// 가구 기믹: 코르크 보드(방명록, 시험). 누르면 보드를 가까이 보고, 손님이 붙인 쪽지가 포스트잇처럼 최근 것부터 붙어 있다.
// 요구 사항의 "가구와 인터랙션"대로 주인이 아니라 손님이 쓴다. 손님은 포스트잇 색을 고르고 닉네임과 짧은 글을 써서 붙이고,
// 주인은 쪽지마다 있는 지우기 단추로 쪽지를 지운다. 쪽지를 쓴 손님도 같은 브라우저에서는 자기 쪽지를 지울 수 있다.
// 손님끼리도 서로의 쪽지를 읽는다(동물의 숲 게시판, 패들렛처럼). 나쁜 쪽지는 주인이 지운다.
// 쪽지는 서버(src/cloud.js)의 방 문서 아래에 있어서 짧은 링크(#s=)를 만든 방에서만 쓴다. 주인이 짧은 링크를 만들지 않았으면
// 공유하기로 가는 단추를, 긴 링크(#r=)와 이웃집으로 온 손님에게는 쪽지를 남길 수 없다는 안내를 띄운다.
// 쪽지는 보드를 열 때만 한 장(NOTE.page장)씩 받는다(Firestore는 받은 문서마다 읽기를 센다).
// 받은 글은 누구든 쓸 수 있는 값이라 글자 수를 다시 줄이고 h()의 자식(글자)으로만 넣는다.
import { h } from '../util.js';
import { openCloseup } from '../closeup.js';
import { isOwner, line } from '../likes.js';
import { linkCode } from '../share.js';
import { NOTE, sharedId, fetchNotes, postNote, removeNote, myUid, lastNick, markNotesSeen } from '../cloud.js';

// 포스트잇 색(쪽지의 color 번호). 개수는 NOTE.colors와 같고, 글자색(#2a1f18)과 한 짝으로 밤에도 그대로 쓴다
const COLORS = [
  { name: '노란색', bg: '#fbe68f' },
  { name: '분홍색', bg: '#f8c4d2' },
  { name: '하늘색', bg: '#c2e1f5' },
  { name: '연두색', bg: '#d2eaab' },
];

// 보낼 글을 줄인다. 글자는 입력 칸의 maxLength와 같은 UTF-16 단위로 센다(이모지 하나가 2).
// 서버 규칙의 size()도 같은 단위로 센다(2026-11-11 시험: 60자 한도에 한글 60자와 이모지 30개는 되고 이모지 31개는 막혔다)
function fit(value, max) {
  let text = line(value, max);
  while (text.length > max) text = Array.from(text).slice(0, -1).join('');
  return text;
}

// 서버에서 받은 쪽지를 다듬는다. 닉네임이나 글이 비었거나 붙인 시각을 모르는 쪽지는 버린다
function clean(note) {
  const name = line(note.name, NOTE.name);
  const text = line(note.text, NOTE.text);
  const color = Number.isInteger(note.color) && note.color >= 0 && note.color < NOTE.colors ? note.color : 0;
  const t = Date.parse(note.at);
  return name && text && t ? { ...note, name, text, color, t } : null;
}

// 붙인 날. 올해 쪽지는 달과 날만 쓴다
function dateLabel(t) {
  const d = new Date(t);
  const day = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return d.getFullYear() === new Date().getFullYear() ? day : `${d.getFullYear()}년 ${day}`;
}

// 쪽지마다 조금씩 비뚤게 붙인다(-3~3도). 쪽지 번호로 정해서 다시 열어도 같은 각도다
function tilt(id) {
  let s = 0;
  for (const c of id) s = (s * 31 + c.charCodeAt(0)) % 997;
  return (s % 7) - 3;
}

const button = (label, onclick, className = 'btn') => h('button', { type: 'button', className, onclick }, label);

export function openCorkboardApp(os, app) {
  const owner = isOwner(os);
  const boardId = owner ? sharedId() : os.boardId || null; // 쪽지가 붙는 서버의 방 번호

  return openCloseup(os, {
    key: app.id,
    title: app.title,
    className: 'cork-closeup',
    build(panel) {
      const area = h('div', { className: 'cork-area' });
      const tools = h('div', { className: 'cork-tools' });
      panel.append(area, tools);
      let closed = false;

      // 보드 가운데의 안내 카드(쪽지가 없을 때, 쪽지를 쓸 수 없는 방일 때, 받지 못했을 때)
      const message = (...children) => area.replaceChildren(h('div', { className: 'cork-empty' }, h('div', { className: 'cork-card' }, ...children)));

      if (!boardId) {
        if (owner) {
          message(h('p', {}, '짧은 링크를 만들면 친구가 쪽지를 남길 수 있습니다.'),
            button('공유하기 열기', () => { os.closeup?.close(); os.openApp('share'); }));
        } else if (linkCode(location.hash)) {
          message(h('p', {}, '이 링크로는 쪽지를 남길 수 없습니다.'), h('p', {}, '주인에게 짧은 링크를 받아 주세요.'));
        } else {
          message(h('p', {}, '이 집의 코르크 보드에는 쪽지를 남길 수 없습니다.'));
        }
        return () => {};
      }

      let notes = [];     // 지금 장에 붙은 쪽지(다듬은 것)
      let more = false;   // 이 장보다 먼저 붙은 쪽지가 서버에 남았는지
      let next = null;    // 지난 쪽지를 받을 때의 시작점(이 장의 마지막 쪽지)
      let page = null;    // 지금 장의 시작점. null이면 가장 최근 장이다
      let busy = false;
      let fresh = null;   // 방금 붙인 쪽지 번호(한 번 눈에 띄게 붙는다)

      async function load(from) {
        busy = true;
        panel.classList.add('loading');
        try {
          const got = await fetchNotes(boardId, from);
          if (closed) return;
          page = from;
          notes = got.notes.map(clean).filter(Boolean);
          more = got.more;
          next = got.notes[got.notes.length - 1] || null;
          if (owner && !from && notes[0]) markNotesSeen(notes[0].at); // 새 쪽지 알림은 이 시각보다 새 쪽지가 붙었을 때만 뜬다(src/os.js)
          render();
        } catch (err) {
          console.warn('쪽지를 받지 못했다', err);
          if (closed) return;
          message(h('p', {}, '쪽지를 불러오지 못했습니다.'), h('p', {}, '잠시 후 다시 눌러 주세요.'), button('다시 불러오기', () => load(from)));
          tools.replaceChildren();
        } finally {
          busy = false;
          panel.classList.remove('loading');
        }
      }

      function render() {
        if (notes.length) area.replaceChildren(h('div', { className: 'cork-notes' }, ...notes.map(noteEl)));
        else if (page) message(h('p', {}, '이 장의 쪽지를 모두 지웠습니다.'));
        else if (owner) message(h('p', {}, '아직 붙은 쪽지가 없습니다.'), h('p', {}, '짧은 링크를 받은 친구가 여기에 쪽지를 남길 수 있습니다.'));
        else message(h('p', {}, '아직 붙은 쪽지가 없습니다.'));
        fresh = null;
        tools.replaceChildren(...[
          page ? button('최근 쪽지', () => !busy && load(null)) : null,
          owner ? null : button('쪽지 남기기', form),
          more ? button('지난 쪽지', () => !busy && load(next)) : null,
        ].filter(Boolean)); // replaceChildren은 null을 "null" 글자로 넣는다(known-issues 50)
      }

      // 쪽지 한 장. 주인은 모든 쪽지를, 손님은 이 브라우저로 붙인 쪽지만 지울 수 있다
      function noteEl(note) {
        const mine = owner || (!!note.uid && note.uid === myUid());
        const size = note.text.length > 44 ? ' long' : note.text.length > 28 ? ' mid' : '';
        const el = h('div', { className: `cork-note${size}${note.id === fresh ? ' fresh' : ''}` },
          h('span', { className: 'cork-pin' }),
          h('p', { className: 'cork-text' }, note.text),
          h('div', { className: 'cork-foot' },
            h('b', { className: 'cork-name' }, note.name),
            h('div', { className: 'cork-when' }, h('span', {}, dateLabel(note.t)), mine ? button('지우기', () => ask(el, note), 'cork-remove') : null)));
        // h()의 style로는 CSS 변수가 들어가지 않는다(known-issues 50)
        el.style.setProperty('--note', COLORS[note.color].bg);
        el.style.setProperty('--tilt', `${tilt(note.id)}deg`);
        return el;
      }

      // 지우기는 되돌릴 수 없어서 쪽지 위에 무엇이 일어나는지 띄우고 결과를 말하는 단추로 받는다(known-issues 32)
      function ask(el, note) {
        if (el.querySelector('.cork-ask')) return;
        const keep = button('그대로 두기', () => layer.remove());
        const layer = h('div', { className: 'cork-ask' },
          h('p', {}, '이 쪽지를 지웁니다.'),
          h('p', {}, '되돌릴 수 없습니다.'),
          h('div', { className: 'cork-ask-row' },
            button('지우기', async e => {
              e.currentTarget.disabled = true;
              try {
                await removeNote(boardId, note.id);
                notes = notes.filter(n => n.id !== note.id);
                if (!closed) render();
              } catch (err) {
                console.warn('쪽지를 지우지 못했다', err);
                layer.remove();
                os.toast('쪽지를 지우지 못했습니다. 잠시 후 다시 눌러 주세요.', 7000);
              }
            }),
            keep));
        el.append(layer);
        keep.focus(); // Enter를 잘못 눌러 지우지 않게 그대로 두기에 둔다
      }

      // 손님이 쪽지를 쓴다. 포스트잇 색을 고르면 쓰는 쪽지의 색이 바로 바뀐다
      function form() {
        let color = 0;
        let sending = false;
        const nick = h('input', { type: 'text', maxLength: NOTE.name, value: lastNick() || os.ownName() || '', autocomplete: 'off' });
        nick.spellcheck = false; // h()는 false 값을 건너뛰므로 따로 끈다
        const text = h('textarea', { rows: 3, maxLength: NOTE.text });
        const count = h('span', { className: 'cork-count' }, `0/${NOTE.text}`);
        const error = h('p', { className: 'like-error', hidden: true });
        const send = h('button', { type: 'submit', className: 'btn' }, '붙이기');
        const swatches = COLORS.map((c, i) => {
          const b = button('', () => pick(i), 'cork-swatch');
          b.title = c.name;
          b.setAttribute('aria-label', `${c.name} 쪽지`);
          b.style.setProperty('--note', c.bg);
          return b;
        });
        const fail = (msg, field) => {
          error.textContent = msg;
          error.hidden = false;
          field?.focus();
        };
        // 글은 한 문단이다. Enter는 줄을 바꾸지 않고 붙이기를 누른 것과 같다(한글을 조합하는 중의 Enter는 그대로 둔다)
        text.addEventListener('keydown', e => {
          if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
            e.preventDefault();
            send.click();
          }
        });
        text.addEventListener('input', () => { count.textContent = `${text.value.length}/${NOTE.text}`; });

        const submit = async e => {
          e.preventDefault();
          if (sending) return;
          const name = fit(nick.value, NOTE.name);
          const body = fit(text.value, NOTE.text);
          if (!name) return fail('닉네임이 비어 있습니다. 닉네임을 넣어 주세요.', nick);
          if (!body) return fail('남길 말이 비어 있습니다. 남길 말을 써 주세요.', text);
          sending = true;
          error.hidden = true;
          send.style.minWidth = `${send.offsetWidth}px`; // 글자가 바뀌어도 옆 단추가 밀리지 않게
          send.disabled = true;
          send.textContent = '붙이는 중';
          try {
            const note = await postNote(boardId, { name, text: body, color });
            if (closed) return;
            fresh = note.id;
            await load(null); // 가장 최근 장을 다시 받아 붙인 쪽지를 맨 앞에 보인다
          } catch (err) {
            console.warn('쪽지를 붙이지 못했다', err);
            fail('쪽지를 붙이지 못했습니다. 잠시 후 다시 눌러 주세요.');
            sending = false;
            send.disabled = false;
            send.textContent = '붙이기';
          }
        };

        const card = h('form', { className: 'like-form cork-form', onsubmit: submit },
          h('span', { className: 'cork-pin' }),
          h('p', { className: 'cork-form-head' }, '쪽지 남기기'),
          h('div', { className: 'cork-swatches', role: 'group', 'aria-label': '쪽지 색' }, ...swatches),
          h('label', { className: 'like-field' }, h('span', {}, '닉네임'), nick),
          h('label', { className: 'like-field tall' }, h('span', { className: 'cork-label' }, '남길 말', count), text),
          error,
          h('div', { className: 'link-row' }, send, button('취소', () => (busy ? null : render()))));
        const pick = i => {
          color = i;
          card.style.setProperty('--note', COLORS[i].bg);
          swatches.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
        };
        pick(0);
        area.replaceChildren(h('div', { className: 'cork-empty' }, card));
        tools.replaceChildren();
        setTimeout(() => (nick.value ? text : nick).focus(), 50);
      }

      message(h('p', {}, '쪽지를 불러오는 중'));
      load(null);
      return () => { closed = true; };
    },
  });
}
