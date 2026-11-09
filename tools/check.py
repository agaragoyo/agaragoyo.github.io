# 레포 자동 점검. PR을 열면 GitHub Actions가 돌리고(.github/workflows/check.yml), 내 컴퓨터에서도 돌릴 수 있다.
#   python tools/check.py
# 파일 지도(docs/file-map.md)와 실제 파일이 어긋나는지도 본다.
# 오류가 하나라도 있으면 실패(종료 코드 1)한다. 경고는 알려만 준다.
# 무엇을 보는지는 아래 check_* 함수 이름과 주석을 보면 된다. 새 규칙이 생기면 함수를 하나 더 만든다.
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
errors = []
warnings = []


def err(where, msg):
    errors.append(f'{where}: {msg}')


def warn(where, msg):
    warnings.append(f'{where}: {msg}')


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def entries(js_text):
    """data/*.js 의 목록에서 { id: '...', ... } 한 줄씩을 {필드: 값} 사전으로 읽는다(문자열, 숫자, true만)."""
    out = []
    for line in js_text.splitlines():
        m = re.match(r"\s*\{\s*id:\s*'([^']+)'(.*)\},?\s*(//.*)?$", line)
        if not m:
            continue
        item = {'id': m.group(1), '_line': line.strip()}
        for k, v in re.findall(r"(\w+):\s*('[^']*'|`[^`]*`|\[[^\]]*\]|[\w.]+)", m.group(2)):
            item[k] = v.strip("'`")
        out.append(item)
    return out


KEBAB = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')


# ---------- 빌드 도구를 들이지 않는다 ----------
def check_no_build_tools():
    for name in ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'node_modules',
                 'vite.config.js', 'webpack.config.js', 'tsconfig.json']:
        for p in ROOT.rglob(name):
            if '.git' not in p.parts:
                err(p.relative_to(ROOT).as_posix(), '빌드 도구나 npm 파일은 쓰지 않는다(AGENTS.md "지켜야 할 것")')


# ---------- 공간, 앱, 가구 목록 ----------
def scenes():
    return re.findall(r"\{\s*id:\s*'([^']+)',\s*name:", read('src/config.js'))


def check_apps():
    apps = entries(read('data/apps.js'))
    known_scenes = scenes()
    seen = set()
    for a in apps:
        where = f"data/apps.js '{a['id']}'"
        if a['id'] in seen:
            err(where, 'id가 겹친다')
        seen.add(a['id'])
        if not KEBAB.match(a['id']):
            err(where, 'id는 영어 소문자, 숫자, 하이픈만 쓴다')
        if 'scene' in a:
            if 'builtin' in a or 'src' in a:
                err(where, 'scene(공간 바로 가기)은 builtin, src 와 같이 쓰지 않는다')
            if a['scene'] not in known_scenes:
                err(where, f"scene '{a['scene']}' 은 src/config.js 의 SCENES 에 없다")
        elif 'builtin' in a:
            if not (ROOT / f"src/apps/{a['builtin']}-app.js").exists():
                err(where, f"기본 앱 파일 src/apps/{a['builtin']}-app.js 가 없다")
        elif 'href' in a:
            if 'src' in a:
                err(where, 'href(새 탭으로 여는 주소)는 src 와 같이 쓰지 않는다')
            if not a['href'].startswith('https://'):
                err(where, 'href 는 https:// 로 시작하는 바깥 주소다')
        elif 'src' not in a:
            err(where, 'src(창에 띄울 주소)나 href(새 탭 주소)가 없다')
        src = a.get('src', '')
        if src.startswith('apps/') and not (ROOT / src).exists():
            err(where, f'{src} 파일이 없다')
        icon = a.get('icon', '')
        if icon and not icon.startswith(('builtin:', 'http', '$')) and not (ROOT / icon).exists():
            err(where, f'아이콘 {icon} 파일이 없다')
        if a.get('folder') not in (None, 'null', 'games', 'furniture'):
            err(where, "folder 는 'games'(미니게임 폴더), 'furniture'(가구로만 열림) 중 하나다")
    # apps/ 아래 폴더는 목록에 올라가 있어야 한다(_로 시작하는 폴더는 틀이라 뺀다)
    listed = {a.get('src', '').split('/')[1] for a in apps if a.get('src', '').startswith('apps/')}
    for d in sorted(p for p in (ROOT / 'apps').iterdir() if p.is_dir()):
        if d.name.startswith('_'):
            continue
        if not (d / 'index.html').exists():
            err(f'apps/{d.name}', 'index.html 이 없다')
        if d.name not in listed:
            warn(f'apps/{d.name}', 'data/apps.js 목록에 없어서 화면에 나오지 않는다')
    return {a['id'] for a in apps}


def check_furniture(app_ids):
    items = entries(read('data/furniture.js'))
    known_scenes = scenes()
    ids = set()
    for f in items:
        where = f"data/furniture.js '{f['id']}'"
        if f['id'] in ids:
            err(where, 'id가 겹친다')
        ids.add(f['id'])
        if not KEBAB.match(f['id']):
            err(where, 'id는 영어 소문자, 숫자, 하이픈만 쓴다')
        if f.get('scene') not in known_scenes:
            err(where, f"scene '{f.get('scene')}' 은 src/config.js 의 SCENES 에 없다")
        if f.get('zone') not in ('wall', 'floor', 'top'):
            err(where, "zone 은 'wall', 'floor', 'top' 중 하나다")
        if f.get('zone') != 'wall' and 'height' not in f:
            err(where, '바닥 가구는 height 가 있어야 한다')
        g = f.get('gimmick')
        if g:
            if g.startswith('app:') and g[4:] not in app_ids:
                err(where, f"gimmick 의 앱 '{g[4:]}' 이 data/apps.js 에 없다")
            elif g.startswith('scene:') and g[6:] not in known_scenes:
                err(where, f"gimmick 의 공간 '{g[6:]}' 이 SCENES 에 없다")
            elif g != 'night' and not g.startswith(('app:', 'scene:')):
                err(where, "gimmick 은 'night', 'app:<앱 id>', 'scene:<공간 id>' 중 하나다")
    # 가구 그림 파일 이름이 가구 id와 맞는지 (웹에서 올릴 때 이름을 틀리기 쉽다)
    for p in sorted((ROOT / 'assets/furniture').glob('*')):
        if p.name.startswith('.'):
            continue
        m = re.match(r'^(.+?)(-r)?\.png$', p.name)
        if not m:
            err(p.relative_to(ROOT).as_posix(), '가구 그림은 <가구 id>.png 또는 <가구 id>-r.png 로 올린다')
        elif m.group(1) not in ids:
            err(p.relative_to(ROOT).as_posix(), f"'{m.group(1)}' 라는 가구가 data/furniture.js 에 없다(이름 확인)")


# 튜토리얼 (src/tutorial.js). 쓰는 단계의 기믹이 없으면 그 단계에서 막히고, 화면에서 찾는 이름이 바뀌면 화살표가 조용히 사라진다.
def check_tutorial():
    where = 'data/furniture.js TUTORIAL_FURNITURE'
    text = read('data/furniture.js')
    m = re.search(r'TUTORIAL_FURNITURE\s*=\s*\{(.*?)\}', text)
    if not m:
        err(where, '튜토리얼 가구 목록이 없다')
        return
    picked = dict(re.findall(r"(\w+):\s*'([^']+)'", m.group(1)))
    items = {f['id']: f for f in entries(text)}
    for role, gimmick in (('first', None), ('light', 'night'), ('door', 'scene:playground')):
        f = items.get(picked.get(role))
        if not f:
            err(where, f"{role} 의 가구 '{picked.get(role)}' 이 목록에 없다")
        elif f.get('scene') != 'room':
            err(where, f"{role} 의 가구 '{f['id']}' 은 내 방(scene: 'room') 가구여야 한다")
        elif gimmick and f.get('gimmick') != gimmick:
            err(where, f"{role} 의 가구 '{f['id']}' 은 gimmick: '{gimmick}' 이어야 한다")
    for name, path in (('scene-tab', 'src/apps/room-app.js'), ('win-close', 'src/win.js'), ('gate-hit', 'src/iso.js')):
        if name not in read(path):
            err('src/tutorial.js', f"화면에서 찾는 이름 '{name}' 이 {path} 에 없다(이름을 바꿨다면 튜토리얼도 고친다)")


# 아바타 목록의 id와 그림 경로 (그림 규격은 data/avatars.js 맨 위)
def check_avatars():
    ids = set()
    for a in entries(read('data/avatars.js')):
        where = f"data/avatars.js '{a['id']}'"
        if a['id'] in ids:
            err(where, 'id가 겹친다')
        ids.add(a['id'])
        if not KEBAB.match(a['id']):
            err(where, 'id는 영어 소문자, 숫자, 하이픈만 쓴다')
        sheet = a.get('sheet')
        if sheet and not (ROOT / sheet).is_file():
            err(where, f"그림 '{sheet}' 이 레포에 없다")


# ---------- 저장소 키 ----------
def check_storage_keys():
    for p in sorted(ROOT.glob('apps/*/**/*')):
        if p.suffix not in ('.html', '.js') or p.name.startswith('_') or p.parts[-2].startswith('_'):
            continue
        app = p.relative_to(ROOT).parts[1]
        if app.startswith('_'):
            continue
        text = p.read_text(encoding='utf-8')
        where = p.relative_to(ROOT).as_posix()
        if 'localStorage.clear(' in text:
            err(where, 'localStorage.clear() 는 다른 앱 기록까지 지운다. 내 키만 지운다')
        keys = re.findall(r"localStorage\.(?:get|set|remove)Item\(\s*['\"]([^'\"]+)", text)
        keys += re.findall(r"\b\w*KEY\w*\s*=\s*['\"]([^'\"]+)['\"]", text)
        for k in keys:
            if not k.startswith(app + '.'):
                err(where, f"저장 키 '{k}' 는 '{app}.' 으로 시작해야 한다(앱끼리 기록이 섞이지 않게)")
    for p in sorted(ROOT.glob('src/**/*.js')):
        if 'localStorage.clear(' in p.read_text(encoding='utf-8'):
            err(p.relative_to(ROOT).as_posix(), 'localStorage.clear() 는 쓰지 않는다')


# ---------- 모듈 경로 ----------
def check_imports():
    for p in sorted([*ROOT.glob('src/**/*.js'), *ROOT.glob('data/*.js')]):
        for spec in re.findall(r"^\s*import\s[^'\"]*['\"](\.[^'\"]+)['\"]", p.read_text(encoding='utf-8'), re.M):
            if not (p.parent / spec).resolve().exists():
                err(p.relative_to(ROOT).as_posix(), f"import '{spec}' 파일이 없다")


# ---------- 배포할 때 채울 자리 ----------
def check_stamp():
    """배포할 때 tools/stamp.py가 index.html에 import map, modulepreload 줄, 지문을 채울 수 있는지 미리 돌려 본다(known-issues 15)."""
    sys.path.insert(0, str(ROOT / 'tools'))
    import stamp
    try:
        stamp.stamp(read('index.html'))
    except stamp.StampError as e:
        err('tools/stamp.py', f'배포할 때 index.html을 채우지 못한다: {e}')


# ---------- 비밀 값 ----------
def check_secrets():
    pattern = re.compile(r'(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})')
    for p in ROOT.rglob('*'):
        if '.git' in p.parts or not p.is_file() or p.suffix not in ('.js', '.html', '.css', '.md', '.json', '.yml', '.py'):
            continue
        if pattern.search(p.read_text(encoding='utf-8', errors='ignore')):
            err(p.relative_to(ROOT).as_posix(), '토큰이나 키처럼 보이는 값이 있다. 레포는 공개라 넣으면 안 된다')


# ---------- 방 그림(PNG) 바탕 색 ----------
# 공유하기의 PNG(src/room-image.js)는 .room의 바탕 그라디언트를 캔버스에 따로 그린다. CSS 그라디언트는 JS로 값을 읽어 올 수 없어서
# 두 곳에 같은 값을 적어 두므로, style.css의 배경이 BACKDROP과 다르면 오류로 알린다(known-issues 33).
def check_room_image():
    js = read('src/room-image.js')
    css = read('style.css').lower()
    m = re.search(r"indoor:\s*\['(#\w+)',\s*'(#\w+)'\],\s*outdoor:\s*\['(#\w+)',\s*'(#\w+)'\]", js)
    if not m:
        err('src/room-image.js', 'BACKDROP(indoor, outdoor 색)을 찾지 못했다. 이 모양을 바꿨다면 tools/check.py의 check_room_image도 고친다')
        return
    a, b, c, d = (x.lower() for x in m.groups())
    for want in (f'radial-gradient(ellipse at 50% 45%, {a}, {b} 75%)', f'linear-gradient({c}, {d} 60%)'):
        if want not in css:
            err('style.css', f'.room의 바탕이 src/room-image.js의 BACKDROP과 다르다(찾는 값: {want}). 한쪽을 고쳤다면 다른 쪽도 같이 고친다')


# ---------- 소리 ----------
# src/sound.js 가 부르는 파일이 assets/sounds/ 에 있는지, 넣어 둔 mp3를 아무도 안 부르지 않는지 본다(이름을 바꾸면 소리가 조용히 안 난다).
def check_sounds():
    named = set(re.findall(r"'([a-z0-9-]+\.mp3)'", read('src/sound.js')))
    files = {p.name for p in (ROOT / 'assets/sounds').glob('*')} if (ROOT / 'assets/sounds').is_dir() else set()
    for n in sorted(named - files):
        err('src/sound.js', f"소리 파일 '{n}' 이 assets/sounds/ 에 없다")
    for n in sorted(files - named):
        warn('assets/sounds/', f"'{n}' 을 부르는 곳이 src/sound.js 에 없다(지울 파일이면 지운다)")
    for n in sorted(files):
        if not n.endswith('.mp3'):
            err('assets/sounds/', f"'{n}' 은 mp3가 아니다. 소리는 mp3로 줄여 넣는다(docs/checklists.md)")


# ---------- 파일 지도 ----------
# docs/file-map.md 가 실제 파일과 어긋나지 않게 한다. 핵심 파일이 지도에 빠졌거나, 지도에 적힌 경로가 없으면 오류.
def check_file_map():
    path = ROOT / 'docs/file-map.md'
    if not path.exists():
        err('docs/file-map.md', '파일 지도가 없다')
        return
    mentioned = set(re.findall(r'`([^`\s<>*]+)`', path.read_text(encoding='utf-8')))
    must = [*ROOT.glob('src/**/*.js'), *ROOT.glob('data/*.js'), *ROOT.glob('tools/*.py'), *ROOT.glob('docs/*.md'),
            *ROOT.glob('.github/**/*.yml'), *ROOT.glob('.github/*.md')]
    must += [ROOT / n for n in ('index.html', 'style.css', 'README.md', 'AGENTS.md', 'CLAUDE.md', 'known-issues.md')]
    for p in sorted(set(must)):
        rel = p.relative_to(ROOT).as_posix()
        if rel not in mentioned:
            err('docs/file-map.md', f'{rel} 이 지도에 없다. 무엇을 하는 파일인지 한 줄 적는다')
    for d in sorted(x for x in (ROOT / 'apps').iterdir() if x.is_dir()):
        if f'apps/{d.name}/' not in mentioned:
            warn('docs/file-map.md', f'apps/{d.name}/ 이 지도에 없다')
    for m in sorted(mentioned):
        if '/' in m and not m.startswith('http') and not (ROOT / m.rstrip('/')).exists():
            err('docs/file-map.md', f'{m} 은 레포에 없다(옮겼거나 지웠다면 지도를 고친다)')


# ---------- 자바스크립트 문법 (node 가 있을 때만) ----------
def check_js_syntax():
    node = shutil.which('node')
    if not node:
        warn('js', 'node 가 없어 문법 검사를 건너뛴다(PR 검사에서는 돈다)')
        return
    with tempfile.TemporaryDirectory() as tmp:
        jobs = []
        for p in sorted([*ROOT.glob('src/**/*.js'), *ROOT.glob('data/*.js')]):
            jobs.append((p, '.mjs', p.read_text(encoding='utf-8')))
        for p in sorted(ROOT.glob('apps/**/*')):
            if p.suffix == '.js':
                jobs.append((p, '.js', p.read_text(encoding='utf-8')))
            elif p.suffix == '.html':
                for i, (attrs, body) in enumerate(re.findall(r'<script(\s[^>]*)?>(.*?)</script>', p.read_text(encoding='utf-8'), re.S)):
                    if 'src=' in (attrs or '') or not body.strip():
                        continue
                    jobs.append((p, '.mjs' if 'module' in (attrs or '') else '.js', body))
        for n, (p, ext, code) in enumerate(jobs):
            f = pathlib.Path(tmp) / f'c{n}{ext}'
            f.write_text(code, encoding='utf-8')
            r = subprocess.run([node, '--check', str(f)], capture_output=True, encoding='utf-8', errors='replace')
            if r.returncode:
                detail = (r.stderr.strip().splitlines() or [''])
                err(p.relative_to(ROOT).as_posix(), '자바스크립트 문법 오류: ' + next((l for l in detail if 'Error' in l), detail[0]))


def main():
    check_no_build_tools()
    app_ids = check_apps()
    check_furniture(app_ids)
    check_tutorial()
    check_avatars()
    check_storage_keys()
    check_imports()
    check_stamp()
    check_secrets()
    check_room_image()
    check_sounds()
    check_file_map()
    check_js_syntax()
    for w in warnings:
        print('경고 ' + w)
    for e in errors:
        print('오류 ' + e)
    print(f'점검 끝: 오류 {len(errors)}개, 경고 {len(warnings)}개')
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    main()
