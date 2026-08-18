# Advanced Heart Center — Clinic Management System

A modern, cloud-ready cardiology clinic management application for **Advanced Heart Center, Saidu Sharif, Swat**.

Replace paper-based workflows with a fast, touch-friendly electronic system for reception, vitals, consultations, prescriptions, investigations, and research analytics.

## Features

- **Reception** — Register/search patients, generate unique IDs (AHC-YYYY-XXXX), assign cardiologist, create tokens
- **Vitals** — Quick BP, pulse, SpO₂, temperature, weight entry
- **Consultation** — Structured cardiology history, complaints (CCS/NYHA), examination, investigations, diagnoses
- **Prescription** — Searchable drug database, printable Rx with Urdu instructions
- **Follow-up** — Automatic previous record loading, chronological visit history
- **Investigations** — ECG, Echo, ETT, Holter, ABPM, labs; upload results
- **Analytics** — Disease prevalence, prescribing patterns, investigation stats
- **Role-based access** — Reception, attendant, cardiologist, admin
- **Responsive** — Works on Android phones and desktop PCs

This repository also keeps the MedCath Khata ledger as `medcath-khata.html` (open `/khata` while the clinic app is running).

The bundled `ahc_clinic.db` contains the live Advanced Heart Center records. Copy `.env.example` to `.env` before production use.

## Quick Start (Local)

### Requirements
- Python 3.10+

### Install & Run

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Or run `./start.sh` on Linux/macOS. On Windows, double-click `start.bat`.

Open **http://localhost:8000** in your browser.

### Demo Login Accounts

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Reception | reception | reception123 |
| Clinic Attendant | attendant | attendant123 |
| Cardiologist | dr_khan | doctor123 |

Other doctor accounts keep the passwords already stored in `ahc_clinic.db`. An admin can reset them from **Staff**.

**Change all passwords before production use.**

## Workflow

1. **Reception** registers patient → generates token
2. **Attendant** records vitals → sends to doctor queue
3. **Cardiologist** completes consultation → selects investigations → writes prescription
4. **Follow-up visits** automatically load previous history, medications, and investigations

## Cloud Deployment

For production with automatic backup and secure cloud database:

### Option 1: Railway / Render (Recommended)

1. Push code to GitHub
2. Create a PostgreSQL database on Railway or Render
3. Set environment variables:
   ```
   DATABASE_URL=postgresql://...
   SECRET_KEY=<long-random-string>
   ```
4. Deploy with start command:
   ```
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

### Option 2: VPS (Ubuntu)

```bash
sudo apt install python3-pip postgresql nginx
pip install -r requirements.txt
# Set DATABASE_URL to PostgreSQL
uvicorn app.main:app --host 127.0.0.1 --port 8000
# Configure nginx reverse proxy + SSL with certbot
```

### Database Migration

The app auto-creates tables on first run. For PostgreSQL, set `DATABASE_URL` before starting.

## Multi-Branch Expansion

The database schema includes a `branches` table. To add branches:

1. Insert new branch records via admin panel (future) or database
2. Assign users to branch IDs
3. Filter patient/visit queries by branch

## Security Notes

- Change `SECRET_KEY` in production
- Use HTTPS in production
- Change default demo passwords
- Regular PostgreSQL backups (cloud providers offer automatic backup)
- Uploaded investigation files stored in `uploads/` — backup this folder

## Project Structure

```
advanced-heart-center/
├── app/
│   ├── main.py          # FastAPI application
│   ├── routes.py        # All page routes & API
│   ├── models.py        # Database models
│   ├── auth.py          # Authentication
│   ├── constants.py     # Clinical form options
│   ├── seed.py          # Initial data seeding
│   ├── templates/       # HTML templates
│   └── static/          # CSS, JavaScript
├── uploads/             # Investigation report files
├── requirements.txt
└── start.bat
```

## License

Proprietary — Advanced Heart Center, Saidu Sharif, Swat.
