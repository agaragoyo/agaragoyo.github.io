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
// perch:   고양이처럼 가구에 올라가는 펫(data/pets.js의 mood.perch)이 앉는 윗면의 높이(무대 px). 바닥 가구에만 두고, 없으면 올라가지 않는다.
//          가구 그림에서 잰 값이라 그림을 바꾸면 다시 잰다(침대는 이불 위, 1인 소파는 방석 위다). 한 번에 뛰어오를 수 있게 75px 이하로 둔다
// perchAt: 앉는 자리 [가로 칸, 세로 칸]. 돌리지 않은 가구의 뒤쪽 꼭짓점(화면에서 가장 위의 바닥 모서리)에서 잰 칸 수(소수)이고 펫의 발끝이 놓인다.
//          없으면 윗면이 평평한 가구라 칸마다 가운데에 앉고, 책상 위 물건이 놓인 칸은 뺀다(src/rules.js의 perchesOf)
// light:   true 이면 밤에 둘레를 밝힌다. 누르면 밤과 낮이 바뀐다
// gimmick: 눌렀을 때 하는 일. 'night' 밤/낮 바꾸기, 'scene:<id>' 그 공간으로 가기, 'app:<id>' 앱 열기.
//          바탕화면에서 가구를 두 번 누르면 아바타가 옆으로 가서 쓴다. 없으면 아바타가 say의 혼잣말을 한다
// say:     기믹이 없는 가구를 두 번 눌렀을 때 아바타가 하는 혼잣말 한 줄. 반말로, 이름만 되풀이하지 않고 그 물건을 본 사람이 할 말로 쓴다.
//          말풍선 한 줄에 들어가는 13자 이하(공백과 문장부호 포함)여야 하고 작은따옴표(')는 쓰지 않는다(tools/check.py가 본다).
//          {시각}은 지금 시각("3시 40분")으로 바뀐다(시계). say가 없는 가구는 "옷장이네."처럼 이름을 말한다.
//          줄을 꺼내는 곳은 src/furniture-line.js의 furnitureLine(def). 옷장, 디카, 다이어리, 냉장고, 화분, 포스터는 인터랙션이 생기기 전까지 쓰는 임시 줄이다
export const FURNITURE = [
  // 내 방: 바닥
  { id: 'desk',      scene: 'room', name: '책상',     zone: 'floor', size: [3, 2], height: 62, surface: true, perch: 62, color: '#ede8da', say: '숙제는 내일 해야지.' },
  { id: 'dining-table', scene: 'room', name: '식탁', zone: 'floor', size: [2, 2], height: 70, surface: true, perch: 70, color: '#efe7cf', say: '슬슬 밥 먹을까.' },
  { id: 'bed',       scene: 'room', name: '침대',     zone: 'floor', size: [3, 4], height: 68, perch: 30, perchAt: [1.5, 3], color: '#c4b094', say: '눕자마자 잠들겠다.' },
  { id: 'sofa',      scene: 'room', name: '소파',     zone: 'floor', size: [3, 2], height: 44, color: '#c9766a', say: '푹 파묻히고 싶다.' },
  { id: 'bookshelf', scene: 'room', name: '책장',     zone: 'floor', size: [2, 1], height: 120, color: '#685447', gimmick: 'app:bookshelf' },
  { id: 'wardrobe',  scene: 'room', name: '옷장',     zone: 'floor', size: [2, 1], height: 118, color: '#e0d9a1', say: '입을 옷이 없네.' },
  { id: 'armchair',  scene: 'room', name: '1인 소파', zone: 'floor', size: [2, 2], height: 71, perch: 30, perchAt: [1, 1], color: '#cdc39e', say: '여긴 내 지정석이야.' },
  { id: 'fridge',    scene: 'room', name: '냉장고',   zone: 'floor', size: [2, 1], height: 129, color: '#eddfd0', say: '출출한데 뭐 있나.' },
  { id: 'lamp',      scene: 'room', name: '스탠드',   zone: 'floor', size: [1, 1], height: 120, color: '#d1be9a', light: true, gimmick: 'night' },
  { id: 'audio',     scene: 'room', name: '오디오',   zone: 'floor', size: [1, 1], height: 96, color: '#5b5b66', say: '노래 듣고 싶은데.' },
  { id: 'big-plant', scene: 'room', name: '큰 화분',  zone: 'floor', size: [1, 1], height: 84, color: '#5c643b', say: '물을 자주 줘야겠다.' },
  // 내 방: 책상이나 식탁 위 (바닥에도 놓을 수 있다)
  { id: 'computer',  scene: 'room', name: '컴퓨터',   zone: 'top', size: [1, 1], height: 48, color: '#d7d3c8', gimmick: 'app:computer' },
  { id: 'tv',        scene: 'room', name: 'TV',       zone: 'top', size: [2, 1], height: 57, color: '#939d8a', gimmick: 'app:tv' },
  { id: 'console',   scene: 'room', name: '게임기',   zone: 'top', size: [1, 1], height: 4, color: '#9895a4', gimmick: 'app:console' },
  { id: 'camera',    scene: 'room', name: '디카',     zone: 'top', size: [1, 1], height: 12, color: '#b6b6b2', say: '메모리 카드 남았나.' },
  { id: 'diary',     scene: 'room', name: '다이어리', zone: 'top', size: [1, 1], height: 4, color: '#af7570', say: '오늘은 뭘 적지.' },
  { id: 'desk-lamp', scene: 'room', name: '초록 탁상 조명', zone: 'top', size: [1, 1], height: 29, color: '#6d825f', light: true, gimmick: 'night' },
  { id: 'desk-lamp-2', scene: 'room', name: '빨간 탁상 조명', zone: 'top', size: [1, 1], height: 32, color: '#b84d32', light: true, gimmick: 'night' },
  { id: 'mug',       scene: 'room', name: '머그컵',   zone: 'top', size: [1, 1], height: 22, color: '#f2f0ea', say: '따뜻한 차가 당기네.' },
  { id: 'plant',     scene: 'room', name: '작은 화분', zone: 'top', size: [1, 1], height: 34, color: '#8cc084', say: '조그만 게 야무지네.' },
  { id: 'books',     scene: 'room', name: '책 더미',  zone: 'top', size: [1, 1], height: 11, color: '#b4b8a1', say: '언제 다 읽지.' },
  { id: 'clock',     scene: 'room', name: '탁상시계', zone: 'top', size: [1, 1], height: 30, color: '#e07a5f', say: '벌써 {시각}이네.' },
  { id: 'radio',     scene: 'room', name: '라디오',   zone: 'top', size: [2, 1], height: 30, color: '#e0dacc', gimmick: 'app:radio' },
  { id: 'fishbowl',  scene: 'room', name: '어항',     zone: 'top', size: [1, 1], height: 36, color: '#9fd8e8', say: '멍하니 보게 된다.' },
  // 시험지: 주인이 낸 객관식 문제를 손님이 풀고 점수를 받는다(src/apps/test-paper-app.js). 그림이 오기 전까지는 종이색 상자로 보인다
  { id: 'test-paper', scene: 'room', name: '시험지', zone: 'top', size: [1, 1], height: 4, color: '#f3eedd', gimmick: 'app:test-paper' },
  // 내 방: 벽
  { id: 'window',    scene: 'room', name: '창문',     zone: 'wall', size: [3, 3], color: '#c2cec8', say: '바깥 날씨는 어떨까.' },
  { id: 'wide-window', scene: 'room', name: '넓은 창문', zone: 'wall', size: [4, 3], color: '#cdd6d1', say: '탁 트여서 시원하다.' },
  { id: 'beads-window', scene: 'room', name: '비즈 발 창문', zone: 'wall', size: [3, 3], color: '#a7bfba', say: '바람 불면 찰랑이겠다.' },
  { id: 'wide-beads-window', scene: 'room', name: '비즈 발 넓은 창문', zone: 'wall', size: [4, 3], color: '#b1c6c1', say: '비즈에 햇빛이 반짝이네.' },
  { id: 'frame',     scene: 'room', name: '액자',     zone: 'wall', size: [2, 2], color: '#c97b6b', say: '사진 잘 나왔네.' },
  { id: 'poster',    scene: 'room', name: '포스터',   zone: 'wall', size: [2, 3], color: '#8e9490', say: '볼수록 멋있어.' },
  { id: 'wall-clock', scene: 'room', name: '벽시계',  zone: 'wall', size: [1, 1], color: '#f2e6cb', say: '{시각}이구나.' },
  // 코르크 보드: 손님이 쪽지를 붙이는 방명록(시험, src/apps/corkboard-app.js). 그림이 오기 전까지는 코르크색 액자 상자로 보인다
  { id: 'corkboard', scene: 'room', name: '코르크 보드', zone: 'wall', size: [3, 2], color: '#c69a64', gimmick: 'app:corkboard' },
];

export const BY_ID = Object.fromEntries(FURNITURE.map(f => [f.id, f]));

// 튜토리얼(src/tutorial.js)에서 놓아 보는 기본 가구. 여기의 id만 바꾸면 안내 문구와 화살표가 따라간다.
//   first  놓는 법을 배우는 가구. 기믹을 쓰지 않으므로 내 방 가구 아무거나 된다. 가구별 인터랙션이 정해지면 바뀔 수 있다
//   light  가구를 쓸 수 있다는 것을 배우는 가구. gimmick: 'night'여야 한다
// 이웃집 가기는 가구가 아니라 방 벽의 현관문으로 배운다.
export const TUTORIAL_FURNITURE = { first: 'bed', light: 'lamp' };
