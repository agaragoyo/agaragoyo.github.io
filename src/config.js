// 방과 격자의 기본값. 아트 팀과 합의해 바뀌면 이 파일의 숫자만 고친다.
export const CELL = 40;          // 격자 한 칸 (px)
export const COLS = 32;          // 1280 / 40
export const ROWS = 18;          // 720 / 40
export const WALL_ROWS = 11;     // 위에서 11줄(0~10)이 벽, 아래 7줄(11~17)이 바닥

export const ROOM_W = CELL * COLS;   // 1280
export const ROOM_H = CELL * ROWS;   // 720
export const SHELF_H = 120;          // 방 아래 가구 선반 높이
export const STAGE_W = ROOM_W;
export const STAGE_H = ROOM_H + SHELF_H;

export const DRAG_THRESHOLD = 5;     // 이만큼(px) 움직여야 클릭이 아니라 드래그로 본다

export const STORAGE_ROOM = 'agarago.room';
export const STORAGE_SETTINGS = 'agarago.settings';
