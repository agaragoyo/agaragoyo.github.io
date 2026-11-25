// "두 곳에서 고친 방" 창(F36). 같은 사용자의 방을 두 브라우저에서 다르게 고쳤을 때 두 방의 그림을 나란히 보이고 남길 방을 고르게 한다.
// 스팀이 이 컴퓨터와 서버의 저장본이 다를 때 띄우는 고르는 창과 같은 방식이다. 저절로 뜨는 창이라 src/home-sync.js가 조용한 때를 기다려 띄운다.
// 한쪽을 고르면 다른 방은 지워지므로, 고르기 전에 그 결과를 창 아래에 한 줄로 알린다(known-issues 32).
// 고르지 않고 닫으면 아무것도 바꾸지 않는다. 그동안 이 컴퓨터의 방은 올라가지 않고(src/cloud.js의 pauseSync), 내 컴퓨터로 다시 들어오면 다시 묻는다.
import { SCENES } from '../config.js';
import { renderRoomImage, IMAGE_W, IMAGE_H } from '../room-image.js';
import { h } from '../util.js';

const PIC_W = 298;                 // 방 그림의 화면 폭. 두 장과 사이 간격이 창 안쪽 폭에 든다
const PIC_SCALE = 2;               // 그림은 화면 폭의 두 배로 줄여 그린다(화면 배율이 2인 화면에서도 또렷하다)
const PIC_H = Math.round(PIC_W * IMAGE_H / IMAGE_W);

// "11월 25일 23:10에 고침"이고, 시각을 모르면 빈 글자다
function editedAt(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const two = n => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${two(d.getHours())}:${two(d.getMinutes())}에 고침`;
}

// 방 그림(화면과 같은 낮 모습, 아바타는 처음 서는 곳)을 줄여 canvas에 그린다. 만들지 못하면 빈 그림이다
async function drawRoom(canvas, home) {
  const scene = SCENES[0];
  const full = await renderRoomImage(home.scenes[scene.id], scene, null, home.decor);
  const g = canvas.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(full, 0, 0, canvas.width, canvas.height);
}

// mine, theirs: { home: 풀어 낸 방, at: 마지막으로 고친 시각(밀리초, 모르면 0) }. pick(choice): 'mine'이나 'theirs'를 고르면 부른다
export function openTwoRooms(os, { mine, theirs, pick }) {
  const app = { title: '두 곳에서 고친 방', icon: 'builtin:home' };
  return os.wm.open({
    key: 'two-rooms',
    app,
    title: app.title,
    width: 646,
    height: 365,
    build(body, win) {
      body.classList.add('two-rooms');
      let chosen = false;
      const card = (choice, title, { home, at }) => {
        const canvas = h('canvas', { className: 'two-rooms-pic', width: PIC_W * PIC_SCALE, height: PIC_H * PIC_SCALE, role: 'img', 'aria-label': `${title} 그림` });
        const furniture = Object.values(home.scenes).flat().length;
        const when = editedAt(at);
        const info = h('span', { className: 'meta', id: `two-rooms-${choice}` }, [when, `가구 ${furniture}개`].filter(Boolean).join(', '));
        const button = h('button', { type: 'button', className: 'btn', 'aria-describedby': `two-rooms-title-${choice} ${info.id}` }, '이 방 남기기');
        button.addEventListener('click', () => {
          if (chosen) return;
          chosen = true;
          win.close();
          pick(choice);
        });
        drawRoom(canvas, home).catch(err => console.warn('방 그림을 만들지 못했다', err));
        return h('div', { className: 'two-rooms-card' }, h('b', { id: `two-rooms-title-${choice}` }, title), canvas, info, button);
      };
      body.append(
        h('p', {}, '다른 브라우저에서도 이 방을 고쳤습니다. 남길 방을 골라 주세요.'),
        h('div', { className: 'two-rooms-row' }, card('mine', '이 컴퓨터의 방', mine), card('theirs', '서버의 방', theirs)),
        h('p', { className: 'meta two-rooms-note' }, '고르지 않은 방은 지워집니다.'),
      );
    },
  });
}
