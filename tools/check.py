# 레포 자동 점검. PR을 열면 GitHub Actions가 돌리고(.github/workflows/check.yml), 내 컴퓨터에서도 돌릴 수 있다.
#   python tools/check.py
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
    seen = set()
    for a in apps:
        where = f"data/apps.js '{a['id']}'"
        if a['id'] in seen:
            err(where, 'id가 겹친다')
        seen.add(a['id'])
        if not KEBAB.match(a['id']):
            err(where, 'id는 영어 소문자, 숫자, 하이픈만 쓴다')
        if 'builtin' in a:
            if not (ROOT / f"src/apps/{a['builtin']}-app.js").exists():
                err(where, f"기본 앱 파일 src/apps/{a['builtin']}-app.js 가 없다")
        elif 'src' not in a:
            err(where, 'src(앱 페이지 주소)가 없다')
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


# ---------- 비밀 값 ----------
def check_secrets():
    pattern = re.compile(r'(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})')
    for p in ROOT.rglob('*'):
        if '.git' in p.parts or not p.is_file() or p.suffix not in ('.js', '.html', '.css', '.md', '.json', '.yml', '.py'):
            continue
        if pattern.search(p.read_text(encoding='utf-8', errors='ignore')):
            err(p.relative_to(ROOT).as_posix(), '토큰이나 키처럼 보이는 값이 있다. 레포는 공개라 넣으면 안 된다')


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
            r = subprocess.run([node, '--check', str(f)], capture_output=True, text=True)
            if r.returncode:
                detail = (r.stderr.strip().splitlines() or [''])
                err(p.relative_to(ROOT).as_posix(), '자바스크립트 문법 오류: ' + next((l for l in detail if 'Error' in l), detail[0]))


def main():
    check_no_build_tools()
    app_ids = check_apps()
    check_furniture(app_ids)
    check_storage_keys()
    check_imports()
    check_secrets()
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
