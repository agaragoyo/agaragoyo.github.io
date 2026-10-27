// 가구 목록. 새 가구는 한 줄 추가하고 assets/furniture/<id>.png 를 넣으면 된다.
// 이미지가 없으면 color 색 상자에 이름을 적어 대신 보여 준다.
//
// size: [가로 칸, 세로 칸]
// zone: 'wall'  벽에만 건다 (액자, 창문)
//       'floor' 바닥에 놓는다 (밑변이 바닥 줄에 닿아야 함)
//       'top'   바닥에 놓거나, surface 가구 위에 올린다 (컴퓨터, 스탠드)
// surface: true 이면 위에 'top' 가구를 올릴 수 있다
export const FURNITURE = [
  { id: 'desk',     name: '책상',     size: [4, 2], zone: 'floor', surface: true, color: '#b08354' },
  { id: 'computer', name: '컴퓨터',   size: [2, 2], zone: 'top',   color: '#d9d4c7' },
  { id: 'lamp',     name: '스탠드',   size: [1, 2], zone: 'top',   color: '#e8c35a' },
  { id: 'bed',      name: '침대',     size: [6, 3], zone: 'floor', color: '#8fa9d6' },
  { id: 'audio',    name: '오디오',   size: [2, 3], zone: 'floor', color: '#5b5b66' },
  { id: 'sandbox',  name: '모래 상자', size: [3, 2], zone: 'floor', color: '#e3cf98' },
  { id: 'frame',    name: '액자',     size: [2, 2], zone: 'wall',  color: '#c97b6b' },
  { id: 'window',   name: '창문',     size: [4, 3], zone: 'wall',  color: '#a9d6e5' },
];

export const BY_ID = Object.fromEntries(FURNITURE.map(f => [f.id, f]));
