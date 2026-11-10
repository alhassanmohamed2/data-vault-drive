"""Unit & integration tests for Shehata Drive Audit & File Edit Tracker."""

import json
import tempfile
from datetime import datetime, timezone

from app.database import AuditDatabase
from app.parser import parse_audit_line


def test_parse_audit_line_and_collabora_detection():
    # Test Nextcloud 30 Collabora Online WOPI save where user is "--" in audit.log
    raw = json.dumps(
        {
            "reqId": "zSSjJ6ZwInsoxqapL1nd",
            "level": 1,
            "time": "2026-11-10T08:49:57+00:00",
            "remoteAddr": "172.21.0.8",
            "user": "--",
            "app": "admin_audit",
            "method": "POST",
            "url": "/index.php/apps/richdocuments/wopi/files/256_oc14fco7qw0m/contents?access_token=rgA1ZXqtL4bbMLmDQsNkcSpA97MvwhGy&access_token_ttl=0",
            "message": 'File with id "256" written to: "/admin/files/invoices (8).xlsx"',
            "userAgent": "COOLWSD HTTP Agent 26.04.6.1",
        }
    )
    parsed = parse_audit_line(raw)
    assert parsed is not None
    assert parsed["actor"] == "admin"
    assert parsed["action_type"] == "FILE_EDITED"
    assert parsed["file_id"] == 256
    assert parsed["file_path"] == "/invoices (8).xlsx"
    assert parsed["client_source"] == "Collabora Office (Live Edit)"


def test_file_version_lineage_across_renames():
    with tempfile.NamedTemporaryFile(suffix=".db") as tmp:
        db = AuditDatabase(db_path=tmp.name, mass_delete_threshold=5)

        # 1. Alhassan creates /Draft.docx -> v1
        e1 = parse_audit_line(
            json.dumps(
                {
                    "reqId": "r1",
                    "time": "2026-11-10T08:00:00Z",
                    "remoteAddr": "10.0.0.1",
                    "user": "alhassan",
                    "method": "PUT",
                    "url": "/remote.php/dav/files/alhassan/Draft.docx",
                    "message": 'File created: "/Draft.docx"',
                    "userAgent": "Mozilla/5.0 Chrome/130.0",
                }
            )
        )
        r1 = db.insert_event(e1)
        assert r1["version_number"] == 1

        # 2. Sara edits /Draft.docx in Collabora -> v2
        e2 = parse_audit_line(
            json.dumps(
                {
                    "reqId": "r2",
                    "time": "2026-11-10T08:30:00Z",
                    "remoteAddr": "10.0.0.2",
                    "user": "sara",
                    "method": "POST",
                    "url": "/index.php/apps/richdocuments/wopi/files/10/contents",
                    "message": 'File written: "/Draft.docx"',
                    "userAgent": "CollaboraOnline/24.04",
                }
            )
        )
        r2 = db.insert_event(e2)
        assert r2["version_number"] == 2

        # 3. Alhassan renames /Draft.docx to /Final_Spec.docx
        e3 = parse_audit_line(
            json.dumps(
                {
                    "reqId": "r3",
                    "time": "2026-11-10T09:00:00Z",
                    "remoteAddr": "10.0.0.1",
                    "user": "alhassan",
                    "method": "MOVE",
                    "url": "/remote.php/dav/files/alhassan/Draft.docx",
                    "message": 'File renamed from "/Draft.docx" to "/Final_Spec.docx"',
                    "userAgent": "Mozilla/5.0 Chrome/130.0",
                }
            )
        )
        r3 = db.insert_event(e3)
        assert r3["action_type"] == "FILE_RENAMED"
        assert r3["previous_path"] == "/Draft.docx"
        assert r3["file_path"] == "/Final_Spec.docx"

        # 4. Omar edits /Final_Spec.docx -> should continue version counter at v3!
        e4 = parse_audit_line(
            json.dumps(
                {
                    "reqId": "r4",
                    "time": "2026-11-10T09:30:00Z",
                    "remoteAddr": "10.0.0.3",
                    "user": "omar",
                    "method": "PUT",
                    "url": "/remote.php/dav/files/omar/Final_Spec.docx",
                    "message": 'File written: "/Final_Spec.docx"',
                    "userAgent": "Mozilla/5.0 (Linux) mirall/3.14.0",
                }
            )
        )
        r4 = db.insert_event(e4)
        assert r4["version_number"] == 3

        # 5. Inspect timeline for /Final_Spec.docx
        timeline = db.get_file_timeline("/Final_Spec.docx")
        assert timeline["total_versions"] == 3
        assert set(timeline["editors"]) == {"alhassan", "sara", "omar"}
        assert set(timeline["known_aliases"]) == {"/Draft.docx", "/Final_Spec.docx"}


def test_mass_delete_and_public_share_anomaly_detection():
    with tempfile.NamedTemporaryFile(suffix=".db") as tmp:
        db = AuditDatabase(db_path=tmp.name, mass_delete_threshold=3)
        now = datetime.now(timezone.utc).isoformat()

        # Public share triggers anomaly immediately
        pub = parse_audit_line(
            json.dumps(
                {
                    "reqId": "pub-1",
                    "time": now,
                    "remoteAddr": "10.0.0.9",
                    "user": "omar",
                    "method": "POST",
                    "url": "/ocs/v2.php/apps/files_sharing/api/v1/shares",
                    "message": 'Shared file "/Secret.pdf" via public link',
                    "userAgent": "Mozilla/5.0",
                }
            )
        )
        res_pub = db.insert_event(pub)
        assert res_pub["is_anomaly"] == 1

        # Mass delete threshold = 3
        for idx in range(1, 4):
            del_ev = parse_audit_line(
                json.dumps(
                    {
                        "reqId": f"del-{idx}",
                        "time": now,
                        "remoteAddr": "10.0.0.9",
                        "user": "omar",
                        "method": "DELETE",
                        "url": f"/remote.php/dav/files/omar/Doc_{idx}.pdf",
                        "message": f'File deleted: "/Doc_{idx}.pdf"',
                        "userAgent": "Mozilla/5.0",
                    }
                )
            )
            inserted = db.insert_event(del_ev)
            if idx < 3:
                assert inserted["is_anomaly"] == 0
            else:
                assert inserted["is_anomaly"] == 1
                assert "Mass deletion alert" in inserted["anomaly_reason"]
