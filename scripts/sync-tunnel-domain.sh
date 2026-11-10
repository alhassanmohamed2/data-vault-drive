#!/usr/bin/env bash
# ==============================================================================
# Shehata Drive - Sync Cloudflare Tunnel URL with Nextcloud Trusted Domains
# Usage: ./scripts/sync-tunnel-domain.sh https://example-name.trycloudflare.com
# ==============================================================================
set -euo pipefail

TUNNEL_URL="${1:-}"
if [ -z "$TUNNEL_URL" ]; then
  echo "Usage: $0 <https://your-tunnel.trycloudflare.com>"
  exit 1
fi

TUNNEL_HOST=$(echo "$TUNNEL_URL" | sed -E 's|^https?://||' | sed -E 's|/.*$||')

echo "[Shehata Drive] Registering Cloudflare Tunnel domain ($TUNNEL_HOST) in Nextcloud..."

OCC="docker compose exec -T -u www-data nextcloud php /var/www/html/occ"

$OCC config:system:set trusted_domains 10 --value="$TUNNEL_HOST"
$OCC config:system:set trusted_domains 11 --value="*.trycloudflare.com"
$OCC config:system:set overwrite.cli.url --value="https://$TUNNEL_HOST"
$OCC config:system:set overwriteprotocol --value="https"
$OCC config:app:set richdocuments wopi_url --value="https://$TUNNEL_HOST" || true
$OCC config:app:set richdocuments public_wopi_url --value="https://$TUNNEL_HOST" || true
$OCC richdocuments:activate-config || true

echo "[Shehata Drive] Tunnel domain registered! Nextcloud & Collabora are ready at:"
echo "  -> Drive:         https://$TUNNEL_HOST"
echo "  -> Audit Center:  https://$TUNNEL_HOST/audit-portal/"
