// 사용자 사진(프로필 사진). 그림은 data/user-pictures.js에 있고, 여기서 사진 요소와 사진을 고르는 줄, 사진 바꾸기 창을 만든다.
// 로그인 화면(src/login.js)의 내 사용자와 새 사용자 만들기, 시작 메뉴 맨 위(src/os.js의 openStartMenu)가 쓴다.
// 사진 값은 목록 사진의 id이거나, 사용자가 고른 그림 파일을 줄인 내 그림('my:'로 시작하는 글, src/custom-picture.js)이다.
// 사진은 이 컴퓨터의 사용자 것이라 집(os.home)과 따로 STORAGE_PICTURE에 사진 값만 저장한다. 그래서 튜토리얼 연습 방이 집을 바꿔 끼워도
// 그대로이며(known-issues 40), 이 컴퓨터 초기화가 다른 agarago. 키와 함께 지운다. 공유 링크에는 만들 때 withPicture로 붙여 담는다.
import { STORAGE_PICTURE } from './config.js';
import { USER_PICTURES } from '../data/user-pictures.js';
import { isCustom, readCustom, makeCustom } from './custom-picture.js';
import { h, loadJSON, saveJSON } from './util.js';

const GRID = 24;
const BY_ID = Object.fromEntries(USER_PICTURES.map(p => [p.id, p]));
// 목록의 사진이거나 풀 수 있는 내 그림인지
const isPicture = v => typeof v === 'string' && (Object.hasOwn(BY_ID, v) || !!readCustom(v));

// 사진 자리 크기(px)마다 그림 크기를 고른다. 36은 고르는 줄의 사진, 48은 로그인 화면과 시작 메뉴, 사진 바꾸기 창의 큰 사진이다.
// 그림 한 칸이 화면 픽셀 정수 개가 되는 크기 가운데 원래 크기에 가장 가까운 것을 고른다(원래 크기의 0.7~1.4배 안).
// 바탕화면 아이콘의 fitPixelIcons(src/icons.js)와 같은 방법이다(known-issues 67).
// 큰 사진은 고르는 줄보다 한 칸이 화면 픽셀 하나라도 굵은 크기에서 고르고, 그러느라 원래 크기의 1.8배까지 커질 수 있다.
// 1366×768 노트북(무대 배율 0.61)에서 둘을 따로 고르면 둘 다 한 칸이 1픽셀이라, 새 사용자 만들기의 큰 사진이 고르는 줄의 사진과 같은 크기로 보였다.
// 맞는 크기가 없으면 원래 크기로 두고, 한 칸이 1픽셀보다 작을 때만 부드럽게 줄인다.
// main.js의 fit()이 무대 배율이 바뀔 때마다 부른다. style: CSS 변수를 넣을 곳, scale: 무대 배율, dpr: 화면 픽셀 비율
export function fitUserPictures(style, scale, dpr) {
  let finer = 0; // 고르는 줄의 한 칸이 차지하는 화면 픽셀
  for (const [slot, most] of [[36, 1.4], [48, 1.8]]) {
    const raw = slot / GRID * scale * dpr; // 원래 크기로 그리면 한 칸이 차지하는 화면 픽셀
    const fits = [...new Set([Math.floor(raw), Math.ceil(raw), Math.ceil(raw) + 1])]
      .filter(n => n >= 1 && n / raw >= 0.7 && n / raw <= most)
      .sort((a, b) => Math.abs(Math.log(a / raw)) - Math.abs(Math.log(b / raw)));
    const k = fits.find(n => n > finer) ?? fits.find(n => n / raw <= 1.4);
    style.setProperty(`--user-pic-${slot}`, (k ? GRID * k / (scale * dpr) : slot) + 'px');
    style.setProperty(`--user-pic-${slot}-render`, k || raw >= 1 ? 'crispEdges' : 'auto');
    finer = k || 0;
  }
}

// 지금 무대 배율에서 사진 자리(slot)의 그림 크기(무대 px)
const shownSize = slot => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--user-pic-${slot}`)) || slot;

// 이 컴퓨터 사용자의 사진 값. 고른 적이 없으면(사진이 생기기 전에 만든 사용자) 닉네임으로 한 장을 정한다.
// 그 사진은 저장하지 않지만 같은 닉네임이면 늘 같은 사진이 나온다.
export function ownPicture(name = '') {
  const v = loadJSON(STORAGE_PICTURE);
  if (isPicture(v)) return v;
  let n = 0;
  for (const ch of name) n = (n * 31 + ch.codePointAt(0)) >>> 0;
  return USER_PICTURES[n % USER_PICTURES.length].id;
}

export function saveOwnPicture(v) {
  if (isPicture(v)) saveJSON(STORAGE_PICTURE, v);
}

// 공유 링크의 방에 담을 집. 내 집에 내 사진을 붙인다. 서버에 방을 올리는 곳(공유하기 창, 고친 방을 따라 올리는 os.js)은 모두 이걸 거친다.
// 링크로 온 손님은 로그인 화면과 시작 메뉴에서 이 사진을 본다(src/share.js가 사진 번호나 내 그림을 담는다).
// 2026-11-14에 공유하기 창에서 긴 링크를 빼서, 내 그림을 긴 링크에서 빼던 갈래도 같이 없앴다. 예전 긴 링크로 온 손님은 링크에 담긴 사진이나 이름의 첫 글자를 본다.
export function withPicture(home) {
  return { ...home, picture: ownPicture(home.owner) };
}

// 새 사용자 만들기 칸에 미리 골라 두는 사진. 그 시절 컴퓨터처럼 아무 사진이나 하나를 준다.
export const randomPicture = () => USER_PICTURES[Math.floor(Math.random() * USER_PICTURES.length)].id;

// 내 그림을 목록 사진과 같은 모양(바탕 색, 글자마다 색, 글자 줄)으로 바꾼다. 색 번호를 16진수 한 글자로 적고,
// 가장 흔한 0번 색을 바탕으로 칠해 그 칸은 '.'로 둔다(SVG 조각이 줄어든다)
const asRows = ({ colors, cells }) => ({
  bg: colors[0],
  colors: Object.fromEntries(colors.map((c, i) => [i.toString(16), c])),
  rows: Array.from({ length: GRID }, (_, y) => Array.from(cells.subarray(y * GRID, (y + 1) * GRID), c => (c ? c.toString(16) : '.')).join('')),
});

// 사진 하나를 SVG 글로 만든다. 바탕을 칠하고, 같은 색 칸이 가로로 이어지면 한 조각으로 묶는다.
// 색은 목록 사진이면 data/user-pictures.js의 것이고, 내 그림이면 숫자에서 만든 #rgb라 innerHTML에 넣어도 된다.
const svgs = new Map();
function pictureSvg(id) {
  if (svgs.has(id)) return svgs.get(id);
  const custom = readCustom(id);
  const { bg, colors, rows } = custom ? asRows(custom) : BY_ID[id];
  const paths = {};
  rows.forEach((row, y) => {
    for (let x = 0; x < GRID;) {
      let n = 1;
      while (row[x + n] === row[x]) n++;
      if (row[x] !== '.') (paths[row[x]] ??= []).push(`M${x} ${y}h${n}v1h-${n}z`);
      x += n;
    }
  });
  const fills = Object.entries(paths).map(([c, d]) => `<path fill="${colors[c]}" d="${d.join('')}"/>`).join('');
  const svg = `<svg viewBox="0 0 ${GRID} ${GRID}" aria-hidden="true"><rect width="${GRID}" height="${GRID}" fill="${bg}"/>${fills}</svg>`;
  svgs.set(id, svg);
  return svg;
}

// 사진 요소 하나. id: 사진 값(풀 수 없는 값이면 첫 사진), slot: 자리 크기(48, 36).
// 어느 사진인지는 data-pic에 남긴다(눌러 보기 점검이 읽는다). 내 그림은 긴 글 대신 'my'다
export function pictureEl(id, slot = 48) {
  const pic = isPicture(id) ? id : USER_PICTURES[0].id;
  const box = h('span', { className: 'user-pic', dataset: { slot, pic: isCustom(pic) ? 'my' : pic } });
  box.innerHTML = pictureSvg(pic);
  return box;
}

// 사진을 고르는 줄과 그 아래의 "그림 파일 찾아보기". 사진을 누르면 그 사진에 고른 표시를 옮기고 onPick(id)를 부른다.
// 그림 파일을 고르면 내 그림으로 줄인 뒤(src/custom-picture.js) 고른 표시를 지우고 onPick(사진 값)을 부른다. 저장은 부르는 쪽이 한다.
// 파일 고르는 칸은 숨겨 두고 단추로 연다. 같은 파일을 다시 골라도 바뀐 것으로 알도록 고른 뒤에 칸을 비운다.
// toast(글, ms): 그림 파일을 열지 못했을 때 알림을 띄우는 함수
export function picturePicker(current, onPick, toast) {
  let turn = 0; // 고를 때마다 하나씩 는다. 그림을 줄이는 동안 다른 사진을 눌렀으면 늦게 끝난 그림은 버린다
  const buttons = USER_PICTURES.map(p => h('button', {
    type: 'button',
    className: 'pic-choice',
    title: p.name,
    'aria-label': p.name,
    onclick: () => {
      turn++;
      mark(p.id);
      onPick(p.id);
    },
  }, pictureEl(p.id, 36)));
  const mark = id => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(USER_PICTURES[i].id === id)));
  mark(current);
  const LABEL = '그림 파일 찾아보기';
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true, tabIndex: -1, 'aria-hidden': 'true' });
  const browse = h('button', { type: 'button', className: 'pic-browse', onclick: () => file.click() }, LABEL);
  file.addEventListener('change', async () => {
    const chosen = file.files[0];
    file.value = '';
    if (!chosen) return;
    const mine = ++turn;
    browse.disabled = true;
    browse.textContent = '그림을 줄이는 중';
    try {
      const v = await makeCustom(chosen);
      if (mine !== turn) return;
      mark(null);
      onPick(v);
    } catch (err) {
      console.warn('그림 파일을 열지 못했다', err);
      toast('그림 파일을 열지 못했습니다. 다른 파일을 골라 주세요.', 7000);
    } finally {
      browse.disabled = false;
      browse.textContent = LABEL;
    }
  });
  return h('span', { className: 'pic-picker-box' },
    h('span', { className: 'pic-picker', role: 'group', 'aria-label': '사진' }, ...buttons),
    browse, file);
}

// 사진 바꾸기 창. 시작 메뉴 맨 위의 내 사진을 누르면 열린다. 사진을 누르거나 그림 파일을 고르면 바로 저장하고 창 위의 큰 사진을 바꾼다.
// 시작 메뉴와 로그인 화면은 열 때마다 새로 그리므로 다음에 열면 바꾼 사진이 나온다.
// 링크를 만들어 둔 방이면 os.saveHome이 서버의 방도 새 사진으로 고친다(예전 긴 링크는 이미 보낸 것이라 그대로다).
// 사진 크기가 무대 배율마다 달라서 창 크기는 열 때의 사진 크기로 정한다. 사진 둘레의 테두리와 여백, 그림 파일 찾아보기,
// 닫기 단추 줄, 창 안쪽 여백을 더한 값이다
export function openPictureWindow(os) {
  const owner = os.home.owner;
  const big = shownSize(48);
  const small = shownSize(36);
  const win = os.wm.open({
    key: 'user-picture',
    app: { title: '사진 바꾸기', color: '#b8577f' },
    title: '사진 바꾸기',
    width: Math.max(400, Math.ceil(8 * (small + 6) + 7 * 4 + 32 + 4)),
    height: Math.ceil(big + small + 121),
    build(body) {
      body.classList.add('pic-app');
      const face = h('span', { className: 'avatar has-pic' }, pictureEl(ownPicture(owner), 48));
      const picker = picturePicker(ownPicture(owner), v => {
        saveOwnPicture(v);
        face.replaceChildren(pictureEl(v, 48));
        os.saveHome(false);
      }, os.toast);
      body.append(
        h('div', { className: 'pic-app-head' }, face, h('b', {}, owner)),
        picker,
        h('div', { className: 'link-row' }, h('button', { type: 'button', className: 'btn', onclick: () => win.close() }, '닫기')),
      );
    },
  });
  return win;
}
