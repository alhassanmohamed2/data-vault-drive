#!/usr/bin/env bash
# ==============================================================================
# Shehata Drive - Host VPS Tuning Script for 4 vCPU / 8 GB RAM Linux Server
# Run with: sudo bash scripts/setup-vps.sh
# ==============================================================================
set -euo pipefail

echo "=== Shehata Drive: Optimizing 4 vCPU / 8 GB RAM VPS ==="

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run this script as root or with sudo: sudo bash scripts/setup-vps.sh"
  exit 1
fi

# 1. Create a 4 GB Swap File if none exists (Safety net against OOM when Collabora + Previews peak)
if [ "$(swapon --show | wc -l)" -eq 0 ]; then
  echo "[1/3] Creating 4 GB Swapfile for memory burst protection..."
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  if ! grep -q "/swapfile" /etc/fstab; then
    echo "/swapfile none swap sw 0 0" >> /etc/fstab
  fi
  echo "      Swapfile activated."
else
  echo "[1/3] Swap already active. Skipping swap creation."
fi

# 2. Kernel Sysctl Tuning for Redis, PostgreSQL, and File Watchers
echo "[2/3] Applying sysctl kernel optimizations..."
cat <<EOF > /etc/sysctl.d/99-shehata-drive.conf
# Allow Redis background saves without memory overcommit errors
vm.overcommit_memory = 1

# Keep pages in RAM unless necessary (ideal for 8 GB RAM VPS)
vm.swappiness = 10
vm.vfs_cache_pressure = 50

# Increase file watcher limits for large file trees & desktop sync
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 512
fs.file-max = 2097152

# Network buffer optimizations for large file uploads/downloads
net.core.somaxconn = 4096
net.ipv4.tcp_fastopen = 3
EOF

sysctl --system >/dev/null

# 3. Verify Docker & Docker Compose availability
echo "[3/3] Checking Docker installation..."
if command -v docker >/dev/null 2>&1; then
  echo "      Docker is installed: $(docker --version)"
else
  echo "      WARNING: Docker is not installed yet. Install Docker Engine via https://get.docker.com"
fi

echo "=== VPS Optimization Complete! ==="
