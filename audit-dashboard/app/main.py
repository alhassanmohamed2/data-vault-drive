"""FastAPI Backend, Authentication & Real-Time Nextcloud + PostgreSQL Forensics Engine."""

from __future__ import annotations

import asyncio
import csv
import hashlib
import hmac
import io
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Query, Response
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.database import AuditDatabase
from app.parser import parse_audit_line
from app.pg_resolver import NextcloudPostgresResolver

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("shehata-audit")

DB_PATH = os.getenv("AUDIT_DB_PATH", "/data/audit_events.db")
AUDIT_LOG_PATH = os.getenv("AUDIT_LOG_PATH", "/var/log/nextcloud/audit.log")
MASS_DELETE_THRESHOLD = int(os.getenv("AUDIT_MASS_DELETE_THRESHOLD", "15"))
WEBHOOK_ALERT_URL = os.getenv("WEBHOOK_ALERT_URL", "").strip()

AUDIT_ADMIN_USER = os.getenv("AUDIT_ADMIN_USER", "admin").strip()
AUDIT_ADMIN_PASSWORD = os.getenv("AUDIT_ADMIN_PASSWORD", "ChangeMe_StrongAdminPass_2026!").strip()
AUDIT_SECRET_KEY = os.getenv("AUDIT_ADMIN_TOKEN", "shehata-audit-secret-2026").strip()

db = AuditDatabase(db_path=DB_PATH, mass_delete_threshold=MASS_DELETE_THRESHOLD)
pg_resolver = NextcloudPostgresResolver()


def create_session_token(username: str) -> str:
    """Create an HMAC-SHA256 signed session token valid for 24 hours."""
    exp = int(time.time()) + 86400
    payload = f"{username}:{exp}"
    sig = hmac.new(AUDIT_SECRET_KEY.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def verify_session_token(token: Optional[str]) -> Optional[str]:
    """Verify HMAC-SHA256 signed token and return username if valid."""
    if not token:
        return None
    parts = token.split(":")
    if len(parts) != 3:
        return None
    username, exp_str, sig = parts
    try:
        exp = int(exp_str)
    except ValueError:
        return None
    if time.time() > exp:
        return None
    expected_payload = f"{username}:{exp_str}"
    expected_sig = hmac.new(
        AUDIT_SECRET_KEY.encode("utf-8"),
        expected_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if hmac.compare_digest(sig, expected_sig):
        return username
    return None


def require_audit_auth(
    shehata_audit_session: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
    token: Optional[str] = Query(default=None),
) -> str:
    """Require valid session cookie, Bearer token, or query token on protected API routes."""
    candidate = shehata_audit_session
    if not candidate and authorization and authorization.lower().startswith("bearer "):
        candidate = authorization[7:].strip()
    if not candidate and token:
        candidate = token.strip()

    user = verify_session_token(candidate)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


async def send_webhook_alert(record: Dict[str, Any]) -> None:
    """Send real-time security alert if WEBHOOK_ALERT_URL is configured."""
    if not WEBHOOK_ALERT_URL or not record.get("is_anomaly"):
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                WEBHOOK_ALERT_URL,
                json={
                    "service": "Company Files Vault Audit Center",
                    "alert": record.get("anomaly_reason"),
                    "severity": record.get("severity"),
                    "actor": record.get("actor"),
                    "action": record.get("action_type"),
                    "file_path": record.get("file_path"),
                    "ip_address": record.get("ip_address"),
                    "timestamp": record.get("timestamp"),
                },
            )
    except Exception as exc:
        logger.warning("Failed to dispatch webhook alert: %s", exc)


async def tail_nextcloud_audit_log(log_path: str) -> None:
    """Cleanly re-parse existing audit.log with PostgreSQL WOPI attribution, then tail live."""
    offset = 0
    last_inode = None
    logger.info("Initializing Nextcloud audit.log & PostgreSQL WOPI resolver on %s", log_path)

    db.clear_all_events()

    while True:
        try:
            if os.path.exists(log_path):
                stat = os.stat(log_path)
                if last_inode != stat.st_ino or stat.st_size < offset:
                    offset = 0
                    last_inode = stat.st_ino

                if stat.st_size > offset:
                    with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                        f.seek(offset)
                        for line in f:
                            parsed = parse_audit_line(line, pg_resolver=pg_resolver)
                            if parsed:
                                inserted = db.insert_event(parsed)
                                if inserted and inserted.get("is_anomaly"):
                                    asyncio.create_task(send_webhook_alert(inserted))
                        offset = f.tell()
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Error reading audit log: %s", exc)

        await asyncio.sleep(1.2)


@asynccontextmanager
async def lifespan(app: FastAPI):
    tail_task = asyncio.create_task(tail_nextcloud_audit_log(AUDIT_LOG_PATH))
    yield
    tail_task.cancel()


app = FastAPI(
    title="Company Files Vault — Enterprise Audit & Activity API",
    description="FastAPI + React real-time file edit versioning, PostgreSQL WOPI attribution, and user activity tracking.",
    version="2.1.0",
    lifespan=lifespan,
)

STATIC_DIR = Path(__file__).parent / "static"
ASSETS_DIR = STATIC_DIR / "assets"
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


class LoginRequest(BaseModel):
    username: str
    password: str


class IngestLogPayload(BaseModel):
    raw_lines: List[str]


@app.get("/health")
def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "version": "2.1.0",
        "audit_log_path": AUDIT_LOG_PATH,
        "audit_log_exists": os.path.exists(AUDIT_LOG_PATH),
        "postgres_connected": pg_resolver.is_connected(),
        "auth_enabled": True,
        "db_path": DB_PATH,
    }


@app.post("/api/auth/login")
def login(payload: LoginRequest, response: Response) -> Dict[str, Any]:
    user_ok = hmac.compare_digest(payload.username.strip(), AUDIT_ADMIN_USER)
    pass_ok = hmac.compare_digest(payload.password, AUDIT_ADMIN_PASSWORD)
    if not (user_ok and pass_ok):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_session_token(AUDIT_ADMIN_USER)
    response.set_cookie(
        key="shehata_audit_session",
        value=token,
        httponly=True,
        max_age=86400,
        samesite="lax",
        path="/",
    )
    return {
        "authenticated": True,
        "username": AUDIT_ADMIN_USER,
        "token": token,
    }


@app.post("/api/auth/logout")
def logout(response: Response) -> Dict[str, Any]:
    response.delete_cookie(key="shehata_audit_session", path="/")
    return {"authenticated": False}


@app.get("/api/auth/me")
def auth_me(current_user: str = Depends(require_audit_auth)) -> Dict[str, Any]:
    return {"authenticated": True, "username": current_user}


@app.get("/api/stats")
def get_stats(current_user: str = Depends(require_audit_auth)) -> Dict[str, Any]:
    stats = db.get_summary_stats()
    stats["system"] = {
        "postgres_connected": pg_resolver.is_connected(),
        "audit_log_active": os.path.exists(AUDIT_LOG_PATH),
        "registered_users": pg_resolver.get_nextcloud_users(),
        "authenticated_admin": current_user,
    }
    return stats


@app.get("/api/events")
def list_events(
    actor: Optional[str] = Query(None),
    action_type: Optional[str] = Query(None),
    file_query: Optional[str] = Query(None),
    ip_address: Optional[str] = Query(None),
    client_source: Optional[str] = Query(None),
    anomalies_only: bool = Query(False),
    exclude_views: bool = Query(False),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    limit: int = Query(150, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    _user: str = Depends(require_audit_auth),
) -> Dict[str, Any]:
    return db.query_events(
        actor=actor,
        action_type=action_type,
        file_query=file_query,
        ip_address=ip_address,
        client_source=client_source,
        anomalies_only=anomalies_only,
        exclude_views=exclude_views,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
        offset=offset,
    )


@app.get("/api/file-timeline")
def file_timeline(
    path: str = Query(..., description="File path to inspect"),
    _user: str = Depends(require_audit_auth),
) -> Dict[str, Any]:
    if not path.strip():
        raise HTTPException(status_code=400, detail="File path is required")
    return db.get_file_timeline(path.strip(), pg_resolver=pg_resolver)


@app.get("/api/user-profile")
def user_profile(
    actor: str = Query(..., description="Username to inspect"),
    _user: str = Depends(require_audit_auth),
) -> Dict[str, Any]:
    if not actor.strip():
        raise HTTPException(status_code=400, detail="Username is required")
    return db.get_user_profile(actor.strip())


@app.post("/api/resync")
def resync_audit_log(_user: str = Depends(require_audit_auth)) -> Dict[str, Any]:
    """Re-parse the entire Nextcloud audit.log with fresh PostgreSQL WOPI token attribution."""
    db.clear_all_events()
    count = 0
    if os.path.exists(AUDIT_LOG_PATH):
        with open(AUDIT_LOG_PATH, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                parsed = parse_audit_line(line, pg_resolver=pg_resolver)
                if parsed and db.insert_event(parsed):
                    count += 1
    return {"status": "resynced", "events_indexed": count}


@app.post("/api/events/ingest")
async def ingest_raw_lines(
    payload: IngestLogPayload,
    _user: str = Depends(require_audit_auth),
) -> Dict[str, Any]:
    inserted_count = 0
    anomalies_count = 0
    for line in payload.raw_lines:
        parsed = parse_audit_line(line, pg_resolver=pg_resolver)
        if parsed:
            rec = db.insert_event(parsed)
            if rec:
                inserted_count += 1
                if rec.get("is_anomaly"):
                    anomalies_count += 1
                    await send_webhook_alert(rec)
    return {"inserted": inserted_count, "anomalies_triggered": anomalies_count}


@app.post("/api/demo/seed")
def seed_demo_data(_user: str = Depends(require_audit_auth)) -> Dict[str, Any]:
    """Seed realistic sample file edits, Collabora co-editing, renames, shares, and security events."""
    now = datetime.now(timezone.utc)
    sample_logs = [
        {
            "reqId": "demo-02",
            "time": (now - timedelta(hours=4, minutes=50)).isoformat(),
            "remoteAddr": "197.55.12.10",
            "user": "alhassan",
            "method": "PUT",
            "url": "/remote.php/dav/files/alhassan/Engineering/Architecture_Draft.docx",
            "message": 'File with id "901" created: "/alhassan/files/Engineering/Architecture_Draft.docx"',
            "userAgent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0.0.0",
        },
        {
            "reqId": "demo-03",
            "time": (now - timedelta(hours=4, minutes=20)).isoformat(),
            "remoteAddr": "197.55.12.10",
            "user": "alhassan",
            "method": "POST",
            "url": "/ocs/v2.php/apps/files_sharing/api/v1/shares",
            "message": 'Shared file "/Engineering/Architecture_Draft.docx" with user "sara" with permissions "31"',
            "userAgent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0.0.0",
        },
        {
            "reqId": "demo-04",
            "time": (now - timedelta(hours=3, minutes=45)).isoformat(),
            "remoteAddr": "41.234.88.19",
            "user": "sara",
            "method": "POST",
            "url": "/index.php/apps/richdocuments/wopi/files/901/contents",
            "message": 'File with id "901" written to: "/alhassan/files/Engineering/Architecture_Draft.docx"',
            "userAgent": "COOLWSD HTTP Agent 26.04.6.1",
        },
        {
            "reqId": "demo-05",
            "time": (now - timedelta(hours=3, minutes=10)).isoformat(),
            "remoteAddr": "156.204.11.77",
            "user": "omar",
            "method": "POST",
            "url": "/index.php/apps/richdocuments/wopi/files/901/contents",
            "message": 'File with id "901" written to: "/alhassan/files/Engineering/Architecture_Draft.docx"',
            "userAgent": "COOLWSD HTTP Agent 26.04.6.1",
        },
        {
            "reqId": "demo-06",
            "time": (now - timedelta(hours=2, minutes=30)).isoformat(),
            "remoteAddr": "197.55.12.10",
            "user": "alhassan",
            "method": "MOVE",
            "url": "/remote.php/dav/files/alhassan/Engineering/Architecture_Draft.docx",
            "message": 'File renamed from "/alhassan/files/Engineering/Architecture_Draft.docx" to "/alhassan/files/Engineering/System_Architecture_v2.docx"',
            "userAgent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0.0.0",
        },
        {
            "reqId": "demo-07",
            "time": (now - timedelta(hours=1, minutes=55)).isoformat(),
            "remoteAddr": "41.234.88.19",
            "user": "sara",
            "method": "PUT",
            "url": "/remote.php/dav/files/sara/Engineering/System_Architecture_v2.docx",
            "message": 'File with id "901" written to: "/alhassan/files/Engineering/System_Architecture_v2.docx"',
            "userAgent": "Mozilla/5.0 (Linux) mirall/3.14.0 (Nextcloud-desktop)",
        },
    ]

    inserted = 0
    for item in sample_logs:
        parsed = parse_audit_line(json.dumps(item), pg_resolver=pg_resolver)
        if parsed and db.insert_event(parsed):
            inserted += 1

    return {"seeded_events": inserted}


@app.get("/api/export/csv")
def export_csv(
    actor: Optional[str] = Query(None),
    action_type: Optional[str] = Query(None),
    file_query: Optional[str] = Query(None),
    anomalies_only: bool = Query(False),
    exclude_views: bool = Query(False),
    _user: str = Depends(require_audit_auth),
) -> StreamingResponse:
    result = db.query_events(
        actor=actor,
        action_type=action_type,
        file_query=file_query,
        anomalies_only=anomalies_only,
        exclude_views=exclude_views,
        limit=5000,
    )
    output = io.StringIO()
    output.write("\ufeff")  # UTF-8 BOM for Arabic Excel compatibility
    writer = csv.writer(output)
    writer.writerow(
        [
            "المعرف",
            "التاريخ والوقت (UTC)",
            "المستخدم (من)",
            "نوع العملية (ماذا فعل)",
            "معرف الملف",
            "مسار الملف",
            "المسار السابق",
            "رقم الإصدار",
            "أداة التعديل / البرنامج",
            "عنوان IP",
            "جهة المشاركة",
            "الأهمية",
            "تنبيه أمني",
            "سبب التنبيه",
            "التفاصيل الأصلية",
        ]
    )
    for ev in result["events"]:
        writer.writerow(
            [
                ev["id"],
                ev["timestamp"],
                ev["actor"],
                ev["action_type"],
                ev.get("file_id") or "",
                ev.get("file_path") or "",
                ev.get("previous_path") or "",
                ev.get("version_number") or "",
                ev.get("client_source") or "",
                ev.get("ip_address") or "",
                ev.get("share_target") or "",
                ev.get("severity") or "INFO",
                "YES" if ev.get("is_anomaly") else "NO",
                ev.get("anomaly_reason") or "",
                ev.get("raw_message") or "",
            ]
        )
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="company_files_vault_audit_export.csv"'},
    )


@app.get("/api/export/json")
def export_json(
    actor: Optional[str] = Query(None),
    action_type: Optional[str] = Query(None),
    file_query: Optional[str] = Query(None),
    anomalies_only: bool = Query(False),
    exclude_views: bool = Query(False),
    _user: str = Depends(require_audit_auth),
) -> JSONResponse:
    result = db.query_events(
        actor=actor,
        action_type=action_type,
        file_query=file_query,
        anomalies_only=anomalies_only,
        exclude_views=exclude_views,
        limit=5000,
    )
    return JSONResponse(
        content=result,
        headers={"Content-Disposition": 'attachment; filename="company_files_vault_audit_export.json"'},
    )


@app.get("/")
def serve_dashboard():
    return FileResponse(STATIC_DIR / "index.html")
