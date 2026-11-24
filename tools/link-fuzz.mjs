// 공유 링크와 집 검사를 무작위 입력으로 두드리는 점검. 사람이 떠올리지 못한 입력에서 나오는 버그를 찾는다.
//
//   node tools/link-fuzz.mjs            앞의 세 가지를 2만 번씩 돌린다(3초쯤 걸린다)
//   node tools/link-fuzz.mjs --seed=7   다른 씨앗으로 돌린다(같은 씨앗이면 같은 시험이다)
//
// 필요한 것: Node 22.7 이상(확장자가 .js인 모듈을 그대로 불러온다). 브라우저와 서버는 쓰지 않는다.
// `src/share.js`, `src/likes.js`, `src/rules.js`, `src/custom-picture.js`를 고치거나 가구에 담는 것(likes)의 칸을 더했으면 돌린다.
// 가구에 담는 것의 종류를 더하면 아래 randomHome의 likes와 invariants, 꽉 채운 방에도 그 칸을 더해야 그 칸까지 두드린다.
// 담는 개수나 글자 수 한도(src/likes.js의 LIMIT)를 늘릴 때도 돌려 꽉 채운 방에 남은 자리를 본다.
// 방 꾸밈(decor, 벽지와 바닥), 주인 사진(picture), 게임 기록(records)처럼 집 상태에 칸을 더할 때도 randomHome과 invariants에 더한다.
//
// 보는 것
//   1. 왕복: 무작위로 꾸민 집을 검사(sanitizeHome)한 뒤 링크로 만들었다 풀면 같은 집이 나온다. 링크에는 주소에 쓸 수 있는 글자만 있다
//   2. 망가진 링크: 글자를 바꾸거나 자르거나 아무 글자를 넣어도 멈추지 않고, 열린다면 규칙을 지키는 집이다
//   3. 아무 값: 저장본 자리에 무엇이 들어 있어도 검사가 멈추지 않고 규칙을 지키는 집을 돌려준다
//   4. 꽉 채운 방: 담는 칸을 모두 한도까지 채운 방의 글자가 서버 한도(src/cloud.js의 MAX_CODE) 안에 든다
//   5. 옛 책상: 칸을 줄이기 전의 책상('desk', 3×2칸)이 든 방을 옮겨도 사라지는 가구가 없고, 저장본과 링크가 모두 같은 방이 되며, 다시 검사해도 그대로다
//   규칙을 지키는 집: 가구가 제 공간에 있고 서로 겹치지 않으며, 이름과 인사말이 길이 안에 있고, 담아 둔 주소가 http(s)다
// 2026-11-11에 이 점검이 12번째 글자에 걸친 이모지가 반으로 잘리는 버그를 찾았다(known-issues 62).
// 종료 코드: 0 통과, 1 실패가 있음.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const load = file => import(new URL(`../${file}`, import.meta.url).href);
const { sanitizeHome, encodeHome, decodeHome, linkCode, linkId, LINK_CODES } = await load('src/share.js');
const { canPlace, isWall, supportOf } = await load('src/rules.js');
const { FURNITURE, BY_ID } = await load('data/furniture.js');
const { SCENES, N, WALL_ROWS } = await load('src/config.js');
const { safeLink, parseMusic, line, para, LIMIT } = await load('src/likes.js');
const { APPS, APP_BY_ID } = await load('data/apps.js');
const { WALL_PATTERNS } = await load('data/wall-patterns.js');
const { FLOOR_PATTERNS } = await load('data/floor-patterns.js');
const { USER_PICTURES } = await load('data/user-pictures.js');
const { customValue, customBytes, customFromBytes, readCustom, MAX_BYTES } = await load('src/custom-picture.js');
const { RECORD_APPS, MAX_RECORD } = await load('src/records.js');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//   node ')).map(l => l.slice(5)).join('\n'));
  process.exit(0);
}
const ROUNDS = 20000;
let seed = Number(args.find(a => a.startsWith('--seed='))?.slice(7)) || 20261111;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const int = n => Math.floor(rnd() * n);
const pick = list => list[int(list.length)];
// 글에 섞어 넣는 조각: 한글, 이모지(한 글자가 여러 칸을 차지한다), HTML, 따옴표, 줄바꿈, 링크를 줄일 때 쓰는 ~ 표시
const WORDS = ['책', '가나다', 'abc', '🙂', '👨‍👩‍👧', '<b>', '"', "'", '\\', '\n', '~w', '~~', '~h', '%EC%9D', '\u0000', ' ', '한글 제목', '~'];
const text = (max = 12) => Array.from({ length: int(max) }, () => pick(WORDS)).join('');

const kinds = new Map(); // 실패 종류 → 횟수
const examples = [];
function fail(what, detail) {
  kinds.set(what, (kinds.get(what) || 0) + 1);
  if (kinds.get(what) <= 2) examples.push(`${what}: ${JSON.stringify(detail).slice(0, 400)}`);
}

// 무작위로 꾸민 집. 가구는 겹치게도 놓고 담아 둔 것에는 받지 않는 값도 섞는다(검사가 걸러 내는지 본다)
function randomHome() {
  const scenes = {};
  for (const sc of SCENES) {
    const defs = FURNITURE.filter(f => f.scene === sc.id);
    scenes[sc.id] = Array.from({ length: 40 }, () => {
      // 칸을 줄이기 전의 책상도 섞는다. 가구 목록에 없는 이름이라 따로 넣는다
      if (rnd() < 0.06) return { id: 'desk', x: int(N), y: int(N), ...(rnd() < 0.3 ? { r: 1 } : {}) };
      const def = pick(defs);
      return def.zone === 'wall'
        ? { id: def.id, wall: pick(['L', 'R']), x: int(N), y: int(WALL_ROWS) }
        : { id: def.id, x: int(N), y: int(N), ...(rnd() < 0.3 ? { r: 1 } : {}) };
    });
  }
  const likes = {};
  if (rnd() < 0.7) likes.computer = { url: pick(['https://example.com/a?b=1', 'http://x.kr/', 'https://ko.wikipedia.org/wiki/%EC%9D%B4%EC%9B%83', 'javascript:alert(1)', 'https://user:pw@x.com/']), name: text(6) };
  // 추천 게임: 2026-11-18 전의 글 하나와 지금의 목록을 섞고, 목록에는 같은 게임, 게임이 아닌 앱, 없는 id, 글이 아닌 값을 넣으며 한도보다 길게도 만든다
  const GAMES = ['file-ten', 'tidy-up', 'mallangi', 'number-song', 'krara-room', 'room', 'nope', '__proto__', 3, null];
  if (rnd() < 0.5) likes.console = rnd() < 0.3 ? pick(GAMES) : Array.from({ length: int(8) }, () => pick(GAMES));
  if (rnd() < 0.7) likes.bookshelf = Array.from({ length: int(7) }, () => ({ title: text(8), author: text(5), note: text(30), color: int(10) - 1 }));
  if (rnd() < 0.5) {
    // 이름과 색은 없을 때(이름 칸이 생기기 전의 CD)와 받지 않는 값(긴 이름, 범위 밖이나 정수가 아닌 색 번호)을 섞는다
    likes.radio = Array.from({ length: int(8) }, () => ({
      url: pick([
        'https://open.spotify.com/album/5V8n6fqyAPxvFTibPhQVcp', 'https://open.spotify.com/intl-ko/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc',
        'https://music.apple.com/kr/album/abc/1440857781', 'https://music.apple.com/kr/playlist/x/pl.u-abcdefgh', 'https://evil.example/album/1',
        'https://music.apple.com/kr/playlist/y/pl.u-zyxwvuts', 'https://open.spotify.com/playlist/0123456789abcdefABCDEF',
        // 유튜브: 같은 영상이 여러 주소로 온다(검사가 한 주소로 맞추고 앞의 것만 남긴다). 받지 않는 모양도 섞는다
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ?si=abc', 'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVMx',
        'https://www.youtube.com/playlist?list=PLBB231211A4F62143', 'https://music.youtube.com/playlist?list=OLAK5uy_mBIYLofi3F8soTWU_LSWDQbbu6Bb9_Czc',
        'https://m.youtube.com/watch?v=a-b_c-d_e-f', 'https://www.youtube.com/watch?v=short', 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
        'http://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ', 'https://youtube.com/playlist?list=LL',
      ]),
      ...(rnd() < 0.7 ? { name: text(12) } : {}),
      ...(rnd() < 0.7 ? { color: pick([0, 1, 2, 3, 4, 5, 6, -1, 1.5, '2', null]) } : {}),
    }));
  }
  if (rnd() < 0.7) {
    likes.tv = Array.from({ length: int(8) }, () => ({
      title: text(10), year: text(3), by: text(6), why: text(20), color: int(8),
      link: pick(['https://ko.wikipedia.org/wiki/%EA%B8%B0%EC%83%9D%EC%B6%A9', 'https://www.youtube.com/watch?v=abc', '~w', 'ftp://x']),
      poster: pick(['https://img.example/p.jpg', 'http://img.example/p.jpg', '']),
    }));
  }
  // 시험지: 받지 않는 값(빈 문제, 빈 보기, 보기가 하나뿐인 문제, 정수가 아니거나 빈 보기를 가리키는 정답 번호)을 섞는다.
  // 검사는 빈 보기를 빼고 앞으로 당기며 정답 번호도 따라 옮긴다
  if (rnd() < 0.6) {
    likes['test-paper'] = Array.from({ length: int(5) }, () => ({
      question: rnd() < 0.9 ? text(10) : pick(['', null, 3]),
      choices: Array.from({ length: int(6) }, () => (rnd() < 0.85 ? text(5) : pick(['', null, 7]))),
      answer: pick([0, 1, 2, 3, 4, -1, 1.5, '1', null]),
    }));
  }
  // 벽지와 바닥: 목록의 무늬와 기본, 목록에 없는 이름을 섞는다(기본과 없는 이름은 검사가 그 칸을 지우고, 둘 다 지우면 decor째 지운다)
  const look = list => pick([...list.map(w => w.id), 'nope', '__proto__', 3]);
  const decor = rnd() < 0.6 ? { decor: { ...(rnd() < 0.7 && { wall: look(WALL_PATTERNS) }), ...(rnd() < 0.7 && { floor: look(FLOOR_PATTERNS) }) } } : {};
  // 주인 사진: 목록의 사진, 내 그림(그림 파일로 만든 사진), 받지 않는 값을 섞는다(받지 않는 값은 검사가 picture째 지운다)
  const picture = rnd() < 0.6 ? { picture: pick([...USER_PICTURES.map(p => p.id), 'nope', '__proto__', 3, null, randomCustom(), randomCustom(), brokenCustom()]) } : {};
  // 게임 기록: 겨루는 게임의 점수와 받지 않는 값(0, 음수, 소수, 글, 2바이트를 넘는 수, 모르는 게임)을 섞는다(받지 않는 값은 검사가 그 칸을 지운다)
  const score = () => pick([int(3000) + 1, int(MAX_RECORD) + 1, MAX_RECORD, MAX_RECORD + 1 + int(9), 0, -3, 1.5, '12', null]);
  const records = rnd() < 0.6 ? { records: Object.fromEntries([...RECORD_APPS, 'nope', '__proto__'].filter(() => rnd() < 0.6).map(id => [id, score()])) } : {};
  return { owner: text(4) || '주인', scenes, likes, greeting: text(8), ...decor, ...picture, ...records };
}

// 무작위 내 그림. 칸 576개를 1~16색으로 칠한다. 이웃한 칸과 같은 색이 적으면 240바이트를 넘어 null이 나오는데, 그 값도 검사가 걸러 내야 한다
function randomCustom() {
  const n = 1 + int(16);
  const colors = Array.from({ length: n }, () => int(4096));
  const cells = new Uint8Array(576);
  const change = rnd() * 0.6;
  let c = int(n);
  for (let i = 0; i < 576; i++) {
    if (rnd() < change) c = int(n);
    cells[i] = i >= 24 && rnd() < 0.4 ? cells[i - 24] : c;
  }
  return customValue(colors, cells);
}

// 망가진 내 그림: 표시만 있는 값, base64가 아닌 글, 바이트 하나를 바꾸거나 자르거나 늘린 그림, 색 수가 16을 넘는 머리
function brokenCustom() {
  const good = randomCustom() || 'my:AAAA';
  const bytes = customBytes(good) || new Uint8Array([0, 0]);
  const b64 = list => `my:${Buffer.from(list).toString('base64url')}`;
  const at = int(bytes.length);
  return pick([
    'my:', 'my:!!', `my:${'A'.repeat(400)}`, good.slice(0, int(good.length)), good.toUpperCase(),
    b64(bytes.map((v, i) => (i === at ? int(256) : v))), b64(bytes.subarray(0, at)), b64([...bytes, int(256)]), b64([16 + int(240), ...bytes.subarray(1)]),
  ]);
}

// 검사를 통과한 집이 규칙을 지키는지
function invariants(home, where) {
  for (const sc of SCENES) {
    const items = home.scenes[sc.id];
    if (!Array.isArray(items)) { fail(`${where}: 공간이 목록이 아니다`, sc.id); continue; }
    items.forEach((it, i) => {
      if (BY_ID[it.id]?.scene !== sc.id) fail(`${where}: 다른 공간의 가구`, it);
      else if (!canPlace(items.filter((_, j) => j !== i), it)) fail(`${where}: 규칙에 어긋난 자리`, it);
      else if (isWall(it) ? !['L', 'R'].includes(it.wall) : 'wall' in it) fail(`${where}: 벽 칸이 틀렸다`, it);
    });
  }
  const wellFormed = s => !/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(s);
  if (Array.from(home.owner).length > 12 || !wellFormed(home.owner)) fail(`${where}: 이름이 길거나 반쪽 글자가 있다`, home.owner);
  if (Array.from(home.greeting).length > 30 || !wellFormed(home.greeting)) fail(`${where}: 인사말이 길거나 반쪽 글자가 있다`, home.greeting);
  const l = home.likes;
  if (l.computer && !/^https?:\/\//.test(l.computer.url)) fail(`${where}: 컴퓨터 주소`, l.computer);
  // 추천 게임은 게임 폴더의 게임 id를 한 번씩 담은 목록이고 비어 있지 않으며 한도 안이다(글 하나로 담던 예전 값도 목록이 된다)
  if ('console' in l && (!Array.isArray(l.console) || !l.console.length || l.console.length > LIMIT.games
    || new Set(l.console).size !== l.console.length || l.console.some(id => APP_BY_ID[id]?.folder !== 'games'))) fail(`${where}: 추천 게임`, l.console);
  if (l.bookshelf && (l.bookshelf.length > LIMIT.books || l.bookshelf.some(b => !b.title || !(b.color >= 0 && b.color < LIMIT.bookColors)))) fail(`${where}: 책`, l.bookshelf);
  // CD: 링크는 알아보는 것만 한 번씩, 이름은 있으면 비지 않고 길이 안이며 반쪽 글자가 없고, 색은 있으면 1부터 LIMIT.cdColors - 1까지(0번 은색은 적지 않는다)
  const badCd = c => !parseMusic(c.url)
    || ('name' in c && (!c.name || Array.from(c.name).length > LIMIT.cdName || !wellFormed(c.name)))
    || ('color' in c && !(Number.isInteger(c.color) && c.color > 0 && c.color < LIMIT.cdColors));
  if (l.radio && (l.radio.length > LIMIT.cds || new Set(l.radio.map(c => c.url)).size !== l.radio.length || l.radio.some(badCd))) fail(`${where}: CD`, l.radio);
  // 꾸밈에는 벽지(wall)와 바닥(floor) 칸만, 기본이 아닌 목록의 id만 남고, 둘 다 없으면 decor째 빠진다
  const looks = { wall: WALL_PATTERNS, floor: FLOOR_PATTERNS };
  if ('decor' in home && (!Object.keys(home.decor).length
    || Object.entries(home.decor).some(([k, v]) => !Object.hasOwn(looks, k) || v === 'plain' || !looks[k].some(w => w.id === v)))) fail(`${where}: 벽지와 바닥`, home.decor);
  // 주인 사진은 목록의 사진이거나, 풀리고 240바이트 안이며 같은 바이트를 늘 같은 글로 적은 내 그림이다
  if ('picture' in home && !USER_PICTURES.some(p => p.id === home.picture)
    && !(readCustom(home.picture) && customBytes(home.picture).length <= MAX_BYTES && customFromBytes(customBytes(home.picture)) === home.picture)) fail(`${where}: 주인 사진`, String(home.picture).slice(0, 60));
  if (l.tv && (l.tv.length > LIMIT.works || l.tv.some(w => !w.title || (w.link && !/^https?:\/\//.test(w.link)) || (w.poster && !w.poster.startsWith('https://'))))) fail(`${where}: 작품`, l.tv);
  // 게임 기록은 있으면 비지 않고, 겨루는 게임의 1부터 MAX_RECORD까지의 정수만 있다
  const r = home.records;
  if ('records' in home && (!r || !Object.keys(r).length || Object.entries(r).some(([id, v]) => !RECORD_APPS.includes(id) || !Number.isInteger(v) || v < 1 || v > MAX_RECORD))) fail(`${where}: 게임 기록`, r);
  // 시험지: 문제는 1~3개이고, 문제마다 빈 글이 아닌 문제와 보기 2~4개(빈 보기 없음), 보기 안을 가리키는 정수 정답 번호의 세 칸뿐이다
  const badQuestion = q => !q.question || Array.from(q.question).length > LIMIT.questionText || !wellFormed(q.question)
    || !Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > LIMIT.choices
    || q.choices.some(c => !c || Array.from(c).length > LIMIT.choiceText || !wellFormed(c))
    || !(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length) || Object.keys(q).length !== 3;
  const paper = l['test-paper'];
  if (paper && (!paper.length || paper.length > LIMIT.questions || paper.some(badQuestion))) fail(`${where}: 시험지`, paper);
}

// 1. 왕복
let longest = 0;
for (let i = 0; i < ROUNDS; i++) {
  const home = sanitizeHome(randomHome());
  invariants(home, '검사한 집');
  const code = encodeHome(home);
  longest = Math.max(longest, code.length);
  if (!/^[A-Za-z0-9_-]+$/.test(code)) fail('링크에 주소에 못 쓰는 글자가 있다', code.slice(0, 80));
  if (linkCode(`#r=${code}`) !== code) fail('linkCode가 링크 글자를 다르게 읽는다', code.slice(0, 40));
  const back = decodeHome(code);
  if (!home.owner) { // 이름이 띄어쓰기뿐이면 검사한 뒤 비고, 주인 이름이 없는 링크는 열지 않는다
    if (back) fail('주인 이름이 없는 링크가 열렸다', back);
  } else if (!back) fail('만든 링크가 열리지 않는다', home);
  // 이름이나 글은 다시 검사하면 더 다듬어질 수 있어서 한 번 더 검사한 집과 견준다
  else if (JSON.stringify(back) !== JSON.stringify(sanitizeHome(home))) fail('링크를 풀면 다른 집이 된다', { home, back });
  // 가구는 다시 검사해도 같은 목록이어야 한다. 옛 책상을 옮긴 방이 열 때마다 또 바뀌면 안 된다
  if (JSON.stringify(sanitizeHome(home).scenes) !== JSON.stringify(home.scenes)) fail('두 번 검사하면 가구 목록이 달라진다', home.scenes);
}

// 2. 망가진 링크
const B64 = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'];
let opened = 0;
for (let i = 0; i < ROUNDS; i++) {
  const good = encodeHome(sanitizeHome(randomHome()));
  const at = int(good.length);
  const bad = [
    () => good.slice(0, at),                                  // 중간에 끊김
    () => good.slice(0, at) + pick(B64) + good.slice(at + 1), // 글자 하나가 바뀜
    () => Array.from({ length: int(300) }, () => pick(B64)).join(''), // 아무 글자
    () => good + good.slice(0, int(40)),                      // 뒤에 더 붙음
    () => text(20),                                           // 링크 글자가 아닌 것
  ][int(5)]();
  let home = null;
  try { home = decodeHome(bad); } catch (e) { fail('decodeHome이 예외를 던졌다', { bad: bad.slice(0, 60), e: String(e) }); }
  if (home) { opened++; invariants(home, '망가진 링크로 열린 집'); }
}

// 3. 아무 값
const junk = () => pick([null, undefined, 0, -1, 1.5, 1e9, NaN, '', 'x', [], {}, true, [[[]]], { id: 'desk' }, { id: 'desk', x: 0, y: 0 }, { id: '__proto__' }, { length: 5 }, text(5)]);
for (let i = 0; i < ROUNDS; i++) {
  const raw = pick([
    junk(),
    { owner: junk(), scenes: junk(), likes: junk(), greeting: junk(), decor: pick([junk(), { wall: junk() }]), picture: pick([junk(), brokenCustom()]), records: pick([junk(), { [pick(RECORD_APPS)]: junk() }]) },
    { owner: 'a', scenes: { room: Array.from({ length: int(6) }, junk), playground: junk() }, likes: { computer: junk(), console: junk(), bookshelf: [junk(), junk()], radio: junk(), tv: [junk()], 'test-paper': [junk(), { question: junk(), choices: [junk(), junk(), junk()], answer: junk() }] } },
    { owner: 'a', items: [junk(), { id: pick(FURNITURE).id, x: int(14) - 1, y: int(14) - 1, wall: junk(), r: junk() }] },
  ]);
  let home = null;
  try { home = sanitizeHome(raw); } catch (e) { fail('sanitizeHome이 예외를 던졌다', { raw, e: String(e) }); }
  if (home) invariants(home, '아무 값을 검사한 집');
}

// 4. 꽉 채운 방: 담는 칸을 모두 한도까지 채우고 가구를 200개(src/share.js의 MAX_ITEMS) 놓은 가장 긴 방.
// 서버 한도를 넘는 방은 src/cloud.js가 올리지 않아서, 주인이 고쳐도 손님에게는 예전 방이 보인다.
// 글은 한글로 채운다. 넣는 칸의 maxLength는 UTF-16 단위로 세는데 한글이 한 단위에 가장 많은 3바이트를 쓴다(이모지는 두 단위에 4바이트).
// 덧붙임 바이트(벽지, 바닥, 사진, 기록)는 무엇이 들었든 가장 긴 255바이트와 그 수를 적는 1바이트로 친다
const MAX_CODE = Number(readFileSync(new URL('../src/cloud.js', import.meta.url), 'utf8').match(/export const MAX_CODE = (\d+)/)?.[1]);
let full = 0;
{
  const ko = n => '가'.repeat(n);
  const list = (n, make) => Array.from({ length: n }, (_, i) => make(i));
  const address = (scheme, i) => `${scheme}://a${i}.kr/`.padEnd(LIMIT.url, 'a'); // http 주소는 줄여 담는 표시가 없어 가장 길다
  const games = APPS.filter(a => a.folder === 'games').map(a => a.id).sort((a, b) => b.length - a.length);
  // 한도보다 over만큼 많이, 길게 채운다
  const fill = over => ({
    computer: { url: address('http', 0), name: ko(LIMIT.gameName + over) },
    console: games.slice(0, LIMIT.games + over),
    bookshelf: list(LIMIT.books + over, i => ({ title: ko(LIMIT.bookTitle + over), author: ko(LIMIT.bookAuthor + over), note: ko(LIMIT.bookNote + over), color: i % LIMIT.bookColors })),
    radio: list(LIMIT.cds + over, i => ({ url: `https://music.apple.com/kr/playlist/${'a'.repeat(150)}/pl.${String(i).padEnd(64, 'a')}`, name: ko(LIMIT.cdName + over), color: 1 + i % (LIMIT.cdColors - 1) })),
    tv: list(LIMIT.works + over, i => ({ title: ko(LIMIT.workTitle + over), year: ko(LIMIT.workYear + over), by: ko(LIMIT.workBy + over), link: address('http', i), poster: address('https', i), why: ko(LIMIT.workWhy + over), color: i % LIMIT.bookColors })),
    'test-paper': list(LIMIT.questions + over, () => ({ question: ko(LIMIT.questionText + over), choices: list(LIMIT.choices + over, () => ko(LIMIT.choiceText + over)), answer: LIMIT.choices - 1 })),
  });
  const home = sanitizeHome({ owner: ko(99), greeting: ko(99), likes: fill(3) });
  if (JSON.stringify(home.likes) !== JSON.stringify(fill(0))) fail('한도를 넘게 채운 방이 한도까지 잘린 방이 되지 않는다(담는 칸이 바뀌었으면 꽉 채운 방도 고친다)', home.likes);
  home.scenes = Object.fromEntries(SCENES.map(sc => [sc.id, list(200, () => ({ id: FURNITURE[0].id, x: 0, y: 0, r: 0 }))]));
  full = encodeHome(home).length + Math.ceil(256 * 4 / 3);
  if (!(full <= MAX_CODE)) fail('꽉 채운 방이 서버 한도(MAX_CODE)를 넘는다. LIMIT를 줄이거나 src/cloud.js와 firestore.rules의 한도를 같이 올리고 규칙을 콘솔에 게시한다', { full, MAX_CODE });
}

// 5. 옛 책상: 칸을 줄이기 전(2026-11-24)의 책상('desk', 3×2칸)이 든 방은 같은 자리, 같은 방향의 새 책상(study-desk, 2×1칸)이 든 방이 된다(src/share.js의 shrinkDesks).
// 위에 있던 물건은 두 개까지 남고 나머지는 옛 책상이 비운 칸의 바닥에 내려앉는다. 책상 위에 없던 것은 하나도 움직이지 않는다.
// 옛 규칙으로 꾸민 방을 만들 때만 가구 목록에 옛 책상을 잠깐 되살린다
const DESK = 'study-desk';
const oldRules = fn => {
  BY_ID.desk = { ...BY_ID[DESK], id: 'desk', size: [3, 2] };
  try { return fn(); } finally { delete BY_ID.desk; }
};
const spot = ({ id, wall, x, y, r }) => `${id}@${wall || ''}${x},${y}${r ? 'r' : ''}`;
const tally = items => JSON.stringify(Object.entries(items.reduce((m, { id }) => ({ ...m, [id]: (m[id] || 0) + 1 }), {})).sort());
const asNew = it => (it.id === 'desk' ? { ...it, id: DESK } : it);
const deskLinks = room => [
  encodeHome({ owner: '옛 책상', greeting: '', scenes: { room }, likes: {} }),
  Buffer.from(JSON.stringify({ v: 3, o: '옛 책상', s: { room: room.map(({ id, x, y, wall, r }) => (wall ? [id, x, y, wall] : r ? [id, x, y, 1] : [id, x, y])) } })).toString('base64url'),
];
// 옛 방 하나를 옮겨 보고 새 방의 가구 목록을 돌려준다. tv: 책상 위에 TV를 올릴 수 있던 때(2026-11-23 전)의 방이라 TV가 움직인다
function moveDesks(room, where, tv = false) {
  const held = new Map(oldRules(() => room.filter(s => s.id === 'desk').map(s => [s, room.filter(t => supportOf(room, t) === s)])));
  const home = sanitizeHome({ owner: '옛 책상', scenes: { room } });
  const now = home.scenes.room;
  const bad = what => fail(`${where}: ${what}`, { room: room.map(spot), now: now.map(spot) });
  invariants(home, where);
  if (tally(now) !== tally(room.map(asNew))) bad('사라지거나 늘어난 가구가 있다');
  if (JSON.stringify(sanitizeHome(home)) !== JSON.stringify(home)) bad('다시 검사하면 달라진다');
  for (const code of deskLinks(room)) if (JSON.stringify(decodeHome(code)?.scenes.room) !== JSON.stringify(now)) bad('저장본과 링크가 다른 방이 된다');
  if (tv) return now;
  const onDesk = new Set([...held.values()].flat());
  const spots = new Set(now.map(spot));
  if (room.some(it => !onDesk.has(it) && !spots.has(spot(asNew(it))))) bad('책상 위에 없던 가구가 움직였다');
  const first = t => (String(BY_ID[t.id].gimmick || '').startsWith('app:') ? 0 : BY_ID[t.id].light ? 1 : 2);
  for (const [s, list] of held) {
    const desk = now.find(n => spot(n) === spot(asNew(s)));
    const [along, across] = s.r ? ['y', 'x'] : ['x', 'y'];
    const on = now.filter(t => supportOf(now, t) === desk).sort((a, b) => a[along] - b[along]);
    if (on.length !== Math.min(list.length, 2)) { bad('책상에 남은 물건의 수가 다르다'); continue; }
    // 남은 것은 앱이 열리는 물건, 불빛, 나머지 차례의 앞 둘이다
    const want = list.map(t => first(t)).sort().slice(0, 2);
    if (JSON.stringify(on.map(first).sort()) !== JSON.stringify(want)) bad('남길 차례가 틀렸다');
    if (on.length === 2 && (on[0][along] !== s[along] || on[1][along] !== s[along] + 1)) bad('남은 둘이 두 칸에 하나씩 놓이지 않았다');
    if (list.length === 1 && on[0][along] !== s[along] + Math.min(list[0][along] - s[along], 1)) bad('하나뿐인 물건이 가까운 칸에 놓이지 않았다');
    // 내린 것은 옛 책상이 차지하던 칸의 바닥에 있고, 새 책상의 칸 밖에 있던 것은 그 칸 그대로다. 책상에 남은 것과 같은 가구는 어느 것이 내려왔는지 몰라 건너뛴다
    const rest = list.filter(t => !on.some(o => o.id === t.id));
    for (const t of rest) {
      const here = now.filter(n => n.id === t.id && !supportOf(now, n) && n[along] >= s[along] && n[along] < s[along] + 3 && n[across] >= s[across] && n[across] < s[across] + 2);
      if (!here.length) bad('내린 물건이 옛 책상 자리의 바닥에 없다');
      else if ((t[across] > s[across] || t[along] > s[along] + 1) && !here.some(n => n.x === t.x && n.y === t.y)) bad('새 책상의 칸 밖에 있던 물건이 자리를 옮겼다');
    }
  }
  return now;
}
// 정해진 방: 옛 책상 위에 물건이 0, 1, 2, 3, 6개일 때, 돌린 책상, 책상 두 개, 빈 바닥이 없는 방. want는 새 방의 가구(책상은 빼고)다
const at = (id, x, y, r) => ({ id, x, y, ...(r ? { r: 1 } : {}) });
const deskOnly = room => room.filter(i => i.id !== DESK).map(spot).sort().join(' ');
for (const [where, room, want] of [
  ['물건 없는 책상', [at('desk', 4, 4)], ''],
  ['물건 하나(왼쪽)', [at('desk', 4, 4), at('mug', 4, 5)], 'mug@4,4'],
  ['물건 하나(가운데)', [at('desk', 4, 4), at('mug', 5, 5)], 'mug@5,4'],
  ['물건 하나(오른쪽)', [at('desk', 4, 4), at('mug', 6, 5, 1)], 'mug@5,4r'],
  ['물건 둘', [at('desk', 4, 4), at('mug', 6, 4), at('books', 4, 5)], 'books@4,4 mug@5,4'],
  ['물건 셋(앱이 먼저, 나머지는 그 칸 그대로)', [at('desk', 4, 4), at('desk-lamp', 4, 4), at('radio', 6, 4), at('books', 5, 5)], 'books@5,5 desk-lamp@4,4 radio@5,4'],
  ['물건 셋(새 책상 칸에 있던 것은 앞으로)', [at('desk', 4, 4), at('books', 4, 4), at('desk-lamp', 5, 4), at('radio', 6, 5)], 'books@4,5 desk-lamp@4,4 radio@5,4'],
  ['물건 여섯', [at('desk', 4, 4), at('diary', 4, 4), at('camera', 5, 4), at('books', 6, 4), at('console', 4, 5), at('clock', 5, 5), at('computer', 6, 5)],
    'books@6,4 camera@6,5 clock@5,5 computer@5,4 console@4,4 diary@4,5'],
  ['돌린 책상 위에 넷', [at('desk', 4, 4, 1), at('camera', 5, 4), at('computer', 5, 5), at('console', 5, 6), at('diary', 4, 6)], 'camera@5,4 computer@4,4 console@4,5 diary@4,6'],
  ['책상 두 개', [at('desk', 2, 2), at('desk', 5, 2), at('mug', 2, 2), at('books', 3, 2), at('clock', 4, 2), at('mug', 5, 2), at('books', 6, 3), at('radio', 7, 3)],
    'books@3,2 books@6,3 clock@4,2 mug@2,2 mug@5,2 radio@6,2'],
]) {
  const now = moveDesks(room, where);
  const got = deskOnly(now);
  if (got !== want) fail(`${where}: 옮긴 자리가 다르다`, { got, want });
  const shuffled = moveDesks([...room].reverse(), `${where}(거꾸로 적은 목록)`);
  if (deskOnly(shuffled) !== got) fail(`${where}: 목록의 순서에 따라 다른 방이 된다`, { got, shuffled: deskOnly(shuffled) });
}
// 빈 바닥이 없는 방: 책상 두 개에 물건을 여섯 개씩 올리고 남은 칸을 모두 화분으로 채운다. 옛 책상이 비운 네 칸에 네 개가 내려앉아 하나도 사라지지 않는다
{
  const things = ['diary', 'camera', 'books', 'console', 'clock', 'computer'];
  const room = [at('desk', 4, 4), at('desk', 8, 1, 1), ...things.map((id, i) => at(id, 4 + (i % 3), 4 + Math.floor(i / 3))), ...things.map((id, i) => at(id, 8 + (i % 2), 1 + Math.floor(i / 2)))];
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) oldRules(() => { if (canPlace(room, at('big-plant', x, y))) room.push(at('big-plant', x, y)); });
  if (room.filter(i => i.id === 'big-plant').length !== N * N - 12) fail('빈 바닥이 없는 방을 채우지 못했다', room.length);
  moveDesks(room, '빈 바닥이 없는 방');
  // 책상 위에 TV를 올릴 수 있던 때의 방도 TV와 물건이 모두 남는다
  const withTv = room.filter(i => !(i.x >= 4 && i.x < 6 && i.y === 4 && i.id !== 'desk'));
  withTv.push(at('tv', 4, 4));
  moveDesks(withTv, '빈 바닥이 없는 방의 책상 위 TV', true);
}
// 옛 규칙으로 무작위로 꾸민 방. 책상을 한 개에서 네 개 놓고 물건은 책상 위에 많이 올린다
for (let i = 0; i < ROUNDS / 10; i++) {
  const room = [];
  const tv = rnd() < 0.2;
  const zone = BY_ID.tv.zone;
  if (tv) BY_ID.tv.zone = 'top';
  oldRules(() => {
    const put = it => { if (canPlace(room, it)) room.push(it); };
    const turn = () => (rnd() < 0.4 ? { r: 1 } : {});
    for (let n = 1 + int(4); n > 0; n--) put({ id: 'desk', x: int(N), y: int(N), ...turn() });
    const tops = FURNITURE.filter(f => f.zone === 'top');
    const floors = FURNITURE.filter(f => f.zone === 'floor' && f.id !== DESK && f.id !== 'tv');
    for (const s of room.filter(r => r.id === 'desk')) for (let n = int(10); n > 0; n--) put({ id: pick(tops).id, x: s.x + int(3), y: s.y + int(3), ...turn() });
    for (let n = int(60); n > 0; n--) put({ id: pick(rnd() < 0.5 ? tops : floors).id, x: int(N), y: int(N), ...turn() });
    // 여섯에 하나는 남은 칸을 모두 채워 바닥을 없앤다
    if (rnd() < 0.16) for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) put({ id: 'big-plant', x, y });
  });
  BY_ID.tv.zone = zone;
  // TV는 두 칸이라 바닥이 꽉 차면 내릴 자리가 없을 수 있다. 그런 방은 세지 않는다
  if (tv && room.length > 100) continue;
  const now = moveDesks(room, '무작위로 꾸민 옛 방', tv);
  if (tv) continue;
  const order = room.map(it => [rnd(), it]).sort((a, b) => a[0] - b[0]).map(([, it]) => it);
  const other = sanitizeHome({ owner: '옛 책상', scenes: { room: order } }).scenes.room;
  if (other.map(spot).sort().join() !== now.map(spot).sort().join()) fail('무작위로 꾸민 옛 방: 목록의 순서에 따라 다른 방이 된다', { room: room.map(spot) });
}
// 새 책상 앞 바닥에 놓은 물건은 다시 열어도 책상으로 올라가지 않는다
for (const room of [[at(DESK, 4, 4), at('mug', 4, 5), at('books', 6, 4)], [at(DESK, 4, 4, 1), at('mug', 5, 4), at('books', 4, 6)]]) {
  const home = sanitizeHome({ owner: '새 책상', scenes: { room } });
  if (JSON.stringify(home.scenes.room) !== JSON.stringify(room) || JSON.stringify(decodeHome(encodeHome(home)).scenes.room) !== JSON.stringify(room)) fail('새 책상 앞 바닥의 물건이 움직였다', home.scenes.room);
}

// 정해진 입력 몇 가지: 주소와 글 다듬기, 짧은 링크 번호, 가구 번호
for (const [input, want] of [
  ['javascript:alert(1)', ''], ['JAVASCRIPT:alert(1)', ''], [' https://a.kr ', 'https://a.kr/'], ['data:text/html,x', ''],
  ['https://a:b@c.kr/', ''], ['//a.kr', ''], ['http://a.kr', 'http://a.kr/'], [`https://a.kr/${'x'.repeat(400)}`, ''],
]) if (safeLink(input) !== want) fail('safeLink가 다른 값을 돌려준다', { input: input.slice(0, 40), got: safeLink(input), want });
if (line('a\nb\tc\u0000d', 10) !== 'a b c d') fail('line이 제어 문자를 띄어쓰기로 바꾸지 않는다', line('a\nb\tc\u0000d', 10));
if (line('🙂'.repeat(20), 5) !== '🙂'.repeat(5)) fail('line이 이모지를 글자 수대로 자르지 않는다', line('🙂'.repeat(20), 5));
if (line('가나다\ud83d', 12) !== '가나다') fail('line이 반쪽 글자를 버리지 않는다', line('가나다\ud83d', 12));
if (para('a\r\n\r\n\r\n\r\nb', 20) !== 'a\n\nb') fail('para가 빈 줄을 하나로 줄이지 않는다', para('a\r\n\r\n\r\n\r\nb', 20));
if (linkId('#s=abcDEF12') !== 'abcDEF12' || linkId('#s=abc') || linkId('#s=abcDEF12x') || linkId('#s=abcDEF1!')) fail('linkId가 방 번호를 잘못 읽는다', '');
if (new Set(LINK_CODES).size !== LINK_CODES.length) fail('LINK_CODES에 같은 id가 둘 있다', '');
// 라디오 CD 주소: 유튜브 주소 다섯 모양은 유튜브 주소 하나와 공식 퍼가기 주소로 바뀐다
for (const [input, link, embed] of [
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
  ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
  ['https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=abc', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
  ['https://www.youtube.com/playlist?list=PLBB231211A4F62143', 'https://www.youtube.com/playlist?list=PLBB231211A4F62143', 'https://www.youtube-nocookie.com/embed/videoseries?list=PLBB231211A4F62143'],
  ['https://music.youtube.com/playlist?list=OLAK5uy_mBIYLofi3F8soTWU_LSWDQbbu6Bb9_Czc&si=x', 'https://www.youtube.com/playlist?list=OLAK5uy_mBIYLofi3F8soTWU_LSWDQbbu6Bb9_Czc',
    'https://www.youtube-nocookie.com/embed/videoseries?list=OLAK5uy_mBIYLofi3F8soTWU_LSWDQbbu6Bb9_Czc'],
]) {
  const m = parseMusic(input);
  if (m?.link !== link || m?.embed !== embed) fail('parseMusic이 유튜브 주소를 다르게 읽는다', { input, got: m && [m.link, m.embed] });
}
for (const input of ['http://youtu.be/dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXc', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://www.youtube.com/playlist?list=PL"><', 'https://youtube.evil.example/watch?v=dQw4w9WgXcQ'])
  if (parseMusic(input)) fail('parseMusic이 받지 않을 주소를 받는다', input);
// 벽지: 예전 형식(JSON)의 d 칸과 짧은 형식 5가 같은 벽지로 열리고, 모르는 벽지 번호는 기본 벽으로 열린다
{
  const json = Buffer.from(JSON.stringify({ v: 3, o: '벽지', s: {}, d: { wall: 'flower' } })).toString('base64url');
  if (decodeHome(json)?.decor?.wall !== 'flower') fail('예전 형식 링크의 벽지가 열리지 않는다', decodeHome(json));
  const bytes = Buffer.from(encodeHome(sanitizeHome({ owner: '벽지', decor: { wall: 'heart' } })), 'base64url');
  if (bytes[0] !== 5) fail('벽지를 고른 집이 짧은 형식 5로 만들어지지 않는다', [...bytes]);
  const unknown = Uint8Array.from(bytes);
  const at = 3 + bytes[1] + bytes[2 + bytes[1]]; // [5] [이름 길이] [이름] [인사말 길이] [인사말] 다음이 [꾸밈 바이트 수] [벽지 번호]다
  unknown[at + 1] = 200;
  const opened = decodeHome(Buffer.from(unknown).toString('base64url'));
  if (!opened || 'decor' in opened) fail('모르는 벽지 번호가 든 링크가 기본 벽으로 열리지 않는다', opened);
  if (Buffer.from(encodeHome(sanitizeHome({ owner: '벽지' })), 'base64url')[0] !== 4) fail('벽지도 사진도 없는 집이 짧은 형식 4로 만들어지지 않는다', '');
}
// 주인 사진: 사진만 있는 집과 벽지와 사진이 다 있는 집이 짧은 형식 5의 같은 집으로 열리고, 모르는 사진 번호는 사진 없이 열린다.
// 덧붙임 바이트가 늘어도(나중에 더할 칸) 아는 바이트만 읽고 같은 집으로 열린다. 예전 형식(JSON)의 p 칸도 열린다
{
  for (const decor of [undefined, { wall: 'cloud' }]) {
    const home = sanitizeHome({ owner: '사진', picture: 'duck', decor });
    const bytes = Buffer.from(encodeHome(home), 'base64url');
    const at = 3 + bytes[1] + bytes[2 + bytes[1]]; // [5] [이름 길이] [이름] [인사말 길이] [인사말] 다음이 [덧붙임 바이트 수] [벽지 번호] [사진 번호 + 1]이다
    if (bytes[0] !== 5 || bytes[at] !== 2) fail('사진이 있는 집이 짧은 형식 5의 덧붙임 두 바이트로 만들어지지 않는다', [...bytes]);
    if (JSON.stringify(decodeHome(encodeHome(home))) !== JSON.stringify(home)) fail('사진이 든 링크가 다른 집으로 열린다', decodeHome(encodeHome(home)));
    const unknown = Uint8Array.from(bytes);
    unknown[at + 2] = 200;
    const opened = decodeHome(Buffer.from(unknown).toString('base64url'));
    if (!opened || 'picture' in opened || opened.decor?.wall !== decor?.wall) fail('모르는 사진 번호가 든 링크가 사진만 빼고 열리지 않는다', opened);
    const more = Buffer.from([...bytes.subarray(0, at), 3, bytes[at + 1], bytes[at + 2], 7, ...bytes.subarray(at + 3)]);
    if (JSON.stringify(decodeHome(more.toString('base64url'))) !== JSON.stringify(home)) fail('덧붙임 바이트가 늘어난 링크가 같은 집으로 열리지 않는다', [...more]);
  }
  const json = Buffer.from(JSON.stringify({ v: 3, o: '사진', s: {}, p: 'cat' })).toString('base64url');
  if (decodeHome(json)?.picture !== 'cat') fail('예전 형식 링크의 사진이 열리지 않는다', decodeHome(json));
}
// 내 그림: 짧은 형식 5의 덧붙임 바이트가 [벽지 번호] [255] [그림 바이트 수] [그림 바이트]이고, 덧붙임 바이트를 건너뛰면 공간 수가 나온다
// (내 그림을 넣기 전의 페이지는 255를 모르는 사진 번호로 읽고 덧붙임 바이트를 건너뛰므로 사진만 빼고 연다).
// 그림 바이트 수가 덧붙임 바이트를 넘는 링크는 사진 없이 열리고, 그림 뒤에 덧붙임 바이트가 늘어도 같은 집으로 열린다. 예전 형식(JSON)의 p 칸도 열린다
{
  const cells = Uint8Array.from({ length: 576 }, (_, i) => (Math.floor(i / 24) + (i % 24 > 11 ? 1 : 0)) % 5);
  const mine = customValue([0xf00, 0x0f0, 0x00f, 0xff0, 0x0ff], cells);
  const blob = customBytes(mine);
  if (!blob) fail('줄무늬 내 그림이 240바이트 안에 들지 않는다', mine);
  else {
    for (const decor of [undefined, { wall: 'cloud' }]) {
      const home = sanitizeHome({ owner: '내그림', picture: mine, decor });
      const bytes = Buffer.from(encodeHome(home), 'base64url');
      const at = 3 + bytes[1] + bytes[2 + bytes[1]];
      const want = [Math.max(WALL_PATTERNS.findIndex(w => w.id === decor?.wall), 0), 255, blob.length, ...blob];
      if (bytes[0] !== 5 || bytes[at] !== want.length || want.some((v, i) => bytes[at + 1 + i] !== v)) fail('내 그림이 든 집이 짧은 형식 5의 덧붙임 바이트로 만들어지지 않는다', [...bytes.subarray(0, at + 6)]);
      if (bytes[at + 1 + bytes[at]] !== SCENES.length) fail('내 그림이 든 링크에서 덧붙임 바이트를 건너뛰면 공간 수가 나오지 않는다', bytes[at + 1 + bytes[at]]);
      if (JSON.stringify(decodeHome(encodeHome(home))) !== JSON.stringify(home)) fail('내 그림이 든 링크가 다른 집으로 열린다', decodeHome(encodeHome(home)));
      const cut = Uint8Array.from(bytes);
      cut[at + 3] = blob.length + 1;
      const opened = decodeHome(Buffer.from(cut).toString('base64url'));
      if (!opened || 'picture' in opened || opened.decor?.wall !== decor?.wall) fail('그림 바이트 수가 덧붙임 바이트를 넘는 링크가 사진만 빼고 열리지 않는다', opened);
      const end = at + 1 + bytes[at];
      const more = Buffer.from([...bytes.subarray(0, at), bytes[at] + 1, ...bytes.subarray(at + 1, end), 7, ...bytes.subarray(end)]);
      if (JSON.stringify(decodeHome(more.toString('base64url'))) !== JSON.stringify(home)) fail('내 그림 뒤에 덧붙임 바이트가 늘어난 링크가 같은 집으로 열리지 않는다', [...more.subarray(0, 12)]);
    }
    const json = Buffer.from(JSON.stringify({ v: 3, o: '내그림', s: {}, p: mine })).toString('base64url');
    if (decodeHome(json)?.picture !== mine) fail('예전 형식 링크의 내 그림이 열리지 않는다', decodeHome(json));
  }
}
// 게임 기록(F34): 짧은 형식 5의 덧붙임 바이트에서 사진 뒤(내 그림이 있으면 그 바이트 뒤)에 [기록 수] [기록마다 2바이트]로 담긴다.
// 기록만 있는 집은 사진 자리에 0을 둔다. 마지막 기록 뒤의 빈 칸은 담지 않고, 나중에 더할 게임의 기록과 끊긴 바이트는 건너뛴다.
// 2바이트를 넘는 기록은 MAX_RECORD로 줄이고, 예전 형식(JSON)의 b 칸도 열린다
{
  const extraAt = bytes => 3 + bytes[1] + bytes[2 + bytes[1]]; // [5] [이름 길이] [이름] [인사말 길이] [인사말] 다음이 [덧붙임 바이트 수]다
  const [tidy, ten] = RECORD_APPS;
  const home = sanitizeHome({ owner: '기록', records: { [tidy]: 1520, [ten]: 87 } });
  const bytes = Buffer.from(encodeHome(home), 'base64url');
  const at = extraAt(bytes);
  const want = [0, 0, 2, 1520 >> 8, 1520 & 255, 0, 87];
  if (bytes[0] !== 5 || bytes[at] !== want.length || want.some((v, i) => bytes[at + 1 + i] !== v)) fail('기록만 있는 집이 짧은 형식 5의 덧붙임 바이트로 만들어지지 않는다', [...bytes.subarray(at, at + 9)]);
  if (JSON.stringify(decodeHome(encodeHome(home))) !== JSON.stringify(home)) fail('기록이 든 링크가 다른 집으로 열린다', decodeHome(encodeHome(home)));
  const onlyFirst = Buffer.from(encodeHome(sanitizeHome({ owner: '기록', records: { [tidy]: 5 } })), 'base64url');
  if (onlyFirst[extraAt(onlyFirst)] !== 5) fail('뒤 게임의 기록이 없는 집이 빈 칸까지 담는다', [...onlyFirst]);
  const later = Buffer.from([...bytes.subarray(0, at), want.length + 2, 0, 0, 3, 1520 >> 8, 1520 & 255, 0, 87, 0, 9, ...bytes.subarray(at + 1 + want.length)]);
  if (JSON.stringify(decodeHome(later.toString('base64url'))) !== JSON.stringify(home)) fail('모르는 게임의 기록이 붙은 링크가 같은 집으로 열리지 않는다', decodeHome(later.toString('base64url')));
  const cut = Buffer.from([...bytes.subarray(0, at), 4, 0, 0, 2, 1520 >> 8, ...bytes.subarray(at + 1 + want.length)]);
  const opened = decodeHome(cut.toString('base64url'));
  if (!opened || 'records' in opened) fail('기록 바이트가 끊긴 링크가 기록만 빼고 열리지 않는다', opened);
  if (sanitizeHome({ owner: '기록', records: { [ten]: 70000 } }).records?.[ten] !== MAX_RECORD) fail('2바이트를 넘는 기록이 MAX_RECORD로 줄지 않는다', '');
  const json = Buffer.from(JSON.stringify({ v: 3, o: '기록', s: {}, b: { [tidy]: 300 } })).toString('base64url');
  if (decodeHome(json)?.records?.[tidy] !== 300) fail('예전 형식 링크의 기록이 열리지 않는다', decodeHome(json));
  // 내 그림(9색, 166바이트) 뒤에 붙은 기록. 내 그림이 240바이트(MAX_BYTES)여도 기록 두 개까지 덧붙임 바이트 255개 안에 든다
  const cells = Uint8Array.from({ length: 576 }, (_, i) => (i * 7 + (i >> 3)) % 9);
  const big = customValue(Array.from({ length: 9 }, (_, i) => (i * 257) % 4096), cells);
  const both = sanitizeHome({ owner: '기록', picture: big, records: { [tidy]: MAX_RECORD, [ten]: 1 }, decor: { wall: 'cloud' } });
  if (!both.picture) fail('9색 내 그림을 만들지 못했다', '');
  else if (JSON.stringify(decodeHome(encodeHome(both))) !== JSON.stringify(both)) fail('내 그림 뒤에 기록이 든 링크가 다른 집으로 열린다', decodeHome(encodeHome(both)));
}

// 바닥(F13): 짧은 형식 5의 덧붙임 바이트에서 기록 뒤에 [바닥 번호] 한 바이트로 담긴다. 바닥만 고른 집은 [0, 0, 0, 바닥 번호]다
// (벽지 번호, 사진 자리, 기록 수 0). 바닥 바이트를 빼면 바닥만 빠진 같은 집이 열리고(바닥을 넣기 전의 페이지가 여는 모습), 모르는 바닥 번호는 기본 바닥으로 연다
{
  const extraAt = bytes => 3 + bytes[1] + bytes[2 + bytes[1]];
  const floor = FLOOR_PATTERNS.at(-1).id;
  const only = sanitizeHome({ owner: '바닥', decor: { floor } });
  const bytes = Buffer.from(encodeHome(only), 'base64url');
  const at = extraAt(bytes);
  const want = [0, 0, 0, FLOOR_PATTERNS.length - 1];
  if (bytes[0] !== 5 || bytes[at] !== want.length || want.some((v, i) => bytes[at + 1 + i] !== v)) fail('바닥만 고른 집이 짧은 형식 5의 덧붙임 바이트 [0, 0, 0, 바닥 번호]로 만들어지지 않는다', [...bytes.subarray(at, at + 6)]);
  const [tidy] = RECORD_APPS;
  for (const extra of [{}, { decor: { wall: 'ribbon', floor } }, { picture: USER_PICTURES[1].id, decor: { floor } }, { records: { [tidy]: 300 }, decor: { wall: 'cloud', floor } }]) {
    const home = sanitizeHome({ owner: '바닥', decor: { floor }, ...extra });
    if (JSON.stringify(decodeHome(encodeHome(home))) !== JSON.stringify(home)) fail('바닥이 든 링크가 다른 집으로 열린다', [home, decodeHome(encodeHome(home))]);
    const b = Buffer.from(encodeHome(home), 'base64url');
    const a = extraAt(b);
    const cut = Buffer.from([...b.subarray(0, a), b[a] - 1, ...b.subarray(a + 1, a + b[a]), ...b.subarray(a + 1 + b[a])]);
    const rest = { ...home, decor: { ...home.decor } };
    delete rest.decor.floor;
    if (!Object.keys(rest.decor).length) delete rest.decor;
    if (JSON.stringify(decodeHome(cut.toString('base64url'))) !== JSON.stringify(rest)) fail('바닥 바이트를 뺀 링크가 바닥만 빠진 같은 집으로 열리지 않는다', decodeHome(cut.toString('base64url')));
  }
  const unknown = Buffer.from(bytes);
  unknown[at + 4] = 200;
  const opened = decodeHome(unknown.toString('base64url'));
  if (!opened || 'decor' in opened) fail('모르는 바닥 번호가 든 링크가 기본 바닥으로 열리지 않는다', opened);
  const json = Buffer.from(JSON.stringify({ v: 3, o: '바닥', s: {}, d: { wall: 'heart', floor } })).toString('base64url');
  if (JSON.stringify(decodeHome(json)?.decor) !== JSON.stringify({ wall: 'heart', floor })) fail('예전 형식 링크의 바닥이 열리지 않는다', decodeHome(json));
}

// 옛 링크: 유튜브 CD를 넣기 전(2026-11-14, ~p 표시를 더하기 전)의 코드가 만든 링크가 같은 집으로 열린다.
// 라디오 CD 두 장(이름과 색이 없는 것, 있는 것)과 유튜브 영상, 재생목록 주소를 담은 TV 작품 두 편이다(재생목록 주소는 ~h로 담겨 있다)
const OLD_LINK = 'BArsmJsg66eB7YGsBuyViOuFlQIAAHsiUiI6W3sidSI6In5zYWxidW0vNVY4bjZmcXlBUHh2RlRpYlBoUVZjcCJ9LHsidSI6In5ha3IvcGxheWxpc3QveC9wbC51LWFiY2RlZmdoIiwibSI6Iuy2nOq3vOq4uCIsImMiOjJ9XSwiVCI6W3sidCI6IuyYgeyDgSIsImwiOiJ-eWRRdzR3OVdnWGNRIiwiYyI6MH0seyJ0Ijoi66qp66GdIiwibCI6In5od3d3LnlvdXR1YmUuY29tL3BsYXlsaXN0P2xpc3Q9UExCQjIzMTIxMUE0RjYyMTQzIiwiYyI6MH1dfQ';
const OLD_HOME = '{"v":3,"owner":"옛 링크","scenes":{"room":[]},"likes":{"radio":[{"url":"https://open.spotify.com/album/5V8n6fqyAPxvFTibPhQVcp"},{"url":"https://music.apple.com/kr/playlist/x/pl.u-abcdefgh","name":"출근길","color":2}],"tv":[{"title":"영상","link":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","color":0},{"title":"목록","link":"https://www.youtube.com/playlist?list=PLBB231211A4F62143","color":0}]},"greeting":"안녕"}';
if (JSON.stringify(decodeHome(OLD_LINK)) !== OLD_HOME) fail('옛 링크가 다른 집으로 열린다', decodeHome(OLD_LINK));
// 놀이터를 빼기 전(2026-11-17)의 링크: 공간이 둘(내 방, 놀이터)이고 놀이터에 가구가 있어도 내 방만 그대로 열린다.
// 짧은 형식(4)을 손으로 만든다. [4] [주인 이름] [인사말] [공간 수 2], 내 방에 침대 하나, 놀이터에 벤치와 나무(LINK_CODES의 옛 번호)
{
  const utf8 = t => [...Buffer.from(t)];
  const owner = utf8('놀이터 주인');
  const code = id => LINK_CODES.indexOf(id);
  const bytes = [4, owner.length, ...owner, 0, 2, 1, code('bed'), 2 * 16 + 3, 2, code('bench'), 5 * 16 + 11, code('tree') | 0x80, 9 * 16 + 9];
  const home = decodeHome(Buffer.from(bytes).toString('base64url'));
  const want = JSON.stringify({ room: [{ id: 'bed', x: 2, y: 3 }] });
  if (code('bench') < 0 || code('tree') < 0) fail('LINK_CODES에서 놀이터 가구의 옛 번호가 빠졌다(자리를 지켜야 옛 링크의 뒤 가구 번호가 맞는다)', LINK_CODES);
  else if (JSON.stringify(home?.scenes) !== want || home?.owner !== '놀이터 주인') fail('놀이터 가구가 든 옛 링크가 내 방만으로 열리지 않는다', home);
}
// 책상이 3×2칸이던 때(2026-11-24 전)의 코드가 만든 링크. 책상 두 개(하나는 돌림) 위에 물건이 네 개와 한 개, 바닥에 침대와 디카가 있다. 짧은 형식과 예전 JSON 형식이 같은 방으로 열린다
const OLD_DESK_LINKS = [
  'BArsmJsg7LGF7IOBAAEJACCAhAIFEiALQA8xECGWlg4A',
  'eyJ2IjozLCJvIjoi7JibIOyxheyDgSIsInMiOnsicm9vbSI6W1siZGVzayIsMiwwXSxbImRlc2siLDgsNCwxXSxbImJlZCIsMCw1XSxbIm11ZyIsMiwwXSxbImNvbXB1dGVyIiw0LDBdLFsiZGlhcnkiLDMsMV0sWyJkZXNrLWxhbXAiLDIsMV0sWyJyYWRpbyIsOSw2LDFdLFsiY2FtZXJhIiwwLDBdXX19',
];
const OLD_DESK_ROOM = '[{"id":"study-desk","x":2,"y":0},{"id":"study-desk","x":8,"y":4,"r":1},{"id":"bed","x":0,"y":5},{"id":"computer","x":3,"y":0},{"id":"desk-lamp","x":2,"y":0},{"id":"radio","x":8,"y":5,"r":1},{"id":"camera","x":0,"y":0},{"id":"diary","x":3,"y":1},{"id":"mug","x":2,"y":1}]';
for (const link of OLD_DESK_LINKS) if (JSON.stringify(decodeHome(link)?.scenes.room) !== OLD_DESK_ROOM) fail('책상이 3×2칸이던 때의 링크가 다른 방으로 열린다', decodeHome(link)?.scenes.room);
// 추천 게임을 하나만 고르던 때(2026-11-18 전)의 링크: 게임기에 파일 정리 10 하나를 글로 담았다({"G":"file-ten"}). 한 개짜리 목록으로 열린다
const OLD_CONSOLE = 'BA3smJsg6rKM7J6E6riwAAEAeyJHIjoiZmlsZS10ZW4ifQ';
if (JSON.stringify(decodeHome(OLD_CONSOLE)?.likes) !== '{"console":["file-ten"]}') fail('추천 게임이 하나뿐인 옛 링크가 한 개짜리 목록으로 열리지 않는다', decodeHome(OLD_CONSOLE));

console.log(`공유 링크 무작위 점검: 왕복 ${ROUNDS}번, 망가진 링크 ${ROUNDS}번(그 가운데 ${opened}번은 집으로 열림), 아무 값 ${ROUNDS}번, 옛 책상이 든 방 ${ROUNDS / 10}개, 가장 긴 링크 ${longest}자, 꽉 채운 방 ${full}자(서버 한도 ${MAX_CODE}자)`);
for (const e of examples) console.log(`실패 ${e}`);
const total = [...kinds.values()].reduce((a, b) => a + b, 0);
if (kinds.size) console.log(`  종류별: ${[...kinds].map(([k, n]) => `${k} ${n}번`).join(', ')}`);
console.log(`점검 끝: 실패 ${total}개`);
process.exit(total ? 1 : 0);
