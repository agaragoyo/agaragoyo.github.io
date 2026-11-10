// 주인이 가구마다 담아 두는 좋아하는 것(F12). 집 상태의 likes에 가구 id마다 한 칸씩 들어가서,
// 브라우저에 저장되고 공유 링크에도 담긴다(src/share.js). 주인은 내 컴퓨터에서 그 가구를 쓸 때 뜨는 화면에서 넣고 고친다.
//
//   computer   { url, name }    좋아하는 웹 게임 링크 하나와 게임 이름(없어도 된다)
//   console    '<앱 id>'         미니게임(data/apps.js의 folder: 'games') 가운데 주인이 고른 추천 게임 하나
//
// 손님 화면에도 뜨는 글이라 화면에는 h()의 자식(글자)으로만 넣고, 주소는 safeLink를 거친 것만 쓴다.
// 그래서 주인이 넣은 글이나 링크(javascript: 주소 같은 것)로 손님 화면에서 스크립트가 돌지 않는다.
// 공유 링크가 너무 길어지지 않게 가구마다 개수와 글자 수를 LIMIT로 줄여 둔다.
import { APP_BY_ID } from '../data/apps.js';

export const LIMIT = {
  url: 300,      // 주소 하나의 글자 수
  gameName: 20,  // 컴퓨터에 넣는 게임 이름
};

// 한 줄 글. 글자가 아닌 값은 빈 글로, 줄바꿈과 제어 문자는 띄어쓰기로 바꾸고 max 글자까지만 남긴다(이모지를 반으로 자르지 않게 글자 단위로 센다).
export function line(value, max) {
  if (typeof value !== 'string') return '';
  return Array.from(value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()).slice(0, max).join('');
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
