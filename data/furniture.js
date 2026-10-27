// 가구 목록. 새 가구는 한 줄 추가하고 assets/furniture/<id>.png 를 넣으면 된다.
// 이미지가 없으면 color 색의 입체 상자(벽 가구는 액자 모양)로 대신 보여 준다.
//
// scene: 이 가구를 놓을 수 있는 공간 (src/config.js 의 SCENES)
// zone: 'wall'  벽에만 건다. size: [벽을 따라 칸 수, 높이 줄 수]
//       'floor' 바닥에 놓는다. size: [오른쪽 아래 방향 칸 수, 왼쪽 아래 방향 칸 수], height: 화면 높이(px)
//       'top'   바닥에 놓거나 surface 가구 위에 올린다. size, height는 floor와 같다
// surface: true 이면 위에 'top' 가구를 올릴 수 있다 (올라간 가구는 height만큼 떠 있다)
// light:   true 이면 밤에 둘레를 밝힌다. 누르면 밤과 낮이 바뀐다
// gimmick: 눌렀을 때 하는 일. 'night' 밤/낮 바꾸기, 'scene:<id>' 그 공간으로 가기, 'app:<id>' 앱 열기.
//          없으면 기믹이 들어갈 빈 창이 뜬다
export const FURNITURE = [
  // 내 방: 바닥
  { id: 'desk',      scene: 'room', name: '책상',     zone: 'floor', size: [3, 2], height: 56, surface: true, color: '#b08354' },
  { id: 'bed',       scene: 'room', name: '침대',     zone: 'floor', size: [3, 4], height: 40, color: '#8fa9d6' },
  { id: 'sofa',      scene: 'room', name: '소파',     zone: 'floor', size: [3, 2], height: 44, color: '#c9766a' },
  { id: 'bookshelf', scene: 'room', name: '책장',     zone: 'floor', size: [2, 1], height: 124, color: '#9a6b44' },
  { id: 'wardrobe',  scene: 'room', name: '옷장',     zone: 'floor', size: [2, 1], height: 140, color: '#d8c3a0' },
  { id: 'audio',     scene: 'room', name: '오디오',   zone: 'floor', size: [1, 1], height: 96, color: '#5b5b66' },
  { id: 'big-plant', scene: 'room', name: '큰 화분',  zone: 'floor', size: [1, 1], height: 84, color: '#6fae6a' },
  // 내 방: 책상 위 (바닥에도 놓을 수 있다)
  { id: 'computer',  scene: 'room', name: '컴퓨터',   zone: 'top', size: [1, 1], height: 52, color: '#d9d4c7', gimmick: 'app:games' },
  { id: 'lamp',      scene: 'room', name: '스탠드',   zone: 'top', size: [1, 1], height: 70, color: '#e8c35a', light: true, gimmick: 'night' },
  { id: 'mug',       scene: 'room', name: '머그컵',   zone: 'top', size: [1, 1], height: 22, color: '#f2f0ea' },
  { id: 'plant',     scene: 'room', name: '작은 화분', zone: 'top', size: [1, 1], height: 34, color: '#8cc084' },
  { id: 'books',     scene: 'room', name: '책 더미',  zone: 'top', size: [1, 1], height: 26, color: '#6b8fc9' },
  { id: 'clock',     scene: 'room', name: '탁상시계', zone: 'top', size: [1, 1], height: 30, color: '#e07a5f' },
  { id: 'radio',     scene: 'room', name: '카세트',   zone: 'top', size: [2, 1], height: 30, color: '#b5b8bd' },
  { id: 'fishbowl',  scene: 'room', name: '어항',     zone: 'top', size: [1, 1], height: 36, color: '#9fd8e8' },
  // 내 방: 벽
  { id: 'window',    scene: 'room', name: '창문',     zone: 'wall', size: [3, 3], color: '#a9d6e5', gimmick: 'scene:playground' },
  { id: 'frame',     scene: 'room', name: '액자',     zone: 'wall', size: [2, 2], color: '#c97b6b' },
  { id: 'poster',    scene: 'room', name: '포스터',   zone: 'wall', size: [2, 3], color: '#e8b84a' },
  { id: 'wall-clock', scene: 'room', name: '벽시계',  zone: 'wall', size: [1, 1], color: '#f2e6cb' },
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
