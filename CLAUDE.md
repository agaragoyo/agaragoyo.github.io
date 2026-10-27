# 아가라고요 (웹프로그래밍 개론 팀 프로젝트)

2000년대 개인 홈페이지를 "진짜 홈 꾸미기"로 바꾼 웹사이트다. 사이트 전체가 옛 컴퓨터 한 대이고,
전원을 켜면 부팅, 로그인, 바탕화면이 뜨며, 방 꾸미기와 미니게임은 그 컴퓨터의 앱이다.
지금 레포는 김수민(사용자)이 혼자 만든 뼈대 데모이고, 팀원에게 보여 준 뒤 팀 레포로 옮길 예정이다.

- 배포: https://soomin007.github.io/agarago-demo/ (GitHub Pages, main 브랜치 루트)
- 레포: soomin007/agarago-demo (공개)
- 일정: 9주차에 시작, 알파 11주차, 최종 발표 15주차
- 처음 기획 문서 `아가라고요 기획안 (초안).md`는 개인 메모라 .gitignore로 빠져 있다(이 PC에만 있다).

## 세션 시작 루틴

1. `known-issues.md`를 먼저 읽는다. 같은 함정이 여러 번 재발했다(hidden과 display, 쌓임 맥락, 캐시).
2. `session_logs/`에서 가장 최근 파일의 "미해결 / 다음 할 일"을 본다.
3. `git status`, `git log --oneline -10`으로 어디까지 했는지 확인한다.

## 실행과 배포

- 로컬: `python tools/serve.py` 후 http://localhost:8123 (캐시 금지 서버. `python -m http.server`는 옛 JS를 캐시해서 쓰지 않는다)
- 시대 비교: 주소에 `?era=1998`, `?era=2005`, `?era=2010`
- 커밋하기 전에 반드시 `python tools/stamp.py`를 실행한다. index.html의 import map과 `?v=` 지문을 채워서,
  배포 직후 브라우저가 옛 파일을 쓰지 않게 한다(GitHub Pages 캐시 10분). git 훅은 자동 설치하지 않았다.
- 배포는 main에 push하면 1~2분 뒤 반영된다. 확인: `gh api repos/soomin007/agarago-demo/pages/builds/latest`

## 구조

- `index.html`, `style.css`: 모니터(베젤, 버튼), 화면 효과, OS 화면들. 스타일 끝부분의 "시대 비교" 덩어리가 1998/2005/2010 모습이다
- `src/main.js`: 모니터 일(크기 맞추기, 설정, 전원, 시대). 화면 안쪽은 `src/os.js`에 넘긴다
- `src/os.js`: 부팅, 로그인, 바탕화면, 작업 표시줄, 시작 메뉴, 앱 실행, 앱 SDK 메시지, 초기화
- `src/win.js`: 창 관리자. `src/icons.js`: 기본 앱 아이콘
- `src/crt.js`: 볼록 화면(SVG feDisplacementMap)과 클릭 보정 층, iframe 안으로 입력 넣기, 그레인
- `src/apps/room-app.js`: 방 꾸미기 앱(공간 탭, 창 크기에 맞춰 줄이기)
- `src/room.js`, `src/rules.js`, `src/iso.js`, `src/shelf.js`: 아이소메트릭 방 그리기, 배치 규칙, 끌어 놓기, 돌리기, 선반, 밤 그늘
- `src/share.js`: 저장(localStorage)과 공유 링크. 집 상태 v3 `{ owner, scenes: { room: [...], playground: [...] } }`
- `src/config.js`: 격자, 공간 목록(SCENES), 저장 키. `data/furniture.js`: 가구 26개. `data/apps.js`: 앱 목록
- `apps/`: iframe 앱(미니게임). `apps/README.md`가 팀원용 안내, `apps/aga-sdk.js`가 SDK, 예시는 `apps/tidy-up`
- `tools/serve.py`(개발 서버), `tools/stamp.py`(캐시 지문)

## 지켜야 할 것

- 빌드 도구, npm, 프레임워크를 쓰지 않는다. 그대로 열리는 HTML, CSS, JS(ES 모듈)만 쓴다.
- 지금은 PC(마우스) 환경만 고려한다(사용자 지시). 세로 폰 회전 처리는 남아 있지만 새 기능은 PC 기준으로 만든다.
- 무대는 1280×840 고정 좌표다. 화면 좌표는 반드시 `toLocal`(main의 `mon.toLocal`, 방 앱의 `ctx.toLocal`)로 바꾼다.
  볼록 화면에서는 브라우저의 클릭 위치가 어긋나므로, 클릭을 받는 새 요소는 `.crt-input`이 보내는 합성 이벤트로 동작하는지 확인한다.
  더블클릭과 오른쪽 클릭은 넘어가지 않는다(아이콘 더블클릭은 클릭 간격으로 직접 판정한다).
- hidden으로 숨기는 요소에 display를 주는 규칙은 `:not([hidden])`이나 `[hidden]` 짝 규칙을 같이 둔다.
- 가구를 그리는 상자는 쌓임 맥락을 만든다(가구 z-index가 창 위로 새어 나온다).
- 실제 윈도우 로고, 이름, 다른 회사의 로고 색은 쓰지 않는다. 시대의 모양새만 따른다.
- 남의 게임을 그대로 베끼지 않는다. 같은 장르의 우리 게임으로 만든다(짐 정리, 파일 정리 10이 그 예).
- 새 미니게임 캔버스는 `html, body { overflow: hidden }`, 정수 크기, 크기가 바뀔 때만 다시 맞춘다(스크롤바 진동).

## 결정 대기 중

- 시대: 1998(베이지 CRT, 볼록, BIOS 부팅), 2005(은색 평면 CRT, 왜곡 없음, XP 시절식), 2010(검은 LCD, 유리 창, 맑은 고딕)을
  스위치로 두고 팀 의견을 받는 중이다. 정하면 `style.css` 끝 "시대 비교" 덩어리, `src/main.js`의 ERAS, `index.html`의 `.era-switch`를 정리한다.
- 시점과 아트: 지금은 아이소메트릭(싸이월드 미니룸식). 아트 팀이 정해지면 그림 크기는 `iso.js`의 `boxSize`를 따른다.
  가구 그림은 `assets/furniture/<id>.png`, 돌린 모습은 `<id>-r.png`(없으면 좌우 뒤집기).
