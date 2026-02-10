#!/bin/bash
# Deploy Cloudflare Email Worker for mas0n1x.online
# Usage: ./deploy.sh [CF_API_TOKEN]
# If no token is provided, it will be read from .env file

set -e

if [ -n "$1" ]; then
    CF_API_TOKEN="$1"
else
    CF_API_TOKEN=$(grep CLOUDFLARE_API_TOKEN /srv/homelab-dashboard/.env | cut -d= -f2)
    if [ -z "$CF_API_TOKEN" ]; then
        echo "Error: CLOUDFLARE_API_TOKEN not found in .env file and not provided as argument"
        echo "Usage: ./deploy.sh [CF_API_TOKEN]"
        exit 1
    fi
fi
ACCOUNT_ID="2916e63238fd7f5347e2b5a250125c9b"
ZONE_ID="39c3eed9b086cd9452316d4df82dd0f3"
WORKER_NAME="mail-inbound"
WEBHOOK_URL="https://dash.mas0n1x.online/api/mail/inbound"
WEBHOOK_SECRET=$(grep MAIL_WEBHOOK_SECRET /srv/homelab-dashboard/.env | cut -d= -f2)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Deploying Email Worker ==="

# Upload worker script with metadata
python3 << PYEOF
import urllib.request, json

account_id = "${ACCOUNT_ID}"
worker_name = "${WORKER_NAME}"

headers = {
    "Authorization": "Bearer ${CF_API_TOKEN}",
}

# Read worker script
with open("${SCRIPT_DIR}/mail-inbound.js") as f:
    script = f.read()

# Create multipart form data for worker with bindings
import io

boundary = "----WorkerBoundary123456"

metadata = json.dumps({
    "main_module": "mail-inbound.js",
    "bindings": [
        {"type": "secret_text", "name": "WEBHOOK_URL", "text": "${WEBHOOK_URL}"},
        {"type": "secret_text", "name": "WEBHOOK_SECRET", "text": "${WEBHOOK_SECRET}"}
    ],
    "compatibility_date": "2024-01-01"
})

body = ""
body += f"--{boundary}\r\n"
body += 'Content-Disposition: form-data; name="metadata"; filename="metadata.json"\r\n'
body += "Content-Type: application/json\r\n\r\n"
body += metadata + "\r\n"
body += f"--{boundary}\r\n"
body += 'Content-Disposition: form-data; name="script"; filename="mail-inbound.js"\r\n'
body += "Content-Type: application/javascript+module\r\n\r\n"
body += script + "\r\n"
body += f"--{boundary}--\r\n"

headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"

req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts/{worker_name}",
    data=body.encode(),
    headers=headers,
    method="PUT"
)

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        print(f"Worker deployed: success={data['success']}")
except urllib.error.HTTPError as e:
    print(f"Error {e.code}: {e.read().decode()[:500]}")
    raise SystemExit(1)
PYEOF

echo ""
echo "=== Creating catch-all Email Routing rule ==="

python3 << PYEOF
import urllib.request, json

zone_id = "${ZONE_ID}"
headers = {
    "Authorization": "Bearer ${CF_API_TOKEN}",
    "Content-Type": "application/json"
}

# Create catch-all rule to forward to worker
rule = {
    "enabled": True,
    "matchers": [{"type": "all"}],
    "actions": [{"type": "worker", "value": ["${WORKER_NAME}"]}],
    "name": "Catch-all to mail-inbound worker"
}

req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/zones/{zone_id}/email/routing/rules",
    data=json.dumps(rule).encode(),
    headers=headers,
    method="POST"
)

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        print(f"Catch-all rule created: success={data['success']}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    if "already exists" in body.lower():
        print("Catch-all rule already exists")
    else:
        print(f"Error {e.code}: {body[:500]}")
PYEOF

echo ""
echo "=== Done! ==="
echo "Emails to *@mas0n1x.online will now be forwarded to your dashboard."
