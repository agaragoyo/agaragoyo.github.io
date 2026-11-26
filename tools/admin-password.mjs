// 관리자 도구: 방 주인의 계정에 비밀번호를 넣고, 그 방에 로그인 아이디가 없으면 만든다(F36).
// 쓰는 때: 비밀번호를 만들기 전에 브라우저 저장소가 비어 방을 고칠 수 없게 된 주인을 되살릴 때(익명 계정에 비밀번호 달기),
//   비밀번호를 잊은 주인에게 새 비밀번호를 넣어 줄 때. 사용자는 스스로 비밀번호를 되찾을 길이 없어서 Admin이 한다.
// 이 PC가 아니라 Google Cloud Shell에서 프로젝트 주인의 구글 계정으로 돌린다. 다른 파일을 부르지 않아 이 파일 하나만 올리면 된다.
//   1. https://shell.cloud.google.com/?project=agaragoyo-86036 을 열고 터미널 위 메뉴의 업로드로 이 파일을 올린다
//   2. node admin-password.mjs <방 번호 8글자>
//   방 번호는 그 주인의 짧은 링크(#s=) 뒤의 8글자다. "Cloud Shell 승인" 창이 뜨면 승인한다
// 차례: 1. 읽기만 하는 확인(방, 주인 계정, 그 방의 아이디) 2. 버릴 시험 계정으로 같은 일을 해 보고 지운다
//   3. 아이디와 비밀번호를 묻고 y로 확인을 받는다 4. 진짜 계정에 한다 5. 사이트와 같은 차례로 로그인해 본다.
// 한 단계라도 실패하면 거기서 멈추고 진짜 계정에 무엇을 했는지 알린다. 다시 돌려도 된다(이미 만든 아이디는 다시 만들지 않는다).
// 비밀번호는 화면에 보이지 않게 받고, 화면과 파일 어디에도 남기지 않는다. 주인은 로그인한 뒤 아이디와 비밀번호 창에서 비밀번호를 바꾼다.
// 비밀번호를 넣으면 그 계정으로 로그인해 있던 브라우저는 로그인이 풀린다(다른 브라우저에서 비밀번호를 바꾼 것과 같다).
// 관리자 요청은 gcloud의 토큰으로 하므로 firestore.rules를 거치지 않는다. Firebase 웹 설정의 키는 배포된 사이트의 src/cloud.js에서 읽는다.
// 사이트와 같아야 하는 줄(emailOf, HANDLE_RE, normalHandle, ROOM_RE, MIN_PASSWORD)은 src/cloud.js와 글자까지 같게 두고,
// python tools/check.py(check_admin_password)가 견준다. 다르면 이 도구로 만든 비밀번호로 사이트에서 로그인할 수 없다.
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import readline from 'node:readline';

const PROJECT = 'agaragoyo-86036';
const SITE = 'https://agaragoyo.github.io/src/cloud.js';
const IDT = 'https://identitytoolkit.googleapis.com/v1';
const ADMIN = `${IDT}/projects/${PROJECT}`;
const PATH = `projects/${PROJECT}/databases/(default)/documents`;
const DOCS = `https://firestore.googleapis.com/v1/${PATH}`;

// ---------- src/cloud.js와 같아야 하는 줄 ----------
const HANDLE_RE = /^[a-z0-9가-힣]{2,12}$/;
const normalHandle = text => String(text ?? '').normalize('NFKC').replace(/\s+/g, '').replace(/^@/, '').toLowerCase();
const ROOM_RE = /^[0-9A-Za-z]{8}$/;
const emailOf = uid => `u${Array.from(new TextEncoder().encode(uid), b => b.toString(16).padStart(2, '0')).join('')}@agaragoyo.invalid`;
const MIN_PASSWORD = 6;

const short = uid => `${String(uid).slice(0, 4)}…`;
const randomPassword = () => crypto.randomBytes(18).toString('base64url');
const pick = (n, chars) => Array.from({ length: n }, () => chars[crypto.randomInt(chars.length)]).join('');
const say = text => console.log(text);

// 서버 시각(밀리초 글자나 ISO 글자)을 한국 시각 "2026년 11월 24일 15:22"로
function when(v) {
  const t = v ? new Date(/^\d+$/.test(String(v)) ? Number(v) : v).getTime() : NaN;
  if (Number.isNaN(t)) return '모름';
  const d = new Date(t + 9 * 3600 * 1000);
  const two = x => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

class Stop extends Error {}
const stop = text => { throw new Stop(text); };

// 진짜 계정에 한 일. 멈출 때 무엇이 바뀌었는지 알린다
let phase = '';
const NOTE = {
  '': '바뀐 것은 없다.',
  handle: '아이디는 만들었다. 다시 돌리면 이어서 비밀번호를 넣는다.',
  password: '아이디와 비밀번호는 넣었다. 다시 돌려 확인한다.',
  done: '',
};

// ---------- 입력 ----------
// 터미널이면 보이는 질문은 readline으로, 비밀번호는 글자를 화면에 내지 않고 받는다. 파이프로 받으면(시험) 줄마다 하나씩 읽는다.
// Ctrl+C를 누르면 null이다(부르는 쪽이 멈춘다. 그래야 끝의 뒷정리를 한다)
let lines = null;
async function ask(question) {
  if (!process.stdin.isTTY) {
    process.stdout.write(question);
    lines ||= readline.createInterface({ input: process.stdin, terminal: false })[Symbol.asyncIterator]();
    const r = await lines.next();
    process.stdout.write('\n');
    return r.done ? '' : r.value;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise(resolve => {
      rl.on('SIGINT', () => {
        process.stdout.write('\n');
        resolve(null);
      });
      rl.question(question, resolve);
    });
  } finally {
    rl.close();
  }
}

function askHidden(question) {
  if (!process.stdin.isTTY) return ask(question);
  return new Promise(resolve => {
    const input = process.stdin;
    let text = '';
    let esc = false; // 화살표 같은 키가 보내는 글자 묶음(ESC [ ...)은 버린다
    const finish = value => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
      resolve(value);
    };
    const onData = chunk => {
      for (const ch of String(chunk)) {
        if (esc) {
          if (/[A-Za-z~]/.test(ch)) esc = false;
          continue;
        }
        if (ch === '\x1b') esc = true;
        else if (ch === '\r' || ch === '\n' || ch === '\x04') return finish(text);
        else if (ch === '\x03') return finish(null);
        else if (ch === '\x7f' || ch === '\b') text = Array.from(text).slice(0, -1).join('');
        else if (ch >= ' ') text += ch;
      }
    };
    process.stdout.write(question);
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

// ---------- 요청 ----------
let token = '';
function adminToken() {
  if (!token) {
    try {
      token = execSync('gcloud auth print-access-token', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch {
      token = '';
    }
    if (!token) stop('gcloud 토큰을 받지 못했다. Cloud Shell에서 프로젝트 주인의 구글 계정으로 돌린다.');
  }
  return token;
}

let KEY = ''; // Firebase 웹 설정의 키. 사이트에 원래 공개된 값이라 배포된 사이트에서 읽는다(레포에서는 src/cloud.js에만 둔다)
async function siteKey() {
  let text = '';
  try {
    text = await (await fetch(`${SITE}?t=${Date.now()}`)).text();
  } catch { /* 아래에서 알린다 */ }
  return text.match(/API_KEY = '([^']+)'/)?.[1] || stop('사이트에서 Firebase 웹 설정의 키를 읽지 못했다. 잠시 뒤에 다시 돌린다.');
}

// 답을 { ok, status, code, message, body }로 돌려준다. 연결이 끊겨도 던지지 않는다(뒷정리까지 가야 한다)
async function call(url, { method = 'GET', body, admin = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (admin) {
    headers.Authorization = `Bearer ${adminToken()}`;
    headers['x-goog-user-project'] = PROJECT;
  }
  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    return { ok: false, status: 0, code: '연결 안 됨', message: '', body: null };
  }
  const json = await res.json().catch(() => null);
  const error = (Array.isArray(json) ? json[0] : json)?.error;
  const message = String(error?.message ?? '');
  const code = message.match(/^[A-Z_]{3,}/)?.[0] || error?.status || (res.ok ? '' : `HTTP ${res.status}`);
  return { ok: res.ok, status: res.status, code, message, body: json };
}
const need = (r, what) => (r.ok ? r : stop(`${what}에 실패했다(${r.code}${r.message && r.message !== r.code ? `: ${r.message.slice(0, 160)}` : ''}).`));

const lookup = uid => call(`${ADMIN}/accounts:lookup`, { method: 'POST', admin: true, body: { localId: [uid] } });
const update = (uid, patch) => call(`${ADMIN}/accounts:update`, { method: 'POST', admin: true, body: { localId: uid, ...patch } });
const removeAccount = uid => call(`${ADMIN}/accounts:delete`, { method: 'POST', admin: true, body: { localId: uid } });
const signInAs = (uid, password) => call(`${IDT}/accounts:signInWithPassword?key=${KEY}`, {
  method: 'POST', body: { email: emailOf(uid), password, returnSecureToken: true },
});
const handlePath = handle => `handles/${encodeURIComponent(handle)}`;
const readDoc = path => call(`${DOCS}/${path}?key=${KEY}`);
const dropDoc = path => call(`${DOCS}/${path}`, { method: 'DELETE', admin: true });
// 사이트의 claimHandle과 같은 꼴이다. 이미 있는 아이디면 만들지 않는다(409 ALREADY_EXISTS)
const makeHandle = (handle, uid, room) => call(`${DOCS}:commit`, {
  method: 'POST',
  admin: true,
  body: {
    writes: [{
      update: { name: `${PATH}/handles/${handle}`, fields: { uid: { stringValue: uid }, room: { stringValue: room } } },
      currentDocument: { exists: false },
    }],
  },
});

// 아이디 문서를 모두 읽는다(관리자만 할 수 있다. 사이트의 규칙은 목록 읽기를 막는다)
async function listHandles() {
  const out = [];
  let page = '';
  do {
    const r = need(await call(`${DOCS}/handles?pageSize=300${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`, { admin: true }), '아이디 목록 읽기');
    for (const d of r.body?.documents || []) {
      let handle = d.name.slice(d.name.lastIndexOf('/') + 1);
      try {
        handle = decodeURIComponent(handle);
      } catch { /* 그대로 둔다 */ }
      out.push({ handle, uid: d.fields?.uid?.stringValue || '', room: d.fields?.room?.stringValue || '' });
    }
    page = r.body?.nextPageToken || '';
  } while (page);
  return out;
}

// ---------- 시험 계정으로 먼저 해 보기 ----------
// 지우지 못한 시험 계정과 시험 아이디. 끝에서 한 번 더 지운다
const leftovers = [];
async function sweep() {
  for (const item of leftovers.splice(0)) {
    if (!(await item.drop()).ok) leftovers.push(item);
  }
}

// 사이트처럼 익명 계정을 만들고, 관리자 길로 비밀번호 달기, 새 비밀번호 넣기, 아이디 문서 만들기를 해 본 뒤 모두 지운다
async function rehearse() {
  say('2. 버릴 시험 계정으로 먼저 해 본다');
  const anon = need(await call(`${IDT}/accounts:signUp?key=${KEY}`, { method: 'POST', body: { returnSecureToken: true } }), '시험 계정 만들기');
  const uid = anon.body?.localId || stop('시험 계정의 번호를 받지 못했다.');
  const handle = `t${pick(11, '0123456789abcdefghijklmnopqrstuvwxyz')}`;
  let madeHandle = false;
  try {
    const first = randomPassword();
    need(await update(uid, { email: emailOf(uid), password: first }), '익명 계정에 비밀번호 달기');
    const a = need(await signInAs(uid, first), '단 비밀번호로 로그인');
    if (a.body?.localId !== uid) stop('시험 계정과 다른 계정으로 로그인되었다.');
    const second = randomPassword();
    need(await update(uid, { password: second }), '새 비밀번호 넣기');
    const b = need(await signInAs(uid, second), '새 비밀번호로 로그인');
    if (b.body?.localId !== uid) stop('시험 계정과 다른 계정으로 로그인되었다.');
    if ((await signInAs(uid, first)).ok) stop('새 비밀번호를 넣었는데 옛 비밀번호로도 로그인된다.');
    const made = need(await makeHandle(handle, uid, `Test${pick(4, '0123456789')}`), '아이디 문서 만들기');
    madeHandle = made.ok;
    const doc = need(await readDoc(handlePath(handle)), '만든 아이디 읽기');
    if (doc.body?.fields?.uid?.stringValue !== uid) stop('만든 아이디의 계정 번호가 다르다.');
    say('   됨: 익명 계정에 비밀번호 달기, 새 비밀번호 넣기, 아이디 문서 만들기');
  } finally {
    if (madeHandle) leftovers.push({ label: `아이디 문서 handles/${handle}`, drop: () => dropDoc(handlePath(handle)) });
    leftovers.push({ label: `시험 계정 ${short(uid)}`, drop: () => removeAccount(uid) });
    await sweep();
    say(leftovers.length ? '   시험에 쓴 것 가운데 지우지 못한 것은 끝에서 다시 지운다' : '   시험 계정과 시험 아이디를 지웠다');
  }
}

// 새 아이디를 묻는다. 이 방의 주인이 만든 아이디가 있으면 묻지 않으므로(main의 mine), 여기서 이미 있는 아이디는 모두 쓸 수 없다.
// 이 방을 가리켜도 주인이 아닌 계정이 만든 아이디는 로그인에 쓰이지 않는다(사이트의 logIn은 아이디의 uid로 로그인한다)
async function askHandle() {
  for (;;) {
    const raw = await ask('   새로 만들 아이디(한글, 영문, 숫자 2~12자): ');
    if (raw === null) stop('그만뒀다.');
    if (!raw.trim()) stop('아이디를 입력하지 않아 그만뒀다.');
    const handle = normalHandle(raw);
    if (!HANDLE_RE.test(handle)) {
      say('   아이디는 한글, 영문, 숫자 2~12자다. 다시 입력한다');
      continue;
    }
    const doc = await readDoc(handlePath(handle));
    if (doc.ok) {
      say('   이미 쓰는 아이디다. 다른 아이디를 입력한다');
      continue;
    }
    if (doc.status !== 404) need(doc, '아이디 확인');
    return handle;
  }
}

async function askPassword() {
  for (;;) {
    const a = await askHidden(`   비밀번호(${MIN_PASSWORD}자 이상, 쳐도 화면에 보이지 않음): `);
    if (a === null) stop('그만뒀다.');
    if (!a) stop('비밀번호를 입력하지 않아 그만뒀다.');
    if (Array.from(a).length < MIN_PASSWORD) {
      say(`   비밀번호는 ${MIN_PASSWORD}자 이상이어야 한다. 다시 입력한다`);
      continue;
    }
    const b = await askHidden('   비밀번호 확인: ');
    if (b === null) stop('그만뒀다.');
    if (a !== b) {
      say('   두 비밀번호가 다르다. 다시 입력한다');
      continue;
    }
    return a;
  }
}

async function main() {
  const room = process.argv[2] || '';
  if (!ROOM_RE.test(room)) stop('방 번호 8글자를 붙여 돌린다. 예: node admin-password.mjs Ab12Cd34');
  if (typeof fetch !== 'function') stop('Node 18 이상이 필요하다.');

  say('1. 읽기만 하는 확인');
  KEY = await siteKey();
  adminToken();
  const home = await readDoc(`homes/${room}`);
  if (home.status === 404) stop(`방 ${room}이 서버에 없다.`);
  need(home, '방 읽기');
  const uid = home.body?.fields?.uid?.stringValue || stop('방 문서에 주인 계정 번호가 없다.');
  say(`   방 ${room}: 주인 계정 ${short(uid)}, 마지막으로 고친 때 ${when(home.body.updateTime)}`);
  const user = need(await lookup(uid), '주인 계정 읽기').body?.users?.[0]
    || stop('방 주인의 계정이 없다. 계정이 지워졌으면 이 도구로는 되살릴 수 없다.');
  if (user.disabled) stop('방 주인의 계정이 사용 중지되어 있다. Firebase 콘솔에서 먼저 사용 설정한다.');
  const email = emailOf(uid);
  if (user.email && user.email !== email) stop('방 주인의 계정에 사이트가 쓰지 않는 이메일이 있어 손대지 않는다.');
  const hasPassword = !!user.email;
  // 마지막으로 쓴 때가 방을 마지막으로 고친 때보다 한참 뒤면 그 계정을 아직 쓰는 브라우저가 있을 수 있다. 사람이 보고 판단한다
  say(`   주인 계정: ${hasPassword ? '비밀번호 있음' : '비밀번호 없음(익명 계정)'}, 만든 때 ${when(user.createdAt)}, 마지막으로 쓴 때 ${when(user.lastRefreshAt || user.lastLoginAt)}`);
  const all = await listHandles();
  const mine = all.filter(h => h.room === room && h.uid === uid);
  const strays = all.filter(h => h.room === room && h.uid !== uid);
  say(`   이 방의 아이디: ${mine.length ? mine.map(h => h.handle).join(', ') : '없음'}`);
  if (strays.length) say(`   주인이 아닌 계정이 이 방을 가리키는 아이디(로그인에는 쓰이지 않음): ${strays.map(h => h.handle).join(', ')}`);

  await rehearse();

  say('3. 아이디와 비밀번호');
  const exists = mine.length > 0;
  const handle = exists ? mine[0].handle : await askHandle();
  if (exists) say(`   로그인 아이디: ${handle}(이미 있음)`);
  const password = await askPassword();
  const work = [!exists && `아이디 "${handle}" 만들기`, hasPassword ? '새 비밀번호 넣기' : '익명 계정에 비밀번호 달기'].filter(Boolean);
  say(`   할 일: ${work.join(', ')}`);
  say('   이 계정으로 로그인해 있던 브라우저는 로그인이 풀려 아이디와 비밀번호로 다시 로그인해야 한다');
  const go = await ask('   진행하려면 y(그만두려면 그냥 Enter): ');
  if (String(go ?? '').trim().toLowerCase() !== 'y') stop('그만뒀다.');

  say('4. 진짜 계정에 하기');
  if (!exists) {
    const made = await makeHandle(handle, uid, room);
    if (made.status === 409) stop(`그사이에 아이디 "${handle}"를 다른 사람이 정했다. 다시 돌려 다른 아이디를 입력한다.`);
    need(made, '아이디 만들기');
    phase = 'handle';
    say(`   아이디 "${handle}" 만들기: 됨`);
  }
  const what = hasPassword ? '새 비밀번호 넣기' : '익명 계정에 비밀번호 달기';
  need(await update(uid, hasPassword ? { password } : { email, password }), what);
  phase = 'password';
  say(`   ${what}: 됨`);

  say('5. 사이트와 같은 차례로 로그인해 보기');
  const doc = need(await readDoc(handlePath(handle)), '아이디 읽기');
  if (doc.body?.fields?.uid?.stringValue !== uid || doc.body?.fields?.room?.stringValue !== room) stop('아이디가 이 방과 주인을 가리키지 않는다.');
  const login = need(await signInAs(uid, password), '비밀번호로 로그인');
  if (login.body?.localId !== uid) stop('다른 계정으로 로그인되었다.');
  const again = need(await readDoc(`homes/${room}`), '방 다시 읽기');
  if (again.body?.fields?.uid?.stringValue !== uid) stop('방 주인이 바뀌었다.');
  phase = 'done';
  say('   됨: 아이디가 가리키는 계정과 방 주인이 같고, 그 비밀번호로 로그인된다');
  say('');
  say(`끝: 주인에게 알릴 것은 아이디 "${handle}"와 방금 입력한 비밀번호(화면과 파일에 남기지 않음)`);
}

try {
  await main();
} catch (err) {
  const text = err instanceof Stop ? err.message : `예상하지 못한 오류다(${err.message}).`;
  say(`멈춤: ${text}${NOTE[phase] ? ` ${NOTE[phase]}` : ''}`);
  process.exitCode = 1;
} finally {
  if (leftovers.length) {
    await sweep();
    say(leftovers.length
      ? `시험에 쓴 것을 지우지 못했다: ${leftovers.map(x => x.label).join(', ')}. Firebase 콘솔에서 지운다`
      : '남아 있던 시험 계정과 시험 아이디를 지웠다');
  }
  process.exit(process.exitCode || 0); // 입력을 받던 터미널이 남아 있어도 끝낸다
}
