// 모양 비교. style.css를 고친 뒤, 고치기 전과 화면의 모양이 어디가 달라졌는지 기계로 견준다.
//
//   node tools/css-diff.mjs               지금 style.css를 마지막 커밋(HEAD)의 것과 견준다(5분쯤 걸린다)
//   node tools/css-diff.mjs --base=main   main의 style.css와 견준다(아무 커밋이나 브랜치 이름을 줄 수 있다)
//
// 필요한 것: Node 22 이상, 크롬이나 엣지, 파이썬, git. 서버와 크롬을 띄우는 부분은 tools/headless.mjs에 있다.
//
// 하는 일: 화면 없는 크롬으로 사이트의 화면 99가지(꺼진 화면, 부팅, 로그인, 바탕화면, 창과 시작 메뉴, 가구 화면과 넣는 칸,
// 튜토리얼 카드, 놀이터, 손님 화면, 단추에 마우스를 올리거나 누른 상태)를 차례로 연다. 화면마다 같은 페이지에서 스타일시트만
// 옛것으로 바꿔 끼워, 모든 요소(::before, ::after 포함)의 계산된 속성을 낮과 밤에서 견주고 다른 요소와 속성을 적는다.
// 모양을 바꾸지 않는 정리(규칙 합치기, 순서 바꾸기, 쓰지 않는 규칙 지우기)라면 "다른 곳 0개"가 나와야 한다.
// 모양을 일부러 바꾼 것이라면 바뀐 요소와 속성의 목록이 나오므로, 뜻한 곳만 바뀌었는지 보는 데 쓴다.
// 작업 표시줄 시계의 분이 재는 도중에 바뀌면 시계와 그 옆 칸의 폭이 다르다고 나올 수 있다(다시 돌리면 없어진다).
// 종료 코드: 0 다른 곳 없음, 1 다른 곳이 있음, 2 도구를 돌리지 못함.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Stop, sleep, startServer, launchChrome, runTool, TEST_HOME, plantHome } from './headless.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const BASE = process.argv.slice(2).find(a => a.startsWith('--base='))?.slice(7) || 'HEAD';

// 페이지 안: 지금 스타일과 옛 스타일에서 모든 요소의 계산된 속성을 견줘 다른 것을 돌려준다
async function compare(oldCss) {
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const link = document.querySelector('link[rel="stylesheet"]');
  const els = [document.documentElement, document.body, ...document.querySelectorAll('.viewport, .viewport *, #page-loader, #page-loader *')];
  const collect = () => {
    for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 0; } catch { /* 끝난 것 */ } }
    const out = [];
    for (const el of els) {
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo);
        if (pseudo && (cs.content === 'none' || cs.content === 'normal')) { out.push(null); continue; }
        const row = {};
        for (let i = 0; i < cs.length; i++) row[cs[i]] = cs.getPropertyValue(cs[i]);
        out.push(row);
      }
    }
    return out;
  };
  const now = collect();
  const style = document.createElement('style');
  style.textContent = oldCss;
  link.disabled = true;
  document.head.append(style);
  // 2026-11-11 전의 style.css는 body의 data-era="2005"에 기대고 있었다. 그때의 것과 견줄 수 있게 옛것을 잴 때만 달아 준다
  const hadEra = document.body.hasAttribute('data-era');
  document.body.setAttribute('data-era', '2005');
  await frame();
  const old = collect();
  if (!hadEra) document.body.removeAttribute('data-era');
  style.remove();
  link.disabled = false;
  await frame();
  const diffs = new Map();
  els.forEach((el, i) => {
    [null, '::before', '::after'].forEach((pseudo, j) => {
      const a = now[i * 3 + j];
      const b = old[i * 3 + j];
      if (!a && !b) return;
      const name = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${[...el.classList].map(c => '.' + c).join('')}${pseudo || ''}`;
      if (!a || !b) { diffs.set(`${name} (가상 요소가 한쪽에만 있다)`, 1); return; }
      for (const p of Object.keys(b)) {
        if (a[p] !== b[p]) {
          const key = `${name} { ${p}: ${String(b[p]).slice(0, 90)} → ${String(a[p]).slice(0, 90)} }`;
          diffs.set(key, (diffs.get(key) || 0) + 1);
        }
      }
    });
  });
  return [...diffs].map(([k, n]) => (n > 1 ? `${k} ×${n}` : k));
}

async function main() {
  const t0 = Date.now();
  let OLD;
  try {
    OLD = execFileSync('git', ['show', `${BASE}:style.css`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    throw new Stop(`git에서 ${BASE}의 style.css를 꺼내지 못했다. --base에 있는 커밋이나 브랜치 이름을 준다.`);
  }
  const base = await startServer();
  const page = await launchChrome({ width: 1440, height: 900 });
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const open = async () => {
    await page.send('Page.navigate', { url: 'about:blank' });
    await page.send('Page.navigate', { url: base });
    for (let i = 0; i < 100; i++) { if (await page.run(() => document.readyState === 'complete' && !document.getElementById('page-loader'))) break; await sleep(100); }
  };
  let total = 0;
  let states = 0;
  const seen = new Set();
  const setNight = on => page.run(async v => { const { settings } = await import(new URL('src/settings.js', document.baseURI).href); settings.set({ night: v }); }, on);
  const check = async (where, night = true) => {
    for (const theme of night ? ['낮', '밤'] : ['낮']) {
      if (night) { await setNight(theme === '밤'); await sleep(120); }
      const diffs = await page.run(compare, OLD);
      states++;
      const fresh = diffs.filter(d => !seen.has(d));
      fresh.forEach(d => seen.add(d));
      total += diffs.length;
      if (diffs.length) console.log(`다름 [${where}, ${theme}] ${diffs.length}개(앞 화면에 없던 것 ${fresh.length}개)`);
      for (const d of fresh.slice(0, 25)) console.log(`   ${d}`);
      if (fresh.length > 25) console.log(`   그 밖에 ${fresh.length - 25}개`);
    }
    if (night) await setNight(false);
  };
  const clickText = (sel, text) => page.run((s, t) => { const el = [...document.querySelectorAll(s)].find(b => b.textContent.includes(t)); if (el) el.click(); return !!el; }, sel, text);
  const openIcon = id => page.run(i => { const b = document.querySelector(`#icons .desk-icon[data-app="${i}"]`); b.click(); b.click(); }, id);
  const closeWindows = () => page.run(() => { for (const b of document.querySelectorAll('#windows .win .win-close')) b.click(); });
  const use = async (id, ready) => {
    await page.run(i => { const f = document.querySelector(`#wallpaper .furn[data-id="${i}"]`); f.click(); f.click(); }, id);
    for (let i = 0; i < 100; i++) { if (await page.run(ready)) break; await sleep(150); }
    await sleep(300);
  };
  const esc = async () => {
    await page.run(() => { document.activeElement?.blur(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
    await sleep(150);
  };

  await open();
  await check('꺼진 화면', false);
  await page.run(() => document.getElementById('sound-key').click());
  await page.run(() => document.getElementById('power').click());
  await sleep(300);
  await check('부팅과 켜는 중', false);
  await sleep(1200);
  await check('로그인(처음 온 사람)', false);
  await page.run(() => { const f = document.querySelector('.user.new'); f.requestSubmit(); });
  await check('빈 닉네임 안내', false);
  await page.run(() => { const f = document.querySelector('.user.new'); f.querySelector('input[aria-label="닉네임"]').value = '점검'; f.requestSubmit(); });
  await sleep(1200);
  await check('새 사용자의 바탕화면과 튜토리얼 카드');
  await page.run(() => document.getElementById('sound-key').click());
  await check('모니터 OSD', false);
  await page.run(() => document.getElementById('sound-key').click());

  await page.run(plantHome, TEST_HOME);
  await open();
  await page.run(() => document.getElementById('power').click());
  await sleep(900);
  await page.run(() => document.querySelector('.reset-link').click());
  await check('로그인(내 사용자, 이웃집, 초기화 확인)', false);
  await page.run(() => document.querySelector('.users .user:not(.neighbor)').click());
  await sleep(300);
  await check('환영 화면', false);
  await sleep(1200);
  await check('바탕화면');
  await page.run(() => document.querySelector('.start-btn').click());
  await check('시작 메뉴');
  await page.run(() => document.querySelector('.start-btn').click());
  for (const id of ['room', 'games', 'share', 'music']) {
    await openIcon(id);
    await sleep(500);
    await check(`창 ${id}`);
    if (id === 'room') { await page.run(() => document.querySelector('#windows .win-max').click()); await sleep(200); await check('창 room(최대화를 푼 것)', false); }
    await closeWindows();
  }
  // 마우스를 올리거나 누르고 있을 때의 모양(:hover, :active)은 크롬에 그 상태를 억지로 걸어 견준다
  await page.send('DOM.enable');
  await page.send('CSS.enable');
  const force = async (selector, states) => {
    const { root: doc } = await page.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await page.send('DOM.querySelector', { nodeId: doc.nodeId, selector });
    if (!nodeId) { console.log(`   (없음) ${selector}`); return; }
    await page.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: states });
    await check(`${selector}:${states.join(':')}`);
    await page.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
  };
  await openIcon('share');
  await sleep(500);
  await page.run(() => document.querySelector('.start-btn').click());
  for (const [sel, states] of [
    ['#sound-key', ['hover']], ['#sound-key', ['active']], ['#sound-key', ['hover', 'active']],
    ['#power', ['hover']], ['#power', ['active']], ['#power', ['hover', 'active']],
    ['#windows .btn', ['hover']], ['#windows .btn', ['active']], ['#windows .btn', ['hover', 'active']],
    ['#windows .win-min', ['active']], ['#windows .win-min', ['hover']], ['#windows .win-close', ['active']], ['#windows .win-close', ['hover']],
    ['.start-btn', ['active']], ['.start-btn', ['hover']], ['.start-item', ['hover']], ['.start-item', ['active']],
    ['#tasks .task', ['hover']], ['#tasks .task', ['active']], ['.clock', ['hover']],
  ]) await force(sel, states);
  await page.run(() => document.querySelector('.start-btn').click());
  await closeWindows();

  await openIcon('games');
  await sleep(300);
  await page.run(() => { for (const sel of ['.folder-grid .desk-icon[data-app="tidy-up"]', '.folder-grid .desk-icon.external']) { const b = document.querySelector(sel); b.click(); b.click(); } });
  await sleep(600);
  await check('폴더와 게임 창과 새 탭 안내 창(앞 창과 뒤 창)');
  await page.run(() => document.querySelector('#windows .win .win-min').click());
  await check('최소화한 창의 작업 표시줄 단추', false);
  await closeWindows();
  await page.run(() => { for (const t of document.querySelectorAll('#tasks .task')) t.click(); });
  await closeWindows();

  await use('bookshelf', () => !!document.querySelector('.closeup .book-cover'));
  await check('책장');
  await clickText('.closeup .shelf-tools .btn', '고치기');
  await sleep(200);
  await check('책 고치기');
  await esc(); await esc();
  await use('tv', () => !!document.querySelector('.closeup .tv-row'));
  await check('TV');
  await clickText('.closeup .tv-tools .btn', '작품 넣기');
  await sleep(200);
  await check('TV 작품 찾기');
  await clickText('.closeup .link-row .btn', '직접 넣기');
  await sleep(200);
  await check('TV 직접 넣기');
  await esc(); await esc();
  await use('console', () => !!document.querySelector('.closeup .console-grid'));
  await check('게임기');
  await page.run(() => document.querySelector('.closeup .console-game.external')?.click());
  await sleep(200);
  await check('게임기의 새 탭 안내');
  await esc(); await esc();
  await use('radio', () => !!document.querySelector('.closeup form'));
  await page.run(() => { const f = document.querySelector('.closeup form'); f.querySelector('input').value = 'https://example.com/'; f.requestSubmit(); });
  await check('라디오 CD 넣기와 오류');
  await esc(); await esc();
  await use('corkboard', () => !!document.querySelector('.closeup .cork-card'));
  await check('코르크 보드');
  await esc();
  await use('computer', () => !!document.querySelector('#windows .computer-app'));
  await check('컴퓨터 창');
  await page.run(() => document.querySelector('#windows .like-edit').click());
  await sleep(200);
  await check('컴퓨터 게임 고치기');
  await closeWindows();
  await page.run(() => document.querySelector('.start-btn').click());
  await clickText('.start-item', '튜토리얼');
  await sleep(300);
  await check('튜토리얼 다시 보기 안내 창');
  await clickText('#windows .btn', '빈 방에서 연습하기');
  await sleep(600);
  await check('연습 방의 안내 카드');
  await page.run(() => document.querySelector('.coach-btn').click());
  await sleep(500);
  await page.run(() => { const d = document.querySelector('#wallpaper .door-hit'); const c = () => d.dispatchEvent(new MouseEvent('click', { bubbles: true })); c(); c(); });
  for (let i = 0; i < 80; i++) { if (await page.run(() => !!document.querySelector('#wallpaper .gate-hit'))) break; await sleep(150); }
  await check('놀이터');
  await page.run(() => { const d = document.querySelector('#wallpaper .neighbor-hit'); if (!d) return; const c = () => d.dispatchEvent(new MouseEvent('click', { bubbles: true })); c(); c(); });
  for (let i = 0; i < 80; i++) { if (await page.run(() => [...document.querySelectorAll('#windows .btn')].some(b => b.textContent === '놀러 가기'))) break; await sleep(150); }
  await check('이웃집 놀러 가기 창');
  await clickText('#windows .btn', '놀러 가기');
  await sleep(1500);
  await check('손님 바탕화면');
  await page.run(() => document.getElementById('power').click());
  await sleep(200);
  await check('끄는 중', false);
  await sleep(700);
  await check('꺼진 뒤', false);
  for (const msg of new Set(page.pageErrors)) console.log(`경고 페이지 오류: ${msg}`);
  console.log(`점검 끝: 견준 화면 ${states}개, ${BASE}와 다른 곳 ${total}개(종류 ${seen.size}개) (${Math.round((Date.now() - t0) / 1000)}초)`);
  return total ? 1 : 0;
}
await runTool(import.meta.url, main);
