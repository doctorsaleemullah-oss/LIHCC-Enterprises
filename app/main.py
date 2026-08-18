from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app import models  # noqa: F401 — register metadata
from app.config import get_settings
from app.constants import NAV_ITEMS, VISIT_STATUS_LABELS
from app.database import Base, SessionLocal, engine
from app.seed import seed_if_empty

settings = get_settings()
ROOT = Path(__file__).resolve().parent.parent
UPLOAD_DIR = ROOT / settings.upload_dir
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))
templates.env.globals["NAV_ITEMS"] = NAV_ITEMS
templates.env.globals["STATUS_LABELS"] = VISIT_STATUS_LABELS


def create_app() -> FastAPI:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()

    app = FastAPI(title="Advanced Heart Center", docs_url="/api/docs", redoc_url=None)

    from app.api import router as api_router
    from app.routes import router as pages_router

    app.include_router(pages_router)
    app.include_router(api_router)

    static_dir = Path(__file__).parent / "static"
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
    app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        accept = request.headers.get("accept", "")
        is_api = request.url.path.startswith("/api")
        wants_json = "application/json" in accept and "text/html" not in accept
        if not is_api and not wants_json:
            if exc.status_code == 401:
                return RedirectResponse("/login", status_code=303)
            if exc.status_code == 403:
                return HTMLResponse(
                    "<p>This page is not available for your role. <a href='/'>Go back</a></p>",
                    status_code=403,
                )
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)

    return app


app = create_app()
