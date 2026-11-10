# 개발용 로컬 서버. python -m http.server 와 같지만 브라우저가 옛 파일을 캐시하지 않게 한다.
# 실행: python tools/serve.py  (http://localhost:8123)
import contextlib
import http.server
import os
import socket
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class NoCache(http.server.SimpleHTTPRequestHandler):
    # 연결 하나로 파일 여러 개를 이어 받게 한다. HTTP/1.0이면 파일마다 연결을 새로 맺는다(known-issues 56)
    protocol_version = 'HTTP/1.1'

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # 기본 대기열(5)로는 stamp.py가 채운 modulepreload처럼 요청 수십 개가 한꺼번에 오면 윈도우에서 일부를 거부한다
    request_queue_size = 64


class DualStack(Server):
    # IPv6(::1)와 IPv4(127.0.0.1)를 한 소켓으로 받는다. 윈도우의 브라우저는 localhost를 IPv6로 먼저 찾아서,
    # IPv4로만 받으면 연결마다 0.3초씩 기다린 뒤 IPv4로 넘어간다(known-issues 56). python -m http.server도 이렇게 연다.
    address_family = socket.AF_INET6

    def server_bind(self):
        with contextlib.suppress(Exception):
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
try:
    server = DualStack(('::', PORT), NoCache)
except OSError:  # IPv6를 쓸 수 없는 PC
    server = Server(('', PORT), NoCache)
server.serve_forever()
