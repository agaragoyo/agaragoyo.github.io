// 아바타 목록. 방 안을 걸어 다니는 내 캐릭터의 그림을 정한다(움직임은 src/avatar.js).
//
// 필드
//   id          영소문자와 하이픈. 겹치면 안 된다
//   name        고를 때 보여 줄 이름
//   sheet       그림 파일 경로(assets/avatars/<id>.png)
//   guestSheet  친구 집에 손님으로 갔을 때 쓰는 그림(assets/avatars/<id>-guest.png). 친구 집에서는
//               주인 아바타가 sheet 그림으로 방에 서 있어서, 손님은 이 그림으로 주인과 구분한다(src/avatar.js의 mountOwner)
//
// 그림(sheet)은 동작을 한 장에 모은 스프라이트 시트다. 한 칸(프레임)은 화면(무대)에서 가로 64px, 세로 104px이고,
// 가로로 [서 있기, 왼발 걸음, 오른발 걸음] 세 칸, 세로로 [앞모습(왼쪽 아래를 봄), 뒷모습(왼쪽 위를 봄)] 두 줄이라
// 화면에서 시트 전체는 192×208px이다. 오른쪽을 보는 모습은 좌우로 뒤집어 쓰므로 그리지 않는다.
// 발끝은 각 칸의 가로 가운데, 위에서 100px 되는 곳(32, 100)에 맞추고, 머리 꼭대기는 위에서 16px에 둔다
// (말하기 표시와 주인 이름표, 말풍선이 이 높이에 맞춰 뜬다. src/avatar.js의 HEAD_TOP).
// 픽셀 그림 한 점은 화면에서 2px(가구와 같은 굵기)이다. 파일은 한 점을 4px로 그려 화면 크기의 두 배(384×416px)로 만들고
// 브라우저가 줄여 그리게 한다. 무대 배율이 정수가 아니어도 점 굵기가 고르다(known-issues 92). 1배 그림을 최근접으로 4배 키우기만 한다.
export const SHEET_SCALE = 2; // 그림 파일의 크기 ÷ 화면에서의 크기

export const AVATARS = [
  // 팀이 보낸 도복 그림(정면, 정뒤)을 점 격자로 다시 찍고, 눈과 볼과 모자 끈을 보는 쪽에 맞춰 한 점 옮겨 비스듬히 돌린 것.
  // 손님 그림은 모자 색만 빨강이다
  { id: 'basic', name: '기본', sheet: 'assets/avatars/basic.png', guestSheet: 'assets/avatars/basic-guest.png' },
];

export const AVATAR_BY_ID = Object.fromEntries(AVATARS.map(a => [a.id, a]));
