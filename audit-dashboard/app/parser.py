"""Parser for Nextcloud 30 admin_audit JSON logs and WOPI/Collabora edit events."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.parse import parse_qs, unquote, urlparse

# Regex patterns for Nextcloud 28/29/30 admin_audit messages
RE_RENAME = re.compile(
    r'(?:renamed|moved)\s+from\s+"([^"]+)"\s+to\s+"([^"]+)"',
    re.IGNORECASE,
)
RE_SHARE_USER = re.compile(
    r'shared\s+(?:file|folder)?\s*"?([^"]*)"?\s+with\s+(?:user|group)\s+"([^"]+)"',
    re.IGNORECASE,
)
RE_SHARE_LINK = re.compile(
    r'shared\s+(?:file|folder)?\s*"?([^"]*)"?\s+(?:via|by)\s+(?:public\s+)?link',
    re.IGNORECASE,
)
RE_FILE_ID_MSG = re.compile(r'File\s+with\s+id\s+"(\d+)"', re.IGNORECASE)
RE_WOPI_FILE_ID = re.compile(r"/wopi/files/(\d+)(?:_[^/]+)?", re.IGNORECASE)
RE_LOGIN_USER = re.compile(r'Login\s+(?:attempt|failed|successful):\s*"([^"]+)"', re.IGNORECASE)
RE_QUOTED_PATH = re.compile(r'"(/[^"]*)"')
RE_DAV_PATH = re.compile(r"/remote\.php/(?:dav/files/[^/]+|webdav)(/[^\s?]*)")


def detect_client_source(user_agent: str, url: str, message: str) -> str:
    """Identify whether an edit/action happened via Collabora Office, Desktop Sync, Mobile, or Web."""
    ua_lower = (user_agent or "").lower()
    url_lower = (url or "").lower()
    msg_lower = (message or "").lower()

    if (
        "collabora" in ua_lower
        or "coolwsd" in ua_lower
        or "wopi" in url_lower
        or "richdocuments" in url_lower
        or "collabora" in msg_lower
    ):
        return "Collabora Office (Live Edit)"
    if "mirall" in ua_lower or "nextcloud-desktop" in ua_lower or "csync" in ua_lower:
        return "Desktop Sync Client"
    if "nextcloud-android" in ua_lower or "nextcloud-ios" in ua_lower:
        return "Mobile App"
    if "/apps/text/" in url_lower:
        return "Nextcloud Text (Live Edit)"
    if "mozilla" in ua_lower or "chrome" in ua_lower or "safari" in ua_lower:
        return "Web Browser"
    if "/dav/" in url_lower or "/webdav/" in url_lower:
        return "WebDAV Client"
    return "System / API"


def extract_owner_and_normalized_path(raw_path: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """
    Given a Nextcloud internal path like '/admin/files/invoices (8).xlsx',
    return (owner_uid='admin', normalized_path='/invoices (8).xlsx').
    """
    if not raw_path:
        return (None, None)
    parts = [p for p in raw_path.split("/") if p]
    if len(parts) >= 3 and parts[1] == "files":
        return (parts[0], "/" + "/".join(parts[2:]))
    if not raw_path.startswith("/"):
        return (None, "/" + raw_path)
    return (None, raw_path)


def extract_path_and_owner(message: str, url: str) -> tuple[Optional[str], Optional[str]]:
    """Extract (owner_uid, normalized_file_path) from audit message or DAV URL."""
    quoted = RE_QUOTED_PATH.findall(message or "")
    if quoted:
        # Take the last quoted path starting with '/' (since 'File with id "256"' has "256" first)
        return extract_owner_and_normalized_path(quoted[-1])

    dav_match = RE_DAV_PATH.search(url or "")
    if dav_match:
        return (None, unquote(dav_match.group(1)))

    return (None, None)


def extract_file_id(message: str, url: str) -> Optional[int]:
    """Extract numeric Nextcloud file_id from message or WOPI URL."""
    m = RE_FILE_ID_MSG.search(message or "")
    if m:
        return int(m.group(1))
    w = RE_WOPI_FILE_ID.search(url or "")
    if w:
        return int(w.group(1))
    return None


def extract_access_token(url: str) -> Optional[str]:
    """Extract WOPI access_token from URL query string if present."""
    if not url or "access_token=" not in url:
        return None
    try:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        tokens = qs.get("access_token")
        if tokens:
            return tokens[0]
    except Exception:
        pass
    return None


def classify_event(
    message: str, method: str, url: str
) -> tuple[str, str, Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Classify Nextcloud audit event into:
    (action_type, severity, file_path, previous_path, share_target, path_owner)
    """
    msg = message or ""
    msg_lower = msg.lower()
    method_upper = (method or "").upper()
    url_lower = (url or "").lower()

    # 0. Ignore / classify thumbnail preview requests
    if msg_lower.startswith("preview accessed") or "/core/preview" in url_lower:
        owner, f_path = extract_path_and_owner(msg, url)
        return ("PREVIEW_GENERATED", "INFO", f_path, None, None, owner)

    # 1. File Rename / Move
    rename_match = RE_RENAME.search(msg)
    if rename_match:
        owner1, old_p = extract_owner_and_normalized_path(rename_match.group(1))
        owner2, new_p = extract_owner_and_normalized_path(rename_match.group(2))
        return ("FILE_RENAMED", "INFO", new_p, old_p, None, owner2 or owner1)

    # 2. File Share (User/Group or Public Link)
    share_user_match = RE_SHARE_USER.search(msg)
    if share_user_match:
        owner, f_path = extract_owner_and_normalized_path(share_user_match.group(1))
        if not f_path:
            owner, f_path = extract_path_and_owner(msg, url)
        target = share_user_match.group(2)
        return ("FILE_SHARED", "INFO", f_path, None, f"user/group:{target}", owner)

    share_link_match = RE_SHARE_LINK.search(msg)
    if share_link_match or "public link" in msg_lower or ("share" in msg_lower and "link" in msg_lower):
        owner, f_path = extract_path_and_owner(msg, url)
        return ("FILE_SHARED_PUBLIC", "WARNING", f_path, None, "public_link", owner)

    if "unshared" in msg_lower or "share removed" in msg_lower or "permission" in msg_lower:
        owner, f_path = extract_path_and_owner(msg, url)
        return ("PERMISSION_CHANGED", "WARNING", f_path, None, None, owner)

    # 3. Version Restored
    if "version restored" in msg_lower or "restore version" in msg_lower:
        owner, f_path = extract_path_and_owner(msg, url)
        return ("VERSION_RESTORED", "INFO", f_path, None, None, owner)

    # 4. Trashbin Restore
    if "restored from trashbin" in msg_lower or "trashbin restore" in msg_lower:
        owner, f_path = extract_path_and_owner(msg, url)
        return ("FILE_RESTORED", "INFO", f_path, None, None, owner)

    # 5. File Deleted
    if (
        "deleted:" in msg_lower
        or "file deleted" in msg_lower
        or "folder deleted" in msg_lower
        or "moved to trashbin" in msg_lower
        or "deleted from trashbin" in msg_lower
        or method_upper == "DELETE"
    ):
        owner, f_path = extract_path_and_owner(msg, url)
        sev = "WARNING" if "trashbin" in msg_lower else "INFO"
        return ("FILE_DELETED", sev, f_path, None, None, owner)

    # 6. File Created vs File Edited/Written
    # Matches both 'File created: "/path"' and Nextcloud 30 'File with id "256" created: "/admin/files/path"'
    if (
        "created:" in msg_lower
        or "file created" in msg_lower
        or "folder created" in msg_lower
        or method_upper == "MKCOL"
    ):
        owner, f_path = extract_path_and_owner(msg, url)
        return ("FILE_CREATED", "INFO", f_path, None, None, owner)

    # Matches Nextcloud 30 'File with id "256" written to: "/admin/files/..."' and Collabora WOPI saves
    if (
        "written to:" in msg_lower
        or "file written" in msg_lower
        or "file updated" in msg_lower
        or "file modified" in msg_lower
        or "putfile" in url_lower
        or ("wopi/files" in url_lower and method_upper == "POST")
        or (method_upper == "PUT" and "/dav/" in url_lower)
    ):
        owner, f_path = extract_path_and_owner(msg, url)
        return ("FILE_EDITED", "INFO", f_path, None, None, owner)

    # 7. File Read / Downloaded / Viewed / Opened in Office
    if "accessed:" in msg_lower or "file read" in msg_lower or "file accessed" in msg_lower or "file downloaded" in msg_lower:
        owner, f_path = extract_path_and_owner(msg, url)
        return ("FILE_VIEWED", "INFO", f_path, None, None, owner)

    # 8. Login / Auth Events
    if "login failed" in msg_lower or "authentication failed" in msg_lower:
        return ("USER_LOGIN_FAILED", "WARNING", None, None, None, None)
    if "login attempt" in msg_lower:
        return ("USER_LOGIN_ATTEMPT", "INFO", None, None, None, None)
    if "login successful" in msg_lower or "logged in" in msg_lower:
        return ("USER_LOGIN", "INFO", None, None, None, None)
    if "logout" in msg_lower or "logged out" in msg_lower:
        return ("USER_LOGOUT", "INFO", None, None, None, None)

    owner, f_path = extract_path_and_owner(msg, url)
    return ("SYSTEM_EVENT", "INFO", f_path, None, None, owner)


def parse_audit_line(raw_line: str, pg_resolver: Any = None) -> Optional[Dict[str, Any]]:
    """
    Parse a single JSON line from Nextcloud's audit.log into a normalized event dict,
    resolving WOPI Collabora tokens and path owners so authenticated users are never 'anonymous'.
    """
    line = raw_line.strip()
    if not line:
        return None

    try:
        payload = json.loads(line)
    except json.JSONDecodeError:
        return None

    req_id = str(payload.get("reqId", "") or "")
    message = str(payload.get("message", "") or "")
    url = str(payload.get("url", "") or "")
    method = str(payload.get("method", "") or "")
    raw_user = str(payload.get("user", "") or "--").strip()
    remote_addr = str(payload.get("remoteAddr", "") or "").strip()
    user_agent = str(payload.get("userAgent", "") or "").strip()
    raw_time = str(payload.get("time", "") or "")

    # Skip internal Nextcloud CLI/cron skeleton indexing when both user and url are empty/'--'
    if raw_user in ("", "--", "-") and url in ("", "--", "-") and not remote_addr:
        return None

    action_type, severity, file_path, previous_path, share_target, path_owner = classify_event(
        message, method, url
    )

    # Skip noisy thumbnail preview events and redundant login_attempt pre-checks
    if action_type in ("PREVIEW_GENERATED", "USER_LOGIN_ATTEMPT"):
        return None

    # Skip WebDAV root directory PROPFIND listing spam when a user simply refreshes a folder
    if method.upper() == "PROPFIND" and action_type == "FILE_VIEWED":
        return None

    file_id = extract_file_id(message, url)
    access_token = extract_access_token(url)
    client_source = detect_client_source(user_agent, url, message)

    # Skip duplicate WOPI GET file read right after /apps/richdocuments/token open
    if action_type == "FILE_VIEWED" and "/wopi/files/" in url.lower() and method.upper() == "GET":
        return None

    # Resolve the true actor (Who performed the action)
    actor = raw_user if raw_user not in ("", "--", "-") else None

    # If a known user opens a file in Collabora (/apps/richdocuments/token), cache (file_id -> actor)
    if actor and file_id and pg_resolver is not None:
        pg_resolver.record_recent_file_editor(file_id, actor)

    # 1. If actor is missing and this is a Collabora WOPI request, resolve via PostgreSQL oc_richdocuments_wopi
    if not actor and (access_token or file_id) and pg_resolver is not None:
        actor = pg_resolver.resolve_wopi_actor(access_token, file_id)

    # 2. If actor is missing on a Login event, extract username from 'Login failed: "admin"'
    if not actor:
        login_m = RE_LOGIN_USER.search(message)
        if login_m:
            actor = login_m.group(1)

    # 3. If actor is still missing and path has an explicit owner (/admin/files/...), use path_owner
    if not actor and path_owner:
        actor = path_owner

    if not actor:
        actor = "system"

    # Normalize timestamp to ISO-8601 UTC
    try:
        dt = datetime.fromisoformat(raw_time.replace("Z", "+00:00"))
        timestamp = dt.astimezone(timezone.utc).isoformat()
    except Exception:
        timestamp = datetime.now(timezone.utc).isoformat()

    hash_input = f"{req_id}|{raw_time}|{actor}|{action_type}|{url}|{message}"
    event_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()[:32]

    return {
        "event_hash": event_hash,
        "req_id": req_id,
        "timestamp": timestamp,
        "actor": actor,
        "action_type": action_type,
        "severity": severity,
        "file_id": file_id,
        "file_path": file_path,
        "previous_path": previous_path,
        "share_target": share_target,
        "client_source": client_source,
        "ip_address": remote_addr or "local",
        "user_agent": user_agent if user_agent != "--" else "System",
        "http_method": method if method != "--" else "",
        "url": url if url != "--" else "",
        "raw_message": message,
    }
