// 아바타 목록. 방 안을 걸어 다니는 내 캐릭터의 그림을 정한다(움직임은 src/avatar.js).
//
// 필드
//   id      영소문자와 하이픈. 겹치면 안 된다
//   name    고를 때 보여 줄 이름
//   sheet   그림 파일 경로(assets/avatars/<id>.png). 없으면 color 옷을 입은 임시 그림을 코드로 그린다
//   color   임시 그림의 옷 색
//   guestColor  친구 집에 손님으로 갔을 때 입는 임시 그림의 옷 색. 실험실의 주인 아바타 남기기(host-avatar)를 켜면
//               주인 아바타가 color 옷으로 방에 서 있어서, 손님은 이 색으로 주인과 구분한다(src/avatar.js의 mountOwner)
//
// 그림(sheet)은 동작을 한 장에 모은 스프라이트 시트다. 한 칸(프레임)은 가로 64px, 세로 104px이고,
// 가로로 [서 있기, 왼발 걸음, 오른발 걸음] 세 칸, 세로로 [앞모습(왼쪽 아래를 봄), 뒷모습(왼쪽 위를 봄)] 두 줄이라
// 시트 전체는 192×208px이다. 오른쪽을 보는 모습은 좌우로 뒤집어 쓰므로 그리지 않는다.
// 발끝은 각 칸의 가로 가운데, 위에서 100px 되는 곳(32, 100)에 맞춘다.
export const AVATARS = [
  { id: 'basic', name: '기본', color: '#5b8def', guestColor: '#ef5b5b' }, // 빨강은 파랑과 밝기, 채도가 같다
];

export const AVATAR_BY_ID = Object.fromEntries(AVATARS.map(a => [a.id, a]));
