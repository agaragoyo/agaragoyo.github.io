// 가구 기믹: 라디오(F12). 누르면 라디오를 가까이 보며 주인이 넣어 둔 CD가 위에 펼쳐진다.
// CD 하나를 고르면 그 CD가 라디오의 CD 창으로 들어간 뒤 재생 단추가 꾹 눌리고 CD가 돈다. 그러면 스포티파이나 애플 뮤직의
// 공식 플레이어가 옆의 작은 창(OS 창)에 열린다. 미리 듣기 길이는 서비스가 정한다(로그인하지 않으면 노래마다 30초쯤, 2026-11-10 정함).
// 라디오를 내려놓아도 음악 창은 남아서 방을 걸으며 듣고, 음악 창이 열려 있는 동안 사이트 배경음악은 멈춘다.
// CD 그림(앨범 표지와 이름)은 볼 때마다 서비스의 공개 정보(스포티파이 oEmbed, 애플 iTunes 조회)에서 받는다. 키가 필요 없다.
// 주인(내 컴퓨터)에게는 CD 넣기와 빼기 단추가 있고 손님에게는 없다. 넣은 CD는 likes.radio에 저장되고 공유 링크에도 담긴다(src/likes.js).
import { h, reduceMotion } from '../util.js';
import { CHROME_W, CHROME_H } from '../win.js';
import { DESK_W } from '../config.js';
import { holdMusic } from '../sound.js';
import { openCloseup } from '../closeup.js';
import { LIMIT, parseMusic, setLike, isOwner } from '../likes.js';

const KIND = { spotify: { album: '스포티파이 앨범', playlist: '스포티파이 플레이리스트' }, apple: { album: '애플 뮤직 앨범', playlist: '애플 뮤직 플레이리스트' } };
const label = m => KIND[m.service][m.kind];
// 공식 플레이어 높이(서비스가 권하는 크기). 창 안쪽은 플레이어와 아래 안내 한 줄이다
const PLAYER = { spotify: 352, apple: 450 };
const PLAYER_W = 340;
const NOTE_H = 34; // 플레이어 아래 안내 한 줄

// CD 이름과 표지. 링크마다 한 번만 받는다. 못 받으면 이름 대신 서비스 이름을 쓴다
const meta = new Map();
function loadMeta(m) {
  if (!meta.has(m.link)) meta.set(m.link, fetchMeta(m).catch(() => null));
  return meta.get(m.link);
}
async function fetchMeta(m) {
  let info = null;
  if (m.service === 'spotify') {
    const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(m.link)}`);
    if (r.ok) { const d = await r.json(); info = { title: d.title, art: d.thumbnail_url }; }
  } else if (m.kind === 'album') {
    const r = await fetch(`https://itunes.apple.com/lookup?id=${m.id}&country=${m.cc}`);
    const a = r.ok ? (await r.json()).results?.[0] : null;
    if (a) info = { title: a.collectionName, art: a.artworkUrl100?.replace('100x100bb', '300x300bb') };
  }
  if (!info) return null;
  // 받은 값도 남의 글이다. 이름은 글자로만 쓰고, 그림은 https 주소일 때만 쓴다
  const title = typeof info.title === 'string' ? info.title.slice(0, 80) : '';
  const art = typeof info.art === 'string' && /^https:\/\/[^\s"'()]+$/.test(info.art) ? info.art : '';
  return { title, art };
}

// 음악 창은 라디오 화면보다 오래 산다(라디오를 내려놓아도 남는다)
let player = null;   // { win, frame, m } 열려 있는 음악 창
let onPlayerGone = null; // 열려 있는 라디오 화면이 음악 창이 닫힌 것을 알 때 부를 함수

function openPlayer(os, app, m) {
  if (player) {
    // 다른 CD로 바꾸면 같은 창에서 플레이어만 바꾼다. 같은 CD면 창만 앞으로 가져온다(듣던 곳에서 끊기지 않게)
    if (player.m.link !== m.link) {
      player.m = m;
      player.frame.src = m.embed;
      player.frame.style.height = `${PLAYER[m.service]}px`;
      if (!player.win.maximized) player.win.el.style.height = `${PLAYER[m.service] + NOTE_H + CHROME_H}px`;
    }
    player.win.focus();
    return;
  }
  let release = null;
  const win = os.wm.open({
    key: 'radio-player',
    app,
    title: app.title,
    width: PLAYER_W,
    height: PLAYER[m.service] + NOTE_H,
    flush: true,
    build(body) {
      body.classList.add('radio-player');
      const frame = h('iframe', {
        title: '음악 플레이어',
        allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
        loading: 'eager',
      });
      frame.style.height = `${PLAYER[m.service]}px`;
      frame.src = m.embed;
      body.append(frame, h('p', { className: 'radio-player-note' }, '로그인하지 않으면 노래마다 30초쯤 미리 듣습니다.'));
      player = { win: null, frame, m };
      release = holdMusic('radio', 'own'); // 사이트 배경음악과 겹치지 않게 멈춘다
      return () => {
        release?.();
        player = null;
        onPlayerGone?.();
      };
    },
  });
  player.win = win;
  // 옆의 작은 창: 바탕화면 오른쪽 위에 둔다(라디오 화면은 왼쪽으로 비킨다)
  win.el.style.left = `${DESK_W - (PLAYER_W + CHROME_W) - 28}px`;
  win.el.style.top = '72px';
}

export function openRadioApp(os, app) {
  const owner = isOwner(os);
  const cds = () => (os.home.likes.radio || []).map(c => parseMusic(c.url)).filter(Boolean);
  if (!owner && !cds().length) return os.say('넣어 둔 CD가 없네.');

  return openCloseup(os, {
    key: app.id,
    title: app.title,
    className: 'radio-closeup',
    build(panel, cu) {
      let current = player?.m || null; // 라디오에 든 CD
      let timers = [];
      const later = (f, ms) => timers.push(setTimeout(f, reduceMotion ? 0 : ms));

      const slot = h('div', { className: 'radio-slot' });
      const lcd = h('div', { className: 'radio-lcd' });
      const playKey = h('button', { type: 'button', className: 'radio-key', 'aria-label': '재생', title: '재생', onclick: () => current && play(current) }, '▶');
      const stopKey = h('button', { type: 'button', className: 'radio-key', 'aria-label': '멈춤', title: '멈춤', onclick: () => player?.win.close() }, '■');
      const speaker = () => h('div', { className: 'radio-speaker' }, h('i'));
      const fan = h('div', { className: 'radio-fan' });
      const tools = h('div', { className: 'radio-tools' });
      const radio = h('div', { className: 'radio-body' },
        h('div', { className: 'radio-handle' }),
        speaker(),
        h('div', { className: 'radio-middle' }, slot, lcd, h('div', { className: 'radio-keys' }, playKey, stopKey)),
        speaker());

      // CD 한 장의 그림. 표지가 오면 가운데 둥근 그림으로 깐다
      const disc = (m, spin) => {
        const art = h('img', { className: 'cd-art', alt: '', referrerPolicy: 'no-referrer', hidden: true });
        art.addEventListener('load', () => { art.hidden = false; });
        loadMeta(m).then(info => { if (info?.art) art.src = info.art; });
        return h('span', { className: spin ? 'cd spin' : 'cd' }, art, h('i', { className: 'cd-hole' }));
      };
      const nameOf = (m, el) => loadMeta(m).then(info => { el.textContent = info?.title || label(m); });

      // 라디오에 든 CD와 화면(LCD)
      function showSlot() {
        const on = !!(player && current && player.m.link === current.link);
        slot.replaceChildren(current ? disc(current, on) : '');
        lcd.textContent = current ? label(current) : 'CD를 골라 주세요';
        if (current) nameOf(current, lcd);
        cu.el.classList.toggle('beside', !!player);
      }

      function render() {
        const list = cds();
        if (current && !list.some(m => m.link === current.link) && !player) current = null;
        fan.replaceChildren(...list.map((m, i) => {
          const name = h('span', { className: 'cd-name' }, label(m));
          nameOf(m, name);
          const tilt = (i - (list.length - 1) / 2) * 7;
          // 라디오에 든 CD는 펼친 줄에서 빠진 자리로 남는다(꺼내져 라디오에 들어갔으므로)
          const item = h('button', {
            type: 'button',
            className: current?.link === m.link ? 'cd-pick in' : 'cd-pick',
            onclick: () => choose(m, item),
          }, disc(m, false), name);
          item.style.setProperty('--tilt', `${tilt}deg`);
          item.style.setProperty('--drop', `${Math.abs(tilt) * 1.4}px`);
          item.setAttribute('aria-label', `${label(m)} 틀기`);
          return item;
        }));
        if (!list.length) fan.append(h('p', { className: 'radio-empty' }, '아직 넣은 CD가 없습니다.'));
        tools.replaceChildren(...(owner ? [
          list.length < LIMIT.cds ? h('button', { type: 'button', className: 'btn', onclick: form }, 'CD 넣기') : null,
          current && list.some(m => m.link === current.link) ? h('button', { type: 'button', className: 'btn', onclick: remove }, '이 CD 빼기') : null,
        ].filter(Boolean) : []));
        panel.replaceChildren(fan, radio, tools);
        showSlot();
      }

      // 펼친 CD에서 하나를 고르면 라디오 CD 창으로 날아 들어간 뒤 재생 단추가 눌린다.
      // 펼친 CD는 기울어 있어 그대로 옮기면 좌표가 돌아가므로, 같은 그림을 하나 더 띄워 CD 창까지 옮기고 원래 CD는 숨긴다
      function choose(m, item) {
        timers.forEach(clearTimeout);
        timers = [];
        cu.el.querySelector('.cd.flying')?.remove();
        if (!reduceMotion) {
          const d = item.querySelector('.cd');
          const root = cu.el.getBoundingClientRect();
          const k = root.width / cu.el.offsetWidth || 1; // 화면 px과 무대 px의 비율(모니터 크기에 따라 무대가 줄어 있다)
          const centre = r => ({ x: (r.left + r.width / 2 - root.left) / k, y: (r.top + r.height / 2 - root.top) / k });
          const from = centre(d.getBoundingClientRect());
          const to = centre(slot.getBoundingClientRect());
          const size = d.offsetWidth;
          const fly = disc(m, false);
          fly.classList.add('flying');
          Object.assign(fly.style, { left: `${from.x - size / 2}px`, top: `${from.y - size / 2}px`, width: `${size}px`, height: `${size}px` });
          cu.el.append(fly);
          item.classList.add('in');
          requestAnimationFrame(() => requestAnimationFrame(() => {
            fly.style.transform = `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(${(slot.clientWidth - 16) / size})`;
          }));
          later(() => fly.remove(), 600);
        }
        later(() => {
          current = m;
          render();
          playKey.classList.add('pressed');
          later(() => { playKey.classList.remove('pressed'); play(m); }, 320);
        }, 560);
      }

      function play(m) {
        current = m;
        openPlayer(os, app, m);
        os.wm.blur(); // 음악 창이 키를 가져가지 않게 한다. 라디오를 보는 동안 Esc는 라디오 내려놓기다(음악 창을 누르면 그 창이 앞으로 온다)
        showSlot();
      }

      // 주인이 CD를 넣는다
      function form() {
        const url = h('input', { type: 'text', inputMode: 'url', placeholder: 'https://open.spotify.com/album/...' });
        url.spellcheck = false; // h()는 false 값을 건너뛰므로 따로 끈다
        const error = h('p', { className: 'like-error', hidden: true });
        const submit = e => {
          e.preventDefault();
          const m = parseMusic(url.value);
          const fail = msg => { error.textContent = msg; error.hidden = false; url.focus(); };
          if (!m) return fail('스포티파이나 애플 뮤직의 앨범, 플레이리스트 주소가 아닙니다. 공유 링크를 다시 복사해 넣어 주세요.');
          if (cds().some(c => c.link === m.link)) return fail('이미 넣은 CD입니다.');
          setLike(os, 'radio', [...cds().map(c => ({ url: c.link })), { url: m.link }]);
          render(); // 넣은 CD는 펼친 줄 끝에 선다. 골라야 라디오에 들어간다
        };
        panel.replaceChildren(h('form', { className: 'like-form like-card', onsubmit: submit },
          h('p', { className: 'like-card-head' }, 'CD 넣기'),
          h('p', {}, '스포티파이나 애플 뮤직에서 앨범이나 플레이리스트의 공유 링크를 복사해 넣어 주세요.'),
          h('label', { className: 'like-field' }, h('span', {}, '주소'), url),
          error,
          h('div', { className: 'link-row' },
            h('button', { className: 'btn', type: 'submit' }, '넣기'),
            h('button', { className: 'btn', type: 'button', onclick: () => (cds().length ? render() : cu.close()) }, '취소'))));
        setTimeout(() => url.focus(), 50);
      }

      function remove() {
        const left = cds().filter(m => m.link !== current.link);
        if (player?.m.link === current.link) player.win.close();
        setLike(os, 'radio', left.length ? left.map(m => ({ url: m.link })) : null);
        current = null;
        render();
      }

      onPlayerGone = () => { if (os.closeup === cu) showSlot(); };
      if (cds().length || player) render();
      else form(); // CD가 없는 주인은 바로 넣는 칸
      return () => {
        timers.forEach(clearTimeout);
        onPlayerGone = null;
      };
    },
  });
}
