# 2026-11-11 바탕화면 놀이터의 하늘색 맞추기 (soomin007)

## 한 일
바탕화면에서 놀이터로 나가면 하늘이 방과 같은 청록색이었는데, 방 꾸미기 창과 내려받는 놀이터 그림처럼 하늘색으로 맞췄다.
방 그림에 아바타를 넣으면서(PR 84) 바탕화면과 그림을 겹쳐 보다가 찾았다(known-issues 64).

## 바꾼 파일
- `src/os.js`: `renderWallpaper`가 바탕화면(`#desktop`)에 지금 공간의 종류(`data-kind`, indoor나 outdoor)를 단다
- `style.css`: `.desktop[data-kind="outdoor"]`에 놀이터 하늘색. 똑같은 줄이 두 번 있던 `.room[data-kind="outdoor"]` 가운데 바탕화면 절의 것을 이 규칙으로 바꿨다
- `tools/check.py`: `check_room_image`가 바탕화면 놀이터의 하늘색도 `src/room-image.js`의 `BACKDROP`과 같은지 본다
- `src/room-image.js`: `BACKDROP` 주석에 바탕화면 놀이터도 같은 색이라고 적음
- `known-issues.md` 64번

## 정한 것과 이유
- 하늘은 방 상자(`.wallpaper`, 1280×720)가 아니라 그 뒤의 바탕화면(`.desktop`, 1280×800)에 칠한다. 방 상자만 칠하면 위아래 40px 띠가 청록색으로 남아 줄이 보인다.
- 바탕화면은 방 상자보다 40px 위에서 시작하므로 색이 바뀌는 자리를 px로 적었다(40px에서 472px까지).
  방 꾸미기 창의 0%에서 60%(방 상자의 0~432px)와 같은 자리에서 바뀐다.
- 밤에는 지금처럼 밤하늘이다. `.stage[data-theme="night"] .desktop` 규칙이 더 구체적이라 놀이터에서도 그쪽이 이긴다.

## 확인한 것
- 화면 없는 크롬에서 바탕화면의 놀이터를 찍어 내려받는 놀이터 그림과 견줬다. 화면 전체의 색 차이 평균이 28에서 3.8로 내려갔다.
  방으로 돌아오면 다시 방 바탕색이고, 밤에는 밤하늘 그대로였다.
- `node tools/css-diff.mjs`: 화면 99가지 가운데 낮의 놀이터(와 그 위에 뜨는 이웃집 놀러 가기 창)에서 `#desktop`의 바탕 하나만 바뀌었다. 밤의 놀이터는 그대로다.
- `node tools/smoke.mjs` 151개 통과, `node tools/night-contrast.mjs` 실패 0개, `python tools/check.py` 오류 0개.

## 남은 일과 알아 둘 것
- 밤의 그늘(`.night-shade`)은 방 상자에만 깔려서 바탕화면 위아래 40px 띠는 밤에 조금 더 밝다. 방에서도 전부터 그랬다.
