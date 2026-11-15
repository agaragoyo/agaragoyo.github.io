// 실험실의 '놀이터에 눈'(snow, src/labs.js). 켜 둔 동안 바탕화면의 바깥 공간(놀이터)에 픽셀 눈이 계속 내린다(docs/requirements.md의 눈 줄).
// 날짜와 실제 날씨는 따르지 않는다. 실험실은 모양과 무게를 바로 보려는 곳이라 눈 오는 날을 기다리지 않게 했다.
// 모두에게 켤지, 켠다면 언제 내릴지(겨울에 날짜로 정한 날, 겨울 내내, 주인이 고르기)는 팀이 써 보고 정한다.
//
// 송이는 무대 2~3px 네모 하나다. 방과 가구가 픽셀 그림이라 둥글게 그리지 않는다. 64송이가 초당 84~140px(무대 높이 840px를 6~10초)로
// 좌우로 조금 흔들리며 내리고, 큰 송이가 더 빨라 가까이 있는 눈처럼 보인다. 송이 바로 아래에 반투명한 푸른 그늘 한 칸을 달아
// 밝은 하늘과 아파트 벽 앞에서도 보이게 했다.
// 바탕화면 크기(1280×800)의 캔버스 한 장에 화면 픽셀 단위로 그린다. 송이의 크기와 자리를 화면 픽셀 정수 개로 맞춰서
// 무대 배율이 정수가 아니어도 송이마다 굵기가 같다(known-issues 67, src/icons.js의 fitPixelIcons와 같은 까닭).
// 캔버스는 방 상자(.wallpaper) 안에서 가구와 아바타, 밤 그늘 위에 덮이고 말풍선과 이름표 아래에 놓인다(style.css의 .snow).
// 방 상자가 쌓임 맥락이라 바탕화면 아이콘, 가구 가까이 보기, 창, 작업 표시줄보다는 늘 아래다(known-issues 7). 누르기는 받지 않는다.
// 방을 다시 그리면 방 상자가 비워지므로 그 뒤에 다시 붙인다(known-issues 22, os.js의 syncSnow가 renderWallpaper 끝에서 부른다).
// requestAnimationFrame으로 돌려 탭이 뒤로 가면 멈추고, 움직임은 지난 시간으로 계산한다(known-issues 23).
// 운영체제의 움직임 줄이기를 켠 사람에게는 내리지 않는다.
import { DESK_W, DESK_H } from './config.js';
import { reduceMotion } from './util.js';

const COUNT = 64;          // 한 화면(바탕화면)에 내리는 송이 수
const SIZE = [2, 3];       // 작은 송이와 큰 송이의 크기(무대 px)
const BIG = 0.4;           // 큰 송이의 비율
const SPEED = [84, 140];   // 떨어지는 빠르기(무대 px/초). 작은 송이는 앞쪽 절반, 큰 송이는 뒤쪽 절반에서 고른다
const SWAY = [3, 8];       // 좌우로 흔들리는 폭(무대 px)
const SWAY_S = [2.5, 5];   // 한 번 흔들리는 데 걸리는 시간(초)
const MAX_DT = 0.1;        // 한 프레임에 흐르게 둘 가장 긴 시간(초). 탭이 뒤로 갔다 오면 멈췄던 자리에서 잇는다
const FLAKE = '#ffffff';
const SHADE = 'rgba(64, 96, 140, 0.45)'; // 송이 아래 한 칸짜리 그늘

const pick = ([lo, hi]) => lo + Math.random() * (hi - lo);

// 송이 하나. y는 송이 위쪽 끝(무대 px)이고, 처음에는 화면 아무 데나, 바닥 밑으로 나가면 화면 바로 위에서 다시 시작한다
function flake(y) {
  const big = Math.random() < BIG;
  const mid = (SPEED[0] + SPEED[1]) / 2;
  return {
    big,
    x: Math.random() * DESK_W,
    y,
    v: big ? pick([mid, SPEED[1]]) : pick([SPEED[0], mid]),
    sway: pick(SWAY),
    turn: (2 * Math.PI) / pick(SWAY_S),
    phase: Math.random() * 2 * Math.PI,
  };
}

// layer: 바탕화면의 방 상자(#wallpaper). 캔버스를 그 안에 넣는다
// 돌려주는 것: set(on). 켜면 내리고 끄면 바로 그친다. 이미 내리는 중에 다시 켜면 캔버스만 다시 붙이고 송이는 하던 대로 잇는다
export function createSnow(layer) {
  const rootStyle = getComputedStyle(document.documentElement); // 무대 배율(--u, src/main.js의 fit)을 읽는다
  let canvas = null;
  let ctx = null;
  let flakes = [];
  let raf = 0;
  let last = 0;   // 지난 프레임의 시각(ms). 0이면 첫 프레임이다
  let clock = 0;  // 흔들림에 쓰는 시간(초). 탭이 뒤로 간 동안은 흐르지 않는다
  let k = 0;      // 무대 1px가 화면 픽셀 몇 개인지(무대 배율 × devicePixelRatio)

  // 캔버스 한 칸이 화면 픽셀 하나가 되게 맞춘다. 창 크기나 화면 픽셀 비율이 바뀌면 다음 프레임에 따라간다
  function fit() {
    const next = (parseFloat(rootStyle.getPropertyValue('--u')) || 1) * (devicePixelRatio || 1);
    if (next === k) return;
    k = next;
    canvas.width = Math.max(1, Math.round(DESK_W * k));
    canvas.height = Math.max(1, Math.round(DESK_H * k));
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(MAX_DT, Math.max(0, now - last) / 1000) : 0;
    last = now;
    clock += dt;
    fit();
    // 송이와 그늘의 크기(화면 픽셀). 아주 작은 화면에서도 큰 송이가 작은 송이보다 한 픽셀은 크다
    const small = Math.max(1, Math.round(SIZE[0] * k));
    const big = Math.max(small + 1, Math.round(SIZE[1] * k));
    const shade = Math.max(1, Math.round(k));
    for (let i = 0; i < flakes.length; i++) {
      const f = flakes[i];
      f.y += f.v * dt;
      if (f.y > DESK_H) flakes[i] = flake(-SIZE[1] - 1);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 그늘을 먼저 모두 칠하고 송이를 그 위에 칠한다. 겹친 송이의 흰 칸을 다른 송이의 그늘이 덮지 않게 한다
    const spots = flakes.map(f => {
      const s = f.big ? big : small;
      const x = Math.round((f.x + f.sway * Math.sin(f.turn * clock + f.phase)) * k);
      return [x, Math.round(f.y * k), s];
    });
    ctx.fillStyle = SHADE;
    for (const [x, y, s] of spots) ctx.fillRect(x, y + s, s, shade);
    ctx.fillStyle = FLAKE;
    for (const [x, y, s] of spots) ctx.fillRect(x, y, s, s);
  }

  function set(on) {
    if (!on || reduceMotion) {
      if (!canvas) return;
      cancelAnimationFrame(raf);
      canvas.remove();
      canvas = ctx = null;
      flakes = [];
      return;
    }
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'snow';
      canvas.setAttribute('aria-hidden', 'true');
      ctx = canvas.getContext('2d');
      k = 0;
      last = 0;
      // 처음부터 내리고 있던 것처럼 화면 위에서 아래까지 고루 흩어 놓는다
      flakes = Array.from({ length: COUNT }, () => flake(Math.random() * (DESK_H + SIZE[1]) - SIZE[1]));
      raf = requestAnimationFrame(frame);
    }
    if (canvas.parentNode !== layer) layer.append(canvas);
  }

  return { set };
}
