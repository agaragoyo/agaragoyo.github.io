# 캐시 지문 찍기와 모듈 미리 받기. 배포할 때 GitHub Actions(.github/workflows/pages.yml)가 자동으로 실행한다.
# 손으로 돌려도 되지만, 팀원은 커밋 전에 따로 실행하지 않는다(여러 사람이 찍으면 index.html이 충돌한다).
#
# GitHub Pages는 파일을 10분 동안 브라우저에 캐시하게 한다. 그래서 고친 직후에는 옛 JS와 새 JS가 섞여서
# 예전 화면이 나오거나 깨진다. index.html 에 각 파일 내용의 지문(?v=해시)을 붙인 주소를 적어 두면,
# 바뀐 파일만 주소가 바뀌어 바로 새로 받고, 그대로인 파일은 캐시를 계속 쓴다.
#   - style.css, src/main.js: <link>, <script> 주소에 직접 붙인다
#   - 나머지 모듈(src/, data/ 의 .js): import map 으로 "./src/os.js" → "./src/os.js?v=..." 처럼 바꿔 준다
#
# 브라우저는 main.js를 받아 읽어야 그 안의 import를 알고, 그 모듈을 받아 읽어야 다음 import를 안다.
# 그래서 모듈을 여러 단계에 걸쳐 받고, 느린 연결에서는 단계마다 왕복 시간이 쌓인다.
# main.js에서 정적 import를 따라 닿는 모듈마다 <link rel="modulepreload"> 줄을 index.html의 <template id="modulepreload">에 적어 두면,
# 그 아래 인라인 스크립트가 크롬 계열에서만 꺼내 붙여 HTML을 읽자마자 한꺼번에 받는다(사파리에 붙이지 않는 까닭은 known-issues 43).
#   - 주소는 import map이 바꿔 준 주소(?v= 지문까지)와 같아야 같은 모듈로 친다. 다르면 같은 파일을 두 번 받는다
#   - import('...')처럼 나중에 부르는 모듈은 따라가지 않는다. 필요할 때 받으려고 나눈 것이기 때문이다
# check.py가 PR마다 stamp()를 미리 돌려 보아 채울 자리나 순서가 틀리면 알린다.
import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / 'index.html'
ENTRY = ROOT / 'src' / 'main.js'

IMPORTMAP = re.compile(r'<script type="importmap">.*?</script>', re.S)
# 미리 받을 모듈 줄이 들어갈 자리. 안쪽을 매번 새로 채운다.
PRELOAD = re.compile(r'(<template id="modulepreload">).*?(</template>)', re.S)
# 위 template의 줄을 꺼내 붙이는 인라인 스크립트에 들어 있는 글
PRELOAD_USE = "getElementById('modulepreload')"
# import ... from '...', export ... from '...', import '...' 의 주소
IMPORT = re.compile(r"""^\s*(?:import|export)\s[^'";]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]""", re.M)


class StampError(Exception):
    pass


def digest(path):
    return hashlib.sha1(path.read_bytes()).hexdigest()[:8]


def rel(path):
    return './' + path.relative_to(ROOT).as_posix()


def module_graph(entry=ENTRY):
    """entry에서 정적 import를 따라 닿는 모듈을 너비 우선 순서로 돌려준다(entry가 맨 앞)."""
    order, seen, queue = [], {entry}, [entry]
    while queue:
        p = queue.pop(0)
        order.append(p)
        for m in IMPORT.finditer(p.read_text(encoding='utf-8')):
            spec = m.group(1) or m.group(2)
            if not spec.startswith(('./', '../')):
                continue  # CDN 주소 같은 바깥 모듈은 미리 받지 않는다
            dep = (p.parent / spec).resolve()
            if not dep.is_file():
                raise StampError(f"{rel(p)}의 import '{spec}' 파일이 없다")
            if dep not in seen:
                seen.add(dep)
                queue.append(dep)
    return order


def stamp(html):
    """index.html 글에 지문, import map, modulepreload 줄을 채워 (새 글, 지문 수, 미리 받는 모듈 수)를 돌려준다."""
    head = html.split('</head>')[0]
    imap = IMPORTMAP.search(head)
    if not imap:
        raise StampError('index.html의 <head> 안에 <script type="importmap"> 자리가 없다')
    tpl = PRELOAD.search(head)
    if not tpl:
        raise StampError('index.html의 <head> 안에 <template id="modulepreload"></template> 자리가 없다')
    use = head.find(PRELOAD_USE, tpl.end())
    if use < 0:
        raise StampError(f'index.html의 modulepreload template 뒤에 그 줄을 꺼내 붙이는 스크립트({PRELOAD_USE})가 없다')
    if use < imap.end():
        raise StampError('index.html의 모듈 미리 받기 스크립트는 import map 뒤에 둔다. 앞에 있으면 브라우저가 import map을 무시할 수 있다')
    css = head.find('rel="stylesheet"')
    if 0 <= css < use:
        raise StampError('index.html의 모듈 미리 받기 스크립트는 스타일시트 <link>보다 앞에 둔다. 뒤에 있으면 CSS를 다 받을 때까지 기다린다')

    modules = sorted(p for d in ('src', 'data') for p in (ROOT / d).rglob('*.js'))
    imports = {}
    for p in modules:
        if p == ENTRY:
            continue
        imports[rel(p)] = f'{rel(p)}?v={digest(p)}'
    main_url = f'src/main.js?v={digest(ENTRY)}'
    block = ('<script type="importmap">\n'
             + json.dumps({'imports': imports}, ensure_ascii=False, indent=2)
             + '\n  </script>')
    html = IMPORTMAP.sub(lambda m: block, html, count=1)

    preloads = [main_url if p == ENTRY else imports.get(rel(p), rel(p)) for p in module_graph()]
    lines = ''.join(f'\n    <link rel="modulepreload" href="{url}">' for url in preloads)
    html = PRELOAD.sub(lambda m: m.group(1) + lines + '\n  ' + m.group(2), html, count=1)

    html = re.sub(r'href="style\.css(\?v=[0-9a-f]+)?"', f'href="style.css?v={digest(ROOT / "style.css")}"', html)
    html = re.sub(r'src="src/main\.js(\?v=[0-9a-f]+)?"', f'src="{main_url}"', html)
    return html, len(imports) + 2, len(preloads)


def main():
    try:
        html, stamped, preloaded = stamp(INDEX.read_text(encoding='utf-8'))
    except StampError as e:
        sys.exit(f'stamp.py 오류: {e}')
    INDEX.write_text(html, encoding='utf-8')
    print(f'stamped {stamped} files, modulepreload {preloaded} modules')


if __name__ == '__main__':
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8')
    main()
