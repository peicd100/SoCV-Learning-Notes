from __future__ import annotations

import socket
import sys
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def repo_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[1]


def site_root() -> Path:
    if getattr(sys, "frozen", False):
        bundle_root = Path(getattr(sys, "_MEIPASS", repo_root()))
        embedded_site = bundle_root / "site"
        if embedded_site.exists():
            return embedded_site
    return repo_root() / "site"


def entry_path(root: Path) -> str:
    blog_index = root / "blog" / "index.html"
    if blog_index.exists():
        return "blog/index.html"
    return "index.html"


def choose_port(preferred: int = 8000) -> int:
    for port in (preferred, 0):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(("127.0.0.1", port))
            return sock.getsockname()[1]
    raise RuntimeError("No free port available.")


class QuietHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        # Avoid stale CSS/JS during repeated local preview refreshes.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        return


def main() -> int:
    root = site_root()
    if not root.exists():
        raise SystemExit(f"Site directory not found: {root}")

    port = choose_port()
    handler = partial(QuietHandler, directory=str(root))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    url = f"http://127.0.0.1:{port}/{entry_path(root)}"

    threading.Timer(0.8, lambda: webbrowser.open(url, new=2)).start()
    print(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
