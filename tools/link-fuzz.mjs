// 공유 링크와 집 검사를 무작위 입력으로 두드리는 점검. 사람이 떠올리지 못한 입력에서 나오는 버그를 찾는다.
//
//   node tools/link-fuzz.mjs            세 가지를 2만 번씩 돌린다(3초쯤 걸린다)
//   node tools/link-fuzz.mjs --seed=7   다른 씨앗으로 돌린다(같은 씨앗이면 같은 시험이다)
//
// 필요한 것: Node 22.7 이상(확장자가 .js인 모듈을 그대로 불러온다). 브라우저와 서버는 쓰지 않는다.
// `src/share.js`, `src/likes.js`, `src/rules.js`를 고치거나 가구에 담는 것(likes)의 칸을 더했으면 돌린다.
// 가구에 담는 것의 종류를 더하면 아래 randomHome의 likes와 invariants에도 그 칸을 더해야 그 칸까지 두드린다.
// 방 꾸밈(decor, 지금은 벽지)에 칸을 더할 때도 randomHome과 invariants에 더한다.
//
// 보는 것
//   1. 왕복: 무작위로 꾸민 집을 검사(sanitizeHome)한 뒤 링크로 만들었다 풀면 같은 집이 나온다. 링크에는 주소에 쓸 수 있는 글자만 있다
//   2. 망가진 링크: 글자를 바꾸거나 자르거나 아무 글자를 넣어도 멈추지 않고, 열린다면 규칙을 지키는 집이다
//   3. 아무 값: 저장본 자리에 무엇이 들어 있어도 검사가 멈추지 않고 규칙을 지키는 집을 돌려준다
//   규칙을 지키는 집: 가구가 제 공간에 있고 서로 겹치지 않으며, 이름과 인사말이 길이 안에 있고, 담아 둔 주소가 http(s)다
// 2026-11-11에 이 점검이 12번째 글자에 걸친 이모지가 반으로 잘리는 버그를 찾았다(known-issues 62).
// 종료 코드: 0 통과, 1 실패가 있음.
import { fileURLToPath } from 'node:url';

const load = file => import(new URL(`../${file}`, import.meta.url).href);
const { sanitizeHome, encodeHome, decodeHome, linkCode, linkId, LINK_CODES } = await load('src/share.js');
const { canPlace, isWall } = await load('src/rules.js');
const { FURNITURE, BY_ID } = await load('data/furniture.js');
const { SCENES, N, WALL_ROWS } = await load('src/config.js');
const { safeLink, parseMusic, line, para, LIMIT } = await load('src/likes.js');
const { WALL_PATTERNS } = await load('data/wall-patterns.js');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  const { readFileSync } = await import('node:fs');
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
      const def = pick(defs);
      return def.zone === 'wall'
        ? { id: def.id, wall: pick(['L', 'R']), x: int(N), y: int(WALL_ROWS) }
        : { id: def.id, x: int(N), y: int(N), ...(rnd() < 0.3 ? { r: 1 } : {}) };
    });
  }
  const likes = {};
  if (rnd() < 0.7) likes.computer = { url: pick(['https://example.com/a?b=1', 'http://x.kr/', 'https://ko.wikipedia.org/wiki/%EC%9D%B4%EC%9B%83', 'javascript:alert(1)', 'https://user:pw@x.com/']), name: text(6) };
  if (rnd() < 0.5) likes.console = pick(['file-ten', 'tidy-up', 'room', 'nope']);
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
  // 벽지: 목록의 벽지와 기본 벽, 목록에 없는 이름을 섞는다(기본 벽과 없는 이름은 검사가 decor째 지운다)
  const decor = rnd() < 0.6 ? { decor: { wall: pick([...WALL_PATTERNS.map(w => w.id), 'nope', '__proto__', 3]) } } : {};
  return { owner: text(4) || '주인', scenes, likes, greeting: text(8), ...decor };
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
  if (l.bookshelf && (l.bookshelf.length > LIMIT.books || l.bookshelf.some(b => !b.title || !(b.color >= 0 && b.color < LIMIT.bookColors)))) fail(`${where}: 책`, l.bookshelf);
  // CD: 링크는 알아보는 것만 한 번씩, 이름은 있으면 비지 않고 길이 안이며 반쪽 글자가 없고, 색은 있으면 1부터 LIMIT.cdColors - 1까지(0번 은색은 적지 않는다)
  const badCd = c => !parseMusic(c.url)
    || ('name' in c && (!c.name || Array.from(c.name).length > LIMIT.cdName || !wellFormed(c.name)))
    || ('color' in c && !(Number.isInteger(c.color) && c.color > 0 && c.color < LIMIT.cdColors));
  if (l.radio && (l.radio.length > LIMIT.cds || new Set(l.radio.map(c => c.url)).size !== l.radio.length || l.radio.some(badCd))) fail(`${where}: CD`, l.radio);
  if ('decor' in home && (home.decor.wall === 'plain' || !WALL_PATTERNS.some(w => w.id === home.decor.wall) || Object.keys(home.decor).length !== 1)) fail(`${where}: 벽지`, home.decor);
  if (l.tv && (l.tv.length > LIMIT.works || l.tv.some(w => !w.title || (w.link && !/^https?:\/\//.test(w.link)) || (w.poster && !w.poster.startsWith('https://'))))) fail(`${where}: 작품`, l.tv);
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
  // 검사는 책상 위 물건을 목록 뒤로 보내므로, 한 번 더 검사한 집과 견준다
  else if (JSON.stringify(back) !== JSON.stringify(sanitizeHome(home))) fail('링크를 풀면 다른 집이 된다', { home, back });
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
    { owner: junk(), scenes: junk(), likes: junk(), greeting: junk(), decor: pick([junk(), { wall: junk() }]) },
    { owner: 'a', scenes: { room: Array.from({ length: int(6) }, junk), playground: junk() }, likes: { computer: junk(), console: junk(), bookshelf: [junk(), junk()], radio: junk(), tv: [junk()] } },
    { owner: 'a', items: [junk(), { id: pick(FURNITURE).id, x: int(14) - 1, y: int(14) - 1, wall: junk(), r: junk() }] },
  ]);
  let home = null;
  try { home = sanitizeHome(raw); } catch (e) { fail('sanitizeHome이 예외를 던졌다', { raw, e: String(e) }); }
  if (home) invariants(home, '아무 값을 검사한 집');
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
  if (Buffer.from(encodeHome(sanitizeHome({ owner: '벽지' })), 'base64url')[0] !== 4) fail('꾸미지 않은 집이 짧은 형식 4로 만들어지지 않는다', '');
}
// 옛 링크: 유튜브 CD를 넣기 전(2026-11-14, ~p 표시를 더하기 전)의 코드가 만든 링크가 같은 집으로 열린다.
// 라디오 CD 두 장(이름과 색이 없는 것, 있는 것)과 유튜브 영상, 재생목록 주소를 담은 TV 작품 두 편이다(재생목록 주소는 ~h로 담겨 있다)
const OLD_LINK = 'BArsmJsg66eB7YGsBuyViOuFlQIAAHsiUiI6W3sidSI6In5zYWxidW0vNVY4bjZmcXlBUHh2RlRpYlBoUVZjcCJ9LHsidSI6In5ha3IvcGxheWxpc3QveC9wbC51LWFiY2RlZmdoIiwibSI6Iuy2nOq3vOq4uCIsImMiOjJ9XSwiVCI6W3sidCI6IuyYgeyDgSIsImwiOiJ-eWRRdzR3OVdnWGNRIiwiYyI6MH0seyJ0Ijoi66qp66GdIiwibCI6In5od3d3LnlvdXR1YmUuY29tL3BsYXlsaXN0P2xpc3Q9UExCQjIzMTIxMUE0RjYyMTQzIiwiYyI6MH1dfQ';
const OLD_HOME = '{"v":3,"owner":"옛 링크","scenes":{"room":[],"playground":[]},"likes":{"radio":[{"url":"https://open.spotify.com/album/5V8n6fqyAPxvFTibPhQVcp"},{"url":"https://music.apple.com/kr/playlist/x/pl.u-abcdefgh","name":"출근길","color":2}],"tv":[{"title":"영상","link":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","color":0},{"title":"목록","link":"https://www.youtube.com/playlist?list=PLBB231211A4F62143","color":0}]},"greeting":"안녕"}';
if (JSON.stringify(decodeHome(OLD_LINK)) !== OLD_HOME) fail('옛 링크가 다른 집으로 열린다', decodeHome(OLD_LINK));

console.log(`공유 링크 무작위 점검: 왕복 ${ROUNDS}번, 망가진 링크 ${ROUNDS}번(그 가운데 ${opened}번은 집으로 열림), 아무 값 ${ROUNDS}번, 가장 긴 링크 ${longest}자`);
for (const e of examples) console.log(`실패 ${e}`);
const total = [...kinds.values()].reduce((a, b) => a + b, 0);
if (kinds.size) console.log(`  종류별: ${[...kinds].map(([k, n]) => `${k} ${n}번`).join(', ')}`);
console.log(`점검 끝: 실패 ${total}개`);
process.exit(total ? 1 : 0);
