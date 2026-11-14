// 주인이 가구마다 담아 두는 좋아하는 것(F12). 집 상태의 likes에 가구 id마다 한 칸씩 들어가서,
// 브라우저에 저장되고 공유 링크에도 담긴다(src/share.js). 주인은 내 컴퓨터에서 그 가구를 쓸 때 뜨는 화면에서 넣고 고친다.
//
//   computer   { url, name }    좋아하는 웹 게임 링크 하나와 게임 이름(없어도 된다)
//   console    '<앱 id>'         미니게임(data/apps.js의 folder: 'games') 가운데 주인이 고른 추천 게임 하나
//   bookshelf  [{ title, author, note, color }]   책 5권까지. note는 좋아하는 구절이나 고른 이유(줄바꿈 가능),
//              color는 표지 색 번호(0부터 LIMIT.bookColors - 1, 넣을 때 무작위로 정한다)
//   radio      [{ url, name, color }]   CD 6장까지. url은 스포티파이, 애플 뮤직의 앨범이나 플레이리스트, 유튜브의 영상이나 재생목록 링크(parseMusic이 알아보는 것만),
//              name은 주인이 붙인 CD 이름, color는 CD 색 번호(1부터 LIMIT.cdColors - 1). 0번 색(은색)이면 color를, 이름이 없으면 name을 적지 않는다.
//              이름 칸이 생기기 전(2026-11-14)에 넣은 CD는 { url }뿐이고, 화면은 서비스에서 받은 이름을 쓴다
//   tv         [{ title, year, by, link, poster, why, color }]   영화나 TV 시리즈 6편까지. by는 감독, link는 보러 갈 곳,
//              poster는 포스터 그림 주소(https), why는 추천 이유. 포스터가 없으면 color 색의 제목 카드를 건다
//
// 손님 화면에도 뜨는 글이라 화면에는 h()의 자식(글자)으로만 넣고, 주소는 safeLink, safeImage, parseMusic을 거친 것만 쓴다.
// 그래서 주인이 넣은 글이나 링크(javascript: 주소 같은 것)로 손님 화면에서 스크립트가 돌지 않는다.
// 공유 링크가 너무 길어지지 않게 가구마다 개수와 글자 수를 LIMIT로 줄여 둔다.
import { APP_BY_ID } from '../data/apps.js';

export const LIMIT = {
  url: 300,      // 주소 하나의 글자 수
  gameName: 20,  // 컴퓨터에 넣는 게임 이름
  books: 5,      // 책장의 책 권수
  bookTitle: 30,
  bookAuthor: 20,
  bookNote: 120, // 좋아하는 구절이나 고른 이유
  bookColors: 8, // 표지 색 가짓수(src/apps/bookshelf-app.js의 BOOK_COLORS와 같아야 한다). TV의 제목 카드도 같은 색을 쓴다
  cds: 6,        // 라디오의 CD 장수
  cdName: 16,    // CD 이름. 펼친 CD 아래 라벨(124px, 13px 글자 두 줄)과 라디오 표시창(194px, 12px 글자 한 줄)에 한글 16자가 다 들어간다
  cdColors: 6,   // CD 색 가짓수(src/apps/radio-app.js의 CD_COLORS, style.css의 .cd[data-color]와 같아야 한다. tools/check.py가 본다)
  works: 6,      // TV의 작품 수
  workTitle: 40,
  workYear: 9,   // 2019, 2015~2016
  workBy: 30,    // 감독
  workWhy: 80,   // 추천 이유
};

// 글을 글자(코드 포인트) 단위로 나눈다. 이모지를 반으로 자르지 않으려는 것이고, 이미 반으로 잘려 들어온 조각(짝 없는 서러게이트)은 버린다.
// 반쪽 조각은 화면에 깨진 글자로 보이고, 링크에 담았다 풀면 다른 글자(U+FFFD)로 바뀐다.
const chars = text => Array.from(text).filter(ch => ch.length > 1 || ch < '\ud800' || ch > '\udfff');

// 한 줄 글. 글자가 아닌 값은 빈 글로, 줄바꿈과 제어 문자는 띄어쓰기로 바꾸고 max 글자까지만 남긴다(이모지를 반으로 자르지 않게 글자 단위로 센다).
export function line(value, max) {
  if (typeof value !== 'string') return '';
  return chars(value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()).slice(0, max).join('').trim();
}

// 여러 줄 글. 줄바꿈은 남기고(빈 줄은 하나까지), 다른 제어 문자는 띄어쓰기로 바꾼다.
export function para(value, max) {
  if (typeof value !== 'string') return '';
  const text = value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return chars(text).slice(0, max).join('').trim();
}

// 새로 넣는 책과 작품의 색 번호. 무작위로 고르되 목록의 마지막 것과 같은 색은 피한다(선반에서 책등이 붙어 보이지 않게).
export function nextColor(list) {
  const prev = list[list.length - 1]?.color;
  let color;
  do { color = Math.floor(Math.random() * LIMIT.bookColors); } while (color === prev);
  return color;
}

// 새 탭으로 여는 링크 주소. http와 https만 받고, 아이디와 비밀번호가 든 주소는 버린다. 못 쓰는 주소는 빈 글을 돌려준다.
export function safeLink(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const u = new URL(value.trim());
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return '';
    return u.href.length <= LIMIT.url ? u.href : '';
  } catch {
    return '';
  }
}

// 그림 주소(TV 포스터). 사이트가 https라서 https 그림만 받는다(http 그림은 브라우저가 막거나 경고한다).
export function safeImage(value) {
  const href = safeLink(value);
  return href.startsWith('https:') ? href : '';
}

// 라디오 CD 링크. 스포티파이와 애플 뮤직의 앨범, 플레이리스트와 유튜브의 영상 하나, 재생목록만 알아보고 { service, kind, id, link, embed }를 돌려준다.
// 주인이 넣은 주소를 그대로 창에 띄우지 않고, 알아본 id로 공식 플레이어 주소(embed)를 새로 만든다. 다른 페이지가 창에 뜨지 않게 하려는 것이다.
//   https://open.spotify.com/album/<22자 id>?si=...        https://open.spotify.com/intl-ko/playlist/<id>
//   https://music.apple.com/kr/album/<이름>/<숫자 id>      https://music.apple.com/kr/playlist/<이름>/pl.<id>
//   https://www.youtube.com/watch?v=<11자 id>              https://youtu.be/<id>?si=...    https://music.youtube.com/watch?v=<id>
//   https://www.youtube.com/playlist?list=<id>             https://music.youtube.com/playlist?list=<id>(유튜브 뮤직의 앨범도 이 모양이다)
// 유튜브 뮤직 주소는 같은 영상, 같은 재생목록의 유튜브 주소로 바꿔 둔다. 그래서 같은 노래가 두 번 들어가지 않고 공유 링크에서도 짧게 줄어든다.
// watch 주소에 list가 같이 붙어 있으면(재생목록을 듣다가 주소창에서 복사한 것) v의 영상 하나로 본다.
// 유튜브 플레이어는 개인정보 보호 모드 주소(youtube-nocookie.com)로 띄운다. 유튜브의 퍼가기 창에서 "개인정보 보호 모드 사용"을 켜면 나오는 주소다.
const YT_HOSTS = ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'music.youtube.com'];
const YT_EMBED = 'https://www.youtube-nocookie.com/embed/';
export function parseMusic(value) {
  let u;
  try { u = new URL(String(value).trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  if (u.host === 'open.spotify.com') {
    const m = u.pathname.match(/^\/(?:intl-[a-z]{2}(?:-[a-z]{2,4})?\/)?(album|playlist)\/([A-Za-z0-9]{22})\/?$/);
    if (!m) return null;
    return { service: 'spotify', kind: m[1], id: m[2], link: `https://open.spotify.com/${m[1]}/${m[2]}`, embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}` };
  }
  if (u.host === 'music.apple.com' || u.host === 'embed.music.apple.com') {
    const m = u.pathname.match(/^\/([a-z]{2})\/(album|playlist)\/(?:([A-Za-z0-9%._~-]{1,150})\/)?(\d{4,12}|pl\.[A-Za-z0-9-]{8,64})\/?$/);
    if (!m || (m[2] === 'album') !== /^\d/.test(m[4])) return null; // 앨범은 숫자 id, 플레이리스트는 pl. id
    const path = `${m[1]}/${m[2]}/${m[3] ? m[3] + '/' : ''}${m[4]}`;
    return { service: 'apple', kind: m[2], id: m[4], cc: m[1], link: `https://music.apple.com/${path}`, embed: `https://embed.music.apple.com/${path}` };
  }
  if (u.host === 'youtu.be' || YT_HOSTS.includes(u.host)) {
    const path = u.pathname.replace(/\/$/, '');
    const v = u.host === 'youtu.be' ? path.slice(1) : path === '/watch' ? u.searchParams.get('v') : null;
    if (v != null) {
      if (!/^[A-Za-z0-9_-]{11}$/.test(v)) return null;
      return { service: 'youtube', kind: 'video', id: v, link: `https://www.youtube.com/watch?v=${v}`, embed: YT_EMBED + v };
    }
    const list = path === '/playlist' ? u.searchParams.get('list') : null;
    if (!list || !/^[A-Za-z0-9_-]{10,64}$/.test(list)) return null;
    return { service: 'youtube', kind: 'playlist', id: list, link: `https://www.youtube.com/playlist?list=${list}`, embed: `${YT_EMBED}videoseries?list=${list}` };
  }
  return null;
}

const SANITIZE = {
  computer(raw) {
    const url = safeLink(raw?.url);
    if (!url) return null;
    const name = line(raw.name, LIMIT.gameName);
    return name ? { url, name } : { url };
  },
  console(raw) {
    return typeof raw === 'string' && APP_BY_ID[raw]?.folder === 'games' ? raw : null;
  },
  bookshelf(raw) {
    if (!Array.isArray(raw)) return null;
    const books = raw.slice(0, LIMIT.books).map(b => {
      const book = { title: line(b?.title, LIMIT.bookTitle) };
      const author = line(b?.author, LIMIT.bookAuthor);
      const note = para(b?.note, LIMIT.bookNote);
      if (author) book.author = author;
      if (note) book.note = note;
      book.color = Number.isInteger(b?.color) && b.color >= 0 && b.color < LIMIT.bookColors ? b.color : 0;
      return book;
    }).filter(b => b.title);
    return books.length ? books : null;
  },
  radio(raw) {
    if (!Array.isArray(raw)) return null;
    const cds = [];
    for (const c of raw) {
      const url = parseMusic(c?.url)?.link;
      if (!url || cds.some(cd => cd.url === url)) continue; // 같은 CD가 둘이면 앞의 것만 남긴다
      const cd = { url };
      const name = line(c.name, LIMIT.cdName);
      if (name) cd.name = name;
      if (Number.isInteger(c.color) && c.color > 0 && c.color < LIMIT.cdColors) cd.color = c.color;
      cds.push(cd);
      if (cds.length === LIMIT.cds) break;
    }
    return cds.length ? cds : null;
  },
  tv(raw) {
    if (!Array.isArray(raw)) return null;
    const works = raw.slice(0, LIMIT.works).map(w => {
      const work = { title: line(w?.title, LIMIT.workTitle) };
      const extra = {
        year: line(w?.year, LIMIT.workYear),
        by: line(w?.by, LIMIT.workBy),
        link: safeLink(w?.link),
        poster: safeImage(w?.poster),
        why: para(w?.why, LIMIT.workWhy),
      };
      for (const [k, v] of Object.entries(extra)) if (v) work[k] = v;
      work.color = Number.isInteger(w?.color) && w.color >= 0 && w.color < LIMIT.bookColors ? w.color : 0;
      return work;
    }).filter(w => w.title);
    return works.length ? works : null;
  },
};

// 저장본이나 링크에서 온 likes는 손으로 고쳐졌을 수 있으므로 늘 이걸 거친다. 모르는 가구와 비어 있는 칸은 버린다.
export function sanitizeLikes(raw) {
  const likes = {};
  if (!raw || typeof raw !== 'object') return likes;
  for (const [id, clean] of Object.entries(SANITIZE)) {
    const value = Object.hasOwn(raw, id) ? clean(raw[id]) : null;
    if (value != null) likes[id] = value;
  }
  return likes;
}

// 가구 하나의 칸을 바꾸고 저장한다. value가 null이면 그 칸을 비운다. 다듬어진 값을 돌려준다.
// 튜토리얼 연습 방에서는 os.saveHome이 저장하지 않으므로 연습 방에 넣은 것은 저장되지 않는다(known-issues 40).
export function setLike(os, id, value) {
  os.home.likes = sanitizeLikes({ ...os.home.likes, [id]: value });
  os.saveHome(false);
  return os.home.likes[id] ?? null;
}

// 지금 화면이 주인의 컴퓨터인지(손님은 넣거나 고치지 못한다)
export const isOwner = os => os.mode === 'edit';
