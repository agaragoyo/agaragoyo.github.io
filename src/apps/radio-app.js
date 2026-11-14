// 가구 기믹: 라디오(F12). 누르면 라디오를 가까이 보며 주인이 넣어 둔 CD가 위에 펼쳐진다.
// CD 하나를 고르면 그 CD가 라디오의 CD 창으로 들어간 뒤 재생 단추가 꾹 눌리고 CD가 돈다. 그러면 스포티파이나 애플 뮤직의
// 공식 플레이어가 옆의 작은 창(OS 창)에 열린다. 미리 듣기 길이는 서비스가 정한다(로그인하지 않으면 노래마다 30초쯤, 2026-11-10 정함).
// 다른 CD를 고르면 든 CD와 바뀌고, 꺼내기 단추(삼각형과 막대)는 음악을 멈추고 든 CD를 펼친 줄의 제자리로 돌려놓는다.
// 든 CD의 제자리는 점선 동그라미로 남긴다. 아예 비우면 CD가 한 장뿐일 때 펼친 줄이 텅 비어 고장 난 것처럼 보였다.
// 라디오를 내려놓아도 음악 창은 남아서 방을 걸으며 듣고, 음악 창이 열려 있는 동안 사이트 배경음악은 멈춘다.
// CD 가운데의 앨범 표지는 볼 때마다 서비스의 공개 정보(스포티파이 oEmbed, 애플 iTunes 조회)에서 받는다. 키가 필요 없다.
// CD마다 주인이 이름과 색을 정한다(2026-11-14). 애플 뮤직 플레이리스트는 표지와 이름을 받을 길이 없어서, 여러 장을 넣으면
// 모두 "애플 뮤직 플레이리스트"라는 같은 이름과 같은 그림이라 어느 CD가 어느 플레이리스트인지 알 수 없다는 제보가 있었다.
// 넣는 칸은 받아 온 이름을 이름 칸에 미리 채우고, 색은 다른 CD가 쓰지 않은 색을 먼저 골라 둔다. 그래서 주인이 손대지 않아도 CD가 서로 달라 보인다.
// 이름이 없는 옛 CD(이름 칸이 생기기 전에 넣은 것)는 예전처럼 받은 이름을 쓴다.
// 주인(내 컴퓨터)에게는 CD 넣기와 고치기, 지우기 단추가 있고 손님에게는 없다. 넣은 CD는 likes.radio에 저장되고 공유 링크에도 담긴다(src/likes.js).
// 목록에서 지우는 단추를 다른 가구처럼 "빼기"라고 하면 라디오에서 꺼내기로 읽혀서, 라디오만 "지우기"라고 쓴다.
import { h, reduceMotion } from '../util.js';
import { CHROME_W, CHROME_H } from '../win.js';
import { DESK_W } from '../config.js';
import { holdMusic } from '../sound.js';
import { openCloseup } from '../closeup.js';
import { LIMIT, parseMusic, setLike, isOwner, line } from '../likes.js';

const KIND = { spotify: { album: '스포티파이 앨범', playlist: '스포티파이 플레이리스트' }, apple: { album: '애플 뮤직 앨범', playlist: '애플 뮤직 플레이리스트' } };
const label = m => KIND[m.service][m.kind];
// CD 색 이름(likes의 color 번호 순서). 색은 style.css의 .cd[data-color]에 있고, 개수는 LIMIT.cdColors와 같다(tools/check.py가 본다)
const CD_COLORS = ['은색', '금색', '파란색', '초록색', '분홍색', '보라색'];
// 새 CD의 색: 다른 CD가 쓰지 않은 색 가운데 앞의 것. 넣을 수 있는 CD 장수만큼 색이 있어서 넣는 칸이 열릴 때는 늘 하나가 남는다
const freeColor = list => Math.max(0, CD_COLORS.findIndex((_, i) => !list.some(m => m.color === i)));
// 저장하는 모양. 빈 이름과 0번 색(은색)은 likes의 검사가 지운다
const saved = m => ({ url: m.link, name: m.name, color: m.color });

// CD에 쓰는 이름: 주인이 붙인 이름. 이름이 없는 옛 CD는 서비스에서 받은 이름을, 그것도 못 받으면 서비스 이름을 쓴다.
// 받는 동안 그 자리(라디오 표시창)에 다른 CD가 들어왔으면 받은 이름을 쓰지 않는다
const naming = new WeakMap();
function nameOf(m, el) {
  naming.set(el, m);
  el.textContent = m.name || label(m);
  if (!m.name) loadMeta(m).then(info => { if (info?.title && naming.get(el) === m) { el.textContent = info.title; fitName(el); } });
}
// 펼친 CD의 이름은 띄어쓰기에서 줄을 바꾼다(style.css의 .cd-name). 짧은 낱말 뒤에 긴 낱말이 오면 그렇게 해서 두 줄을 넘는
// 이름("가나다라 마바사아자차 카타파하")이 있어서, 그런 이름만 글자 사이에서도 줄을 바꿔 16자가 두 줄에 다 들어가게 한다
function fitName(el) {
  if (!el.classList.contains('cd-name')) return; // 라디오 표시창은 한 줄이다
  el.classList.remove('tight');
  if (el.scrollHeight > el.clientHeight + 1) el.classList.add('tight');
}
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
  // 넣어 둔 CD: 알아본 링크(parseMusic)에 주인이 붙인 이름과 색 번호를 더한 것
  const cds = () => (os.home.likes.radio || []).map(c => {
    const m = parseMusic(c.url);
    return m && { ...m, name: c.name || '', color: c.color || 0 };
  }).filter(Boolean);
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
      const ejectKey = h('button', { type: 'button', className: 'radio-key eject', 'aria-label': '꺼내기', title: '꺼내기', onclick: () => eject() }, h('i', { className: 'radio-eject', 'aria-hidden': 'true' }));
      const speaker = () => h('div', { className: 'radio-speaker' }, h('i'));
      const fan = h('div', { className: 'radio-fan' });
      const tools = h('div', { className: 'radio-tools' });
      const radio = h('div', { className: 'radio-body' },
        h('div', { className: 'radio-handle' }),
        speaker(),
        h('div', { className: 'radio-middle' }, slot, lcd, h('div', { className: 'radio-keys' }, playKey, stopKey, ejectKey)),
        speaker());

      // CD 한 장의 그림. 원판은 주인이 고른 색이고(style.css의 .cd[data-color]), 표지가 오면 가운데 둥근 그림으로 깐다
      const disc = (m, spin) => {
        const art = h('img', { className: 'cd-art', alt: '', referrerPolicy: 'no-referrer', hidden: true });
        art.addEventListener('load', () => { art.hidden = false; });
        loadMeta(m).then(info => { if (info?.art) art.src = info.art; });
        return h('span', { className: spin ? 'cd spin' : 'cd', dataset: { color: m.color || 0 } }, art, h('i', { className: 'cd-hole' }));
      };

      // 라디오에 든 CD와 화면(LCD)
      function showSlot() {
        const on = !!(player && current && player.m.link === current.link);
        slot.replaceChildren(current ? disc(current, on) : '');
        if (current) nameOf(current, lcd);
        else {
          naming.delete(lcd);
          lcd.textContent = 'CD를 골라 주세요';
        }
        cu.el.classList.toggle('beside', !!player);
      }

      function render() {
        const list = cds();
        // 라디오에 든 CD는 목록의 것으로 바꿔 들어 고친 이름과 색이 보이게 한다. 목록에 없는 CD는 음악 창에서 듣는 중일 때만 남긴다
        if (current) current = list.find(m => m.link === current.link) || (player ? current : null);
        fan.replaceChildren(...list.map((m, i) => {
          const name = h('span', { className: 'cd-name' });
          nameOf(m, name);
          const tilt = (i - (list.length - 1) / 2) * 7;
          // 라디오에 든 CD의 제자리는 점선 동그라미로 남고 누를 수 없다(꺼내기 단추로 돌려놓는다)
          const inside = current?.link === m.link;
          const item = h('button', {
            type: 'button',
            className: inside ? 'cd-pick in' : 'cd-pick',
            disabled: inside,
            dataset: { link: m.link },
            onclick: () => choose(m, item),
          }, disc(m, false), name);
          item.style.setProperty('--tilt', `${tilt}deg`);
          item.style.setProperty('--drop', `${Math.abs(tilt) * 1.4}px`);
          item.setAttribute('aria-label', `${m.name || label(m)} 틀기`);
          return item;
        }));
        if (!list.length) fan.append(h('p', { className: 'radio-empty' }, '아직 넣은 CD가 없습니다.'));
        const inRadio = !!current && list.some(m => m.link === current.link);
        tools.replaceChildren(...(owner ? [
          list.length < LIMIT.cds ? h('button', { type: 'button', className: 'btn', onclick: () => form() }, 'CD 넣기') : null,
          inRadio ? h('button', { type: 'button', className: 'btn', onclick: () => form(current) }, '이 CD 고치기') : null,
          inRadio ? h('button', { type: 'button', className: 'btn', onclick: remove }, '이 CD 지우기') : null,
        ].filter(Boolean) : []));
        panel.replaceChildren(fan, radio, tools);
        fan.querySelectorAll('.cd-name').forEach(fitName); // 화면에 붙은 뒤에야 줄 수를 잴 수 있다
        showSlot();
      }

      // 움직이던 CD를 멈춘다(날던 그림과 기다리던 일을 지운다)
      function settle() {
        timers.forEach(clearTimeout);
        timers = [];
        cu.el.querySelector('.cd.flying')?.remove();
      }

      // CD 그림을 펼친 줄의 CD(cd)와 라디오 CD 창 사이로 날린다. toSlot이면 CD 창으로, 아니면 제자리로 간다.
      // 펼친 CD는 기울어 있어 그대로 옮기면 좌표가 돌아가므로, 같은 그림을 하나 더 띄워 옮긴다
      function flyDisc(m, cd, toSlot) {
        const root = cu.el.getBoundingClientRect();
        const k = root.width / cu.el.offsetWidth || 1; // 화면 px과 무대 px의 비율(모니터 크기에 따라 무대가 줄어 있다)
        const centre = el => { const r = el.getBoundingClientRect(); return { x: (r.left + r.width / 2 - root.left) / k, y: (r.top + r.height / 2 - root.top) / k }; };
        const [from, to] = toSlot ? [centre(cd), centre(slot)] : [centre(slot), centre(cd)];
        const size = cd.offsetWidth;
        const inSlot = (slot.clientWidth - 16) / size; // CD 창 안에서의 크기
        const [s0, s1] = toSlot ? [1, inSlot] : [inSlot, 1];
        const fly = disc(m, false);
        fly.classList.add('flying');
        Object.assign(fly.style, { left: `${from.x - size / 2}px`, top: `${from.y - size / 2}px`, width: `${size}px`, height: `${size}px`, transform: `translate(0px, 0px) scale(${s0})` });
        cu.el.append(fly);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          fly.style.transform = `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(${s1})`;
        }));
        later(() => fly.remove(), 600);
      }

      // 펼친 CD에서 하나를 고르면 라디오 CD 창으로 날아 들어간 뒤 재생 단추가 눌린다. 날아가는 동안 제자리는 빈자리로 둔다
      function choose(m, item) {
        settle();
        if (!reduceMotion) {
          flyDisc(m, item.querySelector('.cd'), true);
          item.classList.add('in');
        }
        later(() => {
          current = m;
          render();
          playKey.classList.add('pressed');
          later(() => { playKey.classList.remove('pressed'); play(m); }, 320);
        }, 560);
      }

      // 꺼내기: 음악을 멈추고 든 CD를 넣을 때와 거꾸로 제자리로 날려 보낸다. 제자리는 CD가 닿을 때까지 빈자리로 둔다
      function eject() {
        if (!current) return; // 빈 라디오는 꺼낼 것이 없다
        settle();
        const m = current;
        current = null;
        player?.win.close(); // 음악 창이 닫히면 onPlayerGone이 CD 창과 LCD를 비우고 라디오를 가운데로 돌린다
        os.wm.blur(); // 음악 창 다음의 창이 키를 가져가지 않게 한다(Esc는 라디오 내려놓기)
        render();
        const spot = [...fan.children].find(el => el.dataset.link === m.link);
        if (!spot || reduceMotion) return;
        flyDisc(m, spot.querySelector('.cd'), false);
        spot.classList.add('in');
        later(() => spot.classList.remove('in'), 560);
      }

      function play(m) {
        current = m;
        openPlayer(os, app, m);
        os.wm.blur(); // 음악 창이 키를 가져가지 않게 한다. 라디오를 보는 동안 Esc는 라디오 내려놓기다(음악 창을 누르면 그 창이 앞으로 온다)
        showSlot();
      }

      // 주인이 CD를 넣거나, 라디오에 든 CD(old)의 이름과 색을 고친다. 고칠 때는 주소를 바꾸지 않는다
      function form(old = null) {
        const list = cds();
        let color = old ? old.color : freeColor(list);
        let waiting = false;
        const url = h('input', { type: 'text', inputMode: 'url', placeholder: 'https://open.spotify.com/album/...' });
        url.spellcheck = false; // h()는 false 값을 건너뛰므로 따로 끈다
        const name = h('input', { type: 'text', maxLength: LIMIT.cdName, value: old?.name || '', placeholder: `${LIMIT.cdName}자까지` });
        const error = h('p', { className: 'like-error', hidden: true });
        const fail = (msg, field) => { error.textContent = msg; error.hidden = false; field.focus(); };

        // 서비스에서 받은 이름을 이름 칸에 채운다. 주인이 이름을 고쳐 쓴 뒤에는 채우지 않고, 그사이 주소가 바뀌었으면 버린다
        let filled = name.value;
        const fill = m => loadMeta(m).then(info => {
          const title = line(info?.title, LIMIT.cdName);
          if (title && name.value === filled && (old || parseMusic(url.value)?.link === m.link)) name.value = filled = title;
        });
        url.addEventListener('input', () => { const m = parseMusic(url.value); if (m) fill(m); });
        if (old && !old.name) fill(old); // 이름 칸이 생기기 전에 넣은 CD

        const swatches = CD_COLORS.map((title, i) => h('button', {
          type: 'button', className: 'cd-swatch', title, 'aria-label': `${title} CD`, dataset: { color: i }, onclick: () => pick(i),
        }));
        const pick = i => {
          color = i;
          swatches.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
        };
        pick(color);

        const submit = async e => {
          e.preventDefault();
          if (waiting) return;
          const m = old || parseMusic(url.value);
          if (!m) return fail('스포티파이나 애플 뮤직의 앨범, 플레이리스트 주소가 아닙니다. 공유 링크를 다시 복사해 넣어 주세요.', url);
          if (!old && list.some(c => c.link === m.link)) return fail('이미 넣은 CD입니다.', url);
          if (!name.value.trim()) {
            // 주소를 붙여 넣자마자 넣기를 누르면 이름을 받기 전이다. 받아 올 수 있는 CD면 3초까지 기다려 받은 이름을 쓴다
            waiting = true;
            await Promise.race([fill(m), new Promise(r => setTimeout(r, 3000))]);
            waiting = false;
            if (!card.isConnected) return; // 기다리는 동안 칸이나 라디오를 닫았다
            if (!name.value.trim()) return fail('CD 이름이 비어 있습니다. 이름을 넣어 주세요.', name);
          }
          const cd = { ...m, name: name.value, color };
          setLike(os, 'radio', (old ? list.map(c => (c.link === old.link ? cd : c)) : [...list, cd]).map(saved));
          render(); // 넣은 CD는 펼친 줄 끝에 선다. 골라야 라디오에 들어간다
        };
        const card = h('form', { className: 'like-form like-card', onsubmit: submit },
          h('p', { className: 'like-card-head' }, old ? 'CD 고치기' : 'CD 넣기'),
          old ? null : h('p', {}, '스포티파이나 애플 뮤직에서 앨범이나 플레이리스트의 공유 링크를 복사해 넣어 주세요.'),
          old ? null : h('label', { className: 'like-field' }, h('span', {}, '주소'), url),
          h('label', { className: 'like-field' }, h('span', {}, '이름'), name),
          h('div', { className: 'like-field' }, h('span', {}, '색'), h('div', { className: 'cd-swatches', role: 'group', 'aria-label': 'CD 색' }, ...swatches)),
          error,
          h('div', { className: 'link-row' },
            h('button', { className: 'btn', type: 'submit' }, old ? '고치기' : '넣기'),
            h('button', { className: 'btn', type: 'button', onclick: () => (cds().length ? render() : cu.close()) }, '취소')));
        panel.replaceChildren(card);
        setTimeout(() => (old ? name : url).focus(), 50);
      }

      function remove() {
        const left = cds().filter(m => m.link !== current.link);
        if (player?.m.link === current.link) player.win.close();
        setLike(os, 'radio', left.length ? left.map(saved) : null);
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
