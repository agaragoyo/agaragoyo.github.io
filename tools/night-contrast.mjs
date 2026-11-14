// 밤 모드 글자 대비 점검. 밤에 글자가 바탕에 묻히는 함정(known-issues 11, 18, 47)을 사람 눈 대신 기계로 잡는다.
//
//   node tools/night-contrast.mjs                이 폴더의 사이트를 빈 포트에 띄워 잰다(15초쯤 걸린다)
//   node tools/night-contrast.mjs --base=<주소>   이미 떠 있는 사이트를 잰다(예: https://agaragoyo.github.io/)
//   node tools/night-contrast.mjs --all          실패가 아니어도 밤에 4.5:1 아래인 글자를 모두 보여 준다
//
// 필요한 것: Node 22 이상(전역 WebSocket), 크롬이나 엣지, 파이썬(tools/serve.py). npm 패키지는 쓰지 않는다.
// 크롬을 찾지 못하면 환경 변수 CHROME에, 파이썬을 찾지 못하면 PYTHON에 실행 파일 경로를 넣는다.
// 서버와 크롬을 띄우는 부분은 tools/headless.mjs에 있고 tools/smoke.mjs와 같이 쓴다.
//
// 하는 일: tools/serve.py를 띄우고 화면 없는 크롬을 CDP로 몰아 전원, 새 사용자 만들기, 바탕화면까지 들어간다.
// 창 다섯 개(미니게임, 방 꾸미기, 공유하기, 배경음악, 새 탭 확인 창)와 시작 메뉴를 연 채로 settings.set({ night })로
// 2005 화면의 낮과 밤을 바꾸며, 화면에 보이는 글자마다 글자색과 그 뒤 바탕의 WCAG 대비를 잰다.
// 바탕이 그라데이션이면 가장 나쁜 색으로, 반투명이면 조상의 바탕과 겹친 색으로 잰다.
// 이어서 점검용 집(tools/headless.mjs의 TEST_HOME)을 내 집으로 심어 다시 들어가, 가구를 두 번 눌러 여는 화면(SCREENS)마다 같은 방법으로 잰다.
// 낮에는 4.5:1 이상인데 밤에 그 아래로 떨어지는 글자가 실패다. 낮에도 낮은 글자(창 제목줄의 흰 글자 같은 시대의 모양)는 세지 않는다.
// 낮과 밤은 자바스크립트 한 번 안에서 바꿔 가며 잰다. 그사이에 알림이나 말풍선이 바뀌어 낮과 밤의 화면이 달라지지 않게 하려는 것이다.
// 종료 코드: 0 통과, 1 실패가 있음, 2 도구를 돌리지 못함(크롬이나 파이썬이 없음 등).
import { Stop, sleep, startServer, launchChrome, runTool, TEST_HOME, plantHome } from './headless.mjs';

const LIMIT = 4.5; // WCAG AA가 보통 크기 글자에 요구하는 대비
// 시대는 2005로 정했다(2026-11-10). 그 전에는 1998, 2005, 2010을 차례로 쟀다. 지금은 결과 줄의 이름표로만 쓴다(화면에는 시대를 가리는 속성이 없다).
const ERAS = ['2005'];
// 바탕화면에서 두 번 눌러 여는 아이콘이다(data/apps.js의 id). 이 순서대로 열어 마지막 창이 앞에 온다.
// shu-ramen은 게임 폴더 창 안의 새 탭 앱이라 누르면 새 탭 확인 창이 열린다.
const OPEN = ['games', 'room', 'share', 'music', 'shu-ramen'];
// 가구를 두 번 눌러 여는 화면(가구 가까이 보기와 가구 창). 점검용 집의 가구로 연다.
// [이름, 가구 id, 다 열렸는지 보는 선택자, 그 화면에서 차례로 눌러 더 열어 볼 단추의 글자]
// 가구 화면을 새로 만들면 여기에 한 줄을 더하고, 그 가구가 점검용 집에 없으면 TEST_HOME에도 놓는다.
const SCREENS = [
  ['책장', 'bookshelf', '.closeup .book-cover', ['고치기']],
  ['TV', 'tv', '.closeup .tv-row', ['작품 넣기', '직접 넣기']],
  ['게임기', 'console', '.closeup .console-grid', []],
  ['라디오', 'radio', '.closeup form', []],
  ['코르크 보드', 'corkboard', '.closeup .cork-card', []],
  ['컴퓨터', 'computer', '#windows .computer-app', ['고치기']],
];
// 원래 있고 화면에서 읽히는 낮은 대비는 여기에 이유와 함께 적는다. 재는 값이 min 아래로 더 떨어지면 다시 실패로 센다.
// 적는 모양: { era: '2005', selector: '.win:not(.inactive) .win-title', min: 3, why: '화면에서 읽히는 이유' }
// (2010 앞쪽 창 제목의 예외는 시대를 2005로 정하면서 지웠다.)
const EXCEPTIONS = [];

const args = process.argv.slice(2);
const option = name => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
};
const SHOW_ALL = args.includes('--all');
// ---------- 페이지 안에서 도는 함수(바깥 변수를 쓰지 않는다) ----------

function pageState() {
  const shown = id => { const e = document.getElementById(id); return !!e && !e.hidden; };
  return {
    ready: document.readyState === 'complete',
    power: document.getElementById('power')?.getAttribute('aria-pressed'),
    login: shown('login'),
    desktop: shown('desktop'),
    windows: document.querySelectorAll('#windows .win').length,
  };
}

function pressPower() {
  document.getElementById('power')?.click();
}

function newUser(name) {
  const form = document.querySelector('.user.new');
  if (!form) return false;
  form.querySelector('input').value = name;
  form.requestSubmit();
  return true;
}

function openIcon(id) {
  const icon = document.querySelector(`.desk-icon[data-app="${id}"]`);
  if (!icon) return false;
  icon.click(); // 두 번 누르기는 클릭 간격으로 판정한다(os.js의 renderIcons)
  icon.click();
  return true;
}

// 낮으로 돌려놓는다.
async function setDay() {
  const { settings } = await import(new URL('src/settings.js', document.baseURI).href);
  settings.set({ night: false });
}

// 바탕화면의 방에서 가구를 두 번 누른다(아바타가 걸어가 화면을 연다)
function useFurniture(id) {
  const el = document.querySelector(`#wallpaper .furn[data-id="${id}"]`);
  if (!el) return false;
  el.click();
  el.click();
  return true;
}

// 가구 화면이나 창 안에서 글자가 label인 단추를 누른다
function pressButton(label) {
  const b = [...document.querySelectorAll('.closeup .btn, #windows .btn')].find(x => x.textContent.trim() === label);
  if (!b) return false;
  b.click();
  return true;
}

// 열려 있는 가구 화면과 창을 닫는다(쓰던 칸에서 빠져나온 뒤 Esc, 창은 닫기 단추)
function closeScreens() {
  document.activeElement?.blur();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  for (const b of document.querySelectorAll('#windows .win .win-close')) b.click();
  return !document.querySelector('.closeup');
}

function ownUser() {
  const tile = document.querySelector('.users .user:not(.neighbor):not(.new)');
  if (!tile) return false;
  tile.click();
  return true;
}

function openStartMenu() {
  const menu = document.getElementById('start-menu');
  if (menu.hidden) document.querySelector('#taskbar .start-btn').click();
  return !menu.hidden;
}

// 낮에 한 번, 밤으로 바꿔 한 번 잰다. 두 번 모두 같은 자바스크립트 실행 안이라 그사이에 화면이 바뀌지 않는다.
// selectors: 이 시대의 예외 선택자. 글자마다 맞는 예외의 번호(없으면 -1)를 같이 돌려준다.
async function dayAndNight(selectors) {
  const { settings } = await import(new URL('src/settings.js', document.baseURI).href);
  const parse = s => {
    const out = [];
    for (const m of s.matchAll(/rgba?\(([^)]+)\)|color\(srgb ([^)]+)\)/g)) {
      const p = (m[1] ?? m[2]).split(/[\s,/]+/).filter(Boolean).map(Number);
      const k = m[1] ? 1 : 255;
      out.push([p[0] * k, p[1] * k, p[2] * k, p.length > 3 ? p[3] : 1]);
    }
    return out;
  };
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (t, b) => [0, 1, 2].map(i => t[i] * t[3] + b[i] * (1 - t[3])).concat(1);
  // 글자 뒤 바탕의 후보. 조상을 따라 올라가며 불투명한 바탕을 만날 때까지 모으고, 아래 층부터 겹친다.
  // 그라데이션은 색 멈춤마다 후보가 되어 가장 나쁜 색으로 잰다. 그림(url) 바탕은 보지 않는다.
  const backdrops = el => {
    const layers = [];
    let node = el;
    for (; node && node.nodeType === 1; node = node.parentElement) {
      const cs = getComputedStyle(node);
      const grad = cs.backgroundImage === 'none' ? [] : parse(cs.backgroundImage);
      if (grad.length) {
        layers.push(grad);
        if (grad.every(c => c[3] >= 0.99)) break;
      }
      const bc = parse(cs.backgroundColor)[0];
      if (bc && bc[3] > 0) {
        layers.push([bc]);
        if (bc[3] >= 0.99) break;
      }
    }
    if (!node || node.nodeType !== 1) layers.push([[20, 20, 28, 1]]); // 끝까지 불투명한 바탕이 없으면 어두운 페이지 바탕
    let cands = layers.pop().map(c => [c[0], c[1], c[2], 1]);
    while (layers.length) {
      const top = layers.pop();
      cands = cands.flatMap(b => top.map(t => over(t, b))).slice(0, 64);
    }
    return cands;
  };
  const where = el => {
    const win = el.closest('.win');
    if (win) return `${win.querySelector('.win-title')?.textContent.trim() || '이름 없는'} 창`;
    if (el.closest('.closeup')) return '가구 가까이 보기';
    if (el.closest('#start-menu')) return '시작 메뉴';
    if (el.closest('#taskbar')) return '작업 표시줄';
    if (el.closest('.coach-card')) return '튜토리얼 카드';
    if (el.closest('#desktop')) return '바탕화면';
    if (el.closest('#stage')) return '화면';
    return '모니터 바깥';
  };
  const ids = (window.__nightContrastIds ??= new WeakMap());
  const idOf = el => {
    if (!ids.has(el)) ids.set(el, (window.__nightContrastNext = (window.__nightContrastNext || 0) + 1));
    return ids.get(el);
  };
  const scan = () => {
    const rows = [];
    const add = (el, fg, text) => {
      let worst = Infinity;
      let worstBg = null;
      for (const b of backdrops(el)) {
        const r = ratio(over(fg, b), b);
        if (r < worst) { worst = r; worstBg = b; }
      }
      const desc = el.tagName.toLowerCase() + [...el.classList].map(c => '.' + c).join('');
      const place = where(el);
      rows.push({
        id: idOf(el),
        key: `${desc}|${place}|${text}`,
        desc,
        where: place,
        text: text.slice(0, 30),
        ratio: Math.round(worst * 100) / 100,
        color: getComputedStyle(el).color,
        bg: `rgb(${worstBg.slice(0, 3).map(Math.round).join(', ')})`,
        exc: selectors.findIndex(s => el.matches(s)),
      });
    };
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t; (t = walker.nextNode());) {
      const el = t.parentElement;
      if (!el || seen.has(el) || !t.textContent.trim()) continue;
      // 방 그림(SVG) 안의 글자(놀이터 문패, 그림이 없는 가구의 이름)는 재지 않는다. 뒤에 깔린 도형이 조상이 아니라서 바탕색을 알 수 없다
      if (el instanceof SVGElement) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const range = document.createRange();
      range.selectNodeContents(t);
      const box = range.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue; // 글자 크기 0으로 숨긴 글자
      seen.add(el);
      const text = [...el.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent.trim()).filter(Boolean).join(' ');
      add(el, parse(getComputedStyle(el).color)[0], text);
    }
    for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=range]):not([type=checkbox]):not([type=radio]), textarea, select')) {
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) || el.getBoundingClientRect().width < 1) continue;
      if (el.value) add(el, parse(getComputedStyle(el).color)[0], el.value);
      else if (el.placeholder) add(el, parse(getComputedStyle(el, '::placeholder').color)[0], `(안내) ${el.placeholder}`);
    }
    return rows;
  };
  const theme = () => document.getElementById('stage').dataset.theme;
  settings.set({ night: false });
  const day = scan();
  const dayTheme = theme();
  settings.set({ night: true });
  const night = scan();
  return { dayTheme, nightTheme: theme(), day, night };
}

// ---------- 점검 ----------

async function until(page, test, what, ms = 15000) {
  const t0 = Date.now();
  for (;;) {
    const s = await page.run(pageState);
    if (test(s)) return s;
    if (Date.now() - t0 > ms) throw new Stop(`${what}(지금: ${JSON.stringify(s)})`);
    await sleep(150);
  }
}

// 밤 글자 하나하나를 같은 요소의 낮 값과 비교한다. 요소가 다시 만들어졌으면 모양과 자리와 글자가 같은 낮 글자를 쓴다.
function judge(era, { day, night }) {
  const exceptions = EXCEPTIONS.filter(e => e.era === era);
  const dayById = new Map(day.map(r => [r.id, r]));
  const dayByKey = new Map();
  for (const r of day) if (!(dayByKey.get(r.key)?.ratio >= r.ratio)) dayByKey.set(r.key, r);
  const out = { era, count: night.length, fails: [], excused: [], low: [], usedExceptions: new Set() };
  for (const r of night) {
    if (r.ratio >= LIMIT) continue;
    const before = dayById.get(r.id) ?? dayByKey.get(r.key);
    const item = { ...r, day: before?.ratio };
    const exc = exceptions[r.exc];
    if (before && before.ratio < LIMIT) out.low.push(item); // 낮에도 낮다: 시대의 모양이라 세지 않는다
    else if (exc && r.ratio >= exc.min) {
      out.excused.push({ ...item, why: exc.why });
      out.usedExceptions.add(exc);
    } else out.fails.push(item);
  }
  return out;
}

const line = r => `${r.ratio.toFixed(2)}:1 (낮 ${r.day === undefined ? '없음' : r.day.toFixed(2) + ':1'}) ${r.desc} "${r.text}" [${r.where}] 글자 ${r.color}, 바탕 ${r.bg}`;

async function main() {
  const t0 = Date.now();
  const base = option('base') || await startServer();
  const page = await launchChrome();
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  // 움직임 줄이기를 켜서 부팅 로고 연출을 건너뛴다(src/os.js의 reduceMotion). 글자색과 바탕색은 바뀌지 않는다
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const nav = await page.send('Page.navigate', { url: base });
  if (nav.errorText) throw new Stop(`${base} 주소를 열지 못했다(${nav.errorText}).`);
  await until(page, s => s.ready, `${base} 주소가 다 뜨지 않았다`);

  // 전원: 페이지가 다 뜨기 전에 누르면 먹지 않으므로 켜지지 않았으면 다시 누른다
  const powerOn = async () => {
    const t1 = Date.now();
    for (let i = 0; ; i++) {
      const s = await page.run(pageState);
      if (s.login) break;
      if (Date.now() - t1 > 20000) throw new Stop(`전원을 눌러도 로그인 화면이 뜨지 않았다(지금: ${JSON.stringify(s)})`);
      if (i % 10 === 0 && s.power !== 'true') await page.run(pressPower);
      await sleep(150);
    }
  };
  await powerOn();
  if (!(await page.run(newUser, '밤점검'))) throw new Stop('로그인 화면에 새 사용자 만들기 칸이 없다(저장된 집이 있는 사용자 폴더로 열렸다).');
  await until(page, s => s.desktop, '새 사용자를 만들어도 바탕화면이 뜨지 않았다');

  for (const id of OPEN) {
    if (!(await page.run(openIcon, id))) throw new Stop(`바탕화면에서 ${id} 아이콘을 찾지 못했다. data/apps.js의 id가 바뀌었으면 tools/night-contrast.mjs의 OPEN도 고친다.`);
    await sleep(300);
  }
  await until(page, s => s.windows >= OPEN.length, `창 ${OPEN.length}개가 열리지 않았다`, 5000);

  const results = [];
  for (const era of ERAS) {
    await page.run(setDay);
    await sleep(600); // 낮으로 돌린 뒤 아이콘과 창을 다시 그리는 것이 끝나기를 기다린다
    if (!(await page.run(openStartMenu))) throw new Stop('시작 메뉴가 열리지 않았다.');
    const r = await page.run(dayAndNight, EXCEPTIONS.filter(e => e.era === era).map(e => e.selector));
    if (r.dayTheme !== 'day' || r.nightTheme !== 'night') {
      throw new Stop(`${era} 낮과 밤으로 바뀌지 않았다(낮 ${r.dayTheme}, 밤 ${r.nightTheme}).`);
    }
    if (r.night.length < 50) throw new Stop(`${era} 밤 화면에서 글자를 ${r.night.length}개밖에 찾지 못했다. 창이 열렸는지 본다.`);
    results.push({ ...judge(era, r), label: era });
  }

  // 둘째 바퀴: 가구를 두 번 눌러 여는 화면. 점검용 집을 내 집으로 심고 다시 들어가 화면마다 낮과 밤을 잰다.
  // 이미 떠 있는 사이트(--base)에서는 하지 않는다. 그 사이트의 저장소에 점검용 집을 심게 되기 때문이다
  if (!option('base')) {
    const era = ERAS[0];
    const exceptions = EXCEPTIONS.filter(e => e.era === era).map(e => e.selector);
    const measure = async label => {
      const r = await page.run(dayAndNight, exceptions);
      if (r.dayTheme !== 'day' || r.nightTheme !== 'night') throw new Stop(`${label} 화면에서 낮과 밤으로 바뀌지 않았다(낮 ${r.dayTheme}, 밤 ${r.nightTheme}).`);
      results.push({ ...judge(era, r), label: `${era} ${label}` });
    };
    await page.run(plantHome, TEST_HOME);
    await page.send('Page.navigate', { url: 'about:blank' });
    await page.send('Page.navigate', { url: base });
    await until(page, s => s.ready, `${base} 주소가 다시 뜨지 않았다`);
    await powerOn();
    if (!(await page.run(ownUser))) throw new Stop('로그인 화면에 점검용 집의 사용자가 없다.');
    await until(page, s => s.desktop, '점검용 집으로 들어가도 바탕화면이 뜨지 않았다');
    await sleep(500);
    for (const [name, id, ready, more] of SCREENS) {
      if (!(await page.run(useFurniture, id))) throw new Stop(`바탕화면의 방에 ${id} 가구가 없다. tools/headless.mjs의 TEST_HOME에 놓는다.`);
      const t2 = Date.now();
      while (!(await page.run(sel => !!document.querySelector(sel), ready))) {
        if (Date.now() - t2 > 15000) throw new Stop(`${name} 화면이 열리지 않았다(${ready}). 화면이 바뀌었으면 tools/night-contrast.mjs의 SCREENS도 고친다.`);
        await sleep(150);
      }
      await sleep(250);
      await measure(name);
      for (const label of more) {
        if (!(await page.run(pressButton, label))) throw new Stop(`${name} 화면에 "${label}" 단추가 없다. 단추 이름이 바뀌었으면 SCREENS도 고친다.`);
        await sleep(250);
        await measure(`${name}의 ${label}`);
      }
      for (let i = 0; i < 4 && !(await page.run(closeScreens)); i++) await sleep(100);
      await page.run(setDay);
      await sleep(150);
    }
  }

  console.log(`밤 모드 글자 대비 점검: 낮에는 ${LIMIT}:1 이상인데 밤에 그 아래로 떨어지는 글자를 센다`);
  for (const r of results) {
    const extra = [r.excused.length && `예외 ${r.excused.length}개`, SHOW_ALL && `낮에도 낮음 ${r.low.length}개`].filter(Boolean);
    console.log(`  ${r.label}  글자 ${r.count}개, 밤에만 낮음 ${r.fails.length}개${extra.map(x => ', ' + x).join('')}`);
  }
  for (const r of results) for (const f of r.excused) console.log(`예외 ${r.label} 밤 ${line(f)}: ${f.why}`);
  if (SHOW_ALL) for (const r of results) for (const f of r.low.sort((a, b) => a.ratio - b.ratio)) console.log(`낮음 ${r.label} 밤 ${line(f)}`);
  const unused = EXCEPTIONS.filter(e => !results.some(r => r.usedExceptions.has(e)));
  for (const e of unused) console.log(`경고 예외 ${e.era} ${e.selector}에 걸리는 글자가 없다. 고쳤거나 이름이 바뀌었으면 EXCEPTIONS에서 지운다`);
  for (const msg of new Set(page.pageErrors)) console.log(`경고 페이지 오류: ${msg}`);
  const fails = results.flatMap(r => r.fails.sort((a, b) => a.ratio - b.ratio).map(f => ({ ...f, label: r.label })));
  for (const f of fails) console.log(`실패 ${f.label} 밤 ${line(f)}`);
  console.log(`점검 끝: 실패 ${fails.length}개 (${Math.round((Date.now() - t0) / 1000)}초)`);
  return fails.length ? 1 : 0;
}

await runTool(import.meta.url, main);
