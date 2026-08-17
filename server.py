#!/usr/bin/env python3
"""Advanced Heart Center — clinic desk on http://localhost:8000/dashboard"""

from __future__ import annotations

import json
import mimetypes
import os
from datetime import date, datetime
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

from import_backup import clinic_defaults, import_backup, is_backup

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
DATA_DIR = ROOT / "data"
DATA_FILE = DATA_DIR / "clinic.json"
BACKUP_FILE = DATA_DIR / "backup.json"
HOST = os.environ.get("AHC_HOST", "0.0.0.0")
PORT = int(os.environ.get("AHC_PORT", "8000"))

SPA_ROUTES = {
    "/",
    "/dashboard",
    "/reception",
    "/vitals",
    "/consultation",
    "/patients",
    "/prescriptions",
    "/billing",
    "/investigations",
    "/analytics",
    "/staff",
    "/settings",
    "/profile",
}


def today_iso() -> str:
    return date.today().isoformat()


def empty_clinic() -> dict:
    data = clinic_defaults()
    data.update(
        {
            "patients": [],
            "visits": [],
            "appointments": [],
            "vitals": [],
            "consultations": [],
            "investigations": [],
            "billing": [],
            "source": "empty",
            "next": {"patient": 1, "visit": 1, "staff": 3, "appt": 1, "vital": 1, "consult": 1, "inv": 1, "bill": 1},
        }
    )
    return data


def load_backup_file() -> dict | None:
    if not BACKUP_FILE.exists():
        return None
    try:
        payload = json.loads(BACKUP_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    if not is_backup(payload):
        return None
    return import_backup(payload)


def seed() -> dict:
    return load_backup_file() or empty_clinic()


def load_clinic() -> dict:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if DATA_FILE.exists():
        try:
            current = json.loads(DATA_FILE.read_text(encoding="utf-8"))
            if current.get("patients"):
                return current
        except (json.JSONDecodeError, OSError):
            pass
    data = seed()
    save_clinic(data)
    return data


def save_clinic(data: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = DATA_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(DATA_FILE)


class Handler(BaseHTTPRequestHandler):
    server_version = "AHC/1.0"

    def log_message(self, fmt: str, *args) -> None:
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] {self.address_string()} {fmt % args}")

    def _send(self, code: int, body: bytes, content_type: str, extra: dict | None = None) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if extra:
            for k, v in extra.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, obj) -> None:
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self._send(code, raw, "application/json; charset=utf-8")

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return None
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/api/clinic":
            self._json(200, load_clinic())
            return
        if path == "/api/health":
            self._json(200, {"ok": True, "service": "advanced-heart-center"})
            return

        if path in SPA_ROUTES:
            self._file(STATIC / "index.html", "text/html; charset=utf-8")
            return

        rel = path[1:] if path.startswith("/") else path
        if rel.startswith("static/"):
            candidate = (ROOT / rel).resolve()
        else:
            candidate = (STATIC / rel).resolve()
        try:
            candidate.relative_to(STATIC)
        except ValueError:
            self._json(404, {"error": "Not found", "path": path})
            return
        if candidate.is_file():
            ctype = mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
            if candidate.suffix == ".js":
                ctype = "application/javascript; charset=utf-8"
            elif candidate.suffix == ".css":
                ctype = "text/css; charset=utf-8"
            self._file(candidate, ctype)
            return

        self._json(404, {"error": "Not found", "path": path})

    def do_PUT(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        if path != "/api/clinic":
            self._json(404, {"error": "Not found"})
            return
        try:
            payload = self._read_json()
        except json.JSONDecodeError:
            self._json(400, {"error": "Invalid JSON"})
            return
        if not isinstance(payload, dict):
            self._json(400, {"error": "Expected an object"})
            return
        if is_backup(payload):
            payload = import_backup(payload)
        save_clinic(payload)
        self._json(200, {"ok": True})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        if path == "/api/clinic/reset":
            data = seed()
            save_clinic(data)
            self._json(200, data)
            return
        if path == "/api/clinic/restore":
            try:
                payload = self._read_json()
            except json.JSONDecodeError:
                self._json(400, {"error": "Invalid JSON"})
                return
            if not isinstance(payload, dict) or not is_backup(payload):
                self._json(400, {"error": "Not an Advanced Heart Center backup"})
                return
            BACKUP_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            data = import_backup(payload)
            save_clinic(data)
            self._json(200, data)
            return
        self._json(404, {"error": "Not found"})

    def _file(self, path: Path, content_type: str) -> None:
        body = path.read_bytes()
        self._send(200, body, content_type)


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    load_clinic()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print()
    print("  Advanced Heart Center")
    print(f"  Dashboard:  http://localhost:{PORT}/dashboard")
    print(f"  Listening:  http://{HOST}:{PORT}")
    print("  Stop with Ctrl+C")
    print()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        httpd.server_close()


if __name__ == "__main__":
    main()
