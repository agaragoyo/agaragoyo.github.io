// 이웃집 목록(docs/requirements.md의 F19). 로그인 화면의 이웃집과 놀이터 왼쪽 울타리의 문패가 이 목록으로 만들어진다.
// 처음 온 사람이 빈 방을 꾸미기 전에, 가구에 좋아하는 것이 담긴 방을 먼저 구경해 볼 수 있게 하려는 것이다.
//
// 한 줄에 한 집이다. link와 room 가운데 하나만 쓴다(둘 다 쓰면 tools/check.py가 오류로 알린다).
//   id    영소문자와 하이픈. 겹치면 안 된다
//   name  닉네임(12글자까지). 레포가 공개라 실명은 쓰지 않는다. link 줄은 서버에서 방을 받기 전에만 보이고, 받은 뒤에는 서버의 방 주인 이름이 보인다
//   link  그 집 링크(https://agaragoyo.github.io/#s=여덟글자)에서 #s= 뒤의 여덟 글자. 방은 서버에 있어서 주인이 방을 고치면 이웃집도 따라 바뀐다
//   room  (예전 방식) 긴 링크에서 #r= 뒤의 글자 전부(2026-11-11 전에 만든 링크는 #room= 뒤). 링크를 보낸 때의 모습에 멈춰 있다
//
// 넣는 법: 주인이 배포 사이트(https://agaragoyo.github.io/)에서 자기 방을 꾸미고 가구에 좋아하는 것을 담은 뒤,
// 공유하기의 "링크 만들기"로 만든 링크를 보내 준다. 그 링크의 #s= 뒤 여덟 글자를 link에 넣는다.
// 링크는 주인이 자기 브라우저에서 만들어야 한다. 다른 사람이 주인의 방으로 만든 링크는 만든 사람의 것이라 주인이 방을 고쳐도 바뀌지 않는다.
// 링크를 만든 사용자의 닉네임도 name과 같아야 한다. 서버의 방은 누구나 읽을 수 있어서, 다르면 다른 이름(실명일 수 있다)이 서버에 남는다.
// 넣은 뒤에 주인이 이름 바꾸기(F28)로 닉네임을 바꾸면 로그인 화면과 문패에도 새 이름이 보인다. name은 다음에 이 파일을 고칠 때 맞춰 둔다.
// 서버에 그 방이 없으면(주인이 링크를 지웠으면) 그 이웃집은 로그인 화면과 놀이터에서 빠진다.
// room 줄은 링크 속 주인 이름이 name과 같은지 tools/check.py가 본다(base64를 풀면 누구나 읽을 수 있다). 주인이 링크를 보내 주면 link로 바꾼다.
// 받은 방의 가구와 글, 주소는 열 때마다 src/share.js의 decodeHome(가구 배치 검사와 src/likes.js의 검사)을 거친다.
// 로그인 화면과 놀이터에는 앞의 여섯 집까지만 나온다(src/neighbors.js의 MAX_NEIGHBORS).
// 로그인 화면은 그 가운데 이 브라우저에서 올린 방(link가 공유하기의 링크 번호와 같은 줄)을 뺀다. 내 사용자로 이미 떠 있기 때문이다(src/login.js).
//
// 팀원 방은 받은 차례대로 목록 끝에 더한다.
export const NEIGHBORS = [
  { id: 'kirby-cute', name: '커비큐트', room: 'BAzsu6TruYTtgZDtirgAAhcAAAKYCoCFAwiLBDAGoAdQm3MZQ5kUGgMLABQhFhCMBQ1XDjQPERGBEAEIcAgIDSAAHwmguSIEJIAlsCEGI4MkiyS2JUAlWyMR' },
  { id: 'soomin007', name: 'soomin007', link: 'ZUMveoKX' },
];
