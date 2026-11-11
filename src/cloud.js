// 서버(Firebase의 Firestore)에 공유한 방을 두고, 짧은 링크(#s=<번호 8글자>)에는 번호만 담는다.
// SDK 없이 Firestore와 Firebase 인증의 REST 주소를 fetch로 부른다. SDK는 첫 화면을 무겁게 하고 localStorage에 자기 이름의 키를 쓴다.
//   읽기: 로그인 없이 GET 한 번. 짧은 링크로 온 손님은 이것만 한다.
//   쓰기: 익명 로그인(가입 없이 브라우저마다 하나 생기는 사용자)의 토큰으로 한다. 서버의 규칙이 방을 처음 올린 사용자만 고치고 지우게 한다.
// 규칙은 레포 맨 위의 firestore.rules에 있고, Firebase 콘솔에 게시한 규칙과 같아야 한다(known-issues 59).
// API_KEY는 Firebase 웹 설정의 값이라 원래 웹페이지에 공개된다. 데이터는 규칙이 지킨다(AGENTS.md의 "공개 레포").
// 이 컴퓨터에 남기는 것: { uid, refresh: 익명 로그인, id: 올린 방의 번호, sent: 마지막으로 올린 방 글자 }
import { STORAGE_CLOUD } from './config.js';
import { loadJSON, saveJSON } from './util.js';

const PROJECT = 'agaragoyo-86036';
const API_KEY = 'AIzaSyABA1dg9I6gPXzd_8sPnE2u5mwND-K_ksw';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const HOMES = 'homes';
export const MAX_CODE = 30000; // 방 글자 수 한도. firestore.rules의 code.size() 한도와 같아야 한다(tools/check.py가 본다)
const ID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 8;
const TIMEOUT = 10000;
const SYNC_DELAY = 3000; // 방을 고친 뒤 이만큼 더 고치지 않으면 서버의 방도 고친다

// 서버에 닿지 못했거나 서버가 거절한 일. reason은 화면에 낼 말을 고르는 데 쓴다.
//   offline: 연결이 안 되거나 답이 늦음, missing: 그런 문서가 없음, denied: 규칙이 막음, busy: 하루 무료 한도를 다 씀, server: 서버 오류
export class CloudError extends Error {
  constructor(reason, detail) {
    super(`${reason}: ${detail}`);
    this.reason = reason;
  }
}

const state = () => loadJSON(STORAGE_CLOUD) || {};
const remember = patch => saveJSON(STORAGE_CLOUD, { ...state(), ...patch });

async function request(url, opts = {}) {
  let res;
  try {
    res = await fetch(url, { ...opts, signal: AbortSignal.timeout?.(TIMEOUT) });
  } catch (err) {
    throw new CloudError('offline', err.message);
  }
  const body = await res.json().catch(() => null);
  if (res.ok) return body;
  const reason = res.status === 404 ? 'missing' : res.status === 429 ? 'busy' : res.status >= 500 ? 'server' : 'denied';
  throw new CloudError(reason, body?.error?.message || `HTTP ${res.status}`);
}

// ---------- 익명 로그인 ----------
// 토큰은 한 시간짜리라 메모리에만 두고, 다시 받을 때 쓰는 refresh 토큰을 저장한다. 동시에 불려도 계정을 둘 만들지 않게 받는 중인 일을 같이 쓴다.
let session = null; // { token, uid, until }
let signing = null;

async function signIn() {
  const { refresh } = state();
  if (refresh) {
    try {
      const r = await request(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refresh)}`,
      });
      remember({ uid: r.user_id, refresh: r.refresh_token });
      return { token: r.id_token, uid: r.user_id, until: Date.now() + (Number(r.expires_in) - 60) * 1000 };
    } catch (err) {
      if (err.reason !== 'denied') throw err;
      // 익명 계정이 지워졌다. 새 계정은 예전 방을 고칠 수 없으므로 방 번호도 잊는다(다음에 공유하면 새 번호가 생긴다).
      remember({ uid: null, refresh: null, id: null, sent: null });
    }
  }
  const r = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  remember({ uid: r.localId, refresh: r.refreshToken });
  return { token: r.idToken, uid: r.localId, until: Date.now() + (Number(r.expiresIn) - 60) * 1000 };
}

async function auth() {
  if (session && Date.now() < session.until) return session;
  signing ||= signIn().finally(() => { signing = null; });
  session = await signing;
  return session;
}

// ---------- 방 ----------
function newId() {
  const out = [];
  while (out.length < ID_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < 248 && out.length < ID_LENGTH) out.push(ID_CHARS[b % 62]); // 248 = 62 * 4. 그 위의 값은 버려야 글자마다 고르게 나온다
    }
  }
  return out.join('');
}

// 서버에 둔 방의 글자(긴 링크 #r= 뒤와 같은 꼴)를 받아 온다. 그런 방이 없으면 null.
// 받은 글자는 누구든 쓸 수 있는 값이므로, 쓰는 쪽은 반드시 decodeHome(src/share.js)으로 검사한다.
export async function fetchHome(id) {
  try {
    const doc = await request(`${DOCS}/${HOMES}/${id}?key=${API_KEY}`);
    const code = doc?.fields?.code?.stringValue;
    return typeof code === 'string' ? code : null;
  } catch (err) {
    if (err.reason === 'missing') return null;
    throw err;
  }
}

// 이 컴퓨터의 방을 올려 둔 번호. 올린 적이 없으면 null
export const sharedId = () => state().id || null;

// 쓰기는 한 번에 하나씩 차례로 한다(만들기와 고치기가 겹쳐 번호가 둘 생기지 않게).
let chain = Promise.resolve();
const queue = job => {
  const run = chain.then(job, job);
  chain = run.catch(() => {});
  return run;
};

// 방 글자를 올린다. 올린 적이 없으면 새 번호로 만들고, 있으면 같은 번호의 방을 고친다. 번호를 돌려준다.
// 규칙이 updatedAt에 서버 시각만 받으므로 PATCH가 아니라 commit의 updateTransforms(REQUEST_TIME)로 쓴다.
async function upload(code, keepalive = false) {
  if (code.length > MAX_CODE) throw new CloudError('denied', `방 글자가 ${MAX_CODE}자를 넘는다`);
  const me = await auth();
  const old = state().id;
  const id = old || newId();
  try {
    await request(`${DOCS}:commit?key=${API_KEY}`, {
      method: 'POST',
      keepalive,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${me.token}` },
      body: JSON.stringify({
        writes: [{
          update: {
            name: `projects/${PROJECT}/databases/(default)/documents/${HOMES}/${id}`,
            fields: { uid: { stringValue: me.uid }, code: { stringValue: code } },
          },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        }],
      }),
    });
  } catch (err) {
    // 올려 둔 방을 이 사용자가 고칠 수 없다(다른 익명 계정이 올렸거나 지워짐). 번호를 잊어 다음에 새로 만들게 한다.
    if (err.reason === 'denied' && old) remember({ id: null, sent: null });
    throw err;
  }
  remember({ id, sent: code });
  return id;
}

// 공유하기 창의 "짧은 링크 만들기". 방을 올리고 번호를 돌려준다.
export const share = code => queue(() => upload(code));

// 서버의 방을 지우고 번호를 잊는다. 이미 보낸 짧은 링크는 더는 열리지 않는다.
export function unshare() {
  return queue(async () => {
    const { id } = state();
    if (!id) return;
    const me = await auth();
    try {
      await request(`${DOCS}/${HOMES}/${id}?key=${API_KEY}`, { method: 'DELETE', headers: { Authorization: `Bearer ${me.token}` } });
    } catch (err) {
      if (err.reason !== 'denied') throw err; // denied: 이미 없거나 이 사용자의 방이 아니다. 어느 쪽이든 번호만 잊는다
    }
    remember({ id: null, sent: null });
  });
}

// ---------- 고친 방 따라 올리기 ----------
// 짧은 링크를 만든 뒤에는 방을 고칠 때마다(os.saveHome) 서버의 방도 고쳐서, 같은 링크가 늘 지금 방을 보여 준다.
// 고칠 때마다 올리지 않고 SYNC_DELAY 동안 더 고치지 않을 때 한 번 올린다. 마지막으로 올린 글자와 같으면 올리지 않는다.
let timer = 0;
let pending = null; // 올릴 방 글자를 만드는 함수

function flush(keepalive = false) {
  clearTimeout(timer);
  const make = pending;
  pending = null;
  if (!make || !sharedId()) return Promise.resolve();
  const code = make();
  if (code === state().sent) return Promise.resolve();
  return queue(() => upload(code, keepalive));
}

// make는 올릴 때 부르므로 그사이에 더 고친 것까지 담긴다. 짧은 링크가 없으면 아무것도 하지 않는다(처음 올리기는 주인이 공유하기 창에서 고른다).
export function syncLater(make) {
  if (!sharedId()) return;
  pending = make;
  clearTimeout(timer);
  timer = setTimeout(() => flush().catch(err => console.warn('서버의 방을 고치지 못했다', err)), SYNC_DELAY);
}

// 지금 바로 올린다(공유하기 창을 열 때). 실패하면 CloudError를 던진다.
export function syncNow(make) {
  if (!sharedId()) return Promise.resolve();
  pending = make;
  return flush();
}

// 탭을 닫거나 다른 탭으로 갈 때 기다리던 것을 바로 올린다. keepalive라 페이지가 닫혀도 요청은 끝까지 간다.
// 그래도 못 올렸으면 다음에 내 컴퓨터로 들어올 때 다시 올린다(src/os.js의 enter).
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && pending) flush(true).catch(() => {});
});
