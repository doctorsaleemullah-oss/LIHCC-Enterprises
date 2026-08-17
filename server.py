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

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
DATA_DIR = ROOT / "data"
DATA_FILE = DATA_DIR / "clinic.json"
HOST = os.environ.get("AHC_HOST", "0.0.0.0")
PORT = int(os.environ.get("AHC_PORT", "8000"))

SPA_ROUTES = {
    "/",
    "/dashboard",
    "/reception",
    "/vitals",
    "/consultation",
    "/patients",
    "/investigations",
    "/analytics",
    "/staff",
    "/settings",
    "/profile",
}


def today_iso() -> str:
    return date.today().isoformat()


def seed() -> dict:
    today = today_iso()
    return {
        "clinic": {
            "name": "Advanced Heart Center",
            "location": "Saidu Sharif, Swat",
            "hospital": "Swat International Hospital",
            "phone": "+92 345 1234567",
            "tagline": "Excellence in Cardiac Care, Compassion in Every Heart",
            "hours": "Mon–Sat 10:00 AM – 7:00 PM",
            "sundayClinic": "Khwaza Khela Medical Center, 8:00 AM – 1:00 PM",
        },
        "profile": {
            "name": "Dr. Saleem Ullah",
            "role": "Interventional Cardiologist Consultant",
            "qualifications": "MBBS (KMC Peshawar) · FCPS Cardiology (HMC) · Fellowship Interventional Cardiology (NICVD Karachi)",
            "experienceYears": 12,
            "happyPatients": 2500,
            "successRate": 98,
            "affiliations": [
                "Chairman, Cardiology — Luqman International Hospital, Saidu Sharif",
                "Consultant — Saidu Teaching Hospital",
                "Consultant — Advanced Heart Center, Swat International Hospital",
            ],
        },
        "staff": [
            {
                "id": "s1",
                "name": "Dr. Saleem Ullah",
                "role": "Interventional Cardiologist",
                "access": "owner",
                "phone": "+92 345 1234567",
                "active": True,
            },
            {
                "id": "s2",
                "name": "Dr. Muhammad Khan",
                "role": "Cardiologist",
                "access": "doctor",
                "phone": "",
                "active": True,
            },
        ],
        "patients": [
            {
                "id": "p1",
                "name": "Saleem Ullah",
                "age": 54,
                "sex": "M",
                "phone": "0345-1112233",
                "cnic": "",
                "address": "Saidu Sharif",
                "mrn": "AHC-1001",
            },
            {
                "id": "p2",
                "name": "Tauqeer Nasir",
                "age": 47,
                "sex": "M",
                "phone": "0346-4455667",
                "cnic": "",
                "address": "Mingora",
                "mrn": "AHC-1002",
            },
            {
                "id": "p3",
                "name": "Fazal Ur Rehman",
                "age": 62,
                "sex": "M",
                "phone": "0344-7788990",
                "cnic": "",
                "address": "Kanju",
                "mrn": "AHC-1003",
            },
            {
                "id": "p4",
                "name": "Zainab Shah",
                "age": 39,
                "sex": "F",
                "phone": "0345-2211009",
                "cnic": "",
                "address": "Saidu Sharif",
                "mrn": "AHC-1004",
            },
            {
                "id": "p5",
                "name": "Irfan Ullah",
                "age": 58,
                "sex": "M",
                "phone": "0347-3300211",
                "cnic": "",
                "address": "Charbagh",
                "mrn": "AHC-1005",
            },
        ],
        "visits": [
            {
                "id": "v1",
                "token": 1,
                "date": today,
                "patientId": "p1",
                "doctorId": "s2",
                "type": "New",
                "status": "Completed",
                "complaint": "Chest heaviness on exertion",
            },
            {
                "id": "v2",
                "token": 2,
                "date": today,
                "patientId": "p2",
                "doctorId": "s1",
                "type": "Follow-up",
                "status": "Completed",
                "complaint": "Post-PCI review",
            },
            {
                "id": "v3",
                "token": 3,
                "date": today,
                "patientId": "p5",
                "doctorId": "s1",
                "type": "New",
                "status": "Completed",
                "complaint": "Palpitations",
            },
        ],
        "appointments": [
            {
                "id": "a1",
                "date": today,
                "time": "10:30",
                "patientId": "p3",
                "doctorId": "s1",
                "reason": "Follow-up echo",
            },
            {
                "id": "a2",
                "date": today,
                "time": "11:15",
                "patientId": "p4",
                "doctorId": "s1",
                "reason": "New patient consult",
            },
            {
                "id": "a3",
                "date": today,
                "time": "12:00",
                "patientId": "p5",
                "doctorId": "s2",
                "reason": "BP & medication review",
            },
        ],
        "vitals": [
            {
                "id": "vt1",
                "visitId": "v1",
                "patientId": "p1",
                "date": today,
                "bpSys": 148,
                "bpDia": 92,
                "hr": 86,
                "temp": 36.8,
                "spo2": 97,
                "weight": 81,
                "height": 172,
            }
        ],
        "consultations": [
            {
                "id": "c1",
                "visitId": "v1",
                "patientId": "p1",
                "doctorId": "s2",
                "date": today,
                "diagnosis": "Stable angina · HTN",
                "notes": "Lifestyle advice given. Start anti-anginal therapy. Echo + lipid profile planned.",
                "rx": [
                    {"drug": "Aspirin 75 mg", "dose": "1 tab", "freq": "OD", "days": "30"},
                    {"drug": "Atorvastatin 40 mg", "dose": "1 tab", "freq": "HS", "days": "30"},
                    {"drug": "Bisoprolol 2.5 mg", "dose": "1 tab", "freq": "OD", "days": "30"},
                ],
            }
        ],
        "investigations": [],
        "next": {"patient": 6, "visit": 4, "staff": 3, "appt": 4, "vital": 2, "consult": 2, "inv": 1},
    }


def load_clinic() -> dict:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        data = seed()
        save_clinic(data)
        return data
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
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
