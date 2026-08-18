from sqlalchemy.orm import Session

from app.auth import hash_password
from app.config import get_settings
from app.models import (
    Branch,
    ClinicSetting,
    Drug,
    InvestigationType,
    PrescriptionTemplate,
    User,
)

settings = get_settings()

DEFAULT_SETTINGS = [
    ("clinic_name", "Advanced Heart Center", "Polyclinic Name", "clinic"),
    ("clinic_subtitle", "Saidu Sharif, Swat", "Subtitle / Location", "clinic"),
    ("clinic_address", "Saidu Sharif, Swat, KPK, Pakistan", "Full Address", "clinic"),
    ("clinic_phone_1", "0349-9055755", "Primary Phone (Cell)", "contact"),
    ("clinic_phone_2", "03469854648", "Secondary Phone", "contact"),
    ("clinic_email", "", "Email Address", "contact"),
    ("clinic_website", "", "Website", "contact"),
    ("clinic_footer", "ECG · Echo · ETT · Holter · ABPM · CCU Available", "Footer Text", "clinic"),
    ("token_prefix", "AHC", "Patient ID Prefix", "clinic"),
    ("logo_path", "", "Clinic Logo", "branding"),
    ("doctor_name", "DR. SALEEM ULLAH", "Doctor Name (on Prescription)", "doctor"),
    ("doctor_title", "Interventional Cardiologist", "Doctor Title / Specialization", "doctor"),
    ("doctor_qualifications", "MBBS, FCPS Cardiology", "Qualifications Line 1", "doctor"),
    ("doctor_fellowship", "Fellowship Interventional Cardiology (NICVD KARACHI)", "Qualifications Line 2", "doctor"),
    ("doctor_signature_title", "Treating Cardiologist", "Signature Title", "doctor"),
    ("doctor_photo_path", "", "Doctor Photo", "branding"),
    ("assessment_options", "Improving, Deteriorating, Static", "Follow-up Assessment Options", "clinic"),
]

DRUGS = [
    ("Aspirin", "75mg", "1 tab", "Oral", "OD", "Continuous", ""),
    ("Clopidogrel", "75mg", "1 tab", "Oral", "OD", "Continuous", ""),
    ("Atorvastatin", "40mg", "1 tab", "Oral", "HS", "Continuous", ""),
    ("Rosuvastatin", "10mg", "1 tab", "Oral", "HS", "Continuous", ""),
    ("Metoprolol", "50mg", "1 tab", "Oral", "BD", "Continuous", ""),
    ("Bisoprolol", "5mg", "1 tab", "Oral", "OD", "Continuous", ""),
    ("Amlodipine", "5mg", "1 tab", "Oral", "OD", "Continuous", ""),
    ("Enalapril", "5mg", "1 tab", "Oral", "BD", "Continuous", ""),
    ("Ramipril", "2.5mg", "1 tab", "Oral", "OD", "Continuous", ""),
    ("Losartan", "50mg", "1 tab", "Oral", "OD", "Continuous", ""),
    ("Furosemide", "40mg", "1 tab", "Oral", "OD", "7 days", ""),
    ("Spironolactone", "25mg", "1 tab", "Oral", "OD", "Continuous", ""),
    ("Isosorbide Mononitrate", "30mg", "1 tab", "Oral", "OD", "Continuous", ""),
    ("Nitroglycerin SL", "0.6mg", "1 tab", "Sublingual", "SOS", "Continuous", "For chest pain"),
    ("Warfarin", "5mg", "As directed", "Oral", "OD", "Continuous", "Monitor INR"),
    ("Rivaroxaban", "20mg", "1 tab", "Oral", "OD", "Continuous", "With food"),
    ("Digoxin", "0.25mg", "1 tab", "Oral", "OD", "Continuous", ""),
    ("Amiodarone", "200mg", "1 tab", "Oral", "OD", "Continuous", ""),
    ("Metformin", "500mg", "1 tab", "Oral", "BD", "Continuous", ""),
    ("Insulin Glargine", "10 units", "10 units", "SC", "HS", "Continuous", ""),
]

INVESTIGATIONS = [
    ("ECG", "cardiac"),
    ("Echocardiography", "cardiac"),
    ("ETT (Exercise Tolerance Test)", "cardiac"),
    ("24-hour Holter Monitoring", "cardiac"),
    ("24-hour ABPM", "cardiac"),
    ("CBC", "lab"),
    ("Creatinine", "lab"),
    ("Urea", "lab"),
    ("RBS (Random Blood Sugar)", "lab"),
    ("Troponin-I", "lab"),
    ("CK-MB", "lab"),
    ("Urine R/E", "lab"),
    ("TSH", "lab"),
    ("FT4", "lab"),
    ("Lipid Profile", "lab"),
    ("Uric Acid", "lab"),
    ("HBsAg", "lab"),
    ("Anti-HCV", "lab"),
    ("Anti-HIV", "lab"),
    ("CXR (Chest X-Ray)", "imaging"),
    ("Coronary Angiography", "imaging"),
    ("CT Angiography", "imaging"),
]

USERS = [
    ("admin", "admin123", "Admin User", "ADMIN"),
    ("reception", "reception123", "Reception Desk", "RECEPTION"),
    ("attendant", "attendant123", "Clinic Attendant", "ATTENDANT"),
    ("dr_khan", "doctor123", "Dr. Muhammad Khan", "CARDIOLOGIST"),
    ("dr_ali", "doctor123", "Dr. Saeed Alam", "CARDIOLOGIST"),
    ("dr_saleem", "doctor123", "Dr. Saleem Ullah", "CARDIOLOGIST"),
]


def seed_if_empty(db: Session) -> None:
    if db.query(Branch).first() is None:
        db.add(
            Branch(
                name=settings.branch_name,
                address=settings.branch_address,
                phone="",
                is_active=True,
            )
        )
        db.flush()

    branch = db.query(Branch).first()
    if db.query(User).first() is None:
        for username, password, full_name, role in USERS:
            db.add(
                User(
                    username=username,
                    password_hash=hash_password(password),
                    full_name=full_name,
                    role=role,
                    branch_id=branch.id if branch else None,
                    is_active=True,
                )
            )

    existing_keys = {row.key for row in db.query(ClinicSetting).all()}
    for key, value, label, category in DEFAULT_SETTINGS:
        if key not in existing_keys:
            db.add(ClinicSetting(key=key, value=value, label=label, category=category))

    if db.query(Drug).first() is None:
        for name, strength, dosage, route, freq, duration, instr in DRUGS:
            db.add(
                Drug(
                    name=name,
                    generic_name=name,
                    strength=strength,
                    default_dosage=dosage,
                    default_route=route,
                    default_frequency=freq,
                    default_duration=duration,
                    default_instructions=instr,
                )
            )

    if db.query(InvestigationType).first() is None:
        for name, category in INVESTIGATIONS:
            db.add(InvestigationType(name=name, category=category, is_custom=False, is_active=True))

    if db.query(PrescriptionTemplate).first() is None:
        db.add(
            PrescriptionTemplate(
                name="Simple Minimal",
                description="Compact text-based prescription",
                html_content=(
                    "<div class=\"rx-min\"><div class=\"top\"><h2>{{ clinic_name }}</h2>"
                    "<p>{{ clinic_address }} | {{ clinic_phone_1 }}</p></div><hr>"
                    "<p>Patient: <b>{{ patient_name }}</b> | ID: {{ patient_id }} | "
                    "{{ patient_age }}/{{ patient_gender }} | Date: {{ visit_date }}</p>"
                    "<p>Dr. {{ doctor_name }}{% if diagnoses %} | Dx: {{ diagnoses }}{% endif %}</p><hr>"
                    "<ol>{% for med in medicines %}<li><b>{{ med.name }} {{ med.strength }}</b> — "
                    "{{ med.dosage }} {{ med.route }}, {{ med.frequency }}, {{ med.duration }}"
                    "{% if med.instructions %} ({{ med.instructions }}){% endif %}</li>{% endfor %}</ol>"
                    "{% if instructions_en %}<p><i>{{ instructions_en }}</i></p>{% endif %}"
                    "{% if follow_up_date %}<p>Follow-up: {{ follow_up_date }}</p>{% endif %}"
                    "<hr><p class=\"foot\">{{ clinic_footer }}</p></div>"
                ),
                css_content=(
                    ".rx-min{font-family:Georgia,serif;max-width:650px;margin:2rem auto;padding:1.5rem}"
                    ".rx-min h2{margin:0;font-size:1.2rem}.rx-min .foot{font-size:.8rem;color:#888;text-align:center}"
                ),
                is_default=True,
                is_active=True,
            )
        )
    db.commit()
