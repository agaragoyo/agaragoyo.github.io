// 눌러 보기 점검(스모크 테스트). 코드를 고친 뒤 사이트의 주요 흐름이 그대로 도는지 사람 손 대신 기계로 눌러 본다.
//
//   node tools/smoke.mjs          이 폴더의 사이트를 빈 포트에 띄워 눌러 본다(1분 남짓 걸린다)
//   node tools/smoke.mjs --all    통과한 항목도 모두 보여 준다
//
// 필요한 것: Node 22 이상(전역 WebSocket), 크롬이나 엣지, 파이썬(tools/serve.py). npm 패키지는 쓰지 않는다.
// 서버와 크롬을 띄우는 부분은 tools/headless.mjs에 있고 tools/night-contrast.mjs와 같이 쓴다.
//
// 하는 일: 화면 없는 크롬으로 전원, 새 사용자 만들기, 튜토리얼 건너뛰기를 지나고, 가구와 담아 둔 것이 있는 점검용 집(tools/headless.mjs의 TEST_HOME)을
// 내 집으로 심어 다시 들어간다. 그 뒤 아이콘과 창 제목 줄과 가구의 두 번 누르기, 아바타의 키, 현관문과 놀이터 문, 기본 앱 창,
// 미니게임 창, 가구 가까이 보기, 방 꾸미기의 끌기와 돌리기, 연습 방에서 튜토리얼을 첫 단계부터 끝까지 하기, 손님으로 들어가기, 깨진 링크와 HTML이 든 링크,
// 짧은 링크(#s=)의 방, 이 컴퓨터 초기화의 지우기를 차례로 본다.
// 화면을 바꿀 때마다 되풀이된 함정 두 가지도 같이 잰다: hidden인데 보이는 요소(known-issues 10, 13)와 창 안에서 가로로 넘친 상자.
// 서버(Firebase)와 다른 사이트에는 요청을 보내지 않는다. 짧은 링크의 방은 페이지 안의 fetch를 바꿔 껴서 서버 대신 답하고(fakeCloud),
// 그 밖에는 짧은 링크가 없는 집과 CD가 없는 라디오로 본다.
// 눈으로 봐야 하는 것(그림의 모양, 색, 소리)은 보지 않는다. 밤 모드의 글자 대비는 tools/night-contrast.mjs가 잰다.
// 새 창이나 가구 화면을 만들면 main의 해당 자리에 한 줄을 더한다.
// 종료 코드: 0 통과, 1 실패가 있음, 2 도구를 돌리지 못함(크롬이나 파이썬이 없음 등).
import { sleep, startServer, launchChrome, runTool, TEST_HOME as HOME, plantHome } from './headless.mjs';

const SHOW_ALL = process.argv.includes('--all');

// 손님 화면에서 스크립트가 돌지 않는지 볼 집. 이름과 글에 HTML을, 주소에 javascript:를 넣는다
const EVIL = {
  owner: '<img src=x>',
  scenes: { room: [{ id: 'bookshelf', x: 2, y: 2 }] },
  likes: {
    bookshelf: [{ title: '<b>굵게</b><script>window.__xss=1</script>', note: '<img src=x onerror="window.__xss=1">' }],
    computer: { url: 'javascript:alert(1)' },
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

// 창, 가까이 보기, 시작 메뉴, 로그인 화면 안에서 안의 것이 가로로 넘친 상자(장식용 i는 뺀다)
function overflowing() {
  const out = [];
  for (const el of document.querySelectorAll('#windows .win-body, #windows .win-body *, .closeup *, #start-menu *, #login *')) {
    if (!(el instanceof HTMLElement) || !el.offsetParent || ['INPUT', 'TEXTAREA', 'I'].includes(el.tagName)) continue;
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

// 미니게임 폴더의 우리 게임(apps/ 아래)과 새 탭으로 여는 앱의 id
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
  await page.run(() => { const f = document.querySelector('.user.new'); f.requestSubmit(); });
  check('빈 닉네임으로 확인을 누르면 안내가 뜬다', await page.run(() => !document.querySelector('.name-tip').hidden));
  await page.run(() => { const f = document.querySelector('.user.new'); f.querySelector('input').value = '점검'; f.requestSubmit(); });
  check('새 사용자를 만들면 바탕화면이 뜬다', await desktop());
  check('새 사용자에게 튜토리얼 안내 카드가 뜬다', await until(page, () => { const c = document.querySelector('.coach-card'); return !!c && !c.hidden; }, 3000));
  await probe('튜토리얼 첫 단계');
  await page.run(() => document.querySelector('.coach-btn').click());
  check('건너뛰기를 누르면 안내 카드가 사라진다', await page.run(() => document.querySelector('.coach-card').hidden));

  // ---------- 가구가 놓인 내 집 ----------
  check('점검용 집의 가구가 모두 검사를 통과한다', (await page.run(plantHome, HOME)) === HOME.scenes.room.length + HOME.scenes.playground.length);
  await open();
  await powerOn();
  check('로그인 화면에 내 사용자가 있다', await page.run(() => document.querySelectorAll('.users .user:not(.neighbor):not(.new)').length === 1));
  await page.run(clickOnce, '.reset-link');
  await probe('초기화 확인');
  await page.run(clickText, '.reset-row .btn', '그대로 두기');
  await page.run(clickOnce, '.users .user:not(.neighbor)');
  check('내 사용자를 누르면 바탕화면이 뜬다', await desktop());
  await sleep(600);
  check('바탕화면의 방에 가구가 모두 그려진다', (await page.run(() => document.querySelectorAll('#wallpaper .furn').length)) === HOME.scenes.room.length);
  await probe('바탕화면');

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
  // 미니게임 폴더 안의 우리 게임과 새 탭 안내 창
  const games = await page.run(gameIds);
  await openIcon('games');
  await sleep(300);
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
  await page.run(clickOnce, '.reset-link');
  await page.run(clickText, '.reset-row .btn', '지우기');
  check('초기화에서 지우기를 누르면 내 사용자 대신 새 사용자 만들기가 나온다', await until(page, () => !!document.querySelector('.user.new input')
    && !document.querySelector('.users .user:not(.neighbor):not(.new)'), 5000));
  const left = await page.run(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
  check('지우기는 집과 앱 기록만 지우고 설정과 다른 사이트의 키는 남긴다', Object.keys(left).every(k => k === 'agarago.settings' || !k.startsWith('agarago.'))
    && !(appKey in left) && left['other-site.smoke'] === '1' && left['agarago.settings'] === settings, Object.keys(left).join(', '));

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
