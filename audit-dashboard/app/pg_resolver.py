"""PostgreSQL Resolver for Nextcloud WOPI Tokens, File Versions (oc_filecache), and Users."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger("shehata-audit.pg")


class NextcloudPostgresResolver:
    """Connects to Nextcloud's PostgreSQL database to resolve WOPI tokens, file versions, and user profiles."""

    def __init__(self) -> None:
        self.host = os.getenv("POSTGRES_HOST", "postgres")
        self.port = int(os.getenv("POSTGRES_PORT", "5432"))
        self.dbname = os.getenv("POSTGRES_DB", "nextcloud")
        self.user = os.getenv("POSTGRES_USER", "nextcloud")
        self.password = os.getenv("POSTGRES_PASSWORD", "ChangeMe_StrongPostgresPass_2026!")
        self._token_cache: Dict[str, Dict[str, Any]] = {}
        self._fileid_editor_cache: Dict[int, str] = {}

    def _get_conn(self):
        return psycopg2.connect(
            host=self.host,
            port=self.port,
            dbname=self.dbname,
            user=self.user,
            password=self.password,
            connect_timeout=3,
        )

    def is_connected(self) -> bool:
        try:
            with self._get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    return True
        except Exception:
            return False

    def record_recent_file_editor(self, file_id: Optional[int], user_id: str) -> None:
        """Cache when a known user requests a Collabora token for a file_id."""
        if file_id and user_id and user_id not in ("--", "anonymous", "system"):
            self._fileid_editor_cache[int(file_id)] = user_id

    def resolve_wopi_actor(self, access_token: Optional[str], file_id: Optional[int] = None) -> Optional[str]:
        """
        Resolve the real Nextcloud user who edited/opened a document in Collabora Online
        by querying oc_richdocuments_wopi using the WOPI access_token or fileid.
        """
        if access_token and access_token in self._token_cache:
            cached = self._token_cache[access_token]
            return cached.get("actor")

        try:
            with self._get_conn() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    if access_token:
                        cur.execute(
                            """
                            SELECT owner_uid, editor_uid, guest_displayname, fileid, version
                            FROM oc_richdocuments_wopi
                            WHERE token = %s
                            LIMIT 1
                            """,
                            (access_token,),
                        )
                        row = cur.fetchone()
                        if row:
                            actor = (
                                row.get("editor_uid")
                                or row.get("guest_displayname")
                                or row.get("owner_uid")
                            )
                            if actor:
                                self._token_cache[access_token] = {"actor": actor, "row": dict(row)}
                                if row.get("fileid"):
                                    self._fileid_editor_cache[int(row["fileid"])] = actor
                                return str(actor)

                    if file_id:
                        cur.execute(
                            """
                            SELECT owner_uid, editor_uid, guest_displayname
                            FROM oc_richdocuments_wopi
                            WHERE fileid = %s
                            ORDER BY id DESC
                            LIMIT 1
                            """,
                            (int(file_id),),
                        )
                        row = cur.fetchone()
                        if row:
                            actor = (
                                row.get("editor_uid")
                                or row.get("guest_displayname")
                                or row.get("owner_uid")
                            )
                            if actor:
                                return str(actor)
        except Exception as exc:
            logger.debug("PostgreSQL WOPI token lookup fallback: %s", exc)

        if file_id and int(file_id) in self._fileid_editor_cache:
            return self._fileid_editor_cache[int(file_id)]

        return None

    def get_real_file_versions(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Query Nextcloud's oc_filecache for the current file and all historical versions
        stored in files_versions/<path>.v<timestamp>.
        """
        clean_path = file_path.lstrip("/")
        live_cache_path = f"files/{clean_path}"
        version_prefix = f"files_versions/{clean_path}.v"

        versions: List[Dict[str, Any]] = []
        try:
            with self._get_conn() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT fileid, path, size, mtime, etag
                        FROM oc_filecache
                        WHERE path = %s OR path LIKE %s
                        ORDER BY mtime ASC, fileid ASC
                        """,
                        (live_cache_path, version_prefix + "%"),
                    )
                    rows = cur.fetchall()

                    prev_size = 0
                    for idx, r in enumerate(rows, start=1):
                        size_bytes = int(r.get("size") or 0)
                        mtime_ts = int(r.get("mtime") or 0)
                        iso_time = (
                            datetime.fromtimestamp(mtime_ts, tz=timezone.utc).isoformat()
                            if mtime_ts > 0
                            else None
                        )
                        is_current = r["path"] == live_cache_path
                        delta = size_bytes - prev_size if idx > 1 else size_bytes
                        prev_size = size_bytes

                        versions.append(
                            {
                                "version_index": idx,
                                "fileid": r["fileid"],
                                "storage_path": r["path"],
                                "is_current": is_current,
                                "size_bytes": size_bytes,
                                "size_delta_bytes": delta,
                                "mtime_epoch": mtime_ts,
                                "timestamp": iso_time,
                                "etag": r.get("etag"),
                            }
                        )
        except Exception as exc:
            logger.debug("Failed to query oc_filecache versions: %s", exc)

        return versions

    def get_nextcloud_users(self) -> List[Dict[str, Any]]:
        """Fetch registered Nextcloud users from oc_users / oc_accounts."""
        users: List[Dict[str, Any]] = []
        try:
            with self._get_conn() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("SELECT uid, displayname FROM oc_users ORDER BY uid ASC")
                    for r in cur.fetchall():
                        users.append(
                            {
                                "uid": r["uid"],
                                "display_name": r.get("displayname") or r["uid"],
                            }
                        )
        except Exception as exc:
            logger.debug("Failed to query oc_users: %s", exc)
        return users
