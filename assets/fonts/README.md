# 작은 글꼴 AgaUI

이 폴더의 `aga-ui.woff2`(보통)와 `aga-ui-bold.woff2`(굵게)는 갈무리11 2.40.3에서 아가라고요 사이트가 화면에 쓰는 글자만 남긴 글꼴입니다.
첫 화면이 갈무리 전체(두 벌 약 670KB)를 기다리지 않고 이 글꼴(두 벌 합쳐 약 21KB)로 바로 그려지도록 만들었습니다.
사용자가 입력하는 닉네임이나 말풍선처럼 여기에 없는 글자는 jsdelivr에서 받는 갈무리11 전체가 그립니다.

## 라이선스

갈무리는 이민서(quiple) 님이 만든 글꼴이고 SIL Open Font License 1.1을 따릅니다. 라이선스 전문은 `OFL.txt`에 있습니다.
갈무리의 `galmuri.css`에는 "Galmuri"가 예약된 글꼴 이름(Reserved Font Name)으로 적혀 있습니다.
OFL은 글자를 덜어 낸 글꼴도 원본을 고친 판(Modified Version)으로 보고, 고친 판은 예약된 이름을 글꼴 이름으로 쓰지 못하게 합니다.
그래서 이 글꼴은 글꼴 안의 이름을 AgaUI로 바꾸었고, 원래 저작권 문구와 라이선스 문구는 그대로 남겨 두었습니다.
이 글꼴을 다시 고치거나 다른 곳에 쓸 때도 이름에 Galmuri를 넣지 말고 OFL 1.1로 배포해 주시기 바랍니다.

## 다시 만들기

사이트에 새 글자를 넣었는데 작은 글꼴에 없으면 `python tools/check.py`가 경고합니다. 그때 아래 두 줄로 다시 만듭니다.
`aga-ui.txt`는 도구가 만든 글자 목록이라 손으로 고치지 않습니다.

    pip install fonttools brotli
    python tools/ui_font.py
