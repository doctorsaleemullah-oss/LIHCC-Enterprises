from datetime import date, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user, hash_password, require_roles, verify_password
from app.config import get_settings
from app.database import get_db
from app.helpers import (
    empty_complaints,
    empty_exam,
    log_action,
    next_patient_code,
    next_token,
    parse_json,
)
from app.models import (
    ClinicSetting,
    Consultation,
    Drug,
    InvestigationType,
    MedicalHistory,
    Patient,
    PatientInvestigation,
    Prescription,
    PrescriptionItem,
    User,
    Visit,
    Vitals,
)

router = APIRouter(prefix="/api")
settings = get_settings()
UPLOAD_DIR = Path(__file__).resolve().parent.parent / settings.upload_dir
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _int(value, default=None):
    if value in (None, "", "null"):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _float(value, default=None):
    if value in (None, "", "null"):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


@router.post("/login")
async def api_login(
    request: Request,
    db: Session = Depends(get_db),
    username: str = Form(...),
    password: str = Form(...),
):
    user = db.query(User).filter(User.username == username.strip()).first()
    if not user or not user.is_active or not verify_password(password, user.password_hash):
        accept = request.headers.get("accept", "")
        if "application/json" in accept:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        return RedirectResponse("/login?error=1", status_code=303)
    token = create_access_token(user)
    dest = request.query_params.get("next") or "/"
    response = RedirectResponse(dest, status_code=303)
    response.set_cookie(
        settings.cookie_name,
        token,
        httponly=True,
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
    )
    return response


@router.get("/patients/search")
def search_patients(q: str = "", db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = (q or "").strip()
    if len(query) < 2:
        return []
    like = f"%{query}%"
    rows = (
        db.query(Patient)
        .filter(
            or_(
                Patient.name.ilike(like),
                Patient.patient_code.ilike(like),
                Patient.phone.ilike(like),
                Patient.cnic.ilike(like),
            )
        )
        .order_by(Patient.id.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": p.id,
            "patient_code": p.patient_code,
            "name": p.name,
            "age": p.age,
            "gender": p.gender,
            "phone": p.phone,
            "cnic": p.cnic,
            "address": p.address,
        }
        for p in rows
    ]


@router.post("/patients")
async def register_patient(request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("RECEPTION", "ADMIN"))):
    payload = await request.json()
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Patient name is required")
    patient_id = payload.get("patient_id")
    patient = db.get(Patient, int(patient_id)) if patient_id else None
    if patient is None:
        patient = Patient(
            patient_code=next_patient_code(db),
            name=name,
            name_ur=(payload.get("name_ur") or "").strip(),
            age=_int(payload.get("age")),
            gender=payload.get("gender") or "Male",
            address=(payload.get("address") or "").strip(),
            cnic=(payload.get("cnic") or "").strip(),
            phone=(payload.get("phone") or "").strip(),
            branch_id=user.branch_id or 1,
        )
        db.add(patient)
        db.flush()
        db.add(MedicalHistory(patient_id=patient.id))
    else:
        patient.name = name
        patient.name_ur = (payload.get("name_ur") or patient.name_ur or "").strip()
        patient.age = _int(payload.get("age"), patient.age)
        patient.gender = payload.get("gender") or patient.gender
        patient.address = (payload.get("address") or patient.address or "").strip()
        patient.cnic = (payload.get("cnic") or patient.cnic or "").strip()
        patient.phone = (payload.get("phone") or patient.phone or "").strip()
        patient.updated_at = datetime.utcnow()

    visit_date = date.fromisoformat(payload["visit_date"]) if payload.get("visit_date") else date.today()
    cardiologist_id = _int(payload.get("cardiologist_id"))
    if not cardiologist_id:
        raise HTTPException(status_code=400, detail="Assign a cardiologist")
    visit = Visit(
        patient_id=patient.id,
        cardiologist_id=cardiologist_id,
        visit_type=payload.get("visit_type") or "NEW",
        token_number=next_token(db, visit_date),
        consultation_fee=_float(payload.get("consultation_fee"), 2000) or 2000,
        status="WAITING_VITALS",
        visit_date=visit_date,
        created_by=user.id,
    )
    db.add(visit)
    db.flush()
    log_action(db, user.id, "create_visit", "visit", visit.id, f"Patient {patient.id}, Token #{visit.token_number}")
    db.commit()
    return {
        "ok": True,
        "patient_id": patient.id,
        "patient_code": patient.patient_code,
        "visit_id": visit.id,
        "token_number": visit.token_number,
    }


@router.post("/vitals/{visit_id}")
async def save_vitals(visit_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("ATTENDANT", "CARDIOLOGIST", "ADMIN"))):
    visit = db.get(Visit, visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    payload = await request.json()
    vitals = visit.vitals or Vitals(visit_id=visit.id)
    vitals.bp_systolic = _int(payload.get("bp_systolic"))
    vitals.bp_diastolic = _int(payload.get("bp_diastolic"))
    vitals.pulse = _int(payload.get("pulse"))
    vitals.spo2 = _int(payload.get("spo2"))
    vitals.temperature = _float(payload.get("temperature"))
    vitals.weight = _float(payload.get("weight"))
    vitals.height = _float(payload.get("height"))
    vitals.recorded_by = user.id
    vitals.recorded_at = datetime.utcnow()
    db.add(vitals)
    if visit.status in ("WAITING_VITALS",):
        visit.status = "WAITING_DOCTOR"
    log_action(db, user.id, "save_vitals", "visit", visit.id)
    db.commit()
    return {"ok": True, "status": visit.status}


@router.post("/consultation/{visit_id}")
async def save_consultation(visit_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("CARDIOLOGIST", "ADMIN"))):
    visit = db.get(Visit, visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    payload = await request.json()
    history_data = payload.get("history") or {}
    history = visit.patient.medical_history or MedicalHistory(patient_id=visit.patient_id)
    history.htn = bool(history_data.get("htn"))
    history.dm = bool(history_data.get("dm"))
    history.family_cad = bool(history_data.get("family_cad"))
    history.family_dm = bool(history_data.get("family_dm"))
    history.smoking = history_data.get("smoking") or "Never"
    history.dyslipidemia = bool(history_data.get("dyslipidemia"))
    history.previous_cva = bool(history_data.get("previous_cva"))
    history.surgery_history = history_data.get("surgery_history") or ""
    history.allergies = history_data.get("allergies") or ""
    history.other_history = history_data.get("other_history") or ""
    history.previous_pci = bool(history_data.get("previous_pci"))
    history.previous_cabg = bool(history_data.get("previous_cabg"))
    history.pci_details = history_data.get("pci_details") or ""
    history.cabg_details = history_data.get("cabg_details") or ""
    db.add(history)

    consult = visit.consultation or Consultation(visit_id=visit.id, complaints=empty_complaints(), examination=empty_exam(), diagnoses=[])
    consult.complaints = payload.get("complaints") or empty_complaints()
    consult.examination = payload.get("examination") or empty_exam()
    consult.diagnoses = payload.get("diagnoses") or []
    consult.notes = payload.get("notes") or ""
    consult.assessment = payload.get("assessment") or ""
    consult.updated_at = datetime.utcnow()
    db.add(consult)

    if payload.get("follow_up_date"):
        try:
            visit.follow_up_date = date.fromisoformat(payload["follow_up_date"])
        except ValueError:
            pass

    selected = payload.get("investigation_ids") or []
    existing = {item.investigation_type_id: item for item in visit.investigations}
    advised = False
    for inv_id in selected:
        inv_id = _int(inv_id)
        if not inv_id:
            continue
        if inv_id not in existing:
            db.add(PatientInvestigation(visit_id=visit.id, investigation_type_id=inv_id, status="REQUESTED"))
            advised = True
    keep = set(_int(i) for i in selected if _int(i))
    for inv_id, item in list(existing.items()):
        if inv_id not in keep and item.status == "REQUESTED" and not item.result_text:
            db.delete(item)
    db.flush()

    pending = (
        db.query(PatientInvestigation)
        .filter(PatientInvestigation.visit_id == visit.id, PatientInvestigation.status == "REQUESTED")
        .count()
    )
    if pending:
        visit.status = "AWAITING_LABS"
    elif visit.status in ("WAITING_DOCTOR", "WAITING_VITALS", "IN_CONSULTATION"):
        visit.status = "IN_CONSULTATION"
    log_action(db, user.id, "save_consultation", "visit", visit.id, "investigations_advised" if advised else "")
    db.commit()
    return {"ok": True, "status": visit.status}


@router.post("/prescription/{visit_id}")
async def save_prescription(visit_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("CARDIOLOGIST", "ADMIN"))):
    visit = db.get(Visit, visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    payload = await request.json()
    rx = visit.prescription or Prescription(visit_id=visit.id)
    rx.instructions_en = payload.get("instructions_en") or ""
    rx.instructions_ur = payload.get("instructions_ur") or ""
    rx.template_id = _int(payload.get("template_id"))
    rx.is_final = bool(payload.get("is_final"))
    db.add(rx)
    db.flush()
    db.query(PrescriptionItem).filter(PrescriptionItem.prescription_id == rx.id).delete()
    for item in payload.get("items") or []:
        name = (item.get("drug_name") or "").strip()
        if not name:
            continue
        drug_id = _int(item.get("drug_id"))
        if drug_id:
            drug = db.get(Drug, drug_id)
            if drug:
                drug.usage_count = (drug.usage_count or 0) + 1
        else:
            drug = Drug(
                name=name,
                generic_name=item.get("generic_name") or name,
                strength=item.get("strength") or "",
                default_dosage=item.get("dosage") or "1 tab",
                default_route=item.get("route") or "Oral",
                default_frequency=item.get("frequency") or "OD",
                default_duration=item.get("duration") or "Continuous",
                default_instructions=item.get("instructions") or "",
                is_custom=True,
                usage_count=1,
            )
            db.add(drug)
            db.flush()
            drug_id = drug.id
        db.add(
            PrescriptionItem(
                prescription_id=rx.id,
                drug_id=drug_id,
                drug_name=name,
                generic_name=item.get("generic_name") or name,
                strength=item.get("strength") or "",
                dosage=item.get("dosage") or "",
                route=item.get("route") or "Oral",
                frequency=item.get("frequency") or "",
                duration=item.get("duration") or "",
                instructions=item.get("instructions") or "",
            )
        )
    if payload.get("follow_up_date"):
        try:
            visit.follow_up_date = date.fromisoformat(payload["follow_up_date"])
        except ValueError:
            pass
    pending = (
        db.query(PatientInvestigation)
        .filter(PatientInvestigation.visit_id == visit.id, PatientInvestigation.status == "REQUESTED")
        .count()
    )
    if rx.is_final:
        visit.status = "AWAITING_LABS" if pending else "COMPLETED"
    log_action(db, user.id, "save_prescription", "visit", visit.id, "finalized" if rx.is_final else "draft")
    db.commit()
    return {"ok": True, "is_final": rx.is_final, "print_url": f"/print/rx/{visit.id}"}


@router.get("/drugs")
def search_drugs(q: str = "", db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(Drug).order_by(Drug.usage_count.desc(), Drug.name.asc())
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(Drug.name.ilike(like), Drug.generic_name.ilike(like)))
    rows = query.limit(25).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "generic_name": d.generic_name,
            "strength": d.strength,
            "default_dosage": d.default_dosage,
            "default_route": d.default_route,
            "default_frequency": d.default_frequency,
            "default_duration": d.default_duration,
            "default_instructions": d.default_instructions,
        }
        for d in rows
    ]


@router.post("/investigations/{item_id}")
async def save_investigation_result(
    item_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ATTENDANT", "CARDIOLOGIST", "ADMIN")),
):
    item = db.get(PatientInvestigation, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Investigation not found")
    payload = await request.json()
    item.result_text = payload.get("result_text") or ""
    if payload.get("complete") or item.result_text:
        item.status = "COMPLETED"
        item.completed_at = datetime.utcnow()
    log_action(db, user.id, "save_investigation", "investigation", item.id)
    pending = (
        db.query(PatientInvestigation)
        .filter(PatientInvestigation.visit_id == item.visit_id, PatientInvestigation.status == "REQUESTED")
        .count()
    )
    visit = item.visit
    if visit and visit.status == "AWAITING_LABS" and pending == 0:
        visit.status = "WAITING_DOCTOR"
    db.commit()
    return {"ok": True, "status": item.status}


@router.post("/investigations/{item_id}/upload")
async def upload_investigation_file(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ATTENDANT", "CARDIOLOGIST", "ADMIN")),
):
    item = db.get(PatientInvestigation, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Investigation not found")
    suffix = Path(file.filename or "result").suffix[:8]
    name = f"inv_{item.id}_{uuid4().hex[:8]}{suffix}"
    dest = UPLOAD_DIR / name
    dest.write_bytes(await file.read())
    item.result_file = name
    item.status = "COMPLETED"
    item.completed_at = datetime.utcnow()
    log_action(db, user.id, "save_investigation", "investigation", item.id, "file")
    db.commit()
    return {"ok": True, "url": f"/uploads/{name}"}


@router.post("/settings")
async def save_settings(request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("ADMIN"))):
    payload = await request.json()
    for key, value in payload.items():
        row = db.query(ClinicSetting).filter(ClinicSetting.key == key).first()
        if row:
            row.value = "" if value is None else str(value)
            row.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/settings/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN")),
):
    suffix = Path(file.filename or "logo.png").suffix[:8] or ".png"
    name = f"logo_{uuid4().hex[:8]}{suffix}"
    dest = UPLOAD_DIR / name
    dest.write_bytes(await file.read())
    row = db.query(ClinicSetting).filter(ClinicSetting.key == "logo_path").first()
    if row:
        row.value = name
        row.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "url": f"/uploads/{name}"}


@router.post("/staff")
async def create_staff(request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("ADMIN"))):
    payload = await request.json()
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    staff = User(
        username=username,
        password_hash=hash_password(password),
        full_name=(payload.get("full_name") or username).strip(),
        role=payload.get("role") or "RECEPTION",
        branch_id=user.branch_id or 1,
        is_active=True,
    )
    db.add(staff)
    db.commit()
    return {"ok": True, "id": staff.id}


@router.post("/staff/{user_id}")
async def update_staff(user_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("ADMIN"))):
    staff = db.get(User, user_id)
    if not staff:
        raise HTTPException(status_code=404, detail="User not found")
    payload = await request.json()
    if payload.get("full_name"):
        staff.full_name = payload["full_name"].strip()
    if payload.get("role"):
        staff.role = payload["role"]
    if "is_active" in payload:
        staff.is_active = bool(payload["is_active"])
    if payload.get("password"):
        staff.password_hash = hash_password(payload["password"])
    db.commit()
    return {"ok": True}
