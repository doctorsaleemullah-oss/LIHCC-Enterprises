from datetime import date, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user, get_current_user_optional, require_roles
from app.config import get_settings
from app.constants import (
    CCS_CLASSES,
    CHEST_PAIN_CLASSES,
    CNS_FINDINGS,
    CVS_FINDINGS,
    DIAGNOSES,
    DOSAGES,
    DURATIONS,
    FREQUENCIES,
    GENDERS,
    GIT_FINDINGS,
    NAV_ITEMS,
    NYHA_CLASSES,
    OTHER_SYMPTOMS,
    RESP_FINDINGS,
    ROLE_HOME,
    ROUTES,
    SMOKING_OPTIONS,
    VISIT_STATUS_LABELS,
    VISIT_TYPES,
)
from app.database import get_db
from app.helpers import (
    bmi,
    clinic_map,
    diagnoses_text,
    empty_complaints,
    empty_exam,
    parse_json,
    previous_visit,
    render_prescription,
)
from app.models import (
    ClinicSetting,
    Drug,
    InvestigationType,
    Patient,
    PatientInvestigation,
    PrescriptionTemplate,
    User,
    Visit,
)

router = APIRouter()
settings = get_settings()


def _templates():
    from app.main import templates

    return templates


def render(request: Request, name: str, user: User, db: Session, **context):
    cfg = clinic_map(db)
    nav = [item for item in NAV_ITEMS if user.role in item["roles"]]
    return _templates().TemplateResponse(
        name,
        {
            "request": request,
            "user": user,
            "clinic": cfg,
            "clinic_name": cfg.get("clinic_name", settings.branch_name),
            "clinic_subtitle": cfg.get("clinic_subtitle", "Saidu Sharif, Swat"),
            "nav_items": nav,
            "home": ROLE_HOME.get(user.role, "/dashboard"),
            **context,
        },
    )


@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request, db: Session = Depends(get_db), user=Depends(get_current_user_optional)):
    if user:
        return RedirectResponse(ROLE_HOME.get(user.role, "/dashboard"), status_code=303)
    cfg = clinic_map(db)
    return _templates().TemplateResponse(
        "login.html",
        {
            "request": request,
            "clinic_name": cfg.get("clinic_name", settings.branch_name),
            "clinic_subtitle": cfg.get("clinic_subtitle", "Saidu Sharif, Swat"),
            "error": request.query_params.get("error"),
        },
    )


@router.get("/logout")
def logout():
    response = RedirectResponse("/login", status_code=303)
    response.delete_cookie(settings.cookie_name)
    return response


@router.get("/", response_class=HTMLResponse)
def root(user: User = Depends(get_current_user)):
    return RedirectResponse(ROLE_HOME.get(user.role, "/dashboard"), status_code=303)


@router.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()
    q = db.query(Visit).options(joinedload(Visit.patient), joinedload(Visit.cardiologist), joinedload(Visit.vitals))
    today_visits = q.filter(Visit.visit_date == today).order_by(Visit.token_number.asc()).all()
    if user.role == "CARDIOLOGIST":
        queue = [v for v in today_visits if v.cardiologist_id == user.id]
    else:
        queue = today_visits
    counts = {
        "today": len(today_visits),
        "vitals": sum(1 for v in today_visits if v.status == "WAITING_VITALS"),
        "doctor": sum(1 for v in today_visits if v.status in ("WAITING_DOCTOR", "IN_CONSULTATION")),
        "labs": sum(1 for v in today_visits if v.status == "AWAITING_LABS"),
        "done": sum(1 for v in today_visits if v.status == "COMPLETED"),
        "patients": db.query(func.count(Patient.id)).scalar() or 0,
    }
    recent = (
        db.query(Visit)
        .options(joinedload(Visit.patient), joinedload(Visit.cardiologist))
        .order_by(Visit.id.desc())
        .limit(8)
        .all()
    )
    return render(
        request,
        "dashboard.html",
        user,
        db,
        today=today,
        queue=queue,
        counts=counts,
        recent=recent,
        page="dashboard",
    )


@router.get("/reception", response_class=HTMLResponse)
def reception(request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("RECEPTION", "ADMIN"))):
    doctors = db.query(User).filter(User.role == "CARDIOLOGIST", User.is_active.is_(True)).order_by(User.full_name).all()
    today = date.today()
    tokens = (
        db.query(Visit)
        .options(joinedload(Visit.patient), joinedload(Visit.cardiologist))
        .filter(Visit.visit_date == today)
        .order_by(Visit.token_number.asc())
        .all()
    )
    return render(
        request,
        "reception.html",
        user,
        db,
        doctors=doctors,
        tokens=tokens,
        genders=GENDERS,
        visit_types=VISIT_TYPES,
        today=today.isoformat(),
        page="reception",
    )


@router.get("/vitals", response_class=HTMLResponse)
def vitals_page(request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("ATTENDANT", "CARDIOLOGIST", "ADMIN"))):
    today = date.today()
    visits = (
        db.query(Visit)
        .options(joinedload(Visit.patient), joinedload(Visit.vitals), joinedload(Visit.cardiologist))
        .filter(Visit.visit_date == today)
        .order_by(Visit.token_number.asc())
        .all()
    )
    waiting = [v for v in visits if v.status == "WAITING_VITALS" or v.vitals is None]
    return render(request, "vitals.html", user, db, visits=visits, waiting=waiting, bmi=bmi, page="vitals")


@router.get("/consultation", response_class=HTMLResponse)
def consultation_queue(request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("CARDIOLOGIST", "ADMIN"))):
    today = date.today()
    q = (
        db.query(Visit)
        .options(joinedload(Visit.patient), joinedload(Visit.vitals), joinedload(Visit.cardiologist))
        .filter(Visit.visit_date >= today - timedelta(days=2))
        .order_by(Visit.visit_date.desc(), Visit.token_number.asc())
    )
    visits = q.all()
    if user.role == "CARDIOLOGIST":
        visits = [v for v in visits if v.cardiologist_id == user.id]
    open_visits = [v for v in visits if v.status != "COMPLETED"]
    return render(request, "consultation_queue.html", user, db, visits=open_visits, all_visits=visits, page="consultation")


@router.get("/consultation/{visit_id}", response_class=HTMLResponse)
def consultation_form(visit_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("CARDIOLOGIST", "ADMIN"))):
    visit = (
        db.query(Visit)
        .options(
            joinedload(Visit.patient),
            joinedload(Visit.vitals),
            joinedload(Visit.consultation),
            joinedload(Visit.prescription),
            joinedload(Visit.investigations).joinedload(PatientInvestigation.inv_type),
            joinedload(Visit.cardiologist),
        )
        .filter(Visit.id == visit_id)
        .first()
    )
    if not visit:
        return RedirectResponse("/consultation", status_code=303)
    if user.role == "CARDIOLOGIST" and visit.cardiologist_id != user.id:
        return RedirectResponse("/consultation", status_code=303)

    consult = visit.consultation
    complaints = parse_json(consult.complaints, empty_complaints()) if consult else empty_complaints()
    examination = parse_json(consult.examination, empty_exam()) if consult else empty_exam()
    diagnoses = parse_json(consult.diagnoses, []) if consult else []
    if isinstance(diagnoses, str):
        diagnoses = [diagnoses] if diagnoses else []

    history = visit.patient.medical_history
    prev = previous_visit(db, visit.patient_id, visit.id)
    prev_dx = diagnoses_text(prev.consultation) if prev and prev.consultation else ""
    prev_rx = []
    if prev and prev.prescription:
        prev_rx = prev.prescription.items

    inv_types = db.query(InvestigationType).filter(InvestigationType.is_active.is_(True)).order_by(InvestigationType.category, InvestigationType.name).all()
    selected_inv = {item.investigation_type_id for item in visit.investigations}
    templates_rx = db.query(PrescriptionTemplate).filter(PrescriptionTemplate.is_active.is_(True)).order_by(PrescriptionTemplate.id).all()
    default_tpl = next((t for t in templates_rx if t.is_default), templates_rx[0] if templates_rx else None)
    assessment_opts = [s.strip() for s in (clinic_map(db).get("assessment_options") or "Improving, Deteriorating, Static").split(",") if s.strip()]

    rx_items = visit.prescription.items if visit.prescription else []
    if not rx_items and prev_rx:
        rx_items = prev_rx  # follow-up prefill in template only as previous; JS can copy

    grouped_inv = {}
    for inv in inv_types:
        grouped_inv.setdefault(inv.category, []).append(inv)

    return render(
        request,
        "consultation.html",
        user,
        db,
        visit=visit,
        complaints=complaints,
        examination=examination,
        diagnoses=diagnoses,
        history=history,
        prev=prev,
        prev_dx=prev_dx,
        prev_rx=prev_rx,
        grouped_inv=grouped_inv,
        selected_inv=selected_inv,
        templates_rx=templates_rx,
        default_tpl=default_tpl,
        assessment_opts=assessment_opts,
        smoking_options=SMOKING_OPTIONS,
        chest_pain_classes=CHEST_PAIN_CLASSES,
        ccs_classes=CCS_CLASSES,
        nyha_classes=NYHA_CLASSES,
        other_symptoms=OTHER_SYMPTOMS,
        cvs_findings=CVS_FINDINGS,
        resp_findings=RESP_FINDINGS,
        cns_findings=CNS_FINDINGS,
        git_findings=GIT_FINDINGS,
        diagnosis_options=DIAGNOSES,
        frequencies=FREQUENCIES,
        routes=ROUTES,
        durations=DURATIONS,
        dosages=DOSAGES,
        rx_items=list(visit.prescription.items) if visit.prescription else [],
        page="consultation",
        bmi=bmi,
    )


@router.get("/patients", response_class=HTMLResponse)
def patients_page(
    request: Request,
    q: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Patient).order_by(Patient.id.desc())
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            (Patient.name.ilike(like))
            | (Patient.patient_code.ilike(like))
            | (Patient.phone.ilike(like))
            | (Patient.cnic.ilike(like))
        )
    rows = query.limit(80).all()
    return render(request, "patients.html", user, db, patients=rows, q=q, page="patients")


@router.get("/patients/{patient_id}", response_class=HTMLResponse)
def patient_detail(patient_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    patient = db.get(Patient, patient_id)
    if not patient:
        return RedirectResponse("/patients", status_code=303)
    visits = (
        db.query(Visit)
        .options(
            joinedload(Visit.cardiologist),
            joinedload(Visit.vitals),
            joinedload(Visit.consultation),
            joinedload(Visit.prescription),
        )
        .filter(Visit.patient_id == patient_id)
        .order_by(Visit.id.desc())
        .all()
    )
    return render(
        request,
        "patient_detail.html",
        user,
        db,
        patient=patient,
        visits=visits,
        diagnoses_text=diagnoses_text,
        parse_json=parse_json,
        page="patients",
    )


@router.get("/investigations", response_class=HTMLResponse)
def investigations_page(
    request: Request,
    status: str = "REQUESTED",
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ATTENDANT", "CARDIOLOGIST", "ADMIN")),
):
    q = (
        db.query(PatientInvestigation)
        .options(
            joinedload(PatientInvestigation.inv_type),
            joinedload(PatientInvestigation.visit).joinedload(Visit.patient),
        )
        .order_by(PatientInvestigation.id.desc())
    )
    if status and status != "ALL":
        q = q.filter(PatientInvestigation.status == status)
    items = q.limit(100).all()
    return render(request, "investigations.html", user, db, items=items, status=status, page="investigations")


@router.get("/analytics", response_class=HTMLResponse)
def analytics_page(request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("CARDIOLOGIST", "ADMIN"))):
    visits = db.query(Visit).options(joinedload(Visit.consultation), joinedload(Visit.prescription)).all()
    dx_counts: dict[str, int] = {}
    for visit in visits:
        if not visit.consultation:
            continue
        dx = parse_json(visit.consultation.diagnoses, [])
        if isinstance(dx, str):
            dx = [dx] if dx else []
        for name in dx:
            if name:
                dx_counts[name] = dx_counts.get(name, 0) + 1
    drug_rows = db.query(Drug).filter(Drug.usage_count > 0).order_by(Drug.usage_count.desc()).limit(15).all()
    inv_stats = (
        db.query(InvestigationType.name, func.count(PatientInvestigation.id))
        .join(PatientInvestigation, PatientInvestigation.investigation_type_id == InvestigationType.id)
        .group_by(InvestigationType.name)
        .order_by(func.count(PatientInvestigation.id).desc())
        .all()
    )
    status_counts = dict(
        db.query(Visit.status, func.count(Visit.id)).group_by(Visit.status).all()
    )
    return render(
        request,
        "analytics.html",
        user,
        db,
        dx_counts=sorted(dx_counts.items(), key=lambda x: -x[1]),
        drug_rows=drug_rows,
        inv_stats=inv_stats,
        status_counts=status_counts,
        total_visits=len(visits),
        total_patients=db.query(func.count(Patient.id)).scalar() or 0,
        page="analytics",
    )


@router.get("/settings", response_class=HTMLResponse)
def settings_page(request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("ADMIN"))):
    rows = db.query(ClinicSetting).order_by(ClinicSetting.category, ClinicSetting.id).all()
    grouped: dict[str, list] = {}
    for row in rows:
        grouped.setdefault(row.category, []).append(row)
    return render(request, "settings.html", user, db, grouped=grouped, page="settings")


@router.get("/staff", response_class=HTMLResponse)
def staff_page(request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("ADMIN"))):
    staff = db.query(User).order_by(User.id).all()
    return render(request, "staff.html", user, db, staff=staff, page="staff")


@router.get("/print/rx/{visit_id}", response_class=HTMLResponse)
def print_rx(visit_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    visit = (
        db.query(Visit)
        .options(
            joinedload(Visit.patient),
            joinedload(Visit.vitals),
            joinedload(Visit.consultation),
            joinedload(Visit.prescription),
            joinedload(Visit.investigations).joinedload(PatientInvestigation.inv_type),
            joinedload(Visit.cardiologist),
        )
        .filter(Visit.id == visit_id)
        .first()
    )
    if not visit:
        return HTMLResponse("Visit not found", status_code=404)
    return HTMLResponse(render_prescription(db, visit))


@router.get("/khata", response_class=HTMLResponse)
def khata():
    html = (Path(__file__).resolve().parent.parent / "medcath-khata.html").read_text(encoding="utf-8")
    return HTMLResponse(html)
