#!/bin/sh
set -e

echo "==> Checking nginx configuration..."
nginx -t

echo "==> Starting nginx..."
nginx

echo "==> Verifying nginx is running..."
sleep 2
if ! pgrep nginx > /dev/null; then
    echo "ERROR: nginx failed to start"
    exit 1
fi

echo "==> Listing files in /usr/share/nginx/html..."
ls -la /usr/share/nginx/html

echo "==> Starting Node.js backend..."
cd /app
exec node server.js
