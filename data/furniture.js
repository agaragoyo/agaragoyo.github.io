// 가구 목록. 새 가구는 한 줄 추가하고 assets/furniture/<id>.png 를 넣으면 된다.
// 이미지가 없으면 color 색의 입체 상자(벽 가구는 액자 모양)로 대신 보여 준다.
// 바닥 가구와 책상 위 물건은 끄는 동안 R 키나 휠로 돌릴 수 있다(칸이 정사각형이어도 돌린다). 돌린 모습은 assets/furniture/<id>-r.png 가 있으면 그 그림을,
// 없으면 원래 그림을 좌우로 뒤집어 쓴다(아이소메트릭에서는 뒤집으면 다른 방향을 보는 모습이 된다).
//
// scene: 이 가구를 놓을 수 있는 공간 (src/config.js 의 SCENES)
// zone: 'wall'  벽에만 건다. size: [벽을 따라 칸 수, 높이 줄 수]
//       'floor' 바닥에 놓는다. size: [오른쪽 아래 방향 칸 수, 왼쪽 아래 방향 칸 수], height: 화면 높이(px)
//       'top'   바닥에 놓거나 surface 가구 위에 올린다. size, height는 floor와 같다
// surface: true 이면 위에 'top' 가구를 올릴 수 있다 (올라간 가구는 height만큼 떠 있다)
// light:   true 이면 밤에 둘레를 밝힌다. 누르면 밤과 낮이 바뀐다
// gimmick: 눌렀을 때 하는 일. 'night' 밤/낮 바꾸기, 'scene:<id>' 그 공간으로 가기, 'app:<id>' 앱 열기.
//          바탕화면에서 가구를 두 번 누르면 아바타가 옆으로 가서 쓴다. 없으면 아바타가 가구 이름을 말한다
export const FURNITURE = [
  // 내 방: 바닥
  { id: 'desk',      scene: 'room', name: '책상',     zone: 'floor', size: [3, 2], height: 62, surface: true, color: '#ede8da' },
  { id: 'dining-table', scene: 'room', name: '식탁', zone: 'floor', size: [2, 2], height: 70, color: '#efe7cf' },
  { id: 'bed',       scene: 'room', name: '침대',     zone: 'floor', size: [3, 4], height: 68, color: '#c4b094' },
  { id: 'sofa',      scene: 'room', name: '소파',     zone: 'floor', size: [3, 2], height: 44, color: '#c9766a' },
  { id: 'bookshelf', scene: 'room', name: '책장',     zone: 'floor', size: [2, 1], height: 120, color: '#685447', gimmick: 'app:bookshelf' },
  { id: 'wardrobe',  scene: 'room', name: '옷장',     zone: 'floor', size: [2, 1], height: 118, color: '#e0d9a1' },
  { id: 'armchair',  scene: 'room', name: '1인 소파', zone: 'floor', size: [2, 2], height: 71, color: '#cdc39e' },
  { id: 'fridge',    scene: 'room', name: '냉장고',   zone: 'floor', size: [2, 1], height: 129, color: '#eddfd0' },
  { id: 'lamp',      scene: 'room', name: '스탠드',   zone: 'floor', size: [1, 1], height: 120, color: '#d1be9a', light: true, gimmick: 'night' },
  { id: 'audio',     scene: 'room', name: '오디오',   zone: 'floor', size: [1, 1], height: 96, color: '#5b5b66' },
  { id: 'big-plant', scene: 'room', name: '큰 화분',  zone: 'floor', size: [1, 1], height: 84, color: '#5c643b' },
  // 내 방: 책상 위 (바닥에도 놓을 수 있다)
  { id: 'computer',  scene: 'room', name: '컴퓨터',   zone: 'top', size: [1, 1], height: 48, color: '#d7d3c8', gimmick: 'app:computer' },
  { id: 'tv',        scene: 'room', name: 'TV',       zone: 'top', size: [2, 1], height: 57, color: '#939d8a', gimmick: 'app:tv' },
  { id: 'console',   scene: 'room', name: '게임기',   zone: 'top', size: [1, 1], height: 4, color: '#9f9498', gimmick: 'app:console' },
  { id: 'camera',    scene: 'room', name: '디카',     zone: 'top', size: [1, 1], height: 12, color: '#b6b6b2' },
  { id: 'diary',     scene: 'room', name: '다이어리', zone: 'top', size: [1, 1], height: 4, color: '#af7570' },
  { id: 'desk-lamp', scene: 'room', name: '초록 탁상 조명', zone: 'top', size: [1, 1], height: 29, color: '#6d825f', light: true, gimmick: 'night' },
  { id: 'desk-lamp-2', scene: 'room', name: '빨간 탁상 조명', zone: 'top', size: [1, 1], height: 32, color: '#b84d32', light: true, gimmick: 'night' },
  { id: 'mug',       scene: 'room', name: '머그컵',   zone: 'top', size: [1, 1], height: 22, color: '#f2f0ea' },
  { id: 'plant',     scene: 'room', name: '작은 화분', zone: 'top', size: [1, 1], height: 34, color: '#8cc084' },
  { id: 'books',     scene: 'room', name: '책 더미',  zone: 'top', size: [1, 1], height: 11, color: '#b4b8a1' },
  { id: 'clock',     scene: 'room', name: '탁상시계', zone: 'top', size: [1, 1], height: 30, color: '#e07a5f' },
  { id: 'radio',     scene: 'room', name: '라디오',   zone: 'top', size: [2, 1], height: 30, color: '#e0dacc', gimmick: 'app:radio' },
  { id: 'fishbowl',  scene: 'room', name: '어항',     zone: 'top', size: [1, 1], height: 36, color: '#9fd8e8' },
  // 내 방: 벽
  // 창문은 2026-11-10까지 두 번 누르면 놀이터로 나갔다. 지금은 방 벽의 현관문(src/config.js의 SCENES door)이 그 일을 한다
  { id: 'window',    scene: 'room', name: '창문',     zone: 'wall', size: [3, 3], color: '#c2cec8' },
  { id: 'wide-window', scene: 'room', name: '넓은 창문', zone: 'wall', size: [4, 3], color: '#cdd6d1' },
  { id: 'beads-window', scene: 'room', name: '비즈 발 창문', zone: 'wall', size: [3, 3], color: '#a7bfba' },
  { id: 'wide-beads-window', scene: 'room', name: '비즈 발 넓은 창문', zone: 'wall', size: [4, 3], color: '#b1c6c1' },
  { id: 'frame',     scene: 'room', name: '액자',     zone: 'wall', size: [2, 2], color: '#c97b6b' },
  { id: 'poster',    scene: 'room', name: '포스터',   zone: 'wall', size: [2, 3], color: '#8e9490' },
  { id: 'wall-clock', scene: 'room', name: '벽시계',  zone: 'wall', size: [1, 1], color: '#f2e6cb' },
  // 코르크 보드: 손님이 쪽지를 붙이는 방명록(시험, src/apps/corkboard-app.js). 그림이 오기 전까지는 코르크색 액자 상자로 보인다
  { id: 'corkboard', scene: 'room', name: '코르크 보드', zone: 'wall', size: [3, 2], color: '#c69a64', gimmick: 'app:corkboard' },
  // 놀이터
  { id: 'sandbox',   scene: 'playground', name: '모래 놀이터', zone: 'floor', size: [3, 3], height: 14, color: '#e3cf98' },
  { id: 'slide',     scene: 'playground', name: '미끄럼틀', zone: 'floor', size: [3, 1], height: 96, color: '#e5534b' },
  { id: 'swing',     scene: 'playground', name: '그네',     zone: 'floor', size: [3, 1], height: 112, color: '#4a90c2' },
  { id: 'seesaw',    scene: 'playground', name: '시소',     zone: 'floor', size: [3, 1], height: 30, color: '#f2c14e' },
  { id: 'bench',     scene: 'playground', name: '벤치',     zone: 'floor', size: [2, 1], height: 30, color: '#8b6a4a' },
  { id: 'tree',      scene: 'playground', name: '나무',     zone: 'floor', size: [1, 1], height: 150, color: '#5a9a4f' },
  { id: 'streetlight', scene: 'playground', name: '가로등', zone: 'floor', size: [1, 1], height: 160, color: '#6d7380', light: true, gimmick: 'night' },
];

export const BY_ID = Object.fromEntries(FURNITURE.map(f => [f.id, f]));

// 튜토리얼(src/tutorial.js)에서 놓아 보는 기본 가구. 여기의 id만 바꾸면 안내 문구와 화살표가 따라간다.
//   first  놓는 법을 배우는 가구. 기믹을 쓰지 않으므로 내 방 가구 아무거나 된다. 가구별 인터랙션이 정해지면 바뀔 수 있다
//   light  가구를 쓸 수 있다는 것을 배우는 가구. gimmick: 'night'여야 한다
// 놀이터는 가구가 아니라 방 벽의 현관문으로 나가서 배운다(2026-11-10까지는 door: 'window'로 창문을 놓고 썼다).
export const TUTORIAL_FURNITURE = { first: 'bed', light: 'lamp' };
