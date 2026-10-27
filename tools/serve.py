# 개발용 로컬 서버. python -m http.server 와 같지만 브라우저가 옛 파일을 캐시하지 않게 한다.
# 실행: python tools/serve.py  (http://localhost:8123)
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
http.server.ThreadingHTTPServer(('', PORT), NoCache).serve_forever()
