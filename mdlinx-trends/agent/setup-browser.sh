#!/bin/bash
set -euo pipefail

# Install Chromium for headless browser on Ubuntu VPS
echo "=== Installing Chromium for OpenClaw browser ==="

# Install Chromium + dependencies
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  chromium-browser \
  fonts-liberation \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libgbm1 \
  libasound2t64

echo "Chromium installed at: $(which chromium-browser)"

# Configure OpenClaw browser for headless mode
# This gets added to ~/.openclaw/openclaw.json
cat << 'EOF'

Add this to your openclaw.json config:

{
  "browser": {
    "enabled": true,
    "defaultProfile": "openclaw",
    "headless": true,
    "noSandbox": true,
    "executablePath": "/usr/bin/chromium-browser",
    "profiles": {
      "openclaw": {
        "cdpPort": 18800
      }
    }
  }
}

EOF

echo "=== Browser setup complete ==="
