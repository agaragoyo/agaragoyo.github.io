# 2026-11-01 코어 정리 (soomin007)

## 한 일
팀원이 기능을 붙이기 전에, 한 파일에 몰려 있던 OS 코드를 역할별로 나누고 반복되던 코드를 한곳으로 모았다.
겉으로 보이는 동작은 바꾸지 않았다. 덤으로 방 꾸미기를 열 때마다 쌓이던 이벤트 리스너와 창 크기를 끌 때의 버벅임을 고쳤다.

## 바꾼 파일
- `src/settings.js`(새 파일): 설정 저장소. `get/set/subscribe`로 읽고 바꾸고 변화를 듣는다. main.js와 os.js가 주고받던 getNight, setNight, getEra 콜백을 없앴다
- `src/util.js`(새 파일): 요소 만들기 `h()`, `loadJSON/saveJSON`(share.js에서 옮김), `wait`, `reduceMotion`, `clamp`
- `src/sdk-host.js`(새 파일): 앱 SDK 메시지를 종류별 함수(`HANDLERS`)로. 시대 변경 때 커서 다시 보내기는 MutationObserver 대신 settings 구독으로
- `src/apps/index.js`, `folder-app.js`, `share-app.js`, `frame-app.js`(새 파일): os.js 안에 있던 폴더, 공유, iframe 앱을 꺼냈다
- `src/os.js`: 497줄에서 290줄 남짓으로. 앱은 등록부로 열고, 반복되던 요소 만들기는 `h()`로
- `src/main.js`: settings 저장소 사용. resize는 한 화면에 한 번만 맞춘다
- `src/crt.js`: 볼록 지도를 창 크기를 끄는 동안에는 미뤘다가 한 번만 다시 만든다. 커서 모양은 가리키는 요소가 바뀔 때만 읽는다
- `src/shelf.js`: 열 때마다 window에 붙고 떼지 않던 resize 리스너를 없앴다(선반은 transform으로만 줄어 필요 없었다)
- `src/config.js`: `DESK_W`, `DESK_H`, `DOUBLE_CLICK_MS`를 모았다(win.js, os.js에 따로 있었다)
- `AGENTS.md`: 구조 목록

## 정한 것과 이유
- 기본 앱은 `src/apps/<이름>-app.js` 한 파일에 `open...App(os, app)` 하나로 둔다. 새 기본 앱도 같은 모양으로 만들면 된다.
- os.js가 넘겨주는 것(`os.wm`, `os.settings`, `os.toast`, `os.renderIcons`, `os.canSee`, `os.crt` ...)이 기본 앱이 쓰는 도구 상자다.
- 확인: 로컬에서 부팅, 로그인, 바탕화면, 폴더, 공유와 복사, 시작 메뉴, 밤, 방에 가구 놓기와 치우기, 가구 창, 창 버튼,
  짐 정리 창의 SDK(제목, 정보, 커서, 닫기), 시대 바꾸기, 다시 열기 안내, 손님 구경, 전원 끄기를 돌려 오류가 없었다.

## 남은 일과 알아 둘 것
- 다음 덩어리: 자동 점검 도구, 그레인 최적화, SDK 도우미와 앱 틀, 마우스 설정 앱.
