// 모양 비교. style.css를 고친 뒤, 고치기 전과 화면의 모양이 어디가 달라졌는지 기계로 견준다.
//
//   node tools/css-diff.mjs               지금 style.css를 마지막 커밋(HEAD)의 것과 견준다(5분쯤 걸린다)
//   node tools/css-diff.mjs --base=main   main의 style.css와 견준다(아무 커밋이나 브랜치 이름을 줄 수 있다)
//
// 필요한 것: Node 22 이상, 크롬이나 엣지, 파이썬, git. 서버와 크롬을 띄우는 부분은 tools/headless.mjs에 있다.
//
// 하는 일: 화면 없는 크롬으로 사이트의 화면 162가지(꺼진 화면, 부팅, 로그인, 바탕화면, 창과 시작 메뉴와 오른쪽 단추 메뉴,
// 가구 화면과 넣는 칸, 튜토리얼 카드, 손님 화면, 단추에 마우스를 올리거나 누른 상태)를 차례로 연다. 화면마다 같은 페이지에서 스타일시트만
// 옛것으로 바꿔 끼워, 모든 요소(::before, ::after 포함)의 계산된 속성을 낮과 밤에서 견주고 다른 요소와 속성을 적는다.
// 모양을 바꾸지 않는 정리(규칙 합치기, 순서 바꾸기, 쓰지 않는 규칙 지우기)라면 "다른 곳 0개"가 나와야 한다.
// 모양을 일부러 바꾼 것이라면 바뀐 요소와 속성의 목록이 나오므로, 뜻한 곳만 바뀌었는지 보는 데 쓴다.
// 두 번 다 자바스크립트 한 번 안에서 같은 글꼴로 재므로 시계나 알림이 바뀐 것은 세지 않고, 고치지 않은 style.css에서는 0개가 나온다(known-issues 122).
// 글꼴 선언(@font-face)을 바꾼 것은 화면마다 재지 않고 바뀐 선언을 "글꼴 선언"으로 한 번 적는다.
// 끝에는 고친 선택자(선언을 더하거나 지우거나 바꾸거나 옮긴 선택자) 가운데 재지 못한 것을 "재지 못함"으로 적는다. 여기 나온 것은 0개여도 확인된 것이 아니므로 직접 열어 본다.
// 연 화면에 맞는 요소가 있었는지만 보고, 다른 규칙에 덮여 효과가 없었는지는 보지 않는다. 움직임 줄이기를 켜고 재므로 움직임을 고친 것은 재지 못한 것에 든다.
// 열지 않는 화면: 라디오의 CD와 곡 목록, 코르크 보드의 쪽지, TV의 검색 결과, 게임기에서 하는 게임, 끌기와 움직임. 새 창이나 가구 화면을 만들면 아래 main에 한 줄을 더한다.
// 누를 단추가 없거나 화면이 열리지 않으면 "(없음)"으로 적고 실패로 센다. 조용히 넘기면 엉뚱한 화면을 재고도 0개가 나온다.
// 종료 코드: 0 다른 곳 없음(재지 못한 것만 있어도 0이다), 1 다른 곳이 있거나 열지 못한 것이 있음, 2 도구를 돌리지 못함.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Stop, sleep, startServer, launchChrome, runTool, TEST_HOME, plantHome } from './headless.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const BASE = process.argv.slice(2).find(a => a.startsWith('--base='))?.slice(7) || 'HEAD';

// 페이지 안, 페이지를 열 때마다 한 번: 옛 스타일시트를 끈 채로 끼워 두고, 글꼴 선언(@font-face)은 두 시트에서 빼 따로 둔다.
// 글꼴 선언이 든 시트를 켜거나 끄면 크롬이 글꼴을 버리고 다시 받는데, 그동안은 글자를 기본 글꼴로 앉혀 폭과 높이가 달라진다(known-issues 122).
// 글꼴은 두 번 다 지금 것으로 재고, 한쪽 시트에만 있는 글꼴 선언을 돌려준다.
async function prepare(oldCss) {
  const add = css => {
    const el = document.createElement('style');
    el.textContent = css;
    document.head.append(el);
    return el;
  };
  const takeFonts = sheet => {
    const fonts = [];
    for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
      if (!(sheet.cssRules[i] instanceof CSSFontFaceRule)) continue;
      fonts.unshift(sheet.cssRules[i].cssText);
      sheet.deleteRule(i);
    }
    return fonts;
  };
  const oldEl = add(`${oldCss}\nhead { --css-diff: old; }`); // 끝의 규칙은 compare가 정말 옛것으로 쟀는지 보는 표시다(head는 견주지 않는다)
  oldEl.id = 'css-diff-old';
  oldEl.sheet.disabled = true;
  const old = takeFonts(oldEl.sheet);
  const now = takeFonts(document.querySelector('link[rel="stylesheet"]').sheet);
  add(now.join('\n'));
  document.body.getBoundingClientRect(); // 글자를 다시 앉혀 글꼴을 받기 시작하게 한다
  await document.fonts.ready;
  return [...old.filter(f => !now.includes(f)).map(f => `옛것에만 있다: ${f}`), ...now.filter(f => !old.includes(f)).map(f => `지금 것에만 있다: ${f}`)];
}

// 페이지 안, 한 번: 옛 시트와 지금 시트에서 달라진 선언(더하거나 지우거나 바꾸거나 옮긴 것)의 선택자를 돌려준다.
// 선택자 하나와 선언 하나씩으로 펴서 견주므로, 주석이나 줄바꿈을 고친 것과 이웃한 규칙을 합치거나 나누기만 한 것은 달라진 것이 아니다.
// 차례만 바뀐 선언은 옮긴 쪽의 선택자만 센다.
function changedSelectors() {
  // 괄호와 따옴표 밖의 sep에서 자른다
  const split = (text, sep) => {
    const out = [''];
    let depth = 0;
    let quote = '';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === sep && !depth && !quote) { out.push(''); continue; }
      out[out.length - 1] += c === '\\' ? c + text[++i] : c;
      if (quote) { if (c === quote) quote = ''; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
    }
    return out.map(s => s.trim()).filter(Boolean);
  };
  // motion: 움직임(애니메이션)을 정하는 선언인지. 움직임을 없애는 선언(animation: none)은 움직임이 아니다.
  // whole: 요소에 바로 맞춰 볼 수 없어 통째로 한 줄인 것(@keyframes, 다른 @규칙, 중첩한 규칙). 달라졌으면 늘 재지 못한 것으로 적는다
  const flat = (rules, media = []) => [...rules].flatMap(r => {
    if (r instanceof CSSMediaRule) return flat(r.cssRules, [...media, r.conditionText]);
    if (r instanceof CSSStyleRule && !r.cssRules.length) {
      const decls = split(r.style.cssText, ';').map(decl => ({ decl, motion: decl.startsWith('animation') && r.style.animationName !== 'none' }));
      return split(r.selectorText, ',').flatMap(sel => decls.map(d => ({ media, sel, ...d })));
    }
    return [{ media, sel: r.cssText.split('{')[0].trim(), decl: r.cssText, motion: r instanceof CSSKeyframesRule, whole: true }];
  });
  const lines = sheet => flat(sheet.cssRules).filter(l => !l.decl.startsWith('--css-diff')); // prepare가 붙인 표시는 뺀다
  const key = l => JSON.stringify([l.media, l.sel, l.decl]);
  const old = lines(document.getElementById('css-diff-old').sheet);
  const now = lines(document.querySelector('link[rel="stylesheet"]').sheet);
  const spots = new Map(); // 선언마다 옛 시트에서의 자리들
  old.forEach((l, i) => { const k = key(l); if (!spots.has(k)) spots.set(k, []); spots.get(k).push(i); });
  const from = now.map(l => spots.get(key(l))?.shift() ?? -1); // 지금 선언이 옛 시트에서 있던 자리. 없었으면 -1
  // 옛 자리가 뒤로만 가는 가장 긴 줄이 차례가 그대로인 것이고, 거기 들지 못한 것이 옮긴 것이다
  const ends = []; // 길이마다 가장 앞에서 끝나는 줄의 끝
  const before = []; // 그 줄에서 바로 앞의 것
  from.forEach((p, i) => {
    if (p < 0) return;
    const n = ends.findLastIndex(e => from[e] < p) + 1;
    before[i] = ends[n - 1];
    ends[n] = i;
  });
  const kept = new Set();
  for (let i = ends.at(-1); i !== undefined; i = before[i]) kept.add(i);
  const found = new Map();
  const add = (l, how) => {
    const k = JSON.stringify([l.media, l.sel]);
    const it = found.get(k) || { id: found.size, sel: l.sel, media: l.media, how, motion: false, whole: l.whole };
    if (it.how !== how) it.how = '바꿈';
    it.motion ||= l.motion;
    found.set(k, it);
  };
  now.forEach((l, i) => { if (from[i] < 0) add(l, '더함'); else if (!kept.has(i)) add(l, '옮김'); });
  for (const left of spots.values()) for (const i of left) add(old[i], '지움');
  return [...found.values()];
}

// 페이지 안: 지금 스타일과 옛 스타일에서 모든 요소의 계산된 속성을 견줘 다른 것(diffs)을 돌려준다.
// watch에 든 고친 선택자 가운데 지금 잰 요소에 맞는 것의 번호(hit)도 돌려준다.
// 중간에 기다리지 않는다(await를 쓰지 않는다). 한 작업 안에서는 타이머와 받는 일이 끼어들지 못하고 애니메이션의 시각도 멈춰 있어서,
// 두 번 재는 사이에 시계의 분이 바뀌거나 아바타가 눈을 깜빡이거나 알림이 사라지지 않는다(known-issues 122).
function compare(watch) {
  const nowSheet = document.querySelector('link[rel="stylesheet"]').sheet;
  const oldSheet = document.getElementById('css-diff-old')?.sheet;
  if (!oldSheet) throw new Error('옛 스타일시트를 끼운 페이지가 아니다');
  const els = [document.documentElement, document.body, ...document.querySelectorAll('.viewport, .viewport *, #page-loader, #page-loader *')];
  const times = new Map(); // 애니메이션마다 재기 전의 시각
  // 애니메이션은 첫 장면을, 전환(transition)은 다 바뀐 모습을 잰다.
  // 바꿔 끼우면 다른 곳마다 전환이 시작되는데, 그 첫 장면은 바꿔 끼우기 전의 값이라 다른 곳이 가려진다
  const still = () => {
    for (let i = 0; i < 5; i++) {
      const moving = document.getAnimations().filter(a => a instanceof CSSTransition);
      if (!moving.length) break;
      for (const a of moving) a.finish();
    }
    for (const a of document.getAnimations()) {
      if (!times.has(a)) times.set(a, a.currentTime);
      a.currentTime = 0;
    }
  };
  const collect = mark => {
    if (getComputedStyle(document.head).getPropertyValue('--css-diff') !== mark) throw new Error(`스타일시트를 ${mark ? '옛것으로 바꿔 끼우지' : '지금 것으로 두지'} 못했다`);
    still();
    const out = [];
    for (const el of els) {
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo);
        if (pseudo && (cs.content === 'none' || cs.content === 'normal')) { out.push(null); continue; }
        const row = {};
        for (const p of [...cs]) row[p] = cs.getPropertyValue(p);
        out.push(row);
      }
    }
    return out;
  };
  const now = collect('');
  nowSheet.disabled = true;
  oldSheet.disabled = false;
  // 2026-11-11 전의 style.css는 body의 data-era="2005"에 기대고 있었다. 그때의 것과 견줄 수 있게 옛것을 잴 때만 달아 준다
  const hadEra = document.body.hasAttribute('data-era');
  document.body.setAttribute('data-era', '2005');
  const old = collect('old');
  // 화면 조건(@media)이 걸려 있고 잰 요소에 맞아야 잰 것이다. ::before와 ::after는 그려졌을 때만, 움직임은 걸려 있을 때만 잰 것이고 다른 가상 요소는 재지 않는다
  const at = new Map(els.map((el, i) => [el, i]));
  const hit = watch.filter(({ sel, media, motion }) => {
    if (!media.every(m => matchMedia(m).matches)) return false;
    const pseudo = sel.match(/::(before|after)$/)?.[0] || '';
    const j = ['', '::before', '::after'].indexOf(pseudo);
    const base = sel.slice(0, sel.length - pseudo.length).replace(/(^|[\s>+~])$/, '$1*');
    return [...document.querySelectorAll(base)].some(el => at.has(el)
      && [now, old].some(rows => { const row = rows[at.get(el) * 3 + j]; return row && (!motion || row['animation-name'] !== 'none'); }));
  }).map(c => c.id);
  if (!hadEra) document.body.removeAttribute('data-era');
  oldSheet.disabled = true;
  nowSheet.disabled = false;
  for (const [a, t] of times) { if (a.playState !== 'idle') a.currentTime = t; } // 첫 장면으로 돌렸던 애니메이션을 제자리로
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
  return { diffs: [...diffs].map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)), hit };
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
  let total = 0;
  let states = 0;
  const seen = new Set();
  const report = (where, diffs) => {
    const fresh = diffs.filter(d => !seen.has(d));
    fresh.forEach(d => seen.add(d));
    total += diffs.length;
    if (diffs.length) console.log(`다름 [${where}] ${diffs.length}개(앞 화면에 없던 것 ${fresh.length}개)`);
    for (const d of fresh.slice(0, 25)) console.log(`   ${d}`);
    if (fresh.length > 25) console.log(`   그 밖에 ${fresh.length - 25}개`);
  };
  // 누를 단추가 없거나 열리지 않은 화면을 센다
  let missing = 0;
  const lost = what => {
    missing++;
    console.log(`   (없음) ${what}`);
  };
  let changed = null; // 고친 선택자(changedSelectors)
  let unseen = []; // 그 가운데 아직 재지 못한 것
  const open = async (hash = '') => {
    await page.send('Page.navigate', { url: 'about:blank' });
    await page.send('Page.navigate', { url: base + hash });
    for (let i = 0; i < 100; i++) { if (await page.run(() => document.readyState === 'complete' && !document.getElementById('page-loader'))) break; await sleep(100); }
    const fonts = await page.run(prepare, OLD);
    if (!fonts.every(f => seen.has(f))) report('글꼴 선언', fonts); // 열 때마다 같으므로 한 번만 적는다
    if (!changed) unseen = changed = await page.run(changedSelectors);
  };
  const setNight = on => page.run(async v => { const { settings } = await import(new URL('src/settings.js', document.baseURI).href); settings.set({ night: v }); }, on);
  const check = async (where, night = true) => {
    // 2분 그냥 두면 뜨는 화면 보호기(src/screensaver.js)가 뒤에서 닫으려고 누르는 Esc를 먹지 않게, 화면마다 키를 하나 눌러 시간을 새로 재게 한다
    await page.run(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' })));
    for (const theme of night ? ['낮', '밤'] : ['낮']) {
      if (night) { await setNight(theme === '밤'); await sleep(120); }
      const { diffs, hit } = await page.run(compare, unseen.filter(c => !c.whole));
      unseen = unseen.filter(c => !hit.includes(c.id));
      report(`${where}, ${theme}`, diffs);
      states++;
    }
    if (night) await setNight(false);
  };
  // sel 가운데 글이 text인 것을 누른다. text가 없으면 첫 번째 것이다
  const clickText = async (sel, text = '') => {
    const found = await page.run((s, t) => { const el = [...document.querySelectorAll(s)].find(b => b.textContent.includes(t)); if (el) el.click(); return !!el; }, sel, text);
    if (!found) lost(text ? `${sel} "${text}"` : sel);
  };
  const openIcon = async id => {
    const opened = await page.run(i => {
      const wins = () => document.querySelectorAll('#windows .win').length;
      const before = wins();
      const b = document.querySelector(`#icons .desk-icon[data-app="${i}"]`);
      b?.click();
      b?.click();
      return wins() > before;
    }, id);
    if (!opened) lost(`창 ${id}`);
  };
  const closeWindows = () => page.run(() => { for (const b of document.querySelectorAll('#windows .win .win-close')) b.click(); });
  const use = async (id, ready) => {
    await page.run(i => { const f = document.querySelector(`#wallpaper .furn[data-id="${i}"]`); f.click(); f.click(); }, id);
    let opened = false;
    for (let i = 0; i < 100 && !opened; i++) { opened = await page.run(ready); if (!opened) await sleep(150); }
    if (!opened) lost(`가구 화면 ${id}`);
    await sleep(300);
  };
  const esc = async () => {
    await page.run(() => { document.activeElement?.blur(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
    await sleep(150);
  };
  // 마우스를 올렸을 때(:hover), 누르고 있을 때(:active), 초점이 갔을 때(:focus)의 모양은 크롬에 그 상태를 억지로 걸어 견준다.
  // 화면 없는 크롬은 페이지에 초점이 없어서 초점이 간 요소에도 :focus가 저절로 걸리지 않는다(known-issues 74)
  await page.send('DOM.enable');
  await page.send('CSS.enable');
  const force = async (selector, states, night = true) => {
    const { root: doc } = await page.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await page.send('DOM.querySelector', { nodeId: doc.nodeId, selector });
    if (!nodeId) return lost(selector);
    await page.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: states });
    await check(`${selector}:${states.join(':')}`, night);
    await page.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
  };
  // sel 가운데 보이는 것을 오른쪽 단추로 눌러 메뉴(src/context-menu.js)를 열고 견준다. line은 그 메뉴에 있어야 하는 줄이다
  const openMenu = async (name, sel, line) => {
    const opened = await page.run((s, l) => {
      const el = [...document.querySelectorAll(s)].find(x => x.getClientRects().length);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      return !!document.querySelector(`.ctx-menu-item${l}`);
    }, sel, line);
    if (!opened) lost(`${name}의 오른쪽 단추 메뉴`);
    await check(`${name}의 오른쪽 단추 메뉴`);
  };
  const closeMenu = async () => {
    const shown = await page.run(() => {
      const menu = document.querySelector('.ctx-menu');
      menu?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      return !!menu;
    });
    if (!shown) lost('오른쪽 단추 메뉴(재는 동안 닫혔다)');
  };

  await open();
  await check('꺼진 화면', false);
  await page.run(() => document.getElementById('sound-key').click());
  await page.run(() => document.getElementById('power').click());
  await sleep(300);
  await check('부팅과 켜는 중', false);
  await sleep(1200);
  await check('로그인(처음 온 사람)', false);
  await force('.user.new .pic-choice[aria-pressed="false"]', ['hover'], false);
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
  await force('button.user', ['hover'], false);
  await force('.reset-link', ['hover'], false);
  await page.run(() => document.querySelector('.reset-link').click());
  await check('로그인(내 사용자, 이웃집, 초기화 확인)', false);
  await page.run(() => document.querySelector('.users .user:not(.neighbor)').click());
  await sleep(300);
  await check('환영 화면', false);
  await sleep(1200);
  await check('바탕화면');
  await force('#wallpaper .furn:not(.light) .hit', ['hover']); // 밤의 불빛 가구는 켜진 모양이 올린 모양을 덮는다
  await force('#wallpaper .room-pet path', ['hover']);
  await page.run(() => document.querySelector('.start-btn').click());
  await check('시작 메뉴');
  await page.run(() => document.querySelector('.start-btn').click());
  for (const id of ['room', 'games', 'share', 'music', 'pet']) {
    await openIcon(id);
    await sleep(500);
    await check(`창 ${id}`);
    if (id === 'room') { await page.run(() => document.querySelector('#windows .win-max').click()); await sleep(200); await check('창 room(최대화를 푼 것)', false); }
    if (id === 'pet') {
      await force('.pet-choice', ['hover']);
      await clickText('.pet-choice', '없음');
      await check('창 pet(펫 없음)');
      await clickText('.pet-choice', '고양이'); // 뒤의 화면에도 방에 펫이 있게 되돌린다
    }
    await closeWindows();
  }
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
    ['.start-pic', ['hover']], ['.start-name', ['hover']],
  ]) await force(sel, states);
  await page.run(() => document.querySelector('.start-btn').click());
  await closeWindows();

  // 실험실은 말풍선에 암호를 말해야 아이콘이 생긴다. 설정으로 열고, 재고 나면 창의 단추로 다시 닫는다
  await page.run(async () => { const { openLabs } = await import(new URL('src/labs.js', document.baseURI).href); openLabs(); });
  await openIcon('labs');
  await sleep(300);
  await check('창 labs');
  await clickText('.labs-app .btn', '실험실 닫기');
  // 시작 메뉴 맨 위의 내 사진으로 사진 바꾸기 창을, 그 창의 단추로 이름 바꾸기 창을 연다
  await page.run(() => document.querySelector('.start-btn').click());
  await clickText('.start-pic');
  await sleep(300);
  await check('사진 바꾸기');
  await force('.pic-app .pic-choice[aria-pressed="false"]', ['hover']);
  await page.run(() => { document.querySelector('.pic-app .pic-browse').disabled = true; });
  await check('사진 바꾸기(그림을 줄이는 중)');
  await clickText('.pic-app .pic-rename');
  await sleep(300);
  await page.run(() => { const f = document.querySelector('.name-app form'); f.querySelector('input').value = ''; f.requestSubmit(); });
  await check('이름 바꾸기와 오류');
  await closeWindows();
  // 오른쪽 단추 메뉴. 펫에는 점을 찍는 줄과 나누는 줄이, 창에는 굵은 줄과 회색 줄이, 새 탭으로 여는 아이콘에는 바깥 화살표가 있다
  await openMenu('펫', '#wallpaper .room-pet path:not(.shade)', '[aria-checked="true"]');
  await closeMenu();
  await openIcon('music');
  await sleep(300);
  await openMenu('창', '#windows .win-title', ':disabled');
  for (const [sel, states] of [
    ['.ctx-menu', ['focus', 'focus-visible']],
    ['.ctx-menu-item:not(:disabled)', ['hover']], ['.ctx-menu-item:not(:disabled)', ['focus-visible']], ['.ctx-menu-item:disabled', ['hover']],
  ]) await force(sel, states);
  await closeMenu();
  await closeWindows();
  await openIcon('games');
  await sleep(300);
  await openMenu('새 탭으로 여는 아이콘', '.folder-grid .desk-icon.external', '.external');
  await closeMenu();
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
  for (const [sel, states] of [
    ['.console-pad', ['active']], ['.console-face', ['active']], ['.console-game', ['hover']], ['.console-game', ['focus']], ['.console-star', ['hover']],
  ]) await force(sel, states);
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
  await use('test-paper', () => !!document.querySelector('.closeup .exam-paper.key'));
  await check('시험지(정답지)');
  await clickText('.closeup .exam-tools .btn', '고치기');
  await sleep(200);
  await check('시험지 문제 고치기');
  await esc(); await esc();
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

  // 시험지를 푸는 손님. 점검용 집을 예전 긴 링크(#r=)로 열면 서버 없이 친구 집에 들어간다
  const quiz = TEST_HOME.likes['test-paper'];
  const friend = await page.run(async home => {
    const { sanitizeHome, encodeHome } = await import(new URL('src/share.js', document.baseURI).href);
    return encodeHome(sanitizeHome(home));
  }, { ...TEST_HOME, owner: '친구' });
  await open(`#r=${friend}`);
  await page.run(() => document.getElementById('power').click());
  await sleep(900);
  await clickText('.users .user', '손님으로 구경하기');
  await sleep(1500);
  const solving = () => !!document.querySelector('.closeup .exam-paper.solve');
  const choose = picks => page.run(list => { list.forEach((pick, i) => document.querySelectorAll('.closeup .exam-q')[i].querySelectorAll('.exam-choice')[pick].click()); }, picks);
  await use('test-paper', solving);
  await choose([quiz[0].answer]);
  await clickText('.closeup .exam-tools .btn', '채점하기'); // 한 문제만 고르고 채점하면 오류가 뜬다
  await check('손님의 시험지(고른 보기와 오류)');
  await force('.closeup .exam-q:last-child button.exam-choice', ['hover']);
  await force('.closeup .exam-q:last-child button.exam-choice', ['focus-visible']);
  await choose([quiz[0].answer, quiz[1].answer ? 0 : 1]);
  await clickText('.closeup .exam-tools .btn', '채점하기');
  await check('채점한 시험지(맞은 문제와 틀린 문제)');
  await esc();
  await page.run(() => localStorage.removeItem('agarago.quiz')); // 채점한 것을 잊게 해 다시 푼다
  await use('test-paper', solving);
  await choose(quiz.map(q => q.answer));
  await clickText('.closeup .exam-tools .btn', '채점하기');
  await check('채점한 시험지(100점 도장)');
  for (const msg of new Set(page.pageErrors)) console.log(`경고 페이지 오류: ${msg}`);
  if (unseen.length) {
    console.log(`재지 못함: 고친 선택자 ${unseen.length}개는 연 화면에 맞는 요소가 없었거나 움직임이다. 다른 곳이 0개여도 확인된 것이 아니다`);
    for (const c of unseen.slice(0, 40)) console.log(`   ${c.sel}${c.media.map(m => ` @media ${m}`).join('')} (${c.how}${c.motion ? ', 움직임' : ''})`);
    if (unseen.length > 40) console.log(`   그 밖에 ${unseen.length - 40}개`);
  }
  console.log(`점검 끝: 견준 화면 ${states}개, ${BASE}와 다른 곳 ${total}개(종류 ${seen.size}개)${missing ? `, 열지 못한 것 ${missing}개` : ''}${changed.length ? `, 고친 선택자 ${changed.length}개 가운데 재지 못한 것 ${unseen.length}개` : ''} (${Math.round((Date.now() - t0) / 1000)}초)`);
  return total || missing ? 1 : 0;
}
await runTool(import.meta.url, main);
