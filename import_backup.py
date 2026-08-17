"""Convert Advanced Heart Center backup JSON into clinic-desk records."""

from __future__ import annotations

from datetime import datetime


def clinic_defaults() -> dict:
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
    }


def parse_bp(raw: str) -> tuple[int, int]:
    text = (raw or "").replace(" ", "")
    if "/" not in text:
        return 0, 0
    left, right = text.split("/", 1)
    try:
        return int(left), int(right)
    except ValueError:
        return 0, 0


def parse_num(raw) -> float:
    try:
        return float(str(raw).strip() or 0)
    except ValueError:
        return 0.0


def parse_time(raw: str) -> str:
    text = (raw or "").strip()
    for fmt in ("%I:%M %p", "%H:%M", "%I:%M%p"):
        try:
            return datetime.strptime(text, fmt).strftime("%H:%M")
        except ValueError:
            continue
    return text


def sex_code(gender: str) -> str:
    return "F" if str(gender or "").lower().startswith("f") else "M"


def find_doctor(staff: list[dict], name: str) -> str:
    needle = (name or "").lower()
    for person in staff:
        full = person["name"].lower()
        if needle and (needle in full or full in needle):
            return person["id"]
    return staff[0]["id"] if staff else ""


def visit_type(label: str) -> str:
    text = (label or "").lower()
    if "follow" in text:
        return "Follow-up"
    if "new" in text:
        return "New"
    return "Follow-up"


def is_backup(payload: dict) -> bool:
    if not isinstance(payload, dict):
        return False
    if "data" in payload and isinstance(payload["data"], dict):
        payload = payload["data"]
    return "patients" in payload and (
        "prescriptions" in payload or "billing" in payload or "appointments" in payload
    )


def import_backup(payload: dict) -> dict:
    raw = payload.get("data") if isinstance(payload.get("data"), dict) and "patients" in payload.get("data", {}) else payload
    data = clinic_defaults()
    staff = data["staff"]

    patients = []
    for rec in raw.get("patients") or []:
        city = rec.get("city") or ""
        addr = rec.get("addr") or rec.get("address") or ""
        address = ", ".join(part for part in (addr, city) if part)
        patients.append(
            {
                "id": rec.get("id"),
                "name": rec.get("name") or "Unknown",
                "age": int(parse_num(rec.get("age"))),
                "sex": sex_code(rec.get("gender") or rec.get("sex") or "M"),
                "phone": rec.get("phone") or "",
                "cnic": rec.get("cnic") or "",
                "address": address,
                "city": city,
                "blood": rec.get("blood") or "",
                "diag": rec.get("diag") or "",
                "ref": rec.get("ref") or "",
                "notes": rec.get("notes") or "",
                "status": rec.get("status") or "Active",
                "created": rec.get("created") or "",
                "mrn": rec.get("id") or rec.get("mrn") or "",
            }
        )

    appointments = []
    visits = []
    investigations = []
    tests = {"ecg", "echo", "holter", "ett", "tmt"}
    for index, rec in enumerate(raw.get("appointments") or [], start=1):
        doctor_id = find_doctor(staff, rec.get("doctor") or "")
        kind = rec.get("type") or "Consultation"
        appt_status = rec.get("status") or "Pending"
        appointments.append(
            {
                "id": rec.get("id") or f"AP-{index}",
                "date": rec.get("date") or "",
                "time": parse_time(rec.get("time") or ""),
                "timeLabel": rec.get("time") or "",
                "patientId": rec.get("patId") or rec.get("patientId"),
                "doctorId": doctor_id,
                "doctorName": rec.get("doctor") or "",
                "reason": kind,
                "type": kind,
                "status": appt_status,
                "notes": rec.get("notes") or "",
            }
        )
        visit_status = "Completed" if appt_status.lower() == "confirmed" else "Waiting"
        visits.append(
            {
                "id": f"v_{rec.get('id') or index}",
                "token": index,
                "date": rec.get("date") or "",
                "patientId": rec.get("patId") or rec.get("patientId"),
                "doctorId": doctor_id,
                "type": visit_type(kind),
                "status": visit_status,
                "complaint": rec.get("notes") or kind,
            }
        )
        if kind.lower() in tests:
            investigations.append(
                {
                    "id": f"i_{rec.get('id') or index}",
                    "patientId": rec.get("patId") or rec.get("patientId"),
                    "test": kind,
                    "date": rec.get("date") or "",
                    "status": "Completed" if appt_status.lower() == "confirmed" else "Pending",
                    "result": rec.get("notes") or "",
                }
            )

    vitals = []
    consultations = []
    for index, rec in enumerate(raw.get("prescriptions") or [], start=1):
        sys, dia = parse_bp(rec.get("bp") or "")
        visit_id = f"vrx_{rec.get('id') or index}"
        visits.append(
            {
                "id": visit_id,
                "token": 100 + index,
                "date": rec.get("date") or "",
                "patientId": rec.get("patId") or rec.get("patientId"),
                "doctorId": staff[0]["id"],
                "type": "Follow-up",
                "status": "Completed",
                "complaint": rec.get("diag") or "",
            }
        )
        vitals.append(
            {
                "id": rec.get("id") or f"vt{index}",
                "visitId": visit_id,
                "patientId": rec.get("patId") or rec.get("patientId"),
                "date": rec.get("date") or "",
                "bpSys": sys,
                "bpDia": dia,
                "hr": int(parse_num(rec.get("hr"))),
                "temp": 0,
                "spo2": int(parse_num(rec.get("spo2"))),
                "weight": parse_num(rec.get("wt")),
                "height": 0,
                "ecg": rec.get("ecg") or "",
            }
        )
        consultations.append(
            {
                "id": rec.get("id") or f"RX-{index}",
                "visitId": visit_id,
                "patientId": rec.get("patId") or rec.get("patientId"),
                "doctorId": staff[0]["id"],
                "date": rec.get("date") or "",
                "diagnosis": rec.get("diag") or "",
                "notes": rec.get("advice") or "",
                "ecg": rec.get("ecg") or "",
                "rx": [
                    {
                        "drug": med.get("name") or "",
                        "dose": med.get("dose") or "",
                        "freq": med.get("freq") or "",
                        "days": med.get("dur") or med.get("days") or "",
                    }
                    for med in rec.get("meds") or []
                    if med.get("name")
                ],
            }
        )

    billing = []
    for rec in raw.get("billing") or []:
        items = rec.get("items") or []
        billing.append(
            {
                "id": rec.get("id"),
                "patientId": rec.get("patId") or rec.get("patientId"),
                "date": rec.get("date") or "",
                "items": items,
                "status": rec.get("status") or "Pending",
                "total": sum(parse_num(item.get("amt")) for item in items),
            }
        )

    counters = raw.get("counters") or {}
    data.update(
        {
            "patients": patients,
            "appointments": appointments,
            "visits": visits,
            "vitals": vitals,
            "consultations": consultations,
            "investigations": investigations,
            "billing": billing,
            "source": "backup",
            "next": {
                "patient": int(counters.get("pat") or len(patients)) + 1,
                "visit": len(visits) + 1,
                "staff": len(staff) + 1,
                "appt": int(counters.get("appt") or len(appointments)) + 1,
                "vital": len(vitals) + 1,
                "consult": int(counters.get("rx") or len(consultations)) + 1,
                "inv": len(investigations) + 1,
                "bill": int(counters.get("bill") or len(billing)) + 1,
            },
        }
    )
    return data
