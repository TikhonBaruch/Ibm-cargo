#!/bin/sh
set -e
# Local VED uploads (no S3): ensure dir exists and is writable by nextjs (incl. bind mounts).
mkdir -p /app/public/uploads/ved
chown -R nextjs:nodejs /app/public/uploads
exec su-exec nextjs:nodejs "$@"
