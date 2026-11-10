# Company Files Vault — Self-Hosted Cloud Drive + Collabora Office + Real-Time Audit & File Edit Tracker

A complete, production-ready Google Drive & Google Docs alternative engineered specifically for a **4 vCPU / 8 GB RAM VPS** supporting **5–50 users**, with comprehensive **Who-Did-What-When** forensics, automatic file version history, live collaborative document editing, and rename-aware edit lineage tracking.

---

## 1. Architecture & 8 GB RAM / 4 vCPU Resource Budget

Running Nextcloud + Collabora Online + PostgreSQL + Redis on an 8 GB RAM VPS requires strict container memory caps and worker tuning so the Linux OOM-killer never terminates services during peak document editing or thumbnail generation:

| Service | Open-Source Engine | RAM Limit | CPU Limit | Role & Tuning Applied |
| :--- | :--- | :---: | :---: | :--- |
| **`nextcloud`** | Nextcloud 30 | `2048 MB` | `2.0 vCPU` | Core Drive, Versioning, Sharing, `admin_audit` JSON emitter, OPcache (192MB) + APCu (64MB) |
| **`collabora`** | Collabora Online (`CODE`) | `2048 MB` | `1.5 vCPU` | Live Word/Excel/PPT editing with Track Changes (`num_prespawn_children=1`, `max_concurrency=4`) |
| **`postgres`** | PostgreSQL 16 Alpine | `1024 MB` | `1.0 vCPU` | Tuned `shared_buffers=256MB`, `effective_cache_size=768MB`, SSD query planner |
| **`nextcloud-cron`**| Nextcloud Background | `512 MB` | `0.5 vCPU` | Background indexing, preview generation (`concurrency=4`), version/trash retention |
| **`redis`** | Redis 7 Alpine | `256 MB` | `0.5 vCPU` | Transactional file locking (`allkeys-lru`, `192MB` maxmemory) to prevent edit conflicts |
| **`audit-dashboard`**| FastAPI + SQLite WAL | `256 MB` | `0.5 vCPU` | Real-time `audit.log` tailer, Version Lineage Tracker, Anomaly Detector & Forensics Web UI |
| **`caddy`** | Caddy 2 Alpine | `128 MB` | `0.5 vCPU` | Reverse proxy unifying Drive (`:8080`), Collabora WOPI, and Audit Portal (`/audit-portal/`) |
| **Total Ceiling** | **7 Containers** | **~6.25 GB** | **4.0 vCPU** | **Leaves ~1.75 GB RAM headroom for Linux kernel, filesystem cache & bursts** |

---

## 2. How "Who Did What, When & File Edits" Are Tracked (3 Layers)

### Layer 1: File Version History & Rollback (`files_versions`)
- Every time a file is uploaded, overwritten via Web/Desktop/Mobile sync, or saved in Collabora Office, Nextcloud preserves the previous state and increments the version chain.
- Retention is pre-configured to `auto, 180` (retains version history for 180 days).
- Users and admins can view who saved each version, compare timestamps, download any historical version, or **1-click restore** a file to an earlier point in time.

### Layer 2: In-Document Character & Author Tracking (Collabora / Nextcloud Office)
- Live multi-user editing for `.docx`, `.xlsx`, `.pptx`, `.odt`, `.ods`.
- Shows real-time cursors with each user's name and avatar.
- **Built-in Track Changes**: Inside any document, enable **Review → Track Changes → Record** to record every character insertion, deletion, and formatting change color-coded by author and exact timestamp.

### Layer 3: Shehata Drive Audit & Forensics Dashboard (`audit-dashboard`)
- Nextcloud's enterprise `admin_audit` app is automatically enabled via `scripts/configure-nextcloud.sh` at `loglevel=1`, emitting every event to `/var/log/nextcloud/audit.log`.
- The custom **Audit & File Edit Tracker** (`http://localhost:8090` or `http://localhost:8080/audit-portal/`) tails this log in real time and provides:
  - **Who**: Username, IP address, User-Agent, and Client Source (`Collabora Office (Live Edit)`, `Desktop Sync Client`, `Mobile App`, `Web Browser`, `WebDAV`).
  - **Did What**: `FILE_CREATED`, `FILE_EDITED`, `FILE_VIEWED`, `FILE_RENAMED`, `FILE_DELETED`, `FILE_RESTORED`, `VERSION_RESTORED`, `FILE_SHARED`, `FILE_SHARED_PUBLIC`, `PERMISSION_CHANGED`, `USER_LOGIN`, `USER_LOGIN_FAILED`.
  - **Rename-Aware Version Lineage**: If `/Draft.docx` (`v1`, `v2`) is renamed to `/Final_Spec.docx` and edited again (`v3`), clicking `/Final_Spec.docx` in the Audit Dashboard automatically links all historical names and shows the complete chain of custody (`v1 -> v2 -> rename -> v3`) and every user who ever touched it.
  - **Automated Security Alerts**: Flags mass file deletions, public link creations, and repeated failed login attempts, with optional Webhook notifications (`WEBHOOK_ALERT_URL`).
  - **Compliance Exports**: 1-click **CSV** and **JSON** audit exports.

---

## 3. Quick Start Deployment

### Step 1: Optimize the Host VPS (4 vCPU / 8 GB RAM)
Run the host optimization script once to configure a 4 GB safety swapfile, Redis memory overcommit, and high Linux `inotify` watcher limits:
```bash
sudo bash scripts/setup-vps.sh
```

### Step 2: Configure Environment Secrets
Edit `.env` and set strong passwords and your domain/IP:
```bash
nano .env
```

### Step 3: Launch the Stack
```bash
docker compose up -d --build
```
*(Wait ~60–90 seconds on first boot while Nextcloud initializes PostgreSQL and runs `scripts/configure-nextcloud.sh` to enable `admin_audit`, `files_versions`, `activity`, and `richdocuments`.)*

### Step 4: Access Your Interfaces
- **Shehata Drive (Nextcloud + Collabora Office)**: `http://localhost:8080`
  - Login with `NEXTCLOUD_ADMIN_USER` / `NEXTCLOUD_ADMIN_PASSWORD` from `.env`
- **Audit & File Edit Forensics Dashboard**: `http://localhost:8090` (or `http://localhost:8080/audit-portal/`)
  - Click **"⚡ Load Sample Activity"** in the top-right corner of the Audit Dashboard to immediately explore sample team edits, Collabora saves, file renames, and security alerts.

---

## 4. Backups & Maintenance

Run a full consistent backup (PostgreSQL database + Nextcloud `audit.log` + Forensics SQLite DB):
```bash
./scripts/backup.sh
```
Backups are stored in `./backups/<TIMESTAMP>/`.
