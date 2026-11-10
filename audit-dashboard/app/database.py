"""SQLite storage, version lineage tracker, and analytics engine for Shehata Drive Audit."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional


class AuditDatabase:
    def __init__(self, db_path: str = "/data/audit_events.db", mass_delete_threshold: int = 15):
        self.db_path = db_path
        self.mass_delete_threshold = mass_delete_threshold
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        self._init_db()

    @contextmanager
    def _conn(self):
        conn = sqlite3.connect(self.db_path, timeout=15.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS audit_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_hash TEXT UNIQUE NOT NULL,
                    req_id TEXT,
                    timestamp TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    action_type TEXT NOT NULL,
                    severity TEXT NOT NULL DEFAULT 'INFO',
                    file_id INTEGER,
                    file_path TEXT,
                    previous_path TEXT,
                    version_number INTEGER,
                    share_target TEXT,
                    client_source TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    raw_message TEXT,
                    is_anomaly INTEGER NOT NULL DEFAULT 0,
                    anomaly_reason TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor);
                CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action_type);
                CREATE INDEX IF NOT EXISTS idx_audit_file_path ON audit_events(file_path);
                CREATE INDEX IF NOT EXISTS idx_audit_prev_path ON audit_events(previous_path);
                CREATE INDEX IF NOT EXISTS idx_audit_anomaly ON audit_events(is_anomaly);
                """
            )
            # Ensure new columns exist if upgrading an existing SQLite DB
            cols = {r["name"] for r in conn.execute("PRAGMA table_info(audit_events)").fetchall()}
            if "req_id" not in cols:
                conn.execute("ALTER TABLE audit_events ADD COLUMN req_id TEXT;")
            if "file_id" not in cols:
                conn.execute("ALTER TABLE audit_events ADD COLUMN file_id INTEGER;")

    def reset_and_clean_noise(self) -> None:
        """Remove legacy 'anonymous' or noisy preview rows before re-ingesting with PostgreSQL attribution."""
        with self._conn() as conn:
            conn.execute(
                """
                DELETE FROM audit_events
                WHERE actor IN ('anonymous', '--')
                   OR raw_message LIKE 'Preview accessed:%'
                   OR raw_message LIKE 'Login attempt:%'
                """
            )

    def clear_all_events(self) -> None:
        """Clear all audit events so the log can be cleanly re-indexed from scratch."""
        with self._conn() as conn:
            conn.execute("DELETE FROM audit_events;")

    def _resolve_file_aliases(self, conn: sqlite3.Connection, file_path: str) -> List[str]:
        """Find all historical paths for a file across renames/moves."""
        aliases = {file_path}
        frontier = {file_path}

        for _ in range(10):
            if not frontier:
                break
            placeholders = ",".join("?" for _ in frontier)
            params = list(frontier)
            rows = conn.execute(
                f"""
                SELECT file_path, previous_path
                FROM audit_events
                WHERE (file_path IN ({placeholders}) OR previous_path IN ({placeholders}))
                  AND previous_path IS NOT NULL
                """,
                params + params,
            ).fetchall()
            next_frontier = set()
            for r in rows:
                for p in (r["file_path"], r["previous_path"]):
                    if p and p not in aliases:
                        aliases.add(p)
                        next_frontier.add(p)
            frontier = next_frontier

        return list(aliases)

    def _next_version_number(self, conn: sqlite3.Connection, file_path: Optional[str], action_type: str) -> Optional[int]:
        """Compute sequential version number for file creation and edits across renames."""
        if not file_path or action_type not in ("FILE_CREATED", "FILE_EDITED", "VERSION_RESTORED"):
            return None

        aliases = self._resolve_file_aliases(conn, file_path)
        placeholders = ",".join("?" for _ in aliases)
        row = conn.execute(
            f"""
            SELECT COALESCE(MAX(version_number), 0) AS max_ver
            FROM audit_events
            WHERE file_path IN ({placeholders})
              AND version_number IS NOT NULL
            """,
            aliases,
        ).fetchone()
        current_max = int(row["max_ver"]) if row else 0
        return current_max + 1

    def _detect_anomaly(self, conn: sqlite3.Connection, event: Dict[str, Any]) -> tuple[int, Optional[str], str]:
        """Evaluate whether an incoming audit event triggers a security or operational alert."""
        action = event["action_type"]
        actor = event["actor"]
        ip = event["ip_address"]
        severity = event.get("severity", "INFO")

        try:
            event_dt = datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00"))
        except Exception:
            event_dt = datetime.now(timezone.utc)
        window_start = (event_dt - timedelta(minutes=10)).isoformat()

        if action == "FILE_DELETED":
            row = conn.execute(
                """
                SELECT COUNT(*) AS cnt FROM audit_events
                WHERE actor = ? AND action_type = 'FILE_DELETED' AND timestamp >= ?
                """,
                (actor, window_start),
            ).fetchone()
            recent_deletes = (int(row["cnt"]) if row else 0) + 1
            if recent_deletes >= self.mass_delete_threshold:
                return (
                    1,
                    f"Mass deletion alert: {actor} deleted {recent_deletes} files within 10 minutes",
                    "CRITICAL",
                )

        if action == "USER_LOGIN_FAILED":
            row = conn.execute(
                """
                SELECT COUNT(*) AS cnt FROM audit_events
                WHERE ip_address = ? AND action_type = 'USER_LOGIN_FAILED' AND timestamp >= ?
                """,
                (ip, window_start),
            ).fetchone()
            recent_fails = (int(row["cnt"]) if row else 0) + 1
            if recent_fails >= 3:
                return (
                    1,
                    f"Repeated failed logins ({recent_fails} attempts) for '{actor}' from IP {ip}",
                    "CRITICAL",
                )

        if action == "FILE_SHARED_PUBLIC":
            return (
                1,
                f"External public share link created by {actor} for {event.get('file_path') or 'resource'}",
                "WARNING",
            )

        return (0, None, severity)

    def insert_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Insert a parsed audit event if not already present. Returns stored record or None if duplicate."""
        with self._conn() as conn:
            existing = conn.execute(
                "SELECT id FROM audit_events WHERE event_hash = ?",
                (event["event_hash"],),
            ).fetchone()
            if existing:
                return None

            # Deduplicate when Nextcloud WebDAV PUT emits both 'created:' and 'written to:' in the same req_id
            req_id = event.get("req_id")
            if req_id and event["action_type"] == "FILE_EDITED" and event.get("file_path"):
                same_req_create = conn.execute(
                    """
                    SELECT id FROM audit_events
                    WHERE req_id = ? AND file_path = ? AND action_type = 'FILE_CREATED'
                    """,
                    (req_id, event["file_path"]),
                ).fetchone()
                if same_req_create:
                    return None

            version_number = self._next_version_number(conn, event.get("file_path"), event["action_type"])
            is_anomaly, anomaly_reason, final_severity = self._detect_anomaly(conn, event)

            cursor = conn.execute(
                """
                INSERT INTO audit_events (
                    event_hash, req_id, timestamp, actor, action_type, severity,
                    file_id, file_path, previous_path, version_number, share_target,
                    client_source, ip_address, user_agent, raw_message,
                    is_anomaly, anomaly_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event["event_hash"],
                    event.get("req_id"),
                    event["timestamp"],
                    event["actor"],
                    event["action_type"],
                    final_severity,
                    event.get("file_id"),
                    event.get("file_path"),
                    event.get("previous_path"),
                    version_number,
                    event.get("share_target"),
                    event.get("client_source"),
                    event.get("ip_address"),
                    event.get("user_agent"),
                    event.get("raw_message"),
                    is_anomaly,
                    anomaly_reason,
                ),
            )
            row = conn.execute("SELECT * FROM audit_events WHERE id = ?", (cursor.lastrowid,)).fetchone()
            return dict(row) if row else None

    def query_events(
        self,
        actor: Optional[str] = None,
        action_type: Optional[str] = None,
        file_query: Optional[str] = None,
        ip_address: Optional[str] = None,
        client_source: Optional[str] = None,
        anomalies_only: bool = False,
        exclude_views: bool = False,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        limit: int = 200,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Search and filter audit events with pagination."""
        clauses = ["1=1"]
        params: List[Any] = []

        if actor:
            clauses.append("LOWER(actor) = LOWER(?)")
            params.append(actor.strip())
        if action_type:
            clauses.append("action_type = ?")
            params.append(action_type.strip())
        if file_query:
            clauses.append(
                "(LOWER(file_path) LIKE LOWER(?) OR LOWER(previous_path) LIKE LOWER(?) OR LOWER(raw_message) LIKE LOWER(?))"
            )
            q = f"%{file_query.strip()}%"
            params.extend([q, q, q])
        if ip_address:
            clauses.append("ip_address LIKE ?")
            params.append(f"%{ip_address.strip()}%")
        if client_source:
            clauses.append("LOWER(client_source) LIKE LOWER(?)")
            params.append(f"%{client_source.strip()}%")
        if anomalies_only:
            clauses.append("is_anomaly = 1")
        if exclude_views:
            clauses.append("action_type != 'FILE_VIEWED'")
        if start_time:
            clauses.append("timestamp >= ?")
            params.append(start_time)
        if end_time:
            clauses.append("timestamp <= ?")
            params.append(end_time)

        where_sql = " AND ".join(clauses)

        with self._conn() as conn:
            total_row = conn.execute(
                f"SELECT COUNT(*) AS total FROM audit_events WHERE {where_sql}",
                params,
            ).fetchone()
            total = int(total_row["total"]) if total_row else 0

            rows = conn.execute(
                f"""
                SELECT * FROM audit_events
                WHERE {where_sql}
                ORDER BY timestamp DESC, id DESC
                LIMIT ? OFFSET ?
                """,
                params + [limit, offset],
            ).fetchall()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "events": [dict(r) for r in rows],
        }

    def get_file_timeline(self, file_path: str, pg_resolver: Any = None) -> Dict[str, Any]:
        """Return the complete chronological edit & access history of a file, including renames and disk versions."""
        with self._conn() as conn:
            aliases = self._resolve_file_aliases(conn, file_path)
            placeholders = ",".join("?" for _ in aliases)
            rows = conn.execute(
                f"""
                SELECT * FROM audit_events
                WHERE file_path IN ({placeholders}) OR previous_path IN ({placeholders})
                ORDER BY timestamp ASC, id ASC
                """,
                aliases + aliases,
            ).fetchall()

            events = [dict(r) for r in rows]
            editors = sorted(
                {e["actor"] for e in events if e["action_type"] in ("FILE_CREATED", "FILE_EDITED", "VERSION_RESTORED")}
            )
            viewers = sorted({e["actor"] for e in events if e["action_type"] == "FILE_VIEWED"})
            versions = [
                {
                    "version": e["version_number"],
                    "timestamp": e["timestamp"],
                    "editor": e["actor"],
                    "action": e["action_type"],
                    "client_source": e["client_source"],
                    "ip_address": e["ip_address"],
                    "file_path_at_time": e["file_path"],
                }
                for e in events
                if e.get("version_number") is not None
            ]

            storage_versions = []
            if pg_resolver is not None:
                storage_versions = pg_resolver.get_real_file_versions(file_path)

            return {
                "requested_path": file_path,
                "known_aliases": aliases,
                "total_events": len(events),
                "total_versions": len(versions),
                "editors": editors,
                "viewers": viewers,
                "versions": versions,
                "storage_versions": storage_versions,
                "timeline": list(reversed(events)),
            }

    def get_user_profile(self, actor: str) -> Dict[str, Any]:
        """Return complete forensic summary for a specific user."""
        with self._conn() as conn:
            summary = conn.execute(
                """
                SELECT
                    COUNT(*) AS total_events,
                    SUM(CASE WHEN action_type = 'FILE_EDITED' THEN 1 ELSE 0 END) AS edits,
                    SUM(CASE WHEN action_type = 'FILE_CREATED' THEN 1 ELSE 0 END) AS created,
                    SUM(CASE WHEN action_type = 'FILE_VIEWED' THEN 1 ELSE 0 END) AS views,
                    SUM(CASE WHEN action_type = 'FILE_DELETED' THEN 1 ELSE 0 END) AS deletes,
                    SUM(CASE WHEN action_type LIKE 'FILE_SHARED%' THEN 1 ELSE 0 END) AS shares,
                    SUM(CASE WHEN is_anomaly = 1 THEN 1 ELSE 0 END) AS anomalies,
                    MIN(timestamp) AS first_seen,
                    MAX(timestamp) AS last_seen
                FROM audit_events
                WHERE LOWER(actor) = LOWER(?)
                """,
                (actor,),
            ).fetchone()

            ips = [
                r["ip_address"]
                for r in conn.execute(
                    "SELECT DISTINCT ip_address FROM audit_events WHERE LOWER(actor) = LOWER(?) AND ip_address IS NOT NULL",
                    (actor,),
                ).fetchall()
            ]
            clients = [
                r["client_source"]
                for r in conn.execute(
                    "SELECT DISTINCT client_source FROM audit_events WHERE LOWER(actor) = LOWER(?) AND client_source IS NOT NULL",
                    (actor,),
                ).fetchall()
            ]
            touched_files = conn.execute(
                """
                SELECT
                    file_path,
                    COUNT(*) AS total_actions,
                    SUM(CASE WHEN action_type IN ('FILE_CREATED', 'FILE_EDITED') THEN 1 ELSE 0 END) AS edits,
                    MAX(version_number) AS max_version,
                    MAX(timestamp) AS last_touched
                FROM audit_events
                WHERE LOWER(actor) = LOWER(?) AND file_path IS NOT NULL
                GROUP BY file_path
                ORDER BY last_touched DESC
                LIMIT 25
                """,
                (actor,),
            ).fetchall()

            return {
                "actor": actor,
                "summary": dict(summary) if summary else {},
                "ip_addresses": ips,
                "clients": clients,
                "touched_files": [dict(r) for r in touched_files],
            }

    def get_summary_stats(self) -> Dict[str, Any]:
        """Return aggregate dashboard metrics: top editors, active files, action/client breakdown, anomalies."""
        with self._conn() as conn:
            totals = conn.execute(
                """
                SELECT
                    COUNT(*) AS total_events,
                    SUM(CASE WHEN action_type = 'FILE_EDITED' THEN 1 ELSE 0 END) AS total_edits,
                    SUM(CASE WHEN action_type = 'FILE_CREATED' THEN 1 ELSE 0 END) AS total_created,
                    SUM(CASE WHEN action_type = 'FILE_VIEWED' THEN 1 ELSE 0 END) AS total_views,
                    SUM(CASE WHEN action_type = 'FILE_DELETED' THEN 1 ELSE 0 END) AS total_deletes,
                    SUM(CASE WHEN action_type LIKE 'FILE_SHARED%' THEN 1 ELSE 0 END) AS total_shares,
                    SUM(CASE WHEN is_anomaly = 1 THEN 1 ELSE 0 END) AS total_anomalies,
                    COUNT(DISTINCT actor) AS active_users,
                    COUNT(DISTINCT file_path) AS tracked_files
                FROM audit_events
                """
            ).fetchone()

            by_user = conn.execute(
                """
                SELECT
                    actor,
                    COUNT(*) AS event_count,
                    SUM(CASE WHEN action_type IN ('FILE_CREATED', 'FILE_EDITED') THEN 1 ELSE 0 END) AS edits,
                    SUM(CASE WHEN action_type = 'FILE_CREATED' THEN 1 ELSE 0 END) AS creates,
                    SUM(CASE WHEN action_type = 'FILE_EDITED' THEN 1 ELSE 0 END) AS modifications,
                    SUM(CASE WHEN action_type = 'FILE_VIEWED' THEN 1 ELSE 0 END) AS views,
                    SUM(CASE WHEN action_type = 'FILE_DELETED' THEN 1 ELSE 0 END) AS deletes,
                    SUM(CASE WHEN action_type LIKE 'FILE_SHARED%' THEN 1 ELSE 0 END) AS shares,
                    COUNT(DISTINCT ip_address) AS distinct_ips,
                    MAX(timestamp) AS last_active
                FROM audit_events
                GROUP BY actor
                ORDER BY edits DESC, event_count DESC
                LIMIT 20
                """
            ).fetchall()

            most_edited_files = conn.execute(
                """
                SELECT
                    file_path,
                    MAX(version_number) AS latest_version,
                    COUNT(*) AS total_activity,
                    SUM(CASE WHEN action_type IN ('FILE_CREATED', 'FILE_EDITED') THEN 1 ELSE 0 END) AS edit_count,
                    COUNT(DISTINCT actor) AS distinct_users,
                    GROUP_CONCAT(DISTINCT actor) AS collaborators,
                    MAX(timestamp) AS last_modified
                FROM audit_events
                WHERE file_path IS NOT NULL
                GROUP BY file_path
                ORDER BY edit_count DESC, last_modified DESC
                LIMIT 20
                """
            ).fetchall()

            by_action = conn.execute(
                """
                SELECT action_type, COUNT(*) AS count
                FROM audit_events
                GROUP BY action_type
                ORDER BY count DESC
                """
            ).fetchall()

            by_client = conn.execute(
                """
                SELECT COALESCE(client_source, 'Unknown') AS client_source, COUNT(*) AS count
                FROM audit_events
                GROUP BY client_source
                ORDER BY count DESC
                """
            ).fetchall()

            recent_anomalies = conn.execute(
                """
                SELECT * FROM audit_events
                WHERE is_anomaly = 1
                ORDER BY timestamp DESC
                LIMIT 10
                """
            ).fetchall()

            return {
                "overview": {
                    "total_events": int(totals["total_events"] or 0),
                    "total_edits": int(totals["total_edits"] or 0),
                    "total_created": int(totals["total_created"] or 0),
                    "total_views": int(totals["total_views"] or 0),
                    "total_deletes": int(totals["total_deletes"] or 0),
                    "total_shares": int(totals["total_shares"] or 0),
                    "total_anomalies": int(totals["total_anomalies"] or 0),
                    "active_users": int(totals["active_users"] or 0),
                    "tracked_files": int(totals["tracked_files"] or 0),
                },
                "users": [dict(r) for r in by_user],
                "hot_files": [dict(r) for r in most_edited_files],
                "by_action": [dict(r) for r in by_action],
                "by_client": [dict(r) for r in by_client],
                "recent_anomalies": [dict(r) for r in recent_anomalies],
            }
