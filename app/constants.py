GENDERS = ["Male", "Female"]

VISIT_TYPES = [
    ("NEW", "New visit"),
    ("FOLLOW_UP", "Follow-up"),
]

VISIT_STATUS_LABELS = {
    "WAITING_VITALS": "Waiting vitals",
    "WAITING_DOCTOR": "Waiting doctor",
    "IN_CONSULTATION": "In consultation",
    "AWAITING_LABS": "Awaiting labs",
    "COMPLETED": "Completed",
}

SMOKING_OPTIONS = ["Never", "Former", "Current (Light)", "Current (Heavy)"]

CHEST_PAIN_CLASSES = [
    "Typical Angina",
    "Probable Angina",
    "Atypical Chest Pain",
    "Non-cardiac",
]

CCS_CLASSES = ["CCS I", "CCS II", "CCS III", "CCS IV"]
NYHA_CLASSES = ["NYHA I", "NYHA II", "NYHA III", "NYHA IV"]

OTHER_SYMPTOMS = [
    "Palpitations",
    "Dizziness/Vertigo",
    "Syncope",
    "Dyspepsia",
    "Body Aches",
    "Muscle Cramps",
    "Fever",
    "Polyuria",
    "Polydipsia",
    "Appetite Loss",
    "Cough",
    "Leg Swelling",
    "Fatigue",
]

CVS_FINDINGS = ["S1 S2 Normal", "Murmur", "Gallop", "Added Sounds"]
RESP_FINDINGS = ["Clear", "Crepts", "Wheeze", "Reduced Air Entry"]
CNS_FINDINGS = ["Normal", "Focal Deficit"]
GIT_FINDINGS = ["Soft", "Distended", "Tender"]

DIAGNOSES = [
    "Stable Angina",
    "Unstable Angina",
    "NSTEMI",
    "STEMI",
    "ACS",
    "Heart Failure (HFrEF)",
    "Heart Failure (HFpEF)",
    "Hypertension",
    "Hypertensive Heart Disease",
    "Atrial Fibrillation",
    "SVT",
    "Ventricular Arrhythmia",
    "Valvular Heart Disease",
    "Cardiomyopathy",
    "Post-PCI",
    "Post-CABG",
    "Dyslipidemia",
    "Diabetes Mellitus",
    "CKD",
    "Pulmonary Hypertension",
    "Pericardial Disease",
    "Heart Block",
]

FREQUENCIES = [
    "OD (Once daily)",
    "BD (Twice daily)",
    "TDS (Three times daily)",
    "QID",
    "HS (At night)",
    "SOS",
    "Weekly",
]

ROUTES = ["Oral", "Sublingual", "SC", "IV", "Inhalation", "Topical"]
DURATIONS = ["3 days", "5 days", "7 days", "14 days", "1 month", "3 months", "Continuous"]
DOSAGES = ["1/2 tab", "1 tab", "1.5 tab", "2 tab", "5 ml", "10 units", "As directed"]

ROLE_HOME = {
    "ADMIN": "/dashboard",
    "RECEPTION": "/reception",
    "ATTENDANT": "/vitals",
    "CARDIOLOGIST": "/dashboard",
}

NAV_ITEMS = [
    {"href": "/dashboard", "label": "Dashboard", "icon": "home", "roles": ["ADMIN", "RECEPTION", "ATTENDANT", "CARDIOLOGIST"]},
    {"href": "/reception", "label": "Reception", "icon": "desk", "roles": ["ADMIN", "RECEPTION"]},
    {"href": "/vitals", "label": "Vitals", "icon": "pulse", "roles": ["ADMIN", "ATTENDANT", "CARDIOLOGIST"]},
    {"href": "/consultation", "label": "Consultation", "icon": "steth", "roles": ["ADMIN", "CARDIOLOGIST"]},
    {"href": "/patients", "label": "Patients", "icon": "users", "roles": ["ADMIN", "RECEPTION", "ATTENDANT", "CARDIOLOGIST"]},
    {"href": "/investigations", "label": "Investigations", "icon": "lab", "roles": ["ADMIN", "ATTENDANT", "CARDIOLOGIST"]},
    {"href": "/analytics", "label": "Analytics", "icon": "chart", "roles": ["ADMIN", "CARDIOLOGIST"]},
    {"href": "/staff", "label": "Staff", "icon": "badge", "roles": ["ADMIN"]},
    {"href": "/settings", "label": "Settings", "icon": "gear", "roles": ["ADMIN"]},
]
