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
//            'builtin:<이름>'은 src/icons.js의 PIXEL에 글자로 그린 픽셀 아이콘이다(기본 앱만 쓴다)
//   color    아이콘 타일 색 (icon 이 없을 때)
//   src      창 안에 띄울 페이지 주소. 같은 사이트 안의 apps/<앱이름>/index.html 이 가장 좋다
//            (다른 사이트 주소도 되지만, 그 페이지가 엉뚱한 곳으로 넘어가도 알아채지 못하고,
//            게임 기록은 그 게임을 혼자 열었을 때의 기록과 따로 저장된다. known-issues 16, 17)
//   size     창 안쪽 크기 [가로, 세로] (px). 바탕화면은 1280×800이다
//   folder   'games' 이면 바탕화면 대신 미니게임 폴더 안에 나온다
//            'furniture' 이면 어디에도 아이콘이 없고, 가구의 gimmick: 'app:<id>' 로만 열린다
//   builtin  OS가 직접 만드는 기본 앱. src/apps/<builtin>-app.js 와 짝이다(room, folder, share, music, mine, labs). 팀원은 쓰지 않는다
//   music    창이 열려 있는 동안 틀 배경음악 이름(src/sound.js 의 MUSIC). 게임 안에 음악이 이미 있으면 'own' 으로 적어
//            그 창이 열려 있는 동안 사이트 음악을 멈춘다(두 음악이 겹치지 않게). 없으면 바탕화면 음악이 그대로 나온다
//   scene    공간 바로 가기. 창을 열지 않고 바탕화면을 이 공간(src/config.js 의 SCENES)으로 옮긴다. builtin, src 없이 쓴다.
//            지금 바탕화면에 보이는 공간의 바로 가기는 나오지 않는다(놀이터에서는 놀이터 대신 집으로가 보인다)
//   href     창 대신 새 탭으로 여는 바깥 주소(https). 다른 사이트의 창(iframe) 안에서는 돌지 않는 남의 게임에 쓴다.
//            열기 전에 새 탭에서 열린다는 것과 열리는 주소를 보여 준다(src/apps/link-app.js). builtin, src 없이 쓴다
//   links    href 앱의 주소가 여럿일 때 [{ label, href }]. 여는 창에 label이 단추로 하나씩 나온다(예: '초급으로 열기'). href에는 첫 주소를 같이 적는다
//   noun     href 앱의 여는 창에서 "이 게임은" 대신 쓸 말(예: '영상')
//   editOnly true 이면 친구 컴퓨터를 구경할 때는 숨긴다
//   visitOnly true 이면 친구 컴퓨터를 구경할 때만 보인다(손님에게 자기 컴퓨터를 만드는 길이나 돌아가는 길을 보여 준다)
//   ownHome  visitOnly 앱에 쓴다. true 이면 이 컴퓨터에 자기 집이 있는 손님에게만, false 이면 없는 손님에게만 보인다
//   labs     true 이면 실험실을 연 브라우저에서만 보인다(말풍선에 암호를 말하면 열린다, src/labs.js)
const SITE = 'https://soomin007.github.io';

export const APPS = [
  { id: 'room', title: '방 꾸미기', icon: 'builtin:room', builtin: 'room', editOnly: true },
  { id: 'make-mine', title: '나도 만들기', icon: 'builtin:make', builtin: 'mine', visitOnly: true, ownHome: false },
  { id: 'my-computer', title: '내 컴퓨터로', icon: 'builtin:computer', builtin: 'mine', visitOnly: true, ownHome: true },
  { id: 'playground', title: '놀이터', icon: 'builtin:playground', scene: 'playground' },
  { id: 'go-home', title: '집으로', icon: 'builtin:home', scene: 'room' },
  { id: 'games', title: '미니게임', icon: 'builtin:games', builtin: 'folder', folder: null, opens: 'games' },
  { id: 'share', title: '공유하기', icon: 'builtin:share', builtin: 'share', editOnly: true },
  { id: 'music', title: '배경음악', icon: 'builtin:music', builtin: 'music' },
  { id: 'labs', title: '실험실', icon: 'builtin:labs', builtin: 'labs', labs: true },

  // 가구 기믹. 아이콘 없이 data/furniture.js의 gimmick: 'app:<id>'로만 열린다. 주인이 가구에 담아 둔 것을 보여 준다(src/likes.js)
  { id: 'computer', title: '컴퓨터', color: '#8f8a7c', builtin: 'computer', folder: 'furniture' },
  { id: 'console', title: '게임기', color: '#c97b8a', builtin: 'console', folder: 'furniture' },
  { id: 'bookshelf', title: '책장', color: '#685447', builtin: 'bookshelf', folder: 'furniture' },
  { id: 'radio', title: '라디오', color: '#8a7f63', builtin: 'radio', folder: 'furniture' },
  { id: 'tv', title: 'TV', color: '#6f7d63', builtin: 'tv', folder: 'furniture' },
  // 코르크 보드는 주인이 아니라 손님이 쪽지를 붙인다(방명록, 시험). 쪽지는 서버(src/cloud.js)에 있다
  { id: 'corkboard', title: '코르크 보드', color: '#a87b4f', builtin: 'corkboard', folder: 'furniture' },

  // 미니게임 폴더. 아가라고요용으로 만든 게임 둘과, 자리 채우기로 넣은 레포 밖의 기존 게임들.
  // 레포 밖 게임 다섯 개는 게임 안에 배경음악이 있어서 music: 'own' 이다.
// 새 앱을 만들 때는 apps/tidy-up 을 예시로 본다.
  { id: 'tidy-up', title: '짐 정리', icon: 'apps/tidy-up/icon.svg', src: 'apps/tidy-up/index.html', size: [440, 640], folder: 'games', music: 'tidy-up' },
  { id: 'file-ten', title: '파일 정리 10', icon: 'apps/file-ten/icon.svg', src: 'apps/file-ten/index.html', size: [720, 500], folder: 'games', music: 'file-ten' },
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
  // 2026-11-10 피그마 플래시 게임 표에 더해진 것. 크라라 공주는 난이도마다, 아바타 스타 슈는 1화와 전체 목록 주소가 따로 있어 links로 고른다.
  { id: 'gogunbuntu', title: '고군분투', color: '#8a6d3b', href: 'https://waflash.org/85', folder: 'games' },
  { id: 'animal-rescue', title: '동물구출 대작전', color: '#5f8f4e', href: 'https://waflash.org/315', folder: 'games' },
  { id: 'krara-room', title: '크라라 공주와 이상한 방', color: '#b05a8a', href: 'https://waflash.org/451', folder: 'games', links: [{ label: '초급으로 열기', href: 'https://waflash.org/451' }, { label: '중급으로 열기', href: 'https://waflash.org/902' }, { label: '고급으로 열기', href: 'https://waflash.org/903' }] },
  { id: 'number-song', title: '숫자쏭', color: '#d4a12a', href: 'https://waflash.org/239', folder: 'games' },
  { id: 'avatar-star-shu', title: '아바타 스타 슈 1화', color: '#7b5fb0', href: 'https://waflash.org/1179', folder: 'games', noun: '영상', links: [{ label: '1화 보기', href: 'https://waflash.org/1179' }, { label: '전체 목록 보기', href: 'https://waflash.org/search/%EC%95%84%EB%B0%94%ED%83%80%20%EC%8A%A4%ED%83%80%20%EC%8A%88' }] },
];

export const APP_BY_ID = Object.fromEntries(APPS.map(a => [a.id, a]));
