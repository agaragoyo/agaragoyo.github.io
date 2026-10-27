// 가구 목록. 새 가구는 한 줄 추가하고 assets/furniture/<id>.png 를 넣으면 된다.
// 이미지가 없으면 color 색의 입체 상자(벽 가구는 액자 모양)로 대신 보여 준다.
//
// zone: 'wall'  벽에만 건다. size: [벽을 따라 칸 수, 높이 줄 수]
//       'floor' 바닥에 놓는다. size: [오른쪽 아래 방향 칸 수, 왼쪽 아래 방향 칸 수], height: 화면 높이(px)
//       'top'   바닥에 놓거나 surface 가구 위에 올린다. size, height는 floor와 같다
// surface: true 이면 위에 'top' 가구를 올릴 수 있다 (올라간 가구는 height만큼 떠 있다)
export const FURNITURE = [
  { id: 'desk',     name: '책상',     zone: 'floor', size: [3, 2], height: 56, surface: true, color: '#b08354' },
  { id: 'computer', name: '컴퓨터',   zone: 'top',   size: [1, 1], height: 52, color: '#d9d4c7' },
  { id: 'lamp',     name: '스탠드',   zone: 'top',   size: [1, 1], height: 70, color: '#e8c35a' },
  { id: 'bed',      name: '침대',     zone: 'floor', size: [3, 4], height: 40, color: '#8fa9d6' },
  { id: 'audio',    name: '오디오',   zone: 'floor', size: [1, 1], height: 96, color: '#5b5b66' },
  { id: 'sandbox',  name: '모래 상자', zone: 'floor', size: [2, 2], height: 22, color: '#e3cf98' },
  { id: 'frame',    name: '액자',     zone: 'wall',  size: [2, 2], color: '#c97b6b' },
  { id: 'window',   name: '창문',     zone: 'wall',  size: [3, 3], color: '#a9d6e5' },
];

export const BY_ID = Object.fromEntries(FURNITURE.map(f => [f.id, f]));
