#!/usr/bin/env bash
set -euo pipefail

export GIT_SSH_COMMAND="ssh -F ${HOME}/.ssh/github-only.conf"

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_dir"

echo "==> Проверка SSH-доступа к GitHub..."
if ! ssh -F "${HOME}/.ssh/github-only.conf" -T git@github.com 2>&1 | grep -qi 'successfully authenticated'; then
  echo "SSH к GitHub не настроен или ключ не добавлен в аккаунт."
  echo "Добавьте публичный ключ в GitHub: Settings -> SSH and GPG keys"
  echo
  echo "Ваш публичный ключ:"
  cat "${HOME}/.ssh/id_ed25519.pub"
  exit 1
fi

echo "==> Проверка удалённого репозитория..."
if ! git ls-remote origin HEAD >/dev/null 2>&1; then
  echo "Репозиторий origin недоступен."
  echo "Создайте приватный репозиторий: https://github.com/TikhonBaruch/taurus"
  echo "Без README, .gitignore и license — репозиторий должен быть пустым."
  exit 1
fi

echo "==> Push ветки main..."
git push -u origin main

echo "Готово: https://github.com/TikhonBaruch/taurus"
