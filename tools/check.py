# 레포 자동 점검. PR을 열면 GitHub Actions가 돌리고(.github/workflows/check.yml), 내 컴퓨터에서도 돌릴 수 있다.
#   python tools/check.py
# 파일 지도(docs/file-map.md)와 실제 파일이 어긋나는지도 본다.
# 오류가 하나라도 있으면 실패(종료 코드 1)한다. 경고는 알려만 준다.
# 무엇을 보는지는 아래 check_* 함수 이름과 주석을 보면 된다. 새 규칙이 생기면 함수를 하나 더 만든다.
import math
import pathlib
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import zlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
errors = []
warnings = []

# 레포 전체를 도는 순회가 건너뛰는 맨 위 폴더. .claude/ 에는 Claude Code가 이 PC에 만든 다른 작업 폴더
# (.claude/worktrees/<이름>/, 레포를 통째로 한 벌씩 받은 것)가 있어 레포에 올라가지 않는다. 읽으면 같은 파일을 여러 벌 본다.
# 반드시 ROOT 기준 상대 경로로 거른다. 작업 폴더 안에서 돌릴 때는 ROOT 자체의 경로에 .claude가 들어 있다(known-issues 70).
SKIP_TOP = ('.git', '.claude')


def in_repo(p):
    """ROOT 아래의 레포 파일이면 True. .git과 .claude 아래는 False."""
    return p.relative_to(ROOT).parts[0] not in SKIP_TOP


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
            if in_repo(p):
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
            if 'links' in a:
                urls = re.findall(r"href:\s*'([^']*)'", a['links'])
                labels = re.findall(r"label:\s*'([^']*)'", a['links'])
                if not urls or len(urls) != len(labels):
                    err(where, "links 는 [{ label: '...', href: 'https://...' }, ...] 모양으로 한 줄에 적는다")
                if any(not u.startswith('https://') for u in urls):
                    err(where, 'links 의 href 도 https:// 로 시작하는 바깥 주소다')
                if urls and urls[0] != a['href']:
                    err(where, 'href 에는 links 의 첫 주소를 같이 적는다(아이콘의 새 탭 표시와 툴팁이 href 를 읽는다)')
        elif 'src' not in a:
            err(where, 'src(창에 띄울 주소)나 href(새 탭 주소)가 없다')
        src = a.get('src', '')
        if src.startswith('apps/') and not (ROOT / src).exists():
            err(where, f'{src} 파일이 없다')
        icon = a.get('icon', '')
        if icon and not icon.startswith(('builtin:', 'http', '$')) and not (ROOT / icon).exists():
            err(where, f'아이콘 {icon} 파일이 없다')
        if a.get('folder') not in (None, 'null', 'games', 'furniture'):
            err(where, "folder 는 'games'(게임 폴더), 'furniture'(가구로만 열림) 중 하나다")
        # 게임 폴더의 앱은 묶음(group)을 적어야 폴더와 게임기 화면에 나온다. 묶음 이름은 data/apps.js 의 GAME_GROUPS 에 있다
        groups = re.findall(r"group:\s*'([^']+)'", read('data/apps.js').split('export const GAME_GROUPS = [', 1)[1].split('];', 1)[0])
        if a.get('folder') == 'games' and a.get('group') not in groups:
            err(where, f"folder: 'games' 인 앱은 group 을 {groups} 가운데 하나로 적는다")
        if a.get('group') and a.get('folder') != 'games':
            err(where, "group 은 folder: 'games' 인 앱에만 쓴다")
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


# ---------- 기본 앱의 픽셀 아이콘 ----------

def check_pixel_icons():
    """src/icons.js 의 PIXEL 그림이 칸 수에 맞고 colors 에 있는 글자만 쓰는지,
    data/apps.js 와 src/ 의 'builtin:<이름>' 아이콘이 PIXEL 에 있는지 본다(글자로 그린 그림은 한 칸만 밀려도 모양이 깨진다).
    바탕화면, 미니게임 폴더, 시작 메뉴에 나오는 앱(가구 화면 앱이 아닌 앱)은 48px와 24px 자리에 쓰는 24칸 그림이 있어야 한다."""
    where = 'src/icons.js'
    m = re.search(r'^const PIXEL = \{\n(.*?)^\};', read(where), re.S | re.M)
    if not m:
        err(where, 'PIXEL(픽셀 아이콘 목록)을 찾지 못했다')
        return
    names = {}
    for name, body in re.findall(r'^  (\w+): \{\n(.*?)^  \},', m.group(1), re.S | re.M):
        colors_text = re.search(r'colors: \{(.*?)\},', body, re.S)
        colors = set(re.findall(r"(\w): '#[0-9a-fA-F]{3,8}'", colors_text.group(1))) if colors_text else set()
        grids = re.findall(r'^    (\d+): \[\n(.*?)^    \],', body, re.S | re.M)
        names[name] = {g for g, _ in grids}
        if not names[name] & {'24', '16'}:
            err(where, f'{name}: 24칸이나 16칸 그림이 없다')
        for g, rows_text in grids:
            n = int(g)
            rows = re.findall(r"'([^']*)'", rows_text)
            if len(rows) != n or any(len(r) != n for r in rows):
                bad = [i for i, r in enumerate(rows) if len(r) != n]
                err(where, f'{name}: {n}칸 그림은 {n}줄이고 줄마다 {n}칸이다(지금 {len(rows)}줄, 길이가 다른 줄 {bad[:5]})')
            extra = set(''.join(rows)) - colors - {'.'}
            if extra:
                err(where, f"{name}: {n}칸 그림에 colors 에 없는 글자 {''.join(sorted(extra))} 가 있다")
    if not names:
        err(where, 'PIXEL 에서 아이콘을 하나도 읽지 못했다(모양이 바뀌었으면 tools/check.py 의 check_pixel_icons 도 고친다)')
    for a in entries(read('data/apps.js')):
        icon = a.get('icon', '')
        if icon.startswith('builtin:') and icon[8:] not in names:
            err(f"data/apps.js '{a['id']}'", f"아이콘 {icon} 이 src/icons.js 의 PIXEL 에 없다")
        elif icon.startswith('builtin:') and a.get('folder') != 'furniture' and '24' not in names[icon[8:]]:
            err(f"data/apps.js '{a['id']}'", f'아이콘 {icon} 에 바탕화면과 시작 메뉴에 쓰는 24칸 그림이 없다')
    # 시작 메뉴 아래쪽 항목, 튜토리얼, 이웃집 창처럼 src/ 안에서 바로 쓰는 그림 이름
    for p in sorted(ROOT.glob('src/**/*.js')):
        for icon in re.findall(r"'builtin:(\w+)'", p.read_text(encoding='utf-8')):
            if icon not in names:
                err(p.relative_to(ROOT).as_posix(), f'아이콘 builtin:{icon} 이 src/icons.js 의 PIXEL 에 없다')


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
    # 공유 링크의 가구 번호(src/share.js의 LINK_CODES). 순서를 바꾸면 이미 보낸 링크의 가구가 바뀌므로 끝에만 더한다(known-issues 57)
    block = re.search(r'export const LINK_CODES = \[(.*?)\];', read('src/share.js'), re.S)
    codes = re.findall(r"'([^']+)'", block.group(1)) if block else []
    if not codes:
        err('src/share.js', 'LINK_CODES 를 찾지 못했다')
    for c in sorted({c for c in codes if codes.count(c) > 1}):
        err('src/share.js', f"LINK_CODES 에 '{c}' 가 두 번 있다")
    for f in items:
        if codes and f['id'] not in codes:
            warn(f"data/furniture.js '{f['id']}'", "src/share.js 의 LINK_CODES 에 없다. 공유 링크가 조금 길어지니 LINK_CODES 끝에 더한다(중간에 끼우지 않는다)")


# ---------- 가구 그림이 칸에 맞는지 ----------
# 가구 그림은 data/furniture.js 의 칸(size)과 높이(height)로 만든 상자에 맞춰 줄어 아래 가운데에 붙는다(src/iso.js 의 boxSize,
# style.css 의 .furn img). 사이트와 같은 식으로 그림을 상자에 얹어 재고, 바닥 밖으로 나오거나 칸을 다 채우지 못하거나 벽 가구가 기울어 있으면 경고한다.
# 이미 올라간 그림도 있고 고치는 데 시간이 걸리므로 오류가 아니라 경고다. 그림이 없는 가구와 돌린 그림(-r.png)은 보지 않는다.
FIT_ALPHA = 64              # 알파가 이 값 이상인 점을 칠해진 점으로 본다
FIT_STICK_OUT = 6           # 바닥 변보다 이만큼(px) 넘게 아래로 나오면 경고
FIT_FILL = 0.85             # 가로 칸과 세로 칸의 합이 3 이상인 가구는 칠해진 폭이 상자 폭의 이 비율은 되어야 한다
FIT_FRONT = 10              # 가장 아래 점이 앞 꼭짓점에서 이만큼(px) 넘게 벗어나면 경고
FIT_WALL_DEG = 3            # 벽 가구 그림의 아래 변이 이 각도(도)를 넘게 기울면 경고
FIT_MAX_PIXELS = 4_000_000  # 이보다 큰 그림은 읽지 않는다(파이썬으로 푸는 데 오래 걸린다)


def png_alpha(data):
    """PNG 파일의 바이트에서 점마다 알파(0~255)를 읽어 (가로, 세로, 줄 목록)을 돌려준다. 표준 라이브러리만 쓴다.
    8비트, 비인터레이스, 색 형식 6(RGBA), 2(RGB), 3(팔레트)만 읽는다. 그 밖의 형식이거나 깨졌으면 ValueError."""
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('PNG 파일이 아니다')
    head = trns = None
    idat = []
    pos = 8
    while pos + 8 <= len(data):
        size, kind = struct.unpack('>I4s', data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + size]
        if kind == b'IHDR' and len(body) == 13:
            head = struct.unpack('>IIBBBBB', body)
        elif kind == b'tRNS':
            trns = body
        elif kind == b'IDAT':
            idat.append(body)
        pos += 12 + size
    if head is None or not idat:
        raise ValueError('PNG 파일이 깨졌다')
    w, h, depth, ctype, _, _, interlace = head
    channels = {6: 4, 2: 3, 3: 1}.get(ctype)
    if depth != 8 or interlace or channels is None:
        raise ValueError(f'8비트 RGBA, RGB, 팔레트 PNG만 읽는다(이 파일은 비트 깊이 {depth}, 색 형식 {ctype}, 인터레이스 {interlace})')
    if not 0 < w * h <= FIT_MAX_PIXELS:
        raise ValueError(f'그림 크기({w}×{h})가 비었거나 너무 크다')
    stride = w * channels
    want = h * (stride + 1)
    try:
        raw = zlib.decompressobj().decompress(b''.join(idat), want)  # 한 줄은 필터 종류 1바이트와 점 데이터
    except zlib.error:
        raise ValueError('그림 데이터가 깨졌다') from None
    if len(raw) < want:
        raise ValueError('그림 데이터가 모자란다')

    def plane(k):
        """색 채널 k 하나를 푼 줄 목록. PNG 필터는 채널마다 따로 풀어도 같아서, RGBA에서 알파만 풀면 네 채널을 다 푸는 것보다 네 배 빠르다."""
        rows = []
        prev = bytearray(w)
        for y in range(h):
            p = y * (stride + 1)
            ft = raw[p]  # 줄의 필터 종류
            cur = bytearray(raw[p + 1:p + 1 + stride][k::channels])
            if ft == 1:  # 왼쪽 점과의 차
                for x in range(1, w):
                    cur[x] = (cur[x] + cur[x - 1]) & 255
            elif ft == 2:  # 위 줄과의 차
                for x in range(w):
                    cur[x] = (cur[x] + prev[x]) & 255
            elif ft == 3:  # 왼쪽과 위의 평균과의 차
                for x in range(w):
                    cur[x] = (cur[x] + (((cur[x - 1] if x else 0) + prev[x]) >> 1)) & 255
            elif ft == 4:  # 왼쪽, 위, 왼쪽 위 중 가까운 값과의 차(Paeth)
                for x in range(w):
                    a = cur[x - 1] if x else 0
                    b = prev[x]
                    c = prev[x - 1] if x else 0
                    pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                    cur[x] = (cur[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
            elif ft:
                raise ValueError(f'알 수 없는 필터({ft})가 있다')
            rows.append(cur)
            prev = cur
        return rows

    if ctype == 6:
        return w, h, plane(3)
    if ctype == 3:  # 팔레트: tRNS가 칸마다 알파를 적고, 모자란 칸은 불투명
        table = bytes(trns or b'')[:256].ljust(256, b'\xff')
        return w, h, [bytes(row).translate(table) for row in plane(0)]
    if not trns or len(trns) < 6:  # RGB는 알파가 없어서 모두 칠해진 점. tRNS가 투명한 색 하나를 정했으면 그 색만 비운다
        return w, h, [b'\xff' * w] * h
    key = struct.unpack('>3H', trns[:6])
    return w, h, [bytes(0 if px == key else 255 for px in zip(*row)) for row in zip(plane(0), plane(1), plane(2))]


def painted_bottoms(rows):
    """열마다 가장 아래 칠해진 줄의 번호(칠해진 점이 없는 열은 -1)."""
    painted = bytes(int(a >= FIT_ALPHA) for a in range(256))
    return [bytes(col).rfind(1) for col in zip(*(row.translate(painted) for row in rows))]


def fit_num(v, limit):
    """경고 문장에 적는 숫자. 반올림하면 허용 한도 이하로 보일 때만 소수 한 자리까지 적는다(6.3px이 "6px"로 보이지 않게)."""
    return f'{v:.0f}' if round(v) > limit else f'{v:.1f}'


def fit_floor(f, w, d, iw, ih, low, tw, th):
    """바닥 가구와 책상 위 가구. 어긋난 곳을 말하는 문장의 목록을 돌려준다."""
    height = int(f['height'])
    bw = (w + d) * tw / 2  # 상자 크기. src/iso.js 의 boxSize 와 같다
    bh = (w + d) * th / 2 + height
    s = min(bw / iw, bh / ih)  # 그림이 상자에 맞춰 줄고 아래 가운데에 붙는다(style.css 의 .furn img)
    ox, oy = (bw - iw * s) / 2, bh - ih * s
    front = w * tw / 2  # 바닥 변의 앞 꼭짓점(가장 아래)의 x
    xs = [x for x, y in enumerate(low) if y >= 0]

    def bx(x):  # 그림의 점을 상자 좌표로
        return ox + (x + 0.5) * s

    def by(y):
        return oy + (y + 0.5) * s

    def edge(x):  # 바닥 변이 x에서 지나는 높이. 왼쪽 꼭짓점에서 앞 꼭짓점까지 내려가고 오른쪽 꼭짓점까지 올라간다
        return d * th / 2 + height + x * th / tw if x <= front else bh - (x - front) * th / tw

    out = []
    stick = max(by(low[x]) - edge(bx(x)) for x in xs)
    if stick > FIT_STICK_OUT:
        out.append(f'바닥 변보다 {fit_num(stick, FIT_STICK_OUT)}px 튀어나온다')
    if w + d >= 3:  # 1×1 같은 작은 물건은 칸을 다 채우지 않아도 된다
        fill = (xs[-1] + 1 - xs[0]) * s / bw
        if fill < FIT_FILL:
            out.append(f'칠해진 폭이 칸 폭의 {int(fill * 100)}%뿐이다')
        bottom = by(max(low))
        tip = [bx(x) for x in xs if by(low[x]) >= bottom - 1]  # 가장 아래 점 둘레(1px 이내)의 열들
        gap = sum(tip) / len(tip) - front
        if abs(gap) > FIT_FRONT:
            out.append(f'그림의 가장 아래 점이 칸의 앞 꼭짓점보다 {fit_num(abs(gap), FIT_FRONT)}px {"왼쪽" if gap < 0 else "오른쪽"}에 있다')
    return out


def fit_wall(low):
    """벽 가구. 가로 가운데 80%의 열마다 가장 아래 칠해진 점을 직선으로 맞춰 기울기를 잰다(그림이 상자에 줄어도 각도는 같다)."""
    xs = [x for x, y in enumerate(low) if y >= 0]
    margin = (xs[-1] - xs[0]) * 0.1
    pts = [(x, low[x]) for x in xs if xs[0] + margin <= x <= xs[-1] - margin]
    if len(pts) < 8:
        return []
    mx = sum(x for x, _ in pts) / len(pts)
    my = sum(y for _, y in pts) / len(pts)
    slope = sum((x - mx) * (y - my) for x, y in pts) / sum((x - mx) ** 2 for x, _ in pts)
    deg = math.degrees(math.atan(abs(slope)))
    return [f'아래 변이 {fit_num(deg, FIT_WALL_DEG)}도 기울어 있다'] if deg > FIT_WALL_DEG else []


def check_furniture_fit():
    consts = dict(re.findall(r'export const (TW|TH)\s*=\s*(\d+)', read('src/config.js')))
    iso = read('src/iso.js')
    box = '((w + d) * TW) / 2' in iso and '((w + d) * TH) / 2 + def.height' in iso
    rule = re.search(r'\.furn img\s*\{([^}]*)\}', read('style.css'))
    contain = rule and re.search(r'object-fit:\s*contain', rule.group(1)) and re.search(r'object-position:\s*bottom', rule.group(1))
    if len(consts) != 2 or not box or not contain:
        err('src/iso.js', '가구 상자의 크기를 구하는 식(boxSize)이나 TW, TH, 그림을 상자에 얹는 규칙(style.css 의 .furn img)을 찾지 못했다. '
            '바꿨다면 tools/check.py 의 check_furniture_fit도 같이 고친다')
        return
    tw, th = int(consts['TW']), int(consts['TH'])
    for f in entries(read('data/furniture.js')):
        path = ROOT / 'assets/furniture' / f"{f['id']}.png"
        size = [int(n) for n in re.findall(r'\d+', f.get('size', ''))]
        zone = f.get('zone')
        if not path.is_file():
            continue  # 그림이 없는 가구
        if zone not in ('wall', 'floor', 'top') or len(size) != 2 or min(size) < 1 or (zone != 'wall' and not f.get('height', '').isdigit()):
            continue  # 목록이 틀린 가구(check_furniture 가 오류로 알린다)
        where = path.relative_to(ROOT).as_posix()
        try:
            iw, ih, rows = png_alpha(path.read_bytes())
        except ValueError as e:
            warn(where, f'칸에 맞는지 재지 못했다. {e}. 8비트 RGBA PNG로 내보내 다시 올린다')
            continue
        low = painted_bottoms(rows)
        if max(low) < 0:
            warn(where, '칠해진 곳이 없다. 그림이 통째로 투명하다')
            continue
        if zone == 'wall':
            problems = fit_wall(low)
            fix = '사이트가 벽에 맞춰 기울이므로 정면에서 본 그림으로 다시 그린다'
        else:
            problems = fit_floor(f, size[0], size[1], iw, ih, low, tw, th)
            fix = f'칸({size[0]}×{size[1]})에 맞게 다시 그린다'
        if problems:
            warn(where, '. '.join(problems) + '. ' + fix)


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
    for role, gimmick in (('first', None), ('light', 'night')):
        f = items.get(picked.get(role))
        if not f:
            err(where, f"{role} 의 가구 '{picked.get(role)}' 이 목록에 없다")
        elif f.get('scene') != 'room':
            err(where, f"{role} 의 가구 '{f['id']}' 은 내 방(scene: 'room') 가구여야 한다")
        elif gimmick and f.get('gimmick') != gimmick:
            err(where, f"{role} 의 가구 '{f['id']}' 은 gimmick: '{gimmick}' 이어야 한다")
    for name, path in (('scene-tab', 'src/apps/room-app.js'), ('win-close', 'src/win.js'), ('gate-hit', 'src/iso.js'), ('door-hit', 'src/iso.js')):
        if name not in read(path):
            err('src/tutorial.js', f"화면에서 찾는 이름 '{name}' 이 {path} 에 없다(이름을 바꿨다면 튜토리얼도 고친다)")
    # 놀이터로 나가는 단계는 방의 현관문(src/config.js의 SCENES door)을 가리킨다
    if not re.search(r"id:\s*'room'[^\n]*door:\s*\{", read('src/config.js')):
        err('src/tutorial.js', "내 방(SCENES 의 'room')에 현관문(door)이 없어 놀이터로 나가는 단계에서 막힌다")


# 이웃집 목록 (data/neighbors.js). 공유 링크가 풀리는지, 링크 속 주인 이름이 문패 닉네임과 같은지 본다.
# 링크(base64)는 누구나 풀어 읽을 수 있어서, 다르면 공개 레포에 다른 이름(실명일 수 있다)이 숨어 올라간다. 그래서 오류 문구에도 그 이름을 적지 않는다.
def check_neighbors():
    import base64
    import json
    path = 'data/neighbors.js'
    items = entries(read(path))
    ids = set()
    for n in items:
        where = f"{path} '{n['id']}'"
        if n['id'] in ids:
            err(where, 'id가 겹친다')
        ids.add(n['id'])
        if not KEBAB.match(n['id']):
            err(where, 'id는 영어 소문자, 숫자, 하이픈만 쓴다')
        name = n.get('name', '')
        if not name.strip() or len(name) > 12:
            err(where, 'name(문패 닉네임)은 1~12글자다')
        room = n.get('room', '')
        try:
            raw = base64.urlsafe_b64decode(room + '=' * (-len(room) % 4))
            if raw[:1] == b'\x04':  # 짧은 형식(src/share.js의 encodeShort): [4][이름 바이트 수][이름]...
                if len(raw) < 2 or len(raw) < 2 + raw[1]:
                    raise ValueError('짧다')
                data = {'v': 4, 'o': raw[2:2 + raw[1]].decode('utf-8')}
            else:
                data = json.loads(raw.decode('utf-8'))
        except Exception:
            err(where, 'room 이 풀리지 않는다. 공유 링크에서 #r= 뒤(예전 링크는 #room= 뒤)의 글자 전부를 넣는다')
            continue
        if not isinstance(data, dict) or data.get('v') not in (3, 4) or (data.get('v') == 3 and not isinstance(data.get('s'), dict)):
            err(where, '예전 형식의 링크다. 배포 사이트의 공유하기에서 링크를 다시 복사한다')
        elif data.get('o') != name:
            err(where, '링크 속 주인 이름이 문패 닉네임(name)과 다르다. 그 닉네임으로 사용자를 만든 방의 링크를 받는다')
    if len(items) > 6:
        warn(path, f'이웃집이 {len(items)}집이다. 로그인 화면과 놀이터에는 앞의 여섯 집까지만 나온다(src/neighbors.js의 MAX_NEIGHBORS)')


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


def check_feature_numbers():
    """docs/requirements.md 기능 표의 번호(F1, F2 ...)가 겹치지 않는지 본다.
    같은 날 따로 만든 기능이 같은 번호를 붙인 일이 있었다(known-issues 68)."""
    where = 'docs/requirements.md'
    nums = re.findall(r'^\| F(\d+) \|', read(where), re.M)
    if not nums:
        err(where, '기능 표에서 번호(| F1 |)를 하나도 읽지 못했다(표 모양이 바뀌었으면 tools/check.py 의 check_feature_numbers 도 고친다)')
        return
    seen = set()
    for n in nums:
        if n in seen:
            err(where, f'기능 번호 F{n} 이 두 번 나온다. origin/main 의 기능 표를 보고 비어 있는 다음 번호를 붙인다')
        seen.add(n)


def check_user_pictures():
    """data/user-pictures.js 의 사용자 사진이 24×24칸이고 colors 에 있는 글자만 쓰는지 본다(글자로 그린 그림은 한 칸만 밀려도 모양이 깨진다).
    저장된 사진은 id로 찾으므로 id가 겹치지 않는지도 본다."""
    where = 'data/user-pictures.js'
    blocks = re.findall(r'^  \{\n(.*?)^  \},', read(where), re.S | re.M)
    if not blocks:
        err(where, '사진을 하나도 읽지 못했다(모양이 바뀌었으면 tools/check.py 의 check_user_pictures 도 고친다)')
        return
    ids = set()
    for body in blocks:
        m = re.search(r"^    id: '([^']*)',", body, re.M)
        pid = m.group(1) if m else '?'
        if pid in ids:
            err(where, f'{pid}: id가 겹친다')
        ids.add(pid)
        if not KEBAB.match(pid):
            err(where, f'{pid}: id는 영어 소문자, 숫자, 하이픈만 쓴다')
        if not re.search(r"^    name: '[^']+',", body, re.M):
            err(where, f'{pid}: 이름(name)이 없다. 고르는 줄에서 마우스를 올리면 보이는 이름이다')
        if not re.search(r"^    bg: '#[0-9a-fA-F]{6}',", body, re.M):
            err(where, f"{pid}: 바탕 색(bg)이 '#rrggbb' 모양이 아니다")
        colors_text = re.search(r'^    colors: \{(.*?)\},', body, re.S | re.M)
        colors = set(re.findall(r"(\w): '#[0-9a-fA-F]{3,8}'", colors_text.group(1))) if colors_text else set()
        rows_text = re.search(r'^    rows: \[\n(.*?)^    \],', body, re.S | re.M)
        rows = re.findall(r"'([^']*)'", rows_text.group(1)) if rows_text else []
        if len(rows) != 24 or any(len(r) != 24 for r in rows):
            bad = [i for i, r in enumerate(rows) if len(r) != 24]
            err(where, f'{pid}: 사진은 24줄이고 줄마다 24칸이다(지금 {len(rows)}줄, 길이가 다른 줄 {bad[:5]})')
        extra = set(''.join(rows)) - colors - {'.'}
        if extra:
            err(where, f"{pid}: colors 에 없는 글자 {''.join(sorted(extra))} 가 있다")


def check_wall_patterns():
    """data/wall-patterns.js 의 벽지 그림이 colors 에 있는 글자만 쓰고, 줄 수와 칸 수가 12의 배수인지 본다.
    한 칸이 무대 3px라 12칸이 벽 한 칸(한 줄)이고, 12의 배수가 아니면 무늬가 벽의 칸과 어긋나게 이어진다.
    공유 링크가 목록의 순서 번호를 담으므로 맨 앞이 기본 벽(plain)인지와 id가 겹치지 않는지도 본다."""
    where = 'data/wall-patterns.js'
    text = read(where)
    if not re.search(r"WALL_PATTERNS = \[\n  \{ id: 'plain', name: '[^']+' \},", text):
        err(where, "맨 앞 줄이 기본 벽 { id: 'plain', name: '...' } 이 아니다(링크의 0번이 기본 벽이다)")
    blocks = re.findall(r'^  \{\n(.*?)^  \},', text, re.S | re.M)
    if not blocks:
        err(where, '벽지를 하나도 읽지 못했다(모양이 바뀌었으면 tools/check.py 의 check_wall_patterns 도 고친다)')
        return
    ids = {'plain'}
    for body in blocks:
        m = re.search(r"^    id: '([^']*)',", body, re.M)
        wid = m.group(1) if m else '?'
        if wid in ids:
            err(where, f'{wid}: id가 겹친다')
        ids.add(wid)
        if not KEBAB.match(wid):
            err(where, f'{wid}: id는 영어 소문자, 숫자, 하이픈만 쓴다')
        if not re.search(r"^    name: '[^']+',", body, re.M):
            err(where, f'{wid}: 이름(name)이 없다. 벽지 단추에 마우스를 올리면 보이는 이름이다')
        if not re.search(r"^    bg: '#[0-9a-fA-F]{6}',", body, re.M):
            err(where, f"{wid}: 바탕 색(bg)이 '#rrggbb' 모양이 아니다")
        colors_text = re.search(r'^    colors: \{(.*?)\},', body, re.S | re.M)
        colors = set(re.findall(r"(\w): '#[0-9a-fA-F]{3,8}'", colors_text.group(1))) if colors_text else set()
        rows_text = re.search(r'^    rows: \[\n(.*?)^    \],', body, re.S | re.M)
        rows = re.findall(r"'([^']*)'", rows_text.group(1)) if rows_text else []
        widths = {len(r) for r in rows}
        if not rows or len(widths) != 1 or len(rows) % 12 or min(widths) % 12:
            err(where, f'{wid}: 그림의 줄 수와 줄마다 칸 수는 12의 배수이고 줄마다 같다(지금 {len(rows)}줄, 칸 수 {sorted(widths)})')
        extra = set(''.join(rows)) - colors - {'.'}
        if extra:
            err(where, f"{wid}: colors 에 없는 글자 {''.join(sorted(extra))} 가 있다")


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


# ---------- 작은 글꼴(AgaUI) ----------
# 첫 화면은 사이트가 쓰는 글자만 담은 작은 글꼴로 그린다(known-issues 45). 사이트에 새 글자를 넣었는데 작은 글꼴에 없으면
# 그 글자만 갈무리 전체가 올 때까지 기본 글꼴로 보이므로 경고로 알린다. 미리 받는 주소가 style.css의 주소와 다르면 같은 글꼴을 두 번 받으므로 오류.
def check_ui_font():
    sys.path.insert(0, str(ROOT / 'tools'))
    import ui_font
    for name in [*ui_font.FILES.values(), ui_font.LIST.name, 'OFL.txt']:
        if not (ui_font.OUT / name).exists():
            err(f'assets/fonts/{name}', '작은 글꼴 파일이 없다. python tools/ui_font.py 로 만든다')
            return
    covered, absent = ui_font.read_list()
    missing = sorted(ui_font.site_chars() - covered - absent)
    if missing:
        warn('assets/fonts/aga-ui.woff2', f'작은 글꼴에 없는 사이트 글자 {len(missing)}개({"".join(missing[:40])}). '
             '갈무리 전체가 올 때까지 기본 글꼴로 보인다. pip install fonttools brotli 뒤 python tools/ui_font.py 로 다시 만든다')
    want = {f'assets/fonts/{n}' for n in ui_font.FILES.values()}
    faces = set(re.findall(r'font-family:\s*"AgaUI";[^}]*?url\("([^"]+)"\)', read('style.css')))
    if faces != want:
        err('style.css', f'AgaUI @font-face 주소가 {sorted(want)}와 다르다: {sorted(faces)}')
    preloads = {}
    for tag in re.findall(r'<link\s[^>]*rel="preload"[^>]*>', read('index.html')):
        if 'as="font"' in tag:
            preloads[re.search(r'href="([^"]+)"', tag).group(1)] = tag
    if set(preloads) != faces:
        err('index.html', f'글꼴을 미리 받는 주소({sorted(preloads)})가 style.css의 AgaUI 주소({sorted(faces)})와 달라 같은 글꼴을 두 번 받는다')
    for href, tag in preloads.items():
        if not re.search(r'\scrossorigin[\s>]', tag):
            err('index.html', f'글꼴 미리 받기 줄({href})에 crossorigin이 없으면 미리 받은 파일을 쓰지 못하고 다시 받는다')


# ---------- 비밀 값 ----------
def check_secrets():
    pattern = re.compile(r'(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})')
    # Firebase 웹 설정의 API 키는 원래 웹페이지에 공개하는 값이라 src/cloud.js 한 곳에만 둔다(AGENTS.md "공개 레포").
    # 다른 곳에 있는 구글 API 키는 지도나 Gemini처럼 막아 둬야 하는 키일 수 있다.
    google = re.compile(r'AIza[0-9A-Za-z_-]{35}')
    for p in ROOT.rglob('*'):
        if not in_repo(p) or not p.is_file() or p.suffix not in ('.js', '.html', '.css', '.md', '.json', '.yml', '.py', '.rules'):
            continue
        text = p.read_text(encoding='utf-8', errors='ignore')
        rel = p.relative_to(ROOT).as_posix()
        if pattern.search(text):
            err(rel, '토큰이나 키처럼 보이는 값이 있다. 레포는 공개라 넣으면 안 된다')
        if google.search(text) and rel != 'src/cloud.js':
            err(rel, '구글 API 키처럼 보이는 값이 있다. Firebase 웹 설정의 키는 src/cloud.js에만 둔다')


# ---------- 서버(Firebase) ----------
# 짧은 링크의 방은 Firestore에 둔다(src/cloud.js). 규칙은 레포의 firestore.rules를 Firebase 콘솔에 붙여 게시한 것이라
# 두 곳이 따로 논다(known-issues 59). 기계로 볼 수 있는 것만 본다: 규칙 파일이 있는지, 방 글자 수 한도와 컬렉션 이름이 src/cloud.js와 같은지.
def check_cloud():
    if not (ROOT / 'firestore.rules').exists():
        err('firestore.rules', 'Firestore 규칙 파일이 없다. 콘솔에 게시한 규칙을 이 파일에 둔다')
        return
    rules = read('firestore.rules')
    js = read('src/cloud.js')
    limit_js = re.search(r'export const MAX_CODE = (\d+)', js)
    limit_rules = re.search(r'd\.code\.size\(\) <= (\d+)', rules)
    if not limit_js or not limit_rules:
        err('src/cloud.js', '방 글자 수 한도(MAX_CODE와 firestore.rules의 code.size())를 찾지 못했다. 모양을 바꿨다면 tools/check.py의 check_cloud도 고친다')
    elif limit_js.group(1) != limit_rules.group(1):
        err('src/cloud.js', f'MAX_CODE({limit_js.group(1)})가 firestore.rules의 한도({limit_rules.group(1)})와 다르다. 규칙을 고쳤다면 콘솔에도 게시한다')
    col = re.search(r"const HOMES = '(\w+)'", js)
    if not col or f'match /{col.group(1)}/' not in rules:
        err('firestore.rules', 'src/cloud.js의 컬렉션 이름(HOMES)에 맞는 match 줄이 없다')
    # 코르크 보드 쪽지: NOTE의 닉네임, 글 글자 수와 색 수가 규칙(validNote)과 같고, 한 번에 받는 쪽지 수가 규칙의 읽기 한도 안인지 본다
    notes = re.search(r"const NOTES = '(\w+)'", js)
    if not notes or f'match /{notes.group(1)}/' not in rules:
        err('firestore.rules', 'src/cloud.js의 쪽지 컬렉션 이름(NOTES)에 맞는 match 줄이 없다')
    block = re.search(r'export const NOTE = \{(.*?)\};', js, re.S)
    vals = {k: int(v) for k, v in re.findall(r'(\w+):\s*(\d+)', block.group(1))} if block else {}
    found = {
        'name': re.search(r'd\.name\.size\(\) <= (\d+)', rules),
        'text': re.search(r'd\.text\.size\(\) <= (\d+)', rules),
        'colors': re.search(r'd\.color <= (\d+)', rules),
        'page': re.search(r'request\.query\.limit <= (\d+)', rules),
    }
    if not block or any(k not in vals for k in found) or not all(found.values()):
        err('src/cloud.js', '쪽지 한도(NOTE의 name, text, colors, page와 firestore.rules의 쪽지 규칙)를 찾지 못했다. 모양을 바꿨다면 tools/check.py의 check_cloud도 고친다')
        return
    for k in ('name', 'text'):
        if vals[k] != int(found[k].group(1)):
            err('src/cloud.js', f'NOTE.{k}({vals[k]})가 firestore.rules의 쪽지 한도({found[k].group(1)})와 다르다. 규칙을 고쳤다면 콘솔에도 게시한다')
    if vals['colors'] != int(found['colors'].group(1)) + 1:
        err('src/cloud.js', f"NOTE.colors({vals['colors']})가 firestore.rules의 색 번호 한도(0~{found['colors'].group(1)})와 맞지 않다")
    if vals['page'] + 1 > int(found['page'].group(1)):
        err('src/cloud.js', f"NOTE.page({vals['page']})에 한 장을 더 받으면 firestore.rules의 읽기 한도({found['page'].group(1)}장)를 넘는다")


# ---------- 실험실 ----------
# 실험실 항목(src/labs.js의 LABS)은 팀이 아직 정하지 않은 기능이라, 항목마다 docs/requirements.md의 "아직 정하지 않은 것"에
# 그 id가 든 줄이 있어야 한다(정하면 기본으로 켜거나 지운다). 코드가 묻는 labOn('<id>')은 LABS에 있어야 하고,
# 집 저장 형식과 공유 링크, 서버를 다루는 파일은 실험실 스위치를 쓰지 않는다(한번 나간 링크와 서버의 방은 스위치를 꺼도 되돌릴 수 없다).
LABS_FORBIDDEN = ('src/share.js', 'src/likes.js', 'src/rules.js', 'src/cloud.js', 'firestore.rules')


def check_labs():
    where = 'src/labs.js'
    block = re.search(r'export const LABS = \[(.*?)^\];', read(where), re.S | re.M)
    if not block:
        err(where, 'LABS(실험실 항목 목록)를 찾지 못했다. 모양을 바꿨다면 tools/check.py의 check_labs도 고친다')
        return
    ids = re.findall(r"\{\s*id:\s*'([^']+)'", block.group(1))
    for i in ids:
        if not KEBAB.match(i):
            err(where, f"실험실 항목 '{i}'의 id는 영어 소문자, 숫자, 하이픈만 쓴다")
    if len(ids) != len(set(ids)):
        err(where, '실험실 항목의 id가 겹친다')
    req = read('docs/requirements.md')
    todo = re.search(r'^## 아직 정하지 않은 것\n(.*?)^## ', req, re.S | re.M)
    if not todo:
        err('docs/requirements.md', '"## 아직 정하지 않은 것" 절을 찾지 못했다')
    else:
        for i in ids:
            if f'`{i}`' not in todo.group(1):
                err('docs/requirements.md', f"실험실 항목 `{i}`가 \"아직 정하지 않은 것\"에 없다. 무엇을 정할지 한 줄 적는다(정했으면 기본으로 켜거나 src/labs.js에서 지운다)")
    for path in sorted(ROOT.glob('src/**/*.js')):
        rel = path.relative_to(ROOT).as_posix()
        code = re.sub(r'^\s*//.*$', '', path.read_text(encoding='utf-8'), flags=re.M)  # 주석 속 예시는 뺀다
        for used in re.findall(r"labOn\(\s*'([^']+)'", code):
            if used not in ids:
                err(rel, f"labOn('{used}')의 항목이 src/labs.js의 LABS에 없다")
    for rel in LABS_FORBIDDEN:
        if (ROOT / rel).exists() and re.search(r'\blabOn\b|labs\.js', read(rel)):
            err(rel, '집 저장 형식, 공유 링크, 서버를 다루는 파일은 실험실 스위치(labOn)를 쓰지 않는다. 팀이 정한 뒤에 바로 넣는다')


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
    # 바탕화면 놀이터의 하늘(.desktop[data-kind="outdoor"])도 같은 색이다. 방 상자가 40px 아래에서 시작해 색이 바뀌는 자리를 그만큼 내렸다
    for want in (f'radial-gradient(ellipse at 50% 45%, {a}, {b} 75%)', f'linear-gradient({c}, {d} 60%)', f'linear-gradient({c} 40px, {d} 472px)'):
        if want not in css:
            err('style.css', f'방 바탕(.room과 바탕화면 놀이터의 .desktop)이 src/room-image.js의 BACKDROP과 다르다(찾는 값: {want}). 한쪽을 고쳤다면 다른 쪽도 같이 고친다')


# ---------- 라디오 CD 색 ----------
# CD 색 번호는 likes에 담기고(src/likes.js의 LIMIT.cdColors가 받는 번호의 수), 색 이름은 src/apps/radio-app.js의 CD_COLORS,
# 색 자체는 style.css의 .cd[data-color]에 있다. 셋의 개수가 어긋나면 고른 색이 은색으로 그려지거나 저장할 때 지워진다.
def check_cd_colors():
    limit = re.search(r'cdColors:\s*(\d+)', read('src/likes.js'))
    names = re.search(r'const CD_COLORS = \[([^\]]*)\]', read('src/apps/radio-app.js'))
    if not limit or not names:
        err('src/likes.js', 'CD 색 수(LIMIT.cdColors와 src/apps/radio-app.js의 CD_COLORS)를 찾지 못했다. 모양을 바꿨다면 tools/check.py의 check_cd_colors도 고친다')
        return
    n = int(limit.group(1))
    count = len(re.findall(r"'[^']+'", names.group(1)))
    if count != n:
        err('src/apps/radio-app.js', f'CD_COLORS의 색 이름 {count}개가 LIMIT.cdColors({n})와 다르다')
    have = {int(x) for x in re.findall(r'\.cd\[data-color="(\d+)"\]', read('style.css'))}
    if have != set(range(1, n)):
        err('style.css', f'.cd[data-color] 색이 {sorted(have)}번에 있다. 0번(은색)은 .cd에 두고 1~{n - 1}번은 하나씩 있어야 한다(LIMIT.cdColors {n})')


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
    # data/apps.js 의 music 은 src/sound.js 의 MUSIC 이름이거나 'own'(게임 안 음악), 'room'(내 방 곡)이다
    music = set(re.findall(r"^\s*'?([a-z0-9-]+)'?: \{ file:", read('src/sound.js'), re.M)) | {'own', 'room'}
    for a in entries(read('data/apps.js')):
        if a.get('music') and a['music'] not in music:
            err(f"data/apps.js '{a['id']}'", f"music '{a['music']}' 은 src/sound.js 의 MUSIC 에 없다(게임 안에 음악이 있으면 'own')")


# ---------- 파일 지도 ----------
# docs/file-map.md 가 실제 파일과 어긋나지 않게 한다. 핵심 파일이 지도에 빠졌거나, 지도에 적힌 경로가 없으면 오류.
def check_file_map():
    path = ROOT / 'docs/file-map.md'
    if not path.exists():
        err('docs/file-map.md', '파일 지도가 없다')
        return
    mentioned = set(re.findall(r'`([^`\s<>*]+)`', path.read_text(encoding='utf-8')))
    must = [*ROOT.glob('src/**/*.js'), *ROOT.glob('data/*.js'), *ROOT.glob('tools/*.py'), *ROOT.glob('tools/*.mjs'), *ROOT.glob('docs/*.md'),
            *ROOT.glob('.github/**/*.yml'), *ROOT.glob('.github/*.md')]
    must += [ROOT / n for n in ('index.html', 'style.css', 'README.md', 'AGENTS.md', 'CLAUDE.md', 'known-issues.md', 'firestore.rules')]
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
        for p in sorted([*ROOT.glob('src/**/*.js'), *ROOT.glob('data/*.js'), *ROOT.glob('tools/*.mjs')]):
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
    check_pixel_icons()
    check_furniture(app_ids)
    check_furniture_fit()
    check_tutorial()
    check_neighbors()
    check_avatars()
    check_user_pictures()
    check_wall_patterns()
    check_feature_numbers()
    check_storage_keys()
    check_imports()
    check_stamp()
    check_ui_font()
    check_secrets()
    check_cloud()
    check_room_image()
    check_cd_colors()
    check_labs()
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
