# 2026-11-01 자동 점검 도구 (soomin007)

## 한 일
팀원 PR을 사람이 일일이 보지 않아도 흔한 실수를 잡도록 `tools/check.py`를 만들고, PR마다 GitHub Actions가 돌리게 했다.
맥과 윈도우가 섞인 팀에서 줄바꿈 문자 때문에 파일 전체가 바뀐 것처럼 보이지 않게 `.gitattributes`도 넣었다.

## 바꾼 파일
- `tools/check.py`(새 파일): npm 파일, 앱과 가구 목록(id 중복과 형식, 파일 경로, 아이콘, folder, gimmick이 가리키는 앱과 공간),
  가구 그림 파일 이름, 앱 저장 키 접두어와 `localStorage.clear()`, import 경로, 비밀 값, 자바스크립트 문법(node가 있을 때)을 본다
- `.github/workflows/check.yml`(새 파일): PR과 main push 때 점검
- `.gitattributes`(새 파일): 줄바꿈 LF로 통일, 그림과 소리는 바이너리
- `AGENTS.md`, `README.md`, `.github/pull_request_template.md`: 커밋 전에 점검 돌리기

## 정한 것과 이유
- 점검은 파이썬 하나로 만들었다. 로컬 서버 때문에 파이썬은 모두 깔려 있고, npm을 들이지 않는 규칙과도 맞는다.
  자바스크립트 문법만 node가 필요한데, GitHub 서버에는 node가 있으므로 PR 점검에서는 빠짐없이 돈다.
- 일부러 틀린 예(npm 파일, 없는 공간을 가리키는 기믹, 이름이 틀린 가구 그림 두 개, 접두어 없는 저장 키)를 넣어 다섯 개 모두 잡히는 것을 확인했다.
- 웹으로 그림만 올리는 팀원이 가장 틀리기 쉬운 것이 파일 이름이라, 가구 그림 이름 검사를 넣었다.

## 남은 일과 알아 둘 것
- 경고(목록에 없는 앱 폴더, node 없음)는 실패로 치지 않는다.
