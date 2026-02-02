#!/bin/bash
set -euo pipefail

#######################################
# OpenClaw Work Instance Setup Script
# For Ubuntu 22.04/24.04 on AWS EC2
#######################################

OPENCLAW_USER="${OPENCLAW_USER:-ubuntu}"
WORKSPACE_DIR="/home/${OPENCLAW_USER}/.openclaw/workspace"

echo "=========================================="
echo "  OpenClaw Work Instance Setup"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
    error "Don't run this script as root. Run as your regular user (it will use sudo when needed)."
fi

#######################################
# Step 1: System Updates
#######################################
info "Updating system packages..."
sudo apt update && sudo apt upgrade -y

#######################################
# Step 2: Install Dependencies
#######################################
info "Installing dependencies..."
sudo apt install -y \
    curl \
    git \
    build-essential \
    unzip \
    jq \
    htop \
    tmux

#######################################
# Step 3: Install Node.js 20 LTS
#######################################
if command -v node &> /dev/null && [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -ge 20 ]]; then
    info "Node.js $(node -v) already installed"
else
    info "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

info "Node.js version: $(node -v)"
info "npm version: $(npm -v)"

#######################################
# Step 4: Install OpenClaw
#######################################
info "Installing OpenClaw..."
sudo npm install -g openclaw

#######################################
# Step 5: Install Claude Code CLI
#######################################
info "Installing Claude Code CLI..."
sudo npm install -g @anthropic-ai/claude-code

#######################################
# Step 6: Initialize OpenClaw
#######################################
info "Initializing OpenClaw..."
if [[ ! -d "/home/${OPENCLAW_USER}/.openclaw" ]]; then
    openclaw init --non-interactive || true
fi

# Create workspace directory
mkdir -p "${WORKSPACE_DIR}"

#######################################
# Step 7: Create systemd service
#######################################
info "Creating systemd service..."
sudo tee /etc/systemd/system/openclaw.service > /dev/null << EOF
[Unit]
Description=OpenClaw Gateway
After=network.target
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
User=${OPENCLAW_USER}
Group=${OPENCLAW_USER}
WorkingDirectory=/home/${OPENCLAW_USER}
ExecStart=$(which openclaw) gateway start --foreground
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openclaw

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/${OPENCLAW_USER}/.openclaw
PrivateTmp=true

# Environment
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload

#######################################
# Step 8: Create helper scripts
#######################################
info "Creating helper scripts..."

# Logs viewer
sudo tee /usr/local/bin/openclaw-logs > /dev/null << 'EOF'
#!/bin/bash
journalctl -u openclaw -f --no-hostname
EOF
sudo chmod +x /usr/local/bin/openclaw-logs

# Status checker
sudo tee /usr/local/bin/openclaw-status > /dev/null << 'EOF'
#!/bin/bash
echo "=== OpenClaw Service Status ==="
systemctl status openclaw --no-pager
echo ""
echo "=== Recent Logs ==="
journalctl -u openclaw -n 20 --no-pager --no-hostname
EOF
sudo chmod +x /usr/local/bin/openclaw-status

#######################################
# Step 9: Setup workspace files
#######################################
info "Setting up workspace files..."

# AGENTS.md
cat > "${WORKSPACE_DIR}/AGENTS.md" << 'EOF'
# AGENTS.md - Work OpenClaw Instance

This is the work instance of OpenClaw.

## Session Start
1. Read SOUL.md
2. Read USER.md  
3. Check memory/YYYY-MM-DD.md for recent context

## Guidelines
- This instance is for work projects only
- Keep work and personal separate
- Bill to work OAuth token

## Memory
- Daily notes: memory/YYYY-MM-DD.md
- Long-term: MEMORY.md
EOF

# SOUL.md
cat > "${WORKSPACE_DIR}/SOUL.md" << 'EOF'
# SOUL.md - Work Instance

You are a work-focused AI assistant.

## Core Principles
- Professional and efficient
- Focus on work projects and tasks
- Keep responses concise and actionable
- Don't mix personal and work contexts

## Boundaries
- Work projects only
- Professional communication
- Respect company policies
EOF

# USER.md
cat > "${WORKSPACE_DIR}/USER.md" << 'EOF'
# USER.md - About the User

- **Name:** [Your name]
- **Role:** [Your role]
- **Team:** [Your team]
- **Timezone:** America/New_York

## Work Context
[Add your work context here]
EOF

# MEMORY.md
cat > "${WORKSPACE_DIR}/MEMORY.md" << 'EOF'
# MEMORY.md - Work Long-Term Memory

*Last updated: [Date]*

## Active Projects
[Add projects here]

## Key Decisions
[Track important decisions]

## Notes
[Other important context]
EOF

# Create memory directory
mkdir -p "${WORKSPACE_DIR}/memory"

#######################################
# Summary
#######################################
echo ""
echo "=========================================="
echo -e "${GREEN}  Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Authenticate Claude Code with your WORK account:"
echo "   $ claude login"
echo "   (Use your work OAuth credentials)"
echo ""
echo "2. Configure OpenClaw:"
echo "   $ openclaw config"
echo ""
echo "3. Start the service:"
echo "   $ sudo systemctl start openclaw"
echo "   $ sudo systemctl enable openclaw"
echo ""
echo "Useful commands:"
echo "  openclaw-status  - Check service status"
echo "  openclaw-logs    - Follow live logs"
echo "  openclaw config  - Edit configuration"
echo ""
echo "Workspace: ${WORKSPACE_DIR}"
echo ""
