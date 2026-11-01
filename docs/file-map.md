# 파일 지도

어떤 파일이 어디에 있고 무엇을 하는지 한곳에 모았습니다. 고칠 곳을 찾을 때 폴더를 뒤지거나 검색하기 전에 이 문서부터 보면 시간이 덜 듭니다.
사람과 AI 도구가 함께 쓰는 문서이고, 파일을 새로 만들거나 옮기거나 지우면 이 문서도 같은 PR에서 고칩니다.
`src/`, `data/`, `tools/`, `docs/` 아래 파일이 여기에 빠져 있으면 자동 점검(`python tools/check.py`)이 오류로 알려 줍니다.

사이트가 어떻게 동작하는지는 `docs/guide.md`, 작업 규칙은 `AGENTS.md`, 실행과 올리는 순서는 `README.md`에 있습니다.

## 자주 찾는 것

| 하고 싶은 일 | 가 볼 곳 |
| --- | --- |
| 새 미니게임이나 앱 만들기 | `apps/_template/`를 복사하고 `data/apps.js`에 한 줄 (`apps/README.md`) |
| 가구를 눌렀을 때 앱 열기 | `data/apps.js`에 `folder: 'furniture'`, `data/furniture.js`의 그 가구에 `gimmick: 'app:<id>'` |
| 가구 추가, 크기나 색 바꾸기 | `data/furniture.js`. 그림은 `assets/furniture/<id>.png` |
| 공간(방, 놀이터) 추가 | `src/config.js`의 `SCENES` |
| 격자 크기, 벽 높이, 화면 크기 | `src/config.js` |
| 가구를 놓을 수 있는지 정하는 규칙 | `src/rules.js`의 `canPlace` |
| 가구 끌기, 돌리기, 치우기 | `src/room.js`의 `beginDrag` |
| 앞뒤로 겹쳐 그리는 순서 | `src/room.js`의 `zOf`, `src/iso.js`의 `depthOf` |
| 방 바닥과 벽 그림 | `src/iso.js`의 `roomSVG`, `outdoorSVG` |
| 밤의 어둠과 불빛 | `src/room.js`의 `renderShade`, `style.css`의 "밤 모드" 절 |
| 부팅 글자, 로그인 화면 흐름 | `src/os.js`의 `BIOS`, `showLogin` |
| 시작 메뉴 항목 | `src/os.js`의 `openStartMenu` |
| 창 열기, 끌기, 최대화 | `src/win.js` |
| 시대마다 다른 모니터와 창 모양 | `style.css` 끝의 "시대 비교" 덩어리, `src/main.js`의 `ERAS` |
| 볼록 화면이 휘는 정도 | `src/main.js`의 `ERAS`(`warp`), 공식은 `src/crt.js`의 `warp` |
| 커서 그림과 색 | `src/cursors.js`, 마우스 앱은 `src/apps/mouse-app.js` |
| 새 설정 값 | `src/settings.js`의 `DEFAULTS` |
| 저장 키 이름 | `src/config.js`의 `STORAGE_*` |
| 공유 링크 형식 | `src/share.js`의 `encodeHome`, `decodeHome` |
| 앱 SDK에 기능 더하기 | `src/sdk-host.js`의 `HANDLERS`와 `apps/aga-sdk.js` |
| 자동 점검 규칙 더하기 | `tools/check.py`에 `check_...` 함수 |
| 예전에 겪은 함정 | `known-issues.md` |

## 맨 위

| 파일 | 하는 일 |
| --- | --- |
| `index.html` | 사이트의 유일한 HTML. 모니터, 화면 층(무대, 그레인, 볼록 보정 층), 부팅, 로그인, 바탕화면, 작업 표시줄의 뼈대가 들어 있다. 맨 위 import map과 `?v=` 지문은 배포할 때 `tools/stamp.py`가 채우므로 손으로 고치지 않는다 |
| `style.css` | 모든 모양. 아래 "style.css 안의 순서"에 절 목록이 있다 |
| `README.md` | 레포 첫 화면. 내 컴퓨터에서 여는 법, 작업을 올리는 세 가지 방법, 시작하는 자리 |
| `AGENTS.md` | AI 코딩 도구가 작업 전에 읽는 규칙 |
| `CLAUDE.md` | Claude Code용. `AGENTS.md`를 불러오고 Claude 전용 몇 줄만 더한다 |
| `known-issues.md` | 되풀이된 함정 목록(증상, 원인, 규칙). 코드를 고치기 전에 읽는다 |
| `.gitignore` | 레포에 올리지 않는 파일(개인 기획 문서, Claude 개인 설정) |
| `.gitattributes` | 줄바꿈을 LF로 통일한다(맥과 윈도우가 섞인 팀) |
| `.nojekyll` | GitHub Pages가 파일을 가공하지 않고 그대로 내보내게 한다 |

## src/: 시작과 설정

| 파일 | 하는 일 | 내보내는 것 |
| --- | --- | --- |
| `src/main.js` | 시작점. 모니터 크기 맞추기, 시대 정하기, 테두리 버튼, 전원 연출을 맡고 화면 안쪽은 `os.js`에 넘긴다 | 없음 |
| `src/settings.js` | 이 컴퓨터의 설정(그레인, 볼록, 밤, 시대, 커서) 저장소. 바뀌면 구독자에게 알린다 | `settings` |
| `src/config.js` | 숫자와 이름만 모은 곳. 격자, 방과 화면 크기, 공간 목록, 저장 키 | `N`, `TW`, `SCENES`, `STORAGE_*` 등 |
| `src/util.js` | 여러 파일이 같이 쓰는 작은 도구. 요소 만들기, 저장소 읽고 쓰기 | `h`, `loadJSON`, `saveJSON`, `wait`, `clamp`, `reduceMotion` |

## src/: 컴퓨터(OS)

| 파일 | 하는 일 | 내보내는 것 |
| --- | --- | --- |
| `src/os.js` | 부팅, 로그인, 바탕화면 아이콘, 시작 메뉴, 시계, 앱 열기, 가구 기믹 처리, 초기화, 알림 | `createOS` |
| `src/win.js` | 창 관리자. 창과 작업 표시줄 버튼을 만들고 끌기, 최소화, 최대화, 닫기를 한다 | `createWM` |
| `src/icons.js` | 아이콘 하나 만들기. 기본 앱 아이콘(방, 폴더, 공유, 마우스, 가구)은 SVG로 직접 그린다 | `iconEl` |
| `src/sdk-host.js` | 팀원 앱(iframe)과 주고받는 메시지. 종류마다 함수 하나(`HANDLERS`) | `createSdkHost` |
| `src/crt.js` | 볼록 화면(SVG 필터), 휜 화면의 입력을 바로잡는 보정 층, iframe 안으로 입력 넣기, 그레인 노이즈 그림 | `initCRT` |
| `src/cursors.js` | 화면 안 커서 그림을 만들어 `--cur-*` CSS 변수로 넣는다. 설정의 `cursor`(색, 크기, 직접 그린 그림)를 따른다 | `initCursors`, `cursorSet`, `defaultPixels` 등 |

## src/: 방 그리기

| 파일 | 하는 일 | 내보내는 것 |
| --- | --- | --- |
| `src/room.js` | 가구 그리기(그림이 없으면 임시 상자), 끌어 놓기와 돌리기, 앞뒤 순서, 밤 그늘, 바탕화면용 방 그림 | `furnitureEl`, `renderItems`, `renderStatic`, `beginDrag` 등 |
| `src/rules.js` | 배치 규칙. 화면과 상관없는 계산만 있어서 공유 링크 검사에도 같이 쓴다 | `canPlace`, `supportOf`, `elevOf`, `dims`, `isWall` |
| `src/iso.js` | 아이소메트릭 좌표 바꾸기(칸과 화면 픽셀), 가구 상자 크기, 방과 놀이터 배경 그림 | `tile`, `toTile`, `boxSize`, `placeEl`, `sceneSVG` 등 |
| `src/shelf.js` | 방 꾸미기 아래 가구 선반. 넘기기와 카드 끌기 | `mountShelf`, `filterShelf` |
| `src/share.js` | 집 상태 검사와 공유 링크(`#room=...`) 만들기, 읽기 | `sanitizeHome`, `encodeHome`, `decodeHome` |

## src/apps/: 기본 앱

`data/apps.js`의 `builtin: '<이름>'`은 `src/apps/<이름>-app.js`와 짝입니다. 앱 파일마다 `open...App(os, app)` 함수 하나가 창을 엽니다.

| 파일 | 하는 일 |
| --- | --- |
| `src/apps/index.js` | 기본 앱 등록부(`BUILTIN_APPS`). 새 기본 앱은 여기에 한 줄 더한다 |
| `src/apps/room-app.js` | 방 꾸미기. 공간 탭, 선반, 창 크기에 맞춰 1280×840 방을 줄이기 |
| `src/apps/folder-app.js` | 폴더(미니게임 폴더). 그 폴더에 속한 앱 아이콘을 보여 준다 |
| `src/apps/share-app.js` | 공유하기. 지금 방을 담은 링크를 만들고 복사한다 |
| `src/apps/mouse-app.js` | 마우스. 커서 색과 크기, 32×32칸 직접 그리기 |
| `src/apps/frame-app.js` | 팀원 앱(`apps/`의 웹페이지)을 iframe 창으로 띄운다. 엉뚱한 페이지로 넘어가면 다시 열기 안내 |

## data/: 목록

| 파일 | 하는 일 |
| --- | --- |
| `data/apps.js` | 앱 목록. 바탕화면 아이콘, 시작 메뉴, 미니게임 폴더가 모두 여기서 만들어진다. 칸의 뜻은 파일 맨 위에 있다 |
| `data/furniture.js` | 가구 목록. 공간, 자리(벽, 바닥, 책상 위), 크기, 색, 기믹. 칸의 뜻은 파일 맨 위에 있다 |

## apps/: 팀원 앱

| 경로 | 하는 일 |
| --- | --- |
| `apps/README.md` | 앱 만드는 법(사람용). 시작하기, 가구에 붙이기, SDK, 지킬 것 |
| `apps/aga-sdk.js` | 앱이 불러 쓰는 SDK. 창 닫기와 제목, 기록 저장(`AGA.save`, `AGA.load`), 게임판 맞추기(`AGA.fitCanvas`), 커서 |
| `apps/_template/` | 새 앱의 틀. 복사해서 시작한다. `_`로 시작하는 폴더는 화면에 나오지 않는다 |
| `apps/tidy-up/` | 짐 정리. 같은 물건 두 개가 닿으면 커지는 게임(아가라고요용으로 만든 예시) |
| `apps/file-ten/` | 파일 정리 10. 바탕화면처럼 끌어서 네모로 파일을 고르고, 숫자 합이 10이면 지우는 게임(아가라고요용으로 만든 예시) |

김수민의 기존 게임 네 개(Be the Bee, ENIGMA, See you on the other side, Eyes on You)는 레포 밖 다른 주소에 있고, `data/apps.js`에 주소만 적혀 있습니다.

## assets/

| 경로 | 하는 일 |
| --- | --- |
| `assets/furniture/` | 가구 그림. `<가구 id>.png`, 돌려 놓은 모습은 `<가구 id>-r.png`(없으면 좌우로 뒤집어 쓴다). 지금은 비어 있다 |

## tools/: 도구

| 파일 | 하는 일 |
| --- | --- |
| `tools/serve.py` | 개발 서버. `python tools/serve.py` 후 http://localhost:8123. 캐시를 막아 고친 파일이 바로 보인다 |
| `tools/check.py` | 자동 점검. 목록과 파일 경로, 가구 그림 이름, 저장 키, npm 파일, 비밀 값, 자바스크립트 문법, 이 파일 지도 |
| `tools/stamp.py` | 배포할 때 `index.html`에 파일 내용 지문(`?v=`)을 붙인다. GitHub Actions가 돌리므로 사람은 돌리지 않는다 |

## docs/: 설명 문서

| 파일 | 하는 일 |
| --- | --- |
| `docs/guide.md` | 사람이 읽는 설명서. 사이트가 어떻게 동작하고 왜 이렇게 만들었는지 |
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
   └─ src/os.js ── win.js, icons.js, sdk-host.js, share.js, room.js(renderStatic)
      └─ src/apps/index.js
         ├─ room-app.js ── room.js ── rules.js, iso.js
         │                └─ shelf.js
         ├─ folder-app.js, share-app.js, mouse-app.js(cursors.js)
         └─ frame-app.js ── iframe 안의 apps/<id>/index.html ── apps/aga-sdk.js
data/apps.js, data/furniture.js, src/config.js, src/util.js는 여러 곳에서 읽는다
```

## style.css 안의 순서

위에서부터 이 순서로 놓여 있습니다. 찾을 때는 절 제목(`/* ---------- 창 ---------- */` 같은 줄)으로 검색합니다.

1. 색과 글꼴 변수(`:root`), 화면 안 커서
2. 모니터: 몸체, 화면 둘레, 이름표, 스피커, 물리 버튼
3. 방: 방 색, 밤 그늘, 드래그 중 격자, 가구 상자
4. 가구 선반, 위쪽 이름표와 버튼
5. 창: 방 꾸미기 앱, iframe 앱, 마우스 앱, 미니게임 폴더
6. 아이콘, 바탕화면, 작업 표시줄과 시작 메뉴
7. 부팅, 로그인
8. 화면 효과(스캔라인, 그레인, 깜빡임, 볼록), 전원 연출
9. 공간 탭, 밤 모드, 돌리기 안내
10. 시대 비교: 1998, 2005, 2010 덩어리(모니터, 창, 부팅, 로그인 모양을 시대마다 덮어쓴다)
