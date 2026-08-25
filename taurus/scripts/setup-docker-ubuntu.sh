#!/usr/bin/env bash
# Install Docker Engine + Compose on Ubuntu (needs sudo once).
# Then: npm run docker:full && npm run smoke:gateway
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo:  sudo bash scripts/setup-docker-ubuntu.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y docker.io docker-compose-v2 uidmap

systemctl enable --now docker

# Allow invoking user (SUDO_USER) to use docker without root
if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
  usermod -aG docker "${SUDO_USER}"
  echo "Added ${SUDO_USER} to group docker — log out/in (or: newgrp docker)"
fi

docker --version
docker compose version

echo ""
echo "Next (as your user, after newgrp docker):"
echo "  cd $(dirname "$0")/.."
echo "  cp -n docker.env.example .env   # if needed"
echo "  npm run docker:full"
echo "  TEST_API_URL=http://localhost:8080 NEXTAUTH_URL=http://localhost:8080 npm run smoke:gateway"
