// 서버(Firebase의 Firestore)에 공유한 방을 두고, 짧은 링크(#s=<번호 8글자>)에는 번호만 담는다.
// SDK 없이 Firestore와 Firebase 인증의 REST 주소를 fetch로 부른다. SDK는 첫 화면을 무겁게 하고 localStorage에 자기 이름의 키를 쓴다.
//   읽기: 로그인 없이 GET 한 번. 짧은 링크로 온 손님은 이것만 한다.
//   쓰기: 익명 로그인(가입 없이 브라우저마다 하나 생기는 사용자)의 토큰으로 한다. 서버의 규칙이 방을 처음 올린 사용자만 고치고 지우게 한다.
// 같은 서버에 코르크 보드 방명록의 쪽지도 둔다(아래 "쪽지"). 쪽지는 짧은 링크를 만든 방에만 붙는다.
// 링크를 만든 사람이 원하면 방에 아이디를 달아, 친구가 이웃집 목록 창에서 아이디를 쳐서 찾아오게 한다(아래 "아이디").
// 규칙은 레포 맨 위의 firestore.rules에 있고, Firebase 콘솔에 게시한 규칙과 같아야 한다(known-issues 59).
// API_KEY는 Firebase 웹 설정의 값이라 원래 웹페이지에 공개된다. 데이터는 규칙이 지킨다(AGENTS.md의 "공개 레포").
// 이 컴퓨터에 남기는 것: { uid, refresh: 익명 로그인, id: 올린 방의 번호, sent: 마지막으로 올린 방 글자, handle: 그 방에 단 아이디,
//   nick: 손님으로 쪽지를 붙일 때 마지막으로 쓴 닉네임, seen: 주인이 마지막으로 본 쪽지의 시각(밀리초) }
import { STORAGE_CLOUD } from './config.js';
import { loadJSON, saveJSON } from './util.js';

const PROJECT = 'agaragoyo-86036';
const API_KEY = 'AIzaSyABA1dg9I6gPXzd_8sPnE2u5mwND-K_ksw';
const PATH = `projects/${PROJECT}/databases/(default)/documents`; // 문서 이름의 앞부분
const DOCS = `https://firestore.googleapis.com/v1/${PATH}`;
const HOMES = 'homes';
const NOTES = 'notes'; // 방 문서 아래의 쪽지(homes/{방 번호}/notes/{쪽지 번호})
const HANDLES = 'handles'; // 아이디(handles/{아이디}, 그 아이디의 방 번호를 담는다)
// 아이디의 글자와 길이. firestore.rules의 handle.matches와 같아야 한다(tools/check.py가 본다).
// 영문은 소문자로만 두어 대문자와 소문자를 가리지 않고(normalHandle이 바꾼다), 한글은 완성된 글자만 받는다
export const HANDLE_RE = /^[a-z0-9가-힣]{2,12}$/;
export const MAX_CODE = 30000; // 방 글자 수 한도. firestore.rules의 code.size() 한도와 같아야 한다(tools/check.py가 본다)
// 쪽지 한도. name, text, colors는 firestore.rules의 validNote와 같아야 한다(tools/check.py가 본다)
export const NOTE = {
  name: 12,  // 닉네임 글자 수(로그인 화면의 닉네임과 같은 길이)
  text: 60,  // 글 글자 수
  colors: 4, // 포스트잇 색 가짓수. 규칙은 color를 0부터 colors - 1까지 받는다
  page: 12,  // 보드에 한 번에 붙이는 쪽지 수. 규칙은 한 번에 30장까지만 읽게 한다
};
const ID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 8;
const NOTE_ID_LENGTH = 20; // 쪽지 번호. 주소에 드러나지 않으므로 Firestore가 스스로 만드는 번호와 같은 길이로 길게 둔다
const TIMEOUT = 10000;
const SYNC_DELAY = 3000; // 방을 고친 뒤 이만큼 더 고치지 않으면 서버의 방도 고친다

// 서버에 닿지 못했거나 서버가 거절한 일. reason은 화면에 낼 말을 고르는 데 쓴다.
//   offline: 연결이 안 되거나 답이 늦음, missing: 그런 문서가 없음, denied: 규칙이 막음, busy: 하루 무료 한도를 다 씀, server: 서버 오류,
//   taken: 다른 사람이 먼저 정한 아이디(claimHandle)
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
let kept = true; // 로그인한 계정을 저장소에 남길 수 있었는지. 저장소를 못 쓰는 환경이면 false다

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
      // 익명 계정이 지워졌다. 새 계정은 예전 방과 아이디를 고칠 수 없으므로 방 번호와 아이디도 잊는다(다음에 공유하면 새 번호가 생긴다).
      remember({ uid: null, refresh: null, id: null, sent: null, handle: null });
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

// 저장해 둔 계정이 메모리의 로그인과 달라졌으면 메모리의 것을 버리고 다시 로그인한다. "이 컴퓨터 초기화"로 저장소를 지웠거나
// 다른 탭이 새 계정을 만든 경우다. 버리지 않으면 지워진 계정으로 방을 올리고 저장소에는 그 계정이 남지 않아서,
// 새로 고침한 뒤에는 새 계정이 그 방을 고치지도 지우지도 못한다(known-issues 61).
async function auth() {
  if (session && kept && state().uid !== session.uid) session = null;
  if (session && Date.now() < session.until) return session;
  signing ||= signIn().finally(() => { signing = null; });
  session = await signing;
  kept = state().uid === session.uid;
  return session;
}

// ---------- 방 ----------
function randomId(length) {
  const out = [];
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(32))) {
      if (b < 248 && out.length < length) out.push(ID_CHARS[b % 62]); // 248 = 62 * 4. 그 위의 값은 버려야 글자마다 고르게 나온다
    }
  }
  return out.join('');
}
const newId = () => randomId(ID_LENGTH);

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
async function upload(code) {
  if (code.length > MAX_CODE) throw new CloudError('denied', `방 글자가 ${MAX_CODE}자를 넘는다`);
  const me = await auth();
  const old = state().id;
  const id = old || newId();
  try {
    await request(`${DOCS}:commit?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${me.token}` },
      body: JSON.stringify({
        writes: [{
          update: {
            name: `${PATH}/${HOMES}/${id}`,
            fields: { uid: { stringValue: me.uid }, code: { stringValue: code } },
          },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        }],
      }),
    });
  } catch (err) {
    // 올려 둔 방을 이 사용자가 고칠 수 없다(다른 익명 계정이 올렸거나 지워짐). 번호를 잊어 다음에 새로 만들게 한다.
    // 그 방에 단 아이디도 이 사용자의 것이 아니므로 잊는다.
    if (err.reason === 'denied' && old) remember({ id: null, sent: null, handle: null });
    throw err;
  }
  remember({ id, sent: code });
  return id;
}

// 공유하기 창의 "링크 만들기". 방을 올리고 번호를 돌려준다.
export const share = code => queue(() => upload(code));

// 서버의 방과 그 방에 붙은 쪽지, 방에 단 아이디를 지우고 번호를 잊는다. 이미 보낸 짧은 링크는 더는 열리지 않는다.
// 아이디를 먼저 지운다. 방만 지우면 아이디가 없는 방을 가리킨 채 남아 다른 사람이 그 아이디를 정하지 못한다.
// 이웃집에 고정한 방(data/neighbors.js의 keep)은 지우지 않는다. 부르는 쪽(로그인 화면의 이 컴퓨터 초기화, 공유하기의 링크 지우기)이
// 먼저 src/neighbors.js의 pinnedHere()를 보고 막는다(이 파일이 neighbors.js를 부르면 서로 부르게 되어 여기서는 보지 않는다). tools/check.py가 부르는 파일에 pinnedHere가 있는지 본다.
export function unshare() {
  return queue(async () => {
    const { id, handle } = state();
    if (!id) return;
    const me = await auth();
    if (handle) await deleteHandle(handle, me);
    remember({ handle: null });
    try {
      await clearNotes(id, me);
      await request(`${DOCS}/${HOMES}/${id}?key=${API_KEY}`, { method: 'DELETE', headers: { Authorization: `Bearer ${me.token}` } });
    } catch (err) {
      if (err.reason !== 'denied') throw err; // denied: 이미 없거나 이 사용자의 방이 아니다. 어느 쪽이든 번호만 잊는다
    }
    remember({ id: null, sent: null });
  });
}

// ---------- 아이디 ----------
// 링크를 만든 사람이 원하면 방에 아이디를 단다(공유하기 창). 친구는 이웃집 목록 창에서 아이디를 쳐서 그 방에 손님으로 들어간다(src/neighbors.js).
// 화면에 보이는 닉네임은 겹쳐도 되지만 아이디는 먼저 정한 한 사람만 쓴다(인스타그램의 사용자 이름, 2023년 디스코드의 사용자명).
// 아이디를 정한 사람만 찾을 수 있고, 아이디를 정확히 쳐야만 열린다. 서버의 규칙이 아이디 목록 읽기를 막는다(firestore.rules).
// 문서는 handles/{아이디}에 { uid: 정한 사람, room: 방 번호 }로 둔다. 방 하나에 아이디는 하나만 단다(새로 정하면 예전 것을 지운다).

// 사람이 친 아이디를 문서 번호의 꼴로 바꾼다. 전각 글자와 영문 대문자를 바꾸고, 띄어쓰기와 맨 앞의 @를 뺀다.
// 바꾼 글자가 HANDLE_RE에 맞지 않으면 그런 아이디는 없다(쓰는 쪽이 검사한다)
export const normalHandle = text => String(text ?? '').normalize('NFKC').replace(/\s+/g, '').replace(/^@/, '').toLowerCase();

// 닉네임에서 아이디로 쓸 수 있는 글자만 남긴 것. 공유하기 창의 아이디 칸에 미리 넣는다. 두 글자가 되지 않으면 빈 글자다.
// 남긴 글자는 모두 UTF-16 한 단위라서 slice로 잘라도 글자가 반으로 갈리지 않는다(known-issues 62)
export function handleFrom(name) {
  const handle = normalHandle(name).replace(/[^a-z0-9가-힣]/g, '').slice(0, 12);
  return HANDLE_RE.test(handle) ? handle : '';
}

// 이 컴퓨터의 방에 단 아이디. 링크가 없거나 아이디를 정하지 않았으면 null
export const myHandle = () => (state().id && typeof state().handle === 'string' ? state().handle : null);

const ROOM_RE = /^[0-9A-Za-z]{8}$/;
const handleUrl = handle => `${DOCS}/${HANDLES}/${encodeURIComponent(handle)}?key=${API_KEY}`;

// 서버의 아이디 문서 { uid, room }. 그런 아이디가 없으면 null. 받은 값은 누구든 쓸 수 있는 값이라 모양을 본다
async function readHandle(handle) {
  try {
    const doc = await request(handleUrl(handle));
    const f = doc?.fields || {};
    return { uid: f.uid?.stringValue || '', room: f.room?.stringValue || '' };
  } catch (err) {
    if (err.reason === 'missing') return null;
    throw err;
  }
}

// 아이디로 찾아갈 방 번호. 그런 아이디가 없거나 꼴이 틀리면 null이고, 서버에 닿지 못하면 CloudError를 던진다.
// 방 글자는 부르는 쪽이 fetchHome으로 받아 decodeHome으로 검사한다
export async function findHandle(handle) {
  if (!HANDLE_RE.test(handle)) return null;
  const doc = await readHandle(handle);
  return doc && ROOM_RE.test(doc.room) ? doc.room : null;
}

async function deleteHandle(handle, me) {
  try {
    await request(handleUrl(handle), { method: 'DELETE', headers: { Authorization: `Bearer ${me.token}` } });
  } catch (err) {
    if (err.reason !== 'denied') throw err; // denied: 이미 없거나 이 사용자의 아이디가 아니다. 어느 쪽이든 잊기만 한다
  }
}

// 공유하기 창의 "아이디 정하기". 올려 둔 방(sharedId)에 아이디를 달고 그 아이디를 돌려준다.
// 다른 사람이 먼저 정한 아이디면 CloudError('taken')을 던진다. 묻고 쓰는 사이에 남이 정했어도 규칙이 덮어쓰기를 막아서 같은 오류가 된다.
// 이미 아이디를 정했으면 새 아이디를 단 뒤 예전 아이디를 지운다. 예전 것을 먼저 지우면 새 아이디를 못 정했을 때 둘 다 잃는다.
export const claimHandle = handle => queue(async () => {
  const room = state().id;
  if (!room || !HANDLE_RE.test(handle)) throw new CloudError('denied', '올린 방이 없거나 아이디의 꼴이 틀렸다');
  const old = myHandle();
  if (old === handle) return handle;
  const me = await auth();
  const doc = await readHandle(handle);
  if (doc && doc.uid !== me.uid) throw new CloudError('taken', handle);
  if (doc && doc.room !== room) await deleteHandle(handle, me); // 내가 예전 방에 달아 둔 아이디. 규칙이 고치기를 막아서 지우고 다시 만든다
  if (!doc || doc.room !== room) {
    try {
      await request(`${DOCS}:commit?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${me.token}` },
        body: JSON.stringify({
          writes: [{
            update: { name: `${PATH}/${HANDLES}/${handle}`, fields: { uid: { stringValue: me.uid }, room: { stringValue: room } } },
            currentDocument: { exists: false },
          }],
        }),
      });
    } catch (err) {
      const now = err.reason === 'denied' ? await readHandle(handle).catch(() => null) : null;
      if (now && now.uid !== me.uid) throw new CloudError('taken', handle);
      throw err;
    }
  }
  remember({ handle });
  if (old) await deleteHandle(old, me).catch(err => console.warn('예전 아이디를 지우지 못했다', err));
  return handle;
});

// 공유하기 창의 "아이디 지우기". 서버의 아이디 문서를 지우고 잊는다. 지운 아이디는 다른 사람이 정할 수 있다.
export const dropHandle = () => queue(async () => {
  const handle = myHandle();
  if (!handle) return;
  const me = await auth();
  await deleteHandle(handle, me);
  remember({ handle: null });
});

// ---------- 쪽지(코르크 보드 방명록) ----------
// 쪽지는 방 문서 아래 homes/{방 번호}/notes/{쪽지 번호}에 둔다. 서버에 방이 있어야 붙일 수 있어서, 짧은 링크를 만든 방에만 붙는다.
// 읽기는 로그인 없이 최근 것부터 몇 장씩 한다. Firestore는 받은 문서마다 읽기를 세므로 보드를 열 때만 읽는다.
// 붙이기와 지우기는 익명 로그인으로 한다. 규칙이 쓴 사람(uid)과 방 주인에게만 지우기를 허락한다.
// 받은 쪽지는 누구든 쓸 수 있는 값이므로, 쓰는 쪽(src/apps/corkboard-app.js)이 글자 수를 다시 줄이고 h()의 자식(글자)으로만 넣는다.

// 서버 문서 하나를 쪽지 { id, uid, name, text, color, at }로 바꾼다. at은 붙인 시각(서버의 ISO 글자)이다
function toNote(doc) {
  const f = doc.fields || {};
  return {
    id: doc.name.slice(doc.name.lastIndexOf('/') + 1),
    uid: f.uid?.stringValue || '',
    name: f.name?.stringValue || '',
    text: f.text?.stringValue || '',
    color: Number(f.color?.integerValue ?? 0),
    at: f.createdAt?.timestampValue || '',
  };
}

// 쪽지를 최근 것부터 limit장 받는다. after(받아 둔 쪽지)를 주면 그보다 먼저 붙은 쪽지부터 받는다.
// 붙인 시각이 같은 쪽지가 페이지 끝에서 빠지지 않게 쪽지 번호(__name__)로도 줄 세운다.
async function queryNotes(homeId, limit, after = null) {
  const structuredQuery = {
    from: [{ collectionId: NOTES }],
    orderBy: [
      { field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' },
      { field: { fieldPath: '__name__' }, direction: 'DESCENDING' },
    ],
    limit,
  };
  if (after) {
    structuredQuery.startAt = {
      values: [{ timestampValue: after.at }, { referenceValue: `${PATH}/${HOMES}/${homeId}/${NOTES}/${after.id}` }],
      before: false, // 그 쪽지 바로 다음부터
    };
  }
  const rows = await request(`${DOCS}/${HOMES}/${homeId}:runQuery?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
  });
  return (Array.isArray(rows) ? rows : []).filter(r => r.document).map(r => toNote(r.document));
}

// 보드에 붙일 쪽지를 한 장(NOTE.page장) 받는다. 한 장을 더 받아 보고 그보다 먼저 붙은 쪽지가 남았는지(more) 알린다.
export async function fetchNotes(homeId, after = null) {
  const notes = await queryNotes(homeId, NOTE.page + 1, after);
  return { notes: notes.slice(0, NOTE.page), more: notes.length > NOTE.page };
}

// 쪽지를 붙이고 붙인 쪽지를 돌려준다. 규칙이 createdAt에 서버 시각만 받으므로 방처럼 commit의 updateTransforms(REQUEST_TIME)로 쓴다.
// currentDocument.exists: false로 같은 번호의 쪽지가 이미 있으면 덮어쓰지 않고 실패하게 한다.
export async function postNote(homeId, { name, text, color }) {
  const me = await auth();
  const id = randomId(NOTE_ID_LENGTH);
  const res = await request(`${DOCS}:commit?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${me.token}` },
    body: JSON.stringify({
      writes: [{
        update: {
          name: `${PATH}/${HOMES}/${homeId}/${NOTES}/${id}`,
          fields: { uid: { stringValue: me.uid }, name: { stringValue: name }, text: { stringValue: text }, color: { integerValue: String(color) } },
        },
        currentDocument: { exists: false },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
      }],
    }),
  });
  remember({ nick: name });
  const at = res?.writeResults?.[0]?.transformResults?.[0]?.timestampValue || res?.commitTime || new Date().toISOString();
  return { id, uid: me.uid, name, text, color, at };
}

// 쪽지를 지운다. 규칙이 쓴 사람과 방 주인에게만 허락한다(이미 지워진 쪽지는 그대로 성공한다).
export async function removeNote(homeId, noteId) {
  const me = await auth();
  await request(`${DOCS}/${HOMES}/${homeId}/${NOTES}/${noteId}?key=${API_KEY}`, { method: 'DELETE', headers: { Authorization: `Bearer ${me.token}` } });
}

// 이 브라우저의 익명 사용자 번호. 로그인한 적이 없으면 null. 손님이 보드에서 자기가 붙인 쪽지를 알아보는 데 쓴다
export const myUid = () => state().uid || null;

// 손님으로 쪽지를 붙일 때 마지막으로 쓴 닉네임(다음 쪽지의 닉네임 칸에 미리 넣는다)
export const lastNick = () => (typeof state().nick === 'string' ? state().nick : '');

// 이름을 바꿀 때(src/user-name.js) 쪽지에 쓴 닉네임이 예전 이름이면 새 이름으로 바꾼다.
// 그대로 두면 예전 이름(실명일 수 있다)이 다음 쪽지의 닉네임 칸에 다시 들어간다. 다른 닉네임을 써 왔으면 그대로 둔다
export function renameNick(from, to) {
  if (state().nick === from) remember({ nick: to });
}

// 주인이 마지막으로 본 쪽지의 시각(밀리초). 보드를 열어 가장 최근 쪽지를 받으면 그 시각을 남긴다.
export const notesSeenAt = () => Number(state().seen) || 0;
export function markNotesSeen(at) {
  const t = Date.parse(at);
  if (t > notesSeenAt()) remember({ seen: t });
}

// 내 방(짧은 링크)에 가장 최근 붙은 쪽지의 시각(밀리초). 쪽지가 없으면 0. 한 장만 읽는다(내 컴퓨터로 들어올 때 한 번).
// 이 값이 notesSeenAt()보다 크면 주인이 아직 보지 않은 쪽지가 있다.
export async function latestNoteAt() {
  const id = sharedId();
  if (!id) return 0;
  const [latest] = await queryNotes(id, 1);
  return latest ? Date.parse(latest.at) || 0 : 0;
}

// 서버의 방을 지우기 전에 그 방의 쪽지를 먼저 지운다. 방 문서가 없어지면 규칙이 주인을 알아보지 못해 남은 쪽지를 지울 수 없다.
// 한 요청에 10장씩 지운다. 규칙이 쪽지마다 방 문서를 한 번 읽는데, 한 요청이 읽을 수 있는 문서는 20개까지다.
async function clearNotes(homeId, me) {
  for (let round = 0; round < 50; round++) {
    const notes = await queryNotes(homeId, 30);
    for (let i = 0; i < notes.length; i += 10) {
      await request(`${DOCS}:commit?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${me.token}` },
        body: JSON.stringify({ writes: notes.slice(i, i + 10).map(n => ({ delete: `${PATH}/${HOMES}/${homeId}/${NOTES}/${n.id}` })) }),
      });
    }
    if (notes.length < 30) return;
  }
}

// ---------- 고친 방 따라 올리기 ----------
// 짧은 링크를 만든 뒤에는 방을 고칠 때마다(os.saveHome) 서버의 방도 고쳐서, 같은 링크가 늘 지금 방을 보여 준다.
// 고칠 때마다 올리지 않고 SYNC_DELAY 동안 더 고치지 않을 때 한 번 올린다. 마지막으로 올린 글자와 같으면 올리지 않는다.
let timer = 0;
let pending = null; // 올릴 방 글자를 만드는 함수

function flush() {
  clearTimeout(timer);
  const make = pending;
  pending = null;
  if (!make || !sharedId()) return Promise.resolve();
  const code = make();
  if (code === state().sent) return Promise.resolve();
  return queue(() => upload(code));
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

// 탭을 닫거나 다른 탭으로 갈 때 기다리던 것을 바로 올린다. 탭을 닫는 중이면 요청이 끊길 수 있는데,
// 그때는 다음에 내 컴퓨터로 들어올 때 다시 올린다(src/os.js의 enter). fetch의 keepalive는 쓰지 않는다.
// 파이어폭스가 2024년 말에야 지원해 Baseline 널리 사용 가능이 아니고(docs/checklists.md의 "사파리와 파이어폭스에서도 볼 때"), 다음에 올리는 길이 이미 있다.
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && pending) flush().catch(() => {});
});
