# 파일 지도

어떤 파일이 어디에 있고 무엇을 하는지 한곳에 모았습니다. 고칠 곳을 찾을 때 폴더를 뒤지거나 검색하기 전에 이 문서부터 보면 시간이 덜 듭니다.
사람과 AI 도구가 함께 쓰는 문서이고, 파일을 새로 만들거나 옮기거나 지우면 이 문서도 같은 PR에서 고칩니다.
`src/`, `data/`, `tools/`, `docs/` 아래 파일이 여기에 빠져 있으면 자동 점검(`python tools/check.py`)이 오류로 알려 줍니다.

사이트가 어떻게 동작하는지는 `docs/guide.md`, 작업 규칙은 `AGENTS.md`, 실행과 올리는 순서는 `README.md`에 있습니다.
무엇을 만들지는 `docs/requirements.md`, 할 일과 담당은 `docs/tasks.md`, 올리기 전에 확인할 것은 `docs/checklists.md`에 있습니다.

## 자주 찾는 것

| 하고 싶은 일 | 가 볼 곳 |
| --- | --- |
| 새 미니게임이나 앱 만들기 | `apps/_template/`를 복사하고 `data/apps.js`에 한 줄 (`apps/README.md`) |
| 창 안에서 돌지 않는 바깥 게임을 새 탭으로 열기 | `data/apps.js`에 `href: 'https://...'` (`src/apps/link-app.js`가 새 탭에서 열린다고 알리고 연다) |
| 가구를 두 번 눌렀을 때 앱 열기 | `data/apps.js`에 `folder: 'furniture'`, `data/furniture.js`의 그 가구에 `gimmick: 'app:<id>'` |
| 주인이 가구에 담아 두는 것(웹 게임 링크, 책, CD, 작품)의 칸과 검사 | `src/likes.js`. 공유 링크에 담는 곳은 `src/share.js`의 `encodeHome` |
| 가구를 가까이 보는 화면(게임기처럼 바탕을 덮고 가구를 크게 띄우기) | `src/closeup.js`의 `openCloseup`, 모양은 `style.css`의 "가구 가까이 보기" 절 |
| 가구 추가, 크기나 색 바꾸기 | `data/furniture.js`. 그림은 `assets/furniture/<id>.png` |
| 공간(방, 놀이터) 추가 | `src/config.js`의 `SCENES`. 바깥 공간에서 내 방으로 돌아오는 울타리 문 자리는 `gate`, 방에서 놀이터로 나가는 현관문 자리는 `door` |
| 이웃집 더하기와 바꾸기(로그인 화면의 이웃집, 놀이터 울타리의 문패) | `data/neighbors.js`에 닉네임과 공유 링크 한 줄. 문 자리와 놀러 갈지 묻는 창은 `src/neighbors.js` |
| 바탕화면에 공간 바로 가기 두기 | `data/apps.js`에 `scene: '<공간 id>'` (놀이터가 예). 누르면 창 대신 바탕화면이 그 공간으로 옮겨 간다. 지금 보이는 공간의 바로 가기는 숨긴다(놀이터에서는 `집으로`가 보인다) |
| 바탕화면의 공간 옮기기(현관문, 놀이터 아이콘, 놀이터 문) | `src/os.js`의 `goScene`, `useDoor`, `useGate`, 문 그림은 `src/iso.js`의 `doorSVG`(현관문), `outdoorSVG`(울타리 문) |
| 이웃집에 손님으로 들어가기와 돌아오기 | `src/os.js`의 `useNeighbor`, `visit`, `goHome`(손님 바탕화면의 나도 만들기와 내 컴퓨터로) |
| 바탕화면에서 가구 두 번 누르기(아바타가 다가가 기믹) | `src/room.js`의 `renderStatic`, `src/os.js`의 `useFurniture`, `src/avatar.js`의 `approach` |
| 격자 크기, 벽 높이, 화면 크기 | `src/config.js` |
| 가구를 놓을 수 있는지 정하는 규칙 | `src/rules.js`의 `canPlace` |
| 가구 끌기, 돌리기, 치우기 | `src/room.js`의 `beginDrag` |
| 앞뒤로 겹쳐 그리는 순서 | `src/room.js`의 `zOf`, `src/iso.js`의 `depthOf` |
| 바탕화면 방을 걷는 아바타(걷기, 길찾기, 말풍선) | `src/avatar.js`. 바탕화면에 붙이는 곳은 `src/os.js`의 `showDesktop`, 가구와의 앞뒤는 `depthZ` |
| 아바타 그림과 옷 색 | `data/avatars.js`. 그림은 `assets/avatars/<id>.png`(한 칸 64×104px, 가로 3칸 × 세로 2줄) |
| 방 바닥과 벽 그림 | `src/iso.js`의 `roomSVG`(현관문은 `doorSVG`), `outdoorSVG` |
| 밤의 어둠과 불빛 | `src/room.js`의 `renderShade`, `style.css`의 "밤 모드" 절 |
| 밤 모드에서 글자가 바탕에 묻히는지 재기 | `node tools/night-contrast.mjs`. 원래 있고 읽히는 예외는 그 파일 맨 위의 `EXCEPTIONS`에 적는다 |
| 부팅 로고, 로그인 화면 흐름 | `src/os.js`의 `os.boot`, `showLogin` |
| 시작 메뉴 항목 | `src/os.js`의 `openStartMenu` |
| 튜토리얼 단계와 안내 문구 | `src/tutorial.js`의 `STEPS`. 카드와 화살표 모양은 `style.css`의 "튜토리얼" 절 |
| 튜토리얼에서 놓는 기본 가구 바꾸기 | `data/furniture.js`의 `TUTORIAL_FURNITURE` |
| 튜토리얼 다시 보기의 연습 방 | 시작 전 안내 창은 `src/tutorial.js`의 `askPractice`, 집 바꿔 끼우기는 `src/os.js`의 `os.startPractice`와 `os.endPractice` |
| 창 열기, 끌기, 최대화 | `src/win.js` |
| 2005년식 모니터와 창 모양 | `style.css` 끝의 "2005 모습" 절(앞의 기본 모양을 덮어쓰는 규칙) |
| 처음 접속해서 모니터가 그려지기 전의 화면(가림막, 점 세 개, 새로 고침 안내) | `index.html`의 `#page-loader`, `style.css`의 "첫 화면 가림막" 절. 걷는 곳은 `src/main.js` 맨 끝 |
| 느린 연결에서 모듈을 한꺼번에 받기(모듈 미리 받기) | `index.html`의 `<template id="modulepreload">`와 그 아래 스크립트(크롬 계열만), 줄을 채우는 것은 `tools/stamp.py` |
| 글꼴(첫 화면의 작은 글꼴 AgaUI와 갈무리 전체) | `style.css`의 "글꼴" 절. 작은 글꼴 파일은 `assets/fonts/`, 만드는 도구는 `tools/ui_font.py`, 미리 받는 줄은 `index.html`, 갈무리 전체를 이어 받는 곳은 `src/main.js` 맨 끝의 `FULL_FONTS` |
| 커서 그림 | `src/cursors.js` |
| 새 설정 값 | `src/settings.js`의 `DEFAULTS` |
| 저장 키 이름 | `src/config.js`의 `STORAGE_*` |
| 공유 링크 형식 | `src/share.js`의 `encodeHome`, `decodeHome` |
| 방 그림(PNG) 내려받기 | 단추는 `src/apps/share-app.js`, 그림 그리기는 `src/room-image.js`. 파일 크기는 `IMAGE_SCALE` |
| 앱 SDK에 기능 더하기 | `src/sdk-host.js`의 `HANDLERS`와 `apps/aga-sdk.js` |
| 자동 점검 규칙 더하기 | `tools/check.py`에 `check_...` 함수 |
| 예전에 겪은 함정 | `known-issues.md` |

## 맨 위

| 파일 | 하는 일 |
| --- | --- |
| `index.html` | 사이트의 유일한 HTML. 첫 화면 가림막, 모니터, 화면 층(무대, 그레인), 부팅, 로그인, 바탕화면, 작업 표시줄의 뼈대가 들어 있다. 맨 위 import map, 미리 받을 모듈 줄, `?v=` 지문은 배포할 때 `tools/stamp.py`가 채우므로 손으로 고치지 않는다. 모듈 미리 받기 template과 스크립트는 스타일시트보다 앞에 둔다 |
| `style.css` | 모든 모양. 아래 "style.css 안의 순서"에 절 목록이 있다 |
| `README.md` | 레포 첫 화면. 내 컴퓨터에서 여는 법, 작업을 올리는 세 가지 방법, 새 기능을 붙이는 곳, 지켜야 할 것 |
| `AGENTS.md` | AI 코딩 도구가 작업 전에 읽는 규칙 |
| `CLAUDE.md` | Claude Code용. `AGENTS.md`를 불러오고 Claude 전용 몇 줄만 더한다 |
| `known-issues.md` | 되풀이된 함정 목록(증상, 원인, 규칙). 코드를 고치기 전에 읽는다 |
| `.gitignore` | 레포에 올리지 않는 파일(개인 기획 문서, Claude 개인 설정) |
| `.gitattributes` | 줄바꿈을 LF로 통일한다(맥과 윈도우가 섞인 팀) |
| `.nojekyll` | GitHub Pages가 파일을 가공하지 않고 그대로 내보내게 한다 |

## src/: 시작과 설정

| 파일 | 하는 일 | 내보내는 것 |
| --- | --- | --- |
| `src/main.js` | 시작점. 모니터 크기 맞추기, 소리 버튼, 그레인 그림 만들기, 전원 연출을 맡고 화면 안쪽은 `os.js`에 넘긴다. 맨 끝에서 첫 화면 가림막을 걷는다 | 없음 |
| `src/sound.js` | 효과음과 배경음악. 효과음은 `play('이름')`, 배경음악은 바탕화면의 공간(`setPlace`)과 열려 있는 창(`holdMusic`, 나중에 연 창이 이긴다)에 맞는 곡 하나를 튼다. 게임 창의 음악은 `data/apps.js`의 `music`. 파일 이름과 크기(vol)는 이 파일 맨 위 | `play`, `setPlace`, `holdMusic`, `roomMusic`, `ROOM_MUSIC`, `MUSIC_NAMES` |
| `src/settings.js` | 이 컴퓨터의 설정(밤, 소리, 방 배경음악) 저장소. 2026-11-10에 뺀 설정은 읽을 때 버린다. 바뀌면 구독자에게 알린다. 저장하지 않고 잠시 다른 값으로 쓸 수도 있다(`hold`, `release`) | `settings` |
| `src/config.js` | 숫자와 이름만 모은 곳. 격자, 방과 화면 크기, 공간 목록(놀이터 문과 현관문 자리, 이웃집 문을 다는 공간 포함), 저장 키 | `N`, `TW`, `SCENES`, `STORAGE_*` 등 |
| `src/util.js` | 여러 파일이 같이 쓰는 작은 도구. 요소 만들기, 저장소 읽고 쓰기, 조사 고르기 | `h`, `loadJSON`, `saveJSON`, `wait`, `clamp`, `batchim`, `reduceMotion` |

## src/: 컴퓨터(OS)

| 파일 | 하는 일 | 내보내는 것 |
| --- | --- | --- |
| `src/os.js` | 부팅, 로그인(이웃집 줄 포함), 바탕화면 아이콘과 배경의 공간(아바타 포함, 현관문과 놀이터 문으로 내 방과 놀이터를 오간다), 이웃집에 손님으로 들어가기와 돌아오기, 시작 메뉴, 시계, 앱 열기, 가구 기믹 처리, 초기화, 알림, 튜토리얼 연습 방 바꿔 끼우기 | `createOS` |
| `src/neighbors.js` | 이웃집(`data/neighbors.js`). 링크를 풀어 깨진 줄을 빼고 여섯 집까지 고르기, 그 집을 새로 열기, 놀이터 왼쪽 울타리의 문 자리(그 놀이터가 있는 집의 문패는 뺀다), 놀이터 문을 두 번 눌렀을 때 어느 집으로 가는지 묻는 창 | `NEIGHBOR_LIST`, `neighborHome`, `neighborGates`, `askVisit`, `MAX_NEIGHBORS` |
| `src/tutorial.js` | 처음 온 사람의 튜토리얼. 안내 카드와 화살표, 지금 상태를 읽어 아직 하지 않은 첫 단계 고르기, 건너뛰기, 빈 연습 방에서 하는 다시 보기와 시작 전 안내 창 | `createTutorial` |
| `src/closeup.js` | 가구를 가까이 보는 화면. 바탕화면을 어둡게 덮고 가운데에 가구를 크게 보여 준다. 바깥이나 아래의 닫기 단추(가구마다 "내려놓기", "TV 끄기", "닫기"), Esc를 누르면 닫고, 열려 있는 동안 아바타는 키를 받지 않는다. 창 층보다 아래에 깔린다 | `openCloseup` |
| `src/win.js` | 창 관리자. 창과 작업 표시줄 버튼을 만들고 끌기, 최소화, 최대화, 닫기를 한다. 앱(iframe)을 누르면 그 창을 앞으로 가져오고, 다른 곳을 누르면 앱의 키보드 초점을 거둔다 | `createWM` |
| `src/icons.js` | 아이콘 하나 만들기. 기본 앱 아이콘(방, 놀이터, 집, 폴더, 공유, 음악, 내 컴퓨터, 가구)은 SVG로 직접 그린다 | `iconEl` |
| `src/sdk-host.js` | 팀원 앱(iframe)과 주고받는 메시지. 종류마다 함수 하나(`HANDLERS`) | `createSdkHost` |
| `src/crt.js` | 그레인 노이즈 그림 한 장(움직임은 CSS) | `initGrain` |
| `src/cursors.js` | 화면 안 커서 그림을 만들어 `--cur-*` CSS 변수로 넣는다. 설정의 `cursor`(색, 크기, 직접 그린 그림)를 따른다 | `initCursors`, `cursorSet`, `defaultPixels` 등 |

## src/: 방 그리기

| 파일 | 하는 일 | 내보내는 것 |
| --- | --- | --- |
| `src/room.js` | 가구 그리기(그림이 없으면 임시 상자, 그림은 칠해진 모양만 클릭), 가구마다 쓸 그림 파일 고르기(`imageFor`), 끌어 놓기와 돌리기, 앞뒤 순서, 밤 그늘, 바탕화면용 공간 그림(가구, 현관문, 놀이터의 아파트 문과 이웃집 문을 두 번 누르면 쓰기). 방 꾸미기에서는 현관문 자리에 벽 가구를 걸지 못하게 한다 | `furnitureEl`, `imageFor`, `renderItems`, `renderStatic`, `beginDrag`, `zOf` 등 |
| `src/room-image.js` | 방 그림을 PNG용 캔버스로 만든다(공유하기의 내려받기). 화면의 방을 사진처럼 찍을 수 없어서, 화면과 같은 함수(`placementOf`, `zOf`, `imageFor`)가 정한 자리와 순서로 바탕, 가구 그림, 임시 모양, 글자를 다시 그린다. 낮 모습, 2560×1440px | `renderRoomImage`, `IMAGE_SCALE`, `IMAGE_W`, `IMAGE_H` |
| `src/avatar.js` | 바탕화면 배경의 방을 걷는 내 아바타(1단계, 서버 없음). 바닥 클릭과 방향키로 칸 이동, 길찾기, 두 번 누른 가구나 문 옆으로 걸어가기(`approach`, `approachWall`), 공간을 옮길 때 새 자리에 서기(`moveTo`), 가구와 앞뒤 순서, 말풍선. 방 꾸미기 창에는 나오지 않는다. 그림 파일이 없으면 임시 그림을 SVG로 그린다 | `mountAvatar` |
| `src/rules.js` | 배치 규칙. 화면과 상관없는 계산만 있어서 공유 링크 검사에도 같이 쓴다. 현관문 자리 검사(`coversDoor`)는 방 꾸미기에서만 쓴다 | `canPlace`, `coversDoor`, `supportOf`, `elevOf`, `dims`, `isWall` |
| `src/iso.js` | 아이소메트릭 좌표 바꾸기(칸과 화면 픽셀), 가구 상자 크기와 놓이는 자리(`placementOf`), 방과 놀이터 배경 그림(방 벽의 현관문, 놀이터 울타리의 "아파트" 문과 닉네임 문패를 단 이웃집 문 포함) | `tile`, `toTile`, `boxSize`, `placementOf`, `placeEl`, `sceneSVG` 등 |
| `src/shelf.js` | 방 꾸미기 아래 가구 선반. 넘기기와 카드 끌기 | `mountShelf`, `filterShelf` |
| `src/share.js` | 집 상태 검사와 공유 링크(`#room=...`) 만들기, 읽기 | `sanitizeHome`, `encodeHome`, `decodeHome` |
| `src/likes.js` | 주인이 가구마다 담아 두는 것(집 상태의 `likes`). 가구별 칸과 개수, 글자 수 제한, 저장본과 링크에서 온 값 검사, 주소 검사(`safeLink`), 라디오 CD 링크 알아보기(`parseMusic`), 그림 주소 검사(`safeImage`), 바꾸고 저장하기 | `sanitizeLikes`, `setLike`, `safeLink`, `safeImage`, `parseMusic`, `line`, `para`, `isOwner`, `LIMIT` |

## src/apps/: 기본 앱

`data/apps.js`의 `builtin: '<이름>'`은 `src/apps/<이름>-app.js`와 짝입니다. 앱 파일마다 `open...App(os, app)` 함수 하나가 창을 엽니다.

| 파일 | 하는 일 |
| --- | --- |
| `src/apps/index.js` | 기본 앱 등록부(`BUILTIN_APPS`). 새 기본 앱은 여기에 한 줄 더한다 |
| `src/apps/room-app.js` | 방 꾸미기. 공간 탭(바탕화면에 보이는 공간부터), 선반, 창 크기에 맞춰 1280×840 방을 줄이기 |
| `src/apps/folder-app.js` | 폴더(미니게임 폴더). 그 폴더에 속한 앱 아이콘을 보여 준다 |
| `src/apps/share-app.js` | 공유하기. 지금 방을 담은 링크를 만들어 복사하고, 공간마다 방 그림을 PNG 파일로 내려받는다(그림은 `src/room-image.js`가 만든다) |
| `src/apps/mine-app.js` | 나도 만들기와 내 컴퓨터로. 친구 컴퓨터를 구경하는 손님에게만 보이는 아이콘으로, 이 컴퓨터에 내 집이 없으면 로그인 화면으로, 있으면 곧장 내 바탕화면으로 보낸다 |
| `src/apps/music-app.js` | 배경음악. 내 방에서 틀 곡 고르기와 배경음악만 끄고 켜기. 창이 열려 있는 동안은 고른 곡을 들려준다 |
| `src/apps/frame-app.js` | 팀원 앱(`apps/`의 웹페이지)을 iframe 창으로 띄운다. 엉뚱한 페이지로 넘어가면 다시 열기 안내 |
| `src/apps/link-app.js` | `href`가 있는 앱. 새 탭에서 열린다는 것과 주소를 보여 준 뒤 "새 탭에서 열기"로 연다(창 안에서 돌지 않는 남의 게임). 주소가 여럿이면(`links`, 난이도 등) 단추를 하나씩 둔다. 안내와 단추(`linkPrompt`)는 옛날 컴퓨터도 같이 쓴다 |
| `src/apps/console-app.js` | 가구 기믹: 게임기. 가까이 보기 화면에 게임기를 들고 미니게임 폴더의 게임을 늘어놓는다. 단추 셋(십자 단추 고르기, A 시작, B 나가기)의 하는 일을 단추 아래에 새긴다. 고른 게임은 게임기 화면 안에서 하고(다른 사이트 게임은 줄여서), B로 첫 화면에 돌아오며 첫 화면의 B는 게임기를 내려놓는다. 주인은 추천 게임 하나를 고른다 |
| `src/apps/bookshelf-app.js` | 가구 기믹: 책장. 고른 책의 표지(같은 디자인에 제목과 작가, 무작위 색)와 남긴 구절이 크게 뜨고, 선반의 책등이나 방향키로 넘긴다. 주인은 5권까지 넣고 고치고 뺀다 |
| `src/apps/radio-app.js` | 가구 기믹: 라디오. 주인이 넣은 CD(스포티파이, 애플 뮤직 링크)를 펼치고, 고른 CD가 라디오에 들어가 돌면 공식 플레이어를 옆의 작은 창에 띄운다. 음악 창은 라디오를 내려놓아도 남고 그동안 사이트 배경음악을 멈춘다 |
| `src/apps/tv-app.js` | 가구 기믹: TV. 주인이 고른 영화와 TV 시리즈의 포스터를 추천 줄로 늘어놓고 휠과 방향키로 넘긴다. 주인은 위키데이터로 이름을 찾아 연도, 감독, 링크를 채우고 포스터 그림 주소와 추천 이유를 넣는다 |
| `src/apps/computer-app.js` | 가구 기믹: 옛날 컴퓨터. 주인이 넣은 웹 게임이 어느 사이트의 새 탭에서 열리는지 보여 주고 연다. 주인에게는 게임을 넣고 고치는 칸이 있다 |

## data/: 목록

| 파일 | 하는 일 |
| --- | --- |
| `data/apps.js` | 앱 목록. 바탕화면 아이콘, 시작 메뉴, 미니게임 폴더가 모두 여기서 만들어진다. 칸의 뜻은 파일 맨 위에 있다 |
| `data/furniture.js` | 가구 목록. 공간, 자리(벽, 바닥, 책상 위), 크기, 색, 기믹. 칸의 뜻은 파일 맨 위에 있고, 튜토리얼 기본 가구는 맨 아래에 있다 |
| `data/neighbors.js` | 이웃집 목록. 문패에 쓰는 닉네임과 그 집 공유 링크(`#room=` 뒤의 글자). 로그인 화면과 놀이터 울타리에 나온다. 넣는 법은 파일 맨 위에 있다 |
| `data/avatars.js` | 아바타 목록과 그림 규격(스프라이트 시트의 칸 크기와 순서, 발끝 자리). 칸의 뜻은 파일 맨 위에 있다 |

## apps/: 팀원 앱

| 경로 | 하는 일 |
| --- | --- |
| `apps/README.md` | 앱 만드는 법(사람용). 시작하기, 가구에 붙이기, SDK, 지킬 것 |
| `apps/aga-sdk.js` | 앱이 불러 쓰는 SDK. 창 닫기와 제목, 기록 저장(`AGA.save`, `AGA.load`), 게임판 맞추기(`AGA.fitCanvas`), 커서 |
| `apps/_template/` | 새 앱의 틀. 복사해서 시작한다. `_`로 시작하는 폴더는 화면에 나오지 않는다 |
| `apps/tidy-up/` | 짐 정리. 같은 물건 두 개가 닿으면 커지는 게임(아가라고요용으로 만든 예시) |
| `apps/file-ten/` | 파일 정리 10. 바탕화면처럼 끌어서 네모로 파일을 고르고, 숫자 합이 10이면 지우는 게임(아가라고요용으로 만든 예시). 100초 동안 겨루는 보통 모드는 막히면 새 판을 깔고 끝나면 바로 지울 수 있던 묶음을 보여 준다. 캐주얼 모드는 끝까지 다 지울 수 있는 판을 거꾸로 쌓아 만든다 |

자리를 채우려고 넣은 기존 게임 다섯 개(Be the Bee, ENIGMA, See you on the other side, Eyes on You, 충전이 필요해!)는 레포 밖 다른 주소에 있고 `data/apps.js`에 주소만 적혀 있습니다.

## assets/

| 경로 | 하는 일 |
| --- | --- |
| `assets/favicon.png` | 브라우저 탭 아이콘. 32×32px 작은 집 |
| `assets/sounds/` | 효과음과 배경음악 mp3. 팀 드라이브의 원본을 줄이고 잘라 넣었다(어디서 무엇을 잘랐는지는 `docs/requirements.md`의 "소리"). 배경음악은 `bgm-`로 시작한다 |
| `assets/furniture/` | 가구 그림. `<가구 id>.png`, 돌려 놓은 모습은 `<가구 id>-r.png`(없으면 좌우로 뒤집어 쓴다). 첫 그림은 식탁(`dining-table.png`)이다 |
| `assets/fonts/` | 사이트가 쓰는 글자만 남긴 작은 글꼴 AgaUI(보통 `aga-ui.woff2`, 굵게 `aga-ui-bold.woff2`), 들어 있는 글자 목록(`aga-ui.txt`), 갈무리 라이선스(`OFL.txt`). `tools/ui_font.py`가 만든다. 이름을 바꾼 까닭과 다시 만드는 법은 `assets/fonts/README.md` |

## tools/: 도구

| 파일 | 하는 일 |
| --- | --- |
| `tools/serve.py` | 개발 서버. `python tools/serve.py` 후 http://localhost:8123. 캐시를 막아 고친 파일이 바로 보인다. 연결이 한꺼번에 몰려도 거부하지 않게 대기열을 늘려 두었다 |
| `tools/check.py` | 자동 점검. 목록과 파일 경로, 가구 그림 이름, 저장 키, npm 파일, 비밀 값, 방 그림의 바탕 색, 자바스크립트 문법, 이 파일 지도, 배포할 때 `tools/stamp.py`가 채울 자리, 작은 글꼴에 없는 사이트 글자(경고)와 글꼴 미리 받기 주소 |
| `tools/stamp.py` | 배포할 때 `index.html`에 파일 내용 지문(`?v=`)을 붙이고, `src/main.js`에서 import로 닿는 모듈을 미리 받을 줄(modulepreload)을 채운다. GitHub Actions가 돌리므로 사람은 돌리지 않는다 |
| `tools/ui_font.py` | 갈무리11에서 사이트가 화면에 쓰는 글자만 남긴 작은 글꼴 AgaUI를 만든다. 사이트에 새 글자를 넣어 `tools/check.py`가 경고할 때만 돌린다(fonttools와 brotli 필요). 글자 모으는 부분은 check.py도 쓴다 |
| `tools/night-contrast.mjs` | 밤 모드 글자 대비 점검. `node tools/night-contrast.mjs`로 돌린다(10초쯤, Node 22 이상과 크롬이나 엣지 필요). 이 폴더를 `tools/serve.py`로 빈 포트에 띄우고 화면 없는 크롬으로 바탕화면까지 들어가, 창 다섯 개와 시작 메뉴를 연 채 2005 화면의 낮과 밤에서 글자마다 바탕과의 대비를 잰다. 낮에는 4.5:1 이상인데 밤에 그 아래로 떨어지는 글자를 실패로 알린다. 원래 있고 읽히는 예외는 파일 맨 위의 `EXCEPTIONS`에, 여는 창은 `OPEN`에 적는다 |

## docs/: 설명 문서

| 파일 | 하는 일 |
| --- | --- |
| `docs/guide.md` | 사람이 읽는 설명서. 사이트가 어떻게 동작하고 왜 이렇게 만들었는지 |
| `docs/requirements.md` | 요구 사항. 기능 목록과 상태, 가구와 인터랙션, 소리, 아직 정하지 않은 것과 정한 것 |
| `docs/tasks.md` | 할 일 목록. 담당(역할 이름)과 상태 |
| `docs/checklists.md` | PR을 올리기 전, 합치기 전, 발표 전에 사람이 확인할 것 |
| `docs/file-map.md` | 이 문서 |

## worklog/: 작업 일지

작업 한 덩어리(대개 PR 하나)마다 한 편씩 쌓입니다. 파일 이름은 `날짜-GitHub아이디-주제.md`이고, 형식은 `worklog/README.md`에 있습니다.
어떤 코드가 왜 그렇게 생겼는지 궁금하면 그 파일 이름으로 이 폴더를 검색해 보면 됩니다.

## .github/: GitHub 설정

| 파일 | 하는 일 |
| --- | --- |
| `.github/workflows/pages.yml` | main에 합쳐지면 지문을 찍고 GitHub Pages로 배포한다 |
| `.github/workflows/check.yml` | PR마다 `tools/check.py`를 돌린다 |
| `.github/pull_request_template.md` | PR 설명 칸에 미리 채워지는 질문과 확인 항목 |
| `.github/ISSUE_TEMPLATE/bug.yml` | Issues의 버그 제보 양식 |
| `.github/ISSUE_TEMPLATE/idea.yml` | Issues의 아이디어 양식 |

`.claude/launch.json`은 Claude 데스크톱 앱이 개발 서버를 띄울 때 쓰는 설정입니다.

## 누가 누구를 부르나

```
index.html
└─ src/main.js ─── settings.js, cursors.js, crt.js
   └─ src/os.js ── win.js, icons.js, sdk-host.js, share.js, tutorial.js, room.js(renderStatic), avatar.js ── iso.js, rules.js, room.js(zOf), data/avatars.js
      └─ src/apps/index.js
         ├─ room-app.js ── room.js ── rules.js, iso.js
         │                └─ shelf.js
         ├─ share-app.js ── room-image.js ── room.js(imageFor, zOf), iso.js(placementOf, sceneSVG), rules.js
         ├─ folder-app.js, music-app.js, mine-app.js
         └─ frame-app.js ── iframe 안의 apps/<id>/index.html ── apps/aga-sdk.js
data/apps.js, data/furniture.js, src/config.js, src/util.js는 여러 곳에서 읽는다
```

## style.css 안의 순서

위에서부터 이 순서로 놓여 있습니다. 찾을 때는 절 제목(`/* ---------- 창 ---------- */` 같은 줄)으로 검색합니다.

1. 글꼴(`@font-face`), 색과 글꼴 변수(`:root`), 화면 안 커서, 첫 화면 가림막
2. 모니터: 몸체, 화면 둘레, 이름표, 스피커, 물리 버튼
3. 방: 방 색, 밤 그늘, 드래그 중 격자, 가구 상자
4. 가구 선반, 위쪽 이름표와 버튼
5. 창: 방 꾸미기 앱, iframe 앱, 배경음악 앱, 미니게임 폴더
6. 아이콘, 바탕화면, 작업 표시줄과 시작 메뉴
7. 부팅, 로그인
8. 화면 효과(스캔라인, 그레인, 깜빡임), 전원 연출
9. 공간 탭, 밤 모드, 돌리기 안내, 튜토리얼
10. 가구 가까이 보기(`src/closeup.js`): 바탕을 덮는 층과 아래 줄, 게임기, 책장, 라디오와 음악 창, TV. 가까이 보기 안의 넣는 칸(`.like-card`)은 "창" 절의 넣는 칸 규칙 옆에 있다
11. 2005 모습: 모니터, 창, 부팅, 로그인 모양을 덮어쓰는 절
