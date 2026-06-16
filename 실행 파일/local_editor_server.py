from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR if (SCRIPT_DIR / "admin.html").exists() else SCRIPT_DIR.parent
DATA_FILE = ROOT / "data" / "portfolio.json"


class PortfolioEditorHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/__portfolio/save":
            self.send_error(404, "Not found")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0:
                raise ValueError("Empty request body")
            if length > 2_000_000:
                raise ValueError("Portfolio data is too large")

            raw = self.rfile.read(length).decode("utf-8")
            parsed = json.loads(raw)
            DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
            DATA_FILE.write_text(json.dumps(parsed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            self.send_json({"ok": True})
        except Exception as error:
            self.send_json({"ok": False, "error": str(error)}, status=400)

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
    server = ThreadingHTTPServer(("127.0.0.1", port), PortfolioEditorHandler)
    print(f"Serving {ROOT}")
    print(f"Editor: http://127.0.0.1:{port}/admin.html")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
