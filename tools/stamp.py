# 캐시 지문 찍기. 배포할 때 GitHub Actions(.github/workflows/pages.yml)가 자동으로 실행한다.
# 손으로 돌려도 되지만, 팀원은 커밋 전에 따로 실행하지 않는다(여러 사람이 찍으면 index.html이 충돌한다).
#
# GitHub Pages는 파일을 10분 동안 브라우저에 캐시하게 한다. 그래서 고친 직후에는 옛 JS와 새 JS가 섞여서
# 예전 화면이 나오거나 깨진다. index.html 에 각 파일 내용의 지문(?v=해시)을 붙인 주소를 적어 두면,
# 바뀐 파일만 주소가 바뀌어 바로 새로 받고, 그대로인 파일은 캐시를 계속 쓴다.
#   - style.css, src/main.js: <link>, <script> 주소에 직접 붙인다
#   - 나머지 모듈(src/, data/ 의 .js): import map 으로 "./src/os.js" → "./src/os.js?v=..." 처럼 바꿔 준다
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / 'index.html'


def digest(path):
    return hashlib.sha1(path.read_bytes()).hexdigest()[:8]


def main():
    html = INDEX.read_text(encoding='utf-8')
    modules = sorted(p for d in ('src', 'data') for p in (ROOT / d).rglob('*.js'))
    imports = {}
    for p in modules:
        rel = './' + p.relative_to(ROOT).as_posix()
        if rel == './src/main.js':
            continue
        imports[rel] = f'{rel}?v={digest(p)}'
    block = ('<script type="importmap">\n'
             + json.dumps({'imports': imports}, ensure_ascii=False, indent=2)
             + '\n  </script>')
    html = re.sub(r'<script type="importmap">.*?</script>', lambda m: block, html, flags=re.S)
    html = re.sub(r'href="style\.css(\?v=[0-9a-f]+)?"', f'href="style.css?v={digest(ROOT / "style.css")}"', html)
    html = re.sub(r'src="src/main\.js(\?v=[0-9a-f]+)?"', f'src="src/main.js?v={digest(ROOT / "src" / "main.js")}"', html)
    INDEX.write_text(html, encoding='utf-8')
    print(f'stamped {len(imports) + 2} files')


if __name__ == '__main__':
    main()
