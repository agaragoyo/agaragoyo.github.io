// 라디오의 유튜브 재생목록 CD(F12): 음악 창에 이전 곡과 다음 곡의 이름을 보이고, "목록 보기"로 곡 목록 창을 연다. 음악 창(src/apps/radio-app.js)이 쓴다.
// 곡 id와 지금 번호는 IFrame Player API의 getPlaylist, getPlaylistIndex로 읽는다. 플레이어가 준비되었을 때와 상태가 바뀔 때마다 읽는다(곡이 저절로 넘어갈 때도 상태가 바뀐다).
// 곡 이름은 유튜브 oEmbed로 곡 id마다 받는다. 키가 필요 없고, 라디오가 CD 이름을 받는 방법과 같다.
// 플레이어의 getVideoData().title은 같은 곡이 번역된 제목과 원제로 섞여 와서(2026-11-15에 재 보았다) 이전, 다음, 목록의 이름을 모두 oEmbed 하나로 맞춘다.
// 목록은 음악 창 안이 아니라 따로 연다. 유튜브 API 서비스의 최소 기능 요건이 플레이어를 200×200px보다 작게 띄우지 말고 앞에 다른 요소를 두지 말라고 한다.
import { h } from '../util.js';
import { CHROME_H } from '../win.js';
import { DESK_H } from '../config.js';
import { line } from '../likes.js';

// 곡 이름과 목록이 있는 CD: 유튜브 재생목록뿐이다. 영상 하나와 스포티파이, 애플 뮤직의 플레이어는 곡 목록이 플레이어 안에 있다
export const hasTracks = m => m.service === 'youtube' && m.kind === 'playlist';

// ---------- 곡 이름 ----------
// 곡마다 한 번만 묻고, 한꺼번에 묻는 수를 제한한다. 곡이 수백 곡이어도 줄이 보일 때만 물으므로 처음부터 모두 묻지 않는다
const VIDEO_ID = /^[\w-]{11}$/;
const TITLE_MAX = 100; // 유튜브 영상 제목의 최대 글자 수
const PARALLEL = 4;    // 한꺼번에 묻는 oEmbed 수
const titles = new Map(); // 곡 id -> 이름을 담은 약속. 이름이 없는 곡은 ''
const queue = [];         // 아직 묻지 않은 곡. 가장 나중에 청한 것(지금 보이는 줄)부터 묻는다
let asking = 0;

async function askTitle(id) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { signal: ctl.signal });
    if (r.ok) return line((await r.json()).title, TITLE_MAX);
    // 퍼가기를 막은 곡(401)과 지워진 곡(404)은 이름을 알려 주지 않는다. 번호의 뜻은 날마다 달랐으므로 400, 403도 같게 본다(known-issues 79).
    // 그 밖의 답(5xx, 429)과 끊긴 연결은 이름이 없는 곡이 아니라 못 받은 것이라 받아 두지 않고 다음에 다시 묻는다
    if ([400, 401, 403, 404].includes(r.status)) return '';
    throw new Error(`youtube oembed ${r.status}`);
  } finally {
    clearTimeout(timer);
  }
}

function pump() {
  while (asking < PARALLEL && queue.length) {
    const { id, done } = queue.pop();
    asking++;
    askTitle(id).catch(() => { titles.delete(id); return ''; }).then(title => {
      asking--;
      done(title);
      pump();
    });
  }
}

export function trackTitle(id) {
  if (!VIDEO_ID.test(id)) return Promise.resolve('');
  if (!titles.has(id)) titles.set(id, new Promise(done => { queue.push({ id, done }); pump(); }));
  return titles.get(id);
}

const WAIT = '…';             // 이름을 받는 중이거나 아직 모른다
const NONE = '없음';          // 이전 곡이 없는 첫 곡, 다음 곡이 없는 마지막 곡
const NO_TITLE = '제목 없음'; // 유튜브가 이름을 알려 주지 않는 곡

// 곡 목록 창의 크기(창 안쪽). 줄 높이는 style.css의 .radio-track, 머리줄은 .radio-tracks-head와 맞춘다
const ROW_H = 30;
const HEAD_H = 35;
const MIN_H = 160;
// 유튜브 플레이어가 재생목록에서 다루는 곡 수의 끝. 2026-11-15에 곡이 550개와 4,625개인 공개 재생목록(채널 업로드 재생목록) 둘로 재 보니 getPlaylist()가 둘 다 200개만 주었고,
// 200번째 곡에서 nextVideo()를 눌러도 넘어가지 않았으며 playVideoAt(250)은 아무 일도 하지 않았다. 목록이 이만큼이면 그 뒤의 곡은 나오지 않는다고 알린다(known-issues 85)
const CAP = 200;
const CAP_NOTE = '재생목록의 앞 200곡까지만 재생됩니다.';

// 재생목록 CD의 곡 정보를 맡는다. 음악 창이 하나 열릴 때 하나를 만들고, 돌려준 것을 이렇게 쓴다.
//   lines    단추 줄 아래에 붙일 이전 곡, 다음 곡 두 줄
//   listBtn  단추 줄에 붙일 "목록 보기" 단추
//   reset(cd) 다른 CD를 틀 때. ready(yt) 플레이어가 명령을 받을 수 있을 때. refresh() 플레이어의 상태가 바뀔 때.
//   stop() 재생하지 못할 때나 API를 받지 못했을 때. destroy() 음악 창을 닫을 때
// music은 음악 창을 돌려주는 함수, width는 음악 창 안쪽 폭이다
export function createTracks(os, app, { music, width }) {
  let cd = null;    // 틀고 있는 CD
  let yt = null;    // 명령을 받을 수 있는 플레이어
  let ids = [];     // 재생목록의 곡 id
  let sig = '';     // ids를 한 글로 이은 것(바뀌었는지 보려는 것)
  let index = -1;   // 지금 곡의 번호(0부터). 모르면 -1
  let retry = 0;    // 곡 목록이 아직 비어 있을 때 다시 읽을 타이머
  let view = null;  // 열려 있는 곡 목록 창

  const known = () => index >= 0 && index < ids.length;

  // ----- 이전 곡, 다음 곡 두 줄 -----
  const slotOf = label => {
    const name = h('span', { className: 'radio-track-name' });
    return { el: h('p', { className: 'radio-track-line' }, h('span', { className: 'radio-track-tag' }, label), name), name, id: '' };
  };
  const prev = slotOf('이전:');
  const next = slotOf('다음:');
  const lines = h('div', { className: 'radio-player-tracks', hidden: true }, prev.el, next.el);
  const listBtn = h('button', { type: 'button', className: 'btn radio-list-btn', title: '곡 목록 창 열기', disabled: true, onclick: () => openList() }, '목록 보기');

  // dim은 이름이 아닌 글(…, 없음, 제목 없음)이다. 이름은 긴 것이 줄임표로 잘리므로 풍선 도움말에 다 적는다
  const put = (slot, text, dim = true) => {
    slot.name.textContent = text;
    slot.name.classList.toggle('dim', dim);
    slot.el.title = dim ? '' : text;
  };
  const fill = (slot, at) => {
    slot.id = '';
    if (!known()) return put(slot, WAIT);
    if (at < 0 || at >= ids.length) return put(slot, NONE);
    const id = ids[at];
    slot.id = id;
    put(slot, WAIT);
    trackTitle(id).then(title => { if (slot.id === id) put(slot, title || NO_TITLE, !title); });
  };

  // ----- 곡 목록 창 -----
  function openList() {
    if (view) return view.win.focus();
    const m = music()?.el;
    if (!m || !ids.length) return;
    // 음악 창 바로 아래, 같은 왼쪽 끝에 둔다. 아래에 자리가 모자라면 음악 창의 왼쪽 옆에 둔다. 아래쪽은 바탕화면 끝에서 gap만큼 띄운다
    const gap = 8;
    const below = DESK_H - (m.offsetTop + m.offsetHeight + gap) - gap - CHROME_H;
    const side = below < MIN_H;
    const room = side ? DESK_H - m.offsetTop - gap - CHROME_H : below;
    const win = os.wm.open({
      key: 'radio-tracks',
      app,
      title: '곡 목록',
      width,
      height: Math.max(MIN_H, Math.min(HEAD_H + ids.length * ROW_H, room)),
      flush: true,
      build(body) {
        body.classList.add('radio-tracks');
        const cdName = h('span', { className: 'radio-tracks-cd' });
        const pos = h('span', { className: 'radio-tracks-pos' });
        const list = h('ol', { className: 'radio-tracks-list' });
        body.append(h('div', { className: 'radio-tracks-head' }, cdName, pos), list);
        // 보이는 줄의 이름만 받는다
        const seen = new IntersectionObserver(entries => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            seen.unobserve(e.target);
            const row = e.target;
            trackTitle(row.dataset.id).then(title => {
              if (!row.isConnected) return;
              const name = row.lastElementChild;
              name.textContent = title || NO_TITLE;
              name.classList.toggle('dim', !title);
              row.title = title;
            });
          }
        }, { root: list, rootMargin: '60px 0px' });
        view = { win: null, list, cdName, pos, seen, sig: null, rows: [], now: -1 };
        draw();
        return () => {
          seen.disconnect();
          view = null;
        };
      },
    });
    view.win = win;
    const outerW = win.el.offsetWidth;
    win.el.style.left = `${side ? Math.max(0, m.offsetLeft - outerW - gap) : m.offsetLeft}px`;
    win.el.style.top = `${side ? m.offsetTop : m.offsetTop + m.offsetHeight + gap}px`;
  }

  const closeList = () => view?.win.close();

  const playAt = i => {
    try { yt?.playVideoAt(i); } catch { /* 이미 떼어진 플레이어 */ }
  };

  // 목록 창을 지금 곡 정보에 맞춘다. 곡이 바뀌었으면 줄을 새로 만들고, 번호만 바뀌었으면 지금 곡 표시만 옮긴다
  function draw() {
    if (!view) return;
    const { list, seen } = view;
    // CD 이름은 16자까지지만 이모지처럼 넓은 글자면 머리줄에서 줄임표로 잘리므로 풍선 도움말에 이름을 다 적는다(known-issues 83)
    view.cdName.textContent = view.cdName.title = cd?.name || '유튜브 재생목록';
    view.pos.textContent = known() ? `${index + 1} / ${ids.length}` : '';
    const rebuilt = view.sig !== sig;
    if (rebuilt) {
      seen.disconnect();
      view.sig = sig;
      view.now = -1;
      view.rows = ids.map((id, i) => h('button', { type: 'button', className: 'radio-track', dataset: { id }, onclick: () => playAt(i) },
        h('i', { className: 'radio-track-now', 'aria-hidden': 'true' }),
        h('span', { className: 'radio-track-no' }, String(i + 1)),
        h('span', { className: 'radio-track-name dim' }, WAIT)));
      list.replaceChildren(...(ids.length
        ? [...view.rows.map(row => h('li', {}, row)), ids.length >= CAP ? h('li', { className: 'radio-tracks-note' }, CAP_NOTE) : null].filter(Boolean)
        : [h('li', { className: 'radio-tracks-note' }, '곡 목록을 불러오는 중입니다.')]));
      view.rows.forEach(row => seen.observe(row));
    }
    if (view.now === index) return;
    const was = view.rows[view.now];
    const row = view.rows[index];
    // 목록을 따라가던 사람에게는 지금 곡이 보이는 곳에 있게 한다. 다른 곳을 보고 있었으면 움직이지 않는다
    const following = !!was && was.offsetTop >= list.scrollTop && was.offsetTop + was.offsetHeight <= list.scrollTop + list.clientHeight;
    was?.removeAttribute('aria-current');
    row?.setAttribute('aria-current', 'true');
    view.now = index;
    if (!row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (rebuilt) list.scrollTop = top - (list.clientHeight - row.offsetHeight) / 2; // scrollIntoView는 바깥 상자까지 밀어서 쓰지 않는다
    else if (following && top < list.scrollTop) list.scrollTop = top;
    else if (following && bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }

  // ----- 플레이어에서 읽기 -----
  function render() {
    fill(prev, index - 1);
    fill(next, index + 1);
    listBtn.disabled = !ids.length;
    draw();
  }

  function read() {
    if (!yt) return;
    let list;
    let now;
    try {
      list = yt.getPlaylist();
      now = yt.getPlaylistIndex();
    } catch { return; /* 이미 떼어진 플레이어 */ }
    const nextIds = Array.isArray(list) ? list.filter(id => typeof id === 'string') : [];
    const nextIndex = Number.isInteger(now) ? now : -1;
    const nextSig = nextIds.join();
    if (nextSig === sig && nextIndex === index) return;
    ids = nextIds;
    sig = nextSig;
    index = nextIndex;
    render();
  }

  // 플레이어가 준비된 직후에는 곡 목록이 아직 비어 있을 수 있어, 받을 때까지 반 초마다 읽는다(4초까지)
  function poll(tries = 0) {
    clearTimeout(retry);
    read();
    if (!ids.length && yt && tries < 8) retry = setTimeout(() => poll(tries + 1), 500);
  }

  function clear() {
    clearTimeout(retry);
    yt = null;
    ids = [];
    sig = '';
    index = -1;
  }

  return {
    lines,
    listBtn,
    reset(target) {
      cd = target;
      clear();
      lines.hidden = !hasTracks(cd);
      if (lines.hidden) closeList();
      render();
    },
    ready(player) {
      if (!hasTracks(cd)) return;
      yt = player;
      poll();
    },
    refresh: read,
    stop() {
      clear();
      lines.hidden = true;
      closeList();
      render();
    },
    destroy() {
      clear();
      closeList();
    },
  };
}
