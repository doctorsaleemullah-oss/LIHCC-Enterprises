from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.utcnow()


class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)

    users = relationship("User", back_populates="branch")
    patients = relationship("Patient", back_populates="branch")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(12), nullable=False)
    branch_id: Mapped[int | None] = mapped_column(ForeignKey("branches.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)

    branch = relationship("Branch", back_populates="users")


class ClinicSetting(Base):
    __tablename__ = "clinic_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")
    label: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="clinic")
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    name_ur: Mapped[str] = mapped_column(String(150), default="")
    dob: Mapped[date | None] = mapped_column(Date)
    age: Mapped[int | None] = mapped_column(Integer)
    gender: Mapped[str] = mapped_column(String(20), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    cnic: Mapped[str] = mapped_column(String(20), index=True, nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(20), index=True, nullable=False, default="")
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    branch = relationship("Branch", back_populates="patients")
    visits = relationship("Visit", back_populates="patient", order_by="Visit.id.desc()")
    medical_history = relationship("MedicalHistory", back_populates="patient", uselist=False)


class MedicalHistory(Base):
    __tablename__ = "medical_histories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), unique=True, nullable=False)
    htn: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    dm: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    family_cad: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    family_dm: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    smoking: Mapped[str] = mapped_column(String(50), nullable=False, default="Never")
    dyslipidemia: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    previous_cva: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    surgery_history: Mapped[str] = mapped_column(Text, nullable=False, default="")
    allergies: Mapped[str] = mapped_column(Text, nullable=False, default="")
    other_history: Mapped[str] = mapped_column(Text, nullable=False, default="")
    previous_pci: Mapped[bool] = mapped_column(Boolean, default=False)
    previous_cabg: Mapped[bool] = mapped_column(Boolean, default=False)
    pci_details: Mapped[str] = mapped_column(String(200), default="")
    cabg_details: Mapped[str] = mapped_column(String(200), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    patient = relationship("Patient", back_populates="medical_history")


class Visit(Base):
    __tablename__ = "visits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True, nullable=False)
    cardiologist_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    visit_type: Mapped[str] = mapped_column(String(9), nullable=False, default="NEW")
    token_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    consultation_fee: Mapped[float] = mapped_column(Float, nullable=False, default=2000.0)
    status: Mapped[str] = mapped_column(String(15), nullable=False, default="WAITING_VITALS")
    visit_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    follow_up_date: Mapped[date | None] = mapped_column(Date)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)

    patient = relationship("Patient", back_populates="visits")
    cardiologist = relationship("User", foreign_keys=[cardiologist_id])
    creator = relationship("User", foreign_keys=[created_by])
    vitals = relationship("Vitals", back_populates="visit", uselist=False)
    consultation = relationship("Consultation", back_populates="visit", uselist=False)
    prescription = relationship("Prescription", back_populates="visit", uselist=False)
    investigations = relationship("PatientInvestigation", back_populates="visit")


class Vitals(Base):
    __tablename__ = "vitals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"), unique=True, nullable=False)
    bp_systolic: Mapped[int | None] = mapped_column(Integer)
    bp_diastolic: Mapped[int | None] = mapped_column(Integer)
    pulse: Mapped[int | None] = mapped_column(Integer)
    spo2: Mapped[int | None] = mapped_column(Integer)
    temperature: Mapped[float | None] = mapped_column(Float)
    weight: Mapped[float | None] = mapped_column(Float)
    height: Mapped[float | None] = mapped_column(Float)
    recorded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)

    visit = relationship("Visit", back_populates="vitals")
    recorder = relationship("User")


class Consultation(Base):
    __tablename__ = "consultations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"), unique=True, nullable=False)
    complaints: Mapped[dict | list] = mapped_column(JSON, nullable=False, default=dict)
    examination: Mapped[dict | list] = mapped_column(JSON, nullable=False, default=dict)
    diagnoses: Mapped[dict | list] = mapped_column(JSON, nullable=False, default=list)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    assessment: Mapped[str] = mapped_column(String(80), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    visit = relationship("Visit", back_populates="consultation")


class Drug(Base):
    __tablename__ = "drugs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    generic_name: Mapped[str] = mapped_column(String(150), default="")
    strength: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    default_dosage: Mapped[str] = mapped_column(String(50), nullable=False, default="1 tab")
    default_route: Mapped[str] = mapped_column(String(30), nullable=False, default="Oral")
    default_frequency: Mapped[str] = mapped_column(String(50), nullable=False, default="OD")
    default_duration: Mapped[str] = mapped_column(String(50), nullable=False, default="Continuous")
    default_instructions: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_custom: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"), unique=True, nullable=False)
    instructions_en: Mapped[str] = mapped_column(Text, nullable=False, default="")
    instructions_ur: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    template_id: Mapped[int | None] = mapped_column(Integer)
    is_final: Mapped[bool] = mapped_column(Boolean, default=False)

    visit = relationship("Visit", back_populates="prescription")
    items = relationship("PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan")


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    prescription_id: Mapped[int] = mapped_column(ForeignKey("prescriptions.id"), nullable=False)
    drug_id: Mapped[int | None] = mapped_column(ForeignKey("drugs.id"))
    drug_name: Mapped[str] = mapped_column(String(150), nullable=False)
    generic_name: Mapped[str] = mapped_column(String(150), default="")
    strength: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    dosage: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    route: Mapped[str] = mapped_column(String(30), nullable=False, default="Oral")
    frequency: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    duration: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    instructions: Mapped[str] = mapped_column(String(200), nullable=False, default="")

    prescription = relationship("Prescription", back_populates="items")
    drug = relationship("Drug")


class PrescriptionTemplate(Base):
    __tablename__ = "prescription_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    html_content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    css_content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class InvestigationType(Base):
    __tablename__ = "investigation_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="lab")
    is_custom: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class PatientInvestigation(Base):
    __tablename__ = "patient_investigations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"), index=True, nullable=False)
    investigation_type_id: Mapped[int] = mapped_column(ForeignKey("investigation_types.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(11), nullable=False, default="REQUESTED")
    result_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    result_file: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    requested_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)

    visit = relationship("Visit", back_populates="investigations")
    inv_type = relationship("InvestigationType")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer)
    details: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)

    user = relationship("User")
