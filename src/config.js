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

// 집 안의 공간들. 'indoor'는 벽과 바닥이 있는 방, 'outdoor'는 울타리와 땅만 있는 바깥이다.
// 새 공간을 넣으려면 여기에 한 줄, 가구 목록의 scene 에 그 id를 쓴다.
export const SCENES = [
  { id: 'room', name: '내 방', kind: 'indoor' },
  { id: 'playground', name: '놀이터', kind: 'outdoor' },
];

export const STORAGE_ROOM = 'agarago.home.v3';
export const STORAGE_ROOM_OLD = 'agarago.room.v2'; // 공간이 하나뿐이던 때의 저장본 (내 방으로 옮겨 온다)
export const STORAGE_SETTINGS = 'agarago.settings';
