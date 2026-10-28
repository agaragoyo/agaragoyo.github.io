# 아가라고요: AI 도우미용 규칙

이 파일은 팀원들이 쓰는 AI 코딩 도구(Claude Code, Codex, Cursor, Copilot 등)가 작업 전에 읽는 규칙이다.
사람이 읽을 안내는 `README.md`(레포 전체)와 `apps/README.md`(앱 만들기)에 있다.

아가라고요는 웹프로그래밍 개론 팀 프로젝트로, 2000년대 개인 홈페이지를 "진짜 홈 꾸미기"로 바꾼 웹사이트다.
사이트 전체가 옛 컴퓨터 한 대이고, 전원을 켜면 부팅, 로그인, 바탕화면이 뜨며, 방 꾸미기와 미니게임은 그 컴퓨터의 앱이다.
레포 관리자는 김수민(soomin007)이고, 알파는 11주차, 최종 발표는 15주차다.

## 시작할 때

1. `known-issues.md`를 먼저 읽는다. 같은 함정이 여러 번 재발했다(hidden과 display, 쌓임 맥락, 캐시).
2. `worklog/`에서 지금 작업과 관련된 최근 일지의 "남은 일과 알아 둘 것"을 본다.
3. `git status`, `git log --oneline -10`으로 지금 브랜치와 진행 상황을 확인한다.

## 팀 작업 방식

- main에 바로 push하지 않는다. 브랜치를 만들어 작업하고 Pull Request를 연다. 합치는 것은 레포 관리자가 한다.
  브랜치 이름은 `아이디/주제`(예: `soomin007/sand-dig`), 영어 소문자와 하이픈으로 짓는다.
- 부탁받은 범위의 파일만 고친다. 남의 앱 폴더나 관계없는 파일의 들여쓰기, 줄바꿈, 이름을 정리하지 않는다(충돌의 주된 원인이다).
- 커밋 메시지는 한국어로, 무엇을 왜 바꿨는지 한 줄로 쓴다.
- `tools/stamp.py`는 돌리지 않는다. 배포할 때 GitHub Actions가 자동으로 돌린다(여러 사람이 찍으면 index.html이 충돌한다).
- 작업 한 덩어리를 마치면 `worklog/README.md`의 형식으로 일지를 한 편 쓰고 같은 PR에 넣는다.
  반복될 함정을 찾았으면 `known-issues.md`에 증상, 원인, 규칙 순서로 한 항목을 추가한다.
- 이 레포는 공개다. 커밋하는 모든 글(일지, known-issues, README, 커밋 메시지, PR 설명)에는 공개해도 괜찮은 내용만 쓴다.
  팀원에게 물어볼 질문, 누가 무엇을 제보하거나 좋아했는지, 팀 안의 의견, 사적이거나 민망한 이야기는 넣지 않는다.
  제보는 "제보가 있었다"로만 쓴다. 커밋 전에 바뀐 문서에서 사람 이름과 대화 내용을 한 번 훑는다.

## 실행

- 로컬: `python tools/serve.py` 후 http://localhost:8123 (캐시 금지 서버. `python -m http.server`는 옛 JS를 캐시해서 쓰지 않는다)
- `index.html`을 파일 탐색기에서 더블클릭하면 빈 화면이다(ES 모듈은 `file://`에서 막힌다).
- 시대 비교: 주소에 `?era=1998`, `?era=2005`, `?era=2010`
- 배포: PR이 main에 합쳐지면 `.github/workflows/pages.yml`이 GitHub Pages로 올린다. 1~2분 뒤 반영된다.

## 구조

- `index.html`, `style.css`: 모니터(베젤, 버튼), 화면 효과, OS 화면들. 스타일 끝부분의 "시대 비교" 덩어리가 1998/2005/2010 모습이다
- `src/main.js`: 모니터 일(크기 맞추기, 설정, 전원, 시대). 화면 안쪽은 `src/os.js`에 넘긴다
- `src/os.js`: 부팅, 로그인, 바탕화면, 작업 표시줄, 시작 메뉴, 앱 실행, 앱 SDK 메시지, 초기화
- `src/win.js`: 창 관리자. `src/icons.js`: 기본 앱 아이콘
- `src/crt.js`: 볼록 화면(SVG feDisplacementMap)과 클릭 보정 층, iframe 안으로 입력 넣기, 그레인
- `src/apps/room-app.js`: 방 꾸미기 앱(공간 탭, 창 크기에 맞춰 줄이기)
- `src/room.js`, `src/rules.js`, `src/iso.js`, `src/shelf.js`: 아이소메트릭 방 그리기, 배치 규칙, 끌어 놓기, 돌리기, 선반, 밤 그늘
- `src/share.js`: 저장(localStorage)과 공유 링크. 집 상태 v3 `{ owner, scenes: { room: [...], playground: [...] } }`
- `src/config.js`: 격자, 공간 목록(SCENES), 저장 키. `data/furniture.js`: 가구 목록. `data/apps.js`: 앱 목록
- `apps/`: iframe 앱(미니게임). 만드는 법은 `apps/README.md`, SDK는 `apps/aga-sdk.js`, 예시는 `apps/tidy-up`
- `tools/serve.py`(개발 서버), `tools/stamp.py`(캐시 지문), `worklog/`(작업 일지)

## 지켜야 할 것

- 빌드 도구, npm, 프레임워크를 쓰지 않는다. 그대로 열리는 HTML, CSS, JS(ES 모듈)만 쓴다. 라이브러리는 CDN 주소로 불러온다.
- PC(마우스) 환경만 고려한다. 세로 폰 회전 처리는 남아 있지만 새 기능은 PC 기준으로 만든다.
- 무대는 1280×840 고정 좌표다. 화면 좌표는 반드시 `toLocal`(main의 `mon.toLocal`, 방 앱의 `ctx.toLocal`)로 바꾼다.
  볼록 화면에서는 브라우저의 클릭 위치가 어긋나므로, 클릭을 받는 새 요소는 `.crt-input`이 보내는 합성 이벤트로 동작하는지 확인한다.
  더블클릭과 오른쪽 클릭은 넘어가지 않는다(아이콘 더블클릭은 클릭 간격으로 직접 판정한다).
- hidden으로 숨기는 요소에 display를 주는 규칙은 `:not([hidden])`이나 `[hidden]` 짝 규칙을 같이 둔다.
- 가구를 그리는 상자는 쌓임 맥락을 만든다(가구 z-index가 창 위로 새어 나온다).
- localStorage 키는 `agarago.`(OS) 또는 `앱id.`(앱)로 시작한다. 저장소를 지울 때 `localStorage.clear()`를 쓰지 않는다.
- 실제 윈도우 로고, 이름, 다른 회사의 로고 색은 쓰지 않는다. 시대의 모양새만 따른다.
- 남의 게임을 그대로 베끼지 않는다. 같은 장르의 우리 게임으로 만든다(짐 정리, 파일 정리 10이 그 예).
- 새 미니게임 캔버스는 `html, body { overflow: hidden }`, 정수 크기, 크기가 바뀔 때만 다시 맞춘다(스크롤바 진동).

## 팀에서 정하는 중

- 시대: 1998(베이지 CRT, 볼록, BIOS 부팅), 2005(은색 평면 CRT, 왜곡 없음, XP 시절식), 2010(검은 LCD, 유리 창, 맑은 고딕)을
  스위치로 두고 비교하는 중이다. 정하면 `style.css` 끝 "시대 비교" 덩어리, `src/main.js`의 ERAS, `index.html`의 `.era-switch`를 정리한다.
- 시점과 아트: 지금은 아이소메트릭(싸이월드 미니룸식). 평면 시점도 후보다. 아트가 정해지면 그림 크기는 `iso.js`의 `boxSize`를 따른다.
  가구 그림은 `assets/furniture/<id>.png`, 돌린 모습은 `<id>-r.png`(없으면 좌우 뒤집기).
