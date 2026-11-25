// 서버(Firebase의 Firestore)에 공유한 방을 두고, 짧은 링크(#s=<번호 8글자>)에는 번호만 담는다.
// SDK 없이 Firestore와 Firebase 인증의 REST 주소를 fetch로 부른다. SDK는 첫 화면을 무겁게 하고 localStorage에 자기 이름의 키를 쓴다.
//   읽기: 로그인 없이 GET 한 번. 짧은 링크로 온 손님은 이것만 한다.
//   쓰기: 익명 로그인(가입 없이 브라우저마다 하나 생기는 사용자)의 토큰으로 한다. 서버의 규칙이 방을 처음 올린 사용자만 고치고 지우게 한다.
// 같은 서버에 코르크 보드 방명록의 쪽지도 둔다(아래 "쪽지"). 쪽지는 짧은 링크를 만든 방에만 붙는다.
// 링크를 만든 사람이 원하면 방에 아이디를 달아, 친구가 이웃집 목록 창에서 아이디를 쳐서 찾아오게 한다(아래 "아이디").
// 아이디를 정한 사람이 원하면 비밀번호도 정해, 다른 브라우저에서 아이디와 비밀번호로 로그인해 같은 방을 고친다(아래 "비밀번호", F36).
// 규칙은 레포 맨 위의 firestore.rules에 있고, Firebase 콘솔에 게시한 규칙과 같아야 한다(known-issues 59).
// API_KEY는 Firebase 웹 설정의 값이라 원래 웹페이지에 공개된다. 데이터는 규칙이 지킨다(AGENTS.md의 "공개 레포").
// 이 컴퓨터에 남기는 것: { uid, refresh: 익명 로그인, id: 올린 방의 번호, sent: 마지막으로 올린 방 글자, handle: 그 방에 단 아이디,
//   nick: 손님으로 쪽지를 붙일 때 마지막으로 쓴 닉네임, seen: 주인이 마지막으로 본 쪽지의 시각(밀리초),
//   lost: 더는 고칠 수 없어 잊은 방 { id, uid, handle, why: 잊은 까닭, at: 잊은 시각, told: 주인이 안내를 닫았는지 },
//   pw: 비밀번호가 있는 사용자인지(F36). 아래 세 칸은 pw가 참일 때만 남긴다(아래 "겹쳐 쓰기 막기"),
//   rev: 서버 방 문서의 마지막 updateTime, edited: 이 브라우저에서 방을 마지막으로 고친 시각(밀리초), trying: 올리는 중인 방 글자,
//   linking: 비밀번호를 붙이는 요청을 보냈는데 됐는지 아직 모름, out: 로그인이 풀려 비밀번호로 다시 로그인해야 함(둘 다 아래 "비밀번호") }
// 비밀번호가 없는 사용자는 방을 고칠 권한이 여기 남긴 익명 로그인뿐이라 잊으면 되찾을 길이 없다. 서버가 잠깐 거절한 것으로는 잊지 않는다(아래 forget, known-issues 119).
// 비밀번호는 요청에만 싣는다. 저장소, 주소, 콘솔, 오류 글 어디에도 남기지 않는다.
import { STORAGE_CLOUD } from './config.js';
import { sameCode } from './room-merge.js';
import { seat, movedFrom } from './seat.js';
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
//   offline: 연결이 안 되거나 답이 늦음, missing: 그런 문서가 없음, denied: 규칙이 막음(Firestore가 PERMISSION_DENIED라고 답한 것만),
//   busy: 하루 무료 한도를 다 씀, server: 서버 오류와 그 밖의 거절(토큰이 잠깐 안 맞은 401, 겹쳐 쓴 409, 학교나 백신의 차단 화면. 다시 해 볼 일이다),
//   taken: 다른 사람이 먼저 정한 아이디(claimHandle), lost: 이 컴퓨터가 올린 방을 더는 고칠 수 없어 번호를 잊음(forget),
//   changed: 서버의 방이 다른 브라우저에서 바뀌어 올리지 않음, removed: 다른 브라우저에서 링크를 지움(둘 다 아래 "겹쳐 쓰기 막기"가 따로 알린다),
//   wrong: 아이디나 비밀번호가 틀림, locked: 비밀번호를 여러 번 틀려 인증 서버가 잠깐 막음, signedout: 로그인이 풀려 비밀번호로 다시 로그인해야 함,
//   noroom: 로그인한 아이디가 가리키는 방이 서버에 없음, unsure: 비밀번호가 바뀌었는지 알 수 없음(모두 아래 "비밀번호"),
//   moved: 다른 탭에서 사용자가 바뀌어 하지 않음(src/seat.js. 따로 알린다)
// status는 HTTP 상태(답을 못 받았으면 0), code는 서버의 오류 글자다(Firestore는 error.status, 인증은 error.message의 첫 낱말. 없으면 빈 글자)
export class CloudError extends Error {
  constructor(reason, detail, { status = 0, code = '' } = {}) {
    super(`${reason}: ${detail}`);
    this.reason = reason;
    this.status = status;
    this.code = code;
  }
}

const state = () => loadJSON(STORAGE_CLOUD) || {};
const remember = patch => saveJSON(STORAGE_CLOUD, { ...state(), ...patch }); // 값이 undefined인 칸은 지워진다(JSON에 담기지 않는다)
// 서버의 답을 기다린 뒤에 남길 때 쓴다. 그사이에 이 컴퓨터의 계정이 바뀌었으면(로그인, 빼기, 초기화) 앞 계정의 값을 섞지 않는다
const rememberFor = (me, patch) => {
  if (state().uid === me.uid) remember(patch);
};

async function request(url, opts = {}) {
  let res;
  try {
    res = await fetch(url, { ...opts, signal: AbortSignal.timeout?.(TIMEOUT) });
  } catch (err) {
    throw new CloudError('offline', err.message);
  }
  const { status } = res;
  const body = await res.json().catch(() => null);
  if (res.ok && body) return body;
  const firestore = url.startsWith(DOCS);
  const error = (Array.isArray(body) ? body[0] : body)?.error; // runQuery는 오류도 배열에 담아 답한다
  const code = String((firestore ? error?.status : error?.message) ?? '').match(/^[A-Z_]+/)?.[0] || '';
  const reason = status === 404 ? 'missing' : status === 429 ? 'busy' : firestore && status === 403 && code === 'PERMISSION_DENIED' ? 'denied' : 'server';
  if (status === 401) session = null; // 토큰이 맞지 않는다. 다음에 할 때 토큰을 새로 받는다
  throw new CloudError(reason, error?.message || `HTTP ${status}`, { status, code });
}

// ---------- 익명 로그인 ----------
// 토큰은 한 시간짜리라 메모리에만 두고, 다시 받을 때 쓰는 refresh 토큰을 저장한다. 동시에 불려도 계정을 둘 만들지 않게 받는 중인 일을 같이 쓴다.
let session = null; // { token, uid, until }
let signing = null;
let kept = true; // 로그인한 계정을 저장소에 남길 수 있었는지. 저장소를 못 쓰는 환경이면 false다
// 인증 서버가 계정이 정말 없어졌다고 답하는 글자. 이 밖의 실패(차단 화면의 403 같은 것)에서는 계정을 잊지 않고 다음에 다시 한다
const GONE = ['TOKEN_EXPIRED', 'USER_DISABLED', 'USER_NOT_FOUND', 'INVALID_REFRESH_TOKEN'];

const tokenOf = (token, uid, seconds) => ({ token, uid, until: Date.now() + (Number(seconds) - 60) * 1000 });
// 인증 서버(Identity Toolkit)에 하는 일. 답의 토큰까지 받는다
const identity = (what, body = {}) => request(`https://identitytoolkit.googleapis.com/v1/accounts:${what}?key=${API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...body, returnSecureToken: true }),
});

async function signIn() {
  const { uid, refresh } = state();
  if (signedOut() || (hasLogin() && !refresh)) throw loggedOut(''); // 비밀번호가 있으면 어떤 경우에도 새 익명 계정을 만들지 않는다
  if (refresh) {
    try {
      const r = await request(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refresh)}`,
      });
      // 기다리는 사이에 이 컴퓨터의 계정이 바뀌었으면 받은 토큰을 남기지도 쓰지도 않는다. 같은 계정의 토큰만 새로 받았으면(비밀번호 만들기) 그것을 예전 것으로 덮지 않는다
      if (state().uid !== uid) throw new CloudError('server', '기다리는 사이에 로그인이 바뀌었다');
      if (state().refresh === refresh) remember({ uid: r.user_id, refresh: r.refresh_token });
      kept = state().uid === r.user_id;
      return tokenOf(r.id_token, r.user_id, r.expires_in);
    } catch (err) {
      // 기다리는 사이에 다른 탭이 로그인을 바꿨으면 그것을 지우지 않고 다음에 다시 한다
      if (!GONE.includes(err.code) || state().refresh !== refresh) throw err;
      // 비밀번호가 있으면(붙이는 중이었으면 아마 붙었다) 계정은 그대로이고 이 브라우저의 로그인만 풀린 것이다
      if (hasLogin()) throw loggedOut(err.code);
      // 익명 계정이 지워졌다. 새 계정은 예전 방과 아이디를 고칠 수 없으므로 방 번호와 아이디도 잊는다(다음에 공유하면 새 번호가 생긴다).
      forget(err.code, { uid: null, refresh: null });
    }
  }
  const before = state().uid;
  const r = await identity('signUp');
  if (state().uid !== before) throw new CloudError('server', '기다리는 사이에 로그인이 바뀌었다');
  remember({ uid: r.localId, refresh: r.refreshToken });
  kept = state().uid === r.localId;
  return tokenOf(r.idToken, r.localId, r.expiresIn);
}

// 저장해 둔 계정이 메모리의 로그인과 달라졌으면 메모리의 것을 버리고 다시 로그인한다. "이 컴퓨터 초기화"로 저장소를 지웠거나
// 다른 탭이 새 계정을 만든 경우다. 버리지 않으면 지워진 계정으로 방을 올리고 저장소에는 그 계정이 남지 않아서,
// 새로 고침한 뒤에는 새 계정이 그 방을 고치지도 지우지도 못한다(known-issues 61).
async function auth() {
  if (session && kept && state().uid !== session.uid) session = null;
  if (session && Date.now() < session.until) return session;
  signing ||= signIn().finally(() => { signing = null; });
  const me = await signing;
  if (kept && state().uid !== me.uid) throw new CloudError('server', '기다리는 사이에 로그인이 바뀌었다');
  session = me;
  return me;
}

// 내 방(번호 id)에 하는 일의 로그인. 로그인하는 사이에 사용자나 방이 바뀌었으면(stamp, 아래 checkStamp) 멈추고,
// 로그인하다가 계정이 없어져 번호를 잊었으면(signIn) 새 계정으로 하던 일을 잇지 않고 멈춘다.
async function authFor(id, stamp) {
  const me = await auth();
  checkStamp(stamp);
  if (id && state().id !== id) throw new CloudError('lost', id);
  return me;
}

// 이 컴퓨터가 올린 방의 번호와 아이디를 잊는다. 주인이 모르는 사이에 예전 링크와 이웃집이 옛 방에 멈추지 않게 알린다
// (onLost를 받은 src/os.js가 창을 띄운다). 왜 잊었는지는 나중에 찾을 수 있게 lost에 남긴다.
let tellLost = () => {};
export const onLost = fn => { tellLost = fn; };
function forget(why, patch = {}) {
  const { id, uid, handle } = state();
  const lost = id ? { lost: { id, uid: uid || null, handle: handle || null, why, at: new Date().toISOString(), told: false } } : {};
  remember({ ...patch, ...noRoom(), handle: null, ...lost });
  if (id) tellLost();
}
// 올린 방을 잊을 때 비울 칸. 비밀번호가 있는 사용자의 칸(rev, trying)은 그 사용자에게만 있다
const noRoom = () => ({ id: null, sent: null, ...(state().pw ? { rev: null, trying: null } : {}) });

// 잊었지만 주인이 아직 안내를 닫지 않은 방(위의 lost). 없으면 null
export function lostRoom() {
  const { lost } = state();
  return lost && !lost.told ? lost : null;
}
export function markLostTold() {
  const lost = lostRoom();
  if (lost) remember({ lost: { ...lost, told: true } });
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

// 이 컴퓨터에 앉은 사용자의 방과 계정에 하는 일은 시킨 때(stamp)를 적어 두었다가 할 때 견준다.
//   at: 그때의 자리 표시(src/seat.js). 다른 탭에서 사용자가 바뀌었으면 하지 않고 알린다(onMoved). 하면 앞 사용자의 방을 뒤 사용자의 계정으로 올린다
//   turn: 이 탭에서 방을 통째로 바꾼 횟수(epoch). 서버의 방으로 바꾸거나 다른 아이디로 로그인한 뒤에 예전 방 글자를 올리지 않는다(known-issues 127)
let epoch = 0;
let tellMoved = () => {};
export const onMoved = fn => { tellMoved = fn; };
const stampNow = () => ({ at: seat(), turn: epoch });
function checkStamp({ at, turn }) {
  if (movedFrom(at)) {
    tellMoved();
    throw new CloudError('moved', '다른 탭에서 사용자가 바뀌었다');
  }
  if (turn !== epoch) throw new CloudError('changed', '방이 바뀌기 전에 시킨 일이다');
}
// 내 방과 계정에 하는 일을 줄 세운다. 예약한 올리기는 예약한 때의 stamp를 따로 넘긴다(flush)
const queueMine = (job, stamp = stampNow()) => queue(() => {
  checkStamp(stamp);
  return job(stamp);
});

// 서버의 방을 올린 사용자 번호. 알 수 없으면(방이 없음, 연결 실패) 빈 글자다
async function roomOwner(id) {
  const doc = await request(`${DOCS}/${HOMES}/${id}?key=${API_KEY}`).catch(() => null);
  return doc?.fields?.uid?.stringValue || '';
}

// 방 글자를 올리고 번호를 돌려준다. 올려 둔 번호가 있으면 같은 번호의 방을 고친다. 없으면 create일 때만 새 번호로 만들고, 아니면 올리지 않고 null을 돌려준다.
// 새 번호는 주인이 "링크 만들기"를 누를 때만 만든다. 따라 올리다가 만들면 주인이 모르는 사이에 링크가 바뀐다(known-issues 119).
// stamp: 방 글자를 만든 때(위의 stampNow). 그 뒤에 사용자나 방이 바뀌었으면 올리지 않는다.
async function upload(code, create, stamp) {
  if (code.length > MAX_CODE) throw new CloudError('denied', `방 글자가 ${MAX_CODE}자를 넘는다`);
  const old = state().id;
  if (!old && !create) return null;
  const me = await authFor(old, stamp);
  if (old && hasPassword()) return uploadGuarded(old, code, me, stamp);
  const id = old || newId();
  let res;
  try {
    res = await writeHome(id, code, me);
  } catch (err) {
    throw await blame(err, old, me);
  }
  rememberFor(me, { id, sent: code, ...(hasPassword() ? { rev: revOf(res), trying: null } : {}) });
  return id;
}

// 방 글자를 서버에 쓴다. 규칙이 updatedAt에 서버 시각만 받으므로 PATCH가 아니라 commit의 updateTransforms(REQUEST_TIME)로 쓴다.
// rev를 주면 서버의 방이 그 판 그대로일 때만 쓴다(아래 "겹쳐 쓰기 막기").
const writeHome = (id, code, me, rev = null) => request(`${DOCS}:commit?key=${API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${me.token}` },
  body: JSON.stringify({
    writes: [{
      update: {
        name: `${PATH}/${HOMES}/${id}`,
        fields: { uid: { stringValue: me.uid }, code: { stringValue: code } },
      },
      updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
      ...(rev ? { currentDocument: { updateTime: rev } } : {}),
    }],
  }),
});

// 올리기가 실패한 까닭을 고른다. 규칙이 막았어도 바로 잊지 않고 서버의 방을 다시 읽어, 다른 사용자가 올린 방일 때만 번호를 잊는다(그 방에 단 아이디도 이 사용자의 것이 아니다).
// 내 방이거나 주인을 알 수 없으면 올린 값이나 규칙의 문제라서 다음에 다시 올린다. 읽는 사이에 다른 탭이 번호를 바꿨으면 그것은 잊지 않는다.
async function blame(err, old, me) {
  const owner = err.reason === 'denied' && old ? await roomOwner(old) : '';
  if (!owner || owner === me.uid || state().id !== old) return err;
  forget('OTHER_OWNER');
  return new CloudError('lost', old, err);
}

// ---------- 겹쳐 쓰기 막기(F36) ----------
// 같은 사용자의 방을 두 브라우저에서 고치면 나중에 올린 쪽이 먼저 올린 것을 조용히 덮는다. 비밀번호가 있는 사용자(pw)는 여러 브라우저에서 로그인하므로,
// 서버의 방이 마지막으로 본 판(rev, 문서의 updateTime) 그대로일 때만 올린다(commit의 currentDocument). 비밀번호가 없는 사용자는 보내는 요청이 전과 같다.
// 거절되면 서버의 방을 다시 읽어 가린다.
//   서버의 글자가 올리던 글자(trying)와 같다: 답을 잃었을 뿐 이미 올라간 내 올리기다. sent와 rev를 맞추고 이어서 올린다
//   서버의 방이 마지막에 올린 방(sent)과 같다: 누가 같은 방을 다시 올렸을 뿐이다. rev만 맞춘다
//   문서가 없다: 다른 브라우저에서 링크를 지웠다. 같은 번호로 다시 만들지 않고 방 번호를 잊는다(removed)
//   그 밖: 다른 브라우저에서 고쳤다. 올리기를 멈추고 세 갈래 비교(src/room-merge.js)로 넘긴다(changed, src/home-sync.js)
export const hasPassword = () => state().pw === true;

// 이 브라우저에서 방을 마지막으로 고친 시각(밀리초). 모르면 0이다
export const lastEdited = () => Number(state().edited) || 0;
// 방을 고쳤다고 남긴다(src/os.js의 saveHome). 두 곳에서 고친 방 창이 보인다
export const markEdited = () => {
  if (hasPassword()) remember({ edited: Date.now() });
};

export const sentCode = () => state().sent || '';
const currentRev = () => state().rev || null;
const revOf = res => res?.writeResults?.[0]?.updateTime || null;

const TRIES = 4; // 서버의 방을 읽는 것과 쓰는 것을 합쳐 해 보는 횟수(거절되면 읽고 다시 쓴다)
let paused = false; // 주인이 어느 방을 남길지 아직 고르지 않았거나 서버의 방을 풀 수 없어 올리기를 멈췄는지
let tellServer = () => {}; // 서버의 방이 다르다고 알리는 곳
let tellRemoved = () => {}; // 다른 브라우저에서 링크를 지웠다고 알리는 곳
export const onServerRoom = fn => { tellServer = fn; };
export const onRemoved = fn => { tellRemoved = fn; };
// 올리기를 멈추거나(true) 다시 한다(false). 멈춘 동안의 고침은 고른 뒤나 내 컴퓨터로 다시 들어올 때 올린다
export function pauseSync(on) {
  paused = on;
  if (!on) return;
  pending = null;
  clearTimeout(timer);
}

// 올리기가 "서버의 방이 달라졌다"로 거절되었는지. 문서가 없을 때의 404는 Firestore가 답한 것만 본다(학교 차단 화면의 404는 아니다, known-issues 119)
const refused = err => err.code === 'FAILED_PRECONDITION' || (err.status === 404 && err.code === 'NOT_FOUND');

// 서버의 방 문서 { uid, code, rev }. 문서가 없으면 null, 닿지 못하면 CloudError를 던진다. 읽기는 로그인 없이 한다
async function readRoom(id) {
  let doc;
  try {
    doc = await request(`${DOCS}/${HOMES}/${id}?key=${API_KEY}`);
  } catch (err) {
    if (err.status === 404 && err.code === 'NOT_FOUND') return null;
    throw err;
  }
  return { uid: doc?.fields?.uid?.stringValue || '', code: doc?.fields?.code?.stringValue || '', rev: doc?.updateTime || null };
}
// 서버에 있는 내 방 문서 { code, rev }. 문서가 없으면 null, 이 사용자의 방이 아니면 CloudError를 던진다
async function fetchMine() {
  const { id, uid } = state();
  const doc = id ? await readRoom(id) : null;
  if (!doc) return null;
  if (doc.uid !== uid) throw new CloudError('denied', `${id}는 이 사용자의 방이 아니다`);
  return { code: doc.code, rev: doc.rev };
}
// 내 방을 서버에서 읽는다(부팅할 때, 내 컴퓨터로 들어올 때). 올리던 일이 있으면 그 뒤에 읽는다.
// 돌려주는 것: { id: 읽은 방 번호, theirs: 서버의 방(문서가 없으면 null), seen: 읽은 때 알던 판 }. 그 뒤에 이 컴퓨터가 방을 올렸으면 낡은 값이다(isFresh)
export const readMine = () => queue(async () => ({ id: sharedId(), theirs: await fetchMine(), seen: currentRev() }));
export const isFresh = got => got.id === sharedId() && got.seen === currentRev();
// 서버의 방이 이 컴퓨터가 마지막으로 본 판 그대로인지
export const isKnown = theirs => !!theirs.rev && theirs.rev === currentRev();

// 서버의 방이 답을 잃었던 내 올리기면 sent와 rev를 맞춘다. 올라간 것이 맞으면 true다
export function landed(theirs) {
  const { trying } = state();
  if (!trying || theirs.code !== trying) return false;
  remember({ sent: theirs.code, rev: theirs.rev, trying: null });
  return true;
}

// 예약하거나 줄 세운 올리기를 버린다. 예약은 그때의 집 객체를 쥐고 있어서, 방이나 사용자가 바뀐 뒤에 올리면 예전 방이 서버의 방을 덮는다(known-issues 127)
export function dropUploads() {
  epoch++;
  pending = null;
  clearTimeout(timer);
  paused = false;
}

// 서버의 방을 이 컴퓨터의 바탕으로 삼는다(비교가 끝났다). 올리던 예전 글자는 버린다. 방을 서버의 방으로 바꿨으면(adopted) 고친 시각을 모른다고 본다
export function acceptServer(theirs, adopted = false) {
  dropUploads();
  remember({ sent: theirs.code, rev: theirs.rev, trying: null, ...(adopted ? { edited: null } : {}) });
}

// 다른 브라우저에서 링크를 지운 방의 번호를 잊는다. 아이디도 그쪽에서 지웠다. 계정과 비밀번호는 그대로다.
// 이 컴퓨터가 올린 방을 더는 고칠 수 없게 된 것(forget)이 아니라서 "공유 링크 끊김" 창은 띄우지 않는다
export function forgetRemoved() {
  remember({ ...noRoom(), handle: null });
  tellRemoved();
}

async function uploadGuarded(id, code, me, stamp) {
  // 서버의 답을 기다린 뒤마다 본다. 그사이에 사용자나 방이 바뀌었으면 여기서 멈춘다(바뀐 사용자의 칸에 적지 않는다)
  const still = () => {
    checkStamp(stamp);
    if (state().uid !== me.uid || state().id !== id) throw new CloudError('lost', id);
  };
  for (let i = 0; i < TRIES; i++) {
    if (paused) throw new CloudError('changed', '서버의 방과 다시 견줘야 한다');
    still();
    const { trying, sent, rev } = state();
    // 앞의 올리기의 답을 잃었거나(trying) 서버의 방을 본 적이 없으면(rev) 먼저 읽는다
    if (trying || !rev) {
      let theirs;
      try {
        theirs = await fetchMine();
      } catch (err) {
        throw await blame(err, id, me); // 남의 방이면(denied) 번호를 잊는다
      }
      still();
      if (!theirs) {
        forgetRemoved();
        throw new CloudError('removed', id);
      }
      if (landed(theirs)) {
        if (theirs.code === code) return id;
      } else if (sameCode(theirs.code, sent)) {
        remember({ sent: theirs.code, rev: theirs.rev, trying: null });
      } else {
        remember({ trying: null });
        paused = true;
        tellServer(theirs);
        throw new CloudError('changed', id);
      }
      continue; // 맞춘 rev로 다시 올린다
    }
    remember({ trying: code });
    try {
      const res = await writeHome(id, code, me, rev);
      still();
      remember({ sent: code, rev: revOf(res), trying: null });
      return id;
    } catch (err) {
      if (!refused(err)) throw await blame(err, id, me); // trying은 남긴다(답을 잃었을 수 있다)
    }
  }
  throw new CloudError('server', '서버의 방이 계속 바뀐다');
}

// 공유하기 창의 "링크 만들기". 방을 올리고 번호를 돌려준다.
export const share = code => queueMine(stamp => upload(code, true, stamp));

// 서버의 방과 그 방에 붙은 쪽지, 방에 단 아이디를 지우고 번호를 잊는다. 이미 보낸 짧은 링크는 더는 열리지 않는다.
// 아이디를 먼저 지운다. 방만 지우면 아이디가 없는 방을 가리킨 채 남아 다른 사람이 그 아이디를 정하지 못한다.
// 이웃집에 고정한 방(data/neighbors.js의 keep)은 지우지 않는다. 부르는 쪽(로그인 화면의 이 컴퓨터 초기화, 공유하기의 링크 지우기)이
// 먼저 src/neighbors.js의 pinnedHere()를 보고 막는다(이 파일이 neighbors.js를 부르면 서로 부르게 되어 여기서는 보지 않는다). tools/check.py가 부르는 파일에 pinnedHere가 있는지 본다.
export function unshare() {
  return queueMine(async stamp => {
    const { id, handle } = state();
    if (!id) return;
    const me = await authFor(id, stamp);
    if (handle) await deleteHandle(handle, me);
    rememberFor(me, { handle: null });
    try {
      await clearNotes(id, me);
      await request(`${DOCS}/${HOMES}/${id}?key=${API_KEY}`, { method: 'DELETE', headers: { Authorization: `Bearer ${me.token}` } });
    } catch (err) {
      if (err.reason !== 'denied') throw err; // denied: 이미 없거나 이 사용자의 방이 아니다. 어느 쪽이든 번호만 잊는다
    }
    rememberFor(me, noRoom());
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

// 서버의 아이디 문서 { uid, room }. 그런 아이디가 없으면 null(Firestore가 NOT_FOUND라고 답한 404만. 차단 화면의 404는 닿지 못한 것이다). 받은 값은 누구든 쓸 수 있는 값이라 모양을 본다
async function readHandle(handle) {
  try {
    const doc = await request(handleUrl(handle));
    const f = doc?.fields || {};
    return { uid: f.uid?.stringValue || '', room: f.room?.stringValue || '' };
  } catch (err) {
    if (err.status === 404 && err.code === 'NOT_FOUND') return null;
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
export const claimHandle = handle => queueMine(async stamp => {
  const room = state().id;
  if (!room || !HANDLE_RE.test(handle)) throw new CloudError('denied', '올린 방이 없거나 아이디의 꼴이 틀렸다');
  const old = myHandle();
  if (old === handle) return handle;
  const me = await authFor(room, stamp);
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
      // 남이 먼저 정한 아이디면 규칙이 막거나(denied) 이미 있다는 409(ALREADY_EXISTS)가 온다
      const now = err.reason === 'denied' || err.status === 409 ? await readHandle(handle).catch(() => null) : null;
      if (now && now.uid !== me.uid) throw new CloudError('taken', handle);
      throw err;
    }
  }
  rememberFor(me, { handle });
  if (old) await deleteHandle(old, me).catch(err => console.warn('예전 아이디를 지우지 못했다', err));
  return handle;
});

// 이 사용자가 그 아이디를 정할 수 있는지. 아무도 쓰지 않거나 이미 이 사용자가 정한 것이면 된다.
// 방을 올리기 전에 본다(비밀번호 만들기). 남이 쓰는 아이디인 줄 모르고 방부터 올리지 않게 한다
export async function handleFree(handle) {
  const doc = await readHandle(handle);
  return !doc || doc.uid === state().uid;
}

// 공유하기 창의 "아이디 지우기". 서버의 아이디 문서를 지우고 잊는다. 지운 아이디는 다른 사람이 정할 수 있다.
export const dropHandle = () => queueMine(async stamp => {
  const handle = myHandle();
  if (!handle) return;
  const me = await authFor(sharedId(), stamp);
  await deleteHandle(handle, me);
  rememberFor(me, { handle: null });
});

// ---------- 비밀번호(F36) ----------
// 아이디를 정한 사람이 원하면 비밀번호를 정한다. 지금 쓰는 익명 계정에 이메일과 비밀번호를 붙이므로 계정 번호(uid)와 방, 아이디는 그대로다.
// 이메일은 받지 않고, 이메일 자리에는 계정 번호로 만든 주소를 넣는다. 아이디는 바꾸거나 지울 수 있지만 계정 번호는 바뀌지 않고,
// 한번 붙인 이메일은 이 프로젝트에서 바꿀 수 없기 때문이다(이메일 열거 보호). .invalid는 어디에도 이어지지 않도록 정해 둔 이름이다(RFC 2606).
// 로그인은 아이디 문서(handles/{아이디})에서 계정 번호와 방 번호를 읽고, 그 번호로 만든 주소와 비밀번호로 한다.
// 남이 그 주소를 먼저 등록해 두었을 수 있어서, 로그인한 계정 번호와 방의 주인이 아이디를 정한 사람과 같은지 본다.
// 비밀번호를 붙이거나 바꾸면 그 전에 받은 refresh 토큰이 모두 끊긴다(TOKEN_EXPIRED, 2026-11-26 실제 서버에서 확인).
// 요청을 보낸 이 브라우저는 답으로 새 토큰을 받고, 다른 브라우저는 다음에 토큰을 받을 때 로그인이 풀린다(out).
// 로그인이 풀려도 방 번호와 계정은 잊지 않는다. 비밀번호로 다시 로그인할 때까지 올리기만 멈춘다.
const emailOf = uid => `u${Array.from(new TextEncoder().encode(uid), b => b.toString(16).padStart(2, '0')).join('')}@agaragoyo.invalid`;
export const MIN_PASSWORD = 6; // 인증 서버가 받는 가장 짧은 비밀번호

// 비밀번호로 로그인할 수 있는 계정인지. 붙이는 요청의 답을 잃은 계정(linking)도 아마 붙었다고 본다
const hasLogin = () => hasPassword() || !!state().linking;
// 로그인이 풀려 비밀번호로 다시 로그인해야 하는지
export const signedOut = () => !!state().out && hasLogin();
let tellOut = () => {};
export const onSignedOut = fn => { tellOut = fn; };
// 로그인이 풀렸다고 남기고 알린다. 던질 오류를 돌려준다
function loggedOut(why) {
  remember({ out: true });
  tellOut();
  return new CloudError('signedout', why || '비밀번호로 다시 로그인해야 한다');
}

// 인증 서버가 "하지 않았다"고 분명히 답하는 글자. 이 밖의 실패(연결 끊김, 5xx, 차단 화면)는 했는지 알 수 없다
const REFUSED = ['WEAK_PASSWORD', 'PASSWORD_DOES_NOT_MEET_REQUIREMENTS', 'EMAIL_EXISTS', 'INVALID_EMAIL', 'OPERATION_NOT_ALLOWED', 'ADMIN_ONLY_OPERATION',
  'CREDENTIAL_TOO_OLD_LOGIN_AGAIN', 'TOO_MANY_ATTEMPTS_TRY_LATER', 'QUOTA_EXCEEDED', 'USER_NOT_FOUND', 'USER_DISABLED'];
const WRONG = ['INVALID_LOGIN_CREDENTIALS', 'INVALID_PASSWORD', 'EMAIL_NOT_FOUND']; // 틀린 비밀번호와 없는 계정. 이 프로젝트는 첫째 하나로 답한다
const loginOf = r => ({ me: tokenOf(r.idToken, r.localId, r.expiresIn), refresh: r.refreshToken });

// 그 계정의 비밀번호로 로그인해 { me: 토큰과 계정 번호, refresh }를 받는다. 아무것도 남기지 않는다
async function passwordLogin(uid, password) {
  let login;
  try {
    login = loginOf(await identity('signInWithPassword', { email: emailOf(uid), password }));
  } catch (err) {
    if (WRONG.includes(err.code)) throw new CloudError('wrong', err.code, err);
    if (err.code === 'TOO_MANY_ATTEMPTS_TRY_LATER') throw new CloudError('locked', err.code, err);
    throw err;
  }
  if (login.me.uid !== uid) throw new CloudError('wrong', '남이 먼저 등록한 주소다');
  return login;
}

// 받은 로그인을 이 컴퓨터의 계정에 남긴다. 풀렸던 로그인과 붙이는 중 표시는 지운다
function keepLogin({ me, refresh }, patch = {}) {
  remember({ uid: me.uid, refresh, pw: true, out: undefined, linking: undefined, ...patch });
  session = me;
  kept = state().uid === me.uid;
}

// 지금 계정에 비밀번호를 붙인다(아이디와 비밀번호 창). 요청을 보내기 전에 붙이는 중이라고 남긴다(linking). 붙었는데 답을 잃으면 저장해 둔 토큰이 끊기는데,
// 이 표시가 없으면 signIn이 계정이 없어진 것으로 보고 방 번호와 계정을 잊는다. pw를 먼저 켜 두면 붙지 않았을 때 바꾸기만 보여 막히므로 표시를 따로 둔다.
// 답을 잃었으면 같은 비밀번호로 로그인해 보아 가린다. 그것도 안 되면 표시를 둔 채 실패를 알린다. 비밀번호가 있는 계정에 다시 붙여도 되므로 다시 하면 된다.
export const linkPassword = password => queueMine(async stamp => {
  if (hasPassword()) throw new CloudError('server', '다른 탭에서 이미 만들었다'); // 다시 붙이면 그 비밀번호가 조용히 바뀐다
  const { id, linking: unsure } = state();
  const me = await authFor(id, stamp);
  remember({ linking: true });
  let login;
  try {
    login = loginOf(await identity('signUp', { idToken: me.token, email: emailOf(me.uid), password }));
  } catch (err) {
    if (REFUSED.includes(err.code) && !(unsure && err.code === 'EMAIL_EXISTS')) { // 앞의 요청이 붙어 있으면 그 주소는 남의 것이 아니라 이 계정의 것일 수 있다
      if (!unsure) rememberFor(me, { linking: undefined, out: undefined }); // 앞에서 답을 잃은 요청이 있었으면 그 표시는 둔다
      throw err;
    }
    login = await passwordLogin(me.uid, password).catch(() => null);
    if (!login && ['TOKEN_EXPIRED', 'INVALID_ID_TOKEN'].includes(err.code)) {
      session = null;
      if (!unsure) { // 이 요청은 토큰 때문에 거절되어 붙지 않았다
        rememberFor(me, { linking: undefined });
        throw err;
      }
      checkStamp(stamp);
      throw loggedOut(err.code); // 앞에서 답을 잃은 요청이 다른 비밀번호로 붙어서 토큰이 끊겼다. 그 비밀번호로 다시 로그인해야 한다
    }
    if (!login) throw err;
  }
  checkStamp(stamp);
  if (login.me.uid !== me.uid) throw new CloudError('server', '다른 계정에 붙었다');
  keepLogin(login);
});

// 비밀번호를 바꾼다. 지금 비밀번호로 로그인한 토큰으로 바꾸고, 답으로 받은 새 토큰을 남긴다. 다른 브라우저의 로그인은 풀린다.
// 답을 잃었으면 새 비밀번호로 로그인해 보아 가린다. 그것도 닿지 못해 바뀌었는지 모르면 unsure다
export const changePassword = (now, next) => queueMine(async stamp => {
  const { uid } = state();
  const { me } = await passwordLogin(uid, now);
  let login;
  try {
    login = loginOf({ localId: uid, ...await identity('update', { idToken: me.token, password: next }) });
  } catch (err) {
    if (REFUSED.includes(err.code)) throw err;
    login = await passwordLogin(uid, next).catch(e => { throw e.reason === 'wrong' ? err : new CloudError('unsure', e.code, e); });
  }
  checkStamp(stamp);
  keepLogin(login);
});

// 로그인이 풀린 사용자가 비밀번호로 다시 로그인한다. 아이디는 그사이에 바뀌거나 남의 것이 되었을 수 있어서, 아이디 문서를 읽지 않고 저장해 둔 계정 번호로 한다.
// 방의 바탕(sent, rev)과 올리던 글자는 그대로 두고, 이어서 서버의 방과 맞춘다(src/home-sync.js의 again)
export const logBackIn = password => queueMine(async stamp => {
  const login = await passwordLogin(state().uid, password);
  checkStamp(stamp);
  keepLogin(login);
});

// 로그인 화면의 로그인. 그 아이디의 계정과 방을 받기만 하고 이 브라우저의 것은 하나도 바꾸지 않는다. 남기는 일은 adoptLogin과 rejoin이 한다.
// 돌려주는 것: { me, refresh, handle, room: 방 번호, code: 방 글자, rev }. 방 글자는 부르는 쪽이 decodeHome으로 검사한다.
// 아이디가 없거나 비밀번호가 틀렸거나, 로그인한 계정이나 방의 주인이 아이디를 정한 사람이 아니면 wrong, 방 문서가 없으면 noroom이다
export async function logIn(handle, password) {
  const doc = HANDLE_RE.test(handle) ? await readHandle(handle) : null;
  if (!doc?.uid || !ROOM_RE.test(doc.room)) throw new CloudError('wrong', '그런 아이디가 없다');
  const login = await passwordLogin(doc.uid, password);
  const theirs = await readRoom(doc.room);
  if (!theirs) throw new CloudError('noroom', '아이디가 가리키는 방이 없다');
  if (theirs.uid !== doc.uid) throw new CloudError('wrong', '아이디를 정한 사람의 방이 아니다');
  return { ...login, handle, room: doc.room, code: theirs.code, rev: theirs.rev };
}

// 로그인한 사용자를 이 컴퓨터의 사용자로 삼는다. 앞 사용자의 칸이 섞이지 않게 덧붙이지 않고 새로 쓴다.
// 앞 사용자의 것을 지우고 받은 방을 푸는 일은 부르는 쪽(src/sign-in.js)이 같은 때에 한다
export function adoptLogin({ me, refresh, handle, room, code, rev }) {
  dropUploads();
  saveJSON(STORAGE_CLOUD, { uid: me.uid, refresh, id: room, sent: code, handle, pw: true, rev });
  session = me;
  kept = state().uid === me.uid;
}

// 이 컴퓨터의 사용자가 로그인 화면에서 자기 아이디로 로그인했다(다시 로그인). 올리지 못한 고침이 사라지지 않게 방의 바탕과 올리던 글자는 그대로 둔다.
// 아이디가 다른 방을 가리키면(다른 브라우저에서 링크를 지우고 새로 만들었다) 그 방을 내 방으로 삼고 판은 모른다고 둔다. 들어갈 때 서버를 읽어 견준다
export function rejoin({ handle, room, ...login }) {
  keepLogin(login, { handle, ...(state().id === room ? {} : { id: room, rev: null, trying: null }) });
}

// 이 컴퓨터에서 빼도 다시 로그인해 이어 갈 수 있는지. 서버에 이 사용자의 방이 있고 아이디가 그 방을 가리켜야 한다.
// 돌려주는 것: 빈 글자(됨), 'room'(방이 없음), 'handle'(아이디가 없거나 다른 방을 가리킴). 서버에 닿지 못하면 CloudError를 던진다.
// 이 컴퓨터가 기억하는 아이디가 서버와 다르면(다른 브라우저에서 지웠다) 잊어서, 아이디와 비밀번호 창과 공유하기 창에서 다시 정할 수 있게 한다
export const canReturn = () => queueMine(async () => {
  const { id, uid } = state();
  if (!await fetchMine()) return 'room';
  const handle = myHandle();
  const doc = handle && await readHandle(handle);
  if (doc && doc.uid === uid && doc.room === id) return '';
  if (handle) rememberFor({ uid }, { handle: null });
  return 'handle';
});

// 이 컴퓨터의 사용자를 지웠다(빼기, 초기화). 예약한 올리기와 메모리의 로그인을 버린다
export function standUp() {
  dropUploads();
  session = null;
}

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
  rememberFor(me, { nick: name });
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
let pending = null; // 예약한 올리기 { make: 올릴 방 글자를 만드는 함수, stamp: 예약한 때 }

function flush() {
  clearTimeout(timer);
  const job = pending;
  pending = null;
  if (!job || !sharedId() || paused) return Promise.resolve();
  const code = job.make();
  // 비밀번호가 있는 사용자는 가구 차례만 다른 글자도 같은 방으로 본다. 그러지 않으면 두 브라우저가 같은 방을 서로 다른 글자로 번갈아 올린다
  if (code === state().sent || (hasPassword() && sameCode(code, state().sent))) return Promise.resolve();
  return queueMine(stamp => upload(code, false, stamp), job.stamp);
}

// 서버의 방이 달라진 것과 지워진 것, 로그인이 풀린 것과 사용자가 바뀐 것은 따로 알리므로(onServerRoom, onRemoved, onSignedOut, onMoved) 콘솔에도 적지 않는다
const told = err => ['changed', 'removed', 'signedout', 'moved'].includes(err.reason);

// make는 올릴 때 부르므로 그사이에 더 고친 것까지 담긴다. 짧은 링크가 없으면 아무것도 하지 않는다(처음 올리기는 주인이 공유하기 창에서 고른다).
// 올리기를 멈춘 동안(paused)에는 기다리지 않는다
export function syncLater(make) {
  if (!sharedId() || paused) return;
  pending = { make, stamp: stampNow() };
  clearTimeout(timer);
  timer = setTimeout(() => flush().catch(err => {
    if (!told(err)) console.warn('서버의 방을 고치지 못했다', err);
  }), SYNC_DELAY);
}

// 지금 바로 올린다(공유하기 창을 열 때, 두 곳에서 고친 방을 고른 뒤). 실패하면 CloudError를 던진다.
export function syncNow(make) {
  if (!sharedId() || paused) return Promise.resolve();
  pending = { make, stamp: stampNow() };
  return flush();
}

// 탭을 닫거나 다른 탭으로 갈 때 기다리던 것을 바로 올린다. 탭을 닫는 중이면 요청이 끊길 수 있는데,
// 그때는 다음에 내 컴퓨터로 들어올 때 다시 올린다(src/os.js의 enter). fetch의 keepalive는 쓰지 않는다.
// 파이어폭스가 2024년 말에야 지원해 Baseline 널리 사용 가능이 아니고(docs/checklists.md의 "사파리와 파이어폭스에서도 볼 때"), 다음에 올리는 길이 이미 있다.
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && pending) flush().catch(() => {});
});
