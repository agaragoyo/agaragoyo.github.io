// 눌러 보기 점검(스모크 테스트). 코드를 고친 뒤 사이트의 주요 흐름이 그대로 도는지 사람 손 대신 기계로 눌러 본다.
//
//   node tools/smoke.mjs          이 폴더의 사이트를 빈 포트에 띄워 눌러 본다(1분 남짓 걸린다)
//   node tools/smoke.mjs --all    통과한 항목도 모두 보여 준다
//
// 필요한 것: Node 22 이상(전역 WebSocket), 크롬이나 엣지, 파이썬(tools/serve.py). npm 패키지는 쓰지 않는다.
// 서버와 크롬을 띄우는 부분은 tools/headless.mjs에 있고 tools/night-contrast.mjs와 같이 쓴다.
//
// 하는 일: 화면 없는 크롬으로 전원, 새 사용자 만들기(사진 고르기, 그림 파일 찾아보기), 튜토리얼 건너뛰기를 지나고, 가구와 담아 둔 것이 있는 점검용 집(tools/headless.mjs의 TEST_HOME)을
// 내 집으로 심어 다시 들어간다. 그 뒤 아이콘과 창 제목 줄과 가구의 두 번 누르기, 아바타의 키, 현관문, 자리마다의 오른쪽 단추 메뉴(손님 화면 포함), 기본 앱 창, 시작 메뉴의 사진 바꾸기(내 그림)와 이름 바꾸기,
// 미니게임 창, 창이 뒤로 갈 때 소리 끄기, 말풍선 암호 분신사바의 공포 모드와 스탠드로 풀기, 말풍선 암호 999999999로 부르는 비둘기 떼(현관문과 창문, 서로 띄워 앉기, 차례로 우는 구구, 다가가면 모두 날아가기, 움직임 줄이기),
// 내 방의 펫(펫 창의 상태와 단추, 종류와 색 고르기, 쓰다듬기와 그때 부르는 종류마다의 소리 파일, 병아리가 닭으로 자라기, 오른쪽 단추 메뉴의 따라오기와 기다리기, 명령을 듣지 않는 고양이),
// 가구 가까이 보기(TV의 소문 띠 포함), 방 꾸미기의 끌기와 돌리기, 연습 방에서 튜토리얼을 첫 단계부터 끝까지 하기(말하기 단계를 아바타 누르기와 Enter로 열어 보고, 그때 말한 암호가 숨은 기능을 열지 않는지 포함),
// 아바타 머리 위의 말하기 표시(튜토리얼 카드가 떠 있을 때는 숨고, 처음 말하기 전까지 내 집과 손님 화면에 뜨는지), 손님으로 들어가기(예전 긴 링크, 링크에 담긴 주인 사진),
// 이웃집(서버에서 받는 link 이웃집, 현관문으로 여는 목록 창에서 놀러 가기, 그 집의 코르크 보드에 쪽지 남기기, 이 브라우저가 올린 방은 이웃집 칸에서 빠지는 것, 복사본으로 고정한 이웃집과 그 방을 올린 브라우저에서 초기화와 링크 지우기가 막히는 것),
// 보여 줄 이웃이 없거나 서버에 닿지 못할 때의 목록 창,
// 깨진 링크와 HTML이 든 링크, 짧은 링크(#s=)의 방, 칸마다 한도까지 가장 나쁜 글로 채운 집(LONG)의 주인 화면과 손님 화면,
// 이 컴퓨터 초기화의 지우기를 차례로 본다.
// 화면을 바꿀 때마다 되풀이된 함정 세 가지도 같이 잰다: hidden인데 보이는 요소(known-issues 10, 13), 창 안에서 가로로 넘친 상자,
// 상자 밖으로 나가거나 말없이 잘린 글(83).
// 서버(Firebase)와 다른 사이트에는 요청을 보내지 않는다. 짧은 링크의 방, 공유하기 창의 링크 만들기와 지우기, link 이웃집의 방은 페이지 안의 fetch를 바꿔 껴서
// 서버 대신 답하고(fakeCloud), 유튜브 CD의 이름과 재생할 수 있는지도 같은 방법으로 대신 답한다(fakeYouTube).
// 그래도 새는 요청이 없게 Firebase 주소와 유튜브 플레이어, API 스크립트는 크롬이 받지 않게 막는다(main의 BLOCKED).
// 유튜브 재생목록 CD의 이전 곡, 다음 곡 단추는 유튜브 API(window.YT)를 페이지 안의 가짜로 바꿔 끼워(fakePlayer) 단추가 언제 쉬고 켜지는지와 보내는 명령을 본다.
// 그 밖에는 짧은 링크가 없는 집과 CD가 없는 라디오로 본다.
// 눈으로 봐야 하는 것(그림의 모양, 색, 소리)은 보지 않는다. 소리는 배경음악이 꺼지고 켜지는지와 펫과 비둘기가 부르는 소리 파일의 이름만 본다. 밤 모드의 글자 대비는 tools/night-contrast.mjs가 잰다.
// 새 창이나 가구 화면을 만들면 main의 해당 자리에 한 줄을 더한다.
// 종료 코드: 0 통과, 1 실패가 있음, 2 도구를 돌리지 못함(크롬이나 파이썬이 없음 등).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sleep, startServer, launchChrome, runTool, TEST_HOME as HOME, plantHome } from './headless.mjs';

const SHOW_ALL = process.argv.includes('--all');
// 그림 파일 찾아보기(내 그림, src/custom-picture.js)에 넣는 파일. 레포의 가구 그림(투명한 바탕의 PNG)과 그림이 아닌 파일이다
const TEST_IMAGE = fileURLToPath(new URL('../assets/furniture/radio.png', import.meta.url));
const NOT_IMAGE = fileURLToPath(new URL('../README.md', import.meta.url));

// 손님 화면에서 스크립트가 돌지 않는지 볼 집. 이름과 글에 HTML을, 주소에 javascript:를 넣는다
const EVIL = {
  owner: '<img src=x>',
  scenes: { room: [{ id: 'bookshelf', x: 2, y: 2 }, { id: 'desk', x: 5, y: 2 }, { id: 'radio', x: 5, y: 2 }] },
  likes: {
    bookshelf: [{ title: '<b>굵게</b><script>window.__xss=1</script>', note: '<img src=x onerror="window.__xss=1">' }],
    computer: { url: 'javascript:alert(1)' },
    // 애플 뮤직 플레이리스트는 이름과 표지를 받으러 가지 않아 서버에 묻지 않는다. 유튜브 CD는 음악 창을 띄워 보기만 한다(재생은 보지 않는다)
    radio: [{ url: 'https://music.apple.com/kr/playlist/x/pl.u-abcdefgh', name: '<img src=x onerror=window.__xss=1>', color: 2 }, { url: 'https://youtu.be/96URE_-aj-8', name: '유튜브 CD', color: 1 }],
  },
  greeting: '<i>안녕</i>',
};

// 긴 글 점검(known-issues 83)에 쓰는 가장 나쁜 글. 띄어쓰기 없는 한글, 짧은 낱말 뒤의 긴 낱말(띄어쓰기에서만 줄을 바꾸면 줄 수가 늘어난다),
// 넓은 영문 대문자(W는 한글의 0.83배), 이모지(한글의 1.4배), 영문과 숫자 섞음, 줄바꿈만 있는 글이다.
// 모든 칸의 한도보다 길게(200자) 만들고, 집을 심거나 링크로 만들 때 검사(sanitizeHome)가 칸마다 한도까지 자른다. 한도가 바뀌어도 늘 꽉 찬 글이 된다
const fill = (chars, n = 200) => Array.from({ length: n }, (_, i) => chars[i % chars.length]).join('');
const WORST = {
  ko: fill([...'가나다라마바사아자차카타파하']),
  words: `가나다라 ${fill([...'마바사아자차카타파하거너더러머버서어저'])}`,
  wide: fill(['W']),
  emoji: fill(['🎮']),
  mixed: fill([...'AB12가나']),
  lines: fill(['가', '\n']),
};
const KINDS = Object.keys(WORST);
const LONG_LINK = `https://${'a'.repeat(63)}.${'b'.repeat(50)}.example.com/`; // 열리는 곳에 띄어쓰기 없이 길게 나오는 주소
// 책은 다섯 권까지 들어가 줄바꿈 글(lines)은 둘째 책의 남긴 말에 넣는다. CD는 이름과 표지를 받으러 가지 않는 애플 뮤직 플레이리스트다
const LONG = {
  owner: WORST.emoji,
  greeting: WORST.ko,
  scenes: HOME.scenes,
  likes: {
    computer: { url: LONG_LINK, name: WORST.emoji },
    console: 'file-ten',
    bookshelf: KINDS.map((k, i) => ({ title: WORST[k], author: WORST[k], note: WORST[i === 1 ? 'lines' : k], color: i })),
    tv: KINDS.map((k, i) => ({ title: WORST[k], year: WORST[k], by: WORST[k], why: WORST[k], link: LONG_LINK, color: i })),
    radio: KINDS.map((k, i) => ({ url: `https://music.apple.com/kr/playlist/x/pl.u-longtext${i}`, name: WORST[k], color: i })),
  },
};
// 코르크 보드에 붙은 쪽지(서버 대신 fakeCloud가 답한다). 닉네임과 글을 한도까지 채운다(쪽지 화면이 다시 자른다)
const LONG_NOTES = KINDS.map(k => ({ name: WORST[k], text: WORST[k] }));

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok });
  if (!ok) console.log(`실패 ${name}${detail ? `: ${detail}` : ''}`);
  else if (SHOW_ALL) console.log(`통과 ${name}`);
}

// ---------- 페이지 안에서 도는 함수(바깥 변수를 쓰지 않는다) ----------

// hidden 속성이 있는데 화면에 그려지는 요소. display를 준 규칙이 [hidden]을 이긴 것이다
function shownHidden() {
  return [...document.querySelectorAll('[hidden]')]
    .filter(el => getComputedStyle(el).display !== 'none')
    .map(el => `${el.tagName.toLowerCase()}.${String(el.className).replace(/\s+/g, '.')}`);
}

// 창, 가까이 보기, 시작 메뉴, 로그인 화면 안에서 안의 것이 가로로 넘친 상자(장식용 i는 뺀다).
// 픽셀 아이콘(.app-icon.pixel)은 한 칸을 화면 픽셀 정수 개로 맞추느라 상자보다 최대 1.4배까지 일부러 넘치므로 뺀다(src/icons.js의 fitPixelIcons)
function overflowing() {
  const out = [];
  // 펼친 CD(두 장부터)와 코르크 쪽지는 일부러 기울여 놓아서, 기운 네모의 모서리가 판 밖으로 조금 나온다(보이는 것은 그 안의 동그라미와 종이다).
  // 재는 동안만 기울기를 풀어 안의 것이 넘친 것만 센다
  const flat = document.head.appendChild(document.createElement('style'));
  flat.textContent = '.cd-pick, .cork-note { transform: none !important; transition: none !important; animation: none !important; }';
  for (const el of document.querySelectorAll('#windows .win-body, #windows .win-body *, .closeup *, #start-menu *, #login *')) {
    if (!(el instanceof HTMLElement) || !el.offsetParent || ['INPUT', 'TEXTAREA', 'I'].includes(el.tagName)) continue;
    if (el.matches('.app-icon.pixel')) continue;
    // 라디오에 든 CD는 음악이 나오는 동안 돈다(transform). 도는 네모가 상자 밖으로 조금 나오는데 보이는 것은 그 안의 동그라미뿐이고,
    // 재는 순간의 각도에 따라 넘침이 달라 점검이 들쭉날쭉해진다
    if (el.matches('.radio-fan, .radio-slot')) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && getComputedStyle(el).overflowX === 'visible') {
      out.push(`${el.tagName.toLowerCase()}.${String(el.className).replace(/\s+/g, '.')} ${el.scrollWidth}>${el.clientWidth} "${(el.textContent || '').trim().slice(0, 24)}"`);
    }
  }
  flat.remove();
  return [...new Set(out)].slice(0, 8);
}

// 글이 상자 밖으로 나가거나 말없이 잘린 곳(known-issues 83). 글 조각마다 그 글을 자르는 가장 가까운 조상(overflow가 visible이 아닌 상자, 무대 포함)을 찾는다.
// 크기가 정해진 자리에서 말줄임표(text-overflow, -webkit-line-clamp)로 끝난 글은 그 글이나 조상의 title에 전체 글이 있어야 하고,
// 스크롤되는 칸에서 가려진 글은 스크롤하면 보이므로 괜찮다. 기울인 CD와 쪽지는 재는 동안만 기울기를 푼다(overflowing과 같다)
function cutText(scope = '#windows .win, .closeup, #start-menu, #login, #toast') {
  const flat = document.head.appendChild(document.createElement('style'));
  flat.textContent = '.cd-pick, .cork-note { transform: none !important; transition: none !important; animation: none !important; }';
  const out = new Set();
  const name = el => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().replace(/\s+/g, '.')}` : ''}`;
  const stage = document.getElementById('stage');
  const k = stage.getBoundingClientRect().width / stage.offsetWidth; // 무대 배율
  for (const root of document.querySelectorAll(scope)) {
    if (!root.getClientRects().length) continue;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.data.trim();
      const el = n.parentElement;
      if (!text || !el.getClientRects().length || el.closest('svg, option, textarea, script, style') || getComputedStyle(el).visibility === 'hidden') continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter(r => r.width > 0.5 && r.height > 0.5);
      if (!rects.length) continue;
      const box = { l: Math.min(...rects.map(r => r.left)), r: Math.max(...rects.map(r => r.right)), t: Math.min(...rects.map(r => r.top)), b: Math.max(...rects.map(r => r.bottom)) };
      // 글자 상자(갈무리는 글자 크기의 1.4배)가 줄 높이보다 크면 위아래로 그 반씩 줄 밖에 걸친다. 글자가 잘린 것이 아니라서 그만큼 봐준다
      const slack = Math.max(1, (rects[0].height - (parseFloat(getComputedStyle(el).lineHeight) * k || rects[0].height)) / 2 + 1);
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        if (a.matches('.shelf-track')) break; // 가구 선반은 화살표로 넘기는 줄이라 가려진 가구는 넘기면 보인다
        // 무대는 transform으로 늘이고 줄이므로 화면의 상자에서 테두리 두께만 그 배율로 덜어 낸다
        const b = a.getBoundingClientRect();
        const sx = a.offsetWidth ? b.width / a.offsetWidth : 1;
        const sy = a.offsetHeight ? b.height / a.offsetHeight : 1;
        const left = b.left + a.clientLeft * sx;
        const top = b.top + a.clientTop * sy;
        const right = b.right - (a.offsetWidth - a.clientWidth - a.clientLeft) * sx;
        const bottom = b.bottom - (a.offsetHeight - a.clientHeight - a.clientTop) * sy;
        const x = box.l < left - 1 || box.r > right + 1;
        const y = box.t < top - slack || box.b > bottom + slack;
        if (!x && !y) continue;
        if ((x && /auto|scroll/.test(s.overflowX)) || (y && /auto|scroll/.test(s.overflowY))) break;
        let titled = false;
        for (let t = el; t && !titled; t = t.parentElement) titled = (t.getAttribute('title') || '').includes(text);
        const short = text.slice(0, 12).replace(/\s+/g, ' ');
        if (s.textOverflow !== 'ellipsis' && s.webkitLineClamp === 'none') out.add(`${name(el)}의 글이 ${name(a)}에서 잘림 "${short}"`);
        else if (!titled) out.add(`${name(el)}의 글이 말줄임표로 끝나는데 전체를 볼 title이 없음 "${short}"`);
        break;
      }
    }
  }
  flat.remove();
  return [...out].slice(0, 8);
}

// 집을 링크 글자로 바꾼다. 예전 긴 링크(#r=)의 뒤이고, 짧은 링크의 서버에도 같은 글자가 들어간다
async function linkOf(home, owner) {
  const { sanitizeHome, encodeHome } = await import(new URL('src/share.js', document.baseURI).href);
  return encodeHome(sanitizeHome({ ...home, owner: owner || home.owner }));
}

// 서버(Firebase)로 가는 요청을 페이지 안에서 가로채 서버 대신 답한다. 서버에는 요청이 나가지 않는다.
// rooms: 방 번호마다 방 글자. 목록에 없는 방은 그런 방이 없다는 404로 답한다
// how: hold(방 읽기를 window.__cloudAnswer()를 부를 때까지 기다렸다가 답한다), serve(바로 답한다), missing(모든 방이 404), offline(연결 실패),
//   write(serve에 더해 익명 로그인, 방 올리기, 쪽지 찾기, 방 지우기에도 답한다. 올린 방 글자는 window.__cloudSent에 차례로 남긴다)
// 방마다 읽은 횟수는 window.__cloudCalls[번호]에 센다. 쪽지를 찾은 방 번호는 window.__noteBoards에 차례로 남긴다. 페이지를 새로 열면 풀리므로 열 때마다 다시 낀다.
// notes: 코르크 보드의 쪽지 찾기에 답할 쪽지들({ name, text }). 하루씩 앞서 붙인 것으로, 색은 차례로 돌린다
// handles: 아이디마다 { uid, room }(src/cloud.js의 "아이디"). 읽기는 serve와 hold에도 답하고, 만들기와 지우기는 write에만 답한다.
//   이미 있는 아이디를 다시 만들면 서버처럼 거절한다. 지금 아이디들은 window.__handles, 아이디마다 읽은 횟수는 window.__handleCalls에 있다
function fakeCloud(how, rooms = {}, notes = [], handles = {}) {
  const real = window.fetch;
  const held = [];
  window.__cloudCalls = {};
  window.__cloudSent = [];
  window.__noteBoards = [];
  window.__handles = handles;
  window.__handleCalls = {};
  window.__cloudAnswer = () => held.splice(0).forEach(done => done());
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
  window.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.includes('googleapis.com')) return real(url, opts);
    if (how === 'offline') throw new TypeError('Failed to fetch');
    const write = how === 'write';
    if (u.includes('accounts:signUp')) return write ? reply({ idToken: 'fake-token', localId: 'fake-uid', refreshToken: 'fake-refresh', expiresIn: '3600' }) : reply({}, 403);
    if (u.includes('securetoken.googleapis.com')) return write ? reply({ id_token: 'fake-token', user_id: 'fake-uid', refresh_token: 'fake-refresh', expires_in: '3600' }) : reply({}, 403);
    if (u.includes(':runQuery')) {
      window.__noteBoards.push((u.match(/\/homes\/([0-9A-Za-z]+):runQuery/) || [])[1]);
      return reply(notes.map((n, i) => ({ document: { name: `notes/smoke${i}`, fields: {
        uid: { stringValue: 'smoke-guest' }, name: { stringValue: n.name }, text: { stringValue: n.text },
        color: { integerValue: String(i % 4) }, createdAt: { timestampValue: new Date(Date.now() - i * 864e5).toISOString() },
      } } })));
    }
    if (u.includes(':commit')) {
      if (!write) return reply({}, 403);
      for (const w of JSON.parse(opts.body).writes) {
        const handle = (w.update?.name?.match(/\/handles\/(.+)$/) || [])[1];
        if (handle) {
          if (w.currentDocument?.exists === false && handle in handles) return reply({}, 409);
          handles[handle] = { uid: w.update.fields.uid.stringValue, room: w.update.fields.room.stringValue };
          continue;
        }
        const code = w.update?.fields?.code?.stringValue;
        if (code) {
          window.__cloudSent.push(code);
          rooms[w.update.name.split('/').pop()] = code;
        }
      }
      return reply({});
    }
    const handle = (u.match(/\/handles\/([^?/:]+)/) || [])[1];
    if (handle) {
      const key = decodeURIComponent(handle);
      if ((opts.method || 'GET') === 'DELETE') {
        if (!write) return reply({}, 403);
        delete handles[key];
        return reply({});
      }
      window.__handleCalls[key] = (window.__handleCalls[key] || 0) + 1;
      const doc = handles[key];
      return doc ? reply({ fields: { uid: { stringValue: doc.uid }, room: { stringValue: doc.room } } }) : reply({}, 404);
    }
    const id = (u.match(/\/homes\/([0-9A-Za-z]+)/) || [])[1];
    if ((opts.method || 'GET') === 'DELETE') {
      if (!write) return reply({}, 403);
      delete rooms[id];
      return reply({});
    }
    window.__cloudCalls[id] = (window.__cloudCalls[id] || 0) + 1;
    if (how === 'hold') await new Promise(done => held.push(done));
    if (how === 'missing' || !(id in rooms)) return reply({}, 404);
    return reply({ fields: { code: { stringValue: rooms[id] } } });
  };
  return true;
}

// data/neighbors.js를 받을 때 목록 맨 앞에 row(이웃집 한 줄)를 더해 준다. 레포의 목록에 link 줄이 없어도 link 이웃집을 볼 수 있다.
// only를 켜면 레포의 줄을 모두 빼고 row만 둔다(빈 배열이면 이웃집이 없는 목록). row 자리에 null을 넣으면 가로채기를 푼다. 바꾼 목록은 다음에 여는 페이지부터 쓰인다
async function extraNeighbor(page, row, { only = false } = {}) {
  if (!row) {
    page.on('Fetch.requestPaused', null);
    return page.send('Fetch.disable');
  }
  const rows = [].concat(row).map(r => `\n  ${JSON.stringify(r)},`).join(''); // 여러 집을 한꺼번에 더할 때는 배열로 넘긴다
  const source = fs.readFileSync(new URL('../data/neighbors.js', import.meta.url), 'utf8');
  const text = only
    ? source.replace(/export const NEIGHBORS = \[[\s\S]*?\r?\n\];/, `export const NEIGHBORS = [${rows}\n];`)
    : source.replace('export const NEIGHBORS = [', `export const NEIGHBORS = [${rows}`);
  if (text === source) throw new Error('data/neighbors.js에서 NEIGHBORS 목록을 찾지 못했다');
  page.on('Fetch.requestPaused', ({ requestId }) => page.send('Fetch.fulfillRequest', {
    requestId,
    responseCode: 200,
    responseHeaders: [{ name: 'Content-Type', value: 'text/javascript; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }],
    body: Buffer.from(text).toString('base64'),
  }).catch(() => {}));
  return page.send('Fetch.enable', { patterns: [{ urlPattern: '*/data/neighbors.js*', requestStage: 'Request' }] });
}

// 유튜브 oEmbed 대신 페이지 안에서 답한다. 없는 영상(id가 aaaaaaaaaaa)은 유튜브처럼 400으로, 비공개 재생목록(목록 번호에 Private가 든 것)은 404로,
// 다른 사이트에서 재생을 막은 것(Blocked가 든 것)은 401로, 비공개로 보이는 재생목록(Forbidden이 든 것)은 403으로,
// 다른 영상은 이름을 담아 답한다. 물어 온 횟수를 주소마다 센다(window.__oembed). 스포티파이 oEmbed도 같은 방법으로 이름만 담아 답한다.
// 재생목록 곡(곡 id가 smokeTrk에 세 글자를 붙인 11자)은 30ms 늦게 이름("점검용 곡 <세 글자>")을 담아 답하고, 그동안 기다리는 요청의 수와 가장 많았던 수를 센다
// (window.__oembedLive, __oembedMax. 한꺼번에 묻는 수를 제한하는지 본다). 끝이 Blk면 401, Gon이면 404, Err이면 500으로 답하고(Err은 이름이 아니라 못 받은 것이라 받아 두지 않는다),
// Lng이면 한 줄에 다 들어가지 않는 긴 이름("아주 긴 곡 이름 "을 여덟 번 이은 72자)으로 답한다
function fakeYouTube() {
  const real = window.fetch;
  window.__oembed = {};
  window.__oembedLive = 0;
  window.__oembedMax = 0;
  window.fetch = async (url, opts) => {
    if (String(url).startsWith('https://open.spotify.com/oembed')) return new Response(JSON.stringify({ title: '점검용 스포티파이 앨범' }));
    if (!String(url).startsWith('https://www.youtube.com/oembed')) return real(url, opts);
    const asked = decodeURIComponent(String(url).split('url=')[1]);
    window.__oembed[asked] = (window.__oembed[asked] || 0) + 1;
    const track = /[?&]v=smokeTrk(\w{3})$/.exec(asked);
    if (track) {
      window.__oembedMax = Math.max(window.__oembedMax, ++window.__oembedLive);
      await new Promise(r => setTimeout(r, 30));
      window.__oembedLive--;
      if (track[1] === 'Blk') return new Response('Unauthorized', { status: 401 });
      if (track[1] === 'Gon') return new Response('Not Found', { status: 404 });
      if (track[1] === 'Err') return new Response('Server Error', { status: 500 });
      if (track[1] === 'Lng') return new Response(JSON.stringify({ title: '아주 긴 곡 이름 '.repeat(8).trim() }));
      return new Response(JSON.stringify({ title: `점검용 곡 ${track[1]}` }));
    }
    if (asked.includes('aaaaaaaaaaa')) return new Response('Bad Request', { status: 400 });
    if (asked.includes('Private')) return new Response('Not Found', { status: 404 });
    if (asked.includes('Blocked')) return new Response('Unauthorized', { status: 401 });
    if (asked.includes('Forbidden')) return new Response('Forbidden', { status: 403 });
    return new Response(JSON.stringify({ title: '점검용 유튜브 노래', thumbnail_url: 'https://i.ytimg.com/vi/x/hqdefault.jpg' }));
  };
  return true;
}
// 라디오 넣는 칸에 주소를 넣고 넣기를 누른다
function putYouTube(url) {
  document.querySelector('.closeup form input').value = url;
  document.querySelector('.closeup form').requestSubmit();
}
// 유튜브 IFrame Player API(window.YT)를 페이지 안의 가짜로 바꿔 끼운다. 앱이 만든 플레이어는 window.__yt에 차례로 쌓이고,
// 점검이 ready()로 플레이어가 준비된 때를, fail(번호)로 오류를 알리는 때를, state(번호)로 재생 상태가 바뀐 때를 정한다.
// 명령은 calls에 이름이 남고(playVideoAt은 `playVideoAt:번호`), 떼어진(destroy) 플레이어는 진짜처럼 명령 함수가 없어진다.
// 재생목록은 setList(곡 id들, 지금 번호)로 정한다. 정하지 않으면 영상 하나처럼 getPlaylist가 null이다.
// 곡을 넘기는 명령은 진짜처럼 번호를 옮기고 상태(3, 버퍼링)를 알린다. 첫 곡의 이전 곡과 마지막 곡의 다음 곡은 그 곡에 머문다(2026-11-15 진짜 유튜브에서 본 것)
function fakePlayer() {
  window.__yt = [];
  window.YT = {
    Player: class {
      constructor(frame, opts) {
        this.frame = frame;
        this.events = opts.events;
        this.calls = [];
        this.ids = null;
        this.index = -1;
        window.__yt.push(this);
      }
      ready() { this.events.onReady(); }
      fail(code) { this.events.onError({ data: code }); }
      state(code) { this.events.onStateChange({ data: code }); }
      setList(ids, index = 0) { this.ids = ids; this.index = index; }
      go(to) { if (this.ids) { this.index = Math.max(0, Math.min(this.ids.length - 1, to)); this.state(3); } }
      getPlaylist() { return this.ids && [...this.ids]; }
      getPlaylistIndex() { return this.index; }
      playVideoAt(i) { this.calls.push(`playVideoAt:${i}`); this.go(i); }
      previousVideo() { this.calls.push('previousVideo'); this.go(this.index - 1); }
      nextVideo() { this.calls.push('nextVideo'); this.go(this.index + 1); }
      mute() { this.calls.push('mute'); }
      unMute() { this.calls.push('unMute'); }
      destroy() { this.getPlaylist = this.getPlaylistIndex = this.playVideoAt = this.previousVideo = this.nextVideo = this.mute = this.unMute = undefined; }
    },
  };
  return true;
}
// 음악 창의 곡 넘기기 단추 줄: 보이는지, 단추 글자와 쉬는 모양, 플레이어와의 자리(겹치지 않는지, 200px 이상인지), 창 높이
function skipState() {
  const row = document.querySelector('#windows .radio-player-skips');
  const frame = document.querySelector('#windows .radio-player iframe');
  const win = document.querySelector('#windows .radio-player')?.closest('.win');
  if (!row || !frame || !win) return null;
  const buttons = [...row.querySelectorAll('button')];
  const f = frame.getBoundingClientRect();
  const r = row.getBoundingClientRect();
  const w = win.getBoundingClientRect();
  const shown = getComputedStyle(row).display !== 'none';
  // 창 바탕(.flush)은 넘친 것을 잘라서(overflow: hidden) 창 높이가 모자라면 맨 아래 안내 줄이 말없이 사라진다
  const body = win.querySelector('.win-body');
  const note = body.querySelector('.radio-player-note');
  return {
    shown,
    noteFits: note.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom + 1,
    texts: buttons.map(b => b.textContent.trim()),
    titles: buttons.map(b => b.title),
    disabled: buttons.map(b => b.disabled),
    frameW: frame.offsetWidth,
    frameH: frame.offsetHeight,
    below: shown && r.top >= f.bottom - 1,
    inside: shown && buttons.every(b => { const x = b.getBoundingClientRect(); return x.left >= w.left && x.right <= w.right && x.bottom <= w.bottom; }),
    rowH: row.offsetHeight,
    winH: win.offsetHeight,
    note: document.querySelector('#windows .radio-player-note').textContent,
  };
}
// 음악 창의 이전 곡, 다음 곡 이름 줄과 곡 목록 창(src/apps/radio-tracks.js)의 모습.
// names는 줄마다 "이전: 이름" 꼴이고, nameCut은 이름이 줄임표로 잘렸는지(넘치는데 줄이 늘지 않고 한 줄에 머무는지)다.
// 목록 창은 음악 창 아래(below)에 왼쪽 끝을 맞춰 바탕화면 안(inDesk: 아래 끝이 800px 안)에 든다. now는 지금 곡으로 표시된 줄의 번호(없으면 -1),
// titled는 이름이 들어온 줄 수, seen은 지금 스크롤 칸 안에 보이는 줄 수, nowShown은 지금 곡의 줄이 스크롤 칸 안에 완전히 보이는지다
function trackState() {
  const box = document.querySelector('#windows .radio-player-tracks');
  const btn = document.querySelector('#windows .radio-list-btn');
  const lines = box ? [...box.querySelectorAll('.radio-track-line')] : [];
  const nameOf = p => p.querySelector('.radio-track-name');
  const panel = document.querySelector('#windows .radio-tracks');
  const win = panel?.closest('.win');
  const music = document.querySelector('#windows .radio-player')?.closest('.win');
  const list = panel?.querySelector('.radio-tracks-list');
  const rows = panel ? [...panel.querySelectorAll('.radio-track')] : [];
  const m = music?.getBoundingClientRect();
  const w = win?.getBoundingClientRect();
  const now = rows.findIndex(r => r.getAttribute('aria-current') === 'true');
  const inView = r => !!r && !!list && r.offsetTop >= list.scrollTop && r.offsetTop + r.offsetHeight <= list.scrollTop + list.clientHeight;
  return {
    shown: !!box && getComputedStyle(box).display !== 'none',
    namesH: box?.offsetHeight ?? 0,
    names: lines.map(p => `${p.querySelector('.radio-track-tag').textContent} ${nameOf(p).textContent}`),
    lineH: lines.map(p => p.offsetHeight),
    dim: lines.map(p => nameOf(p).classList.contains('dim')),
    nameCut: lines.map(p => nameOf(p).scrollWidth > nameOf(p).clientWidth),
    lineTitle: lines.map(p => p.title),
    btn: btn ? { text: btn.textContent.trim(), title: btn.title, off: btn.disabled } : null,
    open: !!panel,
    windows: document.querySelectorAll('#windows .radio-tracks').length,
    winTitle: win?.querySelector('.win-title').textContent,
    cd: panel?.querySelector('.radio-tracks-cd').textContent,
    pos: panel?.querySelector('.radio-tracks-pos').textContent,
    rows: rows.length,
    rowH: rows.map(r => r.offsetHeight),
    now,
    nowShown: inView(rows[now]),
    titled: rows.filter(r => !r.lastElementChild.classList.contains('dim')).length,
    rowNames: rows.map(r => r.lastElementChild.textContent),
    seen: rows.filter(inView).length,
    scrolls: list ? list.scrollHeight > list.clientHeight + 1 : false,
    scrollTop: list?.scrollTop ?? 0,
    note: panel?.querySelector('.radio-tracks-note')?.textContent,
    noteH: panel?.querySelector('.radio-tracks-note')?.offsetHeight ?? 0,
    below: m && w ? w.top >= m.bottom - 1 : null,
    sameLeft: m && w ? Math.abs(w.left - m.left) < 1 : null,
    beside: m && w ? w.right <= m.left + 1 : null,
    inDesk: win ? win.offsetTop >= 0 && win.offsetTop + win.offsetHeight <= 800 && win.offsetLeft >= 0 && win.offsetLeft + win.offsetWidth <= 1280 : null,
    winH: win?.offsetHeight ?? 0,
  };
}
// 넣는 칸의 안내가 이 글(문장 둘이 줄을 나눠 뜨는 안내)이고, 문장마다 한 줄에 들어가는지(어색하게 꺾이지 않는지)
function radioErrorShows(pattern) {
  const err = document.querySelector('.closeup .like-error');
  if (!err || err.hidden || !new RegExp(pattern).test(err.textContent)) return false;
  const lines = [...err.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
  return lines.length === 2 && lines.every(n => {
    const range = document.createRange();
    range.selectNodeContents(n);
    return range.getClientRects().length === 1;
  });
}

// 게임 폴더의 우리 게임(apps/ 아래)과 새 탭으로 여는 앱의 id
async function gameIds() {
  const { APPS } = await import(new URL('data/apps.js', document.baseURI).href);
  const games = APPS.filter(a => a.folder === 'games');
  return { own: games.filter(a => a.src?.startsWith('apps/')).map(a => a.id), link: games.find(a => a.href)?.id || null };
}

// 소리: 이 페이지에서 play()로 트는 소리를 모두 window.__audios에 적어 둔다(src/sound.js의 효과음과 배경음악). 페이지를 새로 열면 풀린다
function catchAudio() {
  window.__audios = new Set();
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { window.__audios.add(this); return play.call(this); };
  // 만든 Audio도 적어 둔다(누른 순간에 미리 만드는 펫 소리, src/sound.js의 prime)
  window.__made = [];
  const RealAudio = window.__RealAudio || (window.__RealAudio = window.Audio);
  window.Audio = function (src) { const a = new RealAudio(src); window.__made.push(a); return a; };
}
// 지금 흐르는 배경음악(되풀이해 트는 소리)이 want인가. 'on' 소리가 난다, 'muted' 곡은 흐르는데 소리만 꺼졌다, 'none' 흐르는 곡이 없다
function musicIs(want) {
  const a = [...(window.__audios || [])].find(x => x.loop && !x.paused);
  return want === 'none' ? !a : !!a && a.muted === (want === 'muted');
}
const effectCount = () => [...(window.__audios || [])].filter(a => !a.loop).length;
async function playEffect(name) {
  (await import(new URL('src/sound.js', document.baseURI).href)).play(name);
}
// 펫 소리(assets/sounds/pet-*.mp3, 쓰다듬기와 놀란 비둘기)를 낸 차례대로 이름만 돌려주고, 다음 확인을 위해 기록에서 지운다.
// made는 그동안 만든 펫 소리다. 누른 순간에 만든 소리를 낼 때 다시 쓰면(prime) 낸 소리마다 하나씩만 만든다
function takePetSounds() {
  const isPet = a => /\/pet-[a-z]+\.mp3$/.test(a.src);
  const name = a => a.src.match(/\/(pet-[a-z]+)\.mp3$/)[1];
  const pets = [...(window.__audios || [])].filter(isPet);
  for (const a of pets) window.__audios.delete(a);
  const made = (window.__made || []).filter(isPet);
  window.__made = (window.__made || []).filter(a => !isPet(a));
  return { played: pets.map(name).join(), made: made.map(name).join() };
}
// 지금까지 만든 펫 소리(지우지 않는다). 쓰다듬기를 누른 직후, 아바타가 오기 전에 부른다
const petSoundsMade = () => (window.__made || []).filter(a => /\/pet-[a-z]+\.mp3$/.test(a.src)).map(a => a.src.match(/\/(pet-[a-z]+)\.mp3$/)[1]).join();
async function setSettings(patch) {
  (await import(new URL('src/settings.js', document.baseURI).href)).settings.set(patch);
}

// 튜토리얼에서 놓는 가구(data/furniture.js의 TUTORIAL_FURNITURE)와 그 이름
async function tutorialFurniture() {
  const { TUTORIAL_FURNITURE: t, BY_ID } = await import(new URL('data/furniture.js', document.baseURI).href);
  return { first: t.first, light: t.light, firstName: BY_ID[t.first].name, lightName: BY_ID[t.light].name };
}

// 튜토리얼 안내 카드가 떠 있고 글에 word가 들어 있는지. word가 비면 카드의 글을 돌려준다
function cardSays(word) {
  const card = document.querySelector('.coach-card');
  const text = card && !card.hidden ? card.querySelector('.coach-text').textContent.replace(/\s+/g, ' ') : '';
  return word ? text.includes(word) : text;
}

// 방 꾸미기 선반에서 가구 id의 카드가 보이면 그 가운데의 화면 좌표(선반 밖으로 넘어가 있으면 null)
function shelfCard(id) {
  const card = document.querySelector(`.room-app .card .furn[data-id="${id}"]`)?.closest('.card');
  if (!card || card.hidden) return null;
  const track = card.parentElement.getBoundingClientRect();
  const r = card.getBoundingClientRect();
  const x = r.left + r.width / 2;
  return x > track.left + 8 && x < track.right - 8 ? { x, y: r.top + r.height / 2 } : null;
}

// 방 꾸미기의 방 그림에서 가로 fx, 세로 fy 비율 자리의 화면 좌표(바닥 가운데는 0.5, 0.68쯤이다)
function roomPoint(fx, fy) {
  const r = document.querySelector('.room-app .room').getBoundingClientRect();
  return { x: r.left + r.width * fx, y: r.top + r.height * fy };
}

const savedHome = () => JSON.parse(localStorage.getItem('agarago.home.v3'));
const winCount = () => document.querySelectorAll('#windows .win').length;
const theme = () => document.getElementById('stage').dataset.theme;
const avatarSpot = () => { const a = document.querySelector('#wallpaper .room-avatar'); return a ? `${a.style.left},${a.style.top}` : null; };
// 내 아바타 머리 위의 말하기 표시(src/avatar.js의 cue). 보이지 않으면 '없음', 보이면 가운데가 아바타 가운데이고
// 아래 끝이 머리 꼭대기(그림 상자 위 끝에서 9px)보다 8px 위일 때 '머리 위'(무대 px, 1px까지 봐 준다). want를 주면 그 상태인지만 돌려준다
function sayCue(want = '') {
  const cue = document.querySelector('#wallpaper .say-cue');
  const a = document.querySelector('#wallpaper .room-avatar:not(.room-owner)');
  let state = '없음';
  if (cue && a && !cue.hidden && getComputedStyle(cue).visibility !== 'hidden') {
    const dx = parseFloat(cue.style.left) - (parseFloat(a.style.left) + a.offsetWidth / 2);
    const dy = parseFloat(cue.style.top) - (parseFloat(a.style.top) + 9 - 8);
    state = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 ? '머리 위' : `어긋남(${dx}, ${dy})`;
  }
  return want ? state === want : state;
}
// 튜토리얼의 테두리가 sel 요소를 두르고 있는지(테두리 상자와 그 요소의 상자가 1px 안에서 같은지)
function ringOn(sel) {
  const ring = document.querySelector('.coach-ring');
  const el = document.querySelector(sel);
  if (!ring || ring.hidden || !el) return false;
  const a = ring.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  return b.width > 0 && ['left', 'top', 'width', 'height'].every(k => Math.abs(a[k] - b[k]) <= 1);
}
// 내 아바타가 선 칸. 아바타 상자는 발끝(칸 가운데 tile(x + 0.5, y + 0.5))보다 32px 왼쪽, 100px 위다(petScene의 cellOf와 같은 풀이)
const myCell = () => {
  const a = document.querySelector('#wallpaper .room-avatar:not(.room-owner)');
  if (!a) return null;
  const s = (parseFloat(a.style.left) + 32 - 640) / 36;
  const t = (parseFloat(a.style.top) + 100 - 270) / 18 - 1;
  return { x: (s + t) / 2, y: (t - s) / 2 };
};
// 바탕화면 방의 주인 아바타(친구 집에서 방에 서 있는 주인)와 내 아바타. 옷은 data/avatars.js의 기본 옷 색(color)과 손님 옷 색(guestColor)으로 가린다
async function ownerScene() {
  const { AVATAR_BY_ID } = await import(new URL('data/avatars.js', document.baseURI).href);
  const { color, guestColor } = AVATAR_BY_ID.basic;
  const shirt = el => { const bg = decodeURIComponent(el?.style.backgroundImage || ''); return bg.includes(guestColor) ? '손님 옷' : bg.includes(color) ? '기본 옷' : '모르는 옷'; };
  const owner = document.querySelector('#wallpaper .room-owner');
  const tag = document.querySelector('#wallpaper .room-owner-name');
  return `${owner ? `주인 ${shirt(owner)} ${tag?.textContent ?? '이름표 없음'}` : '주인 없음'}, 나 ${shirt(document.querySelector('#wallpaper .room-avatar:not(.room-owner)'))}`;
}

// 내 아바타가 주인 아바타의 바로 옆 칸에 서 있는지. 한 칸 옆이면 그림이 가로로 36px(TW의 절반), 세로로 18px(TH의 절반) 떨어진다
function nextToOwner() {
  const at = el => [parseFloat(el.style.left), parseFloat(el.style.top)];
  const [ox, oy] = at(document.querySelector('#wallpaper .room-owner'));
  const [mx, my] = at(document.querySelector('#wallpaper .room-avatar:not(.room-owner)'));
  return Math.abs(mx - ox) === 36 && Math.abs(my - oy) === 18;
}

// 내 방의 펫(src/pet.js)과 내 아바타가 선 칸, 펫 칸이 비어 있던 바닥인지, 하트가 보이는지, 펫 그림의 폭(무대 px),
// 고른 펫('<종류>/<색>'), 지금 보이는 그림 장(앉기, 숨쉬기, 눈 감기, 걷기).
// 펫 상자의 자리는 발끝(칸 가운데)이고, 아바타 상자는 발끝보다 32px 왼쪽, 100px 위다. 칸 가운데는 tile(x + 0.5, y + 0.5)라 거꾸로 풀면 칸이 나온다
async function petScene() {
  const { blockedOf } = await import(new URL('src/avatar.js', document.baseURI).href);
  const cellOf = (left, top) => { const s = (left - 640) / 36, t = (top - 270) / 18 - 1; return { x: (s + t) / 2, y: (t - s) / 2 }; };
  const p = document.querySelector('#wallpaper .room-pet');
  const a = document.querySelector('#wallpaper .room-avatar');
  const heart = document.querySelector('#wallpaper .room-pet-heart');
  const pet = p && cellOf(parseFloat(p.style.left), parseFloat(p.style.top));
  const me = a && cellOf(parseFloat(a.style.left) + 32, parseFloat(a.style.top) + 100);
  const items = JSON.parse(localStorage.getItem('agarago.home.v3'))?.scenes.room || [];
  return {
    pet, me,
    floor: !!pet && Number.isInteger(pet.x) && Number.isInteger(pet.y) && pet.x > 0 && pet.y > 0 && pet.x < 12 && pet.y < 12 && !blockedOf(items).has(`${pet.x},${pet.y}`),
    next: !!pet && !!me && Math.abs(pet.x - me.x) + Math.abs(pet.y - me.y) === 1,
    heart: !!heart && !heart.hidden,
    width: p ? parseFloat(getComputedStyle(p.querySelector('svg')).width) : 0,
    look: p?.dataset.pet,
    frame: p ? [...p.querySelectorAll('g[data-frame]')].find(g => g.style.display !== 'none')?.dataset.frame : null,
    perch: p?.dataset.perch || null, // 가구 위에 웅크리고 있으면 그 가구의 id(src/pet.js의 sit)
  };
}

// 가구 위에 올라간 펫(src/pet.js의 perch). 앉은 가구 id, 보이는 그림 장, 발끝이 그 가구의 그림 상자 안인지, 그 가구보다 위에 그려지는지
function perchScene() {
  const p = document.querySelector('#wallpaper .room-pet');
  const id = p?.dataset.perch;
  const f = id && document.querySelector(`#wallpaper .furn[data-id="${id}"]`);
  const x = parseFloat(p?.style.left);
  const y = parseFloat(p?.style.top);
  const box = f && { l: parseFloat(f.style.left), t: parseFloat(f.style.top), w: f.offsetWidth, h: f.offsetHeight };
  return {
    on: id || null,
    frame: p ? [...p.querySelectorAll('g[data-frame]')].find(g => g.style.display !== 'none')?.dataset.frame : null,
    inside: !!box && x > box.l && x < box.l + box.w && y > box.t && y < box.t + box.h,
    above: !!f && Number(p.style.zIndex) > Number(f.style.zIndex),
  };
}
// 펫이 보인 그림 장을 모두 적는다(window.__petPoses). 걷거나 뛰면 walk1, walk2가 남는다
function watchPoses() {
  const p = document.querySelector('#wallpaper .room-pet');
  window.__petPoses = new Set();
  new MutationObserver(() => {
    const g = [...p.querySelectorAll('g[data-frame]')].find(e => e.style.display !== 'none');
    if (g) window.__petPoses.add(g.dataset.frame);
  }).observe(p, { subtree: true, attributes: true, attributeFilter: ['style'] });
}

// 펫의 오른쪽 단추 메뉴(src/pet.js의 showMenu)에 든 줄. 지금 하는 일 앞에는 *를 붙인다. 메뉴가 없으면 null
function petMenu() {
  const m = document.querySelector('.ctx-menu');
  return m ? [...m.querySelectorAll('.ctx-menu-item')].map(b => `${b.getAttribute('aria-checked') === 'true' ? '*' : ''}${b.textContent}`).join(',') : null;
}
// 떠 있는 오른쪽 단추 메뉴(src/context-menu.js)의 줄. 굵은 줄 앞에는 !, 회색 줄 앞에는 ~, 점을 찍은 줄 앞에는 *를 붙이고
// 새 탭으로 가는 줄 끝에는 ↗를 붙여 쉼표로 잇는다. 메뉴가 없으면 null
function ctxMenu() {
  const m = document.querySelector('.ctx-menu');
  return m ? [...m.querySelectorAll('.ctx-menu-item')].map(b => [b.classList.contains('main') ? '!' : '', b.disabled ? '~' : '',
    b.getAttribute('aria-checked') === 'true' ? '*' : '', b.textContent, b.classList.contains('external') ? '↗' : ''].join('')).join(',') : null;
}
// sel 요소를 오른쪽 단추로 누른다(가운데에 contextmenu를 보낸다). 브라우저의 메뉴를 막았는지(defaultPrevented)를 돌려주고, 요소가 없으면 null
function rightClick(sel) {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
  el.dispatchEvent(e);
  return e.defaultPrevented;
}
// 펫을 오른쪽 단추로 누른다(지금 보이는 그림 장의 칠한 칸에 contextmenu를 보낸다). 브라우저의 메뉴를 막았는지(defaultPrevented)를 돌려준다
function rightClickPet() {
  const path = [...document.querySelectorAll('#wallpaper .room-pet g[data-frame] path:not(.shade)')].find(p => p.parentElement.style.display !== 'none');
  if (!path) return null;
  const r = path.closest('svg').getBoundingClientRect();
  const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
  path.dispatchEvent(e);
  return e.defaultPrevented;
}
// 펫 창(src/apps/pet-app.js)의 글과 단추. 숨은 줄은 null이다. pressed는 눌린 할 일 단추(src/pet.js의 ORDERS), off는 누를 수 없는 단추 수. 창이 없으면 null
function petWindow() {
  const b = document.querySelector('.pet-app');
  if (!b) return null;
  const [name, doing, pats, grow] = b.querySelector('.pet-status').children;
  const shown = el => (el.hidden ? null : el.textContent);
  return {
    name: name.textContent,
    doing: doing.textContent,
    pats: shown(pats),
    grow: shown(grow),
    care: !b.querySelector('.pet-care').hidden,
    pressed: [...b.querySelectorAll('.pet-orders [aria-pressed="true"]')].map(x => x.dataset.order).join(),
    off: [...b.querySelectorAll('.pet-orders .btn')].filter(x => x.disabled).length,
    tip: b.querySelector('.pet-care > .meta').textContent,
  };
}
// 내 아바타의 말풍선 글(떠 있을 때만)
const avatarSays = () => { const s = document.querySelector('#wallpaper .room-avatar-say:not(.room-pet-say)'); return s && !s.hidden ? s.textContent : null; };
// 바닥 칸(x, y)을 눌렀다 뗀다. 내 아바타가 그 칸으로 걷는다. 칸 가운데는 tile(x + 0.5, y + 0.5)이다(petScene의 cellOf를 거꾸로 푼 것)
function floorTap(x, y) {
  const w = document.getElementById('wallpaper').getBoundingClientRect();
  const k = w.width / 1280;
  const p = { bubbles: true, clientX: w.left + (640 + 36 * (x - y)) * k, clientY: w.top + (270 + 18 * (x + y + 1)) * k };
  const floor = document.getElementById('desktop');
  floor.dispatchEvent(new PointerEvent('pointerdown', p));
  floor.dispatchEvent(new PointerEvent('pointerup', p));
}

// 말풍선 암호로 날아온 비둘기 떼(src/pigeon.js). 비둘기 수, 비둘기마다 선 칸(petScene처럼 발끝을 거꾸로 푼 칸), 모든 칸이 비어 있던 바닥인지,
// 가장 가까운 두 비둘기 사이(가로와 세로 가운데 먼 쪽의 칸 수, 2 이상이면 서로 둘레 한 칸을 비웠다), 나는 비둘기 수, 떠 있는 말풍선의 글,
// 첫 비둘기의 지금 보이는 그림 장. 펫을 "없음"으로 두고 부른다(펫이 비둘기면 둘이 섞인다)
async function pigeonScene() {
  const { blockedOf } = await import(new URL('src/avatar.js', document.baseURI).href);
  const cellOf = (left, top) => { const s = (left - 640) / 36, t = (top - 270) / 18 - 1; return { x: (s + t) / 2, y: (t - s) / 2 }; };
  const birds = [...document.querySelectorAll('#wallpaper .room-pet[data-pet^="pigeon/"]')];
  const items = JSON.parse(localStorage.getItem('agarago.home.v3'))?.scenes.room || [];
  const blocked = blockedOf(items);
  const cells = birds.map(b => cellOf(parseFloat(b.style.left), parseFloat(b.style.top)));
  const floor = c => Number.isInteger(c.x) && Number.isInteger(c.y) && c.x > 0 && c.y > 0 && c.x < 12 && c.y < 12 && !blocked.has(`${c.x},${c.y}`);
  let apart = 99;
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) apart = Math.min(apart, Math.max(Math.abs(cells[i].x - cells[j].x), Math.abs(cells[i].y - cells[j].y)));
  const p = birds[0];
  return {
    count: birds.length,
    look: [...new Set(birds.map(x => x.dataset.pet))].join(),
    cells,
    floor: cells.length > 0 && cells.every(floor),
    apart,
    flying: birds.filter(x => x.classList.contains('flying')).length,
    says: [...document.querySelectorAll('#wallpaper .room-pet-say')].filter(x => !x.hidden && x.isConnected).map(x => x.textContent),
    frame: p ? [...p.querySelectorAll('g[data-frame]')].find(g => g.style.display !== 'none')?.dataset.frame : null,
  };
}
// 비둘기 떼를 지켜본다(page.run으로 건다). 떠 있는 "구구" 말풍선의 가장 많은 수와 말풍선을 띄운 비둘기 수(window.__coo),
// 내려앉은 뒤 날아오른 때(window.__takeoff, 비둘기마다 처음 .flying이 붙은 때와 그 칸)를 적는다. 앉은 모습을 본 비둘기만 날아오른 것으로 적으므로
// 건 순간 앉아 있는 비둘기는 바로 앉은 것으로 적어 둔다(첫 20ms 확인을 기다리면 그 사이에 뜬 첫 비둘기가 빠진다, known-issues 108)
function watchFlock() {
  const layer = document.getElementById('wallpaper');
  const cellOf = el => { const s = (parseFloat(el.style.left) - 640) / 36, t = (parseFloat(el.style.top) - 270) / 18 - 1; return { x: Math.round((s + t) / 2), y: Math.round((t - s) / 2) }; };
  const seen = new Set();
  const landed = new Set();
  window.__coo = { max: 0, birds: 0 };
  window.__takeoff = [];
  const scan = () => {
    const shown = [...layer.querySelectorAll('.room-pet-say')].filter(x => !x.hidden && x.isConnected);
    for (const x of shown) seen.add(x);
    window.__coo = { max: Math.max(window.__coo.max, shown.length), birds: seen.size };
    for (const b of layer.querySelectorAll('.room-pet[data-pet^="pigeon/"]')) {
      const flying = b.classList.contains('flying');
      if (!flying) landed.add(b);
      else if (landed.has(b) && !b.__off) {
        b.__off = true;
        window.__takeoff.push({ t: Math.round(performance.now()), ...cellOf(b) });
      }
    }
  };
  clearInterval(window.__flockTimer);
  scan();
  window.__flockTimer = setInterval(scan, 20);
}

// 실험실의 심심할 때 혼잣말(src/idle-talk.js)을 지켜본다. 내 아바타의 말풍선에 말이 뜰 때마다 그 말, 뜬 때, 아바타가 선 칸과
// 그 말을 하는 가구 가운데 바로 옆(벽 가구는 벽 바로 앞)에 선 가구의 id를 window.__said에 적는다(같은 말을 다시 해도 글을 새로 넣으므로 따로 센다).
// 아바타 그림이 움직인 횟수는 window.__moves, 입력 이벤트(pointermove, pointerdown, keydown, wheel)는 window.__inputs와 마지막 때 window.__lastInput에 적는다
async function watchIdle() {
  const { BY_ID } = await import(new URL('data/furniture.js', document.baseURI).href);
  const { furnitureLine } = await import(new URL('src/furniture-line.js', document.baseURI).href);
  const { dims, isWall, supportOf } = await import(new URL('src/rules.js', document.baseURI).href);
  const cellOf = (left, top) => { const s = (left - 640) / 36, t = (top - 270) / 18 - 1; return { x: (s + t) / 2, y: (t - s) / 2 }; };
  const me = document.querySelector('#wallpaper .room-avatar:not(.room-owner)');
  const bubble = document.querySelector('#wallpaper .room-avatar-say');
  const beside = (items, item, c) => {
    if (isWall(item)) {
      const along = u => u >= item.x && u < item.x + dims(item)[0];
      return item.wall === 'R' ? c.y === 0 && along(c.x) : c.x === 0 && along(c.y);
    }
    const base = supportOf(items, item) || item;
    const [w, d] = dims(base);
    const inside = (x, y) => x >= base.x && x < base.x + w && y >= base.y && y < base.y + d;
    return !inside(c.x, c.y) && [[1, 0], [0, 1], [-1, 0], [0, -1]].some(([dx, dy]) => inside(c.x + dx, c.y + dy));
  };
  Object.assign(window, { __said: [], __moves: 0, __inputs: 0, __lastInput: 0 });
  new MutationObserver(() => {
    if (bubble.hidden) return;
    const c = cellOf(parseFloat(me.style.left) + 32, parseFloat(me.style.top) + 100);
    const scene = 'room'; // 공간은 내 방 하나다
    const items = JSON.parse(localStorage.getItem('agarago.home.v3')).scenes[scene];
    const ids = items.filter(item => BY_ID[item.id] && furnitureLine(BY_ID[item.id]) === bubble.textContent && beside(items, item, c)).map(item => item.id);
    window.__said.push({ text: bubble.textContent, at: performance.now(), me: c, ids });
  }).observe(bubble, { childList: true });
  new MutationObserver(() => { window.__moves++; }).observe(me, { attributes: true, attributeFilter: ['style'] });
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel']) {
    addEventListener(type, () => { window.__inputs++; window.__lastInput = performance.now(); }, { capture: true });
  }
}
// 심심할 때 혼잣말이 걸어야 하는 가장 먼 길(걸음 수). 내 방의 어느 빈칸에서든 어느 가구 옆까지 걸어서 가장 먼 쪽이다.
// 가구 옆 칸(src/avatar.js의 besideOf)에서 거꾸로 넓이 우선으로 훑어 칸마다 가장 가까운 가구 옆까지의 걸음 수를 세고, 가구마다 가장 먼 칸의 걸음 수 가운데 가장 큰 것을 돌려준다.
// 점검이 줄여 쓰는 되풀이 간격은 이 길보다 길어야 한다(길면 다음 차례가 도착하기 전에 길을 바꾼다, known-issues 107)
async function longestTrip() {
  const { blockedOf } = await import(new URL('src/avatar.js', document.baseURI).href);
  const { BY_ID } = await import(new URL('data/furniture.js', document.baseURI).href);
  const { dims, isWall, supportOf } = await import(new URL('src/rules.js', document.baseURI).href);
  const { N } = await import(new URL('src/config.js', document.baseURI).href);
  const items = JSON.parse(localStorage.getItem('agarago.home.v3')).scenes.room.filter(item => BY_ID[item.id]); // 공간은 내 방 하나다
  const blocked = blockedOf(items);
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const key = (x, y) => `${x},${y}`;
  const free = (x, y) => x >= 0 && y >= 0 && x < N && y < N && !blocked.has(key(x, y));
  let worst = 0;
  for (const item of items) {
    let beside;
    if (isWall(item)) {
      const along = u => u >= item.x && u < item.x + dims(item)[0];
      beside = (x, y) => (item.wall === 'R' ? y === 0 && along(x) : x === 0 && along(y));
    } else {
      const base = supportOf(items, item) || item;
      const [w, d] = dims(base);
      const inside = (x, y) => x >= base.x && x < base.x + w && y >= base.y && y < base.y + d;
      beside = (x, y) => !inside(x, y) && DIRS.some(([dx, dy]) => inside(x + dx, y + dy));
    }
    const steps = new Map();
    const queue = [];
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (free(x, y) && beside(x, y)) { steps.set(key(x, y), 0); queue.push({ x, y }); }
    for (let i = 0; i < queue.length; i++) {
      for (const [dx, dy] of DIRS) {
        const n = { x: queue[i].x + dx, y: queue[i].y + dy };
        if (!free(n.x, n.y) || steps.has(key(n.x, n.y))) continue;
        steps.set(key(n.x, n.y), steps.get(key(queue[i].x, queue[i].y)) + 1);
        queue.push(n);
      }
    }
    for (const n of steps.values()) worst = Math.max(worst, n);
  }
  return worst;
}
// 분신사바의 공포 모드에서 아무도 없는 빈칸에 뜬 말풍선(src/horror.js의 speak)을 본다. 글이 text인 말풍선이 없으면 null이다.
// 말풍선이 뜬 칸이 가구도 아바타도 없는 빈칸인지(empty), 아바타가 선 칸에서 몇 칸인지(dist), 화면에서 아바타와 같은 높이의 바로 옆 칸인지(side),
// 속삭임 모양의 점선 테두리로 천천히 나타나는지(fade),
// 아바타가 그 칸 쪽을 보는지(looking, src/avatar.js의 FACING: 왼쪽 위나 오른쪽 위를 보면 뒷모습 줄, 오른쪽을 보면 뒤집음)를 돌려준다.
// need를 주면 그 값이 참일 때만 돌려준다(until로 기다릴 때 쓴다)
async function voiceSpot(text, need = '') {
  const v = document.querySelector('#wallpaper .horror-voice');
  const me = document.querySelector('#wallpaper .room-avatar:not(.room-owner)');
  if (!v || !me || v.textContent !== text) return null;
  const cellOf = (left, top) => { const s = (left - 640) / 36, t = (top - 270) / 18 - 1; return { x: (s + t) / 2, y: (t - s) / 2 }; };
  const at = cellOf(parseFloat(v.style.left), parseFloat(v.style.top) + 104);
  const my = cellOf(parseFloat(me.style.left) + 32, parseFloat(me.style.top) + 100);
  const { emptyCells } = await import(new URL('src/avatar.js', document.baseURI).href);
  const scene = 'room'; // 공간은 내 방 하나다
  const items = JSON.parse(localStorage.getItem('agarago.home.v3')).scenes[scene];
  const dx = at.x - my.x;
  const dy = at.y - my.y;
  const dir = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
  const row = dir[0] < 0 || dir[1] < 0 ? 1 : 0;
  const flip = dir[0] ? dir[0] > 0 : dir[1] < 0;
  const spot = {
    at, my,
    empty: emptyCells(items, [my]).some(c => c.x === at.x && c.y === at.y),
    dist: Math.abs(dx) + Math.abs(dy),
    side: at.x + at.y === my.x + my.y && Math.abs(dx - dy) === 2,
    fade: getComputedStyle(v).animationName === 'horror-voice' && getComputedStyle(v).borderTopStyle === 'dashed',
    looking: parseFloat(me.style.backgroundPosition.split(' ')[1]) === -row * 104 && me.classList.contains('flip') === flip,
  };
  return !need || spot[need] ? spot : null;
}
const clickTwice =sel => { const el = document.querySelector(sel); if (!el) return false; const c = () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })); c(); c(); return true; };
// 사진 고르는 줄(scope 안의 .pic-choice)에서 지금 골라져 있지 않은 사진 하나를 눌러 그 id를 돌려준다(src/user-pictures.js). avoid: 고르지 않을 사진 id
function pickOther(scope, avoid = null) {
  const b = [...document.querySelectorAll(`${scope} .pic-choice`)].find(c => c.getAttribute('aria-pressed') !== 'true' && c.querySelector('.user-pic').dataset.pic !== avoid);
  if (!b) return null;
  b.click();
  return b.querySelector('.user-pic').dataset.pic;
}
// sel 안에 보이는 사용자 사진의 id(없으면 null)
const shownPic = sel => document.querySelector(`${sel} .user-pic`)?.dataset.pic ?? null;
const clickOnce = sel => { const el = document.querySelector(sel); if (!el) return false; el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; };
const clickText = (sel, text) => { const el = [...document.querySelectorAll(sel)].find(b => b.textContent.includes(text)); if (!el) return false; el.click(); return true; };
// 이름 바꾸기 창(src/user-name.js)의 입력 칸에 v를 넣고 이름 바꾸기를 누른다. 입력 칸은 순서 대신 종류로 찾는다(known-issues 72)
const nameSubmit = v => { const f = document.querySelector('#windows .name-app form'); if (!f) return false; f.querySelector('input[type="text"]').value = v; f.requestSubmit(); return true; };
// 저장된 내 집의 주인 이름(src/login.js의 로그인 화면과 os.saveHome이 쓰는 값)
const savedOwner = () => JSON.parse(localStorage.getItem('agarago.home.v3') || 'null')?.owner ?? null;
// 최근에 놀러 간 집의 기억(agarago.recent, src/neighbors.js의 recentVisits). recentAt(i): i번째 집이나 null, recentIds(): 방 번호들
const recentAt = i => JSON.parse(localStorage.getItem('agarago.recent') || '[]')[i] ?? null;
const recentIds = () => JSON.parse(localStorage.getItem('agarago.recent') || '[]').map(v => v.room);
// 로그인 화면 오른쪽 단의 격자(src/login.js의 gridTile). 제목은 [글, 폭], 칸은 [왼쪽, 위, 폭](무대 px, 반올림하지 않음).
// whole: 칸 사진이 상자 안에 다 들어가는가(예전 이웃집 칸은 48px 상자가 그보다 큰 사진의 가운데만 보였다, known-issues 97)
function friendGrid() {
  const stage = document.getElementById('stage');
  const k = stage.getBoundingClientRect().width / stage.offsetWidth;
  const col = document.querySelector('.users-friends');
  const box = e => { const r = e.getBoundingClientRect(); return [r.left / k, r.top / k, r.width / k]; };
  const inside = a => { const p = a.querySelector('svg').getBoundingClientRect(), b = a.getBoundingClientRect(); return p.left >= b.left && p.right <= b.right && p.top >= b.top && p.bottom <= b.bottom; };
  return {
    grid: col.classList.contains('friend-grid'),
    heads: [...col.querySelectorAll('.friend-head')].map(e => [e.textContent, Math.round(box(e)[2])]),
    tiles: [...col.querySelectorAll('.friend-tile')].map(box),
    small: col.querySelectorAll('.friend-tile small').length,
    whole: [...col.querySelectorAll('.friend-tile .avatar.has-pic')].every(inside),
  };
}

// 미니게임 창(제목이 title로 시작)에서 act를 한 뒤 게임 페이지의 상태를 돌려준다. 창이나 게임 페이지가 아직 없으면 null
//   act: 'card:<글>' 떠 있는 카드에서 글로 시작하는 단추, 'min' 최소화 단추, 'task' 작업 표시줄 단추, 'drop' 판 가운데를 누르고 바로 최소화
//   돌려주는 것: left 파일 정리 10의 남은 시간(초, 시간 막대 폭), y 짐 정리에서 맨 처음 떨어뜨린 물건의 높이, card 떠 있는 카드의 단추 글
//   want를 주면 상태 대신 그 조건이 맞는지만 돌려준다(until로 기다릴 때). { card: 글 } 떠 있는 카드의 단추 글에 그 글이 있다,
//   { leftBelow: 초 } 남은 시간이 그보다 적다, { fellFrom: 높이 } 물건이 그 높이보다 아래로 내려갔다
function miniGame(title, act = '', want = null) {
  const win = [...document.querySelectorAll('#windows .win')].find(w => w.querySelector('.win-title')?.textContent.startsWith(title));
  const frame = win?.querySelector('iframe');
  let doc = null;
  try { doc = frame.contentDocument; } catch { /* 다른 문서 */ }
  const cv = doc?.querySelector('canvas');
  if (!cv || doc.readyState !== 'complete') return null;
  const buttons = () => [...doc.querySelectorAll('.aga-card:not([hidden]) button')];
  if (act.startsWith('card:')) buttons().find(b => b.textContent.startsWith(act.slice(5)))?.click();
  if (act === 'min') win.querySelector('.win-min').click();
  if (act === 'task') [...document.querySelectorAll('#tasks .task')].find(t => t.textContent.includes(title))?.click();
  if (act === 'drop') {
    const r = cv.getBoundingClientRect();
    cv.dispatchEvent(new frame.contentWindow.PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    win.querySelector('.win-min').click();
  }
  const bar = doc.querySelector('#timebar i');
  const state = {
    left: bar ? parseFloat(bar.style.width) : null,
    y: frame.contentWindow.eval('typeof bodies === "object" && bodies.length ? bodies[0].y : null'),
    card: buttons().map(b => b.textContent).join('/'),
  };
  if (!want) return state;
  if ('card' in want) return state.card.includes(want.card);
  if ('leftBelow' in want) return state.left < want.leftBelow;
  return state.y > want.fellFrom;
}
const centreOf = sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

// ---------- 크롬을 모는 도우미 ----------

async function until(page, fn, ms = 8000, ...args) {
  const t0 = Date.now();
  for (;;) {
    const v = await page.run(fn, ...args);
    if (v || Date.now() - t0 > ms) return v;
    await sleep(100);
  }
}
const KEYS = { Enter: 13, Escape: 27, ArrowRight: 39, ArrowDown: 40, KeyD: 68, KeyS: 83, KeyA: 65, KeyW: 87 };
async function press(page, code, text) {
  const key = code.startsWith('Key') ? code.slice(3).toLowerCase() : code;
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, text, windowsVirtualKeyCode: KEYS[code] });
  await sleep(120);
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: KEYS[code] });
}
const mouse = (page, type, p) => page.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
// 숨겨 둔 파일 고르는 칸(sel)에 파일을 넣는다. 사람이 파일 창에서 고른 것처럼 change가 온다
async function setFile(page, sel, file) {
  await page.send('DOM.enable');
  const { root } = await page.send('DOM.getDocument', { depth: 0 });
  const { nodeId } = await page.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
  if (!nodeId) throw new Error(`${sel}이 화면에 없다`);
  await page.send('DOM.setFileInputFiles', { nodeId, files: [file] });
}
async function tap(page, p) {
  await mouse(page, 'mousePressed', p);
  await mouse(page, 'mouseReleased', p);
}
// 진짜 마우스의 오른쪽 단추로 p를 누른다. 크롬이 그 자리의 요소를 골라 contextmenu를 보낸다
async function rightTap(page, p) {
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'right', buttons: 2, clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'right', buttons: 0, clickCount: 1 });
}

// 사이트를 차례로 눌러 본다. 눌러야 할 것이 화면에 없으면 예외가 나고, main이 그 자리에서 멈춘 것을 실패로 적는다
async function walk(page, base) {

  // 주소를 열고 첫 화면 가림막이 걷힐 때까지 기다린다(걷히지 않으면 모듈 하나가 멈춘 것이다, known-issues 42)
  const open = async (hash = '') => {
    await page.send('Page.navigate', { url: 'about:blank' });
    await page.send('Page.navigate', { url: base + hash });
    return until(page, () => document.readyState === 'complete' && !document.getElementById('page-loader'), 15000);
  };
  const powerOn = async () => {
    await page.run(() => document.getElementById('power').click());
    return until(page, () => !document.getElementById('login').hidden, 10000);
  };
  const desktop = () => until(page, () => !document.getElementById('desktop').hidden, 8000);
  // 화면마다 재는 두 가지
  const probe = async where => {
    const shown = await page.run(shownHidden);
    check(`${where}: hidden인데 보이는 요소가 없다`, shown.length === 0, shown.join(', '));
    const over = await page.run(overflowing);
    check(`${where}: 가로로 넘친 상자가 없다`, over.length === 0, over.join(' | '));
    const cut = await page.run(cutText);
    check(`${where}: 글이 잘리거나 상자 밖으로 나간 곳이 없다`, cut.length === 0, cut.join(' | '));
  };
  const openIcon = id => page.run(clickTwice, `#icons .desk-icon[data-app="${id}"]`);
  const closeWindows = () => page.run(() => { for (const b of document.querySelectorAll('#windows .win .win-close')) b.click(); });
  // 바탕화면의 가구를 두 번 눌러 아바타가 걸어가 쓸 때까지 기다린다
  const use = async (id, ready, what) => {
    await page.run(clickTwice, `#wallpaper .furn[data-id="${id}"]`);
    check(`가구(${id})를 두 번 누르면 ${what}`, await until(page, ready, 15000));
    await sleep(300);
    await probe(`가구 ${id}`);
  };

  // ---------- 처음 온 사람 ----------
  check('주소를 열면 첫 화면 가림막이 걷힌다', await open());
  await probe('꺼진 화면');
  check('전원을 누르면 로그인 화면이 뜬다', await powerOn());
  await probe('로그인 화면');
  check('처음 온 사람에게 새 사용자 만들기 칸이 있다', await page.run(() => !!document.querySelector('.user.new input')));
  // 사용자 사진: 한 장이 미리 골라져 있고, 다른 사진을 누르면 고른 표시와 왼쪽 큰 사진이 따라온다
  check('새 사용자 만들기에 사진 여덟 장이 있고 한 장이 골라져 있다', await page.run(() => document.querySelectorAll('.user.new .pic-choice').length === 8
    && document.querySelectorAll('.user.new .pic-choice[aria-pressed="true"]').length === 1));
  // 내 그림: 그림이 아닌 파일은 열지 못했다고 알리고, 그림 파일은 픽셀 그림으로 줄여 왼쪽 큰 사진 자리에 띄운다(src/custom-picture.js)
  await setFile(page, '.user.new input[type="file"]', NOT_IMAGE);
  check('새 사용자 만들기에서 그림이 아닌 파일을 고르면 열지 못했다고 알린다', await until(page, () => document.getElementById('toast').textContent.includes('그림 파일을 열지 못했습니다'), 5000));
  await setFile(page, '.user.new input[type="file"]', TEST_IMAGE);
  check('새 사용자 만들기에서 그림 파일을 고르면 왼쪽 큰 사진 자리에 내 그림이 뜨고 고른 표시가 빠진다', await until(page, () => document.querySelector('.user.new > .avatar .user-pic')?.dataset.pic === 'my'
    && !document.querySelector('.user.new .pic-choice[aria-pressed="true"]'), 5000));
  await probe('내 그림을 고른 로그인 화면');
  const firstPic = await page.run(pickOther, '.user.new');
  check('사진을 누르면 그 사진이 골라지고 왼쪽 큰 사진이 바뀐다', firstPic && (await page.run(shownPic, '.user.new > .avatar')) === firstPic
    && (await page.run(p => document.querySelector(`.user.new .pic-choice[aria-pressed="true"] [data-pic="${p}"]`) !== null, firstPic)), firstPic);
  await page.run(() => { const f = document.querySelector('.user.new'); f.requestSubmit(); });
  check('빈 닉네임으로 확인을 누르면 안내가 뜬다', await page.run(() => !document.querySelector('.name-tip').hidden));
  await page.run(() => { const f = document.querySelector('.user.new'); f.querySelector('input[aria-label="닉네임"]').value = '점검'; f.requestSubmit(); });
  check('새 사용자를 만들면 바탕화면이 뜬다', await desktop());
  check('새 사용자를 만들면 고른 사진이 저장된다', (await page.run(() => JSON.parse(localStorage.getItem('agarago.picture')))) === firstPic);
  check('새 사용자에게 튜토리얼 안내 카드가 뜬다', await until(page, () => { const c = document.querySelector('.coach-card'); return !!c && !c.hidden; }, 3000));
  await probe('튜토리얼 첫 단계');
  check('튜토리얼 카드가 떠 있는 동안에는 아바타 머리 위의 말하기 표시가 숨는다', await page.run(sayCue, '없음'), await page.run(sayCue));
  await page.run(() => document.querySelector('.coach-btn').click());
  check('건너뛰기를 누르면 안내 카드가 사라진다', await page.run(() => document.querySelector('.coach-card').hidden));
  check('튜토리얼을 건너뛰면 아직 말해 보지 않은 아바타의 머리 위에 말하기 표시가 뜬다', await until(page, sayCue, 2000, '머리 위'), await page.run(sayCue));

  // ---------- 가구가 놓인 내 집 ----------
  check('점검용 집의 가구가 모두 검사를 통과한다', (await page.run(plantHome, HOME)) === HOME.scenes.room.length);
  // 내 방에는 고르기 전에도 기본 펫이 산다(F30). 펫이 무작위로 고른 빈칸에 앉으면 아바타가 걷는 길이 바뀌어 다른 절의 확인이 흔들리므로,
  // 펫 절 전까지는 펫을 "없음"으로 둔다. 펫 절이 설정을 비워 고르기 전 모습부터 본다
  await page.run(() => { const s = JSON.parse(localStorage.getItem('agarago.settings') || '{}'); localStorage.setItem('agarago.settings', JSON.stringify({ ...s, pet: 'none' })); });
  await open();
  await powerOn();
  check('로그인 화면 왼쪽 단에 내 사용자가 있다', await page.run(() => document.querySelectorAll('.users-own .user:not(.new)').length === 1));
  check('로그인 화면의 내 사용자에 고른 사진이 보인다', (await page.run(shownPic, '.users-own .user:not(.new)')) === firstPic);
  check('내 집이 있어도 로그인 화면 오른쪽 단 끝에 친구 아이디 칸이 있다', await page.run(() => !!document.querySelector('.users-friends')?.lastElementChild?.matches('.user.by-handle')));
  await page.run(clickOnce, '.reset-link');
  await probe('초기화 확인');
  await page.run(clickText, '.reset-row .btn', '그대로 두기');
  await page.run(clickOnce, '.users .user:not(.neighbor)');
  check('내 사용자를 누르면 바탕화면이 뜬다', await desktop());
  await sleep(600);
  check('바탕화면의 방에 가구가 모두 그려진다', (await page.run(() => document.querySelectorAll('#wallpaper .furn').length)) === HOME.scenes.room.length);
  check('말해 보기 전에는 다시 들어와도 아바타 머리 위에 말하기 표시가 뜬다(가운데, 머리 꼭대기에서 8px 위)', await page.run(sayCue, '머리 위'), await page.run(sayCue));
  await probe('바탕화면');
  // 화면보다 크게 깔린 층(디가우스)이 있어도 화면은 스크롤되지 않는다. 스크롤되면 초점이나 scrollIntoView에 화면 전체가 밀린다(known-issues 66).
  // 바탕화면도 같다. 가구 가까이 보기와 게임기의 큰 화면이 움직이는 동안 바탕화면보다 커진다
  check('화면(#screen)과 바탕화면(#desktop)은 스크롤되지 않는다', await page.run(() => ['screen', 'desktop'].every(id => {
    const s = document.getElementById(id);
    s.scrollTop = 200;
    s.scrollLeft = 200;
    return s.scrollTop === 0 && s.scrollLeft === 0;
  })));

  // 아이콘: 한 번 누르면 고르기만 하고, 간격이 벌어지거나 다른 아이콘을 누르면 열지 않고, 이어서 두 번 누르면 연다
  await page.run(clickOnce, '#icons .desk-icon[data-app="music"]');
  await sleep(600);
  await page.run(clickOnce, '#icons .desk-icon[data-app="music"]');
  await sleep(150);
  check('아이콘을 0.6초 띄워 두 번 누르면 열리지 않는다', (await page.run(winCount)) === 0);
  await page.run(clickOnce, '#icons .desk-icon[data-app="music"]');
  check('아이콘을 이어서 두 번 누르면 창이 열린다', await until(page, () => document.querySelectorAll('#windows .win').length === 1, 2000));
  await page.run(clickOnce, '#icons .desk-icon[data-app="games"]');
  await page.run(clickOnce, '#icons .desk-icon[data-app="music"]');
  await sleep(150);
  check('서로 다른 아이콘을 번갈아 누르면 열리지 않는다', (await page.run(winCount)) === 1);

  // 창 제목 줄: 두 번 누르면 최대화, 다시 두 번 누르면 되돌린다
  const isMax = () => document.querySelector('#windows .win').classList.contains('maximized');
  await tap(page, await page.run(centreOf, '#windows .win .win-title'));
  await sleep(600);
  check('창 제목 줄을 한 번 누르면 그대로다', !(await page.run(isMax)));
  for (let i = 0; i < 2; i++) await tap(page, await page.run(centreOf, '#windows .win .win-title'));
  check('창 제목 줄을 두 번 누르면 최대화된다', await page.run(isMax));
  await sleep(600);
  for (let i = 0; i < 2; i++) await tap(page, await page.run(centreOf, '#windows .win .win-title'));
  check('다시 두 번 누르면 되돌아온다', !(await page.run(isMax)));
  await closeWindows();

  // 아바타: 말하기 칸에서 친 글자는 걷기로 먹지 않고, 칸을 닫으면 WASD로 걷는다
  await page.run(() => document.querySelector('#desktop').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  const spot0 = await page.run(avatarSpot);
  await press(page, 'Enter');
  check('Enter를 누르면 말하기 칸이 열린다', await until(page, () => { const i = document.querySelector('.say-input'); return !!i && !i.hidden && document.activeElement === i; }, 2000));
  await press(page, 'KeyD', 'd');
  await sleep(400);
  check('말하기 칸에서 친 글자는 아바타를 움직이지 않는다', (await page.run(avatarSpot)) === spot0 && (await page.run(() => document.querySelector('.say-input').value)) === 'd');
  await press(page, 'Enter');
  check('Enter를 누르면 말풍선이 뜬다', await until(page, () => { const b = document.querySelector('.room-avatar-say'); return !!b && !b.hidden && b.textContent === 'd'; }, 2000));
  check('처음 말하면 말하기 표시가 사라지고 이 브라우저에 말한 기록이 남는다', (await page.run(sayCue)) === '없음'
    && (await page.run(() => localStorage.getItem('agarago.said'))) === 'true', await page.run(sayCue));
  let walked = false;
  for (const code of ['KeyD', 'KeyS', 'KeyA', 'KeyW']) {
    await press(page, code);
    await sleep(450);
    if ((await page.run(avatarSpot)) !== spot0) { walked = true; break; }
  }
  check('말하기 칸을 닫으면 WASD로 걷는다', walked);

  // 가구와 문: 한 번 누르면 그대로, 두 번 누르면 아바타가 걸어가 쓴다
  await page.run(clickOnce, '#wallpaper .furn[data-id="lamp"]');
  await sleep(700);
  check('가구를 한 번 누르면 쓰지 않는다', (await page.run(theme)) === 'day');
  await page.run(clickTwice, '#wallpaper .furn[data-id="lamp"]');
  check('스탠드를 두 번 누르면 아바타가 걸어가 밤으로 바꾼다', await until(page, () => document.getElementById('stage').dataset.theme === 'night', 15000));
  await probe('밤의 바탕화면');
  await page.run(clickTwice, '#wallpaper .furn[data-id="lamp"]');
  check('다시 두 번 누르면 낮으로 돌아온다', await until(page, () => document.getElementById('stage').dataset.theme === 'day', 15000));
  await page.run(clickTwice, '#wallpaper .door-hit');
  check('현관문을 두 번 누르면 아바타가 걸어간 뒤 이웃집 목록 창이 뜬다', await until(page, () => !!document.querySelector('#windows .neighbor-app'), 15000));
  await closeWindows();

  // ---------- 오른쪽 단추 메뉴 ----------
  // 자리마다 브라우저의 메뉴 대신 사이트의 메뉴(src/context-menu.js)가 뜨고, 굵은 줄을 누르면 그 자리를 두 번 누를 때와 같은 일을 한다.
  // 메뉴가 없는 자리(창 안, 시작 단추)에서는 아무것도 뜨지 않고, 글을 치는 칸과 링크에서는 브라우저의 메뉴를 그대로 둔다
  const menuGone = () => !document.querySelector('.ctx-menu');
  const pick = text => page.run(clickText, '.ctx-menu .ctx-menu-item', text);
  const menuText = async () => String(await page.run(ctxMenu));
  const themeIs = want => document.getElementById('stage').dataset.theme === want; // 페이지 안에서 돈다. 바깥 변수 대신 인자로 받는다
  // 바탕화면의 빈 곳(오른쪽 위 구석, 아이콘은 왼쪽에 줄을 선다)을 진짜 오른쪽 단추로 누른다
  const corner = await page.run(() => { const r = document.getElementById('desktop').getBoundingClientRect(); return { x: r.right - 24, y: r.top + 24 }; });
  await rightTap(page, corner);
  check('바탕화면의 빈 곳을 오른쪽 단추로 누르면 브라우저의 메뉴 대신 불 끄기와 방 꾸미기 메뉴가 누른 자리에 뜬다',
    (await page.run(ctxMenu)) === '불 끄기 (밤),방 꾸미기' && await page.run(p => { const r = document.querySelector('.ctx-menu').getBoundingClientRect(); return r.right <= p.x + 1 && Math.abs(r.top - p.y) < 2; }, corner), await menuText());
  await pick('불 끄기');
  check('바탕화면 메뉴의 불 끄기를 누르면 메뉴가 닫히고 밤이 된다', await page.run(menuGone) && await until(page, themeIs, 2000, 'night'));
  await page.run(rightClick, '#desktop');
  check('밤에는 바탕화면 메뉴에 불 켜기가 뜬다', (await page.run(ctxMenu)) === '불 켜기 (낮),방 꾸미기', await menuText());
  await pick('불 켜기');
  check('불 켜기를 누르면 낮으로 돌아온다', await until(page, themeIs, 2000, 'day'));
  // 키: 메뉴가 떠 있는 동안 방향키는 아바타 대신 메뉴가 받고, Esc를 누르면 닫힌다. 바깥을 눌러도 닫힌다
  await page.run(rightClick, '#desktop');
  const spotMenu = await page.run(avatarSpot);
  await press(page, 'ArrowDown');
  await sleep(300);
  check('메뉴가 떠 있는 동안 아래 방향키를 누르면 아바타는 걷지 않고 메뉴의 첫 줄로 간다',
    (await page.run(() => document.activeElement?.textContent)) === '불 끄기 (밤)' && (await page.run(avatarSpot)) === spotMenu);
  await press(page, 'Escape');
  check('Esc를 누르면 메뉴가 닫힌다', await page.run(menuGone));
  await page.run(rightClick, '#desktop');
  await page.run(() => document.querySelector('#desktop').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  check('메뉴 바깥을 누르면 메뉴가 닫힌다', await page.run(menuGone));
  // 아이콘: 굵은 열기 한 줄. 윈도우처럼 누른 아이콘을 고른다
  check('아이콘을 오른쪽 단추로 누르면 굵은 열기가 뜨고 그 아이콘이 골라진다', (await page.run(rightClick, '#icons .desk-icon[data-app="music"]')) === true
    && (await page.run(ctxMenu)) === '!열기' && await page.run(() => document.querySelector('#icons .desk-icon[data-app="music"]').classList.contains('selected')), await menuText());
  await pick('열기');
  check('아이콘 메뉴의 열기를 누르면 그 앱의 창이 열린다', await until(page, () => document.querySelectorAll('#windows .win').length === 1, 3000));
  // 창 메뉴(제목 줄과 작업 표시줄 단추): 윈도우처럼 이전 크기로, 최소화, 최대화, 닫기. 할 수 없는 줄은 회색이고 닫기가 굵다
  check('창 제목 줄을 오른쪽 단추로 누르면 이전 크기로가 회색이고 닫기가 굵은 창 메뉴가 뜬다', (await page.run(rightClick, '#windows .win .win-title')) === true
    && (await page.run(ctxMenu)) === '~이전 크기로,최소화,최대화,!닫기', await menuText());
  await pick('최대화');
  check('창 메뉴의 최대화를 누르면 창이 최대화된다', await page.run(isMax));
  await page.run(rightClick, '#windows .win .win-title');
  check('최대화한 창의 메뉴에서는 최대화가 회색이다', (await page.run(ctxMenu)) === '이전 크기로,최소화,~최대화,!닫기', await menuText());
  await pick('이전 크기로');
  check('이전 크기로를 누르면 최대화가 풀린다', !(await page.run(isMax)));
  check('작업 표시줄 단추를 오른쪽 단추로 눌러도 같은 창 메뉴가 뜬다', (await page.run(rightClick, '#tasks .task')) === true
    && (await page.run(ctxMenu)) === '~이전 크기로,최소화,최대화,!닫기', await menuText());
  await pick('최소화');
  check('창 메뉴의 최소화를 누르면 창이 숨는다', await page.run(() => document.querySelector('#windows .win').hidden));
  await page.run(rightClick, '#tasks .task');
  check('최소화한 창의 메뉴에서는 최소화가 회색이다', (await page.run(ctxMenu)) === '이전 크기로,~최소화,최대화,!닫기', await menuText());
  await pick('이전 크기로');
  check('최소화한 창의 이전 크기로를 누르면 창이 다시 보인다', await page.run(() => !document.querySelector('#windows .win').hidden));
  check('창 안의 빈 곳을 오른쪽 단추로 누르면 브라우저의 메뉴도 사이트의 메뉴도 뜨지 않는다', (await page.run(rightClick, '#windows .win .win-body')) === true && await page.run(menuGone));
  check('시작 단추를 오른쪽 단추로 누르면 아무 메뉴도 뜨지 않는다', (await page.run(rightClick, '.start-btn')) === true && await page.run(menuGone));
  // 제목 줄을 한 번 누른 바로 뒤에 진짜 오른쪽 단추로 눌러도 두 번 누르기(최대화)로 세지 않는다
  await tap(page, await page.run(centreOf, '#windows .win .win-title'));
  await rightTap(page, await page.run(centreOf, '#windows .win .win-title'));
  check('창 제목 줄을 누른 바로 뒤에 오른쪽 단추로 누르면 최대화하지 않고 창 메뉴만 뜬다', !(await page.run(isMax)) && (await page.run(ctxMenu)) === '~이전 크기로,최소화,최대화,!닫기', await menuText());
  await pick('닫기');
  check('창 메뉴의 닫기를 누르면 창이 닫힌다', (await page.run(winCount)) === 0);
  // 가구: 굵은 줄은 두 번 누를 때처럼 아바타가 가서 쓴다. 불빛 가구는 시작 메뉴와 같은 말로 적는다
  check('스탠드를 오른쪽 단추로 누르면 굵은 불 끄기와 방 꾸미기가 뜬다', (await page.run(rightClick, '#wallpaper .furn[data-id="lamp"]')) === true
    && (await page.run(ctxMenu)) === '!불 끄기 (밤),방 꾸미기', await menuText());
  await pick('불 끄기');
  check('가구 메뉴의 굵은 줄을 누르면 두 번 누를 때처럼 아바타가 걸어가 쓴다', await until(page, themeIs, 15000, 'night'));
  await page.run(rightClick, '#wallpaper .furn[data-id="lamp"]');
  check('밤에는 스탠드 메뉴에 불 켜기가 뜬다', (await page.run(ctxMenu)) === '!불 켜기 (낮),방 꾸미기', await menuText());
  await pick('불 켜기');
  check('스탠드 메뉴의 불 켜기를 누르면 낮으로 돌아온다', await until(page, themeIs, 15000, 'day'));
  check('침대를 오른쪽 단추로 누르면 굵은 사용하기와 방 꾸미기가 뜬다', (await page.run(rightClick, '#wallpaper .furn[data-id="bed"]')) === true
    && (await page.run(ctxMenu)) === '!사용하기,방 꾸미기', await menuText());
  await pick('방 꾸미기');
  check('가구 메뉴의 방 꾸미기를 누르면 방 꾸미기 창이 열린다', await until(page, () => !!document.querySelector('#windows .room-app'), 3000));
  await closeWindows();
  check('현관문을 오른쪽 단추로 누르면 굵은 이웃집 놀러 가기가 뜬다', (await page.run(rightClick, '#wallpaper .door-hit')) === true
    && (await page.run(ctxMenu)) === '!이웃집 놀러 가기', await menuText());
  await pick('이웃집 놀러 가기');
  check('현관문 메뉴의 이웃집 놀러 가기를 누르면 아바타가 걸어간 뒤 이웃집 목록 창이 뜬다', await until(page, () => !!document.querySelector('#windows .neighbor-app'), 15000));
  await closeWindows();
  // 아바타: 누를 때처럼 말하기. 말하기 칸은 글을 치는 칸이라 브라우저의 메뉴(붙여 넣기)를 그대로 둔다
  check('내 아바타를 오른쪽 단추로 누르면 굵은 말하기가 뜬다', (await page.run(rightClick, '#wallpaper .room-avatar:not(.room-owner)')) === true
    && (await page.run(ctxMenu)) === '!말하기', await menuText());
  await pick('말하기');
  check('아바타 메뉴의 말하기를 누르면 말하기 칸이 열린다', await until(page, () => { const i = document.querySelector('.say-input'); return !!i && !i.hidden && document.activeElement === i; }, 2000));
  check('말하기 칸(글을 치는 칸)에서는 브라우저의 메뉴가 그대로 뜬다', (await page.run(rightClick, '.say-input')) === false && await page.run(menuGone));
  await press(page, 'Escape');
  // 게임 폴더 창 안의 아이콘에도 메뉴가 뜬다. 새 탭으로 열리는 앱은 줄에 바깥 화살표를 달고 마우스를 올리면 열리는 곳을 보여 주며,
  // 그 줄을 눌러도 바로 새 탭으로 가지 않고 두 번 누를 때처럼 새 탭 안내 창이 열린다. 그 창의 링크에서는 브라우저의 메뉴를 그대로 둔다
  await page.run(rightClick, '#icons .desk-icon[data-app="games"]');
  await pick('열기');
  check('게임 아이콘 메뉴의 열기를 누르면 게임 폴더 창이 열린다', await until(page, () => !!document.querySelector('#windows .desk-icon[data-app="shu-ramen"]'), 3000));
  check('새 탭으로 열리는 게임의 메뉴에는 바깥 화살표가 달리고 마우스를 올리면 열리는 곳이 보인다', (await page.run(rightClick, '#windows .desk-icon[data-app="shu-ramen"]')) === true
    && (await page.run(ctxMenu)) === '!열기↗' && /^새 탭에서 열립니다\(.+\)$/.test(await page.run(() => document.querySelector('.ctx-menu-item').title)), await menuText());
  await pick('열기');
  check('그 줄을 누르면 새 탭 안내 창이 열린다', await until(page, () => !!document.querySelector('#windows a.btn[target="_blank"]'), 3000));
  check('새 탭 안내 창의 링크에서는 브라우저의 메뉴가 그대로 뜬다', (await page.run(rightClick, '#windows a.btn[target="_blank"]')) === false && await page.run(menuGone));
  await closeWindows();

  // ---------- 기본 앱 창 ----------
  for (const id of ['room', 'games', 'share', 'music']) {
    await openIcon(id);
    check(`바탕화면의 ${id} 아이콘이 창을 연다`, await until(page, () => document.querySelectorAll('#windows .win').length === 1, 3000));
    await sleep(400);
    await probe(`창 ${id}`);
    if (id === 'share') {
      // 링크는 "링크 만들기"로 만드는 짧은 링크 하나다. 서버는 fakeCloud가 대신하고, 끝에 링크를 지워 뒤의 점검이 서버를 부르지 않게 한다
      const winText = () => document.querySelector('#windows .win')?.textContent || '';
      check('공유하기 창에는 링크 만들기 단추가 있고 긴 링크와 링크 칸은 보이지 않는다', await page.run(() => {
        const win = document.querySelector('#windows .win');
        return [...win.querySelectorAll('.btn')].some(b => b.textContent === '링크 만들기') && !win.querySelector('input[aria-label="공유 링크"]')
          && !win.textContent.includes('긴 링크') && !win.textContent.includes('짧은 링크') && win.textContent.includes('Firebase(구글) 서버에 저장됩니다');
      }));
      await page.run(fakeCloud, 'offline');
      await page.run(clickText, '#windows .win .btn', '링크 만들기');
      check('링크를 만들지 못하면 다시 누르거나 방 그림을 PNG로 내려받으라고 알린다', await until(page, () => /만들지 못했습니다.*PNG/.test(document.getElementById('toast').textContent)
        && [...document.querySelectorAll('#windows .win .btn')].some(b => b.textContent === '링크 만들기' && !b.disabled), 5000));
      await page.run(fakeCloud, 'write', {}, [], { 이웃집: { uid: 'other-uid', room: 'Othr5678' } }); // 아이디 "이웃집"은 남이 먼저 정해 두었다
      await page.run(clickText, '#windows .win .btn', '링크 만들기');
      check('링크 만들기를 누르면 링크 칸에 #s= 링크가 나온다', await until(page, () => /#s=[0-9A-Za-z]{8}$/.test(document.querySelector('#windows .win input[aria-label="공유 링크"]')?.value || ''), 5000));
      check('서버에 올린 방에 내 사진이 담긴다', await page.run(async pic => {
        const { decodeHome } = await import(new URL('src/share.js', document.baseURI).href);
        return window.__cloudSent.length === 1 && decodeHome(window.__cloudSent[0])?.picture === pic;
      }, firstPic));
      check('링크를 만든 뒤에는 링크 지우기 단추가 보인다', (await page.run(winText)).includes('링크 지우기'));
      await probe('링크를 만든 공유하기 창');
      // 아이디(src/cloud.js의 "아이디"): 링크를 만들면 아이디 칸이 생기고 닉네임이 미리 들어 있다. 꼴이 틀린 아이디와 남이 먼저 정한 아이디는 칸 아래에 알리고,
      // 정하면 칸이 읽기 전용이 되며 서버에 이 방의 번호로 남는다. 아이디 지우기는 한 번 더 묻고, 링크를 지우면 아이디도 같이 지운다(아래 링크 지우기)
      const idSubmit = v => { const i = document.querySelector('#windows .win input[aria-label="내 아이디"]'); if (!i) return false; i.value = v; i.dispatchEvent(new Event('input')); i.closest('form').requestSubmit(); return true; };
      const idError = () => { const e = document.querySelector('#windows .win .share-error'); return e && !e.hidden ? e.textContent : ''; };
      const clickExact = (sel, text) => { const el = [...document.querySelectorAll(sel)].find(b => b.textContent === text); if (!el) return false; el.click(); return true; };
      const noScroll = () => { const b = document.querySelector('#windows .win .win-body'); return !!b && b.scrollHeight <= b.clientHeight; };
      const handleIs = (want, server) => {
        const i = document.querySelector('#windows .win input[aria-label="내 아이디"]');
        const st = JSON.parse(localStorage.getItem('agarago.cloud') || '{}');
        return !!i && i.readOnly === !!want && (st.handle ?? null) === want && JSON.stringify(window.__handles[server] || null) === JSON.stringify(want ? { uid: 'fake-uid', room: st.id } : null);
      };
      check('링크를 만들면 아이디 칸이 생기고 닉네임이 미리 들어 있다', (await page.run(() => document.querySelector('#windows .win input[aria-label="내 아이디"]')?.value)) === '점검');
      await page.run(idSubmit, 'a');
      check('꼴이 틀린 아이디는 칸 아래에 꼴을 알린다', (await page.run(idError)) === '아이디는 한글, 영문, 숫자 2~12자입니다. 다시 입력해 주세요.');
      await page.run(idSubmit, '이웃집');
      check('남이 먼저 정한 아이디는 이미 사용 중이라고 알리고 친 글자를 칸에 남긴다', await until(page, () => {
        const e = document.querySelector('#windows .win .share-error');
        return !!e && !e.hidden && e.textContent === '이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.' && document.querySelector('#windows .win input[aria-label="내 아이디"]').value === '이웃집';
      }, 5000));
      check('아이디 칸 아래에 오류가 떠도 공유하기 창이 스크롤되지 않는다', await page.run(noScroll));
      await probe('아이디 오류가 뜬 공유하기 창');
      await page.run(idSubmit, ' Smoke Test ');
      check('아이디를 정하면 대문자와 띄어쓰기를 맞춘 아이디로 칸이 읽기 전용이 되고 서버에 이 방의 번호로 남는다', await until(page, handleIs, 5000, 'smoketest', 'smoketest')
        && (await page.run(() => document.querySelector('#windows .win input[aria-label="내 아이디"]').value)) === 'smoketest');
      check('아이디를 정한 공유하기 창이 스크롤되지 않는다', await page.run(noScroll));
      await probe('아이디를 정한 공유하기 창');
      await page.run(clickExact, '#windows .win .btn', '아이디 지우기');
      check('아이디 지우기를 누르면 지우기 전에 지운 아이디는 남이 정할 수 있다고 알린다', (await page.run(winText)).includes('지운 아이디는 다른 사람이 정할 수 있습니다.'));
      await page.run(clickExact, '#windows .win .btn', '지우기');
      check('지우기를 누르면 서버와 이 컴퓨터에서 아이디가 지워지고 칸에 닉네임이 다시 들어간다', await until(page, handleIs, 5000, null, 'smoketest')
        && (await page.run(() => document.querySelector('#windows .win input[aria-label="내 아이디"]').value)) === '점검');
      await page.run(idSubmit, '점검');
      check('닉네임 그대로 아이디를 정할 수 있다', await until(page, handleIs, 5000, '점검', '점검'));
      // 이름 바꾸기(F28): 링크를 만든 방은 이름을 바꾸면 3초 뒤 서버의 방도 새 이름으로 고친다(src/cloud.js의 syncLater).
      // 공유하기 창을 연 채로 바꾸면 인사말 칸에 보이는 "주인 이름의 컴퓨터"도 따라 바뀐다. 이름 바꾸기 창의 나머지는 시작 메뉴 점검에서 본다
      await page.run(clickOnce, '.start-btn');
      await page.run(clickOnce, '#start-menu .start-name');
      await until(page, () => !!document.querySelector('#windows .name-app'), 3000);
      check('링크를 만든 방의 이름 바꾸기 창은 링크로 오는 친구에게도 새 이름이 보인다고 알린다', await page.run(() => document.querySelector('.name-app .meta')?.textContent.startsWith('링크로 오는 친구에게도 새 이름이 보입니다.')));
      const sentBefore = await page.run(() => window.__cloudSent.length);
      await page.run(nameSubmit, '서버 이름');
      check('링크를 만든 방은 이름을 바꾸면 3초 뒤 서버의 방도 새 이름으로 바뀐다', await until(page, async n => {
        const { decodeHome } = await import(new URL('src/share.js', document.baseURI).href);
        return window.__cloudSent.length > n && decodeHome(window.__cloudSent.at(-1))?.owner === '서버 이름';
      }, 6000, sentBefore));
      check('공유하기 창을 연 채 이름을 바꾸면 인사말 칸의 이름도 바뀐다', await page.run(() => document.querySelector('#windows input[aria-label="화면 보호기 인사말"]')?.placeholder === '서버 이름의 컴퓨터'));
      await page.run(clickOnce, '.start-btn');
      await page.run(clickOnce, '#start-menu .start-name');
      await until(page, () => !!document.querySelector('#windows .name-app'), 3000);
      await page.run(nameSubmit, '점검');
      await until(page, () => !document.querySelector('#windows .name-app'), 3000);
      await page.run(clickText, '#windows .win .btn', '링크 지우기');
      check('링크 지우기를 누르면 지우기 전에 아이디도 지우고 이 링크가 더는 열리지 않는다고 알린다', (await page.run(winText)).includes('서버에서 방과 쪽지, 아이디를 지웁니다. 이 링크는 더는 열리지 않습니다.'));
      await page.run(clickText, '#windows .win .btn', '지우기');
      check('지우기를 누르면 링크 칸과 아이디 칸이 사라지고 링크 만들기로 돌아간다', await until(page, () => !document.querySelector('#windows .win input[aria-label="공유 링크"]')
        && !document.querySelector('#windows .win input[aria-label="내 아이디"]')
        && [...document.querySelectorAll('#windows .win .btn')].some(b => b.textContent === '링크 만들기')
        && !JSON.parse(localStorage.getItem('agarago.cloud') || '{}').id, 5000));
      check('링크를 지우면 서버와 이 컴퓨터에서 아이디도 지워진다', await page.run(() => !('점검' in window.__handles) && !JSON.parse(localStorage.getItem('agarago.cloud') || '{}').handle));
    }
    await closeWindows();
  }
  // 게임 폴더 안의 우리 게임과 새 탭 안내 창
  const games = await page.run(gameIds);
  await openIcon('games');
  await sleep(300);
  // 게임이 늘어 아이콘 칸이 다시 잘리면(스크롤이 생기면) 알린다. 창이 창 영역(1280×800px) 안에 드는지도 본다
  check('게임 폴더의 아이콘이 스크롤 없이 다 보인다', await page.run(() => { const g = document.querySelector('.folder-grid'); return !!g && g.scrollHeight <= g.clientHeight; }));
  check('게임 폴더 창이 창 영역 안에 든다', await page.run(() => { const r = document.querySelector('#windows .win').getBoundingClientRect(), s = document.querySelector('#windows').getBoundingClientRect(); return r.left >= s.left - 1 && r.right <= s.right + 1 && r.top >= s.top - 1 && r.bottom <= s.bottom + 1; }));
  for (const id of [...games.own, games.link].filter(Boolean)) {
    await page.run(clickTwice, `.folder-grid .desk-icon[data-app="${id}"]`);
    await sleep(600);
    await probe(`폴더 안의 ${id}`);
  }
  check('폴더 안의 게임과 새 탭 안내가 창으로 열린다', (await page.run(winCount)) === 1 + games.own.length + (games.link ? 1 : 0));
  check('우리 게임 창에 게임 페이지가 뜬다', await until(page, () => [...document.querySelectorAll('#windows iframe')].every(f => { try { return f.contentDocument.readyState === 'complete' && !!f.contentDocument.querySelector('canvas'); } catch { return false; } }), 8000));
  await closeWindows();

  // ---------- 창이 뒤로 가면 소리 끄기(F27) ----------
  // 화면 없는 크롬은 첫 진짜 입력 전까지 재생을 막고 페이지에 초점도 주지 않는다. 위에서 창 제목 줄을 진짜로 눌러(tap) 둘 다 풀려 있다.
  // 탭이 가려지는 것은 새 탭을 앞에 열어 진짜로 만든다. 다른 프로그램으로 넘어가는 것은 흉내 낼 수 없어서(초점 흉내 Emulation.setFocusEmulationEnabled를 꺼도 한번 받은 초점이 남는다)
  // document.hasFocus를 바꿔 끼우고 blur를 보낸다. 게임 창 안은 진짜로 누른다
  await page.run(catchAudio);
  await page.run(setSettings, { musicOn: false });
  await page.run(setSettings, { musicOn: true }); // 진짜로 누른 뒤에 배경음악을 다시 틀게 한다
  check('바탕화면의 방에서 배경음악이 난다', await until(page, musicIs, 3000, 'on'));
  let tab = (await page.send('Target.createTarget', { url: 'about:blank' })).targetId;
  check('다른 탭으로 넘어가면 1초 안에 배경음악이 꺼지고 곡은 멈추지 않는다', await until(page, musicIs, 1000, 'muted'));
  await page.send('Page.bringToFront');
  check('이 탭으로 돌아오면 1초 안에 배경음악이 다시 난다', await until(page, musicIs, 1000, 'on'));
  await page.send('Target.closeTarget', { targetId: tab });
  await page.run(() => { document.hasFocus = () => false; window.dispatchEvent(new Event('blur')); });
  check('다른 프로그램으로 넘어가면 1초 안에 배경음악이 꺼진다', await until(page, musicIs, 1000, 'muted'));
  const fx0 = await page.run(effectCount);
  await page.run(playEffect, 'mouse');
  check('뒤에 있는 동안에는 효과음을 내지 않는다', (await page.run(effectCount)) === fx0);
  await page.run(() => { delete document.hasFocus; window.dispatchEvent(new Event('focus')); });
  check('창으로 돌아오면 1초 안에 배경음악이 다시 난다', await until(page, musicIs, 1000, 'on'));
  await page.run(playEffect, 'mouse');
  check('창으로 돌아오면 효과음도 난다', (await page.run(effectCount)) === fx0 + 1);
  // 게임 창 안을 누르면 이 문서에 blur가 오지만 초점은 페이지 안(iframe)에 있으므로 끄지 않는다
  await openIcon('games');
  await sleep(300);
  await page.run(clickTwice, '.folder-grid .desk-icon[data-app="file-ten"]');
  check('파일 정리 10 창을 열면 그 게임의 배경음악이 난다', await until(page, () => {
    const f = document.querySelector('#windows iframe');
    const a = [...window.__audios].find(x => x.loop && !x.paused && !x.muted);
    try { return !!f.contentDocument.querySelector('canvas') && a.src.endsWith('bgm-file-ten.mp3'); } catch { return false; }
  }, 8000));
  await tap(page, await page.run(centreOf, '#windows iframe'));
  await sleep(1200);
  check('게임 창 안을 누르면 초점이 게임으로 가도 소리는 그대로 난다', (await page.run(() => document.activeElement?.tagName === 'IFRAME')) && (await page.run(musicIs, 'on')));
  // 제목 줄 단추와 제목 줄 두 번 누르기는 게임의 키보드 초점을 거두지 않고, 최소화한 창을 작업 표시줄에서 다시 띄우면 초점을 돌려준다.
  // 초점을 잃으면 그리기를 멈추는 게임은 그사이 창 크기가 바뀌면 게임 안을 누를 때까지 빈 화면이 된다(known-issues 91)
  const gameWin = '#windows .win:has(iframe)';
  const gameState = sel => ({ max: document.querySelector(sel).classList.contains('maximized'), hidden: document.querySelector(sel).hidden, frame: document.activeElement?.tagName === 'IFRAME' });
  await tap(page, await page.run(centreOf, `${gameWin} .win-max`));
  check('게임 창의 최대화 단추를 눌러도 초점이 게임에 남는다', JSON.stringify(await page.run(gameState, gameWin)) === '{"max":true,"hidden":false,"frame":true}');
  await tap(page, await page.run(centreOf, `${gameWin} .win-max`));
  check('되돌리기 단추를 눌러도 초점이 게임에 남는다', JSON.stringify(await page.run(gameState, gameWin)) === '{"max":false,"hidden":false,"frame":true}');
  for (let i = 0; i < 2; i++) await tap(page, await page.run(centreOf, `${gameWin} .win-title`));
  check('게임 창 제목 줄을 두 번 눌러 최대화해도 초점이 게임에 남는다', JSON.stringify(await page.run(gameState, gameWin)) === '{"max":true,"hidden":false,"frame":true}');
  await sleep(600);
  for (let i = 0; i < 2; i++) await tap(page, await page.run(centreOf, `${gameWin} .win-title`));
  await tap(page, await page.run(centreOf, `${gameWin} .win-min`));
  check('게임 창을 최소화하면 게임의 초점을 거둔다', JSON.stringify(await page.run(gameState, gameWin)) === '{"max":false,"hidden":true,"frame":false}');
  await tap(page, await page.run(centreOf, '#tasks .task:last-child'));
  check('작업 표시줄에서 다시 띄우면 초점이 게임으로 돌아간다', await until(page, sel => !document.querySelector(sel).hidden && document.activeElement?.tagName === 'IFRAME', 2000, gameWin));
  // 초점이 게임 안에 있으면 다른 프로그램으로 넘어가거나 돌아와도 이 문서에 blur와 focus가 오지 않는다(known-issues 74). hasFocus만 바꿔 끼운다
  await page.run(() => { document.hasFocus = () => false; });
  check('초점이 게임 안에 있을 때 다른 프로그램으로 넘어가면 알림이 없어도 1초 안에 꺼진다', await until(page, musicIs, 1000, 'muted'));
  await page.run(() => { delete document.hasFocus; });
  check('초점이 게임 안에 있을 때 돌아오면 알림이 없어도 1초 안에 다시 난다', await until(page, musicIs, 1000, 'on'));
  tab = (await page.send('Target.createTarget', { url: 'about:blank' })).targetId;
  check('초점이 게임 안에 있어도 다른 탭으로 넘어가면 꺼진다', await until(page, musicIs, 1000, 'muted'));
  await page.send('Page.bringToFront');
  check('초점이 게임 안에 있어도 돌아오면 다시 난다', await until(page, musicIs, 1000, 'on'));
  await page.send('Target.closeTarget', { targetId: tab });
  await closeWindows();
  // 소리를 꺼 둔 사용자는 창을 오가도 꺼진 그대로다(저장된 설정을 바꾸지 않는다)
  await page.run(setSettings, { sound: false });
  check('소리를 끄면 배경음악이 멈춘다', await until(page, musicIs, 2000, 'none'));
  tab = (await page.send('Target.createTarget', { url: 'about:blank' })).targetId;
  await sleep(300);
  await page.send('Page.bringToFront');
  await page.send('Target.closeTarget', { targetId: tab });
  await sleep(1200);
  check('소리를 꺼 둔 채 탭을 오가도 소리는 꺼진 그대로다', (await page.run(musicIs, 'none'))
    && (await page.run(() => JSON.parse(localStorage.getItem('agarago.settings') || '{}').sound)) === false);
  await page.run(setSettings, { sound: true });
  await page.run(clickOnce, '.start-btn');
  check('시작 단추를 누르면 시작 메뉴가 열린다', await page.run(() => !document.getElementById('start-menu').hidden && document.querySelectorAll('.start-item').length >= 8));
  await probe('시작 메뉴');
  check('시작 메뉴 맨 위에 내 사진이 있다', (await page.run(shownPic, '#start-menu .start-pic')) === firstPic);
  await page.run(clickOnce, '#start-menu .start-pic');
  check('내 사진을 누르면 시작 메뉴가 닫히고 사진 바꾸기 창이 열린다', await until(page, () => document.getElementById('start-menu').hidden && !!document.querySelector('#windows .pic-app'), 3000));
  await probe('사진 바꾸기 창');
  // 내 그림: 창에서 그림 파일을 고르면 줄여서 바로 저장하고, 시작 메뉴에 보인다. 공유하기의 "링크 만들기"가 서버에 올리는 글에도 담긴다.
  // 그 뒤 목록의 사진으로 돌아가 아래 점검을 잇는다
  await setFile(page, '.pic-app input[type="file"]', TEST_IMAGE);
  check('창에서 그림 파일을 고르면 내 그림으로 줄여 바로 저장하고 창 위의 사진이 바뀐다', await until(page, () => document.querySelector('.pic-app-head .user-pic')?.dataset.pic === 'my'
    && String(JSON.parse(localStorage.getItem('agarago.picture'))).startsWith('my:') && !document.querySelector('.pic-app .pic-choice[aria-pressed="true"]'), 5000));
  await closeWindows();
  await page.run(clickOnce, '.start-btn');
  check('내 그림이 시작 메뉴에 보인다', (await page.run(shownPic, '#start-menu .start-head')) === 'my');
  await page.run(clickOnce, '.start-btn');
  check('서버에 올리는 방 글자에는 내 그림이 담긴다', await page.run(async () => {
    const { decodeHome, encodeHome } = await import(new URL('src/share.js', document.baseURI).href);
    const { withPicture } = await import(new URL('src/user-pictures.js', document.baseURI).href);
    return decodeHome(encodeHome(withPicture(JSON.parse(localStorage.getItem('agarago.home.v3')))))?.picture === JSON.parse(localStorage.getItem('agarago.picture'));
  }));
  await closeWindows();
  await page.run(clickOnce, '.start-btn');
  await page.run(clickOnce, '#start-menu .start-pic');
  await until(page, () => !!document.querySelector('#windows .pic-app'), 3000);
  const nextPic = await page.run(pickOther, '.pic-app', firstPic);
  check('창에서 사진을 누르면 바로 저장되고 창 위의 사진이 바뀐다', nextPic && nextPic !== firstPic
    && (await page.run(() => JSON.parse(localStorage.getItem('agarago.picture')))) === nextPic && (await page.run(shownPic, '.pic-app-head')) === nextPic, nextPic);
  await closeWindows();
  await page.run(clickOnce, '.start-btn');
  check('바꾼 사진이 시작 메뉴에 보인다', (await page.run(shownPic, '#start-menu .start-head')) === nextPic);
  // 이름 바꾸기(F28): 시작 메뉴 맨 위의 내 이름을 누르면 이름 바꾸기 창이 열린다(src/user-name.js). 빈 이름은 안내만 띄우고 취소는 아무것도 바꾸지 않는다.
  // 사진을 고른 적 없는 사용자의 사진은 이름으로 정하므로(ownPicture), 이름을 바꿀 때 지금 사진을 저장해 그대로 둔다. 끝에 이름과 사진을 되돌린다
  check('시작 메뉴 맨 위에 내 이름 단추가 있다', await page.run(() => document.querySelector('#start-menu .start-name')?.textContent === '점검'));
  await page.run(clickOnce, '#start-menu .start-name');
  check('내 이름을 누르면 시작 메뉴가 닫히고 이름 바꾸기 창이 열린다', await until(page, () => document.getElementById('start-menu').hidden && !!document.querySelector('#windows .name-app'), 3000));
  await sleep(200);
  await probe('이름 바꾸기 창');
  check('이름 바꾸기 창의 입력 칸에 지금 이름이 골라져 있다', await page.run(() => {
    const input = document.querySelector('.name-app input[type="text"]');
    return input.value === '점검' && input.selectionStart === 0 && input.selectionEnd === 2;
  }));
  await page.run(nameSubmit, '  ');
  check('빈 이름으로 이름 바꾸기를 누르면 안내가 뜨고 이름은 그대로다', (await page.run(() => !document.querySelector('.name-app .like-error').hidden)) && (await page.run(savedOwner)) === '점검');
  await page.run(clickText, '#windows .name-app .btn', '취소');
  check('취소를 누르면 창이 닫히고 이름은 그대로다', (await page.run(() => !document.querySelector('#windows .name-app'))) && (await page.run(savedOwner)) === '점검');
  // 시작 메뉴의 로그아웃 바로 위에 글자로 된 "이름 바꾸기" 줄이 있다. 맨 위의 이름은 그냥 글자처럼 보여 찾기 어려웠다(known-issues 80)
  await page.run(clickOnce, '.start-btn');
  check('시작 메뉴의 로그아웃 바로 위에 이름 바꾸기 줄이 있다', await page.run(() => {
    const items = [...document.querySelectorAll('#start-menu .start-item')].map(b => b.textContent);
    const i = items.findIndex(t => t.includes('이름 바꾸기'));
    return i >= 0 && !!items[i + 1]?.includes('로그아웃');
  }));
  await page.run(clickText, '#start-menu .start-item', '이름 바꾸기');
  check('시작 메뉴의 이름 바꾸기 줄을 누르면 시작 메뉴가 닫히고 이름 바꾸기 창이 열린다', await until(page, () => document.getElementById('start-menu').hidden && !!document.querySelector('#windows .name-app'), 3000));
  await page.run(clickText, '#windows .name-app .btn', '취소');
  const namePic = await page.run(async () => {
    localStorage.removeItem('agarago.picture'); // 사진을 고른 적 없는 사용자처럼 둔다
    const { ownPicture } = await import(new URL('src/user-pictures.js', document.baseURI).href);
    return ownPicture('점검');
  });
  // 사진 바꾸기 창의 이름 옆 단추로도 연다. 사진 바꾸기 창을 연 채로 바꾸면 그 창 위의 이름도 바뀐다
  await page.run(clickOnce, '.start-btn');
  await page.run(clickOnce, '#start-menu .start-pic');
  await until(page, () => !!document.querySelector('#windows .pic-app'), 3000);
  await page.run(clickText, '#windows .pic-app-head .btn', '이름 바꾸기');
  check('사진 바꾸기 창의 이름 옆 단추를 누르면 이름 바꾸기 창이 열린다', await until(page, () => !!document.querySelector('#windows .name-app'), 3000));
  await page.run(nameSubmit, ' 바꾼 이름 ');
  check('이름을 바꾸면 앞뒤 공백을 지운 이름이 집에 저장되고 창이 닫히며 알린다', await until(page, () => !document.querySelector('#windows .name-app')
    && JSON.parse(localStorage.getItem('agarago.home.v3')).owner === '바꾼 이름' && document.getElementById('toast').textContent === '이름을 바꿨습니다.', 3000));
  check('사진을 고른 적 없는 사용자도 이름을 바꾸면 사진은 그대로다', (await page.run(() => JSON.parse(localStorage.getItem('agarago.picture')))) === namePic, namePic);
  check('사진 바꾸기 창을 연 채로 이름을 바꾸면 그 창 위의 이름도 바뀐다', await page.run(() => document.querySelector('#windows .pic-app-head b')?.textContent === '바꾼 이름'));
  await closeWindows();
  await page.run(clickOnce, '.start-btn');
  check('바꾼 이름이 시작 메뉴에 보인다', await page.run(() => document.querySelector('#start-menu .start-name')?.textContent === '바꾼 이름'));
  await page.run(clickOnce, '#start-menu .start-name');
  await until(page, () => !!document.querySelector('#windows .name-app'), 3000);
  await page.run(nameSubmit, '점검');
  await until(page, () => !document.querySelector('#windows .name-app'), 3000);
  await page.run(p => localStorage.setItem('agarago.picture', JSON.stringify(p)), nextPic); // 뒤의 손님 점검이 내 사진(nextPic)과 다른 사진을 친구 사진으로 고른다
  check('이름을 다시 바꾸면 처음 이름으로 돌아간다', (await page.run(savedOwner)) === '점검');

  // ---------- 기믹이 없는 가구의 혼잣말 ----------
  // 점검용 집의 침대에는 기믹이 없다. 두 번 누르면 아바타가 걸어가 data/furniture.js의 say를 말풍선 한 줄로 말한다(src/furniture-line.js)
  await use('bed', async () => {
    const b = document.querySelector('#wallpaper .room-avatar-say');
    if (!b || b.hidden) return false;
    const { BY_ID } = await import(new URL('data/furniture.js', document.baseURI).href);
    return !!BY_ID.bed.say && b.textContent === BY_ID.bed.say && b.offsetHeight < 2 * parseFloat(getComputedStyle(b).lineHeight);
  }, '아바타가 침대의 혼잣말을 한 줄로 말한다');
  check('혼잣말의 {시각}은 말로 읽는 시각이 되고, say가 없는 가구는 이름을 말한다', await page.run(async () => {
    const { furnitureLine } = await import(new URL('src/furniture-line.js', document.baseURI).href);
    const clock = { name: '시계', say: '벌써 {시각}이네.' };
    const at = (h, m) => furnitureLine(clock, new Date(2026, 10, 15, h, m));
    return [at(15, 40), at(15, 0), at(15, 30), at(0, 5), at(12, 59), furnitureLine({ name: '옷장' }), furnitureLine({ name: '소파' })].join('|')
      === '벌써 3시 40분이네.|벌써 3시 정각이네.|벌써 3시 반이네.|벌써 12시 5분이네.|벌써 12시 59분이네.|옷장이네.|소파네.';
  }));

  // ---------- 분신사바(F29) ----------
  // 말풍선에 분신사바를 말하면 불이 꺼지고 공포 모드가 된다(src/horror.js). 작업 표시줄 시계가 04:44에 멈추고, 벽에 건 것 하나(점검용 집은 코르크 보드)가 기울고,
  // 기믹이 없는 가구는 다른 혼잣말을 한다. 저장된 집과 밤 설정은 그대로다. 스탠드를 두 번 누르면 풀리고 아바타가 안도하는 한마디를 한다. 새로 고침해도 풀린다
  const horrorState = () => [document.getElementById('stage').dataset.theme, document.querySelector('#taskbar .clock').textContent,
    !!document.querySelector('#wallpaper .horror-dark'), [...document.querySelectorAll('#wallpaper .furn.askew')].map(f => f.dataset.id).join()].join('/');
  const sayWord = async word => {
    await page.run(() => document.querySelector('#desktop').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await press(page, 'Enter');
    await page.run(w => { document.querySelector('.say-input').value = w; }, word);
    await press(page, 'Enter');
  };
  const homeBefore = await page.run(() => localStorage.getItem('agarago.home.v3'));
  await sayWord('분신사바');
  check('말풍선에 분신사바를 말하면 불이 꺼지고 시계가 04:44에 멈추며 벽에 건 코르크 보드가 기운다',
    (await until(page, () => !!document.querySelector('#wallpaper .horror-dark'), 4000)) && (await page.run(horrorState)) === 'night/04:44/true/corkboard', await page.run(horrorState));
  check('불이 꺼지고 아바타가 첫마디를 한다', await until(page, async () => {
    const { START } = await import(new URL('src/horror.js', document.baseURI).href);
    return document.querySelector('#wallpaper .room-avatar-say')?.textContent === START;
  }, 4000));
  check('공포 모드는 집과 밤 설정을 저장하지 않는다', (await page.run(() => localStorage.getItem('agarago.home.v3'))) === homeBefore
    && (await page.run(() => JSON.parse(localStorage.getItem('agarago.settings') || '{}').night)) !== true);
  check('불빛은 한 번 어두워지거나 밝아지는 데 0.5초 넘게 걸린다(1초에 3번보다 느린 깜박임, WCAG 2.3.1)', await page.run(() => {
    const a = document.querySelector('#wallpaper .horror-dark')?.getAnimations()[0];
    if (!a) return false;
    const ms = a.effect.getTiming().duration;
    const k = a.effect.getKeyframes().map(f => ({ t: f.computedOffset * ms, v: Number(f.opacity) }));
    const steps = k.slice(1).map((f, i) => ({ dt: f.t - k[i].t, dv: f.v - k[i].v })).filter(s => s.dv !== 0);
    return steps.length >= 2 && steps.every(s => s.dt > 500);
  }));
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  check('움직임 줄이기를 켠 사람에게는 불빛이 깜박이지 않는다', await page.run(() => getComputedStyle(document.querySelector('#wallpaper .horror-dark')).animationName === 'none'));
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [] });
  await probe('분신사바');
  await page.run(clickOnce, '.start-btn');
  check('공포 모드의 시작 메뉴는 불 켜기를 보인다', await page.run(() => [...document.querySelectorAll('.start-item')].some(i => i.textContent.includes('불 켜기'))));
  await page.run(clickOnce, '.start-btn');
  await use('bed', async () => {
    const b = document.querySelector('#wallpaper .room-avatar-say');
    const { LINES } = await import(new URL('src/horror.js', document.baseURI).href);
    return !!b && !b.hidden && b.textContent === LINES.bed;
  }, '공포 모드에서는 아바타가 공포 모드의 혼잣말을 한다');
  await use('lamp', async () => {
    const { END } = await import(new URL('src/horror.js', document.baseURI).href);
    const hhmm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const clock = document.querySelector('#taskbar .clock').textContent;
    return document.getElementById('stage').dataset.theme === 'day' && !document.querySelector('#wallpaper .horror-dark, #wallpaper .furn.askew')
      && (clock === hhmm(new Date()) || clock === hhmm(new Date(Date.now() - 60000))) && document.querySelector('#wallpaper .room-avatar-say')?.textContent === END;
  }, '불이 켜지고 공포 모드가 풀리며 시계가 돌아오고 아바타가 안도하는 한마디를 한다');
  // 불이 꺼진 뒤 방이 보이는 동안 시간이 지나면 이상한 일이 하나씩 늘어난다(src/horror.js의 STEPS). 20~64초를 다 기다리지 않게
  // src/config.js의 HORROR를 페이지 안에서 줄인다(새로 고침하면 원래대로 돌아온다). 점검용 집의 벽에는 코르크 보드 하나뿐이라 tilt 단계에서 그것이 더 기운다
  await page.run(async () => Object.assign((await import(new URL('src/config.js', document.baseURI).href)).HORROR,
    { dark: 200, wonder: 300, tilt: 300, far: 900, near: 2800, menu: 4600, voice: 1500, turn: 200, flash: 700 }));
  const said = await page.run(async () => {
    const { HERE, BEHIND, HEARD, DONT, END } = await import(new URL('src/horror.js', document.baseURI).href);
    return { HERE, BEHIND, HEARD, DONT, END };
  });
  // 시작 메뉴의 불 켜기 단추. 글(마지막 span)이 want이고 아이콘 그림이 그대로인지 본다. 아이콘도 span이라 글만 바뀌어야 한다
  const lightLabelIs = want => {
    const b = [...document.querySelectorAll('.start-item')].find(i => i.lastElementChild?.textContent.startsWith('불 '));
    return !!b && b.lastElementChild.textContent === want && !!b.querySelector('.app-icon svg') && !b.querySelector('.app-icon').textContent.trim();
  };
  const lightLabel = () => [...document.querySelectorAll('.start-item')].map(i => `[${i.querySelector('.app-icon')?.textContent || ''}]${i.lastElementChild?.textContent}`).filter(t => t.includes('불 ')).join();
  await sayWord('분신사바 분신사바 오딧세이 꾸다사이');
  check('주문을 끝까지 외어도 공포 모드가 된다', await until(page, () => !!document.querySelector('#wallpaper .horror-dark'), 4000));
  check('tilt 단계: 벽에 건 것이 하나뿐인 방에서는 기운 코르크 보드가 더 기운다', await until(page, () => [...document.querySelectorAll('#wallpaper .furn.askew')]
    .map(f => f.dataset.id + (f.classList.contains('more') ? '+' : '')).join() === 'corkboard+', 3000));
  const far = await until(page, voiceSpot, 3000, said.HERE);
  check('far 단계: 아바타에게서 먼 빈칸에서 "여기야." 말풍선이 점선 테두리로 천천히 나타난다', !!far && far.empty && far.dist >= 8 && far.fade, JSON.stringify(far));
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  check('움직임 줄이기를 켠 사람에게는 빈칸의 말풍선이 그냥 뜨고 벽 가구는 바로 기운 채로 보인다', await page.run(() => {
    const v = document.querySelector('#wallpaper .horror-voice');
    const art = document.querySelector('#wallpaper .furn.askew > :not(.hit)');
    return !!v && getComputedStyle(v).animationName === 'none' && !!art && getComputedStyle(art).transitionDuration === '0s';
  }));
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [] });
  check('아바타가 "여기야." 쪽을 돌아본다', !!(await until(page, voiceSpot, 1200, said.HERE, 'looking')));
  const near = await until(page, voiceSpot, 4000, said.BEHIND);
  check('near 단계: 화면에서 아바타와 같은 높이의 바로 옆 빈칸에서 "바로 뒤야." 말풍선이 뜬다', !!near && near.empty && near.side, JSON.stringify(near));
  check('아바타가 "바로 뒤야." 쪽을 돌아본다', !!(await until(page, voiceSpot, 1200, said.BEHIND, 'looking')));
  check('말풍선이 사라지면 아바타가 "잘못 들었나?"라고 말한다', await until(page, want => !document.querySelector('#wallpaper .horror-voice')
    && document.querySelector('#wallpaper .room-avatar-say:not(.horror-voice)')?.textContent === want, 3000, said.HEARD));
  await sleep(700); // menu 단계(불이 꺼지고 방이 4.6초 보였을 때)가 지나기를 기다린다
  await page.run(clickOnce, '.start-btn');
  check('menu 단계 뒤에 시작 메뉴를 열면 불 켜기 글이 "불 켜지 마"로 보이고 아이콘은 그대로다', await page.run(lightLabelIs, said.DONT), await page.run(lightLabel));
  check('"불 켜지 마"는 잠깐 뒤에 "불 켜기 (낮)"로 돌아오고 아이콘도 남아 있다', await until(page, lightLabelIs, 2000, '불 켜기 (낮)'), await page.run(lightLabel));
  await page.run(clickOnce, '.start-btn');
  await page.run(clickOnce, '.start-btn');
  check('시작 메뉴를 다시 열면 불 켜기 글이 바뀌지 않는다(공포 모드마다 한 번)', await page.run(lightLabelIs, '불 켜기 (낮)'), await page.run(lightLabel));
  await page.run(clickText, '.start-item', '불 켜기');
  check('불을 켜면 늘어난 이상한 일이 모두 한 번에 풀린다', await until(page, want => document.getElementById('stage').dataset.theme === 'day'
    && !document.querySelector('#wallpaper .horror-dark, #wallpaper .furn.askew, #wallpaper .furn.more, #wallpaper .horror-voice')
    && document.querySelector('#wallpaper .room-avatar-say:not(.horror-voice)')?.textContent === want, 3000, said.END));
  // 단계가 다 지나기 전에 불을 켜도 모두 풀리고, 남은 단계(바로 뒤의 말풍선, 아바타의 대꾸)는 일어나지 않는다
  await sayWord('분신사바');
  check('다시 분신사바를 말하면 단계가 처음부터 다시 늘어난다', !!(await until(page, voiceSpot, 4000, said.HERE)));
  await page.run(clickOnce, '.start-btn');
  check('far 단계와 menu 단계 사이에는 시작 메뉴의 불 켜기 글이 그대로다', await page.run(lightLabelIs, '불 켜기 (낮)'), await page.run(lightLabel));
  await page.run(clickText, '.start-item', '불 켜기');
  await page.run(heard => {
    const layer = document.getElementById('wallpaper');
    window.__afterLight = [];
    new MutationObserver(() => {
      if (layer.querySelector('.horror-voice, .horror-dark, .furn.askew')) window.__afterLight.push('stage');
      if (layer.querySelector('.room-avatar-say:not(.horror-voice)')?.textContent === heard) window.__afterLight.push('heard');
    }).observe(layer, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  }, said.HEARD);
  await sleep(4000);
  check('far 단계 뒤에 불을 켜면 말풍선이 바로 사라지고 남은 단계는 일어나지 않는다', await page.run(() => document.getElementById('stage').dataset.theme === 'day'
    && !document.querySelector('#wallpaper .horror-voice, #wallpaper .furn.askew') && window.__afterLight.length === 0), await page.run(() => window.__afterLight.join()));
  await sayWord('분신사바');
  check('세 번째로 말해도 공포 모드가 된다', await until(page, () => !!document.querySelector('#wallpaper .horror-dark'), 4000));
  await open();
  await powerOn();
  await page.run(clickOnce, '.users .user:not(.neighbor)');
  check('새로 고침하면 공포 모드가 풀려 있다', (await desktop()) && (await page.run(horrorState)).startsWith('day/') && !(await page.run(() => !!document.querySelector('#wallpaper .horror-dark'))), await page.run(horrorState));

  // ---------- 비둘기 떼(F32) ----------
  // 말풍선에 999999999를 말하면 비둘기가 아홉 마리까지 창문으로, 창문이 없으면 현관문으로 줄줄이 날아 들어와 빈 바닥 칸에 서로 한 칸씩 띄워 내려앉고,
  // 두세 마리가 차례로 "구구" 한다(src/pigeon.js). 나타나는 때와 머무는 시간, 걷기까지 쉬는 시간(src/config.js의 PIGEON)은 페이지 안에서 바꾼다
  // (새로 고침하면 원래대로 돌아온다). 걷지 않게 해 두어야 선 칸이 정수로 읽힌다. 점검용 집에는 창문이 없어 현관문 앞(3, 10) 둘레에,
  // 왼쪽 벽에 창문을 단 집에서는 그 창문 앞(3, 3) 둘레에 내려앉는다. 머무는 시간이 지나거나, 아바타가 어느 비둘기의 둘레 여덟 칸에 들어오거나,
  // 비둘기 하나를 두 번 누르면 떼 전체가 조금씩 어긋나게 날아 나간다. 움직임 줄이기를 켠 사람에게는 날지 않고 내려앉을 칸에 바로 나타났다가
  // 그 자리에서 사라진다. 친구 집에서 말하면 오지 않는다(친구 집 절). 9마리가 함께 날 때 서로 겹치거나 가구 뒤로 숨지 않는지는 프레임을 받아 따로 봤다(일지)
  const pigeonTime = stay => page.run(async ms => Object.assign((await import(new URL('src/config.js', document.baseURI).href)).PIGEON, { come: 100, stay: [ms, ms], rest: [60000, 60000], coo: 800 }), stay);
  const COO = await page.run(async () => (await import(new URL('src/pigeon.js', document.baseURI).href)).COO);
  const MAX = await page.run(async () => (await import(new URL('src/config.js', document.baseURI).href)).PIGEON.max);
  // 떼가 칸 a 쪽에 앉았는지(칸 b보다 a에 평균으로 가까운지). 현관문 앞은 (3, 10), 왼쪽 벽 창문 앞은 (3, 3)이다
  const nearer = (cells, a, b) => { const d = p => cells.reduce((n, c) => n + Math.abs(c.x - p.x) + Math.abs(c.y - p.y), 0); return d(a) < d(b); };
  // 비둘기의 말풍선이 ms 동안 하나도 뜨지 않을 때까지 기다린다. "구구"를 차례로 하는 사이에는 0.3초씩 비어 있다
  const cooQuiet = async ms => {
    const t0 = Date.now();
    let since = Date.now();
    for (;;) {
      if (await page.run(() => !!document.querySelector('#wallpaper .room-pet-say:not([hidden])'))) since = Date.now();
      if (Date.now() - since >= ms) return true;
      if (Date.now() - t0 > 10000) return false;
      await sleep(100);
    }
  };
  // 떼가 다 내려앉을 때까지 기다린다(나는 비둘기가 없고 수가 1.7초 동안 그대로일 때). 공중에서 겹치지 않게 다음 비둘기가 1.5초까지 늦게 올 수 있다(src/pigeon.js의 WAIT_MAX)
  const landedFlock = async () => {
    const t0 = Date.now();
    let last = null;
    let since = Date.now();
    for (;;) {
      const s = await page.run(pigeonScene);
      const key = `${s.count}/${s.flying}`;
      if (key !== last) { last = key; since = Date.now(); }
      if ((s.count && !s.flying && Date.now() - since > 1700) || Date.now() - t0 > 12000) return s;
      await sleep(100);
    }
  };
  const pigeonGone = ms => until(page, () => !document.querySelector('#wallpaper .room-pet[data-pet^="pigeon/"]'), ms);
  await page.run(catchAudio); // 놀라 날아갈 때만 새소리를 한 번 내는지 본다
  await pigeonTime(60000);
  // 지켜보기(watchFlock)가 건 바로 뒤에 날아오른 비둘기도 세는지 가짜 비둘기 하나로 본다. 앉아 있는 가짜 비둘기가 있는 방에 지켜보기를 걸고,
  // 첫 20ms 확인이 오기 전에 날아오르게 한다(known-issues 108)
  const earlyTakeoff = await page.run(async src => {
    const fake = document.createElement('div');
    fake.className = 'room-pet';
    fake.dataset.pet = 'pigeon/gray';
    document.getElementById('wallpaper').append(fake);
    (0, eval)(`(${src})`)();
    fake.classList.add('flying');
    await new Promise(r => setTimeout(r, 100));
    clearInterval(window.__flockTimer);
    fake.remove();
    return window.__takeoff.length;
  }, watchFlock.toString());
  check('비둘기 지켜보기를 건 바로 뒤에 날아오른 비둘기도 날아오른 기록에 든다', earlyTakeoff === 1, `${earlyTakeoff}개`);
  await page.run(watchFlock);
  await sayWord('999999999');
  check('말풍선에 999999999를 말하면 회색 비둘기가 날개를 치며 날아 들어온다', await until(page, () => {
    const p = document.querySelector('#wallpaper .room-pet.flying[data-pet="pigeon/gray"]');
    return !!p && /^fly[12]$/.test([...p.querySelectorAll('g[data-frame]')].find(g => g.style.display !== 'none')?.dataset.frame || '');
  }, 3000));
  const byDoor = await landedFlock();
  check(`창문이 없는 집에서는 비둘기가 여러 마리(${MAX}마리까지) 현관문 앞의 빈 바닥 칸에 내려앉는다`, byDoor.count >= 2 && byDoor.count <= MAX && byDoor.look === 'pigeon/gray'
    && byDoor.floor && nearer(byDoor.cells, { x: 3, y: 10 }, { x: 3, y: 3 }), JSON.stringify(byDoor));
  check('내려앉은 비둘기는 어느 둘도 붙어 앉지 않는다(서로 둘레 한 칸을 비운다)', byDoor.apart >= 2, JSON.stringify(byDoor));
  await probe('비둘기 떼가 내려앉은 바탕화면');
  check('"구구" 말풍선은 두세 마리가 하나씩 차례로 띄운다', await until(page, () => window.__coo.birds >= 2, 6000) && await cooQuiet(1000)
    && await page.run(() => window.__coo.max === 1 && window.__coo.birds <= 3), JSON.stringify(await page.run(() => window.__coo)));
  await sayWord('999999999');
  const cooAgain = await page.run(pigeonScene);
  check('비둘기 떼가 와 있을 때 또 말하면 수는 그대로이고 한 마리가 한 번 더 운다', cooAgain.count === byDoor.count && cooAgain.says.length === 1 && cooAgain.says[0] === COO, JSON.stringify(cooAgain));
  // 아바타를 어느 비둘기의 둘레 칸으로 걷게 한다. 그 칸에 들어서면 떼 전체가 날아 나가야 한다. 가구에 막혀 걸어갈 수 없는 칸은 고르지 않는다
  const beside = await page.run(async () => {
    const { blockedOf } = await import(new URL('src/avatar.js', document.baseURI).href);
    const cellOf = el => { const s = (parseFloat(el.style.left) - 640) / 36, t = (parseFloat(el.style.top) - 270) / 18 - 1; return { x: Math.round((s + t) / 2), y: Math.round((t - s) / 2) }; };
    const birds = [...document.querySelectorAll('#wallpaper .room-pet[data-pet^="pigeon/"]')].map(cellOf);
    const blocked = blockedOf(JSON.parse(localStorage.getItem('agarago.home.v3')).scenes.room);
    const walker = document.querySelector('#wallpaper .room-avatar:not(.room-owner)');
    const me = cellOf({ style: { left: `${parseFloat(walker.style.left) + 32}px`, top: `${parseFloat(walker.style.top) + 100}px` } }); // 아바타 그림의 발끝(가로 가운데, 위에서 100px)
    const free = (x, y) => x >= 0 && y >= 0 && x < 12 && y < 12 && !blocked.has(`${x},${y}`) && !birds.some(o => o.x === x && o.y === y);
    const steps = new Map([[`${me.x},${me.y}`, 0]]); // 아바타가 걸어갈 수 있는 칸까지의 걸음 수
    const queue = [me];
    for (let i = 0; i < queue.length; i++) {
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const c = { x: queue[i].x + dx, y: queue[i].y + dy };
        if (!free(c.x, c.y) || steps.has(`${c.x},${c.y}`)) continue;
        steps.set(`${c.x},${c.y}`, steps.get(`${queue[i].x},${queue[i].y}`) + 1);
        queue.push(c);
      }
    }
    let best = null;
    for (const [k, d] of steps) {
      const [x, y] = k.split(',').map(Number);
      if (d > 0 && birds.some(b => Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) === 1) && (!best || d < best.d)) best = { x, y, d };
    }
    return best;
  });
  await page.run(watchFlock);
  await page.run(floorTap, beside.x, beside.y);
  check('아바타가 어느 비둘기의 바로 옆 칸까지 걸어가면 떼 전체가 머무는 시간(60초)을 채우지 않고 날아 나간다', await pigeonGone(8000), JSON.stringify(beside));
  const offs = await page.run(() => window.__takeoff);
  const spread = offs.length ? offs[offs.length - 1].t - offs[0].t : 0;
  check('떼는 한꺼번에 뜨지 않고 조금씩 어긋나게 날아오른다', offs.length === byDoor.count && spread >= 200 && spread <= 3000, JSON.stringify(offs));
  const walkedUp = await page.run(takePetSounds);
  check('아바타가 다가가 놀라 날아갈 때는 떼 전체가 새소리를 한 번만 낸다', walkedUp.played === 'pet-bird', JSON.stringify(walkedUp));
  await pigeonTime(4000);
  await sayWord('999999999');
  const toStay = await landedFlock();
  check('머무는 시간이 지나면 떼 전체가 날아 나가 방에서 사라진다', toStay.count >= 2 && await pigeonGone(9000), JSON.stringify(toStay));
  const quietLeave = await page.run(takePetSounds);
  check('머무는 시간이 다 되어 날아 나갈 때는 새소리를 내지 않는다', quietLeave.played === '' && quietLeave.made === '', JSON.stringify(quietLeave));
  await pigeonTime(60000);
  await sayWord('999999999');
  const toChase = await landedFlock();
  await page.run(clickTwice, '#wallpaper .room-pet[data-pet^="pigeon/"]');
  check('비둘기 하나를 두 번 누르면 아바타가 다가가고, 떼 전체가 머무는 시간을 채우지 않고 날아 나간다', toChase.count >= 2 && await pigeonGone(9000), JSON.stringify(toChase));
  const startled = await page.run(takePetSounds);
  check('놀라 날아갈 때는 두 번 누른 순간에 만들어 둔 새소리(pet-bird.mp3)를 한 번 낸다', startled.played === 'pet-bird' && startled.made === 'pet-bird', JSON.stringify(startled));
  // 창문을 단 집과 움직임 줄이기. 왼쪽 벽 침대 위에 창문을 걸고 새로 연다. 끝나면 점검용 집과 움직임 설정을 돌려놓고 다시 연다
  const pigeonHome = await page.run(() => localStorage.getItem('agarago.home.v3'));
  await page.run(() => {
    const home = JSON.parse(localStorage.getItem('agarago.home.v3'));
    home.scenes.room.push({ id: 'window', wall: 'L', x: 2, y: 2 });
    localStorage.setItem('agarago.home.v3', JSON.stringify(home));
  });
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await open();
  await powerOn();
  await page.run(clickOnce, '.users .user:not(.neighbor)');
  await desktop();
  await pigeonTime(3000);
  await page.run(() => {
    const layer = document.getElementById('wallpaper');
    window.__pigeonFlew = false;
    new MutationObserver(() => { if (layer.querySelector('.room-pet.flying')) window.__pigeonFlew = true; })
      .observe(layer, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  });
  await sayWord('999999999');
  const byWindow = await landedFlock();
  check('창문이 있는 집에서는 비둘기 떼가 창문 앞의 빈 바닥 칸에 서로 띄워 내려앉는다', byWindow.count >= 2 && byWindow.floor && byWindow.apart >= 2
    && nearer(byWindow.cells, { x: 3, y: 3 }, { x: 3, y: 10 }), JSON.stringify(byWindow));
  check('움직임 줄이기를 켠 사람에게는 비둘기가 날지 않고 내려앉을 칸에 바로 나타났다가 그 자리에서 사라진다',
    (await pigeonGone(8000)) && !(await page.run(() => window.__pigeonFlew)));
  await page.run(() => clearInterval(window.__flockTimer));
  await page.run(home => localStorage.setItem('agarago.home.v3', home), pigeonHome);
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [] });
  await open();
  await powerOn();
  await page.run(clickOnce, '.users .user:not(.neighbor)');
  await desktop();

  // ---------- 가구 가까이 보기 ----------
  const closed = () => !document.querySelector('.closeup');
  await use('bookshelf', () => !!document.querySelector('.closeup .book-cover'), '책장이 열린다');
  const title0 = await page.run(() => document.querySelector('.closeup .book-title').textContent);
  await press(page, 'ArrowRight');
  check('책장에서 방향키로 다음 책으로 넘어간다', (await page.run(() => document.querySelector('.closeup .book-title').textContent)) !== title0);
  await page.run(clickOnce, '.closeup .book-spine.add');
  // 넷째 책은 띄어쓰기와 영문이 섞인 18자 제목이다. 책등에 한 줄로 들지 않아 두 줄로 쓰고, 말줄임표 없이 다 보여야 한다(known-issues 83)
  await page.run(() => { const f = document.querySelector('.closeup form'); f.querySelector('input').value = '처음 배우는 알고리즘 with 파이썬'; f.requestSubmit(); });
  check('18자 제목의 책은 책등에 두 줄로 다 보인다', await page.run(() => {
    const spine = [...document.querySelectorAll('.closeup .book-spine:not(.add)')][3];
    const span = spine?.querySelector('span');
    return !!span && span.classList.contains('two') && !spine.title && span.scrollHeight <= span.clientHeight + 1 && span.scrollWidth <= span.clientWidth + 1;
  }));
  const colors = (await page.run(savedHome)).likes.bookshelf.map(b => b.color);
  check('새 책이 저장되고 색이 앞 책과 다르다', colors.length === 4 && colors[3] !== colors[2] && colors[3] >= 0 && colors[3] < 8, colors.join());
  await page.run(clickText, '.closeup .shelf-tools .btn', '고치기');
  await sleep(200); // 넣는 칸은 0.05초 뒤에 제목 칸에 초점을 준다
  await probe('책 고치기');
  await press(page, 'Escape');
  check('넣는 칸에서 Esc는 칸만 빠져나온다', await page.run(() => !!document.querySelector('.closeup') && document.activeElement.tagName !== 'INPUT'));
  await press(page, 'Escape');
  check('한 번 더 누르면 책장이 닫힌다', await page.run(closed));

  await use('tv', () => !!document.querySelector('.closeup .tv-row'), 'TV가 열린다');
  // 내 집의 TV는 화면 아래 띠에 숨은 기능의 소문(src/secrets.js의 HINTS) 한 줄을 띄우고, 다음에 켤 때 보일 차례를 설정(tvHint)에 남긴다
  const tvHint = () => page.run(async () => {
    const { HINTS } = await import(new URL('src/secrets.js', document.baseURI).href);
    const strip = document.querySelector('.closeup .tv-hint');
    const text = strip?.querySelector('span')?.textContent;
    return { label: strip?.querySelector('b')?.textContent, at: HINTS.indexOf(text), next: JSON.parse(localStorage.getItem('agarago.settings')).tvHint, n: HINTS.length,
      line: !!strip && strip.getBoundingClientRect().bottom <= document.querySelector('.closeup .tv-screen').getBoundingClientRect().bottom + 0.5 };
  });
  const hint1 = await tvHint();
  check('내 집의 TV를 켜면 화면 맨 아래 띠에 소문 한 줄이 뜨고 다음 차례가 저장된다', hint1.label === '소문' && hint1.at >= 0 && hint1.line && hint1.next === (hint1.at + 1) % hint1.n, JSON.stringify(hint1));
  await page.run(clickText, '.closeup .tv-tools .btn', '작품 넣기');
  await sleep(200);
  await probe('TV 작품 찾기');
  await page.run(clickText, '.closeup .link-row .btn', '직접 넣기');
  await sleep(200);
  await probe('TV 직접 넣기');
  await page.run(() => document.activeElement?.blur());
  await press(page, 'Escape');
  check('TV가 Esc로 꺼진다', await page.run(closed));
  await use('tv', () => !!document.querySelector('.closeup .tv-hint'), 'TV가 다시 켜진다');
  const hint2 = await tvHint();
  check('TV를 다시 켜면 다음 소문이 뜬다', hint2.at === hint1.next && hint2.next === (hint2.at + 1) % hint2.n, JSON.stringify(hint2));
  await press(page, 'Escape');
  await until(page, closed, 3000);

  await use('console', () => !!document.querySelector('.closeup .console-grid'), '게임기가 열린다');
  check('주인이 고른 추천 게임이 맨 앞에 선다', await page.run(() => document.querySelector('.closeup .console-game')?.dataset.app === 'file-ten' && !!document.querySelector('.closeup .console-game .console-pick')));
  if (await page.run(clickOnce, '.closeup .console-game.external')) {
    await sleep(200);
    check('게임기에서 새 탭 게임을 고르면 열리는 곳을 먼저 보여 준다', await page.run(() => !!document.querySelector('.closeup .console-ask a[target="_blank"]')));
    await probe('게임기의 새 탭 안내');
  }
  await page.run(() => document.activeElement?.blur());
  await press(page, 'Escape');
  check('게임기가 Esc로 내려간다', await page.run(closed));

  await use('radio', () => !!document.querySelector('.closeup form'), 'CD가 없는 라디오는 넣는 칸이 열린다');
  await page.run(() => { const f = document.querySelector('.closeup form'); f.querySelector('input').value = 'https://example.com/'; f.requestSubmit(); });
  check('라디오에 음악 서비스가 아닌 주소를 넣으면 안내가 뜬다', await page.run(() => !document.querySelector('.closeup .like-error').hidden));
  // 애플 뮤직 플레이리스트는 이름을 받아 올 길이 없다(서버에 묻지 않는다). 이름을 비우면 안내가 뜨고, 이름과 색을 넣으면 그대로 저장되고 보인다
  await page.run(() => { const f = document.querySelector('.closeup form'); f.querySelector('input').value = 'https://music.apple.com/kr/playlist/x/pl.u-abcdefgh'; f.requestSubmit(); });
  check('이름을 받아 올 수 없는 CD를 이름 없이 넣으면 이름을 넣으라고 한다', await until(page, () => /이름을 넣어/.test(document.querySelector('.closeup .like-error')?.textContent || ''), 4000));
  await page.run(() => {
    const f = document.querySelector('.closeup form');
    f.querySelectorAll('input')[1].value = '비 오는 날 듣는 노래';
    f.querySelector('.cd-swatch[data-color="3"]').click();
    f.requestSubmit();
  });
  const cd = (await page.run(savedHome)).likes.radio?.[0];
  check('CD 이름과 색이 저장된다', cd?.name === '비 오는 날 듣는 노래' && cd?.color === 3, JSON.stringify(cd));
  check('펼친 CD에 넣은 이름과 색이 보인다', await page.run(() => {
    const pick = document.querySelector('.closeup .cd-pick');
    return pick?.querySelector('.cd-name').textContent === '비 오는 날 듣는 노래' && pick.querySelector('.cd').dataset.color === '3';
  }));
  await probe('CD 한 장을 넣은 라디오');
  await page.run(clickText, '.closeup .radio-tools .btn', 'CD 넣기');
  await sleep(200);
  check('다음 CD는 다른 CD가 쓰지 않은 색이 먼저 골라져 있다', await page.run(() => document.querySelector('.closeup .cd-swatch[aria-pressed="true"]')?.dataset.color === '0'));
  await probe('두 번째 CD 넣기');
  // 새 유튜브 CD는 넣기 전에 유튜브 oEmbed로 재생할 수 있는지 본다(fakeYouTube가 대신 답한다). 없는 영상은 넣지 않는다
  await page.run(fakeYouTube);
  await page.run(() => {
    const [url, name] = document.querySelectorAll('.closeup form input');
    url.value = 'https://youtu.be/aaaaaaaaaaa';
    name.value = '없는 노래';
    document.querySelector('.closeup form').requestSubmit();
  });
  check('유튜브에 없는 영상은 넣지 않고 안내가 뜬다', await until(page, () => /찾을 수 없는 영상/.test(document.querySelector('.closeup .like-error')?.textContent || ''), 4000));
  // 찾을 수 없다는 답은 받아 두지 않는다. 주인이 유튜브에서 고친 뒤 넣기를 다시 누르면 다시 묻는다(known-issues 71)
  await page.run(() => document.querySelector('.closeup form').requestSubmit());
  check('유튜브가 찾지 못한 주소는 넣기를 다시 누르면 다시 묻는다', await until(page, () => window.__oembed['https://www.youtube.com/watch?v=aaaaaaaaaaa'] === 2, 4000));
  await page.run(putYouTube, 'https://music.youtube.com/playlist?list=PLsmokePrivate0000&si=smoke');
  check('찾을 수 없는 재생목록은 넣지 않고 공개로 바꾸라고 알린다', await until(page, radioErrorShows, 4000, '찾을 수 없는 재생목록입니다.*비공개라면 공개로 바꿔'));
  // 다른 사이트에서 재생을 막은 재생목록(oEmbed 401)에 영상이라고 알리거나 일부 공개로 바꾸라고 하면 안 된다(known-issues 79). 같은 안내가 연달아 뜨지 않게 영상을 사이에 둔다
  await page.run(putYouTube, 'https://music.youtube.com/playlist?list=PLsmokeBlocked0000&si=smoke');
  check('막힌 재생목록은 재생목록이라고 알리고 공개로 바꾸거나 곡 하나를 넣으라고 한다', await until(page, radioErrorShows, 4000, '재생할 수 없는 재생목록입니다.*공개로 바꾸거나 곡 하나의 주소'));
  await page.run(putYouTube, 'https://youtu.be/BlockedVid1');
  check('막힌 영상은 영상이라고 알리고 다른 영상의 주소를 넣으라고 한다', await until(page, radioErrorShows, 4000, '재생할 수 없는 영상입니다.*다른 영상의 주소'));
  // 유튜브가 403으로 답하는 재생목록(2026-11-15에 비공개로 보인 재생목록)도 넣지 않는다. 번호를 몰라 답 없음으로 지나치면 확인 없이 들어간다
  await page.run(putYouTube, 'https://music.youtube.com/playlist?list=PLsmokeForbidden00&si=smoke');
  check('403으로 답하는 재생목록도 막힌 재생목록으로 알린다', await until(page, radioErrorShows, 4000, '재생할 수 없는 재생목록입니다.*공개로 바꾸거나'));
  check('막힌 CD는 라디오에 들어가지 않는다', (await page.run(savedHome)).likes.radio?.length === 1);
  // 유튜브 뮤직 주소를 넣으면 이름 칸이 채워지고, CD는 같은 영상의 유튜브 주소로 저장된다
  await page.run(() => {
    const [url, name] = document.querySelectorAll('.closeup form input');
    name.value = '';
    url.value = 'https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=smoke';
    url.dispatchEvent(new Event('input'));
  });
  check('유튜브 주소를 넣으면 받아 온 이름이 이름 칸에 채워진다', await until(page, () => document.querySelectorAll('.closeup form input')[1].value === '점검용 유튜브 노래', 3000));
  await page.run(() => document.querySelector('.closeup form').requestSubmit());
  check('유튜브 뮤직 주소의 CD는 같은 영상의 유튜브 주소로 저장된다', await until(page, () => {
    const cd = JSON.parse(localStorage.getItem('agarago.home.v3')).likes.radio?.[1];
    return cd?.url === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' && cd.name === '점검용 유튜브 노래';
  }, 5000));

  // 유튜브 재생목록 CD에만 음악 창의 플레이어 아래에 이전 곡, 다음 곡 단추가 뜬다. 유튜브의 플레이어와 API 스크립트는 받지 않으므로(main의 BLOCKED)
  // 가짜 플레이어(fakePlayer)로 단추가 언제 쉬고 켜지는지, 무슨 명령을 보내는지를 본다. 곡이 실제로 넘어가는지는 진짜 유튜브가 필요해 직접 본다
  // (localhost에서. 127.0.0.1에서는 유튜브가 막는다, known-issues 69)
  const LIST = 'https://www.youtube.com/playlist?list=PLsmokeList00000';
  const LIST2 = 'https://www.youtube.com/playlist?list=PLsmokeList00001';
  const NAMES_H = 56; // 이름 줄 칸: 위 8px, 두 줄 40px, 아래 7px, 구분선 1px
  // 재생목록 곡 40개. 번호 i의 id는 smokeTrk에 세 글자를 붙인 11자이고 이름은 "점검용 곡 <세 글자>"다(fakeYouTube). 몇 곡은 일부러 이름을 받지 못하게 한다
  // (5번 Blk는 401, 7번 Gon은 404, 9번 Err은 500이라 받아 두지 않는다, 11번 Lng은 줄임표로 잘릴 만큼 긴 이름)
  const TRACKS = Array.from({ length: 40 }, (_, i) => `smokeTrk${String(i + 1).padStart(3, '0')}`);
  Object.assign(TRACKS, { 5: 'smokeTrkBlk', 7: 'smokeTrkGon', 9: 'smokeTrkErr', 11: 'smokeTrkLng' });
  const trackName = i => `점검용 곡 ${String(i + 1).padStart(3, '0')}`;
  const LONG_TITLE = '아주 긴 곡 이름 '.repeat(8).trim();
  const trackNow = () => page.run(trackState);
  // 가짜 플레이어 p(마지막으로 만든 것)를 곡 n번으로 옮기고 상태를 알린다. 단추를 누른 것이 아니라 곡이 저절로 넘어간 경우다
  // 목록 창의 n번째 줄(0부터)에 이름이 들어올 때까지 기다린다. 줄이 보인다는 알림(IntersectionObserver)은 그림이 한 장 그려진 뒤에 오는데,
  // 화면 없는 크롬은 가만히 두면 그림을 드문드문 그려서 정해 둔 시간만 자고 읽으면 가끔 빈다(known-issues 86)
  const rowNamed = (n, name) => until(page, (i, want) => document.querySelectorAll('#windows .radio-track')[i]?.lastElementChild.textContent === want, 5000, n, name);
  // 이름 요청이 더 늘지 않을 때까지 기다린다(이미 보낸 요청이 다 끝나고 새 요청이 없다)
  const quiet = async () => {
    let before = -1;
    for (let i = 0; i < 40; i++) {
      const n = await page.run(() => Object.keys(window.__oembed).length + window.__oembedLive);
      if (n === before) return true;
      before = n;
      await sleep(250);
    }
    return false;
  };
  // 이름 두 줄이 "이전: 이름|다음: 이름"이 될 때까지 기다린다(이름은 oEmbed로 받아 늦게 들어온다)
  const namesAre = (prev, next) => until(page, want => [...document.querySelectorAll('#windows .radio-player-tracks .radio-track-line')]
    .map(p => `${p.firstChild.textContent} ${p.lastChild.textContent}`).join('|') === want, 4000, `이전: ${prev}|다음: ${next}`);
  const autoTo = n => page.run(i => { const p = window.__yt.at(-1); p.index = i; p.state(1); }, n);
  const addCd = async (url, count) => {
    await page.run(clickText, '.closeup .radio-tools .btn', 'CD 넣기');
    await until(page, () => !!document.querySelector('.closeup form'), 3000);
    await page.run(putYouTube, url);
    return until(page, n => JSON.parse(localStorage.getItem('agarago.home.v3')).likes.radio?.length === n, 6000, count);
  };
  check('유튜브 재생목록 CD를 넣는다', await addCd(LIST, 3));
  check('스포티파이 앨범 CD를 넣는다', await addCd('https://open.spotify.com/album/1A2B3C4D5E6F7G8H9I0J1K', 4));
  check('재생목록 CD를 하나 더 넣는다', await addCd(LIST2, 5));
  // 펼친 줄에서 CD를 골라 음악 창이 그 CD의 플레이어로 바뀔 때까지 기다린다(src가 가리키는 곳은 CD마다 다르다)
  const playCd = async (link, embed) => {
    await page.run(l => document.querySelector(`.closeup .cd-pick[data-link="${l}"]`).click(), link);
    return until(page, e => (document.querySelector('#windows .radio-player iframe')?.src || '').includes(e), 6000, embed);
  };
  await page.run(fakePlayer);
  const errorsBefore = page.pageErrors.length;
  check('재생목록 CD를 고르면 음악 창이 열린다', await playCd(LIST, 'videoseries?list=PLsmokeList00000'));
  await sleep(100);
  let skip = await page.run(skipState);
  check('재생목록 CD에는 플레이어 아래에 이전 곡, 다음 곡, 목록 보기 단추가 뜬다', skip?.shown && skip.below && skip.texts.join() === '이전 곡,다음 곡,목록 보기', JSON.stringify(skip));
  check('단추의 툴팁은 명사형 15자 이하다', skip.titles.every(t => t && t.length <= 15 && !/[다요]$/.test(t)), skip.titles.join(' / '));
  check('단추를 놓아도 플레이어는 200×200px 이상이고 단추는 플레이어에 겹치지 않고 창 안에 들며 안내 줄도 다 보인다', skip.frameW >= 200 && skip.frameH >= 200 && skip.below && skip.inside && skip.noteFits, JSON.stringify(skip));
  check('플레이어가 명령을 받을 수 있기 전에는 쉬는 단추다', skip.disabled.every(Boolean));
  await page.run(() => document.querySelectorAll('#windows .radio-player-skips .btn').forEach(b => b.click()));
  check('쉬는 단추를 눌러도 플레이어에 명령이 가지 않는다', (await page.run(() => window.__yt.at(-1).calls)).length === 0);
  // 이름 두 줄은 곡 정보를 받기 전에도 자리가 있어(…) 준비된 뒤에 창이 움직이지 않는다. 가짜 플레이어에 곡 40개를 정해 두고 준비되었다고 알린다
  let tr = await trackNow();
  check('준비되기 전에도 이름 두 줄 자리가 있고(…) "목록 보기"는 쉰다', tr.shown && tr.namesH === NAMES_H && tr.names.join('|') === '이전: …|다음: …' && tr.btn?.off === true && tr.btn.text === '목록 보기' && tr.btn.title === '곡 목록 창 열기', JSON.stringify(tr));
  check('이름 줄은 20px씩 두 줄이다', tr.lineH.join() === '20,20', tr.lineH.join());
  await probe('재생목록 음악 창');
  await page.run(ids => { const p = window.__yt.at(-1); p.setList(ids, 0); p.ready(); }, TRACKS);
  skip = await page.run(skipState);
  check('플레이어가 준비되면 단추가 켜진다', skip.disabled.every(d => !d));
  check('준비되면 첫 곡이라 이전 곡은 없음이고 다음 곡의 이름이 oEmbed로 들어온다', await namesAre('없음', trackName(1)));
  tr = await trackNow();
  check('이름이 아닌 글(없음)은 옅게 쓰고 이름은 그대로 쓴다', tr.dim.join() === 'true,false', tr.dim.join());
  check('이름 줄을 채워도 줄은 20px이고 창 높이는 그대로다', tr.lineH.join() === '20,20' && tr.namesH === NAMES_H && (await page.run(skipState)).winH === skip.winH, `${tr.lineH.join()} ${tr.namesH}`);
  const [listWinH, listRowH, listNamesH] = [skip.winH, skip.rowH, tr.namesH];
  await page.run(clickText, '#windows .radio-player-skips .btn', '다음 곡');
  check('다음 곡을 누르면 두 줄이 한 곡씩 넘어간다', await namesAre(trackName(0), trackName(2)));
  await page.run(clickText, '#windows .radio-player-skips .btn', '이전 곡');
  check('이전 곡을 누르면 두 줄이 한 곡씩 돌아온다', await namesAre('없음', trackName(1)));
  check('다음 곡을 누르면 nextVideo를, 이전 곡을 누르면 previousVideo를 부른다', (await page.run(() => window.__yt.at(-1).calls)).join() === 'nextVideo,previousVideo');
  // 단추를 누르지 않고 곡이 저절로 넘어가도 두 줄이 따라 바뀐다(플레이어가 곡을 바꾸고 상태만 알린다). 4번(0부터)의 다음 곡은 5번 Blk(401)다
  await autoTo(4);
  check('곡이 저절로 넘어가면 이름 줄이 바뀌고, 이름을 알려 주지 않는 곡(401)은 제목 없음이다', await namesAre(trackName(3), '제목 없음'));
  await autoTo(8);
  check('지워진 곡(404)과 이름을 받지 못한 곡(500)도 제목 없음이다', await namesAre('제목 없음', '제목 없음'));
  const askedErr = () => page.run(() => Object.entries(window.__oembed).filter(([u]) => u.endsWith('smokeTrkErr')).reduce((n, [, c]) => n + c, 0));
  const errAsked = await askedErr();
  await autoTo(10);
  check('한 줄에 다 들어가지 않는 이름은 줄임표로 자르고 줄은 늘지 않으며 풍선 도움말에 이름이 다 있다', await namesAre('제목 없음', LONG_TITLE));
  tr = await trackNow();
  check('긴 이름은 20px 한 줄에서 잘린다', tr.lineH.join() === '20,20' && tr.nameCut.join() === 'false,true' && tr.lineTitle[1] === LONG_TITLE && tr.namesH === NAMES_H, JSON.stringify(tr));
  check('이름을 받지 못한 곡(500)은 받아 두지 않고 다시 보일 때 다시 묻는다', (await askedErr()) > errAsked);
  await autoTo(39);
  check('마지막 곡은 다음 곡이 없음이다', await namesAre(trackName(38), '없음'));
  check('같은 곡의 이름은 한 번만 묻는다', await page.run(() => Object.entries(window.__oembed).filter(([u]) => /smokeTrk\d{3}$/.test(u)).every(([, n]) => n === 1)));

  // ---------- 곡 목록 창 ----------
  await autoTo(12);
  await page.run(clickText, '#windows .radio-player-skips .btn', '목록 보기');
  check('"목록 보기"를 누르면 곡 목록 창이 열린다', await until(page, () => !!document.querySelector('#windows .radio-tracks'), 3000));
  await rowNamed(12, trackName(12));
  await quiet();
  tr = await trackNow();
  check('목록 창은 40곡을 한 줄씩 보이고 지금 곡(13번째)을 표시한다', tr.winTitle === '곡 목록' && tr.rows === 40 && tr.now === 12 && tr.pos === '13 / 40' && tr.cd === '점검용 유튜브 노래', JSON.stringify({ ...tr, rowNames: 0, rowH: 0 }));
  check('목록 창의 줄은 30px이고 이름이 길어도 줄이 늘지 않는다', tr.rowH.every(x => x === 30), tr.rowH.join());
  check('곡이 200곡보다 적으면 목록 끝의 안내가 없다', tr.note === undefined, tr.note);
  check('곡이 많으면 목록이 스크롤되고 지금 곡이 보이는 곳으로 열린다', tr.scrolls && tr.scrollTop > 0 && tr.nowShown, JSON.stringify({ scrolls: tr.scrolls, top: tr.scrollTop, shown: tr.nowShown }));
  check('목록 창은 음악 창 바로 아래 같은 왼쪽 끝에 바탕화면 안에 선다', tr.below && tr.sameLeft && tr.inDesk, JSON.stringify({ below: tr.below, same: tr.sameLeft, desk: tr.inDesk, h: tr.winH }));
  check('보이는 줄의 이름만 받는다(지금 곡의 줄은 이름이 있고 멀리 있는 줄은 …이며 묻지도 않는다)', tr.rowNames[12] === trackName(12) && tr.rowNames[39] === '…' && tr.rowNames[30] === '…'
    && await page.run(() => !Object.keys(window.__oembed).some(u => u.endsWith('smokeTrk031'))), `${tr.rowNames[12]} / ${tr.rowNames[39]} / ${tr.titled}줄`);
  // 5, 7, 9번 줄(0부터)은 이름을 받지 못하는 곡(401, 404, 500)이고 11번 줄은 긴 이름이다. 목록 칸 높이에 기대지 않게 그 줄들이 보이는 곳으로 스크롤해서 본다
  await page.run(() => { document.querySelector('#windows .radio-tracks-list').scrollTop = 120; });
  check('이름을 받지 못한 줄(401, 404, 500)은 제목 없음이고 긴 이름은 그대로 들어온다', await until(page, n => {
    const r = [...document.querySelectorAll('#windows .radio-track')];
    return [5, 7, 9].every(i => r[i]?.lastElementChild.textContent === '제목 없음') && r[11]?.lastElementChild.textContent === n;
  }, 4000, LONG_TITLE));
  check('긴 이름의 줄도 30px이고 한 줄에서 잘리며 풍선 도움말에 이름이 다 있다', await page.run(n => {
    const row = document.querySelectorAll('#windows .radio-track')[11];
    const name = row.lastElementChild;
    return row.offsetHeight === 30 && name.scrollWidth > name.clientWidth && row.title === n;
  }, LONG_TITLE));
  // 20번째 줄(19번)이 보이는 곳으로 스크롤해 두고 눌러, 아래에서 곡이 저절로 넘어갈 때 목록을 따라가던 사람인 것을 만든다
  await page.run(() => { document.querySelector('#windows .radio-tracks-list').scrollTop = 480; });
  await probe('곡 목록 창');
  await page.run(() => document.querySelectorAll('#windows .radio-track')[19].click());
  check('목록의 줄을 누르면 그 곡으로 건너뛴다(playVideoAt)', await until(page, () => window.__yt.at(-1).calls.includes('playVideoAt:19')
    && document.querySelector('#windows .radio-tracks .radio-track[aria-current="true"] .radio-track-no')?.textContent === '20', 3000));
  check('건너뛰면 이름 줄도 따라 바뀐다', await namesAre(trackName(18), trackName(20)));
  // 목록을 따라가던 사람에게는 곡이 저절로 멀리 넘어가도 지금 곡이 보이는 곳에 있고, 다른 곳을 보고 있었으면 목록을 움직이지 않는다
  await autoTo(2);
  tr = await trackNow();
  check('목록을 따라가던 중 곡이 넘어가면 지금 곡이 보인다', tr.now === 2 && tr.nowShown && tr.pos === '3 / 40', JSON.stringify({ now: tr.now, shown: tr.nowShown, top: tr.scrollTop }));
  // 줄이 보이는 것을 브라우저가 알려 주는 것(IntersectionObserver)은 다음 그림 한 장이 그려진 뒤에 온다. 이름이 들어온 것을 보고 나서 멀리 스크롤한다
  check('목록이 스크롤되어 보이게 된 줄은 이름을 받는다', await until(page, n => document.querySelectorAll('#windows .radio-track')[2]?.lastElementChild.textContent === n, 3000, trackName(2)));
  await page.run(() => { document.querySelector('#windows .radio-tracks-list').scrollTop = 99999; });
  check('아래로 멀리 스크롤하면 새로 보이게 된 줄의 이름을 받는다', await rowNamed(39, trackName(39)));
  const away = await trackNow();
  await autoTo(3);
  tr = await trackNow();
  check('다른 곳을 보고 있으면 곡이 넘어가도 목록은 움직이지 않는다', tr.now === 3 && !tr.nowShown && tr.scrollTop === away.scrollTop, JSON.stringify({ now: tr.now, shown: tr.nowShown, top: tr.scrollTop, was: away.scrollTop }));
  check('이름을 묻는 요청은 한꺼번에 네 개를 넘지 않는다', await page.run(() => window.__oembedMax <= 4 && window.__oembedMax >= 2), `가장 많이 ${await page.run(() => window.__oembedMax)}개`);
  await page.run(clickText, '#windows .radio-player-skips .btn', '목록 보기');
  await sleep(150);
  check('"목록 보기"를 다시 눌러도 목록 창은 하나다', (await trackNow()).windows === 1);
  // 다른 재생목록 CD를 고르면 열려 있는 목록 창이 새 목록으로 바뀐다. 받기 전에는 불러오는 중이라고 쓴다
  check('다른 재생목록 CD를 고르면 음악 창이 바뀐다', await playCd(LIST2, 'videoseries?list=PLsmokeList00001'));
  tr = await trackNow();
  check('목록 창이 열린 채로 재생목록 CD를 바꾸면 새 목록을 받을 때까지 불러오는 중이라고 쓴다', tr.open && tr.rows === 0 && /불러오는 중/.test(tr.note) && tr.shown && tr.names.join('|') === '이전: …|다음: …', JSON.stringify({ ...tr, rowNames: 0, rowH: 0 }));
  await page.run(() => { const p = window.__yt.at(-1); p.setList(['smokeTrk001', 'smokeTrk002', 'smokeTrk003'], 1); p.ready(); });
  check('새 목록을 받으면 목록 창이 그 목록으로 바뀐다', await until(page, () => document.querySelectorAll('#windows .radio-track').length === 3, 3000));
  tr = await trackNow();
  check('새 목록의 지금 곡이 표시되고 곡이 적으면 스크롤하지 않는다', tr.now === 1 && tr.pos === '2 / 3' && !tr.scrolls && tr.below && tr.inDesk, JSON.stringify({ ...tr, rowNames: 0, rowH: 0 }));
  check('곡이 적어도 목록 창은 너무 작지 않다', tr.winH >= 160 + 47, `${tr.winH}px`);
  // 영상 하나짜리 CD로 바꾸면 열려 있던 목록 창이 닫힌다. 다시 재생목록 CD로 바꾸어 목록 창을 열어 둔 채 음악 창을 닫는다
  await playCd('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'embed/dQw4w9WgXcQ');
  check('목록 창이 열려 있어도 영상 하나짜리 CD로 바꾸면 닫힌다', await until(page, () => !document.querySelector('#windows .radio-tracks'), 3000));
  // 유튜브 플레이어는 재생목록의 앞 200곡까지만 다룬다. 200곡이면 목록 끝에 그 뒤의 곡은 나오지 않는다고 알린다(줄은 보이는 것만 이름을 받는다)
  await playCd(LIST2, 'videoseries?list=PLsmokeList00001');
  await page.run(n => { const p = window.__yt.at(-1); p.setList(Array.from({ length: n }, (_, i) => `smokeTrk${String(i + 1).padStart(3, '0')}`), 0); p.ready(); }, 200);
  await page.run(clickText, '#windows .radio-player-skips .btn', '목록 보기');
  check('재생목록 CD로 돌아오면 목록 창을 다시 열 수 있다', await until(page, () => document.querySelectorAll('#windows .radio-track').length === 200, 3000));
  await rowNamed(0, trackName(0));
  await quiet();
  tr = await trackNow();
  check('곡이 200곡이면 목록 끝에 앞 200곡까지만 재생된다고 알리고 한 줄에 들어간다', tr.note === '재생목록의 앞 200곡까지만 재생됩니다.' && tr.noteH > 0 && tr.noteH <= 18 + 24, `${tr.note} ${tr.noteH}px`);
  check('200곡이어도 보이는 줄의 이름만 받는다', tr.titled > 0 && tr.titled < 20 && tr.rowNames[199] === '…', `${tr.titled}줄`);
  // 음악 창을 닫으면 목록 창도 닫힌다
  await page.run(() => document.querySelector('#windows .radio-player')?.closest('.win')?.querySelector('.win-close')?.click());
  check('음악 창을 닫으면 곡 목록 창도 닫힌다', await until(page, () => !document.querySelector('#windows .radio-player') && !document.querySelector('#windows .radio-tracks'), 3000));
  // 오류가 나면 단추는 쉬고 곡 정보는 거둔다. 그 전에 준비된 플레이어가 그대로 있어도 눌러서 명령이 가지 않는다
  check('재생목록 CD를 다시 틀면 음악 창이 열린다', await playCd(LIST, 'videoseries?list=PLsmokeList00000'));
  await page.run(ids => { const p = window.__yt.at(-1); p.setList(ids, 0); p.ready(); }, TRACKS);
  await page.run(clickText, '#windows .radio-player-skips .btn', '목록 보기');
  check('새 음악 창에서도 목록 창이 열린다', await until(page, () => document.querySelectorAll('#windows .radio-track').length === 40, 3000));
  // 음악 창을 아래로 옮겨 그 아래에 목록 창이 들어갈 자리가 없으면, 목록 창은 음악 창의 왼쪽 옆에 서고 바탕화면 밖으로 나가지 않는다
  await page.run(() => document.querySelector('#windows .radio-tracks').closest('.win').querySelector('.win-close').click());
  await page.run(() => { document.querySelector('#windows .radio-player').closest('.win').style.top = '520px'; });
  await page.run(clickText, '#windows .radio-player-skips .btn', '목록 보기');
  check('음악 창 아래에 자리가 없으면 목록 창은 그 왼쪽 옆에 서고 바탕화면 안에 든다', await until(page, () => !!document.querySelector('#windows .radio-tracks'), 3000));
  tr = await trackNow();
  check('왼쪽 옆의 목록 창도 줄이 스크롤되고 바탕화면을 벗어나지 않는다', tr.beside && tr.inDesk && tr.scrolls && tr.winH >= 160 + 47, JSON.stringify({ beside: tr.beside, desk: tr.inDesk, h: tr.winH }));
  await page.run(() => window.__yt.at(-1).fail(150));
  skip = await page.run(skipState);
  tr = await trackNow();
  check('플레이어가 오류를 알리면 안내가 창 안에 다 보이게 뜨고 단추는 다시 쉰다', /재생할 수 없습니다/.test(skip.note) && skip.disabled.every(Boolean) && skip.noteFits, JSON.stringify(skip));
  check('오류가 나면 이름 줄을 거두고 열려 있던 목록 창도 닫는다', !tr.shown && tr.namesH === 0 && !tr.open && tr.btn.off === true, JSON.stringify({ ...tr, rowNames: 0, rowH: 0 }));
  await page.run(() => document.querySelectorAll('#windows .radio-player-skips .btn').forEach(b => b.click()));
  check('오류가 난 뒤에는 눌러도 명령이 가지 않는다', (await page.run(() => window.__yt.at(-1).calls)).length === 0);
  // 음악 창에서 CD가 바뀌면 단추도 그 CD에 맞게 바뀐다. 영상 하나, 애플 뮤직, 스포티파이 CD에는 단추가 없고 창은 단추 줄만큼 줄어든다
  check('영상 하나짜리 유튜브 CD로 바꾸면 단추가 사라지고 창이 단추 줄만큼 줄어든다', await playCd('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'embed/dQw4w9WgXcQ')
    && await until(page, () => !!document.querySelector('#windows .radio-player-skips') && getComputedStyle(document.querySelector('#windows .radio-player-skips')).display === 'none', 3000));
  skip = await page.run(skipState);
  tr = await trackNow();
  check('영상 하나짜리 CD에는 이름 줄과 목록 단추가 없다', !tr.shown && tr.namesH === 0 && !tr.open, JSON.stringify({ ...tr, rowNames: 0, rowH: 0 }));
  check('단추와 이름 줄을 거둔 창의 높이는 그 줄만큼 낮다', listRowH >= 34 && listNamesH === NAMES_H && listWinH - skip.winH === listRowH + listNamesH, `재생목록 창 ${listWinH}px, 단추 줄 ${listRowH}px, 이름 줄 ${listNamesH}px, 영상 창 ${skip.winH}px`);
  await probe('영상 음악 창');
  await playCd('https://music.apple.com/kr/playlist/x/pl.u-abcdefgh', 'embed.music.apple.com');
  check('애플 뮤직 CD에는 단추가 없다', (await page.run(skipState)).shown === false);
  await playCd('https://open.spotify.com/album/1A2B3C4D5E6F7G8H9I0J1K', 'open.spotify.com/embed/album');
  check('스포티파이 CD에는 단추가 없다', (await page.run(skipState)).shown === false);
  await playCd(LIST, 'videoseries?list=PLsmokeList00000');
  skip = await page.run(skipState);
  check('다시 재생목록 CD로 바꾸면 단추가 돌아오고 준비될 때까지 쉰다', skip.shown && skip.disabled.every(Boolean) && skip.winH === listWinH, JSON.stringify(skip));
  // 유튜브의 API 스크립트를 받지 못하면(막았거나 끊겼다) 플레이어는 돌아도 명령을 보낼 길이 없어 단추를 거둔다
  await page.run(() => { delete window.YT; return true; });
  await playCd('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'embed/dQw4w9WgXcQ');
  await playCd(LIST, 'videoseries?list=PLsmokeList00000');
  check('API 스크립트를 받지 못하면 재생목록 CD에서도 단추를 거둔다', await until(page, () => getComputedStyle(document.querySelector('#windows .radio-player-skips')).display === 'none', 4000));
  tr = await trackNow();
  check('API 스크립트를 받지 못하면 이름 줄도 거둔다', !tr.shown && tr.namesH === 0 && !tr.open, JSON.stringify({ ...tr, rowNames: 0, rowH: 0 }));
  check('단추를 누르거나 쉬게 하는 동안 페이지 오류가 나지 않는다', page.pageErrors.length === errorsBefore, page.pageErrors.slice(errorsBefore).join(' | '));
  await page.run(() => document.querySelector('#windows .radio-player')?.closest('.win')?.querySelector('.win-close')?.click());
  await page.run(() => document.activeElement?.blur());
  await press(page, 'Escape');

  await use('corkboard', () => !!document.querySelector('.closeup .cork-card'), '짧은 링크가 없는 코르크 보드는 안내가 열린다');
  await press(page, 'Escape');

  await use('computer', () => !!document.querySelector('#windows .computer-app a[target="_blank"]'), '컴퓨터가 새 탭 안내 창을 연다');
  check('컴퓨터의 링크는 주인이 넣은 주소이고 우리 주소를 알리지 않는다', await page.run(() => { const a = document.querySelector('#windows .computer-app a[target="_blank"]'); return a.href === 'https://example.com/' && a.rel.includes('noreferrer'); }));
  await page.run(clickOnce, '#windows .like-edit');
  await sleep(200);
  await probe('컴퓨터 게임 고치기');
  await closeWindows();

  // ---------- 방 꾸미기: 끌기와 돌리기 ----------
  await openIcon('room');
  await until(page, () => !!document.querySelector('.room-app .items .furn[data-id="bookshelf"] .hit'), 5000);
  await sleep(600);
  const hit = await page.run(centreOf, '.room-app .items .furn[data-id="bookshelf"] .hit');
  await mouse(page, 'mousePressed', hit);
  await mouse(page, 'mouseMoved', { x: hit.x + 4, y: hit.y + 2 });
  await mouse(page, 'mouseMoved', { x: hit.x + 9, y: hit.y + 4 });
  check('방 꾸미기에서 가구를 끌면 끄는 그림이 뜬다', await until(page, () => !!document.querySelector('.ghost .furn'), 2000));
  // 키는 창(window)이 받는다. 한글 입력 상태에서는 key가 Process로 오므로 자리(code)로 읽는지도 같이 본다
  const keyR = extra => { const e = new KeyboardEvent('keydown', { code: 'KeyR', cancelable: true, bubbles: true, ...extra }); window.dispatchEvent(e); return e.defaultPrevented; };
  check('끄는 동안 Ctrl+R(새로 고침)은 가로채지 않는다', (await page.run(keyR, { key: 'r', ctrlKey: true })) === false);
  check('끄는 동안 R은 한글 입력 상태에서도 가구를 돌린다', (await page.run(keyR, { key: 'Process' })) === true);
  await mouse(page, 'mouseMoved', { x: hit.x + 10, y: hit.y + 4 });
  await mouse(page, 'mouseReleased', { x: hit.x + 10, y: hit.y + 4 });
  await sleep(300);
  const shelf = (await page.run(savedHome)).scenes.room.find(i => i.id === 'bookshelf');
  check('돌린 채 놓으면 돌린 모습으로 저장된다', shelf?.r === 1, JSON.stringify(shelf));
  // 벽지(F13): 고르면 창과 바탕화면의 벽이 그 무늬가 되고 저장된다. 다음 단계를 위해 기본 벽으로 되돌린다
  await page.run(clickOnce, '.room-app .wall-swatch[data-wall="heart"]');
  await sleep(200);
  check('벽지를 고르면 창과 바탕화면의 벽이 그 무늬가 되고 저장된다', await page.run(() => {
    const painted = box => [...document.querySelectorAll(`${box} .room-bg polygon`)].some(p => p.style.fill.includes('url('));
    return painted('.room-app') && painted('.wallpaper') && document.querySelector('.room-app .wall-swatch[data-wall="heart"]').getAttribute('aria-pressed') === 'true';
  }) && (await page.run(savedHome)).decor?.wall === 'heart', JSON.stringify((await page.run(savedHome)).decor));
  check('공간이 내 방 하나라 방 꾸미기 창에 공간 탭이 없다', await page.run(() => !document.querySelector('.room-app .scene-tab')));
  await page.run(clickOnce, '.room-app .wall-swatch[data-wall="plain"]');
  check('기본 벽을 고르면 저장본에서 벽지가 빠진다', !('decor' in (await page.run(savedHome))));
  await closeWindows();

  // ---------- 튜토리얼 다시 보기(연습 방) ----------
  await page.run(clickOnce, '.start-btn');
  await page.run(clickText, '.start-item', '튜토리얼');
  await sleep(300);
  await probe('튜토리얼 다시 보기 안내');
  const beforePractice = JSON.stringify(await page.run(savedHome));
  await page.run(clickText, '#windows .btn', '빈 방에서 연습하기');
  await sleep(500);
  check('연습 방은 가구가 없는 빈 방이다', (await page.run(() => document.querySelectorAll('#wallpaper .furn').length)) === 0);
  await probe('연습 방');
  await page.run(clickOnce, '.start-btn');
  check('연습 방의 시작 메뉴에는 내 사진과 이름이 보이기만 하고 바꾸는 단추와 이름 바꾸기 줄은 없다', await page.run(() => !document.querySelector('#start-menu .start-pic, #start-menu .start-name')
    && ![...document.querySelectorAll('#start-menu .start-item')].some(b => b.textContent.includes('이름 바꾸기'))
    && !!document.querySelector('#start-menu .start-head .user-pic') && document.querySelector('#start-menu .start-head').textContent === '점검'));
  check('연습 방에는 펫이 없어서 바탕화면의 펫 아이콘과 시작 메뉴의 "펫" 줄도 없다(data/apps.js의 noPractice)', await page.run(() => !document.querySelector('#icons .desk-icon[data-app="pet"]')
    && ![...document.querySelectorAll('#start-menu .start-item')].some(b => b.textContent === '펫')));
  await page.run(clickOnce, '.start-btn');

  // 연습 방에서 튜토리얼을 첫 단계부터 끝까지 해 본다(가구 놓기, 가구 쓰기, 말하기, 이웃집 가기). 놓는 가구는 data/furniture.js의 TUTORIAL_FURNITURE를 따른다
  const tut = await page.run(tutorialFurniture);
  const step = async (word, what) => {
    check(`튜토리얼: ${what}`, await until(page, cardSays, 8000, word), `안내 카드: "${await page.run(cardSays, '')}"`);
    await sleep(350); // 안내 카드가 가리키는 자리로 선반이 넘어가는 동안 기다린다
  };
  // 선반의 카드를 방 안의 자리로 끌어 놓는다. 자리가 막혀 있으면 다음 자리에 놓아 본다
  const placeFromShelf = async (id, spots) => {
    for (const [fx, fy] of spots) {
      const card = await until(page, shelfCard, 4000, id);
      if (!card) return false;
      const to = await page.run(roomPoint, fx, fy);
      await mouse(page, 'mousePressed', card);
      await mouse(page, 'mouseMoved', { x: card.x + 4, y: card.y - 6 });
      await mouse(page, 'mouseMoved', { x: card.x + 9, y: card.y - 12 });
      await mouse(page, 'mouseMoved', to);
      await mouse(page, 'mouseReleased', to);
      await sleep(200);
      if (await page.run(i => !!document.querySelector(`.room-app .items .furn[data-id="${i}"]`), id)) return true;
    }
    return false;
  };
  await step('방 꾸미기 아이콘', '첫 단계가 방 꾸미기 아이콘을 열라고 한다');
  check('튜토리얼: 화살표가 가리킬 곳을 찾았다', await page.run(() => !document.querySelector('.coach-arrow').hidden && !document.querySelector('.coach-ring').hidden));
  await openIcon('room');
  await step(tut.firstName, `방 꾸미기를 열면 ${tut.firstName} 놓기로 넘어간다`);
  check(`튜토리얼: 선반에서 ${tut.firstName} 카드를 끌어 방에 놓는다`, await placeFromShelf(tut.first, [[0.5, 0.68], [0.5, 0.8]]));
  await step(tut.lightName, `${tut.firstName}를 놓으면 ${tut.lightName} 놓기로 넘어간다`);
  check(`튜토리얼: 선반에서 ${tut.lightName} 카드를 끌어 방에 놓는다`, await placeFromShelf(tut.light, [[0.25, 0.62], [0.75, 0.62], [0.5, 0.45], [0.5, 0.92]]));
  await step('창을 닫으세요', '가구 둘을 놓으면 창을 닫으라고 한다');
  await closeWindows();
  await step('두 번 누르면 아바타가', '창을 닫으면 놓은 가구를 써 보라고 한다');
  await page.run(clickTwice, `#wallpaper .furn[data-id="${tut.light}"]`);
  await step('다시 두 번 누르면', '가구를 쓰면 밤이 되고 한 번 더 써 보라고 한다');
  check('튜토리얼: 연습 방이 밤이 된다', (await page.run(theme)) === 'night');
  await page.run(clickTwice, `#wallpaper .furn[data-id="${tut.light}"]`);
  await step('아바타를 누르거나 Enter를', '낮으로 돌아오면 아바타를 누르거나 Enter를 눌러 말해 보라고 한다');
  // 말하기 단계: 테두리가 아바타를 가리키다가 말할 칸이 열리면 그 칸으로 옮겨 간다. 아바타 누르기와 Enter 둘 다로 열어 본다(앞에 열린 창이 없어 Enter가 아바타에 간다).
  // 말하는 말은 실험실 암호다. 튜토리얼에서 한 말은 숨은 기능을 열지 않는다(src/secrets.js)
  check('튜토리얼: 말하기 단계는 화살표와 테두리로 아바타를 가리킨다', await until(page, ringOn, 3000, '#wallpaper .room-avatar:not(.room-owner)'));
  await probe('튜토리얼 말하기 단계');
  await page.run(clickOnce, '#wallpaper .room-avatar:not(.room-owner)');
  check('튜토리얼: 아바타를 누르면 말할 칸이 열리고 테두리가 그 칸으로 옮겨 간다', await until(page, ringOn, 3000, '#desktop .say-input'));
  await press(page, 'Escape');
  check('튜토리얼: 말할 칸을 닫으면 테두리가 아바타로 돌아온다', await until(page, ringOn, 3000, '#wallpaper .room-avatar:not(.room-owner)'));
  await press(page, 'Enter');
  check('튜토리얼: 말하기 단계에서는 Enter를 눌러도 말할 칸이 열린다', await until(page, ringOn, 3000, '#desktop .say-input'));
  await page.run(() => { document.querySelector('.say-input').value = '엔믹스지우'; });
  await press(page, 'Enter');
  await step('현관문', '한마디 하면 현관문으로 이웃집 목록 창을 열어 보라고 한다');
  check('튜토리얼에서 말한 암호는 숨은 기능을 열지 않는다(실험실 아이콘이 생기지 않는다)', await page.run(() => !document.querySelector('#icons [data-app="labs"]')
    && !JSON.parse(localStorage.getItem('agarago.settings') || '{}').labsOpen));
  await page.run(clickTwice, '#wallpaper .door-hit');
  check('튜토리얼: 현관문으로 이웃집 목록 창을 열면 끝 카드가 뜬다', await until(page, () => !!document.querySelector('#windows .neighbor-app')
    && document.querySelector('.coach-title')?.textContent === '튜토리얼 끝' && !document.querySelector('.coach-card').hidden, 15000), `안내 카드: "${await page.run(cardSays, '')}"`);
  check('튜토리얼: 끝 카드는 말하는 법을 다시 적지 않는다', await page.run(() => !document.querySelector('.coach-text').textContent.includes('Enter')), await page.run(cardSays, ''));
  await closeWindows();
  await sleep(300);
  check('튜토리얼: 목록 창을 닫아도 끝 카드가 남는다', await page.run(() => document.querySelector('.coach-title')?.textContent === '튜토리얼 끝' && !document.querySelector('.coach-card').hidden));
  await probe('튜토리얼 끝 카드');

  await page.run(() => document.querySelector('.coach-btn').click());
  await sleep(500);
  check('연습을 끝내면 저장된 방이 돌아온다', (await page.run(() => document.querySelectorAll('#wallpaper .furn').length)) === HOME.scenes.room.length);
  check('한 번 말한 뒤로는 바탕화면을 새로 만들어도 말하기 표시가 뜨지 않는다', await page.run(sayCue, '없음'), await page.run(sayCue));
  check('연습 방에서 놓은 가구와 바꾼 밤낮은 저장되지 않는다', JSON.stringify(await page.run(savedHome)) === beforePractice && (await page.run(theme)) === 'day'
    && !(await page.run(() => JSON.parse(localStorage.getItem('agarago.settings') || '{}').night)));

  // ---------- 로그아웃과 손님 ----------
  await page.run(clickOnce, '.start-btn');
  await page.run(clickText, '.start-item', '로그아웃');
  check('로그아웃하면 로그인 화면으로 돌아간다', await until(page, () => !document.getElementById('login').hidden, 3000));
  const friendPic = ['duck', 'cat'].find(p => p !== nextPic); // 내 사진과 다른 사진이라야 친구 사진이 보이는지 가릴 수 있다
  const friend = await page.run(linkOf, { ...HOME, picture: friendPic }, '친구');
  await open(`#r=${friend}`);
  await powerOn();
  check('친구 링크로 오면 친구 집과 내 컴퓨터가 나오고 이웃집은 나오지 않는다', await page.run(() => {
    const names = [...document.querySelectorAll('.users .user small')].map(s => s.textContent);
    return names.includes('손님으로 구경하기') && names.includes('내 컴퓨터로 가기') && !document.querySelector('.users .user.neighbor')
      && !document.querySelector('.users .user.by-handle'); // 친구 아이디 칸도 이웃집처럼 뺀다
  }));
  check('로그인 화면의 친구 집에 링크에 담긴 주인 사진이 보인다', await page.run(pic => [...document.querySelectorAll('.users .user')]
    .find(u => u.querySelector('small')?.textContent === '손님으로 구경하기')?.querySelector('.user-pic')?.dataset.pic === pic, friendPic));
  // 말해 본 적 없는 브라우저로 놀러 온 손님에게도 말하기 표시가 뜨는지 보려고 말한 기록을 지운다(아래 분신사바에서 다시 말한다)
  await page.run(() => localStorage.removeItem('agarago.said'));
  await page.run(clickText, '.users .user', '손님으로 구경하기');
  check('손님으로 들어가면 친구 방이 바탕화면에 뜬다', await desktop());
  check('말해 본 적 없는 손님의 아바타 머리 위에도 말하기 표시가 뜬다', await until(page, sayCue, 2000, '머리 위'), await page.run(sayCue));
  // 2026-11-17부터 친구 집에는 실험실을 켜지 않아도 주인 아바타가 서 있다(F8). 이 링크의 집은 인사말이 없어 말풍선은 뜨지 않는다
  check('친구 집에 들어가면 주인 아바타가 이름표를 달고 서 있고 내 아바타는 손님 옷이다', (await page.run(ownerScene)) === '주인 기본 옷 친구, 나 손님 옷', await page.run(ownerScene));
  await sleep(500);
  await probe('손님 바탕화면');
  check('손님에게는 방 꾸미기와 공유하기 대신 내 컴퓨터로가 보인다', await page.run(() => !document.querySelector('#icons [data-app="room"]') && !document.querySelector('#icons [data-app="share"]') && !!document.querySelector('#icons [data-app="my-computer"]')));
  check('손님으로 들어오면 걷고 쓰는 법을 알림으로 알려 준다', await page.run(() => document.getElementById('toast').classList.contains('show')));
  await page.run(clickOnce, '.start-btn');
  check('손님의 시작 메뉴에는 내 사진 대신 링크에 담긴 주인 사진이 보이고 사진과 이름을 바꾸는 단추와 줄은 없다', (await page.run(shownPic, '#start-menu .start-head')) === friendPic
    && await page.run(() => !document.querySelector('#start-menu .start-pic, #start-menu .start-name')
      && ![...document.querySelectorAll('#start-menu .start-item')].some(b => b.textContent.includes('이름 바꾸기'))));
  await page.run(clickOnce, '.start-btn');
  // 손님의 오른쪽 단추 메뉴에는 손님이 할 수 있는 줄만 있다. 방 꾸미기는 손님에게 없는 앱이라 빠진다
  check('손님이 바탕화면의 빈 곳을 오른쪽 단추로 누르면 방 꾸미기 없이 불 끄기만 뜬다', (await page.run(rightClick, '#desktop')) === true
    && (await page.run(ctxMenu)) === '불 끄기 (밤)', String(await page.run(ctxMenu)));
  await press(page, 'Escape');
  check('손님이 가구를 오른쪽 단추로 누르면 방 꾸미기 없이 사용하기만 뜬다', (await page.run(rightClick, '#wallpaper .furn[data-id="bookshelf"]')) === true
    && (await page.run(ctxMenu)) === '!사용하기', String(await page.run(ctxMenu)));
  await press(page, 'Escape');
  await use('bookshelf', () => !!document.querySelector('.closeup .book-cover'), '손님도 책장을 연다');
  check('가구 화면이 열리면 앞의 알림이 걷힌다(아래쪽 단추 줄을 가리지 않게)', await page.run(() => !document.getElementById('toast').classList.contains('show')));
  check('손님에게는 넣기, 고치기, 빼기 단추가 없다', await page.run(() => !document.querySelector('.closeup .shelf-tools, .closeup .book-spine.add')));
  await press(page, 'Escape');
  await sayWord('분신사바');
  await sleep(1500); // 내 집이었다면 불이 꺼졌을 시간(0.9초)을 넘겨 본다
  check('손님이 분신사바를 말해도 친구 집의 불은 꺼지지 않는다', await page.run(() => document.getElementById('stage').dataset.theme === 'day' && !document.querySelector('#wallpaper .horror-dark')));
  check('손님도 말할 수 있고, 한 번 말하면 말하기 표시가 사라진다', await page.run(() => document.querySelector('#wallpaper .room-avatar:not(.room-owner) + .room-avatar-say')?.textContent === '분신사바'
    && localStorage.getItem('agarago.said') === 'true') && await page.run(sayCue, '없음'), await page.run(sayCue));
  await sayWord('999999999');
  await sleep(1500); // 내 집이었다면 비둘기가 나타났을 시간(0.5초)을 넘겨 본다
  check('손님이 999999999를 말해도 친구 집에는 비둘기가 오지 않는다', await page.run(() => !document.querySelector('#wallpaper .room-pet')));
  await openIcon('my-computer');
  check('내 컴퓨터로를 두 번 누르면 내 바탕화면으로 돌아온다', await until(page, () => document.getElementById('stage').dataset.mode === 'edit' && !document.getElementById('desktop').hidden && !!document.querySelector('#icons [data-app="room"]'), 5000));
  check('돌아오면 주소의 친구 링크가 지워진다', await page.run(() => location.hash === ''));

  // ---------- 이웃집 ----------
  // data/neighbors.js 맨 앞에 link 이웃집 한 집을 더해 받게 하고(extraNeighbor), 그 집의 방은 서버 대신 답한다(fakeCloud).
  // 받는 동안의 자리, 받은 뒤의 주인 사진과 서버의 주인 이름, 현관문으로 여는 목록 창, 목록 창에서 놀러 가기, 서버에 방이 없을 때 빠지는 것을 본다
  const LINK_NEIGHBOR = { id: 'smoke-link', name: '링크이웃', link: 'NbHd5678' };
  const SERVER_NAME = '서버의이름'; // 서버의 방 주인 이름. 받은 뒤에는 목록의 이름(링크이웃) 대신 이 이름이 보여야 한다
  const neighborCode = await page.run(linkOf, { ...HOME, picture: 'cake' }, SERVER_NAME);
  // 레포의 목록에 든 link 이웃집에도 서버 대신 답한다. 답하지 않으면 서버에 방이 없는 집처럼 빠져서 문의 수가 어긋난다
  const listedLinks = [...fs.readFileSync(new URL('../data/neighbors.js', import.meta.url), 'utf8').matchAll(/link: '([0-9A-Za-z]{8})'/g)].map(m => m[1]);
  const listedCode = await page.run(linkOf, HOME, '이웃점검');
  const neighborRooms = { [LINK_NEIGHBOR.link]: neighborCode, ...Object.fromEntries(listedLinks.map(id => [id, listedCode])) };
  const linkTile = name => {
    const t = [...document.querySelectorAll('.users .user.neighbor')].find(x => x.textContent.includes(name));
    return t ? { disabled: t.disabled, text: t.textContent, title: t.title, pic: t.querySelector('.user-pic')?.dataset.pic ?? null } : null;
  };
  // 이웃집 목록 창의 줄들. wait: 받는 중("불러오는 중"), off: 놀러 가기 단추가 눌리지 않는다
  const listRows = () => [...document.querySelectorAll('#windows .neighbor-row')].map(r => ({
    id: r.dataset.neighbor, name: r.querySelector('.neighbor-name b').textContent, wait: !!r.querySelector('.neighbor-name small'),
    off: r.querySelector('.btn').disabled, pic: r.querySelector('.user-pic')?.dataset.pic ?? null,
  }));
  // 방의 현관문을 두 번 눌러 목록 창을 연다(아바타가 문 앞까지 걸어간 뒤 뜬다). n: 창에 설 줄 수
  const openList = async n => {
    await page.run(clickTwice, '#wallpaper .door-hit');
    return until(page, k => document.querySelectorAll('#windows .neighbor-app .neighbor-row').length === k, 15000, n);
  };
  // 목록 창에서 그 집 줄의 놀러 가기를 누른다. 줄이 없거나 단추가 눌리지 않으면 false
  const goRow = id => { const b = document.querySelector(`#windows .neighbor-row[data-neighbor="${id}"] .btn`); if (!b || b.disabled) return false; b.click(); return true; };
  // 로그인 화면에서 내 사용자로 들어가 바탕화면(내 방)까지 간다
  const toMyRoom = async () => {
    await page.run(clickOnce, '.users .user:not(.neighbor)');
    return desktop();
  };
  await extraNeighbor(page, LINK_NEIGHBOR);
  await open();
  await page.run(fakeCloud, 'hold', neighborRooms);
  await powerOn();
  // links: 서버에 방이 없으면 빠지는 link 이웃집의 수. 복사본(keep)이 있는 고정한 집은 서버에 방이 없어도 남으므로 세지 않는다
  const [neighbors, links] = await page.run(async () => {
    const { NEIGHBOR_LIST } = await import(new URL('src/neighbors.js', document.baseURI).href);
    return [NEIGHBOR_LIST.length, NEIGHBOR_LIST.filter(n => n.link && !n.keep).length];
  });
  check('link 이웃집은 서버에서 방을 받는 동안 목록의 이름만 보이고 눌리지 않으며 마우스를 올리면 불러오는 중이라고 뜬다', await page.run(linkTile, LINK_NEIGHBOR.name)
    .then(t => !!t && t.disabled && t.title === '불러오는 중'));
  check('부팅할 때 link 이웃집의 방을 서버에 한 번 묻는다', (await page.run(id => window.__cloudCalls[id], LINK_NEIGHBOR.link)) === 1);
  await probe('이웃집 방을 받는 로그인 화면');
  await page.run(() => window.__cloudAnswer());
  check('받으면 누를 수 있는 이웃집 칸이 되고 서버의 방에 담긴 주인 사진이 보인다', await until(page, name => {
    const t = [...document.querySelectorAll('.users .user.neighbor')].find(x => x.textContent.includes(name));
    return !!t && !t.disabled && !t.title && t.querySelector('.user-pic')?.dataset.pic === 'cake';
  }, 3000, SERVER_NAME));
  check('받은 link 이웃집은 목록의 이름 대신 서버의 방 주인 이름으로 보인다', await page.run((listed, server) => {
    const text = document.getElementById('login').textContent;
    return text.includes(server) && !text.includes(listed);
  }, LINK_NEIGHBOR.name, SERVER_NAME));
  check('이웃집 목록 창은 서버의 방 주인 이름과 같은 집을 빼고 목록의 이름으로는 빼지 않는다', await page.run(async (server, listed, id) => {
    const { shownNeighbors } = await import(new URL('src/neighbors.js', document.baseURI).href);
    const has = owner => shownNeighbors(owner).some(g => g.id === id);
    return !has(server) && has(listed);
  }, SERVER_NAME, LINK_NEIGHBOR.name, LINK_NEIGHBOR.id));
  check('이웃집 점검: 내 사용자로 들어간다', await toMyRoom());
  check('현관문을 두 번 누르면 이웃집 목록 창이 뜨고 집마다 한 줄씩 있다', neighbors > 1 && await openList(neighbors));
  // 현관문 자리는 src/config.js의 SCENES door(왼쪽 벽 L의 칸 9~10)다. 아바타는 그 앞 x = 0 줄의 y = 9이나 10 칸에 선다(src/avatar.js의 besideWall)
  const atDoor = await page.run(myCell);
  check('아바타는 현관문 바로 앞 칸까지 걸어간 뒤 목록 창을 띄운다', atDoor?.x === 0 && (atDoor.y === 9 || atDoor.y === 10), JSON.stringify(atDoor));
  await probe('이웃집 목록 창');
  const shown = (await page.run(listRows)).find(r => r.id === LINK_NEIGHBOR.id);
  check('목록 창에는 서버의 방 주인 이름과 사진이 보이고 놀러 가기 단추가 눌린다', shown?.name === SERVER_NAME && shown.pic === 'cake' && !shown.wait && !shown.off, JSON.stringify(shown));
  // 알림 줄은 창 본문(.neighbor-app)의 바로 아래 자식인 p.meta다. 아이디 칸 안의 안내(.handle-form p.meta)가 더 앞에 있어서 바로 아래 자식만 본다(known-issues 72와 같은 함정)
  check('목록 창 아래에 돌아오는 길을 알린다', (await page.run(() => document.querySelector('#windows .neighbor-app > p.meta')?.textContent || '')).includes('내 컴퓨터로 아이콘'));
  check('목록 창에서 놀러 가기를 누른다', await page.run(goRow, LINK_NEIGHBOR.id));
  check('놀러 가기를 누르면 서버에서 받은 그 집에 손님으로 들어간다', await until(page, n => document.getElementById('stage').dataset.mode === 'visit' && !document.getElementById('desktop').hidden
    && document.querySelectorAll('#wallpaper .furn').length === n, 5000, HOME.scenes.room.length));
  check('놀러 간 집의 이웃집 목록 창에는 그 집이 빠진다', await page.run(async (owner, id) => {
    const { shownNeighbors } = await import(new URL('src/neighbors.js', document.baseURI).href);
    return !shownNeighbors(owner).some(n => n.id === id);
  }, SERVER_NAME, LINK_NEIGHBOR.id));
  check('로그인 화면과 이웃집 목록 창이 받아 둔 방을 같이 써서 서버에 다시 묻지 않는다', (await page.run(id => window.__cloudCalls[id], LINK_NEIGHBOR.link)) === 1);
  // 서버에서 받은 이웃집의 손님은 짧은 링크로 온 손님처럼 그 집의 코르크 보드에 쪽지를 남긴다(src/neighbors.js의 neighborBoard)
  await use('corkboard', () => [...document.querySelectorAll('.closeup .btn')].some(b => b.textContent === '쪽지 남기기'), '이웃집 손님에게도 쪽지 남기기 단추가 보인다');
  check('이웃집의 코르크 보드는 그 집의 링크 번호로 쪽지를 찾는다', (await page.run(() => window.__noteBoards.at(-1))) === LINK_NEIGHBOR.link);
  await press(page, 'Escape');
  // 받는 중인 집: 서버의 답을 붙잡아 둔 채 현관문으로 목록 창을 연다. 그 줄은 "불러오는 중"으로 눌리지 않다가 답이 오면 놀러 갈 수 있게 바뀐다
  await open();
  await page.run(fakeCloud, 'hold', neighborRooms);
  await powerOn();
  check('받는 중 점검: 내 사용자로 들어간다', await toMyRoom());
  check('서버에서 받는 중인 이웃집도 목록 창에 줄이 있다', await openList(neighbors));
  const waiting = (await page.run(listRows)).find(r => r.id === LINK_NEIGHBOR.id);
  check('받는 중인 줄은 목록의 이름과 "불러오는 중"이 보이고 놀러 가기가 눌리지 않는다', waiting?.name === LINK_NEIGHBOR.name && waiting.wait && waiting.off, JSON.stringify(waiting));
  check('받는 중인 줄의 놀러 가기를 눌러도 아무 일도 없다', !(await page.run(goRow, LINK_NEIGHBOR.id)) && (await page.run(() => document.getElementById('stage').dataset.mode)) === 'edit');
  await probe('받는 중인 이웃집 목록 창');
  await page.run(() => window.__cloudAnswer());
  check('받으면 그 줄이 서버의 방 주인 이름과 사진으로 바뀌고 놀러 가기가 눌린다', await until(page, (id, name) => {
    const r = document.querySelector(`#windows .neighbor-row[data-neighbor="${id}"]`);
    return !!r && r.querySelector('.neighbor-name b').textContent === name && !r.querySelector('.neighbor-name small') && !r.querySelector('.btn').disabled
      && r.querySelector('.user-pic')?.dataset.pic === 'cake';
  }, 3000, LINK_NEIGHBOR.id, SERVER_NAME));
  check('목록 창을 연 뒤에 받은 집도 서버에 다시 묻지 않는다', (await page.run(id => window.__cloudCalls[id], LINK_NEIGHBOR.link)) === 1);
  await closeWindows();
  // 이 브라우저에서 올린 방은 내 사용자로 이미 떠 있어서 이웃집 칸에서 뺀다(src/login.js의 uploadedHere). 이 컴퓨터가 기억하는 올린 방 번호(agarago.cloud의 id)가
  // 이웃집의 link와 같을 때만 빠지고, 이름으로는 가리지 않는다. 그래서 점검용 이웃집의 방 주인 이름을 내 이름과 같게 답하게 해(loginRooms), 이름으로 가렸다면 함께 사라졌을 경우까지 본다.
  // 올린 기록은 부팅하기 전에 localStorage에 심는다. 끝나면 이 점검 앞의 기록으로 돌려놓는다
  const myName = await page.run(savedOwner);
  const loginRooms = { ...neighborRooms, [LINK_NEIGHBOR.link]: await page.run(linkOf, HOME, myName) };
  const cloudBefore = await page.run(() => localStorage.getItem('agarago.cloud'));
  // 서버의 답(how, rooms)은 고를 수 있다. 돌려주는 것: mine 내 사용자 이름, near 이웃집 이름들, reset 초기화 단추가 있는가, note 초기화 자리의 글
  const bootWith = async (uploadedId, how = 'serve', rooms = loginRooms) => {
    await open();
    await page.run(id => (id
      ? localStorage.setItem('agarago.cloud', JSON.stringify({ uid: 'fake-uid', refresh: 'fake-refresh', id }))
      : localStorage.removeItem('agarago.cloud')), uploadedId);
    await page.run(fakeCloud, how, rooms);
    await powerOn();
    await until(page, () => !document.querySelector('.users .user.neighbor[disabled]'), 3000); // 받는 중인 자리가 모두 걷히면 이웃집 칸이 정해진 것이다
    return page.run(() => {
      const names = sel => [...document.querySelectorAll(sel)].map(t => t.querySelector('.user-name').firstChild.textContent);
      return {
        mine: names('.users-own .user:not(.new)'),
        near: names('.users .user.neighbor'),
        reset: !!document.querySelector('.reset-link'),
        note: document.querySelector('.reset-box p')?.textContent || '',
      };
    });
  };
  const noRecord = await bootWith(null);
  check('올린 기록이 없는 브라우저에서는 이웃집이 모두 뜨고, 내 이름과 같은 이름의 이웃집도 남는다', noRecord.mine.join() === myName && noRecord.near.length === neighbors
    && noRecord.near.filter(name => name === myName).length === 1, JSON.stringify(noRecord));
  const withRecord = await bootWith(LINK_NEIGHBOR.link);
  const rest = [...noRecord.near];
  rest.splice(rest.indexOf(myName), 1); // 내 이름과 같은 이름으로 답하는 점검용 이웃집이 올린 방이다. 그 한 칸만 빠져야 한다
  check('이 브라우저에서 올린 방은 이웃집 칸에서 빠지고 내 사용자로만 뜨며 다른 이웃집은 그대로 뜬다', withRecord.mine.join() === myName
    && JSON.stringify(withRecord.near) === JSON.stringify(rest), JSON.stringify(withRecord));
  const otherRecord = await bootWith('AbCd1234'); // 이웃집이 아닌 다른 방을 올렸다면 아무것도 빠지지 않는다
  check('올린 방이 이웃집 목록에 없으면 이웃집이 하나도 빠지지 않는다', JSON.stringify(otherRecord.near) === JSON.stringify(noRecord.near), JSON.stringify(otherRecord));
  await page.run(v => (v === null ? localStorage.removeItem('agarago.cloud') : localStorage.setItem('agarago.cloud', v)), cloudBefore);
  // 주인이 링크를 지워 서버에 방이 없으면 로그인 화면과 이웃집 목록 창에서 빠진다
  await open();
  await page.run(fakeCloud, 'missing');
  await powerOn();
  check('서버에 방이 없는 link 이웃집은 로그인 화면에서 빠진다', await until(page, (name, n, k) => {
    const tiles = [...document.querySelectorAll('.users .user.neighbor')];
    return tiles.length === n - k && !tiles.some(t => t.textContent.includes(name));
  }, 3000, LINK_NEIGHBOR.name, neighbors, links));
  check('서버에 방이 없을 때: 내 사용자로 들어간다', await toMyRoom());
  check('서버에 방이 없는 link 이웃집은 이웃집 목록 창에서 빠진다', await openList(neighbors - links)
    && !(await page.run(listRows)).some(r => r.id === LINK_NEIGHBOR.id), JSON.stringify(await page.run(listRows)));
  await closeWindows();

  // 고정한 이웃집(keep). 복사본이 있는 link 이웃집은 서버에 방이 없거나 서버에 닿지 못하거나 받은 방이 깨졌어도 복사본으로 뜨고, 서버에 방이 있으면 서버의 방을 따른다.
  // 그런 방을 올린 브라우저(agarago.cloud의 id가 그 link)에서는 이 컴퓨터 초기화와 공유하기의 링크 지우기를 쓸 수 없다(src/neighbors.js의 pinnedHere).
  // 점검용 이웃집 둘(복사본이 있는 것과 없는 것)을 목록 앞에 더해 본다. 레포 목록의 고정한 집도 함께 서므로 수는 새로 연 페이지에서 센다
  const PINNED_NEIGHBOR = { id: 'smoke-pinned', name: '고정이웃', link: 'PqRs9012', keep: await page.run(linkOf, HOME, '고정이웃') };
  await extraNeighbor(page, [PINNED_NEIGHBOR, LINK_NEIGHBOR]);
  await open();
  const [total, droppable] = await page.run(async () => {
    const { NEIGHBOR_LIST } = await import(new URL('src/neighbors.js', document.baseURI).href);
    return [NEIGHBOR_LIST.length, NEIGHBOR_LIST.filter(n => n.link && !n.keep).length];
  });
  // 풀리지 않는 복사본은 목록에서 조용히 없는 것이 되어 고정이 풀리므로, keep이 적힌 줄이 모두 살아 있는지 센다
  const keepLines = 1 + [...fs.readFileSync(new URL('../data/neighbors.js', import.meta.url), 'utf8').matchAll(/keep: '/g)].length;
  check('목록에 keep이 적힌 줄은 모두 쓸 수 있는 복사본이다', await page.run(async n => {
    const { NEIGHBOR_LIST } = await import(new URL('src/neighbors.js', document.baseURI).href);
    return NEIGHBOR_LIST.filter(x => x.keep).length === n;
  }, keepLines));
  const pinnedRooms = { ...neighborRooms, [PINNED_NEIGHBOR.link]: await page.run(linkOf, HOME, '서버고정') }; // 서버에 방이 있을 때의 답. 주인 이름이 복사본과 다르다
  const gone = await bootWith(null, 'missing');
  check('복사본이 있는 이웃집은 서버에 방이 없어도 복사본으로 뜨고, 복사본이 없는 이웃집은 빠진다', gone.near.includes(PINNED_NEIGHBOR.name)
    && !gone.near.includes(LINK_NEIGHBOR.name) && gone.near.length === total - droppable, JSON.stringify(gone));
  check('고정한 이웃집 점검: 내 사용자로 들어간다', await toMyRoom());
  check('복사본이 있는 이웃집은 서버에 방이 없어도 이웃집 목록 창에 남는다', await openList(total - droppable)
    && (await page.run(listRows)).some(r => r.id === PINNED_NEIGHBOR.id), JSON.stringify(await page.run(listRows)));
  // 복사본으로 연 집에는 쪽지를 남기지 못한다. 서버 규칙이 서버에 있는 방에만 쪽지를 받아서, 보드 번호를 넘기면 붙일 때마다 실패한다(firestore.rules)
  check('목록 창에서 고정한 이웃집의 놀러 가기를 누른다', await page.run(goRow, PINNED_NEIGHBOR.id));
  check('서버에 방이 없을 때: 고정한 이웃집에 복사본으로 놀러 간다', await until(page, () => document.getElementById('stage').dataset.mode === 'visit' && !document.getElementById('desktop').hidden, 5000));
  await use('corkboard', () => !!document.querySelector('.closeup .cork-card')?.textContent.includes('쪽지를 남길 수 없습니다'), '복사본으로 연 이웃집은 쪽지를 남길 수 없다고 알린다');
  check('복사본으로 연 이웃집의 코르크 보드는 서버에 쪽지를 찾지 않는다', (await page.run(() => window.__noteBoards.length)) === 0);
  await press(page, 'Escape');
  const down = await bootWith(null, 'offline');
  check('서버에 닿지 못해도 복사본이 있는 이웃집은 복사본으로 뜬다', down.near.includes(PINNED_NEIGHBOR.name) && down.near.length === total - droppable, JSON.stringify(down));
  const live = await bootWith(null, 'serve', pinnedRooms);
  check('서버에 방이 있으면 복사본 대신 서버의 방을 따른다', live.near.includes('서버고정') && !live.near.includes(PINNED_NEIGHBOR.name), JSON.stringify(live));
  const broken = await bootWith(null, 'serve', { ...pinnedRooms, [PINNED_NEIGHBOR.link]: '!!!깨진방' });
  check('서버가 돌려준 방이 깨졌으면 복사본으로 뜬다', broken.near.includes(PINNED_NEIGHBOR.name), JSON.stringify(broken));
  // 고정한 방을 올린 브라우저: 로그인 화면의 초기화와 공유하기 창의 링크 지우기가 없고 이유가 보인다. 다른 방을 올렸다면 둘 다 그대로 있다
  const shareWindow = async () => {
    await page.run(clickOnce, '.users .user:not(.neighbor)');
    await desktop();
    await openIcon('share');
    await until(page, () => !!document.querySelector('#windows .win input[aria-label="공유 링크"]'), 5000);
    return page.run(() => ({
      link: document.querySelector('#windows .win input[aria-label="공유 링크"]')?.value || '',
      remove: [...document.querySelectorAll('#windows .win .btn')].some(b => b.textContent === '링크 지우기'),
      tip: document.querySelector('#windows .win .share-save-tip')?.textContent || '',
    }));
  };
  const pinnedLogin = await bootWith(PINNED_NEIGHBOR.link, 'write', pinnedRooms);
  check('고정한 방을 올린 브라우저의 로그인 화면에는 초기화가 없고 이유가 보인다', !pinnedLogin.reset && pinnedLogin.note.includes('초기화할 수 없습니다'), JSON.stringify(pinnedLogin));
  await probe('초기화가 막힌 로그인 화면');
  const pinnedShare = await shareWindow();
  check('고정한 방을 올린 브라우저의 공유하기 창에는 링크 지우기가 없고 이유가 보인다', pinnedShare.link.endsWith(`#s=${PINNED_NEIGHBOR.link}`)
    && !pinnedShare.remove && pinnedShare.tip.includes('지울 수 없습니다'), JSON.stringify(pinnedShare));
  await probe('링크 지우기가 막힌 공유하기 창');
  await closeWindows();
  const plainLogin = await bootWith('AbCd1234', 'write', pinnedRooms); // 고정한 집이 아닌 방을 올렸다면 막지 않는다
  check('고정한 집이 아닌 방을 올린 브라우저의 로그인 화면에는 초기화가 그대로 있다', plainLogin.reset && plainLogin.note === '', JSON.stringify(plainLogin));
  const plainShare = await shareWindow();
  check('고정한 집이 아닌 방을 올린 브라우저의 공유하기 창에는 링크 지우기가 그대로 있다', plainShare.remove, JSON.stringify(plainShare));
  await closeWindows();
  await page.run(v => (v === null ? localStorage.removeItem('agarago.cloud') : localStorage.setItem('agarago.cloud', v)), cloudBefore);
  await extraNeighbor(page, null);

  // ---------- 깨진 링크와 HTML이 든 링크 ----------
  await open('#r=!!!깨진링크');
  await powerOn();
  check('깨진 링크는 알림만 띄우고 사용자 목록은 그대로 나온다', await page.run(() => document.getElementById('toast').textContent.includes('링크가 깨져서') && !!document.querySelector('.users .user')));
  const evil = await page.run(linkOf, EVIL);
  await open(`#r=${evil}`);
  await powerOn();
  check('사진이 없는 링크(사진을 넣기 전의 것)의 친구 집은 이름의 첫 글자로 보인다', await page.run(() => {
    const u = [...document.querySelectorAll('.users .user')].find(x => x.querySelector('small')?.textContent === '손님으로 구경하기');
    return !!u && !u.querySelector('.user-pic') && u.querySelector('.avatar').textContent === '<';
  }));
  await page.run(clickText, '.users .user', '손님으로 구경하기');
  await desktop();
  await page.run(clickTwice, '#wallpaper .furn[data-id="bookshelf"]');
  await until(page, () => !!document.querySelector('.closeup .book-cover'), 15000);
  check('HTML이 든 이름과 글은 글자로만 보이고 스크립트가 돌지 않는다', await page.run(() => !window.__xss
    && !document.querySelector('#stage img[src="x"], #stage script')
    && document.querySelector('.closeup .book-title').textContent.includes('<b>')
    && document.querySelector('.closeup .shelf-note-text').textContent.includes('<img')));
  check('javascript: 주소는 집에 담기지 않는다', await page.run(async () => {
    const { decodeHome } = await import(new URL('src/share.js', document.baseURI).href);
    return !decodeHome(location.hash.slice(3)).likes.computer;
  }));
  await press(page, 'Escape');
  await page.run(clickTwice, '#wallpaper .furn[data-id="radio"]');
  await until(page, () => !!document.querySelector('.closeup .cd-pick'), 15000);
  check('손님 화면의 CD 이름도 글자로만 보이고 주인이 고른 색이다', await page.run(() => !window.__xss
    && !document.querySelector('#stage img[src="x"]')
    && document.querySelector('.closeup .cd-name').textContent.startsWith('<img')
    && document.querySelector('.closeup .cd-pick .cd').dataset.color === '2'));
  // 유튜브 CD는 개인정보 보호 모드 플레이어로 열고, 떠 있는 동안 화면 전체의 효과를 끈다(플레이어 앞에 겹치지 않는다는 유튜브의 요건)
  await page.run(clickText, '.closeup .cd-pick', '유튜브 CD');
  check('유튜브 CD를 고르면 개인정보 보호 모드 플레이어가 열린다', await until(page, () => /^https:\/\/www\.youtube-nocookie\.com\/embed\/96URE_-aj-8\?/.test(document.querySelector('#windows .radio-player iframe')?.src || ''), 5000));
  // 아래 안내는 유튜브의 것이다(영상이 막히거나 지워져 오류가 오면 오류 안내로 바뀐다)
  check('유튜브 플레이어가 떠 있는 동안 화면 효과가 꺼지고 플레이어가 200px 이상이다', await page.run(() => getComputedStyle(document.querySelector('.fx-vignette')).display === 'none'
    && document.querySelector('#windows .radio-player iframe').offsetHeight >= 200 && /끝까지|재생할 수 없습니다/.test(document.querySelector('.radio-player-note').textContent)));
  await probe('유튜브 음악 창');
  await page.run(() => document.querySelector('#windows .radio-player')?.closest('.win')?.querySelector('.win-close')?.click());
  check('음악 창을 닫으면 화면 효과가 돌아온다', await page.run(() => getComputedStyle(document.querySelector('.fx-vignette')).display !== 'none'));

  // ---------- 짧은 링크(#s=)의 방 ----------
  // 서버 대신 페이지 안에서 답한다(fakeCloud). 받는 동안의 자리, 받기 전에 전원을 끄면 늦게 온 답을 버리는지(src/login.js의 isCurrent),
  // 다시 켜면 받아 둔 방을 쓰는지, 없는 방과 연결 실패의 알림을 본다
  const SHORT = '#s=AbCd1234';
  // 짧은 링크의 방에는 주인이 그림 파일로 만든 사진(내 그림)도 담긴다. 네 색 가로 줄무늬 그림을 담는다
  const shortPic = await page.run(async () => {
    const { customValue } = await import(new URL('src/custom-picture.js', document.baseURI).href);
    return customValue([0xf00, 0x0f0, 0x00f, 0xff0], Uint8Array.from({ length: 576 }, (_, i) => Math.floor(i / 48) % 4));
  });
  const shortCode = await page.run(linkOf, { ...HOME, picture: shortPic }, '짧은친구');
  await open(SHORT);
  await page.run(fakeCloud, 'hold', { [SHORT.slice(3)]: shortCode });
  await powerOn();
  check('짧은 링크로 오면 방을 받는 동안 친구 방 자리가 눌리지 않는다', await page.run(() => {
    const t = document.querySelector('.users-friends .user');
    return !!t && t.disabled && t.textContent.includes('불러오는 중');
  }));
  await probe('짧은 링크의 방을 받는 로그인 화면');
  check('부팅할 때 서버에 방을 한 번 묻는다', (await page.run(id => window.__cloudCalls[id], SHORT.slice(3))) === 1);
  await page.run(() => document.getElementById('power').click());
  check('전원을 끄면 로그인 화면이 꺼진다', await until(page, () => document.getElementById('login').hidden && document.getElementById('boot').hidden, 10000));
  await page.run(() => window.__cloudAnswer());
  await sleep(500);
  check('받기 전에 전원을 끄면 늦게 온 답으로 손님 자리를 만들지 않는다', await page.run(() => !document.getElementById('login').textContent.includes('손님으로 구경하기')));
  await powerOn();
  check('다시 켜면 받아 둔 친구 방이 손님 자리로 나온다', await until(page, () => [...document.querySelectorAll('.users .user')]
    .some(t => !t.disabled && t.textContent.includes('짧은친구') && t.textContent.includes('손님으로 구경하기')), 3000));
  check('짧은 링크의 친구 방에도 서버의 방에 담긴 주인의 내 그림이 보인다', await page.run(() => [...document.querySelectorAll('.users .user')]
    .find(t => t.textContent.includes('짧은친구'))?.querySelector('.user-pic')?.dataset.pic === 'my'));
  check('다시 켜도 서버에 다시 묻지 않는다', (await page.run(id => window.__cloudCalls[id], SHORT.slice(3))) === 1);
  await page.run(clickText, '.users .user', '손님으로 구경하기');
  check('짧은 링크의 손님 자리를 누르면 친구 방에 손님으로 들어간다', await until(page, () => document.getElementById('stage').dataset.mode === 'visit'
    && !document.getElementById('desktop').hidden && document.getElementById('toast').textContent.includes('짧은친구'), 5000));
  check('짧은 링크로 들어간 방은 최근에 놀러 간 집으로 이 브라우저에 남는다', await page.run(id => JSON.parse(localStorage.getItem('agarago.recent') || '[]')[0]?.room === id, SHORT.slice(3)));
  await page.run(clickOnce, '.start-btn');
  check('짧은 링크의 손님 시작 메뉴에 주인의 내 그림이 보인다', (await page.run(shownPic, '#start-menu .start-head')) === 'my');
  await page.run(clickOnce, '.start-btn');
  await open(SHORT);
  await page.run(fakeCloud, 'missing');
  await powerOn();
  check('없는 방의 짧은 링크는 친구 방 자리를 지우고 알린다', await until(page, () => !document.querySelector('.users .user[disabled]')
    && !!document.querySelector('.users .user') && document.getElementById('toast').textContent.includes('찾을 수 없습니다'), 3000));
  await open(SHORT);
  await page.run(fakeCloud, 'offline');
  await powerOn();
  check('서버에 닿지 못하면 친구 방 자리를 지우고 알린다', await until(page, () => !document.querySelector('.users .user[disabled]')
    && document.getElementById('toast').textContent.includes('불러오지 못했습니다'), 3000));

  // ---------- 실험실 ----------
  // 암호를 말하기 전에는 흔적이 없고, 말하면 아이콘이 생긴다. 켠 항목은 새로 고침해도 남고, 실험실 닫기는 처음으로 돌린다(src/labs.js)
  const labsState = () => { const s = JSON.parse(localStorage.getItem('agarago.settings') || '{}'); return `${!!s.labsOpen}/${(s.labs || []).join()}`; };
  const enterMine = async () => {
    await open();
    await powerOn();
    await page.run(clickOnce, '.users .user:not(.neighbor)');
    return desktop();
  };
  check('실험실: 내 사용자로 다시 들어간다', await enterMine());
  check('암호를 말하기 전에는 바탕화면에 실험실 아이콘이 없다', await page.run(() => !document.querySelector('#icons [data-app="labs"]')));
  await page.run(clickOnce, '.start-btn');
  check('암호를 말하기 전에는 시작 메뉴에도 실험실이 없다', await page.run(() => ![...document.querySelectorAll('.start-item')].some(i => i.textContent.includes('실험실'))));
  await page.run(clickOnce, '.start-btn');
  await page.run(() => document.querySelector('#desktop').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await press(page, 'Enter');
  await page.run(() => { document.querySelector('.say-input').value = '  엔믹스지우 '; });
  await press(page, 'Enter');
  check('말풍선에 암호를 말하면(앞뒤 공백 무시) 실험실 아이콘과 알림이 뜬다', await until(page, () => !!document.querySelector('#icons [data-app="labs"]')
    && document.getElementById('toast').textContent.includes('실험실'), 2000));
  await openIcon('labs');
  check('실험실 아이콘이 창을 연다', await until(page, () => !!document.querySelector('#windows .labs-app input[type="checkbox"]'), 3000));
  await probe('창 labs');
  await page.run(() => document.querySelector('.labs-item[data-lab="fast-saver"] input').click());
  check('화면 보호기 빨리 보기를 켜면 설정에 남는다', (await page.run(labsState)) === 'true/fast-saver', await page.run(labsState));
  await closeWindows();
  await page.run(() => document.querySelector('#desktop').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  check('화면 보호기 빨리 보기를 켜면 20초 뒤에 화면 보호기가 돈다', await until(page, () => !document.querySelector('.saver').hidden, 23000));
  await press(page, 'Escape'); // 화면 보호기 걷기
  check('새로 고침해도 실험실 아이콘이 남는다', (await enterMine()) && await until(page, () => !!document.querySelector('#icons [data-app="labs"]'), 2000));
  await openIcon('labs');
  check('새로 고침해도 켠 항목이 켜져 있다', await until(page, () => document.querySelector('.labs-item[data-lab="fast-saver"] input')?.checked === true, 3000));
  check('실험실 창은 스크롤 없이 실험실 닫기 단추까지 보인다', await page.run(() => { const b = document.querySelector('#windows .labs-app'); return b.scrollHeight <= b.clientHeight; }));
  // 주인 아바타(F8, 2026-11-17까지 실험실 host-avatar): 친구 집에 가면 주인 아바타가 이름표를 달고 방에 서서 인사말을 하고, 손님인 내 아바타는 손님 옷을 입는다. 내 집은 그대로다
  await closeWindows();
  check('내 집에는 주인 아바타가 없고 내 아바타는 기본 옷이다', (await page.run(ownerScene)) === '주인 없음, 나 기본 옷', await page.run(ownerScene));
  if (neighbors) {
    // 레포의 이웃집이 서버에서 받는 link 줄이면 받기 전에는 눌리지 않는다. 서버 대신 답하고, 받아서 눌리게 된 첫 집에 들어간다(known-issues 87)
    await open();
    await page.run(fakeCloud, 'serve', neighborRooms);
    await powerOn();
    await until(page, () => !!document.querySelector('.users .user.neighbor:not([disabled])'), 3000);
    await page.run(clickOnce, '.users .user.neighbor:not([disabled])');
    check('이웃집에 들어가면 주인 아바타가 이름표를 달고 서 있고 내 아바타는 손님 옷이다', (await desktop()) && /^주인 기본 옷 .+, 나 손님 옷$/.test(await page.run(ownerScene)), await page.run(ownerScene));
    // 주인이 선 칸의 바닥을 누르면 손님은 그 칸에 들어가지 않고 바로 옆 칸에 멈춘다(주인 칸은 지나갈 수 없다)
    await page.run(() => {
      const r = document.querySelector('#wallpaper .room-owner').getBoundingClientRect();
      const p = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + (r.height * 100) / 104 };
      const floor = document.getElementById('desktop');
      floor.dispatchEvent(new PointerEvent('pointerdown', p));
      floor.dispatchEvent(new PointerEvent('pointerup', p));
    });
    check('주인 아바타가 선 칸을 누르면 내 아바타는 그 바로 옆 칸에 멈춘다', await until(page, nextToOwner, 6000));
  }
  const greeter = await page.run(linkOf, { ...HOME, greeting: '어서 와' }, '인사');
  await open(`#r=${greeter}`);
  await powerOn();
  await page.run(clickText, '.users .user', '손님으로 구경하기');
  await desktop();
  check('주인 아바타는 손님이 들어오면 주인이 적어 둔 인사말을 말풍선으로 말한다', await until(page, () => [...document.querySelectorAll('#wallpaper .room-avatar-say')]
    .some(b => !b.hidden && b.textContent === '어서 와'), 3000) && (await page.run(ownerScene)) === '주인 기본 옷 인사, 나 손님 옷', await page.run(ownerScene));
  check('실험실: 내 집으로 돌아온다', await enterMine());
  await openIcon('labs');
  await until(page, () => !!document.querySelector('.labs-app .btn'), 3000);

  await page.run(clickText, '.labs-app .btn', '실험실 닫기');
  check('실험실 닫기를 누르면 창과 아이콘이 사라지고 모든 항목이 꺼진다', await until(page, () => !document.querySelector('#icons [data-app="labs"]') && !document.querySelector('.labs-app'), 2000)
    && (await page.run(labsState)) === 'false/', await page.run(labsState));

  // ---------- 미니게임이 가려지면 멈추기 ----------
  // 미니게임 창을 최소화하거나 브라우저 탭이 뒤로 가면 게임이 멈춘다(AGA.onHide, AGA.onShow, known-issues 75). 파일 정리 10은 다시 보일 때
  // 이어서 하기 카드를 띄우고, 짐 정리는 바로 이어진다. 탭이 가려지는 것은 F27 절처럼 새 탭을 앞에 열어 진짜로 만든다.
  // 앞 절에서 실험실을 닫아서 빨리 보기의 화면 보호기가 재는 동안 뜨지 않는다.
  // 흘러야 하는 것은 정해진 시간만 기다리지 않고 움직일 때까지 기다린다. 컴퓨터가 바쁘면 화면 없는 크롬의 프레임이 1초 넘게 멎기도 했다
  const TEN = '파일 정리 10';
  const openGame = async (id, title, word) => {
    await closeWindows();
    await openIcon('games');
    await sleep(300);
    await page.run(clickTwice, `.folder-grid .desk-icon[data-app="${id}"]`);
    return until(page, miniGame, 8000, title, '', { card: word });
  };
  await page.run(() => { localStorage.setItem('file-ten.tutored', 'true'); localStorage.setItem('file-ten.mode', '"normal"'); }); // 첫 판 안내 없이 시계가 바로 흐르게
  check('파일 정리 10이 시작 카드와 함께 뜬다', await openGame('file-ten', TEN, '보통'), JSON.stringify(await page.run(miniGame, TEN)));
  await page.run(miniGame, TEN, 'card:보통');
  check('파일 정리 10을 시작하면 시계가 흐른다', await until(page, miniGame, 5000, TEN, '', { leftBelow: 99.8 }), JSON.stringify(await page.run(miniGame, TEN)));
  const ten1 = await page.run(miniGame, TEN, 'min');
  await sleep(3000);
  await page.run(miniGame, TEN, 'task');
  check('최소화했다 다시 띄우면 이어서 하기 카드가 뜬다', await until(page, miniGame, 2000, TEN, '', { card: '이어서 하기' }));
  const ten2 = await page.run(miniGame, TEN);
  check('최소화한 3초 동안 남은 시간이 그대로다(1초 안쪽)', Math.abs(ten1.left - ten2.left) < 1, `${ten1.left} → ${ten2.left}`);
  await sleep(800);
  check('이어서 하기 카드가 떠 있는 동안 시계가 멈춰 있다', Math.abs((await page.run(miniGame, TEN)).left - ten2.left) < 0.05);
  await page.run(miniGame, TEN, 'card:이어서 하기');
  check('이어서 하기를 누르면 시계가 다시 흐른다', await until(page, miniGame, 5000, TEN, '', { leftBelow: ten2.left - 0.2 }), `${ten2.left} → ${JSON.stringify(await page.run(miniGame, TEN))}`);
  const ten3 = await page.run(miniGame, TEN);
  const otherTab = (await page.send('Target.createTarget', { url: 'about:blank' })).targetId;
  await sleep(2000);
  await page.send('Page.bringToFront');
  check('다른 탭에 갔다 돌아오면 이어서 하기 카드가 뜬다', await until(page, miniGame, 2000, TEN, '', { card: '이어서 하기' }), JSON.stringify(await page.run(miniGame, TEN)));
  await page.send('Target.closeTarget', { targetId: otherTab });
  const ten4 = await page.run(miniGame, TEN);
  check('다른 탭에 가 있던 2초 동안 남은 시간이 그대로다(0.5초 안쪽)', Math.abs(ten3.left - ten4.left) < 0.5, `${ten3.left} → ${ten4.left}`);
  check('짐 정리가 시작 카드와 함께 뜬다', await openGame('tidy-up', '짐 정리', '게임 시작'));
  await page.run(miniGame, '짐 정리', 'card:게임 시작');
  await sleep(600); // 게임 페이지가 뜨고 0.45초(DROP_GAP) 안에는 떨어뜨리지 않는다
  await page.run(miniGame, '짐 정리', 'drop');
  await sleep(200);
  const tidy1 = await page.run(miniGame, '짐 정리');
  await sleep(1000);
  const tidy2 = await page.run(miniGame, '짐 정리');
  check('최소화하면 짐 정리의 떨어지던 물건이 그 자리에 멈춘다', tidy1?.y != null && tidy1.y === tidy2.y, `${tidy1?.y} → ${tidy2?.y}`);
  await page.run(miniGame, '짐 정리', 'task');
  check('짐 정리는 다시 띄우면 카드 없이 바로 이어진다', await until(page, miniGame, 5000, '짐 정리', '', { fellFrom: tidy2.y }) && !(await page.run(miniGame, '짐 정리')).card,
    JSON.stringify(await page.run(miniGame, '짐 정리')));
  await closeWindows();

  // ---------- 담긴 가구 반짝임(F12, 2026-11-17까지 실험실 like-sparkle) ----------
  // 주인이 무언가 담아 둔 가구 위에만 별이 뜬다(src/os.js의 markLiked, style.css의 .has-like::after). 내 집, 친구 집, 이웃집에서 같고 방 꾸미기 창에는 뜨지 않는다.
  const liked = () => page.run(() => [...document.querySelectorAll('#wallpaper .furn.has-like')].map(f => f.dataset.id).sort().join());
  check('담긴 가구 반짝임: 내 집으로 돌아온다', await enterMine());
  await sleep(600);
  // 점검용 집에서 담긴 것은 컴퓨터, 게임기, 책장, TV다. 앞의 점검이 라디오에 CD를 넣었다면 라디오도 담긴 가구다. 그래서 저장된 집에서 담긴 가구를 구해 견준다.
  // 코르크 보드(쪽지는 서버에 있어 알 수 없다)와 담는 것이 없는 가구에는 뜨지 않는다
  const mine = await page.run(savedHome);
  const want = mine.scenes.room.map(i => i.id).filter(id => Object.hasOwn(mine.likes || {}, id)).sort().join();
  check('담아 둔 가구(컴퓨터, 게임기, 책장, TV를 포함해 저장된 집에서 담긴 가구)에만 반짝임이 뜬다',
    ['bookshelf', 'computer', 'console', 'tv'].every(id => want.split(',').includes(id)) && (await liked()) === want, `${await liked()} / ${want}`);
  check('반짝임은 12~20px의 별이고 누르기를 가리지 않고 깜박인다', await page.run(() => {
    const s = getComputedStyle(document.querySelector('#wallpaper .furn.has-like'), '::after');
    return parseFloat(s.width) >= 12 && parseFloat(s.width) <= 20 && s.pointerEvents === 'none' && s.animationName === 'like-sparkle';
  }));
  await openIcon('room');
  check('방 꾸미기 창에는 반짝임이 뜨지 않는다', await until(page, () => document.querySelectorAll('#windows .room-app .furn').length > 0, 3000)
    && await page.run(() => !document.querySelector('#windows .room-app .has-like')));
  await closeWindows();
  check('새로 고침해도 반짝임이 그대로 뜬다', (await enterMine()) && await until(page, n => document.querySelectorAll('#wallpaper .furn.has-like').length === n, 3000, want.split(',').length));
  // 친구 집: 가구는 있지만 아무것도 담지 않은 집에는 하나도 뜨지 않는다
  const bare = await page.run(linkOf, { scenes: { room: [{ id: 'bookshelf', x: 2, y: 2 }, { id: 'desk', x: 5, y: 2 }, { id: 'radio', x: 5, y: 2 }] } }, '빈집');
  await open(`#r=${bare}`);
  await powerOn();
  await page.run(clickText, '.users .user', '손님으로 구경하기');
  await desktop();
  await sleep(600);
  check('아무것도 담지 않은 친구 집에는 반짝임이 하나도 뜨지 않는다', (await page.run(() => document.querySelectorAll('#wallpaper .furn').length)) === 3 && (await liked()) === '');
  // 이웃집: 이웃집 점검 절의 점검용 link 이웃집(LINK_NEIGHBOR)을 다시 불러, 서버가 돌려준 방(점검용 집이라 담긴 가구가 있다)에서 담긴 가구를 구해 견준다.
  // 레포의 이웃집은 담긴 가구가 있는지 목록만 봐서는 알 수 없고 바뀌기도 해서 쓰지 않는다. 이 이웃집이 받아지지 않으면 건너뛰지 않고 실패로 센다
  await extraNeighbor(page, LINK_NEIGHBOR);
  await open();
  await page.run(fakeCloud, 'serve', neighborRooms);
  const keeper = await page.run(async neighborId => {
    const { NEIGHBOR_LIST, neighborHome } = await import(new URL('src/neighbors.js', document.baseURI).href);
    const n = NEIGHBOR_LIST.find(x => x.id === neighborId);
    const home = n && await neighborHome(n); // link 이웃집은 서버에서 받으므로 기다린다
    return home ? home.scenes.room.map(i => i.id).filter(id => Object.hasOwn(home.likes, id)).sort().join() : null;
  }, LINK_NEIGHBOR.id);
  await powerOn();
  await until(page, name => [...document.querySelectorAll('.users .user.neighbor')].some(t => !t.disabled && t.textContent.includes(name)), 3000, SERVER_NAME);
  await page.run(clickText, '.users .user.neighbor', SERVER_NAME);
  await desktop();
  await sleep(600);
  check('이웃집의 방에는 담아 둔 가구 위에만 반짝임이 뜬다', !!keeper && keeper.split(',').length >= 1 && (await liked()) === keeper, `${await liked()} / ${keeper}`);
  await extraNeighbor(page, null);

  // ---------- 펫(F30, 2026-11-17까지 실험실 pet) ----------
  // 고르기 전에는 내 집의 방에만 기본 펫(회색 고양이)이 빈 바닥 칸에 앉는다(src/pet.js). 시작 메뉴의 "펫"이나 바탕화면의 펫 아이콘을 누르면 펫 창(src/apps/pet-app.js)이 열려
  // 지금 펫과 하는 일, 쓰다듬은 횟수를 보이고, 창의 쓰다듬기와 할 일 단추는 방의 펫에게 닿는다. 종류와 색을 누르면 바로 저장되고 방의 펫이 바뀐다.
  // "없음"을 누르면 펫이 사라지고, 종류를 다시 누르면 돌아온다.
  // 두 번 누르면 내 아바타가 바로 옆 칸으로 와서 쓰다듬고, 펫은 눈을 감고 하트가 뜬다. 내 아바타는 펫이 앉은 칸에 들어가지 못한다.
  // 병아리는 쓰다듬은 횟수가 열 번이 되면 같은 색의 닭이 되고, 펫 창의 이름과 큰 그림, 병아리 단추도 닭으로 바뀐다.
  // 친구 집에는 펫도 펫 창도 없다. 10~20초마다 걷는 것은 기다리지 않는다(쓰다듬은 뒤 10초는 걷지 않는다).
  // 펫을 오른쪽 단추로 누르면 할 일 메뉴가 뜬다. 고양이는 명령을 받으면 쳐다보기만 하고, 강아지는 따라오기(아바타 바로 뒤 칸까지 같은 빠르기로,
  // 아바타의 길을 막지 않는다)와 기다리기(그 칸에서 움직이지 않는다)를 듣는다. 병아리는 처음부터 따라오고 닭이 되면 혼자 논다.
  // 다른 절은 펫을 "없음"으로 두고 돌므로(가구가 놓인 내 집 절) 펫 설정을 비워 고르기 전 모습부터 보고, 끝나면 앞 절이 끝난 설정으로 돌려놓는다
  const petSettings = await page.run(() => localStorage.getItem('agarago.settings'));
  await page.run(() => { const s = JSON.parse(localStorage.getItem('agarago.settings') || '{}'); delete s.pet; localStorage.setItem('agarago.settings', JSON.stringify(s)); });
  const hasPet = () => page.run(() => !!document.querySelector('#wallpaper .room-pet'));
  const waitPet = async (test, ms) => {
    const t0 = Date.now();
    for (;;) {
      const s = await page.run(petScene);
      if (test(s) || Date.now() - t0 > ms) return s;
      await sleep(100);
    }
  };
  // 고양이는 방에 처음 나올 때 몫(src/config.js의 PERCH.start)만큼 가구 위에서 시작한다. 아래 확인은 바닥에서 시작하는 고양이를 보므로,
  // 로그인 화면에서 그 몫을 페이지 안에서 0으로 두고 들어간다(새로 고침하면 돌아온다). 가구 위에서 시작하는 것은 움직임 줄이기 확인에서 본다
  const enterPerch = async start => {
    await open();
    await powerOn();
    await page.run(async n => { (await import(new URL('src/config.js', document.baseURI).href)).PERCH.start = n; }, start);
    await page.run(clickOnce, '.users .user:not(.neighbor)');
    return desktop();
  };
  check('펫: 내 집으로 돌아온다', await enterPerch(0));
  const cat = await waitPet(s => !!s.pet, 3000);
  check('고르기 전에도 내 방의 빈 바닥 칸(벽에 붙은 줄, 가구, 내 아바타가 없는 칸)에 기본 펫(회색 고양이)이 앉는다', cat.floor && !(cat.pet.x === cat.me?.x && cat.pet.y === cat.me?.y) && cat.look === 'cat/gray', JSON.stringify(cat));
  // 오른쪽 단추 메뉴(src/pet.js의 openMenu). 맨 위의 굵은 줄은 두 번 누를 때 하는 일이고, 지금 하는 일 앞에 점이 찍힌다
  const { IGNORED } = await page.run(async () => ({ IGNORED: (await import(new URL('src/pet.js', document.baseURI).href)).IGNORED }));
  check('펫을 오른쪽 단추로 누르면 브라우저 메뉴 대신 쓰다듬기와 할 일 셋이 든 메뉴가 뜨고, 지금 하는 일(혼자 놀기)에 점이 찍혀 있다',
    (await page.run(rightClickPet)) === true && (await page.run(petMenu)) === '쓰다듬기,따라오게 하기,기다리게 하기,*혼자 놀게 하기', String(await page.run(petMenu)));
  check('펫 메뉴는 무대 안에 뜨고 키를 받는다', await page.run(() => {
    const m = document.querySelector('.ctx-menu');
    const r = m.getBoundingClientRect(), s = document.getElementById('stage').getBoundingClientRect();
    return document.activeElement === m && r.left >= s.left && r.top >= s.top && r.right <= s.right && r.bottom <= s.bottom;
  }));
  await probe('펫 메뉴');
  const beforeKey = await page.run(myCell);
  await press(page, 'ArrowDown');
  await sleep(400);
  check('펫 메뉴에서 아래 방향키를 누르면 첫 줄로 가고, 내 아바타는 걷지 않는다', await page.run(() => document.activeElement?.textContent === '쓰다듬기')
    && JSON.stringify(await page.run(myCell)) === JSON.stringify(beforeKey));
  await press(page, 'Escape');
  check('Esc를 누르면 펫 메뉴가 닫힌다', await page.run(() => !document.querySelector('.ctx-menu')));
  // 고양이는 명령을 듣지 않는다. 아바타 쪽을 쳐다보다 돌아서고(그림을 뒤집는다) 아바타가 한마디 한다
  await page.run(() => {
    const p = document.querySelector('#wallpaper .room-pet');
    let was = p.classList.contains('flip');
    window.__petTurns = 0;
    new MutationObserver(() => { if (p.classList.contains('flip') !== was) { was = !was; window.__petTurns += 1; } }).observe(p, { attributes: true, attributeFilter: ['class'] });
  });
  await page.run(rightClickPet);
  await page.run(clickText, '.ctx-menu .ctx-menu-item', '따라오게 하기');
  check('고양이에게 따라오게 하기를 누르면 메뉴가 닫히고 내 아바타가 "따라와!"라고 말한다', (await page.run(avatarSays)) === '따라와!' && await page.run(() => !document.querySelector('.ctx-menu')));
  check(`고양이는 쳐다보다가 돌아서고, 내 아바타가 "${IGNORED}"라고 말한다`, await until(page, t => document.querySelector('#wallpaper .room-avatar-say:not(.room-pet-say)')?.textContent === t, 3000, IGNORED)
    && (await page.run(() => window.__petTurns)) >= 1, `돌아본 횟수 ${await page.run(() => window.__petTurns)}`);
  const catAt = (await page.run(petScene)).pet;
  await page.run(floorTap, catAt.x > 6 ? 3 : 9, 9);
  await sleep(1500);
  const catStays = await page.run(petScene);
  await page.run(rightClickPet);
  check('고양이는 따라오지 않고, 메뉴의 점도 혼자 놀게 하기에 그대로 있다', catStays.pet.x === catAt.x && catStays.pet.y === catAt.y
    && (await page.run(petMenu)) === '쓰다듬기,따라오게 하기,기다리게 하기,*혼자 놀게 하기', JSON.stringify(catStays));
  await press(page, 'Escape');
  // 가구 위에 올라가기(src/pet.js의 perchTrip, climb, descend, vacate). 고양이는 방에 처음 나올 때 몫(src/config.js의 PERCH.start)만큼 가구 위에서 시작하고,
  // 혼자 놀다 쉬고 일어날 때 가끔 가구 옆 칸까지 걸어가 윗면에 뛰어올라 웅크린다. 아바타가 그 가구를 쓰러 오면 뛰어내리고, 방 꾸미기에서 그 가구를 돌려 놓으면 뛰어내린다.
  // 움직임 줄이기를 켠 사람에게는 뛰지 않고 자리만 바뀐다. 쉬는 시간과 몫(data/pets.js의 mood.rest, src/config.js의 PERCH)은 페이지 안에서 바꾼다(새로 고침하면 돌아온다).
  // 점검용 집에서 올라갈 수 있는 가구는 침대와 책상인데, 책상의 윗면(data/furniture.js의 perch)을 페이지 안에서 빼서 침대로만 가게 한다.
  // 고양이는 침대에서 여덟 칸(PERCH_REACH) 안에 있어야 침대로 가므로, 바닥 아무 칸에서 시작하면 언제 오를지 정해지지 않는다. 그래서 침대 위에서 시작해
  // 아바타가 침대를 쓰면 침대 옆으로 내려오게 하고, 거기서 쉰 뒤 다시 올라가는 것을 본다. 끝나면 침대를 돌리기 전의 집으로 다시 들어간다
  const perchHome = await page.run(() => localStorage.getItem('agarago.home.v3'));
  const tune = (rest, extra = {}) => page.run(async (rest, extra) => {
    Object.assign((await import(new URL('src/config.js', document.baseURI).href)).PERCH, extra);
    (await import(new URL('data/pets.js', document.baseURI).href)).PET_SPECIES.find(s => s.id === 'cat').mood.rest = rest;
    (await import(new URL('data/furniture.js', document.baseURI).href)).BY_ID.desk.perch = 0;
  }, rest, extra);
  // 고양이가 침대 위에서 시작하게 들어간다(로그인 화면에서 시작 몫을 1로 두고 책상의 윗면을 뺀다)
  const enterOnBed = async () => {
    await open();
    await powerOn();
    await page.run(async () => {
      (await import(new URL('src/config.js', document.baseURI).href)).PERCH.start = 1;
      (await import(new URL('data/furniture.js', document.baseURI).href)).BY_ID.desk.perch = 0;
    });
    await page.run(clickOnce, '.users .user:not(.neighbor)');
    return desktop();
  };
  const onBed = ms => until(page, () => !!document.querySelector('#wallpaper .room-pet[data-perch="bed"]'), ms);
  // 침대(점검용 집의 (0, 3)에 놓인 3×4칸) 둘레의 바닥 칸인지(모서리의 대각선 칸은 빼고)
  const besideBed = c => !!c && Math.max(0 - c.x, 0, c.x - 2) + Math.max(3 - c.y, 0, c.y - 6) === 1;
  await enterOnBed();
  const startUp = (await onBed(3000)) && await page.run(perchScene);
  check('방에 처음 나올 때 고양이가 침대 위에 웅크린 채 시작할 수 있다(발끝이 침대 그림 안이고 침대보다 위에 그려진다)', !!startUp && startUp.inside && startUp.above
    && /^loaf/.test(startUp.frame), JSON.stringify(startUp));
  await probe('침대 위의 고양이');
  check('침대 위에 있는 동안에도 쓰다듬기와 할 일 메뉴가 뜬다', (await page.run(rightClickPet)) === true && (await page.run(petMenu)) === '쓰다듬기,따라오게 하기,기다리게 하기,*혼자 놀게 하기', String(await page.run(petMenu)));
  await press(page, 'Escape');
  // 아바타가 침대를 쓰러 오면(두 번 누르기) 다 왔을 때 고양이가 침대 둘레의 빈 바닥 칸으로 뛰어내린다. 내려온 뒤에는 5초 쉬어 바로 다시 올라가지 않는다
  await tune([5000, 5000], { odds: 1, stay: [60000, 60000] });
  await page.run(watchPoses);
  await page.run(clickTwice, '#wallpaper .furn[data-id="bed"]');
  const jumped = await waitPet(s => !s.perch && s.floor && !/^walk/.test(s.frame), 8000);
  const bedWords = await page.run(avatarSays);
  check('아바타가 침대를 쓰러 오면 고양이가 침대 둘레의 빈 바닥 칸으로 뛰어내리고, 아바타는 침대의 혼잣말을 한다', !jumped.perch && jumped.floor && besideBed(jumped.pet)
    && !(jumped.pet.x === jumped.me.x && jumped.pet.y === jumped.me.y) && bedWords === '눕자마자 잠들겠다.'
    && (await page.run(() => window.__petPoses.has('walk2'))), JSON.stringify({ jumped, bedWords }));
  // 쉬고 일어나면 가구로 가는 몫을 1로 두었으므로 침대 옆 칸까지 걸어가 다시 뛰어오른다. 올라간 뒤로는 1분 머문다
  await tune([300, 400]);
  await page.run(watchPoses);
  const climbed = (await onBed(12000)) && await page.run(perchScene);
  check('고양이는 혼자 놀다 침대 옆 칸에서 침대 위로 뛰어올라 웅크린다', !!climbed && climbed.inside && climbed.above && /^loaf/.test(climbed.frame)
    && (await page.run(() => window.__petPoses.has('walk1'))), JSON.stringify(climbed));
  // 방 꾸미기에서 침대를 끌며 R로 돌려 놓으면, 바탕화면의 방을 다시 그릴 때 고양이가 뛰어내린다. 내려온 뒤로는 1분 쉬어 다시 올라가지 않는다
  await tune([60000, 60000]);
  await openIcon('room');
  await until(page, () => !!document.querySelector('.room-app .items .furn[data-id="bed"] .hit'), 5000);
  await sleep(600);
  const bedHit = await page.run(centreOf, '.room-app .items .furn[data-id="bed"] .hit');
  await mouse(page, 'mousePressed', bedHit);
  await mouse(page, 'mouseMoved', { x: bedHit.x + 4, y: bedHit.y + 2 });
  await mouse(page, 'mouseMoved', { x: bedHit.x + 9, y: bedHit.y + 4 });
  await until(page, () => !!document.querySelector('.ghost .furn'), 2000);
  await page.run(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', key: 'r', cancelable: true, bubbles: true })));
  await mouse(page, 'mouseMoved', { x: bedHit.x + 10, y: bedHit.y + 4 });
  await mouse(page, 'mouseReleased', { x: bedHit.x + 10, y: bedHit.y + 4 });
  const turned = (await page.run(savedHome)).scenes.room.find(i => i.id === 'bed');
  const fell = await waitPet(s => !s.perch && s.floor && !/^walk/.test(s.frame), 4000);
  check('방 꾸미기에서 고양이가 앉은 침대를 돌려 놓으면 고양이가 침대에서 바닥 칸으로 뛰어내린다', turned?.r === 1 && !fell.perch && fell.floor, JSON.stringify({ turned, fell }));
  await closeWindows();
  // 움직임 줄이기를 켠 사람. 고양이가 침대 위에서 시작하고, 아바타가 침대를 쓰러 오면 뛰지 않고(걷는 그림 없이) 바닥 칸에 바로 앉는다
  await page.run(home => localStorage.setItem('agarago.home.v3', home), perchHome);
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await enterOnBed();
  check('움직임 줄이기를 켜도 고양이가 침대 위에서 시작할 수 있다', await onBed(3000), JSON.stringify(await page.run(perchScene)));
  await page.run(watchPoses);
  await page.run(clickTwice, '#wallpaper .furn[data-id="bed"]');
  const calm = await waitPet(s => !s.perch && s.floor, 8000);
  const calmPoses = await page.run(() => [...window.__petPoses].join());
  check('움직임 줄이기를 켠 사람에게는 아바타가 침대를 쓰러 오면 고양이가 뛰지 않고 침대 둘레의 바닥 칸에 바로 앉는다', !calm.perch && calm.floor && besideBed(calm.pet)
    && !/walk/.test(calmPoses), JSON.stringify({ calm, calmPoses }));
  // 움직임 줄이기를 켠 사람의 펫은 혼자 놀 때도 걷지 않으므로 펫 창은 혼자 논다고 쓰지 않는다
  await openIcon('pet');
  check('움직임 줄이기를 켠 사람에게는 펫 창이 혼자 노는 펫을 "방에 앉아 있습니다."라고 쓴다', await until(page, () => document.querySelector('.pet-app .pet-status')?.children[1].textContent === '방에 앉아 있습니다.', 3000),
    JSON.stringify(await page.run(petWindow)));
  await closeWindows();
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [] });
  check('가구 확인을 마치고 바닥에서 시작하는 고양이로 다시 들어간다', await enterPerch(0));
  check('펫 그림은 폭 34~68px이다(한 칸 2px 안팎, 24칸)', cat.width >= 34 && cat.width <= 68, `${cat.width}`);
  // 펫 창(src/apps/pet-app.js). 바탕화면의 펫 아이콘과 시작 메뉴 앱 줄의 "펫"으로 연다. 2026-11-18까지 시작 메뉴 아래쪽에 있던 "펫 바꾸기" 줄은 없다
  await page.run(clickOnce, '.start-btn');
  check('바탕화면에 펫 아이콘이 있고, 시작 메뉴의 앱 줄에 "펫"이 있으며 "펫 바꾸기" 줄은 없다', await page.run(() => {
    const items = [...document.querySelectorAll('#start-menu .start-item')].map(b => b.textContent);
    return !!document.querySelector('#icons .desk-icon[data-app="pet"]') && items.includes('펫') && !items.some(t => t.includes('펫 바꾸기'));
  }));
  check('시작 메뉴의 "펫"을 누르면 펫 창이 열린다', (await page.run(() => {
    const b = [...document.querySelectorAll('#start-menu .start-item')].find(i => i.textContent === '펫');
    b?.click();
    return !!b;
  })) && await until(page, () => !!document.querySelector('.pet-app'), 3000));
  // 맨 위에는 지금 펫과 하는 일, 쓰다듬은 횟수를 쓰고 지금 하는 일의 단추가 눌려 있다. 고양이는 명령을 듣지 않아 단추 아래에 그렇다고 적는다
  const catWin = await page.run(petWindow);
  check('펫 창 맨 위에 지금 펫(회색 고양이)과 하는 일, 쓰다듬은 횟수가 있고, 혼자 놀게 하기 단추가 눌려 있다', catWin?.name === '회색 고양이' && catWin.doing === '방에서 혼자 놀고 있습니다.'
    && catWin.pats === '쓰다듬은 횟수 0번' && catWin.grow === null && catWin.care && catWin.pressed === 'free' && catWin.off === 0, JSON.stringify(catWin));
  check('고양이의 펫 창에는 할 일 단추 아래에 시켜도 쳐다보기만 한다고 적혀 있다', catWin?.tip === '고양이는 시켜도 쳐다보기만 합니다.', catWin?.tip);
  check('펫 창에 종류 단추 여덟 개(닭은 병아리 단추가 맡는다)와 "없음", 색 단추 네 개가 있고 지금 펫이 골라져 있다', await page.run(() => {
    const rows = [...document.querySelectorAll('.pet-app .pet-row')];
    return rows.length === 2 && rows[0].children.length === 9 && rows[1].children.length === 4
      && [...rows[0].children].map(b => b.textContent).join() === '강아지,고양이,기니피그,병아리,비둘기,코끼리,코알라,공룡,없음'
      && rows[0].querySelector('[aria-pressed="true"]')?.dataset.pet === 'cat/gray' && rows[1].querySelector('[aria-pressed="true"]')?.dataset.pet === 'cat/gray';
  }));
  check('펫 창은 스크롤 없이 다 보이고, 할 일 단추는 한 줄에, 종류 단추는 같은 폭으로 한 줄에 선다', await page.run(() => {
    const b = document.querySelector('.pet-app');
    const kinds = [...document.querySelector('.pet-app .pet-row').children];
    const orders = [...document.querySelectorAll('.pet-app .pet-orders .btn')];
    return b.scrollHeight <= b.clientHeight && b.scrollWidth <= b.clientWidth && new Set(orders.map(o => o.offsetTop)).size === 1
      && new Set(kinds.map(k => k.offsetTop)).size === 1 && new Set(kinds.map(k => k.offsetWidth)).size === 1
      && kinds.every(k => k.lastChild.scrollWidth <= k.clientWidth);
  }));
  await probe('펫 창');
  await page.run(() => document.querySelector('.pet-app .pet-row [data-pet="none"]').click());
  check('"없음"을 누르면 방의 펫이 바로 사라지고 큰 그림과 할 일 단추, 색 묶음이 숨으며 설정에 남는다', await page.run(() => !document.querySelector('#wallpaper .room-pet')
    && document.querySelector('.pet-big').hidden && document.querySelector('.pet-care').hidden && [...document.querySelectorAll('.pet-app fieldset')][1].hidden
    && document.querySelector('.pet-app .pet-row [data-pet="none"]').getAttribute('aria-pressed') === 'true'
    && JSON.parse(localStorage.getItem('agarago.settings')).pet === 'none'));
  const noneWin = await page.run(petWindow);
  check('펫이 없으면 펫 창은 쓰다듬은 횟수 대신 종류를 고르면 펫이 나온다고 쓴다', noneWin?.name === '펫 없음' && noneWin.doing === '종류를 고르면 펫이 방에 나옵니다.' && noneWin.pats === null,
    JSON.stringify(noneWin));
  await probe('펫 없음');
  await page.run(() => [...document.querySelectorAll('.pet-app .pet-row')][0].querySelector('[data-pet^="dog/"]').click());
  check('"없음" 뒤에 종류를 누르면 그 펫이 방에 다시 나오고 색 묶음이 돌아온다', await until(page, () => document.querySelector('#wallpaper .room-pet')?.dataset.pet?.startsWith('dog/')
    && ![...document.querySelectorAll('.pet-app fieldset')][1].hidden, 3000));
  await page.run(() => [...document.querySelectorAll('.pet-app .pet-row')][1].querySelector('[data-pet="dog/sky"]').click());
  const picked = await page.run(() => ({ room: document.querySelector('#wallpaper .room-pet')?.dataset.pet, big: document.querySelector('.pet-big')?.dataset.pet, saved: JSON.parse(localStorage.getItem('agarago.settings')).pet }));
  check('펫 창에서 종류와 색을 누르면 바로 저장되고 방의 펫과 창의 큰 그림이 그 펫으로 바뀐다', picked.room === 'dog/sky' && picked.big === 'dog/sky' && picked.saved === 'dog/sky', JSON.stringify(picked));
  check('강아지처럼 명령을 듣는 펫의 창에는 방에서 오른쪽 단추로 눌러도 시킬 수 있다고 적혀 있다', (await page.run(petWindow))?.tip.includes('오른쪽 단추'), (await page.run(petWindow))?.tip);
  // 펫 창의 단추는 방의 펫에게 닿는다(src/pet.js의 pat, command). 쓰다듬기를 누르면 두 번 누른 것처럼 아바타가 와서 쓰다듬고, 창의 횟수가 늘며 큰 그림도 눈을 감는다
  await page.run(clickText, '.pet-app .pet-orders .btn', '쓰다듬기');
  const winPat = await waitPet(s => s.heart && s.next, 8000);
  const patWin = await page.run(petWindow);
  const bigShut = await page.run(() => [...document.querySelectorAll('.pet-big g[data-frame]')].find(g => g.style.display !== 'none')?.dataset.frame);
  check('펫 창의 쓰다듬기를 누르면 내 아바타가 와서 쓰다듬고, 창의 쓰다듬은 횟수가 1번이 되며 창의 큰 그림도 눈을 감는다', winPat.heart && winPat.next
    && patWin?.pats === '쓰다듬은 횟수 1번' && /blink/.test(bigShut || ''), JSON.stringify({ winPat, patWin, bigShut }));
  await waitPet(s => !s.heart, 3000);
  // 할 일 단추는 오른쪽 단추 메뉴의 줄과 같다. 창으로 시키면 메뉴의 점이, 창을 연 채 메뉴로 시키면 창의 하는 일과 눌린 단추가 따라 바뀐다(win.refreshPet)
  await page.run(clickText, '.pet-app .pet-orders .btn', '따라오게 하기');
  const toldWords = await page.run(avatarSays);
  const followWin = await page.run(petWindow);
  check('펫 창에서 따라오게 하기를 누르면 내 아바타가 "따라와!"라고 말하고, 창의 하는 일과 눌린 단추가 따라오기로 바뀐다', toldWords === '따라와!'
    && followWin?.doing === '아바타를 따라다니고 있습니다.' && followWin.pressed === 'follow', JSON.stringify({ toldWords, followWin }));
  check('펫 창으로 시킨 일은 오른쪽 단추 메뉴의 점에도 찍힌다', (await page.run(rightClickPet)) && (await page.run(petMenu)) === '쓰다듬기,*따라오게 하기,기다리게 하기,혼자 놀게 하기', String(await page.run(petMenu)));
  await page.run(clickText, '.ctx-menu .ctx-menu-item', '기다리게 하기');
  const stayWin = await page.run(petWindow);
  check('펫 창을 연 채 메뉴로 기다리게 하면 창의 하는 일과 눌린 단추가 기다리기로 바뀐다', stayWin?.doing === '그 자리에서 기다리고 있습니다.' && stayWin.pressed === 'stay', JSON.stringify(stayWin));
  await page.run(clickText, '.pet-app .pet-orders .btn', '혼자 놀게 하기');
  check('펫 창에서 혼자 놀게 하기를 누르면 다시 혼자 논다', (await page.run(petWindow))?.pressed === 'free' && (await page.run(avatarSays)) === '가서 놀아!', JSON.stringify(await page.run(petWindow)));
  await closeWindows();
  await probe('펫이 있는 바탕화면');
  await page.run(catchAudio);
  await page.run(clickTwice, '#wallpaper .room-pet');
  const primedDog = await page.run(petSoundsMade);
  const loved = await waitPet(s => s.heart && s.next, 8000);
  check('펫을 두 번 누르면 내 아바타가 바로 옆 칸으로 와서 쓰다듬고, 펫은 눈을 감고 하트가 뜬다', loved.heart && loved.next && /blink/.test(loved.frame), JSON.stringify(loved));
  const dogSound = await page.run(takePetSounds);
  check('쓰다듬기를 누른 순간에 그 종류의 소리(강아지는 pet-dog.mp3)를 만들어 둔다(사파리가 막지 않게, src/sound.js의 prime)', primedDog === 'pet-dog', primedDog);
  check('아바타가 와서 쓰다듬을 때 만들어 둔 그 소리를 한 번 낸다', dogSound.played === 'pet-dog' && dogSound.made === 'pet-dog', JSON.stringify(dogSound));
  // 펫이 앉은 칸의 바닥을 누르면 바로 옆에 선 아바타는 그 칸에 들어가지 않는다(펫 칸은 지나갈 수 없다)
  await page.run(() => {
    const r = document.querySelector('#wallpaper .room-pet svg').getBoundingClientRect();
    const p = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.bottom - 4 };
    const floor = document.getElementById('desktop');
    floor.dispatchEvent(new PointerEvent('pointerdown', p));
    floor.dispatchEvent(new PointerEvent('pointerup', p));
  });
  await sleep(800);
  const stay = await page.run(petScene);
  check('펫이 앉은 칸을 누르면 내 아바타는 그 칸에 들어가지 않고 옆 칸에 남는다', stay.next && stay.floor, JSON.stringify(stay));
  check('새로 고침해도 고른 펫이 그대로 나온다', (await enterMine()) && await until(page, () => document.querySelector('#wallpaper .room-pet')?.dataset.pet === 'dog/sky', 3000));
  // 따라오기(src/pet.js의 watch와 retrace). 강아지는 명령을 듣는다. 따라오게 하면 아바타 바로 옆 칸까지 오고, 아바타가 걸으면 지나온 칸을 같은 빠르기로 밟으며
  // 1~2칸 뒤에서 따라와 바로 뒤 칸에 선다. 따라오는 펫은 아바타의 길을 막지 않아서, 아바타가 펫 칸에 들어가면 펫이 아바타가 나온 칸으로 비킨다
  const isWalk = s => /^walk/.test(s.frame);
  await page.run(rightClickPet);
  await page.run(clickText, '.ctx-menu .ctx-menu-item', '따라오게 하기');
  check('강아지에게 따라오게 하기를 누르면 내 아바타가 "따라와!"라고 말하고 펫이 아바타 바로 옆 칸으로 온다', (await page.run(avatarSays)) === '따라와!'
    && (await waitPet(s => s.next && !isWalk(s), 6000)).next);
  const leadFrom = await page.run(petScene);
  const leadTo = { x: leadFrom.me.x > 6 ? 3 : 9, y: 9 };
  await page.run(floorTap, leadTo.x, leadTo.y);
  let farthest = 0;
  const followed = await waitPet(s => {
    farthest = Math.max(farthest, Math.abs(s.pet.x - s.me.x) + Math.abs(s.pet.y - s.me.y));
    return s.me.x === leadTo.x && s.me.y === leadTo.y && s.next && !isWalk(s);
  }, 8000);
  check('아바타가 걸어가면 따라오는 펫이 1~2칸 뒤에서 같이 걷다가 바로 뒤 칸에 선다', followed.next && followed.me.x === leadTo.x && farthest <= 2.2, `${JSON.stringify(followed)} 가장 멀 때 ${farthest.toFixed(2)}칸`);
  const dogAt = followed.pet;
  await page.run(floorTap, dogAt.x, dogAt.y);
  const swapped = await waitPet(s => s.me.x === dogAt.x && s.me.y === dogAt.y && s.next && !isWalk(s), 4000);
  check('따라오는 펫이 선 칸을 누르면 아바타가 그 칸에 들어가고 펫은 비켜 바로 옆에 선다', swapped.me.x === dogAt.x && swapped.me.y === dogAt.y && swapped.next, JSON.stringify(swapped));
  // 기다리기. 그 칸에 앉아 움직이지 않고, 그 칸은 혼자 놀 때처럼 아바타가 지나가지 못한다
  await page.run(rightClickPet);
  check('따라오는 동안 메뉴에는 따라오게 하기에 점이 찍혀 있다', (await page.run(petMenu)) === '쓰다듬기,*따라오게 하기,기다리게 하기,혼자 놀게 하기', String(await page.run(petMenu)));
  await page.run(clickText, '.ctx-menu .ctx-menu-item', '기다리게 하기');
  const stayWords = await page.run(avatarSays);
  const waitAt = (await page.run(petScene)).pet;
  await page.run(floorTap, waitAt.x > 6 ? 3 : 9, 9);
  await sleep(2500);
  const waited = await page.run(petScene);
  check('기다리게 하면 내 아바타가 "기다려!"라고 말하고, 아바타가 멀리 가도 펫은 그 칸에 앉아 있는다', stayWords === '기다려!' && waited.pet.x === waitAt.x && waited.pet.y === waitAt.y
    && Math.abs(waited.me.x - waitAt.x) + Math.abs(waited.me.y - waitAt.y) > 2, JSON.stringify({ stayWords, waitAt, waited }));
  await page.run(floorTap, waitAt.x, waitAt.y);
  await sleep(2500);
  const blockedBy = await page.run(petScene);
  check('기다리는 펫이 앉은 칸은 아바타가 들어가지 못한다', !(blockedBy.me.x === waitAt.x && blockedBy.me.y === waitAt.y) && blockedBy.pet.x === waitAt.x, JSON.stringify(blockedBy));
  await page.run(rightClickPet);
  await page.run(clickText, '.ctx-menu .ctx-menu-item', '혼자 놀게 하기');
  await page.run(rightClickPet);
  check('혼자 놀게 하기를 누르면 메뉴의 점이 혼자 놀게 하기로 돌아온다', (await page.run(petMenu)) === '쓰다듬기,따라오게 하기,기다리게 하기,*혼자 놀게 하기', String(await page.run(petMenu)));
  // 소리를 꺼 두고 쓰다듬는다. 새로 고친 뒤라 소리 기록을 다시 건다
  await page.run(catchAudio);
  await page.run(setSettings, { sound: false });
  await page.run(clickText, '.ctx-menu .ctx-menu-item', '쓰다듬기');
  check('메뉴의 쓰다듬기를 누르면 두 번 누른 것처럼 내 아바타가 와서 쓰다듬는다', (await waitPet(s => s.heart && s.next, 8000)).heart);
  const mutedPat = await page.run(takePetSounds);
  check('소리를 꺼 두면 쓰다듬어도 펫 소리를 만들거나 내지 않는다', mutedPat.played === '' && mutedPat.made === '', JSON.stringify(mutedPat));
  await page.run(setSettings, { sound: true });
  // 병아리 절은 아바타 옆에 따라와 앉는 병아리가 벽에 붙은 줄에 서지 않게 아바타를 방 가운데로 옮겨 두고 시작한다
  await page.run(floorTap, 6, 9);
  await waitPet(s => s.me.x === 6 && s.me.y === 9 && !s.heart, 6000);
  // 병아리가 닭으로 자라기(src/pet.js의 patted). 한 번 쓰다듬어 횟수가 느는 것을 보고, 아홉 번째까지는 설정으로 채운 뒤 한 번 더 쓰다듬는다.
  // 펫 창을 열어 둔 채 자라게 해, 창이 바로 닭으로 바뀌는지와 남은 횟수를 보는지도 본다. 자라도 같은 펫이라 쓰다듬은 횟수는 이어서 센다
  const petSaved = () => page.run(() => { const s = JSON.parse(localStorage.getItem('agarago.settings')); return { pet: s.pet, pats: s.petPats }; });
  await openIcon('pet');
  await until(page, () => !!document.querySelector('.pet-app'), 3000);
  await page.run(() => document.querySelector('.pet-app [data-kind="chick"]').click());
  check('펫 창에서 병아리를 고르면 방에 노랑 병아리가 나오고 쓰다듬은 횟수가 0이다', await until(page, () => document.querySelector('#wallpaper .room-pet')?.dataset.pet === 'chick/yellow', 3000)
    && JSON.stringify(await petSaved()) === '{"pet":"chick/yellow","pats":0}', JSON.stringify(await petSaved()));
  check('병아리의 펫 창에는 닭이 되기까지 남은 횟수가 있다', (await page.run(petWindow))?.grow === '10번 더 쓰다듬으면 닭이 됩니다.', JSON.stringify(await page.run(petWindow)));
  await probe('병아리를 고른 펫 창');
  // 병아리는 처음 본 아바타를 따라다닌다(data/pets.js의 mood.follow). 펫 창이 열려 있어도 메뉴는 창 위에 뜬다
  check('병아리는 처음부터 아바타 바로 옆으로 따라오고, 메뉴에는 따라오게 하기에 점이 찍혀 있다', (await waitPet(s => s.next && !/^walk/.test(s.frame), 6000)).next
    && (await page.run(rightClickPet)) && (await page.run(petMenu)) === '쓰다듬기,*따라오게 하기,기다리게 하기,혼자 놀게 하기', String(await page.run(petMenu)));
  check('펫 창이 열려 있어도 펫 메뉴가 창 위에 보인다', await page.run(() => {
    const r = document.querySelector('.ctx-menu').getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.ctx-menu') !== null;
  }));
  await press(page, 'Escape');
  await page.run(clickTwice, '#wallpaper .room-pet');
  const chick = await waitPet(s => s.heart && s.next, 8000);
  check('병아리를 한 번 쓰다듬으면 하트가 뜨고 쓰다듬은 횟수가 1이 되며, 아직 병아리다', chick.heart && chick.look === 'chick/yellow'
    && JSON.stringify(await petSaved()) === '{"pet":"chick/yellow","pats":1}', JSON.stringify({ chick, saved: await petSaved() }));
  check('병아리를 쓰다듬으면 펫 창의 횟수와 남은 횟수가 바로 바뀐다', await page.run(() => {
    const s = [...document.querySelector('.pet-app .pet-status').children].map(e => e.textContent);
    return s[2] === '쓰다듬은 횟수 1번' && s[3] === '9번 더 쓰다듬으면 닭이 됩니다.';
  }));
  const chickSound = await page.run(takePetSounds);
  check('병아리는 쓰다듬어도 소리를 내지 않고, 누른 순간에 자랄 때 낼 닭 소리만 만들어 둔다', chickSound.played === '' && chickSound.made === 'pet-chicken', JSON.stringify(chickSound));
  await page.run(async () => { const { settings } = await import(new URL('src/settings.js', document.baseURI).href); settings.set({ petPats: 9 }); });
  await page.run(clickTwice, '#wallpaper .room-pet');
  const hen = await waitPet(s => s.look === 'chicken/yellow' && s.heart, 8000);
  check('열 번째로 쓰다듬으면 그 자리에서 같은 색 id의 닭(흰 닭)이 되고 하트가 뜨며, 횟수는 이어서 10이 된다', hen.look === 'chicken/yellow' && hen.heart && hen.floor
    && JSON.stringify(await petSaved()) === '{"pet":"chicken/yellow","pats":10}', JSON.stringify({ hen, saved: await petSaved() }));
  const henSound = await page.run(takePetSounds);
  check('열 번째로 쓰다듬어 닭이 되는 순간에는 닭 소리(pet-chicken.mp3)를 낸다', henSound.played === 'pet-chicken' && henSound.made === 'pet-chicken', JSON.stringify(henSound));
  check('닭이 되면 내 아바타가 "벌써 닭이 됐네!"라고 말한다', await page.run(() => { const s = document.querySelector('#wallpaper .room-avatar-say'); return !!s && !s.hidden && s.textContent === '벌써 닭이 됐네!'; }));
  check('펫 창을 열어 둔 채 자라면 창의 이름과 큰 그림, 색 단추가 닭으로 바뀌고 병아리 단추에 닭이 그려진 채 골라져 있다', await page.run(() => {
    const kind = document.querySelector('.pet-app [data-kind="chick"]');
    const tones = [...document.querySelectorAll('.pet-app .pet-row')][1].children;
    return document.querySelector('.pet-app-head b').textContent === '흰색 닭' && document.querySelector('.pet-big').dataset.pet === 'chicken/yellow'
      && kind.dataset.pet === 'chicken/yellow' && kind.textContent === '닭' && kind.getAttribute('aria-pressed') === 'true'
      && [...tones].every(t => t.dataset.pet.startsWith('chicken/')) && tones[0].getAttribute('aria-pressed') === 'true';
  }));
  const henWin = await page.run(petWindow);
  check('닭이 되면 펫 창에서 남은 횟수 줄이 사라지고 쓰다듬은 횟수는 10번이며, 하는 일은 혼자 놀기다', henWin?.grow === null && henWin.pats === '쓰다듬은 횟수 10번' && henWin.pressed === 'free',
    JSON.stringify(henWin));
  await probe('닭이 된 펫 창');
  await page.run(rightClickPet);
  check('따라오던 병아리가 닭이 되면 따라다니지 않고 혼자 논다', (await page.run(petMenu)) === '쓰다듬기,따라오게 하기,기다리게 하기,*혼자 놀게 하기', String(await page.run(petMenu)));
  await press(page, 'Escape');
  await page.run(() => document.querySelector('.pet-app [data-kind="chick"]').click());
  check('닭일 때 병아리 단추를 다시 누르면 닭과 쓰다듬은 횟수가 그대로 있다', JSON.stringify(await petSaved()) === '{"pet":"chicken/yellow","pats":10}', JSON.stringify(await petSaved()));
  await page.run(() => document.querySelector('.pet-app [data-kind="dog"]').click());
  await page.run(() => document.querySelector('.pet-app [data-kind="chick"]').click());
  check('다른 종류를 골랐다가 병아리를 다시 고르면 새 병아리부터 시작하고, 병아리 단추에 다시 병아리가 그려진다', await until(page, () => document.querySelector('#wallpaper .room-pet')?.dataset.pet === 'chick/yellow'
    && document.querySelector('.pet-app [data-kind="chick"]').dataset.pet === 'chick/yellow', 3000)
    && JSON.stringify(await petSaved()) === '{"pet":"chick/yellow","pats":0}', JSON.stringify(await petSaved()));
  await closeWindows();
  await open(`#r=${bare}`);
  await powerOn();
  await page.run(clickText, '.users .user', '손님으로 구경하기');
  await desktop();
  await sleep(300);
  check('친구 집에는 펫이 없다', !(await hasPet()));
  await page.run(clickOnce, '.start-btn');
  check('친구 집에는 바탕화면의 펫 아이콘과 시작 메뉴의 "펫" 줄이 없다', await page.run(() => !document.querySelector('#icons .desk-icon[data-app="pet"]')
    && ![...document.querySelectorAll('.start-item')].some(i => i.textContent.includes('펫'))));
  await page.run(clickOnce, '.start-btn');
  await page.run(s => (s === null ? localStorage.removeItem('agarago.settings') : localStorage.setItem('agarago.settings', s)), petSettings);

  // ---------- 친구 집 배경음악(home-bgm) ----------
  // 켜고 친구 집에 들어가면 주인 라디오의 첫 유튜브 CD(앞의 애플 뮤직 CD는 건너뛴다)의 음악 창이 저절로 열리고, 구경을 마치면 닫힌다. 끄면 지금처럼 열리지 않는다.
  // 점검은 유튜브에 요청을 보내지 않으므로(main의 BLOCKED) 음악 창과 플레이어 주소까지만 본다. 소리가 나는지는 직접 듣는다(src/apps/radio-app.js의 startHomeMusic)
  const bgmSettings = await page.run(() => localStorage.getItem('agarago.settings'));
  const visitEvil = async labs => {
    await page.run(labs => localStorage.setItem('agarago.settings', JSON.stringify({ labsOpen: true, labs })), labs);
    await open(`#r=${evil}`); // 앞의 깨진 링크 절에서 만든 HTML이 든 친구 집(EVIL). 라디오에 애플 뮤직 CD와 유튜브 CD가 있다
    await powerOn();
    await page.run(clickText, '.users .user', '손님으로 구경하기');
    return desktop();
  };
  check('친구 집 배경음악을 켜고 친구 집에 들어가면 첫 유튜브 CD의 음악 창이 저절로 열린다', (await visitEvil(['home-bgm']))
    && await until(page, () => /^https:\/\/www\.youtube-nocookie\.com\/embed\/96URE_-aj-8\?.*autoplay=1/.test(document.querySelector('#windows .radio-player iframe')?.src || ''), 5000));
  check('저절로 열린 음악 창은 키를 가져가지 않는다', await page.run(() => !!document.querySelector('#windows .radio-player') && [...document.querySelectorAll('#windows .win')].every(w => w.classList.contains('inactive'))));
  await page.run(() => document.querySelector('.start-btn').click());
  await page.run(clickText, '#start-menu .start-item', '구경 마치기');
  check('구경을 마치면 저절로 연 음악 창이 닫힌다', await until(page, () => !document.getElementById('login').hidden && !document.querySelector('#windows .radio-player'), 3000));
  await visitEvil([]);
  await sleep(600);
  check('친구 집 배경음악을 끄면 친구 집에 들어가도 음악 창이 열리지 않는다', await page.run(() => !document.querySelector('#windows .radio-player')));
  await page.run(s => (s === null ? localStorage.removeItem('agarago.settings') : localStorage.setItem('agarago.settings', s)), bgmSettings);

  // ---------- 심심할 때 혼잣말(idle-talk) ----------
  // 켜고 바탕화면을 그냥 두면 내 아바타가 걸어서 갈 수 있는 가구 옆으로 가서 그 가구의 혼잣말을 하고, 같은 가구를 연달아 고르지 않고 되풀이한다(src/idle-talk.js).
  // 진짜 마우스를 움직이면(CDP) 가던 길을 버리고 처음부터 다시 잰다. 창이 열려 있거나(최소화한 창은 괜찮다) 방 꾸미기 창이 있거나 말풍선에 쓰는 중이면 하지 않는다.
  // 아바타가 혼자 걷는 동안 입력 이벤트가 생기지 않는지도 센다(생기면 화면 보호기가 늦어진다). 그림을 누르는 것은 click만 보내는 .click()으로 해서 입력으로 세지 않는다.
  // 30초와 40~60초를 다 기다리지 않게 들어갈 때마다 src/config.js의 IDLE_TALK를 페이지 안에서 줄인다(새로 고침하면 원래대로 돌아간다).
  // 첫 차례는 0.8초, 되풀이 간격은 점검용 집에서 가장 먼 가구 옆까지 걷는 시간(longestTrip)보다 0.4~0.6초 길게 둔다. 간격이 걷는 시간보다 짧으면 다음 차례가
  // 도착하기 전에 길을 바꾸어, 먼 가구를 고를 때마다 아바타가 말하지 못하고 왔다 갔다 한다. 진짜 간격(40~60초)은 걷는 시간의 열 배라서 이런 일이 없다(known-issues 107)
  const idleSettings = await page.run(() => localStorage.getItem('agarago.settings'));
  const idleBox = '.labs-item[data-lab="idle-talk"] input';
  const FIRST = 800;
  const idle = () => page.run(() => ({ said: window.__said, moves: window.__moves, inputs: window.__inputs, lastInput: window.__lastInput }));
  const avatarAt = () => page.run(() => { const a = document.querySelector('#wallpaper .room-avatar'); return `${a.style.left},${a.style.top}`; });
  const saidMore = (n, ms) => until(page, n => window.__said.length >= n, ms, n);
  // 마우스를 움직인다(부를 때마다 40px씩 오가서 늘 움직임으로 보낸다). 혼잣말이 기다리는 시간을 처음부터 다시 재서 다음 차례가 FIRST 뒤로 온다
  let nudges = 0;
  const nudge = () => page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700 + (nudges++ % 2) * 40, y: 500 });
  check('심심할 때 혼잣말: 내 집으로 돌아온다', await enterMine());
  const WALK = 200 * (await page.run(longestTrip)); // 한 칸 0.2초
  check('점검용 집에서 가구 옆까지 가장 먼 길을 잰다', WALK >= 1000 && WALK <= 8000, `${WALK}ms`);
  const AGAIN = [WALK + 400, WALK + 600];
  await page.run(async (first, again) => {
    const { IDLE_TALK } = await import(new URL('src/config.js', document.baseURI).href);
    Object.assign(IDLE_TALK, { first, again });
  }, FIRST, AGAIN);
  await page.run(watchIdle);
  await page.run(async () => (await import(new URL('src/labs.js', document.baseURI).href)).openLabs());
  await openIcon('labs');
  check('실험실 창에 심심할 때 혼잣말 항목이 있다', await until(page, sel => !!document.querySelector(sel), 3000, idleBox));
  await page.run(sel => document.querySelector(sel).click(), idleBox);
  await sleep(FIRST * 2);
  let seen = await idle();
  check('켜도 창이 열려 있는 동안에는 혼잣말하러 가지 않는다', seen.said.length === 0 && seen.moves === 0, JSON.stringify(seen));
  // 처음 서는 칸(8, 8)에서는 점검용 집의 어느 가구든 네 칸 넘게 걸어야 한다. 걷기 시작하면 아바타 위로 진짜 마우스를 움직인다
  await page.run(() => { window.__moves = 0; document.querySelector('#windows .win .win-min').click(); });
  const walking = await until(page, () => window.__moves > 0, FIRST + 3000);
  check('창을 최소화만 해 두면 바탕화면을 그냥 둘 때 아바타가 가구로 걸어간다', walking, JSON.stringify(await idle()));
  const over = await page.run(() => { const r = document.querySelector('#wallpaper .room-avatar').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: over.x, y: over.y });
  await sleep(300); // 걷던 한 칸(0.2초)은 마저 걷는다
  const halted = await avatarAt();
  await sleep(FIRST - 600); // 다음 차례(FIRST 뒤)에 가깝게 읽으면 느린 컴퓨터에서 새로 걷기 시작한 걸음을 본다
  seen = await idle();
  check('가구로 걷다가 마우스를 움직이면 바로 멈추고 혼잣말을 하지 않는다', seen.said.length === 0 && halted === await avatarAt(), `${halted} → ${await avatarAt()}, ${JSON.stringify(seen.said)}`);
  // 앞 확인이 실패해 말한 기록이 비어도 뒤 확인이 예외로 점검 전체를 끊지 않게 ?.로 읽는다
  check('마우스를 움직이고 기다리면 다시 가구로 가서 혼잣말을 한다', await saidMore(1, FIRST + WALK + 2000), JSON.stringify(await idle()));
  seen = await idle();
  check('혼잣말은 마우스를 움직인 때부터 기다리는 시간을 처음부터 다 채운 뒤에 한다', seen.said[0]?.at - seen.lastInput >= FIRST - 10, `${Math.round(seen.said[0]?.at - seen.lastInput)}ms`);
  check('혼잣말을 할 때는 그 말을 하는 가구 바로 옆에 서 있다', seen.said[0]?.ids.length > 0, JSON.stringify(seen.said[0]));
  await page.run(() => { window.__inputs = 0; });
  check('그 뒤로 혼잣말을 되풀이한다', await saidMore(3, 2 * (AGAIN[1] + WALK) + 2000), JSON.stringify(await idle()));
  seen = await idle();
  check('같은 가구의 혼잣말을 연달아 하지 않고, 말할 때마다 그 가구 옆에 서 있다',
    seen.said.every((s, i) => s.ids.length > 0 && (i === 0 || s.text !== seen.said[i - 1].text)), JSON.stringify(seen.said.map(s => `${s.text} ${s.ids}`)));
  check('아바타가 혼자 걷는 동안에는 마우스와 키 입력이 생기지 않는다(화면 보호기가 늦어지지 않는다)', seen.inputs === 0, `${seen.inputs}번`);
  // 말풍선에 쓰는 칸을 열어 둔 동안에는 하지 않는다. 아바타를 누르면 칸이 열린다.
  // 되풀이 간격이 걷는 시간보다 길어서 다음 차례가 한참 뒤에 오므로, 먼저 마우스를 움직여 다음 차례를 FIRST 뒤로 당겨 둔다(그래야 이 기다리는 사이에 차례가 두 번 온다)
  await nudge();
  await page.run(() => { window.__moves = 0; window.__said.length = 0; document.querySelector('#wallpaper .room-avatar').click(); });
  await sleep(FIRST * 2 + 500);
  seen = await idle();
  check('말풍선에 쓰는 칸이 열려 있으면 혼잣말하러 가지 않는다', seen.said.length === 0 && seen.moves === 0, JSON.stringify(seen));
  // 칸을 닫고 방 꾸미기 창을 열기까지 차례가 끼어들지 않게 다음 차례를 다시 FIRST 뒤로 당겨 둔다
  await nudge();
  await press(page, 'Escape');
  // 방 꾸미기 창은 최소화해도 하지 않는다
  await openIcon('room');
  await until(page, () => !!document.querySelector('#windows .win .win-min'), 3000);
  await page.run(() => { document.querySelector('#windows .win .win-min').click(); window.__moves = 0; window.__said.length = 0; });
  await sleep(FIRST * 2 + 500);
  seen = await idle();
  check('방 꾸미기 창이 열려 있으면 최소화해도 혼잣말하러 가지 않는다', seen.said.length === 0 && seen.moves === 0, JSON.stringify(seen));
  // 갈 수 있는 가구가 하나뿐이면 한 번 말한 뒤에는 쉰다. 가구 하나만 주고 늘 그 옆에 서 있는 가짜 아바타로
  // 고르는 순서(src/idle-talk.js의 createIdleTalk)만 본다. 되풀이 간격이 길어서 20ms 간격의 차례를 0.6초 동안 돌린다
  const alone = await page.run(async () => {
    const { createIdleTalk } = await import(new URL('src/idle-talk.js', document.baseURI).href);
    const { IDLE_TALK } = await import(new URL('src/config.js', document.baseURI).href);
    const kept = { ...IDLE_TALK };
    const said = [];
    const me = { spot: () => ({ x: 5, y: 5 }), stepsTo: () => 0, approach: (item, then) => then(), say: text => said.push(text), halt() {} };
    try {
      Object.assign(IDLE_TALK, { first: 20, again: [20, 20] });
      createIdleTalk({ avatar: () => me, items: () => [{ id: 'lamp', x: 0, y: 0 }], canRun: () => true });
      await new Promise(r => setTimeout(r, 600));
    } finally {
      Object.assign(IDLE_TALK, kept);
    }
    return said;
  });
  check('갈 수 있는 가구가 지난번 가구 하나뿐이면 같은 말을 되풀이하지 않고 쉰다', alone.length === 1, JSON.stringify(alone));
  // 걷는 길이 다음 차례보다 길어서 도착하기 전에 길이 바뀌는 가구(far)가 끼어도, 말하지 못한 가구를 지난번 가구로 치지 않는다(known-issues 94).
  // 바로 도착하는 가구(lamp)와 영영 도착하지 못하는 가구(far)만 있는 가짜 아바타로 20ms 간격의 차례를 0.6초 동안 돌린다.
  // 고르기만 한 가구를 지난번 가구로 치면 lamp, radio, lamp 순으로 lamp의 말을 연달아 하고, 말한 가구만 치면 lamp를 한 번만 말한다
  const crowded = await page.run(async () => {
    const { createIdleTalk } = await import(new URL('src/idle-talk.js', document.baseURI).href);
    const { IDLE_TALK } = await import(new URL('src/config.js', document.baseURI).href);
    const kept = { ...IDLE_TALK };
    const said = [];
    let far = 0;
    const me = { spot: () => ({ x: 5, y: 5 }), stepsTo: () => 0, approach: (item, then) => { if (item.id === 'lamp') then(); else far++; }, say: text => said.push(text), halt() {} };
    try {
      Object.assign(IDLE_TALK, { first: 20, again: [20, 20] });
      createIdleTalk({ avatar: () => me, items: () => [{ id: 'lamp', x: 0, y: 0 }, { id: 'radio', x: 3, y: 3 }], canRun: () => true });
      await new Promise(r => setTimeout(r, 600));
    } finally {
      Object.assign(IDLE_TALK, kept);
    }
    return { said, far };
  });
  check('도착하지 못한 가구를 고르는 사이에도 같은 가구의 혼잣말을 연달아 하지 않는다',
    crowded.far >= 3 && crowded.said.every((s, i) => i === 0 || s !== crowded.said[i - 1]), JSON.stringify(crowded));
  // 끄면 지금과 같다. 방에서 걷기 시작하지 않게 방 꾸미기 창을 닫기 전에 끈다
  await page.run(async () => (await import(new URL('src/labs.js', document.baseURI).href)).setLab('idle-talk', false));
  await closeWindows();
  await sleep(300);
  await page.run(() => { window.__moves = 0; window.__said.length = 0; });
  await sleep(FIRST * 3);
  seen = await idle();
  check('끄면 바탕화면을 그냥 둬도 아바타가 움직이거나 말하지 않는다', seen.said.length === 0 && seen.moves === 0, JSON.stringify(seen));
  await page.run(s => (s === null ? localStorage.removeItem('agarago.settings') : localStorage.setItem('agarago.settings', s)), idleSettings);

  // ---------- 이웃집 목록 창이 비었거나 서버에 닿지 못할 때 ----------
  // 보여 줄 이웃이 없으면 현관문으로 연 목록 창에 놀러 갈 이웃집이 없다고 뜬다. 이웃집 목록을 이 집 주인의 방 하나로 바꾼다(지금 집 주인의 집은 목록에서 빠진다).
  const LONELY = { ...HOME, owner: '외톨이' };
  check('이웃집 없는 집이 검사를 통과한다', (await page.run(plantHome, LONELY)) === HOME.scenes.room.length);
  await extraNeighbor(page, LINK_NEIGHBOR, { only: true });
  await open();
  await page.run(fakeCloud, 'serve', { [LINK_NEIGHBOR.link]: await page.run(linkOf, HOME, LONELY.owner) });
  await powerOn();
  await until(page, () => !document.querySelector('.users .user.neighbor[disabled]'), 3000);
  check('이웃집 없는 점검: 내 사용자로 들어간다', await toMyRoom());
  await page.run(clickTwice, '#wallpaper .door-hit');
  check('보여 줄 이웃이 없으면 목록 창에 놀러 갈 수 있는 이웃집이 없다고 뜬다', await until(page, () => {
    const li = document.querySelector('#windows .neighbor-app .neighbor-empty');
    return !!li && !document.querySelector('#windows .neighbor-row') && li.textContent === '놀러 갈 수 있는 이웃집이 없습니다.';
  }, 15000));
  await probe('놀러 갈 이웃집이 없는 목록 창');
  await closeWindows();
  // 서버에 닿지 못한 집은 목록 창을 열 때 다시 받는다. 다시 받아도 닿지 못해 줄이 모두 빠지면 불러오지 못했다는 글과 할 일이 한 줄씩 뜬다
  await open();
  await page.run(fakeCloud, 'offline');
  await powerOn();
  check('서버에 닿지 못할 때: 내 사용자로 들어간다', await toMyRoom());
  await page.run(clickTwice, '#wallpaper .door-hit');
  check('목록 창에서도 받지 못하면 그 줄이 빠지고, 불러오지 못했다는 글과 할 일이 두 줄로 뜬다', await until(page, () => {
    const li = document.querySelector('#windows .neighbor-app .neighbor-empty');
    if (!li || document.querySelector('#windows .neighbor-row')) return false;
    const st = getComputedStyle(li);
    const lines = Math.round((li.clientHeight - parseFloat(st.paddingTop) - parseFloat(st.paddingBottom)) / parseFloat(st.lineHeight));
    return lines === 2 && li.textContent === '이웃집을 불러오지 못했습니다.잠시 후 다시 시도해 주세요.';
  }, 15000));
  await probe('이웃집을 불러오지 못한 목록 창');
  await closeWindows();
  // 서버에 닿지 못할 때 복사본(keep)으로 뜨는 고정한 이웃집도 목록 창에서 놀러 갈 수 있다. 이때는 받아 둔 방이 없어(neighborNow가 모른다) 목록 창이 받은 집으로 간다
  await extraNeighbor(page, PINNED_NEIGHBOR, { only: true });
  await open();
  await page.run(fakeCloud, 'offline');
  await powerOn();
  check('서버에 닿지 못할 때 고정한 이웃집 점검: 내 사용자로 들어간다', await toMyRoom());
  await page.run(clickTwice, '#wallpaper .door-hit');
  check('서버에 닿지 못해도 고정한 이웃집은 목록 창에 복사본의 이름으로 뜨고 놀러 가기가 눌린다', await until(page, (id, name) => {
    const r = document.querySelector(`#windows .neighbor-row[data-neighbor="${id}"]`);
    return !!r && r.querySelector('.neighbor-name b').textContent === name && !r.querySelector('.btn').disabled;
  }, 15000, PINNED_NEIGHBOR.id, PINNED_NEIGHBOR.name));
  check('서버에 닿지 못할 때 목록 창의 놀러 가기를 누르면 복사본의 집에 손님으로 들어간다', (await page.run(goRow, PINNED_NEIGHBOR.id))
    && await until(page, n => document.getElementById('stage').dataset.mode === 'visit' && !document.getElementById('desktop').hidden
      && document.querySelectorAll('#wallpaper .furn').length === n, 5000, HOME.scenes.room.length));
  await extraNeighbor(page, null);

  // ---------- 아이디로 찾아가기 ----------
  // 이웃집 목록 창 아래의 아이디 칸에 친구 아이디를 치고 놀러 가기를 누르면 그 아이디의 방에 손님으로 들어간다(src/neighbors.js의 handleForm).
  // 서버는 fakeCloud가 대신한다(아이디 문서는 handles). 빈 칸, 꼴이 틀린 아이디, 없는 아이디, 방이 없는 아이디, 내 방의 아이디, 서버에 닿지 못할 때를 차례로 본다
  const ID_FRIEND = '아이디친구';
  const ID_ROOM = 'Hndl5678';
  const ID_HANDLES = { 친구: { uid: 'friend-uid', room: ID_ROOM }, ghost: { uid: 'ghost-uid', room: 'Gone5678' }, me: { uid: 'fake-uid', room: 'Mine5678' } };
  check('아이디 점검의 집이 검사를 통과한다', (await page.run(plantHome, HOME)) === HOME.scenes.room.length);
  await open();
  const idRooms = { [ID_ROOM]: await page.run(linkOf, HOME, ID_FRIEND) };
  await page.run(fakeCloud, 'serve', idRooms, [], ID_HANDLES);
  await powerOn();
  check('아이디 점검: 내 사용자로 들어간다', await toMyRoom());
  await page.run(clickTwice, '#wallpaper .door-hit');
  check('이웃집 목록 창 아래에 친구 아이디 칸과 놀러 가기 단추가 있다', await until(page, () => !!document.querySelector('#windows .neighbor-app .handle-form input[aria-label="친구 아이디"]'), 15000));
  // 아이디를 치고 놀러 가기를 누른 뒤 찾기가 끝나기를(단추가 다시 눌리거나 창이 닫히기를) 기다려 칸 아래의 오류를 돌려준다. 오류가 없으면 빈 글자다
  const visitSays = async v => {
    await page.run(t => {
      const f = document.querySelector('#windows .neighbor-app .handle-form');
      const i = f.querySelector('input');
      i.value = t;
      i.dispatchEvent(new Event('input'));
      f.requestSubmit();
    }, v);
    await until(page, () => { const b = document.querySelector('#windows .neighbor-app .handle-form .btn'); return !b || !b.disabled; }, 5000);
    return page.run(() => { const e = document.querySelector('#windows .neighbor-app .handle-form .like-error'); return e && !e.hidden ? e.textContent : ''; });
  };
  check('빈 칸으로 놀러 가기를 누르면 친구 아이디를 입력해 달라고 한다', (await visitSays('')) === '친구 아이디를 입력해 주세요.');
  check('꼴이 틀린 아이디는 서버에 묻지 않고 꼴과 할 일을 한 줄씩 알린다', (await visitSays('a!')) === '아이디는 한글, 영문, 숫자 2~12자입니다.아이디를 다시 확인해 주세요.'
    && (await page.run(() => Object.keys(window.__handleCalls).length)) === 0);
  check('없는 아이디는 없는 아이디라고 알린다', (await visitSays('없는아이디')) === '없는 아이디입니다.아이디를 다시 확인해 주세요.');
  check('아이디는 있는데 방이 없으면 없는 아이디와 같이 알린다', (await visitSays('ghost')) === '없는 아이디입니다.아이디를 다시 확인해 주세요.');
  check('오류 두 줄이 떠도 이웃집 목록 창과 목록이 스크롤되지 않는다', await page.run(() => {
    const a = document.querySelector('#windows .neighbor-app');
    const l = a?.querySelector('.neighbor-list');
    return !!l && a.scrollHeight <= a.clientHeight && l.scrollHeight <= l.clientHeight;
  }));
  await probe('아이디 오류가 뜬 이웃집 목록 창');
  // 이 컴퓨터가 올린 방의 아이디. 올린 방 번호는 묻는 동안만 심는다(남겨 두면 방을 고칠 때 가짜 서버에 올리려다 거절당한다)
  await page.run(id => { const s = JSON.parse(localStorage.getItem('agarago.cloud') || '{}'); localStorage.setItem('agarago.cloud', JSON.stringify({ ...s, id })); }, ID_HANDLES.me.room);
  const ownSays = await visitSays('me');
  await page.run(() => { const s = JSON.parse(localStorage.getItem('agarago.cloud') || '{}'); delete s.id; localStorage.setItem('agarago.cloud', JSON.stringify(s)); });
  check('내 방의 아이디를 치면 들어가지 않고 친구의 아이디를 넣어 달라고 한다', ownSays === '내 방의 아이디입니다.친구의 아이디를 입력해 주세요.');
  await page.run(fakeCloud, 'offline');
  check('서버에 닿지 못하면 찾지 못했다고 알리고 잠시 후 다시 해 달라고 한다', (await visitSays('친구')) === '아이디를 찾지 못했습니다.잠시 후 다시 시도해 주세요.');
  check('찾지 못해도 친 아이디는 칸에 남는다', (await page.run(() => document.querySelector('#windows .neighbor-app .handle-form input')?.value)) === '친구');
  await page.run(fakeCloud, 'serve', idRooms, [], ID_HANDLES);
  await visitSays(' @친 구 ');
  check('띄어쓰기와 맨 앞의 @가 섞여도 그 아이디의 방에 손님으로 들어간다', await until(page, (n, owner) => document.getElementById('stage').dataset.mode === 'visit'
    && !document.getElementById('desktop').hidden && !document.querySelector('#windows .neighbor-app')
    && document.querySelectorAll('#wallpaper .furn').length === n && document.querySelector('#wallpaper .room-owner-name')?.textContent === owner, 8000, HOME.scenes.room.length, ID_FRIEND));
  check('아이디로 들어간 방도 최근에 놀러 간 집의 맨 앞에 남는다', await page.run(recentAt, 0).then(v => v?.room === ID_ROOM && v.name === ID_FRIEND));
  check('아이디의 방은 아이디를 한 번, 방을 한 번만 묻는다', (await page.run(id => JSON.stringify([window.__handleCalls['친구'], window.__cloudCalls[id]]), ID_ROOM)) === '[1,1]');
  // 아이디로 온 손님도 짧은 링크로 온 손님처럼 그 방의 코르크 보드에 쪽지를 남긴다(boardId가 그 방의 번호)
  await use('corkboard', () => [...document.querySelectorAll('.closeup .btn')].some(b => b.textContent === '쪽지 남기기'), '아이디로 온 손님에게도 쪽지 남기기 단추가 보인다');
  check('아이디로 온 집의 코르크 보드는 그 방의 번호로 쪽지를 찾는다', (await page.run(() => window.__noteBoards.at(-1))) === ID_ROOM);
  await press(page, 'Escape');

  // ---------- 로그인 화면의 친구 아이디 칸 ----------
  // 로그인 화면 오른쪽 단(친구 집)의 이웃집 아래에도 같은 칸이 있어서(src/login.js의 handleTile) 처음 온 사람도 사용자를 만들지 않고 아이디로 손님이 된다.
  // 아이디를 찾는 일과 오류 글은 이웃집 목록 창의 칸과 같이 쓰므로(src/neighbors.js의 handleInput) 오류는 빈 칸과 없는 아이디만 보고, 노란 풍선으로 뜨는지 본다.
  // 레포의 이웃집도 모두 받고 최근에 놀러 간 집도 세 집(src/neighbors.js의 MAX_RECENT)을 심어서,
  // 오른쪽 단이 가장 길 때(최근 집 한 줄과 이웃집 두 줄) 풍선까지 로그인 화면 가운데 띠 안에 드는지 잰다
  const RECENT = [['Rcnt0001', '최근하나'], ['Rcnt0002', '최근둘'], ['Rcnt0003', '최근셋']];
  const recentRooms = {};
  for (const [id, name] of RECENT) recentRooms[id] = await page.run(linkOf, HOME, name);
  await page.run(list => {
    localStorage.removeItem('agarago.home.v3');
    localStorage.setItem('agarago.recent', JSON.stringify(list.map(([room, name]) => ({ room, name, picture: 'cake' }))));
  }, RECENT);
  await open();
  await page.run(fakeCloud, 'serve', { ...neighborRooms, ...idRooms, ...recentRooms }, [], ID_HANDLES);
  await powerOn();
  await until(page, () => !document.querySelector('.users .user.neighbor[disabled]'), 3000);
  check('처음 온 사람의 로그인 화면은 왼쪽 단에 새 사용자 만들기, 오른쪽 단에 최근에 놀러 간 집과 이웃집, 그 아래 친구 아이디 칸이 있다', await page.run(n => !!document.querySelector('.users-own .user.new input[aria-label="닉네임"]')
    && document.querySelectorAll('.users-friends .user.recent').length === 3
    && document.querySelectorAll('.users-friends .user.neighbor').length === n
    && !!document.querySelector('.users-friends')?.lastElementChild?.matches('.user.by-handle')
    && !!document.querySelector('.user.by-handle input[aria-label="친구 아이디"]'), listedLinks.length));
  // 오른쪽 단의 격자(src/login.js의 gridTile): 무리마다 제목 한 번(세 칸 폭 376px), 폭 120px 칸이 8px 간격으로 한 줄에 셋, 칸에는 사진과 이름만 있다
  const grid = await page.run(friendGrid);
  const [t0, t1, t2, t3] = grid.tiles;
  check('오른쪽 단은 무리마다 제목을 한 번 두고 폭 120px 칸을 8px 간격 3열로 세우며 칸에는 사진과 이름만 있다', grid.grid
    && JSON.stringify(grid.heads) === JSON.stringify([['최근에 놀러 간 집', 376], ['이웃집', 376]])
    && Math.round(t1[0] - t0[0]) === 128 && Math.round(t2[0] - t1[0]) === 128 && Math.abs(t1[1] - t0[1]) < 1 && Math.abs(t2[1] - t0[1]) < 1
    && Math.abs(t3[0] - t0[0]) < 1 && t3[1] > t0[1] && grid.tiles.every(t => Math.round(t[2]) === 120) && grid.small === 0, JSON.stringify(grid));
  check('오른쪽 단 격자의 칸 사진은 상자 안에 다 들어간다', grid.whole);
  // 로그인 화면의 친구 아이디 칸에 v를 치고 놀러 가기를 누른 뒤 찾기가 끝나기를 기다려 풍선의 글을 돌려준다. 풍선이 없으면 빈 글자다
  const loginSays = async v => {
    await page.run(t => {
      const f = document.querySelector('.users-friends .user.by-handle');
      const i = f.querySelector('input[aria-label="친구 아이디"]');
      i.value = t;
      i.dispatchEvent(new Event('input'));
      f.requestSubmit();
    }, v);
    await until(page, () => { const b = document.querySelector('.user.by-handle .btn'); return !b || !b.disabled; }, 5000);
    return page.run(() => { const t = document.querySelector('.user.by-handle .name-tip'); return t && !t.hidden ? t.textContent : ''; });
  };
  check('로그인 화면에서 빈 칸으로 놀러 가기를 누르면 칸을 빨갛게 두르고 풍선으로 아이디를 입력해 달라고 한다', (await loginSays('')) === '친구 아이디를 입력해 주세요.'
    && await page.run(() => document.querySelector('.user.by-handle input').getAttribute('aria-invalid') === 'true'));
  check('로그인 화면에서 없는 아이디를 치면 없는 아이디라고 알린다', (await loginSays('없는아이디')) === '없는 아이디입니다.아이디를 다시 확인해 주세요.');
  check('이웃집이 다 선 오른쪽 단과 두 줄 풍선이 로그인 화면 가운데 띠 안에 든다', await page.run(() => {
    const mid = document.querySelector('.login-mid').getBoundingClientRect();
    const col = document.querySelector('.users-friends').getBoundingClientRect();
    const tip = document.querySelector('.user.by-handle .name-tip').getBoundingClientRect();
    return col.top >= mid.top && col.bottom <= mid.bottom && tip.bottom <= mid.bottom;
  }));
  await probe('친구 아이디 오류가 뜬 로그인 화면');
  await page.run(() => { const i = document.querySelector('.user.by-handle input'); i.value = '친'; i.dispatchEvent(new Event('input')); });
  check('로그인 화면의 친구 아이디 칸에 다시 치기 시작하면 풍선과 빨간 테두리가 걷힌다', await page.run(() => document.querySelector('.user.by-handle .name-tip').hidden
    && !document.querySelector('.user.by-handle input').hasAttribute('aria-invalid')));
  await loginSays(' @친 구 ');
  check('처음 온 사람도 로그인 화면에서 아이디로 그 방에 손님으로 들어간다', await until(page, (n, owner) => document.getElementById('stage').dataset.mode === 'visit'
    && !document.getElementById('desktop').hidden && document.querySelectorAll('#wallpaper .furn').length === n
    && document.querySelector('#wallpaper .room-owner-name')?.textContent === owner, 8000, HOME.scenes.room.length, ID_FRIEND));
  check('로그인 화면에서 아이디로 들어간 방이 최근에 놀러 간 집의 맨 앞에 서고 세 집을 넘은 가장 오래된 집은 빠진다',
    JSON.stringify(await page.run(recentIds)) === JSON.stringify([ID_ROOM, 'Rcnt0001', 'Rcnt0002']), JSON.stringify(await page.run(recentIds)));
  check('로그인 화면에서 아이디로 온 손님 바탕화면에는 나도 만들기가 있다', await page.run(() => !!document.querySelector('#icons .desk-icon[data-app="make-mine"]')));
  await use('corkboard', () => [...document.querySelectorAll('.closeup .btn')].some(b => b.textContent === '쪽지 남기기'), '로그인 화면에서 아이디로 온 손님에게도 쪽지 남기기 단추가 보인다');
  check('로그인 화면에서 아이디로 온 집의 코르크 보드는 그 방의 번호로 쪽지를 찾는다', (await page.run(() => window.__noteBoards.at(-1))) === ID_ROOM);
  await press(page, 'Escape');

  // ---------- 최근에 놀러 간 집 ----------
  // 링크나 아이디로 다녀온 방은 로그인 화면 오른쪽 단 맨 위에 남는다(src/neighbors.js의 recentVisits, src/login.js의 recentTile). 적는 것은 위의 짧은 링크와 아이디 절에서 보았다.
  // 이웃집과 이 컴퓨터가 올린 방을 적지 않는지, 기억한 이름과 사진으로 바로 섰다가 서버의 지금 모습을 따라가는지, 서버에 방이 없으면 빠지는지,
  // 칸을 누르면 그 방에 손님으로 들어가 맨 앞으로 오는지, 받기 전에 누르면 기다렸다 들어가는지, 친구 링크로 오면 빠지는지 본다. 초기화로 지워지는 것은 맨 끝의 초기화 절에서 본다
  check('이웃집 목록에 든 방과 이 컴퓨터가 올린 방은 최근에 놀러 간 집에 적지 않는다', await page.run(async link => {
    const { rememberVisit, recentVisits } = await import(new URL('src/neighbors.js', document.baseURI).href);
    const before = JSON.stringify(recentVisits());
    rememberVisit({ owner: '이웃' }, link);
    const cloud = localStorage.getItem('agarago.cloud');
    localStorage.setItem('agarago.cloud', JSON.stringify({ ...JSON.parse(cloud || '{}'), id: 'Mine5678' }));
    rememberVisit({ owner: '나' }, 'Mine5678');
    if (cloud === null) localStorage.removeItem('agarago.cloud');
    else localStorage.setItem('agarago.cloud', cloud);
    return !!link && before === JSON.stringify(recentVisits());
  }, listedLinks[0]));
  // 기억한 이름과 사진(옛이름, 강아지)으로 바로 서고, 받으면 서버의 주인 이름과 사진(새이름, 케이크)으로 바뀐다. 서버에 방이 없는 집(없어진집)은 빠진다.
  // 둘째 집은 이모지 12자 이름이라 칸에서 말줄임표로 끝나고 전체 이름을 title로 단다(probe의 잘린 글 세기)
  const LONG_NAME = [...WORST.emoji].slice(0, 12).join('');
  const shownRooms = { Rcnt0001: await page.run(linkOf, { ...HOME, picture: 'cake' }, '새이름'), Rcnt0002: await page.run(linkOf, HOME, LONG_NAME) };
  await page.run(list => localStorage.setItem('agarago.recent', JSON.stringify(list.map(([room, name, picture]) => ({ room, name, picture })))),
    [['Rcnt0001', '옛이름', 'dog'], ['Rcnt0002', LONG_NAME, null], ['Rcnt0003', '없어진집', null]]);
  await open();
  await page.run(fakeCloud, 'hold', { ...neighborRooms, ...shownRooms });
  await powerOn();
  check('최근에 놀러 간 집은 서버의 답을 기다리지 않고 기억한 이름과 사진으로 바로 서며 누를 수 있다', await page.run(() => {
    const t = document.querySelectorAll('.users-friends .user.recent');
    return t.length === 3 && !t[0].disabled && t[0].querySelector('.user-name').firstChild.textContent === '옛이름' && t[0].querySelector('.user-pic')?.dataset.pic === 'dog';
  }));
  await page.run(() => window.__cloudAnswer());
  check('서버에 방이 없는 최근 집은 칸이 빠지고 기억에서도 지워진다', await until(page, () => document.querySelectorAll('.users-friends .user.recent').length === 2
    && !localStorage.getItem('agarago.recent').includes('Rcnt0003'), 3000));
  check('최근 집의 칸은 서버의 지금 주인 이름과 사진을 따라가고 기억도 고친다', await until(page, () => {
    const t = document.querySelector('.users-friends .user.recent');
    const v = JSON.parse(localStorage.getItem('agarago.recent'))[0];
    return t?.querySelector('.user-name').firstChild.textContent === '새이름' && t.querySelector('.user-pic')?.dataset.pic === 'cake' && v.name === '새이름' && v.picture === 'cake';
  }, 3000));
  await until(page, () => !document.querySelector('.users .user.neighbor[disabled]'), 3000);
  await probe('최근에 놀러 간 집이 선 로그인 화면');
  await page.run(() => document.querySelectorAll('.users-friends .user.recent')[1].click());
  check('최근에 놀러 간 집을 누르면 그 방에 손님으로 들어가고 그 집이 맨 앞으로 온다', await until(page, name => document.getElementById('stage').dataset.mode === 'visit'
    && !document.getElementById('desktop').hidden && document.querySelector('#wallpaper .room-owner-name')?.textContent === name, 8000, LONG_NAME)
    && JSON.stringify(await page.run(recentIds)) === JSON.stringify(['Rcnt0002', 'Rcnt0001']));
  // 서버의 답을 받기 전에 누르면 받을 때까지 눌리지 않다가 받으면 들어간다
  await open();
  await page.run(fakeCloud, 'hold', { ...neighborRooms, ...shownRooms });
  await powerOn();
  await page.run(() => document.querySelectorAll('.users-friends .user.recent')[1].click());
  check('서버의 답을 받기 전에 누른 최근 집은 받을 때까지 눌리지 않는다', await page.run(() => document.querySelectorAll('.users-friends .user.recent')[1].disabled
    && document.getElementById('desktop').hidden));
  await page.run(() => window.__cloudAnswer());
  check('답을 받으면 누른 최근 집에 손님으로 들어간다', await until(page, () => document.getElementById('stage').dataset.mode === 'visit'
    && !document.getElementById('desktop').hidden && document.querySelector('#wallpaper .room-owner-name')?.textContent === '새이름', 8000)
    && JSON.stringify(await page.run(recentIds)) === JSON.stringify(['Rcnt0001', 'Rcnt0002']));
  await open('#s=Rcnt0002');
  await page.run(fakeCloud, 'serve', shownRooms);
  await powerOn();
  check('친구 링크로 오면 최근에 놀러 간 집도 이웃집처럼 빠지고 오른쪽 단은 격자를 쓰지 않는다', await until(page, () => !!document.querySelector('.users-friends .user:not([disabled])'), 3000)
    && await page.run(() => !document.querySelector('.users-friends .user.recent, .users-friends .friend-head, .users-friends.friend-grid')));

  // ---------- 긴 글(known-issues 83) ----------
  // 주인과 손님이 쓰는 글을 칸마다 한도까지 가장 나쁜 글로 채운 집(LONG)을 내 집으로 심고, 그 글이 나오는 화면을 차례로 연다.
  // 화면마다 재는 probe의 cutText가 글이 상자 밖으로 나갔거나 말없이 잘린 곳, 말줄임표로 끝났는데 마우스를 올려도 전체가 보이지 않는 곳을 센다
  const shut = async () => { await closeWindows(); await press(page, 'Escape'); await until(page, closed, 3000); };
  check('긴 글 집이 검사를 통과한다', (await page.run(plantHome, LONG)) === HOME.scenes.room.length);
  await open();
  await powerOn();
  await probe('긴 이름의 로그인 화면');
  await page.run(clickOnce, '.users .user:not(.neighbor)');
  check('긴 이름의 내 사용자로 들어간다', await desktop());
  await page.run(clickOnce, '.start-btn');
  await probe('긴 이름의 시작 메뉴');
  await page.run(clickOnce, '.start-btn');
  await use('bookshelf', () => !!document.querySelector('.closeup .book-cover'), '긴 글의 책장이 열린다');
  for (let i = 1; i < 5; i++) {
    await page.run(n => document.querySelectorAll('.closeup .book-spine:not(.add)')[n].click(), i);
    await probe(`긴 글의 책 ${i + 1}권`);
  }
  await shut();
  await use('tv', () => !!document.querySelector('.closeup .tv-pick'), '긴 글의 TV가 켜진다');
  for (let i = 1; i < KINDS.length; i++) {
    await page.run(n => document.querySelectorAll('.closeup .tv-pick')[n].click(), i);
    await probe(`긴 글의 작품 ${i + 1}편`);
  }
  await shut();
  await use('radio', () => document.querySelectorAll('.closeup .cd-pick').length === 6, '긴 이름의 CD 여섯 장이 펼쳐진다');
  // 이모지 이름은 표시창 한 줄에 들지 않아 말줄임표로 끝나고, 표시창에 마우스를 올리면 전체가 보인다
  await page.run(n => document.querySelectorAll('.closeup .cd-pick')[n].click(), KINDS.indexOf('emoji'));
  check('긴 이름의 CD를 넣으면 라디오 표시창에 이름이 뜬다', await until(page, () => !!document.querySelector('.closeup .radio-lcd')?.textContent.startsWith('🎮'), 3000));
  await probe('긴 이름의 CD를 넣은 라디오');
  await shut();
  await use('computer', () => !!document.querySelector('#windows .computer-app .link-row'), '긴 이름의 게임과 긴 주소를 넣은 옛날 컴퓨터가 열린다');
  // 창 안은 스크롤되어 cutText가 보지 않는다. 열리는 곳이 여러 줄로 꺾여 단추 줄이 창 아래로 밀리면 스크롤해야 단추가 보인다
  check('긴 주소를 넣은 옛날 컴퓨터 창은 스크롤하지 않아도 단추 줄까지 보인다', await page.run(() => {
    const body = document.querySelector('#windows .computer-app');
    return body.scrollHeight <= body.clientHeight + 1;
  }));
  await closeWindows();
  // 움직임 줄이기를 켠 사람에게는 화면 보호기가 인사말을 가운데에 멈춰 보인다. 화면보다 긴 인사말은 줄을 바꿔 화면 안에 든다
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await open();
  await powerOn();
  await page.run(clickOnce, '.users .user:not(.neighbor)');
  await desktop();
  await openIcon('share');
  await until(page, () => !!document.querySelector('#windows .share-row'), 3000);
  await page.run(clickText, '#windows .btn', '미리 보기');
  check('움직임 줄이기를 켜면 화면 보호기의 긴 인사말이 화면 안에 멈춰 있고 검은 바탕에서 밝은 색이다', await until(page, () => {
    const s = document.querySelector('.saver');
    const t = s?.querySelector('.saver-text.still');
    if (!t || s.hidden) return false;
    const a = t.getBoundingClientRect();
    const b = s.getBoundingClientRect();
    const [r, g, bl] = getComputedStyle(t).color.match(/\d+/g).map(Number);
    return a.left >= b.left && a.right <= b.right && a.top >= b.top && a.bottom <= b.bottom && r + g + bl > 450;
  }, 3000));
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [] });

  // 손님: 같은 집을 짧은 링크로 열어 친구 집으로 구경한다. 코르크 보드에는 닉네임과 글이 긴 쪽지가 붙어 있다(fakeCloud가 답한다)
  const LONG_ROOM = 'LongTxt1';
  const longCode = await page.run(linkOf, LONG);
  await open(`#s=${LONG_ROOM}`);
  await page.run(fakeCloud, 'serve', { [LONG_ROOM]: longCode }, LONG_NOTES);
  await powerOn();
  check('긴 이름의 친구 방이 손님 자리로 나온다', await until(page, () => [...document.querySelectorAll('.users .user')]
    .some(t => !t.disabled && t.textContent.includes('손님으로 구경하기')), 5000));
  await probe('긴 이름의 친구 방이 있는 로그인 화면');
  await page.run(clickText, '.users .user', '손님으로 구경하기');
  check('긴 이름의 친구 방에 손님으로 들어간다', await until(page, () => document.getElementById('stage').dataset.mode === 'visit' && !document.getElementById('desktop').hidden, 5000));
  await probe('긴 이름의 친구 방에 들어온 알림');
  await page.run(clickOnce, '.start-btn');
  await probe('긴 이름의 친구 방 시작 메뉴');
  await page.run(clickOnce, '.start-btn');
  await use('corkboard', () => document.querySelectorAll('.closeup .cork-note').length === 6, '긴 글의 쪽지가 붙은 코르크 보드가 열린다');
  await shut();
  await use('bookshelf', () => !!document.querySelector('.closeup .book-cover'), '손님에게도 긴 글의 책장이 열린다');
  await shut();
  await use('tv', () => !!document.querySelector('.closeup .tv-pick'), '손님에게도 긴 글의 TV가 켜진다');
  check('손님의 TV에는 소문 띠가 없다', await page.run(() => !document.querySelector('.closeup .tv-hint')));
  await shut();
  await use('radio', () => document.querySelectorAll('.closeup .cd-pick').length === 6, '손님에게도 긴 이름의 CD가 펼쳐진다');
  await shut();

  // 이웃집의 긴 이름: 로그인 화면의 이웃집 자리, 이웃집 목록 창(이름은 두 줄까지 쓰고, 넘치면 말줄임표로 끝내고 마우스를 올리면 전체가 보인다).
  // 목록 창은 주인과 이름이 같은 이웃집을 빼므로(내 집이다) 주인(🎮)과 다른 이모지를 쓴다. 레포의 link 이웃집에도 서버 대신 답해 여섯 줄을 다 채운다
  const LONG_NEIGHBORS = [{ id: 'smoke-long-wide', name: WORST.wide, room: longCode }, { id: 'smoke-long-emoji', name: fill(['🏠']), room: longCode }];
  await extraNeighbor(page, LONG_NEIGHBORS);
  await open();
  await page.run(fakeCloud, 'serve', neighborRooms);
  await powerOn();
  await probe('긴 이름의 이웃집이 있는 로그인 화면');
  check('긴 이름의 이웃집 점검: 내 사용자로 들어간다', await toMyRoom());
  const most = await page.run(async () => (await import(new URL('src/neighbors.js', document.baseURI).href)).MAX_NEIGHBORS);
  check('긴 이름의 이웃집이 든 목록 창에 여섯 줄이 뜬다', await openList(most), JSON.stringify(await page.run(listRows)));
  await probe('긴 이름의 이웃집이 든 목록 창');
  check('목록 창의 긴 이름은 두 줄 안에 들거나, 잘리면 마우스를 올렸을 때 전체 이름이 보인다', await page.run(list => list.every(({ id, name }) => {
    const b = document.querySelector(`#windows .neighbor-row[data-neighbor="${id}"] .neighbor-name b`);
    return !!b && (b.scrollHeight <= b.clientHeight + 1 || b.title === name);
  }), LONG_NEIGHBORS.map(n => ({ id: n.id, name: Array.from(n.name).slice(0, 12).join('') }))));
  check('여섯 줄과 알림 줄, 닫기 단추가 목록을 스크롤하지 않고 창 안에 든다', await page.run(() => {
    const list = document.querySelector('#windows .neighbor-list');
    const body = list.closest('.win-body');
    const close = [...body.querySelectorAll('.btn')].find(b => b.textContent === '닫기');
    return list.scrollHeight <= list.clientHeight + 1 && body.scrollHeight <= body.clientHeight + 1 && close.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom;
  }));
  await closeWindows();
  await extraNeighbor(page, null);

  // ---------- 이 컴퓨터 초기화 ----------
  // 지우기는 이 사이트의 집과 앱 기록만 지우고, 설정과 같은 주소를 쓰는 다른 사이트의 키는 남긴다(localStorage.clear() 금지)
  const appKey = `${games.own[0]}.smoke`;
  await open();
  const settings = await page.run(key => {
    localStorage.setItem(key, '1');
    localStorage.setItem('other-site.smoke', '1');
    if (!localStorage.getItem('agarago.settings')) localStorage.setItem('agarago.settings', '{}');
    return localStorage.getItem('agarago.settings');
  }, appKey);
  await powerOn();
  check('초기화 전에는 내 사진이 저장되어 있다', !!(await page.run(() => localStorage.getItem('agarago.picture'))));
  await page.run(() => localStorage.setItem('agarago.recent', JSON.stringify([{ room: 'Rcnt0001', name: '최근하나', picture: 'cake' }])));
  await page.run(clickOnce, '.reset-link');
  await page.run(clickText, '.reset-row .btn', '지우기');
  check('초기화에서 지우기를 누르면 내 사용자 대신 새 사용자 만들기가 나온다', await until(page, () => !!document.querySelector('.user.new input')
    && !document.querySelector('.users-own .user:not(.new)'), 5000));
  const left = await page.run(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
  check('지우기는 집과 앱 기록만 지우고 설정과 다른 사이트의 키는 남긴다', Object.keys(left).every(k => k === 'agarago.settings' || !k.startsWith('agarago.'))
    && !(appKey in left) && left['other-site.smoke'] === '1' && left['agarago.settings'] === settings, Object.keys(left).join(', '));
  check('초기화하면 내 사진도 지워진다', !('agarago.picture' in left));
  check('초기화하면 최근에 놀러 간 집의 기억도 지워진다', !('agarago.recent' in left));

  // 그림이 없는 가구의 404는 정상이다(known-issues 2). 그 밖의 콘솔 오류와 잡지 못한 예외를 센다
  const errors = [...new Set([...page.pageErrors, ...page.consoleErrors.filter(e => !/Failed to load resource/.test(e))])];
  check('페이지 오류가 없다', errors.length === 0, errors.join(' | '));
}

async function main() {
  const t0 = Date.now();
  const base = await startServer();
  const page = await launchChrome({ width: 1440, height: 900 });
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  // 유튜브 CD의 플레이어(iframe)와 IFrame Player API 스크립트는 받지 않는다. 음악 창이 열리고 화면 효과가 꺼지는 것까지만 본다
  // Firebase 주소도 막는다. 서버 대신 답하는 fakeCloud는 페이지 안에서 fetch를 가로채므로 막아도 그대로 돈다
  // 긴 글 점검의 CD(애플 뮤직 플레이리스트)를 라디오에 넣으면 뜨는 플레이어도 막는다
  const BLOCKED = ['*youtube.com/*', '*youtube-nocookie.com/*', '*ytimg.com/*', '*googlevideo.com/*', '*music.apple.com/*',
    '*firestore.googleapis.com/*', '*identitytoolkit.googleapis.com/*', '*securetoken.googleapis.com/*'];
  await page.send('Network.enable');
  await page.send('Network.setBlockedURLs', { urls: BLOCKED });
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  try {
    await walk(page, base);
  } catch (e) {
    const last = results.at(-1)?.name || '처음';
    const why = String(e.message).split(/\r?\n/)[0];
    check('끝까지 눌러 본다', false, `"${last}" 다음에서 멈췄다(${why})`);
    for (const msg of new Set(page.pageErrors)) console.log(`  페이지 오류: ${msg}`);
  }
  const failed = results.filter(r => !r.ok).length;
  console.log(`점검 끝: ${results.length}개 가운데 실패 ${failed}개 (${Math.round((Date.now() - t0) / 1000)}초)`);
  return failed ? 1 : 0;
}

await runTool(import.meta.url, main);
