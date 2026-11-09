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


class Server(http.server.ThreadingHTTPServer):
    # 기본 대기열(5)로는 stamp.py가 채운 modulepreload처럼 요청 수십 개가 한꺼번에 오면 윈도우에서 일부를 거부한다
    request_queue_size = 64


os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
Server(('', PORT), NoCache).serve_forever()
