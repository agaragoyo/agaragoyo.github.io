// 방과 격자의 기본값. 아트 팀과 합의해 바뀌면 이 파일의 숫자만 고친다.
// 시점은 2:1 아이소메트릭(싸이월드 미니룸처럼 왼쪽 벽, 오른쪽 벽, 마름모 바닥)이다.
export const N = 12;            // 바닥 12×12칸
export const TW = 72;           // 바닥 한 칸의 화면 가로 (px)
export const TH = 36;           // 바닥 한 칸의 화면 세로 (px), TW의 절반
export const WALL_ROWS = 7;     // 벽 높이 (줄)
export const WH = 36;           // 벽 한 줄의 높이 (px)
export const ORIGIN = { x: 640, y: 270 }; // 바닥 마름모의 뒤쪽 꼭짓점 (두 벽이 만나는 곳)

export const ROOM_W = 1280;
export const ROOM_H = 720;
export const SHELF_H = 120;          // 방 아래 가구 선반 높이
export const STAGE_W = ROOM_W;
export const STAGE_H = ROOM_H + SHELF_H;

export const DRAG_THRESHOLD = 5;     // 이만큼(px) 움직여야 클릭이 아니라 드래그로 본다
export const DESK_W = STAGE_W;       // 바탕화면(창이 움직이는 곳) 크기. 아래 40px은 작업 표시줄이다
export const DESK_H = STAGE_H - 40;
export const DOUBLE_CLICK_MS = 400;  // 이 시간 안에 두 번 누르면 더블클릭(예전 볼록 화면이 dblclick을 넘기지 못해 직접 재게 만들었다)
export const SAVER_MS = 120000;      // 바탕화면을 이만큼(2분) 그냥 두면 화면 보호기가 돈다(src/screensaver.js)
export const SAVER_FAST_MS = 20000;  // 실험실의 '화면 보호기 빨리 보기'를 켜면 SAVER_MS 대신 쓴다(src/labs.js)

// 집 안의 공간들. 'indoor'는 벽과 바닥이 있는 방, 'outdoor'는 울타리와 땅만 있는 바깥이다.
// 새 공간을 넣으려면 여기에 한 줄, 가구 목록의 scene 에 그 id를 쓴다. 바탕화면은 첫 공간(내 방)에서 시작한다.
// gate: 바깥 공간에서 내 방으로 돌아가는 울타리 문. 오른쪽 뒤 울타리(y = 0 줄)의 칸 x부터 w칸이다.
//       바탕화면에서 두 번 누르면 아바타가 걸어가 내 방으로 돌아가고, 이 공간에 들어올 때는 문으로 막 들어온 칸에 선다.
// door: 방에서 바깥 공간(to)으로 나가는 현관문. 벽 wall('L'|'R')의 칸 x부터 w칸, 바닥에서 h줄 높이다.
//       가구가 아니라 방 그림의 일부라 늘 있다. 두 번 누르면 아바타가 걸어가 나가고, 방에 들어올 때는 문 앞 칸에 선다.
//       방 꾸미기에서는 이 자리에 벽 가구를 걸 수 없다(예전에 걸어 둔 가구는 그대로 둔다, src/rules.js의 coversDoor).
// neighbors: true이면 이 바깥 공간의 왼쪽 울타리(x = 0 줄)에 이웃집 문을 단다(data/neighbors.js, src/neighbors.js).
export const SCENES = [
  { id: 'room', name: '내 방', kind: 'indoor', door: { wall: 'L', x: 9, w: 2, h: 4, to: 'playground' } },
  { id: 'playground', name: '놀이터', kind: 'outdoor', gate: { x: 5, w: 2 }, neighbors: true },
];

export const STORAGE_ROOM = 'agarago.home.v3';
export const STORAGE_ROOM_OLD = 'agarago.room.v2'; // 공간이 하나뿐이던 때의 저장본 (내 방으로 옮겨 온다)
export const STORAGE_SETTINGS = 'agarago.settings';
export const STORAGE_TUTORIAL = 'agarago.tutorial'; // 튜토리얼 진행 상태(src/tutorial.js)
export const STORAGE_CLOUD = 'agarago.cloud'; // 서버에 올린 방의 번호와 익명 로그인(src/cloud.js)
export const STORAGE_PICTURE = 'agarago.picture'; // 내 사용자 사진의 id(data/user-pictures.js, src/user-pictures.js)
