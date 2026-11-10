#!/usr/bin/env bash
# ==============================================================================
# Company Files Vault - Auto-Configure Host Nginx with Existing Cloudflare Cert
# Usage: sudo bash scripts/setup-host-nginx.sh drive.yourdomain.com [ssl_cert_path] [ssl_key_path]
# ==============================================================================
set -euo pipefail

DOMAIN="${1:-}"
CERT_PATH="${2:-}"
KEY_PATH="${3:-}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: sudo bash scripts/setup-host-nginx.sh <subdomain.yourdomain.com> [optional_cert_path] [optional_key_path]"
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root: sudo bash scripts/setup-host-nginx.sh $DOMAIN"
  exit 1
fi

# 1. Auto-detect existing ssl_certificate and ssl_certificate_key from /etc/nginx if not passed
if [ -z "$CERT_PATH" ] || [ -z "$KEY_PATH" ]; then
  echo "[1/4] Searching existing /etc/nginx configs for your Cloudflare SSL certificate..."
  DETECTED_CERT=$(grep -rhE "^\s*ssl_certificate\s+" /etc/nginx/ 2>/dev/null | head -n 1 | awk '{print $2}' | tr -d ';')
  DETECTED_KEY=$(grep -rhE "^\s*ssl_certificate_key\s+" /etc/nginx/ 2>/dev/null | head -n 1 | awk '{print $2}' | tr -d ';')

  if [ -n "$DETECTED_CERT" ] && [ -f "$DETECTED_CERT" ] && [ -n "$DETECTED_KEY" ] && [ -f "$DETECTED_KEY" ]; then
    CERT_PATH="$DETECTED_CERT"
    KEY_PATH="$DETECTED_KEY"
    echo "      Found existing SSL Certificate: $CERT_PATH"
    echo "      Found existing SSL Key:         $KEY_PATH"
  else
    echo "ERROR: Could not auto-detect existing SSL certificate in /etc/nginx."
    echo "Please pass the paths explicitly:"
    echo "  sudo bash scripts/setup-host-nginx.sh $DOMAIN /path/to/cert.pem /path/to/key.pem"
    exit 1
  fi
fi

# 2. Write Nginx vhost config
NGINX_CONF="/etc/nginx/conf.d/${DOMAIN}.conf"
if [ -d "/etc/nginx/sites-available" ] && [ -d "/etc/nginx/sites-enabled" ]; then
  NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}.conf"
fi

echo "[2/4] Creating Nginx configuration at ${NGINX_CONF}..."
cat <<EOF > "$NGINX_CONF"
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     ${CERT_PATH};
    ssl_certificate_key ${KEY_PATH};
    ssl_protocols       TLSv1.2 TLSv1.3;

    client_max_body_size 16G;
    fastcgi_buffers 64 4K;
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_connect_timeout 3600s;

    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-Host \$host;
    proxy_set_header CF-Connecting-IP \$http_cf_connecting_ip;

    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "Upgrade";

    location / {
        proxy_pass http://127.0.0.1:18440;
    }
}
EOF

if [ -d "/etc/nginx/sites-enabled" ] && [ "$NGINX_CONF" = "/etc/nginx/sites-available/${DOMAIN}.conf" ]; then
  ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${DOMAIN}.conf"
fi

# 3. Test and reload host Nginx
echo "[3/4] Testing and reloading host Nginx..."
nginx -t
systemctl reload nginx

# 4. Register domain in Nextcloud & Collabora WOPI
echo "[4/4] Registering https://${DOMAIN} in Nextcloud & Collabora..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/sync-tunnel-domain.sh" "https://${DOMAIN}"

echo "=============================================================================="
echo "SUCCESS! ${DOMAIN} is now live via Host Nginx + Cloudflare SSL!"
echo "IMPORTANT: In Cloudflare Dashboard, DELETE/DISABLE the Origin Rule that"
echo "changed the port to 18440 (let Cloudflare hit standard port 443 on Nginx)."
echo "  -> Drive:         https://${DOMAIN}"
echo "  -> Audit Console: https://${DOMAIN}/audit-portal/"
echo "=============================================================================="
