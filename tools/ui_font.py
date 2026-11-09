# 사이트가 스스로 쓰는 글자만 담은 작은 글꼴(AgaUI)을 만든다(known-issues 42, 45).
# 첫 화면이 갈무리 전체(보통 505KB, 굵게 167KB)를 기다리지 않도록, 가림막은 이 작은 글꼴만 기다린다.
# 사이트 글자에 없는 글자(사용자가 치는 닉네임과 말풍선)는 style.css에서 그다음에 적힌 갈무리 전체가 그린다.
#
# 다시 만드는 때: 사이트에 새 글자를 넣어 tools/check.py가 "작은 글꼴에 없는 글자" 경고를 낼 때.
# 다시 만들지 않아도 깨지지는 않는다. 그 글자만 갈무리 전체가 올 때까지 기본 글꼴로 보인다.
#   pip install fonttools brotli   (글꼴을 만들 때만 필요하다. 사이트와 GitHub Actions에는 필요 없다)
#   python tools/ui_font.py
#
# 원본은 style.css의 @font-face가 부르는 jsdelivr의 갈무리11 보통과 굵게다. 갈무리 버전을 바꾸면 style.css의 주소만 고치고 이 도구를 다시 돌린다.
# 갈무리는 SIL OFL 1.1이고 galmuri.css 머리말에 "Galmuri"가 예약된 이름으로 적혀 있다. 글자를 덜어 낸 글꼴은 원본을 고친 판이라
# 이 이름을 글꼴 이름으로 쓸 수 없다. 그래서 글꼴 안의 이름을 AgaUI로 바꾸고, 원래 저작권과 라이선스 문구는 그대로 둔다.
# 이 파일의 글자 모으기(site_chars)는 tools/check.py도 쓰므로, fontTools는 build() 안에서만 불러온다.
import html
import pathlib
import re
import sys
import tempfile
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'fonts'
FILES = {400: 'aga-ui.woff2', 700: 'aga-ui-bold.woff2'}
LIST = OUT / 'aga-ui.txt'
FAMILY = 'AgaUI'
# style.css의 갈무리 전체 주소. 이 주소의 버전을 원본으로 쓴다
GALMURI = re.compile(r'url\("(https://cdn\.jsdelivr\.net/npm/galmuri@([\d.]+)/dist/Galmuri11(-Bold)?\.woff2)"\)')
# 사이트 글자 말고도 늘 넣는 글자: 키보드로 치는 ASCII 전부, 한글을 입력하는 동안 잠깐 보이는 자모(ㄱ~ㅣ)
ALWAYS = {chr(c) for c in range(0x20, 0x7f)} | {chr(c) for c in range(0x3131, 0x3164)}


# ---------- 사이트가 쓰는 글자 모으기 ----------
def html_chars(text):
    """index.html에서 주석, 스크립트, 스타일을 뺀 나머지 글자(태그 속 글자도 넣는다. 대부분 ASCII라 늘지 않는다)."""
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    text = re.sub(r'<(script|style)\b.*?</\1>', '', text, flags=re.S)
    return set(html.unescape(text))


def css_chars(text):
    """style.css의 content: 속 글(예: "아가라고요에 로그인")."""
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    out = set()
    for value in re.findall(r'\bcontent\s*:\s*([^;}]*)', text):
        for a, b in re.findall(r'"([^"]*)"|\'([^\']*)\'', value):
            out |= set(a or b)
    return out


REGEX_AFTER = {'return', 'typeof', 'case', 'in', 'of', 'do', 'else', 'instanceof', 'new', 'delete', 'void', 'throw', 'yield', 'await'}


def js_strings(src):
    """자바스크립트에서 문자열과 템플릿 글자만 모은다. 주석과 정규식 속 글자는 화면에 나오지 않으므로 건너뛴다."""
    out = []
    n = len(src)

    def escape(i, buf):  # i는 역슬래시 자리
        nxt = src[i + 1:i + 2]
        if nxt == 'u':
            if src[i + 2:i + 3] == '{':
                j = src.find('}', i + 3)
                hexs, i = src[i + 3:j], j + 1
            else:
                hexs, i = src[i + 2:i + 6], i + 6
            try:
                buf.append(chr(int(hexs, 16)))
            except ValueError:
                pass
            return i
        if nxt == 'x':
            try:
                buf.append(chr(int(src[i + 2:i + 4], 16)))
            except ValueError:
                pass
            return i + 4
        if nxt in '\'"`\\':
            buf.append(nxt)
        return i + 2

    def string(i, quote):  # i는 여는 따옴표 다음
        buf = []
        while i < n:
            c = src[i]
            if c == '\\':
                i = escape(i, buf)
            elif c == quote:
                out.append(''.join(buf))
                return i + 1
            elif quote == '`' and src.startswith('${', i):
                out.append(''.join(buf))
                buf = []
                i = code(i + 2, True)
            elif c == '\n' and quote != '`':
                break
            else:
                buf.append(c)
                i += 1
        out.append(''.join(buf))
        return i

    def regex(i):  # i는 여는 / 다음
        in_class = False
        while i < n and src[i] != '\n':
            c = src[i]
            if c == '\\':
                i += 2
                continue
            if in_class:
                in_class = c != ']'
            elif c == '[':
                in_class = True
            elif c == '/':
                i += 1
                while i < n and (src[i].isalnum() or src[i] == '_'):
                    i += 1
                return i
            i += 1
        return i

    def code(i, in_template):
        depth, prev = 0, ''
        while i < n:
            c = src[i]
            if c.isspace():
                i += 1
            elif src.startswith('//', i):
                j = src.find('\n', i)
                i = n if j < 0 else j
            elif src.startswith('/*', i):
                j = src.find('*/', i + 2)
                i = n if j < 0 else j + 2
            elif c in '\'"`':
                i, prev = string(i + 1, c), 'str'
            elif c == '/':
                # 앞이 값(이름, 숫자, 닫는 괄호)이면 나눗셈, 아니면 정규식
                if prev == '' or prev in REGEX_AFTER or (len(prev) == 1 and prev in '(,=:[!&|?{};+-*%<>~^'):
                    i, prev = regex(i + 1), 'regex'
                else:
                    i, prev = i + 1, '/'
            elif c.isalnum() or c in '_$':
                j = i
                while j < n and (src[j].isalnum() or src[j] in '_$'):
                    j += 1
                i, prev = j, src[i:j]
            else:
                if c == '{':
                    depth += 1
                elif c == '}':
                    if in_template and depth == 0:
                        return i + 1
                    depth -= 1
                i, prev = i + 1, c
        return i

    code(0, False)
    return out


def site_chars(root=ROOT):
    """사이트가 스스로 화면에 쓰는 글자: index.html 글, style.css의 content, src와 data의 자바스크립트 문자열, 늘 넣는 글자."""
    chars = set(ALWAYS)
    chars |= html_chars((root / 'index.html').read_text(encoding='utf-8'))
    chars |= css_chars((root / 'style.css').read_text(encoding='utf-8'))
    for p in sorted([*root.glob('src/**/*.js'), *root.glob('data/*.js')]):
        for s in js_strings(p.read_text(encoding='utf-8')):
            chars |= set(s)
    return {c for c in chars if c.isprintable() or c == ' '}


def read_list(path=LIST):
    """aga-ui.txt를 (작은 글꼴에 든 글자, 갈무리에도 없어 넣지 못한 글자)로 읽는다."""
    lines = path.read_text(encoding='utf-8').split('\n')
    field = lambda key: next((l[len(key):] for l in lines if l.startswith(key)), '')
    return set(field('글자: ')), set(field('갈무리에 없음: '))


# ---------- 글꼴 만들기 ----------
def galmuri_sources(root=ROOT):
    """style.css가 부르는 갈무리11 보통, 굵게 주소와 버전."""
    found = {('700' if bold else '400'): (url, ver) for url, ver, bold in GALMURI.findall((root / 'style.css').read_text(encoding='utf-8'))}
    if set(found) != {'400', '700'} or len({v for _, v in found.values()}) != 1:
        sys.exit('style.css에서 갈무리11 보통과 굵게의 jsdelivr 주소(같은 버전)를 찾지 못했다')
    return {int(w): url for w, (url, _) in found.items()}, found['400'][1]


def download(url, dest):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'agarago-ui-font'})) as r:
        dest.write_bytes(r.read())


def rename(font, style, version):
    """글꼴 안의 이름을 AgaUI로 바꾼다. 저작권(0번)과 라이선스(13, 14번)는 그대로 둔다."""
    name = font['name']
    name.names = [r for r in name.names if r.nameID not in (1, 2, 3, 4, 6, 10, 16, 17, 18, 21, 22, 25)]
    ps = f'{FAMILY}-{style}'
    values = {
        1: FAMILY, 2: style, 3: f'{ps};{version}', 4: f'{FAMILY} {style}', 6: ps,
        10: f'Subset of Galmuri11 {version} by Lee Minseo (SIL OFL 1.1), keeping only the characters used by the Agarago site.',
    }
    for (pid, eid, lid) in ((3, 1, 0x409), (1, 0, 0)):
        for nid, value in values.items():
            name.setName(value, nid, pid, eid, lid)
    if style == 'Bold':
        font['head'].macStyle |= 1  # 원본 굵게는 OS/2에만 굵다고 적혀 있어 head에도 맞춰 적는다


def build():
    try:
        from fontTools import subset
        from fontTools.ttLib import TTFont
    except ImportError:
        sys.exit('fontTools가 없다. pip install fonttools brotli 로 받은 뒤 다시 돌린다')
    urls, version = galmuri_sources()
    wanted = site_chars()
    OUT.mkdir(parents=True, exist_ok=True)
    report = []
    with tempfile.TemporaryDirectory() as tmp:
        for weight, url in sorted(urls.items()):
            src = pathlib.Path(tmp) / url.rsplit('/', 1)[1]
            download(url, src)
            font = TTFont(src)
            have = set(font.getBestCmap())
            if weight == 400:
                covered = {c for c in wanted if ord(c) in have}
                absent = wanted - covered
            opts = subset.Options()
            opts.layout_features = ['*']
            opts.name_IDs = ['*']
            opts.name_languages = ['*']
            opts.name_legacy = True
            opts.notdef_outline = True
            sub = subset.Subsetter(options=opts)
            sub.populate(unicodes=sorted(ord(c) for c in wanted))
            sub.subset(font)
            rename(font, 'Bold' if weight == 700 else 'Regular', version)
            font.flavor = 'woff2'
            dest = OUT / FILES[weight]
            font.save(dest)
            report.append(f'{dest.relative_to(ROOT).as_posix()}: 글자 {len(font.getBestCmap())}개, {dest.stat().st_size / 1024:.1f}KB')
        download(urls[400].rsplit('/', 1)[0] + '/LICENSE.txt', OUT / 'OFL.txt')
    LIST.write_text(
        f'# tools/ui_font.py가 만든다. 손으로 고치지 않는다. 원본: 갈무리11 {version}. check.py가 사이트 글자와 비교한다.\n'
        f'글자: {"".join(sorted(covered))}\n'
        f'갈무리에 없음: {"".join(sorted(absent))}\n', encoding='utf-8')
    print('\n'.join(report))
    print(f'사이트 글자 {len(wanted)}개 가운데 {len(covered)}개를 넣었다.' + (f' 갈무리에도 없는 글자: {"".join(sorted(absent))}' if absent else ''))


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    build()
