# 2026-11-24 TV 포스터를 매끈하게 줄이기 (soomin007)

## 한 일

TV 화면의 포스터 사진이 도트처럼 거칠게 줄어들던 것을 고쳤다. 원인이 둘이었다. TV 틀에 준 `image-rendering: pixelated`(PR 180)를 포스터가 물려받았고,
그보다 먼저부터 `object-fit: cover`로 잘라 넣은 큰 그림을 크롬이 줄인 사본 없이 줄이고 있었다.

## 바꾼 파일

- `style.css`: `.tv-screen`에 `image-rendering: auto`. `.tv-poster img`는 `object-fit: cover` 대신 그림을 통째로 그리고, 넘친 쪽은 카드(`overflow: hidden`)가 자른다
- `src/apps/tv-app.js`: 카드보다 옆으로 넓은 그림을 받으면 `wide`를 붙여 높이에 맞춘다
- `known-issues.md`: 121에 덧붙이고 125를 더함

## 정한 것과 이유

- `image-rendering`만 되돌린 것은 버렸다. 계산값은 `auto`로 바뀌었지만 찍은 그림은 거의 같았다(옆 점과의 밝기 차 평균이 2000×3000 포스터에서 48.4에서 46.1).
  그림을 통째로 그리면 18.3으로 매끈해졌다. 두 가지를 다 고쳐야 한다(통째로 그려도 `pixelated`면 47.7이다).
- 빈 문서에서 같은 그림으로 실험했다. 칸과 비율이 같아 자르지 않는 `cover`는 20.9, 비율이 조금 달라 잘리는 `cover`는 46.2, 배경의 `cover`는 45.9였다.
  그래픽 카드로 그리는 크롬에서 잰 값이다.
- 그림을 받는 동안에는 예전처럼 검은 칸 대신 제목 카드가 보인다. 그림을 받지 못하면 지금처럼 제목 카드가 남는다.

## 남은 일과 알아 둘 것

- 포스터는 주인이 그림 주소를 붙여 넣은 작품에만 뜬다. 이름으로 찾아 넣으면 이름, 연도, 감독, 링크만 채워지고 제목 카드가 걸린다(2026-11-10에 저작권 때문에 그림은 가져오지 않기로 정함).
- 사진 아이콘(`.app-icon.picture img`)과 CD 표지(`.cd-art`)도 `object-fit: cover`다. CD 표지는 정사각형이라 잘리지 않고, 사진 아이콘은 이번에 보지 않았다.
- 확인: `python tools/check.py` 오류 0개, `node tools/smoke.mjs` 1003개 가운데 실패 0개, `node tools/night-contrast.mjs` 실패 0개.
  `node tools/css-diff.mjs --base=origin/main`에서 다른 것은 TV 화면들의 `image-rendering`뿐이다(78곳).
  시험 그림으로 옆으로 넓은 그림, 아주 긴 그림, 비율이 같은 그림, 투명한 그림, 받지 못한 그림을 보았다. 넷은 카드를 꽉 채우고 가운데에 오며, 받지 못한 그림은 제목 카드가 남는다.
