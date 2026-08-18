from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

from jinja2 import Environment, BaseLoader
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import (
    AuditLog,
    ClinicSetting,
    Consultation,
    MedicalHistory,
    Patient,
    PatientInvestigation,
    PrescriptionTemplate,
    Visit,
    Vitals,
)

settings = get_settings()


def parse_json(value, default=None):
    if value is None:
        return {} if default is None else default
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return {} if default is None else default
    return {} if default is None else default


def clinic_map(db: Session) -> dict[str, str]:
    rows = db.query(ClinicSetting).all()
    return {row.key: row.value for row in rows}


def setting(db: Session, key: str, fallback: str = "") -> str:
    row = db.query(ClinicSetting).filter(ClinicSetting.key == key).first()
    return row.value if row else fallback


def next_patient_code(db: Session) -> str:
    prefix = setting(db, "token_prefix", settings.token_prefix) or "AHC"
    year = date.today().year
    like = f"{prefix}-{year}-%"
    last = (
        db.query(Patient)
        .filter(Patient.patient_code.like(like))
        .order_by(Patient.id.desc())
        .first()
    )
    n = 1
    if last:
        try:
            n = int(last.patient_code.rsplit("-", 1)[-1]) + 1
        except ValueError:
            n = (db.query(func.count(Patient.id)).scalar() or 0) + 1
    return f"{prefix}-{year}-{n:04d}"


def next_token(db: Session, visit_date: date) -> int:
    current = (
        db.query(func.max(Visit.token_number))
        .filter(Visit.visit_date == visit_date)
        .scalar()
    )
    return int(current or 0) + 1


def log_action(db: Session, user_id: int | None, action: str, entity_type: str, entity_id: int | None, details: str = ""):
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or "",
        )
    )


def bmi(weight: float | None, height: float | None) -> float | None:
    if not weight or not height or height <= 0:
        return None
    metres = height / 100.0
    return round(weight / (metres * metres), 1)


def previous_visit(db: Session, patient_id: int, current_visit_id: int) -> Visit | None:
    return (
        db.query(Visit)
        .filter(Visit.patient_id == patient_id, Visit.id < current_visit_id)
        .order_by(Visit.id.desc())
        .first()
    )


def presented_with(complaints: dict) -> str:
    parts = []
    if complaints.get("chest_pain"):
        bit = "Chest pain"
        extra = [complaints.get("chest_pain_class"), complaints.get("chest_pain_ccs")]
        extra = [e for e in extra if e]
        if extra:
            bit += " (" + ", ".join(extra) + ")"
        parts.append(bit)
    if complaints.get("dyspnea"):
        bit = "Dyspnea"
        if complaints.get("dyspnea_nyha"):
            bit += f" ({complaints['dyspnea_nyha']})"
        parts.append(bit)
    if complaints.get("orthopnea"):
        parts.append("Orthopnea")
    if complaints.get("pnd"):
        parts.append("PND")
    parts.extend(complaints.get("other_symptoms") or [])
    if complaints.get("other_text"):
        parts.append(complaints["other_text"])
    return ", ".join(parts) if parts else "—"


def examination_lines(exam: dict, vitals: Vitals | None = None) -> list[str]:
    lines = []
    pulse = exam.get("pulse") or (f"{vitals.pulse} BPM" if vitals and vitals.pulse else "")
    bp = exam.get("bp") or (
        f"{vitals.bp_systolic}/{vitals.bp_diastolic} mmHg"
        if vitals and vitals.bp_systolic and vitals.bp_diastolic
        else ""
    )
    spo2 = exam.get("spo2") or (f"{vitals.spo2} %" if vitals and vitals.spo2 else "")
    if pulse:
        lines.append(f"Pulse {pulse}")
    if bp:
        lines.append(f"BP {bp}")
    if spo2:
        lines.append(f"SpO₂ {spo2}")
    for label, key in (("CVS", "cvs"), ("Chest", "respiratory"), ("CNS", "cns"), ("Abdomen", "git")):
        findings = exam.get(key) or []
        notes = exam.get(f"{key}_notes") or exam.get("resp_notes" if key == "respiratory" else f"{key}_notes") or ""
        if key == "respiratory":
            notes = exam.get("resp_notes") or ""
        text = ", ".join(findings)
        if notes:
            text = f"{text}; {notes}" if text else notes
        if text:
            lines.append(f"{label}: {text}")
    return lines or ["—"]


def labs_text(investigations: list[PatientInvestigation]) -> str:
    bits = []
    for item in investigations:
        name = item.inv_type.name if item.inv_type else "Investigation"
        if item.status == "COMPLETED" and item.result_text:
            bits.append(f"{name}: {item.result_text}")
        else:
            bits.append(f"{name} ({item.status.title()})")
    return "; ".join(bits) if bits else "—"


def risk_factors_text(history: MedicalHistory | None) -> str:
    if not history:
        return "—"
    bits = []
    if history.htn:
        bits.append("HTN")
    if history.dm:
        bits.append("DM")
    if history.dyslipidemia:
        bits.append("Dyslipidemia")
    if history.smoking and history.smoking != "Never":
        bits.append(f"Smoker ({history.smoking})")
    if history.previous_cva:
        bits.append("CVA")
    if history.previous_pci:
        bits.append("PCI" + (f" {history.pci_details}" if history.pci_details else ""))
    if history.previous_cabg:
        bits.append("CABG" + (f" {history.cabg_details}" if history.cabg_details else ""))
    return ", ".join(bits) if bits else "—"


def family_history_text(history: MedicalHistory | None) -> str:
    if not history:
        return "—"
    bits = []
    if history.family_cad:
        bits.append("FH of IHD")
    if history.family_dm:
        bits.append("FH of DM")
    return ", ".join(bits) if bits else "—"


def diagnoses_text(consultation: Consultation | None) -> str:
    if not consultation:
        return ""
    dx = parse_json(consultation.diagnoses, [])
    if isinstance(dx, str):
        return dx
    return ", ".join(dx) if isinstance(dx, list) else str(dx or "")


def build_rx_context(db: Session, visit: Visit) -> dict:
    cfg = clinic_map(db)
    patient = visit.patient
    consult = visit.consultation
    history = patient.medical_history if patient else None
    complaints = parse_json(consult.complaints, {}) if consult else {}
    exam = parse_json(consult.examination, {}) if consult else {}
    medicines = []
    if visit.prescription:
        for i, item in enumerate(visit.prescription.items, start=1):
            medicines.append(
                {
                    "index": i,
                    "name": item.drug_name,
                    "generic_name": item.generic_name,
                    "strength": item.strength,
                    "dosage": item.dosage,
                    "route": item.route,
                    "frequency": item.frequency,
                    "duration": item.duration,
                    "instructions": item.instructions,
                }
            )
    logo = cfg.get("logo_path") or ""
    logo_url = f"/uploads/{Path(logo).name}" if logo else ""
    smoker = bool(history and history.smoking and history.smoking != "Never")
    return {
        "clinic_name": cfg.get("clinic_name", settings.branch_name),
        "clinic_subtitle": cfg.get("clinic_subtitle", ""),
        "clinic_address": cfg.get("clinic_address", settings.branch_address),
        "clinic_phone_1": cfg.get("clinic_phone_1", ""),
        "clinic_phone_2": cfg.get("clinic_phone_2", ""),
        "clinic_email": cfg.get("clinic_email", ""),
        "clinic_footer": cfg.get("clinic_footer", ""),
        "doctor_name": cfg.get("doctor_name") or (visit.cardiologist.full_name if visit.cardiologist else ""),
        "doctor_title": cfg.get("doctor_title", ""),
        "doctor_qualifications": cfg.get("doctor_qualifications", ""),
        "doctor_fellowship": cfg.get("doctor_fellowship", ""),
        "doctor_signature_title": cfg.get("doctor_signature_title", "Treating Cardiologist"),
        "logo_url": logo_url,
        "patient_name": patient.name if patient else "",
        "patient_name_ur": patient.name_ur if patient else "",
        "patient_id": patient.patient_code if patient else "",
        "patient_age": patient.age if patient else "",
        "patient_gender": patient.gender if patient else "",
        "patient_address": patient.address if patient else "",
        "patient_phone": patient.phone if patient else "",
        "visit_date": visit.visit_date.strftime("%d %b %Y") if visit.visit_date else "",
        "visit_time": visit.created_at.strftime("%H:%M") if visit.created_at else "",
        "diagnoses": diagnoses_text(consult),
        "assessment": consult.assessment if consult else "",
        "presented_with": presented_with(complaints),
        "labs_text": labs_text(visit.investigations),
        "examination_lines": examination_lines(exam, visit.vitals),
        "examination_text": "; ".join(examination_lines(exam, visit.vitals)),
        "risk_factors_text": risk_factors_text(history),
        "family_history_text": family_history_text(history),
        "risk_dm": bool(history and history.dm),
        "risk_htn": bool(history and history.htn),
        "risk_smoker": smoker,
        "risk_fh_ihd": bool(history and history.family_cad),
        "medicines": medicines,
        "instructions_en": visit.prescription.instructions_en if visit.prescription else "",
        "instructions_ur": visit.prescription.instructions_ur if visit.prescription else "",
        "follow_up_date": visit.follow_up_date.strftime("%d %b %Y") if visit.follow_up_date else "",
    }


def render_prescription(db: Session, visit: Visit) -> str:
    template = None
    if visit.prescription and visit.prescription.template_id:
        template = db.get(PrescriptionTemplate, visit.prescription.template_id)
    if not template:
        template = (
            db.query(PrescriptionTemplate)
            .filter(PrescriptionTemplate.is_active.is_(True), PrescriptionTemplate.is_default.is_(True))
            .first()
        )
    if not template:
        template = db.query(PrescriptionTemplate).filter(PrescriptionTemplate.is_active.is_(True)).first()
    html = template.html_content if template else "<p>{{ patient_name }} — {{ diagnoses }}</p>"
    css = template.css_content if template else ""
    env = Environment(loader=BaseLoader(), autoescape=False)
    body = env.from_string(html).render(**build_rx_context(db, visit))
    return f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<title>Prescription — {visit.patient.patient_code if visit.patient else visit.id}</title>
<style>
@media print {{ .no-print {{ display:none !important; }} }}
{css}
</style>
</head><body>
<div class="no-print" style="padding:12px;text-align:center;background:#f4f1ea;font-family:sans-serif">
  <button onclick="window.print()" style="padding:10px 18px;border:0;border-radius:8px;background:#0b1f3a;color:#fff;font-weight:700;cursor:pointer">Print</button>
</div>
{body}
</body></html>"""


def empty_complaints() -> dict:
    return {
        "chest_pain": False,
        "chest_pain_class": "",
        "chest_pain_ccs": "",
        "dyspnea": False,
        "dyspnea_nyha": "",
        "orthopnea": False,
        "pnd": False,
        "other_symptoms": [],
        "other_text": "",
    }


def empty_exam() -> dict:
    return {
        "pulse": "",
        "bp": "",
        "spo2": "",
        "cvs": [],
        "cvs_notes": "",
        "respiratory": [],
        "resp_notes": "",
        "cns": [],
        "cns_notes": "",
        "git": [],
        "git_notes": "",
    }


def iso(value) -> str:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    return ""
