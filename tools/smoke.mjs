// 눌러 보기 점검(스모크 테스트). 코드를 고친 뒤 사이트의 주요 흐름이 그대로 도는지 사람 손 대신 기계로 눌러 본다.
//
//   node tools/smoke.mjs          이 폴더의 사이트를 빈 포트에 띄워 눌러 본다(1분 남짓 걸린다)
//   node tools/smoke.mjs --all    통과한 항목도 모두 보여 준다
//
// 필요한 것: Node 22 이상(전역 WebSocket), 크롬이나 엣지, 파이썬(tools/serve.py). npm 패키지는 쓰지 않는다.
// 서버와 크롬을 띄우는 부분은 tools/headless.mjs에 있고 tools/night-contrast.mjs와 같이 쓴다.
//
// 하는 일: 화면 없는 크롬으로 전원, 새 사용자 만들기(사진 고르기), 튜토리얼 건너뛰기를 지나고, 가구와 담아 둔 것이 있는 점검용 집(tools/headless.mjs의 TEST_HOME)을
// 내 집으로 심어 다시 들어간다. 그 뒤 아이콘과 창 제목 줄과 가구의 두 번 누르기, 아바타의 키, 현관문과 놀이터 문, 기본 앱 창, 시작 메뉴의 사진 바꾸기,
// 미니게임 창, 가구 가까이 보기, 방 꾸미기의 끌기와 돌리기, 연습 방에서 튜토리얼을 첫 단계부터 끝까지 하기, 손님으로 들어가기, 깨진 링크와 HTML이 든 링크,
// 짧은 링크(#s=)의 방, 이 컴퓨터 초기화의 지우기를 차례로 본다.
// 화면을 바꿀 때마다 되풀이된 함정 두 가지도 같이 잰다: hidden인데 보이는 요소(known-issues 10, 13)와 창 안에서 가로로 넘친 상자.
// 서버(Firebase)와 다른 사이트에는 요청을 보내지 않는다. 짧은 링크의 방은 페이지 안의 fetch를 바꿔 껴서 서버 대신 답하고(fakeCloud),
// 유튜브 CD의 이름과 재생할 수 있는지도 같은 방법으로 대신 답한다(fakeYouTube). 유튜브 플레이어와 API 스크립트는 받지 않게 막는다(main의 BLOCKED).
// 그 밖에는 짧은 링크가 없는 집과 CD가 없는 라디오로 본다.
// 눈으로 봐야 하는 것(그림의 모양, 색, 소리)은 보지 않는다. 밤 모드의 글자 대비는 tools/night-contrast.mjs가 잰다.
// 새 창이나 가구 화면을 만들면 main의 해당 자리에 한 줄을 더한다.
// 종료 코드: 0 통과, 1 실패가 있음, 2 도구를 돌리지 못함(크롬이나 파이썬이 없음 등).
import { sleep, startServer, launchChrome, runTool, TEST_HOME as HOME, plantHome } from './headless.mjs';

const SHOW_ALL = process.argv.includes('--all');

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
  for (const el of document.querySelectorAll('#windows .win-body, #windows .win-body *, .closeup *, #start-menu *, #login *')) {
    if (!(el instanceof HTMLElement) || !el.offsetParent || ['INPUT', 'TEXTAREA', 'I'].includes(el.tagName)) continue;
    if (el.matches('.app-icon.pixel')) continue;
    // 펼친 CD는 부채꼴로 기울여 놓았고(두 장부터) 라디오에 든 CD는 음악이 나오는 동안 돈다(transform). 기울거나 도는 네모가 상자 밖으로 조금 나오는데,
    // 보이는 것은 그 안의 동그라미뿐이라 일부러 그대로 둔다. 도는 CD는 재는 순간의 각도에 따라 넘침이 달라 점검이 들쭉날쭉해진다
    if (el.matches('.radio-fan, .radio-slot')) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && getComputedStyle(el).overflowX === 'visible') {
      out.push(`${el.tagName.toLowerCase()}.${String(el.className).replace(/\s+/g, '.')} ${el.scrollWidth}>${el.clientWidth} "${(el.textContent || '').trim().slice(0, 24)}"`);
    }
  }
  return [...new Set(out)].slice(0, 8);
}

// 집을 긴 링크(#r= 뒤의 글자)로 바꾼다
async function linkOf(home, owner) {
  const { sanitizeHome, encodeHome } = await import(new URL('src/share.js', document.baseURI).href);
  return encodeHome(sanitizeHome({ ...home, owner: owner || home.owner }));
}

// 서버(Firebase)로 가는 요청을 페이지 안에서 가로채, 짧은 링크(#s=)의 방을 서버 대신 답한다. 서버에는 요청이 나가지 않는다.
// how: hold(window.__cloudAnswer()를 부를 때까지 기다렸다가 code의 방을 준다), missing(그런 방이 없다는 404), offline(연결 실패)
// 물은 횟수는 window.__cloudCalls에 센다. 페이지를 새로 열면 풀리므로 열 때마다 다시 낀다
function fakeCloud(how, code) {
  const real = window.fetch;
  window.__cloudCalls = 0;
  window.fetch = async (url, opts) => {
    if (!String(url).includes('googleapis.com')) return real(url, opts);
    window.__cloudCalls++;
    if (how === 'offline') throw new TypeError('Failed to fetch');
    if (how === 'missing') return new Response('{}', { status: 404 });
    await new Promise(done => { window.__cloudAnswer = done; });
    return new Response(JSON.stringify({ fields: { code: { stringValue: code } } }));
  };
  return true;
}

// 유튜브 oEmbed 대신 페이지 안에서 답한다. 없는 영상(id가 aaaaaaaaaaa)은 유튜브처럼 400으로, 다른 영상은 이름을 담아 답한다
function fakeYouTube() {
  const real = window.fetch;
  window.fetch = async (url, opts) => {
    if (!String(url).startsWith('https://www.youtube.com/oembed')) return real(url, opts);
    if (String(url).includes('aaaaaaaaaaa')) return new Response('Bad Request', { status: 400 });
    return new Response(JSON.stringify({ title: '점검용 유튜브 노래', thumbnail_url: 'https://i.ytimg.com/vi/x/hqdefault.jpg' }));
  };
  return true;
}

// 게임 폴더의 우리 게임(apps/ 아래)과 새 탭으로 여는 앱의 id
async function gameIds() {
  const { APPS } = await import(new URL('data/apps.js', document.baseURI).href);
  const games = APPS.filter(a => a.folder === 'games');
  return { own: games.filter(a => a.src?.startsWith('apps/')).map(a => a.id), link: games.find(a => a.href)?.id || null };
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
const clickTwice = sel => { const el = document.querySelector(sel); if (!el) return false; const c = () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })); c(); c(); return true; };
// 사진 고르는 줄(scope 안의 .pic-choice)에서 지금 골라져 있지 않은 사진 하나를 눌러 그 id를 돌려준다(src/user-pictures.js)
function pickOther(scope) {
  const b = [...document.querySelectorAll(`${scope} .pic-choice`)].find(c => c.getAttribute('aria-pressed') !== 'true');
  if (!b) return null;
  b.click();
  return b.querySelector('.user-pic').dataset.pic;
}
// sel 안에 보이는 사용자 사진의 id(없으면 null)
const shownPic = sel => document.querySelector(`${sel} .user-pic`)?.dataset.pic ?? null;
const clickOnce = sel => { const el = document.querySelector(sel); if (!el) return false; el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; };
const clickText = (sel, text) => { const el = [...document.querySelectorAll(sel)].find(b => b.textContent.includes(text)); if (!el) return false; el.click(); return true; };
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
const KEYS = { Enter: 13, Escape: 27, ArrowRight: 39, KeyD: 68, KeyS: 83, KeyA: 65, KeyW: 87 };
async function press(page, code, text) {
  const key = code.startsWith('Key') ? code.slice(3).toLowerCase() : code;
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, text, windowsVirtualKeyCode: KEYS[code] });
  await sleep(120);
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: KEYS[code] });
}
const mouse = (page, type, p) => page.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
async function tap(page, p) {
  await mouse(page, 'mousePressed', p);
  await mouse(page, 'mouseReleased', p);
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
  const firstPic = await page.run(pickOther, '.user.new');
  check('사진을 누르면 그 사진이 골라지고 왼쪽 큰 사진이 바뀐다', firstPic && (await page.run(shownPic, '.user.new > .avatar')) === firstPic
    && (await page.run(p => document.querySelector(`.user.new .pic-choice[aria-pressed="true"] [data-pic="${p}"]`) !== null, firstPic)), firstPic);
  await page.run(() => { const f = document.querySelector('.user.new'); f.requestSubmit(); });
  check('빈 닉네임으로 확인을 누르면 안내가 뜬다', await page.run(() => !document.querySelector('.name-tip').hidden));
  await page.run(() => { const f = document.querySelector('.user.new'); f.querySelector('input').value = '점검'; f.requestSubmit(); });
  check('새 사용자를 만들면 바탕화면이 뜬다', await desktop());
  check('새 사용자를 만들면 고른 사진이 저장된다', (await page.run(() => JSON.parse(localStorage.getItem('agarago.picture')))) === firstPic);
  check('새 사용자에게 튜토리얼 안내 카드가 뜬다', await until(page, () => { const c = document.querySelector('.coach-card'); return !!c && !c.hidden; }, 3000));
  await probe('튜토리얼 첫 단계');
  await page.run(() => document.querySelector('.coach-btn').click());
  check('건너뛰기를 누르면 안내 카드가 사라진다', await page.run(() => document.querySelector('.coach-card').hidden));

  // ---------- 가구가 놓인 내 집 ----------
  check('점검용 집의 가구가 모두 검사를 통과한다', (await page.run(plantHome, HOME)) === HOME.scenes.room.length + HOME.scenes.playground.length);
  await open();
  await powerOn();
  check('로그인 화면에 내 사용자가 있다', await page.run(() => document.querySelectorAll('.users .user:not(.neighbor):not(.new)').length === 1));
  check('로그인 화면의 내 사용자에 고른 사진이 보인다', (await page.run(shownPic, '.users .user:not(.neighbor):not(.new)')) === firstPic);
  await page.run(clickOnce, '.reset-link');
  await probe('초기화 확인');
  await page.run(clickText, '.reset-row .btn', '그대로 두기');
  await page.run(clickOnce, '.users .user:not(.neighbor)');
  check('내 사용자를 누르면 바탕화면이 뜬다', await desktop());
  await sleep(600);
  check('바탕화면의 방에 가구가 모두 그려진다', (await page.run(() => document.querySelectorAll('#wallpaper .furn').length)) === HOME.scenes.room.length);
  await probe('바탕화면');
  // 화면보다 크게 깔린 층(디가우스)이 있어도 화면은 스크롤되지 않는다. 스크롤되면 초점이나 scrollIntoView에 화면 전체가 밀린다(known-issues 66)
  check('화면(#screen)은 스크롤되지 않는다', await page.run(() => {
    const s = document.getElementById('screen');
    s.scrollTop = 200;
    s.scrollLeft = 200;
    return s.scrollTop === 0 && s.scrollLeft === 0;
  }));

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
  check('현관문을 두 번 누르면 놀이터로 나간다', await until(page, () => !!document.querySelector('#wallpaper .gate-hit'), 15000));
  check('놀이터에서는 놀이터 아이콘 대신 집으로 아이콘이 보인다', await page.run(() => !document.querySelector('#icons [data-app="playground"]') && !!document.querySelector('#icons [data-app="go-home"]')));
  await probe('놀이터');
  await page.run(clickTwice, '#wallpaper .gate-hit');
  check('아파트 문을 두 번 누르면 방으로 돌아온다', await until(page, () => !!document.querySelector('#wallpaper .door-hit'), 15000));

  // ---------- 기본 앱 창 ----------
  for (const id of ['room', 'games', 'share', 'music']) {
    await openIcon(id);
    check(`바탕화면의 ${id} 아이콘이 창을 연다`, await until(page, () => document.querySelectorAll('#windows .win').length === 1, 3000));
    await sleep(400);
    await probe(`창 ${id}`);
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
  await page.run(clickOnce, '.start-btn');
  check('시작 단추를 누르면 시작 메뉴가 열린다', await page.run(() => !document.getElementById('start-menu').hidden && document.querySelectorAll('.start-item').length >= 8));
  await probe('시작 메뉴');
  check('시작 메뉴 맨 위에 내 사진이 있다', (await page.run(shownPic, '#start-menu .start-pic')) === firstPic);
  await page.run(clickOnce, '#start-menu .start-pic');
  check('내 사진을 누르면 시작 메뉴가 닫히고 사진 바꾸기 창이 열린다', await until(page, () => document.getElementById('start-menu').hidden && !!document.querySelector('#windows .pic-app'), 3000));
  await probe('사진 바꾸기 창');
  const nextPic = await page.run(pickOther, '.pic-app');
  check('창에서 사진을 누르면 바로 저장되고 창 위의 사진이 바뀐다', nextPic && nextPic !== firstPic
    && (await page.run(() => JSON.parse(localStorage.getItem('agarago.picture')))) === nextPic && (await page.run(shownPic, '.pic-app-head')) === nextPic, nextPic);
  await closeWindows();
  await page.run(clickOnce, '.start-btn');
  check('바꾼 사진이 시작 메뉴에 보인다', (await page.run(shownPic, '#start-menu .start-head')) === nextPic);
  await page.run(clickOnce, '.start-btn');

  // ---------- 가구 가까이 보기 ----------
  const closed = () => !document.querySelector('.closeup');
  await use('bookshelf', () => !!document.querySelector('.closeup .book-cover'), '책장이 열린다');
  const title0 = await page.run(() => document.querySelector('.closeup .book-title').textContent);
  await press(page, 'ArrowRight');
  check('책장에서 방향키로 다음 책으로 넘어간다', (await page.run(() => document.querySelector('.closeup .book-title').textContent)) !== title0);
  await page.run(clickOnce, '.closeup .book-spine.add');
  await page.run(() => { const f = document.querySelector('.closeup form'); f.querySelector('input').value = '넷째 책'; f.requestSubmit(); });
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
  await page.run(clickText, '.closeup .tv-tools .btn', '작품 넣기');
  await sleep(200);
  await probe('TV 작품 찾기');
  await page.run(clickText, '.closeup .link-row .btn', '직접 넣기');
  await sleep(200);
  await probe('TV 직접 넣기');
  await page.run(() => document.activeElement?.blur());
  await press(page, 'Escape');
  check('TV가 Esc로 꺼진다', await page.run(closed));

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
  // 벽지(F13): 고르면 창과 바탕화면의 벽이 그 무늬가 되고 저장된다. 놀이터 탭에서는 벽지 칸이 숨는다. 다음 단계를 위해 기본 벽으로 되돌린다
  await page.run(clickOnce, '.room-app .wall-swatch[data-wall="heart"]');
  await sleep(200);
  check('벽지를 고르면 창과 바탕화면의 벽이 그 무늬가 되고 저장된다', await page.run(() => {
    const painted = box => [...document.querySelectorAll(`${box} .room-bg polygon`)].some(p => p.style.fill.includes('url('));
    return painted('.room-app') && painted('.wallpaper') && document.querySelector('.room-app .wall-swatch[data-wall="heart"]').getAttribute('aria-pressed') === 'true';
  }) && (await page.run(savedHome)).decor?.wall === 'heart', JSON.stringify((await page.run(savedHome)).decor));
  await page.run(clickOnce, '.room-app .scene-tab[data-scene="playground"]');
  check('놀이터 탭에서는 벽지 칸이 숨는다', await page.run(() => getComputedStyle(document.querySelector('.room-app .wall-picker')).display === 'none'));
  await page.run(clickOnce, '.room-app .scene-tab[data-scene="room"]');
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
  check('연습 방의 시작 메뉴에는 내 사진이 보이기만 하고 바꾸는 단추는 없다', await page.run(() => !document.querySelector('#start-menu .start-pic')
    && !!document.querySelector('#start-menu .start-head .user-pic')));
  await page.run(clickOnce, '.start-btn');

  // 연습 방에서 튜토리얼을 첫 단계부터 끝까지 해 본다(가구 놓기, 가구 쓰기, 놀이터 가기). 놓는 가구는 data/furniture.js의 TUTORIAL_FURNITURE를 따른다
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
  await step('현관문', '낮으로 돌아오면 현관문으로 나가 보라고 한다');
  await page.run(clickTwice, '#wallpaper .door-hit');
  await step('아파트 문', '놀이터에 나가면 아파트 문으로 돌아오라고 한다');
  await page.run(clickTwice, '#wallpaper .gate-hit');
  check('튜토리얼: 방으로 돌아오면 끝 카드가 뜬다', await until(page, () => document.querySelector('.coach-title')?.textContent === '튜토리얼 끝' && !document.querySelector('.coach-card').hidden, 15000));
  await probe('튜토리얼 끝 카드');

  await page.run(() => document.querySelector('.coach-btn').click());
  await sleep(500);
  check('연습을 끝내면 저장된 방이 돌아온다', (await page.run(() => document.querySelectorAll('#wallpaper .furn').length)) === HOME.scenes.room.length);
  check('연습 방에서 놓은 가구와 바꾼 밤낮은 저장되지 않는다', JSON.stringify(await page.run(savedHome)) === beforePractice && (await page.run(theme)) === 'day'
    && !(await page.run(() => JSON.parse(localStorage.getItem('agarago.settings') || '{}').night)));

  // ---------- 로그아웃과 손님 ----------
  await page.run(clickOnce, '.start-btn');
  await page.run(clickText, '.start-item', '로그아웃');
  check('로그아웃하면 로그인 화면으로 돌아간다', await until(page, () => !document.getElementById('login').hidden, 3000));
  const friend = await page.run(linkOf, HOME, '친구');
  await open(`#r=${friend}`);
  await powerOn();
  check('친구 링크로 오면 친구 집과 내 컴퓨터가 나오고 이웃집은 나오지 않는다', await page.run(() => {
    const names = [...document.querySelectorAll('.users .user small')].map(s => s.textContent);
    return names.includes('손님으로 구경하기') && names.includes('내 컴퓨터로 가기') && !document.querySelector('.users .user.neighbor');
  }));
  await page.run(clickText, '.users .user', '손님으로 구경하기');
  check('손님으로 들어가면 친구 방이 바탕화면에 뜬다', await desktop());
  await sleep(500);
  await probe('손님 바탕화면');
  check('손님에게는 방 꾸미기와 공유하기 대신 내 컴퓨터로가 보인다', await page.run(() => !document.querySelector('#icons [data-app="room"]') && !document.querySelector('#icons [data-app="share"]') && !!document.querySelector('#icons [data-app="my-computer"]')));
  check('손님으로 들어오면 걷고 쓰는 법을 알림으로 알려 준다', await page.run(() => document.getElementById('toast').classList.contains('show')));
  await page.run(clickOnce, '.start-btn');
  check('손님의 시작 메뉴에는 내 사진 대신 주인 이름의 첫 글자가 보인다', await page.run(() => !document.querySelector('#start-menu .user-pic')
    && document.querySelector('#start-menu .start-head .avatar').textContent === '친'));
  await page.run(clickOnce, '.start-btn');
  await use('bookshelf', () => !!document.querySelector('.closeup .book-cover'), '손님도 책장을 연다');
  check('가구 화면이 열리면 앞의 알림이 걷힌다(아래쪽 단추 줄을 가리지 않게)', await page.run(() => !document.getElementById('toast').classList.contains('show')));
  check('손님에게는 넣기, 고치기, 빼기 단추가 없다', await page.run(() => !document.querySelector('.closeup .shelf-tools, .closeup .book-spine.add')));
  await press(page, 'Escape');
  await openIcon('my-computer');
  check('내 컴퓨터로를 두 번 누르면 내 바탕화면으로 돌아온다', await until(page, () => document.getElementById('stage').dataset.mode === 'edit' && !document.getElementById('desktop').hidden && !!document.querySelector('#icons [data-app="room"]'), 5000));
  check('돌아오면 주소의 친구 링크가 지워진다', await page.run(() => location.hash === ''));

  // 이웃집 목록이 있으면 로그인 화면과 놀이터 울타리에 나온다
  const neighbors = await page.run(async () => (await import(new URL('src/neighbors.js', document.baseURI).href)).NEIGHBOR_LIST.length);
  if (neighbors) {
    await page.run(clickTwice, '#wallpaper .door-hit');
    await until(page, () => !!document.querySelector('#wallpaper .gate-hit'), 15000);
    check('놀이터 울타리에 이웃집 문이 집마다 하나씩 있다', (await page.run(() => document.querySelectorAll('#wallpaper .neighbor-hit').length)) === neighbors);
    await page.run(clickTwice, '#wallpaper .neighbor-hit');
    check('이웃집 문을 두 번 누르면 어느 집으로 가는지 묻는 창이 뜬다', await until(page, () => [...document.querySelectorAll('#windows .btn')].some(b => b.textContent === '놀러 가기'), 15000));
    await probe('이웃집 놀러 가기 창');
    await page.run(clickText, '#windows .btn', '놀러 가기');
    check('놀러 가기를 누르면 그 집에 손님으로 들어간다', await until(page, () => document.getElementById('stage').dataset.mode === 'visit' && !document.getElementById('desktop').hidden, 5000));
  }

  // ---------- 깨진 링크와 HTML이 든 링크 ----------
  await open('#r=!!!깨진링크');
  await powerOn();
  check('깨진 링크는 알림만 띄우고 사용자 목록은 그대로 나온다', await page.run(() => document.getElementById('toast').textContent.includes('링크가 깨져서') && !!document.querySelector('.users .user')));
  const evil = await page.run(linkOf, EVIL);
  await open(`#r=${evil}`);
  await powerOn();
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
  const shortCode = await page.run(linkOf, HOME, '짧은친구');
  await open(SHORT);
  await page.run(fakeCloud, 'hold', shortCode);
  await powerOn();
  check('짧은 링크로 오면 방을 받는 동안 친구 방 자리가 눌리지 않는다', await page.run(() => {
    const t = document.querySelector('.users .user');
    return !!t && t.disabled && t.textContent.includes('불러오는 중');
  }));
  await probe('짧은 링크의 방을 받는 로그인 화면');
  check('부팅할 때 서버에 방을 한 번 묻는다', (await page.run(() => window.__cloudCalls)) === 1);
  await page.run(() => document.getElementById('power').click());
  check('전원을 끄면 로그인 화면이 꺼진다', await until(page, () => document.getElementById('login').hidden && document.getElementById('boot').hidden, 10000));
  await page.run(() => window.__cloudAnswer());
  await sleep(500);
  check('받기 전에 전원을 끄면 늦게 온 답으로 손님 자리를 만들지 않는다', await page.run(() => !document.getElementById('login').textContent.includes('손님으로 구경하기')));
  await powerOn();
  check('다시 켜면 받아 둔 친구 방이 손님 자리로 나온다', await until(page, () => [...document.querySelectorAll('.users .user')]
    .some(t => !t.disabled && t.textContent.includes('짧은친구') && t.textContent.includes('손님으로 구경하기')), 3000));
  check('다시 켜도 서버에 다시 묻지 않는다', (await page.run(() => window.__cloudCalls)) === 1);
  await page.run(clickText, '.users .user', '손님으로 구경하기');
  check('짧은 링크의 손님 자리를 누르면 친구 방에 손님으로 들어간다', await until(page, () => document.getElementById('stage').dataset.mode === 'visit'
    && !document.getElementById('desktop').hidden && document.getElementById('toast').textContent.includes('짧은친구'), 5000));
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
  await page.run(() => { document.querySelector('.say-input').value = '  실험실 열려라 '; });
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
  await page.run(clickText, '.labs-app .btn', '실험실 닫기');
  check('실험실 닫기를 누르면 창과 아이콘이 사라지고 모든 항목이 꺼진다', await until(page, () => !document.querySelector('#icons [data-app="labs"]') && !document.querySelector('.labs-app'), 2000)
    && (await page.run(labsState)) === 'false/', await page.run(labsState));

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
  await page.run(clickOnce, '.reset-link');
  await page.run(clickText, '.reset-row .btn', '지우기');
  check('초기화에서 지우기를 누르면 내 사용자 대신 새 사용자 만들기가 나온다', await until(page, () => !!document.querySelector('.user.new input')
    && !document.querySelector('.users .user:not(.neighbor):not(.new)'), 5000));
  const left = await page.run(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
  check('지우기는 집과 앱 기록만 지우고 설정과 다른 사이트의 키는 남긴다', Object.keys(left).every(k => k === 'agarago.settings' || !k.startsWith('agarago.'))
    && !(appKey in left) && left['other-site.smoke'] === '1' && left['agarago.settings'] === settings, Object.keys(left).join(', '));
  check('초기화하면 내 사진도 지워진다', !('agarago.picture' in left));

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
  const BLOCKED = ['*youtube.com/*', '*youtube-nocookie.com/*', '*ytimg.com/*', '*googlevideo.com/*'];
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
