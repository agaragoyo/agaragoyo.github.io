// 앱 목록. 바탕화면 아이콘과 시작 메뉴, 미니게임 폴더가 모두 이 목록으로 만들어진다.
//
// 새 앱을 넣는 방법 (팀원용, 자세한 설명은 apps/README.md)
//   1. apps/_template 폴더를 복사해 apps/<앱이름>/ 으로 만들고 고친다. 혼자 열어도 동작하는 평범한 웹 페이지면 된다.
//   2. 아래 목록에 한 줄을 추가한다.
//
// 필드
//   id       영소문자와 하이픈. 겹치면 안 된다
//   title    아이콘 아래와 창 제목에 쓰는 이름
//   icon     그림 경로(png, svg, webp). 없으면 color 색 타일에 제목 첫 글자를 쓴다
//   color    아이콘 타일 색 (icon 이 없을 때)
//   src      창 안에 띄울 페이지 주소. 같은 사이트 안의 apps/<앱이름>/index.html 이 가장 좋다
//            (다른 사이트 주소도 되지만, 화면이 휘어 있을 때 클릭 위치가 조금 어긋날 수 있다)
//   size     창 안쪽 크기 [가로, 세로] (px). 바탕화면은 1280×800이다
//   folder   'games' 이면 바탕화면 대신 미니게임 폴더 안에 나온다
//            'furniture' 이면 어디에도 아이콘이 없고, 가구의 gimmick: 'app:<id>' 로만 열린다
//   builtin  OS가 직접 만드는 기본 앱. src/apps/<builtin>-app.js 와 짝이다(room, folder, share, mouse, music). 팀원은 쓰지 않는다
//   music    창이 열려 있는 동안 틀 배경음악 이름(src/sound.js 의 MUSIC). 게임 안에 음악이 이미 있으면 'own' 으로 적어
//            그 창이 열려 있는 동안 사이트 음악을 멈춘다(두 음악이 겹치지 않게). 없으면 바탕화면 음악이 그대로 나온다
//   scene    공간 바로 가기. 창을 열지 않고 바탕화면을 이 공간(src/config.js 의 SCENES)으로 옮긴다. builtin, src 없이 쓴다.
//            지금 바탕화면에 보이는 공간의 바로 가기는 나오지 않는다(놀이터에서는 놀이터 대신 집으로가 보인다)
//   href     창 대신 새 탭으로 여는 바깥 주소(https). 다른 사이트의 창(iframe) 안에서는 돌지 않는 남의 게임에 쓴다.
//            열기 전에 새 탭에서 열린다는 것과 열리는 주소를 보여 준다(src/apps/link-app.js). builtin, src 없이 쓴다
//   editOnly true 이면 친구 컴퓨터를 구경할 때는 숨긴다
const SITE = 'https://soomin007.github.io';

export const APPS = [
  { id: 'room', title: '방 꾸미기', icon: 'builtin:room', builtin: 'room' },
  { id: 'playground', title: '놀이터', icon: 'builtin:playground', scene: 'playground' },
  { id: 'go-home', title: '집으로', icon: 'builtin:home', scene: 'room' },
  { id: 'games', title: '미니게임', icon: 'builtin:folder', builtin: 'folder', folder: null, opens: 'games' },
  { id: 'share', title: '공유하기', icon: 'builtin:share', builtin: 'share', editOnly: true },
  { id: 'mouse', title: '마우스', icon: 'builtin:mouse', builtin: 'mouse' },
  { id: 'music', title: '배경음악', icon: 'builtin:music', builtin: 'music' },

  // 미니게임 폴더. 아가라고요용으로 만든 게임 둘과, 자리 채우기로 넣은 레포 밖의 기존 게임들.
  // 레포 밖 게임 다섯 개는 게임 안에 배경음악이 있어서 music: 'own' 이다.
// 새 앱을 만들 때는 apps/tidy-up 을 예시로 본다.
  { id: 'tidy-up', title: '짐 정리', icon: 'apps/tidy-up/icon.svg', src: 'apps/tidy-up/index.html', size: [440, 640], folder: 'games', music: 'tidy-up' },
  { id: 'file-ten', title: '파일 정리 10', icon: 'apps/file-ten/icon.svg', src: 'apps/file-ten/index.html', size: [720, 470], folder: 'games', music: 'file-ten' },
  { id: 'be-the-bee', title: 'Be the Bee', icon: `${SITE}/assets/be-the-bee.webp`, src: `${SITE}/be-the-bee/`, size: [1040, 660], folder: 'games', music: 'own' },
  { id: 'enigma', title: 'ENIGMA', icon: `${SITE}/assets/enigma.webp`, src: `${SITE}/Enigma/`, size: [1120, 700], folder: 'games', music: 'own' },
  { id: 'otherside', title: 'See you on the other side', icon: `${SITE}/assets/otherside.webp`, src: `${SITE}/Otherside/`, size: [1040, 660], folder: 'games', music: 'own' },
  { id: 'eyes-on-you', title: 'Eyes on You', icon: `${SITE}/assets/eyes-on-you.webp`, src: `${SITE}/EyesOnYou/`, size: [1120, 700], folder: 'games', music: 'own' },
  { id: 'outlet-villains', title: '충전이 필요해!', icon: `${SITE}/assets/outlet-villains.webp`, src: `${SITE}/outlet-villains/`, size: [1120, 700], folder: 'games', music: 'own' },

  // 추억의 플래시 게임. 남의 게임이라 파일을 레포로 옮기지 않고 원작 주소를 새 탭으로 연다.
  // 와플래시 게임 아카이브의 플레이어는 다른 사이트의 창 안에서 게임을 시작하지 않고, friv.com은 창에 띄우는 것을 막아 두었다(known-issues 31).
  { id: 'shu-ramen', title: '슈의 라면가게', color: '#c0703a', href: 'https://waflash.org/36', folder: 'games' },
  { id: 'prison-escape', title: '감옥탈출', color: '#55606e', href: 'https://waflash.org/155', folder: 'games' },
  { id: 'eye-signal', title: '눈빛보내기', color: '#b0577f', href: 'https://waflash.org/203', folder: 'games' },
  { id: 'fireboy-watergirl', title: 'Fireboy and Watergirl', color: '#4a78b5', href: 'https://www.friv.com/z/games/fireboyandwatergirlforest/game.html', folder: 'games' },
];

export const APP_BY_ID = Object.fromEntries(APPS.map(a => [a.id, a]));
