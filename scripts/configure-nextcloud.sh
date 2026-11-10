#!/bin/sh
# ==============================================================================
# Shehata Drive - Automated Nextcloud Audit, Versioning & Performance Hook
# Mounted in: /docker-entrypoint-hooks.d/before-starting/
# ==============================================================================
set -e

echo "[Shehata Drive] Configuring Nextcloud Audit Trail, Versioning, Collabora & 4-Core/8GB Tuning..."

OCC="php /var/www/html/occ"

# Ensure audit log directory exists and is writable by www-data
mkdir -p /var/log/nextcloud 2>/dev/null || true
touch /var/log/nextcloud/audit.log /var/log/nextcloud/nextcloud.log 2>/dev/null || true
chown -R www-data:www-data /var/log/nextcloud 2>/dev/null || true
chmod -R 755 /var/log/nextcloud 2>/dev/null || true

# 1. Enable Enterprise Auditing & Activity Tracking Apps
$OCC app:enable admin_audit || true
$OCC app:enable files_versions || true
$OCC app:enable files_trashbin || true
$OCC app:enable activity || true
$OCC app:enable files_pdfviewer || true
$OCC app:enable richdocuments || true

# 2. Configure Comprehensive Audit Logging (Who did What, When, Where)
# loglevel=1 (Info) is required for admin_audit to record all file/user/share events
$OCC config:system:set log_type --value="file"
$OCC config:system:set logfile --value="/var/log/nextcloud/nextcloud.log"
$OCC config:system:set logfile_audit --value="/var/log/nextcloud/audit.log"
$OCC config:system:set loglevel --value=1 --type=integer
$OCC config:system:set logdateformat --value="c"
$OCC config:app:set admin_audit logfile --value="/var/log/nextcloud/audit.log"

# 3. Configure File Versioning & Trashbin Retention
# Keep file edit versions for up to 180 days automatically
$OCC config:system:set versions_retention_obligation --value="auto, 180"
$OCC config:system:set trashbin_retention_obligation --value="auto, 60"

# 4. Enable Full Activity Stream Tracking (File creates, edits, deletes, shares, comments)
$OCC config:app:set activity activity_expire_days --value="365"
$OCC config:app:set activity enable_stream --value="yes"

# 5. Configure Redis Transactional File Locking & APCu Memory Caching
$OCC config:system:set memcache.local --value="\OC\Memcache\APCu"
$OCC config:system:set memcache.distributed --value="\OC\Memcache\Redis"
$OCC config:system:set memcache.locking --value="\OC\Memcache\Redis"
$OCC config:system:set filelocking.enabled --value=true --type=boolean

# 6. Tune Preview Generation for 4 vCPU / 8 GB RAM VPS (Prevent CPU/RAM spikes)
$OCC config:system:set enable_previews --value=true --type=boolean
$OCC config:system:set preview_max_x --value=1024 --type=integer
$OCC config:system:set preview_max_y --value=1024 --type=integer
$OCC config:system:set preview_concurrency_all --value=4 --type=integer
$OCC config:system:set preview_concurrency_new --value=2 --type=integer
$OCC config:app:set preview jpeg_quality --value="80"

# 7. Configure Collabora Online (Nextcloud Office) for Real-Time Document Editing & Change Tracking
if [ "${DRIVE_PROTOCOL:-https}" = "https" ]; then
  PUBLIC_URL="https://${DRIVE_DOMAIN:-data.almatroudi.cloud}"
else
  PUBLIC_URL="${DRIVE_PROTOCOL:-http}://${DRIVE_DOMAIN:-localhost}:${DRIVE_PORT:-8440}"
fi
$OCC config:system:set overwrite.cli.url --value="$PUBLIC_URL"
$OCC config:system:set overwriteprotocol --value="${DRIVE_PROTOCOL:-https}"
$OCC config:system:set trusted_domains 0 --value="localhost"
$OCC config:system:set trusted_domains 1 --value="${DRIVE_DOMAIN:-data.almatroudi.cloud}"
$OCC config:system:set trusted_domains 2 --value="nextcloud"
$OCC config:system:set trusted_domains 3 --value="caddy"
$OCC config:system:set trusted_domains 4 --value="${AUDIT_DOMAIN:-audit.almatroudi.cloud}"
$OCC config:system:set trusted_domains 5 --value="72.62.239.146"
$OCC config:system:set trusted_proxies 0 --value="172.16.0.0/12"
$OCC config:system:set trusted_proxies 1 --value="192.168.0.0/16"
$OCC config:system:set trusted_proxies 2 --value="10.0.0.0/8"
$OCC config:system:set trusted_proxies 3 --value="127.0.0.1"
$OCC config:system:set forwarded_for_headers 0 --value="HTTP_CF_CONNECTING_IP"
$OCC config:system:set forwarded_for_headers 1 --value="HTTP_X_FORWARDED_FOR"

# Configure Collabora WOPI URLs
$OCC config:app:set richdocuments wopi_url --value="$PUBLIC_URL"
$OCC config:app:set richdocuments public_wopi_url --value="$PUBLIC_URL"
$OCC config:app:set richdocuments disable_certificate_verification --value="yes"

# 8. Brand Nextcloud Instance in Arabic ("خزنة ملفات الشركة") & Force Arabic RTL UI
$OCC config:system:set default_language --value="ar"
$OCC config:system:set force_language --value="ar"
$OCC config:system:set default_locale --value="ar_EG"
$OCC user:setting "${NEXTCLOUD_ADMIN_USER:-admin}" core lang "ar" || true
$OCC config:app:set theming name --value="خزنة ملفات الشركة" || true
$OCC config:app:set theming slogan --value="نظام التخزين السحابي وتحرير المستندات المؤسسي الآمن" || true

# 9. Run database index & missing column optimizations
$OCC db:add-missing-indices --no-interaction || true

echo "[Shehata Drive] Nextcloud configuration complete!"
