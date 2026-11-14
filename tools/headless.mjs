// 화면 없는 크롬을 CDP로 모는 공용 부분. tools/smoke.mjs(눌러 보기 점검), tools/night-contrast.mjs(밤 모드 글자 대비), tools/css-diff.mjs(모양 비교)가 같이 쓴다.
// 이 폴더의 사이트를 tools/serve.py로 빈 포트에 띄우고, 크롬이나 엣지를 새 사용자 폴더로 띄워 페이지 안에서 함수를 돌린다.
// 필요한 것: Node 22 이상(전역 WebSocket), 크롬이나 엣지, 파이썬. npm 패키지는 쓰지 않는다.
// 크롬을 찾지 못하면 환경 변수 CHROME에, 파이썬을 찾지 못하면 PYTHON에 실행 파일 경로를 넣는다.
//
//   const base = await startServer();      사이트 주소(http://127.0.0.1:<빈 포트>/)
//   const page = await launchChrome();     { send(CDP 명령, 값), run(페이지 안에서 돌릴 함수, ...넘길 값), pageErrors, consoleErrors }
//   await runTool(import.meta.url, main);  main이 돌려준 종료 코드로 끝낸다. 끝나거나 멈추면 크롬과 서버를 끈다
//   await page.run(plantHome, TEST_HOME);  가구와 담아 둔 것이 있는 점검용 집을 내 집으로 심는다(다시 열면 그 집의 사용자가 나온다)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export class Stop extends Error {} // 점검 결과가 아니라 도구를 돌리지 못했을 때 던진다
const cleanups = []; // 끝나거나 멈출 때 크롬과 서버를 끄는 함수들

// ---------- 서버와 크롬 ----------

const freePort = () => new Promise((res, rej) => {
  const s = net.createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});

// 이 폴더의 파일을 내보내는 tools/serve.py를 빈 포트에 띄운다. 8123을 다른 작업 폴더가 쓰고 있어도 이 폴더를 잰다.
export async function startServer() {
  const port = await freePort();
  const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const proc = spawn(python, [path.join(ROOT, 'tools', 'serve.py'), String(port)], { cwd: ROOT, stdio: 'ignore' });
  let failed = null;
  proc.on('error', e => { failed = e.message; });
  proc.on('exit', code => { failed ??= `종료 코드 ${code}`; });
  const stop = () => { if (proc.exitCode === null) proc.kill(); };
  cleanups.push(stop);
  const base = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 100; i++) {
    if (failed) throw new Stop(`tools/serve.py를 띄우지 못했다(${failed}). 파이썬이 있는지 보거나 환경 변수 PYTHON에 경로를 넣는다.`);
    try {
      if ((await fetch(base)).ok) return base;
    } catch { /* 아직 뜨는 중 */ }
    await sleep(100);
  }
  throw new Stop('tools/serve.py가 10초 안에 응답하지 않았다.');
}

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const e = process.env;
  const list = {
    win32: [
      `${e.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
      `${e['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
      `${e.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      `${e['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${e.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
  }[process.platform] || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'];
  return list.find(p => fs.existsSync(p));
}

// 화면 없는 크롬을 새 사용자 폴더로 띄운다. 사용자의 크롬과 저장소는 건드리지 않는다.
export async function launchChrome({ width = 1400, height = 1000 } = {}) {
  const exe = findChrome();
  if (!exe) throw new Stop('크롬이나 엣지를 찾지 못했다. 환경 변수 CHROME에 실행 파일 경로를 넣고 다시 돌린다.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agarago-headless-'));
  const proc = spawn(exe, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio', '--hide-scrollbars',
    `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: 'ignore' });
  let port = 0;
  const close = async () => {
    if (port) {
      try {
        const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
        const browser = await connect(webSocketDebuggerUrl);
        const closing = browser.send('Browser.close');
        closing.catch(() => {}); // 답보다 연결이 먼저 끊겨도 괜찮다
        await Promise.race([closing, sleep(3000)]);
      } catch { /* 이미 꺼졌다 */ }
    }
    if (proc.exitCode === null) await Promise.race([new Promise(r => proc.once('exit', r)), sleep(5000)]);
    if (proc.exitCode === null) proc.kill();
    for (let i = 0; i < 10; i++) { // 윈도우에서는 크롬이 파일을 놓을 때까지 잠깐 걸린다
      try { fs.rmSync(dir, { recursive: true, force: true }); break; } catch { await sleep(300); }
    }
  };
  cleanups.push(close);
  // 크롬은 고른 디버깅 포트를 사용자 폴더의 DevToolsActivePort 첫 줄에 적는다
  for (let i = 0; i < 150 && !port; i++) {
    await sleep(100);
    try { port = Number(fs.readFileSync(path.join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0]) || 0; } catch { /* 아직 없다 */ }
  }
  if (!port) throw new Stop(`크롬(${exe})이 15초 안에 디버깅 포트를 열지 않았다.`);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  return connect(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
}

// CDP 연결. run(fn, ...args)는 fn을 페이지 안에서 돌려 돌려준 값을 받는다(fn은 바깥 변수를 쓰지 않아야 한다).
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Stop('크롬 디버깅 연결에 실패했다.'));
  });
  let n = 0;
  const pending = new Map();
  const pageErrors = [];
  const consoleErrors = []; // console.error로 찍힌 것(받지 못한 그림의 404 같은 브라우저 알림도 들어온다)
  const handlers = new Map(); // 이벤트 이름 → 받는 함수(on으로 단다. 예: 요청 가로채기의 Fetch.requestPaused)
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method && handlers.has(m.method)) handlers.get(m.method)(m.params);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message));
      else res(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      pageErrors.push((d.exception?.description || d.text || '').split('\n')[0]);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200));
    }
  };
  ws.onclose = () => {
    for (const { rej } of pending.values()) rej(new Stop('크롬과의 연결이 끊겼다.'));
    pending.clear();
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++n;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const run = async (fn, ...fnArgs) => {
    const r = await send('Runtime.evaluate', {
      expression: `(${fn})(...${JSON.stringify(fnArgs)})`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  // on(이벤트 이름, 함수): 그 이벤트가 올 때마다 함수를 부른다. 함수 자리에 null을 넣으면 뗀다
  const on = (method, fn) => (fn ? handlers.set(method, fn) : handlers.delete(method));
  return { send, run, on, pageErrors, consoleErrors };
}

// 점검용 집. tools/smoke.mjs와 tools/night-contrast.mjs가 내 집으로 심어 쓴다. 바닥과 벽의 가구, 책상 위 물건, 가구에 담아 둔 것이 고루 들어 있다. 라디오는 CD를 넣지 않아 넣는 칸이 바로 뜬다
// (CD가 있으면 표지를 받으러 스포티파이에 요청을 보낸다). 처음 서는 칸(8, 8) 둘레는 비워 둔다.
export const TEST_HOME = {
  owner: '점검',
  scenes: {
    room: [
      { id: 'lamp', x: 0, y: 0 }, { id: 'desk', x: 3, y: 0 }, { id: 'computer', x: 3, y: 0 }, { id: 'radio', x: 4, y: 1 },
      { id: 'bookshelf', x: 7, y: 0 }, { id: 'bed', x: 0, y: 3 }, { id: 'tv', x: 8, y: 3 }, { id: 'console', x: 10, y: 3 },
      { id: 'corkboard', wall: 'R', x: 0, y: 4 },
    ],
    playground: [{ id: 'bench', x: 9, y: 10 }],
  },
  likes: {
    computer: { url: 'https://example.com/', name: '점검용 게임' },
    console: 'file-ten',
    bookshelf: [{ title: '첫 책', author: '지은이', note: '남긴 말', color: 0 }, { title: '둘째 책', color: 3 }, { title: '셋째 책', color: 5 }],
    tv: [{ title: '첫 작품', year: '2005', by: '감독', why: '추천 이유', color: 2 }, { title: '둘째 작품', color: 6 }],
  },
};

// 페이지 안에서 도는 함수(page.run(plantHome, TEST_HOME)). 집을 검사(sanitizeHome)에 통과시켜 내 집으로 심는다. 통과한 가구 수를 돌려준다
export async function plantHome(home) {
  const { sanitizeHome } = await import(new URL('src/share.js', document.baseURI).href);
  const clean = sanitizeHome(home);
  localStorage.setItem('agarago.home.v3', JSON.stringify(clean));
  return Object.values(clean.scenes).flat().length;
}

// 도구 하나를 돌린다. main은 종료 코드를 돌려준다(0 통과, 1 실패가 있음). 도구를 돌리지 못하면 2로 끝낸다.
// --help는 그 도구 파일 맨 위 주석의 사용법 줄("//   node "로 시작하는 줄)을 그대로 보여 준다.
export async function runTool(fileUrl, main) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    const usage = fs.readFileSync(fileURLToPath(fileUrl), 'utf8').split('\n').filter(l => l.startsWith('//   node '));
    console.log(usage.map(l => l.slice(5)).join('\n'));
    process.exit(0);
  }
  let code = 2;
  const cleanup = async () => { for (const f of cleanups.splice(0).reverse()) await f(); };
  process.once('SIGINT', async () => { await cleanup(); process.exit(130); });
  try {
    if (typeof WebSocket === 'undefined') throw new Stop(`Node ${process.versions.node}에는 전역 WebSocket이 없다. Node 22 이상으로 돌린다.`);
    code = await main();
  } catch (e) {
    console.log(e instanceof Stop ? `돌리지 못함: ${e.message}` : `돌리지 못함: ${e.stack || e}`);
  } finally {
    await cleanup();
  }
  process.exit(code);
}
