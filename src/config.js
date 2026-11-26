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
// 실험실의 '심심할 때 혼잣말'(src/idle-talk.js). 바탕화면을 first(30초) 동안 그냥 두면 아바타가 가구로 가서 혼잣말을 하고,
// 그 뒤로 again(40~60초 사이에서 무작위)마다 되풀이한다. 숫자 대신 객체에 두어 눌러 보기 점검(tools/smoke.mjs)이 시간을 줄여 시험한다
export const IDLE_TALK = { first: 30000, again: [40000, 60000] };
// 분신사바의 공포 모드(src/horror.js)의 시간(ms). 공포 모드의 시간 숫자는 모두 여기에 둔다.
// tilt, far, near, menu는 불이 꺼진 뒤 방이 그만큼 보였을 때 이상한 일이 하나씩 늘어나는 때이고, 이 차례로 일어난다(src/horror.js의 STEPS).
// 다른 탭에 있거나 화면 보호기, 가구 가까이 보기가 떠 있는 동안은 세지 않는다. menu 뒤로는 더 늘지 않고 그대로 머문다.
// 숫자 대신 객체에 두어 눌러 보기 점검(tools/smoke.mjs)이 시간을 줄여 시험한다
export const HORROR = {
  dark: 900,    // 암호를 말하고 불이 꺼질 때까지. 말풍선의 "분신사바"를 읽을 틈이다
  wonder: 1200, // 불이 꺼지고 아바타가 첫마디를 할 때까지
  tilt: 20000,  // 벽에 건 것이 하나 더 기운다(하나뿐이면 그것이 더 기운다)
  far: 45000,   // 아바타에게서 가장 먼 빈칸에서 "여기야." 말풍선이 뜬다
  near: 60000,  // 아바타 바로 옆 빈칸(등 뒤 쪽)에서 "바로 뒤야." 말풍선이 뜨고, 아바타가 돌아본 뒤 "잘못 들었나?"라고 말한다
  menu: 64000,  // 이때부터 시작 메뉴를 열면 불 켜기 글이 한 번 "불 켜지 마"로 보였다 돌아온다
  voice: 2500,  // 빈칸의 말풍선이 떠 있는 동안
  turn: 600,    // 빈칸의 말풍선이 뜨고 아바타가 그쪽을 돌아볼 때까지
  flash: 1500,  // 시작 메뉴의 불 켜기 글이 "불 켜지 마"로 보이는 동안
};
// 말풍선에 999999999를 말하면 날아오는 비둘기 떼(src/pigeon.js)의 마릿수, 칸 수, 시간(ms). 눌러 보기 점검(tools/smoke.mjs)이 줄여 시험하도록 객체에 둔다
export const PIGEON = {
  come: 500,             // 암호를 말하고 첫 비둘기가 창문이나 현관문에 나타날 때까지. 말풍선의 "999999999"를 읽을 틈이다
  max: 9,                // 한 번에 오는 비둘기 수의 한도. 9를 아홉 번 부르는 말장난이다. 앉을 빈칸이 모자라면 앉을 수 있는 만큼만 온다
  gap: [150, 250],       // 비둘기가 한 마리씩 줄줄이 날아 들어오는 간격(이 사이에서 무작위)
  stay: [12000, 18000],  // 다 내려앉은 뒤 날아 나가기까지(이 사이에서 무작위)
  rest: [2500, 4500],    // 방에 있는 동안 서 있다가 다시 걷기까지(이 사이에서 무작위. 펫은 10~20초)
  roam: 2,               // 걸을 때 내려앉은 칸에서 가로와 세로로 이만큼(칸) 안의 칸으로만 간다. 떼가 방 곳곳으로 흩어지지 않는다
  coo: 2000,             // "구구" 말풍선이 떠 있는 동안
  chorus: [2, 3],        // 내려앉은 뒤 차례로 "구구" 하는 비둘기 수(이 사이에서 무작위). 앞 비둘기의 말풍선이 사라지면 다음 비둘기가 운다
  wave: [60, 110],       // 떼가 날아오를 때 한 마리씩 뜨는 간격(이 사이에서 무작위). 놀라게 한 쪽에 가까운 비둘기부터 뜬다
};

// 가구에 올라가는 펫(data/pets.js의 mood.perch, 고양이)이 얼마나 자주 올라가고 얼마나 머무는지(src/pet.js).
// 숫자 대신 객체에 두어 눌러 보기 점검(tools/smoke.mjs)이 몫과 시간을 바꿔 시험한다(새로 고침하면 원래대로 돌아온다)
export const PERCH = {
  start: 0.5,           // 방에 처음 나올 때 가구 위에서 시작하는 몫(0~1). 집에 와 보면 고양이가 침대에 올라가 있다
  odds: 0.5,            // 혼자 놀다 쉬고 일어날 때 바닥 대신 가구로 가는 몫(0~1)
  stay: [20000, 40000], // 가구 위에 웅크리고 있는 시간(이 사이에서 무작위). 바닥에서 쉬는 시간(10~20초)의 두 배다
};

// 집 안의 공간들. 지금은 내 방 하나이고, kind 'indoor'는 벽과 바닥이 있는 방이다.
// 새 공간을 넣으려면 여기에 한 줄, 가구 목록의 scene 에 그 id를 쓴다. 바탕화면은 첫 공간(내 방)에서 시작한다.
// door: 방의 현관문. 벽 wall('L'|'R')의 칸 x부터 w칸, 바닥에서 h줄 높이다.
//       가구가 아니라 방 그림의 일부라 늘 있다. 두 번 누르면 아바타가 걸어간 뒤 이웃집 목록 창이 뜬다(src/neighbors.js의 openNeighbors).
//       방 꾸미기에서는 이 자리에 벽 가구를 걸 수 없다(예전에 걸어 둔 가구는 그대로 둔다, src/rules.js의 coversDoor).
export const SCENES = [
  { id: 'room', name: '내 방', kind: 'indoor', door: { wall: 'L', x: 9, w: 2, h: 4 } },
];

// 새로 만든 방의 벽지와 바닥(data/wall-patterns.js, data/floor-patterns.js의 id). 새 사용자를 만들 때(src/login.js)와 튜토리얼 다시 보기의 연습 방(src/os.js의 startPractice)이 쓴다.
// 이미 만든 방은 바뀌지 않는다. 벽지와 바닥을 적지 않은 집은 예전처럼 기본 벽과 기본 바닥(plain)이다
export const NEW_ROOM_DECOR = { wall: 'stripe', floor: 'wood' };

export const STORAGE_ROOM = 'agarago.home.v3';
export const STORAGE_ROOM_OLD = 'agarago.room.v2'; // 공간이 하나뿐이던 때의 저장본 (내 방으로 옮겨 온다)
export const STORAGE_SETTINGS = 'agarago.settings';
export const STORAGE_TUTORIAL = 'agarago.tutorial'; // 튜토리얼 진행 상태(src/tutorial.js)
// 이 브라우저에서 아바타 말풍선에 한 번이라도 말했는지(src/avatar.js). 말하기 전까지 아바타 머리 위에 말하기 표시를 띄운다.
// 설정과 달리 이 컴퓨터 초기화가 지워서, 초기화한 뒤 새로 온 사람에게 다시 뜬다
export const STORAGE_SAID = 'agarago.said';
export const STORAGE_CLOUD = 'agarago.cloud'; // 서버에 올린 방의 번호와 익명 로그인(src/cloud.js)
export const STORAGE_PICTURE = 'agarago.picture'; // 내 사용자 사진의 id(data/user-pictures.js, src/user-pictures.js)
export const STORAGE_RECENT = 'agarago.recent'; // 최근에 놀러 간 집(로그인 화면 오른쪽 단 맨 위, src/neighbors.js의 recentVisits)
export const STORAGE_QUIZ = 'agarago.quiz'; // 손님으로 풀고 채점한 시험지의 고른 답(src/apps/test-paper-app.js)
export const STORAGE_SEAT = 'agarago.seat'; // 이 컴퓨터에 앉은 사용자가 바뀔 때마다 새로 남기는 무작위 표시(src/seat.js)
// 새 기능 안내 창을 이 사용자가 봤는지(src/user-account.js의 openLoginNews). 새 사용자는 튜토리얼 끝 카드가 알리므로 만들 때 본 것으로 둔다.
// 사용자의 것이라 이 컴퓨터 초기화와 이 컴퓨터에서 지우기가 지운다
export const STORAGE_NEWS = 'agarago.news';
