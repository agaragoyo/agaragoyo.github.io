# 2026-11-18 줄 끝만 바뀐 파일을 알리는 점검 (soomin007)

## 한 일
`tools/check.py`에 `check_line_endings`를 더했다. 편집 도구가 CRLF와 LF를 바꿔 써서 diff가 파일 전체로 잡히는 함정(known-issues 28)이 이 날 하루에도 몇 번 되풀이됐다. Git Bash의 `sed -i`가 CRLF 파일을 LF로, 윈도우 파이썬의 `write_text`가 LF 파일을 CRLF로 바꿔 쓴 것이다.
그런데 막는 방법이 `git diff --stat`과 `--ignore-cr-at-eol --stat`을 손으로 견주는 것뿐이었다. 이제 `python tools/check.py`가 줄 끝이 달라진 파일을 경고로 알린다.
점검은 둘이다. 하나는 작업 트리의 줄 끝이 index와 다른 파일(`git ls-files --eol`의 `i/`와 `w/`가 다르다)을 찾는다. 다른 하나는 HEAD와 main이 갈라진 곳에서 지금 index까지의 `git diff --numstat`이 `--ignore-cr-at-eol`을 붙이면 줄어드는 파일, 곧 커밋했거나 스테이징한 변경에 줄 끝만 바뀐 줄이 있는 파일을 찾는다.

## 바꾼 파일
- `tools/check.py`: `check_line_endings`와 도우미(`git`, `eol_kind`, `eol_worktree_changes`, `eol_base`, `eol_numstat`, `eol_committed_changes`). `main()`에서 부른다
- `known-issues.md`: 28번의 규칙 줄이 새 점검을 가리키게 고침
- `docs/file-map.md`: `tools/check.py` 설명에 줄 끝 점검을 더함
- `docs/checklists.md`: "PR을 올리기 전"의 `check.py` 항목에 `줄 끝` 경고를 더함
- `worklog/2026-11-18-soomin007-eol-check.md`: 이 일지

## 정한 것과 이유
- 오류가 아니라 경고로 했다. known-issues 28은 레포 전체의 줄바꿈 정리를 따로 한 PR로 하라고 하는데, 그 PR에서는 이 점검이 맞게 뜨기 때문이다. 경고는 종료 코드에 영향을 주지 않는다.
- 커밋한 변경은 HEAD가 아니라 index와 견준다(`git diff --cached <갈라진 곳>`). 커밋한 것과 스테이징만 한 것이 한 번에 잡힌다. 아직 스테이징하지 않은 편집은 첫째 점검이 맡는다. 둘이 겹치지 않아서 한 파일이 같은 일로 두 번 나오지 않는다.
- 갈라진 곳은 `origin/main`과 `main` 각각의 merge base 가운데 HEAD에 가까운 쪽으로 잰다. 이 PC에서 로컬 `main`이 `origin/main`보다 여러 PR 뒤처져 있었고, `main`만 쓰면 남의 PR까지 훑게 된다. 둘 다 없거나 못 구하면 이 부분만 조용히 건너뛴다.
- PR 점검(GitHub Actions)의 checkout은 기록이 얕아 `origin/main`이 없으므로 둘째 점검은 건너뛴다. 첫째 점검은 돌지만 checkout한 트리는 항상 index와 같아 조용하다. 그래서 줄 끝 경고는 사실상 내 컴퓨터에서만 나온다. 워크플로는 건드리지 않았다.
- `i/lf w/crlf`(index는 LF인데 작업 트리만 CRLF)도 알린다. 임시 저장소에서 확인하니 이 경우 git은 커밋할 때 LF로 되돌려 올리고 `git diff`에도 나오지 않는다. 실제 diff에 줄 끝만 바뀐 줄이 생기는 것은 index가 CRLF이거나 섞인 파일뿐이다.
  그래도 같이 알리는 것은 작업 트리에 CRLF가 남아 있다는 것이 줄 끝을 바꿔 쓰는 도구를 썼다는 신호이기 때문이다.
- 견주는 값은 `lf`, `crlf`, `mixed`뿐이다. 줄 끝이 없는 파일(`none`)과 바이너리(`-text`)는 견주지 않는다. git 출력은 `-z`로 받아 한글 경로가 따옴표로 바뀌지 않게 했다.
- `git`이 없거나 `.git`이 없는 폴더(압축 파일로 받은 경우)에서는 둘 다 건너뛴다.

## 확인한 것
- 레포와 같은 `.gitattributes`로 임시 저장소를 만들고(CRLF 파일을 속성 없이 먼저 올린 뒤 속성을 넣어 `i/crlf`를 만들었다) 시험했다.
  - 깨끗한 트리는 조용하다. 작업 트리 편집 다섯 가지(`i/crlf w/lf`, `i/crlf w/mixed`, `i/lf w/crlf`, `i/lf w/mixed`, `i/mixed w/crlf`)는 모두 잡고, 건드리지 않은 CRLF 파일은 잡지 않는다.
  - 커밋한 변경은 CRLF를 LF로 바꾼 파일과 섞인 파일을 CRLF로 바꾼 파일을 줄 수와 방향("main CRLF, 지금 LF")과 함께 잡는다. `git add`가 LF로 되돌려 올린 파일과 줄 하나만 붙인 파일은 잡지 않는다. 스테이징만 한 상태와 main 위의 스테이징도 잡는다.
  - 얕게 받은 detached checkout(ref가 하나도 없음)에서는 둘째 점검이 조용히 빠지고 첫째 점검은 돈다. PR 병합 커밋을 흉내 낸 깊은 checkout(`origin/main`이 있음)에서는 둘째 점검이 돈다.
  - `core.autocrlf`를 true, input, false로 둔 새 clone 셋 모두 작업 트리와 index의 줄 끝이 같았다. `eol=lf` 속성이 설정을 이기므로 깨끗한 clone은 팀원 PC에서도 경고를 내지 않는다.
- 이 레포에서 `src/room.js`(CRLF)를 바이트로 LF로, `src/os.js`(LF)를 CRLF로 바꾸자 둘 다 경고가 떴고(`git diff`에는 `room.js`만 906줄로 나왔다), 되돌리자 사라졌다.
- 레포의 옛 커밋 190개에 둘째 점검의 기준을 대 보니 15개 커밋의 32개 파일이 걸렸다. 가장 최근에 걸린 커밋이 HEAD에서 109커밋 전이고, 그보다 새로운 109개 커밋(HEAD 포함)에는 한 건도 없었다. `origin/main`이 뒤처진 clone에서 26개 커밋 구간(#162부터 #166까지 포함)도 조용했다.
- 점검만 도는 데 파이썬 시작을 합쳐 0.8초가 걸린다. `python tools/check.py`는 오류 0개, 경고 2개(원래 있던 가구 그림 경고)이고, 고친 파일은 모두 LF 그대로다(`git diff --stat`과 `--ignore-cr-at-eol --stat`의 줄 수가 같다).

## 남은 일과 알아 둘 것
- PR 점검에서도 줄 끝 경고를 보려면 `.github/workflows/check.yml`의 checkout에 `with: fetch-depth: 0`을 더하면 된다. 다만 경고는 로그에만 찍히므로, 눈에 띄게 하려면 `::warning file=...::` 주석으로도 내야 한다. 이번에는 범위 밖이라 하지 않았다.
- `i/lf w/crlf` 경고는 CRLF로 저장하는 편집기로 새 파일을 만든 PC에서 계속 뜬다. `git add`가 index에는 LF로 올려도 작업 트리는 CRLF로 남기 때문이다(임시 저장소에서 확인). 커밋은 멀쩡하고, 파일을 LF로 바꾸면 사라진다. 시끄러우면 이 경우만 빼는 것을 팀과 정한다.
- `src/config.js`와 `worklog/2026-10-28-soomin007-team-repo-prep.md`는 CRLF와 LF가 섞여 있다. 이 둘을 고칠 때는 바이트로 읽고 쓰고, 이 경고가 뜨는지 본다.
