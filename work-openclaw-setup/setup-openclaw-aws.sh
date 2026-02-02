#!/bin/bash
set -euo pipefail

#######################################
# OpenClaw Work Instance Setup Script
# For Ubuntu 22.04/24.04 on AWS EC2
#
# AGENT-FRIENDLY: All options via flags
# Run with --help for usage
#######################################

VERSION="1.0.0"

# Defaults
OPENCLAW_USER="${OPENCLAW_USER:-ubuntu}"
WORKSPACE_DIR="/home/${OPENCLAW_USER}/.openclaw/workspace"
OUTPUT_FORMAT="text"  # text or json
SKIP_CONFIRM="false"

# Colors (disabled for json output)
setup_colors() {
  if [[ "$OUTPUT_FORMAT" == "text" ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
  else
    RED='' GREEN='' YELLOW='' BLUE='' NC=''
  fi
}

# Output functions
info() { 
  if [[ "$OUTPUT_FORMAT" == "json" ]]; then
    echo "{\"level\":\"info\",\"message\":\"$1\"}"
  else
    echo -e "${GREEN}[INFO]${NC} $1"
  fi
}

warn() { 
  if [[ "$OUTPUT_FORMAT" == "json" ]]; then
    echo "{\"level\":\"warn\",\"message\":\"$1\"}"
  else
    echo -e "${YELLOW}[WARN]${NC} $1"
  fi
}

error() { 
  if [[ "$OUTPUT_FORMAT" == "json" ]]; then
    echo "{\"level\":\"error\",\"message\":\"$1\",\"exit_code\":1}"
  else
    echo -e "${RED}[ERROR]${NC} $1" >&2
  fi
  exit 1
}

success() {
  if [[ "$OUTPUT_FORMAT" == "json" ]]; then
    echo "{\"level\":\"success\",\"message\":\"$1\"}"
  else
    echo -e "${GREEN}[SUCCESS]${NC} $1"
  fi
}

# Usage
usage() {
  cat << 'EOF'
Usage: setup-openclaw-aws.sh [OPTIONS]

Deploy OpenClaw on an Ubuntu EC2 instance.

OPTIONS:
  -u, --user USERNAME     System user for OpenClaw (default: ubuntu)
  -y, --yes               Skip confirmation prompts
  --json                  Output in JSON format (for agent parsing)
  -h, --help              Show this help message
  -v, --version           Show version

EXAMPLES:
  # Standard interactive install
  ./setup-openclaw-aws.sh

  # Non-interactive install (for agents)
  ./setup-openclaw-aws.sh --yes

  # JSON output for parsing
  ./setup-openclaw-aws.sh --yes --json

PREREQUISITES:
  - Ubuntu 22.04 or 24.04
  - Run as non-root user with sudo access
  - Internet connectivity

POST-INSTALL STEPS (required):
  1. claude login          # Authenticate with your OAuth account
  2. openclaw config       # Configure OpenClaw settings
  3. sudo systemctl enable --now openclaw  # Start the service

VERIFICATION:
  openclaw-status          # Check service status
  openclaw-logs            # Follow live logs

EOF
  exit 0
}

# Parse arguments
parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      -u|--user)
        OPENCLAW_USER="$2"
        WORKSPACE_DIR="/home/${OPENCLAW_USER}/.openclaw/workspace"
        shift 2
        ;;
      -y|--yes)
        SKIP_CONFIRM="true"
        shift
        ;;
      --json)
        OUTPUT_FORMAT="json"
        shift
        ;;
      -h|--help)
        usage
        ;;
      -v|--version)
        echo "$VERSION"
        exit 0
        ;;
      *)
        error "Unknown option: $1. Use --help for usage."
        ;;
    esac
  done
}

# Check prerequisites
check_prerequisites() {
  info "Checking prerequisites..."
  
  local errors=()
  
  # Check not root
  if [[ $EUID -eq 0 ]]; then
    errors+=("Do not run as root. Run as regular user with sudo access.")
  fi
  
  # Check sudo access
  if ! sudo -n true 2>/dev/null; then
    if [[ "$SKIP_CONFIRM" == "true" ]]; then
      errors+=("User lacks passwordless sudo. Run 'sudo echo test' first or add NOPASSWD to sudoers.")
    fi
  fi
  
  # Check OS
  if [[ -f /etc/os-release ]]; then
    source /etc/os-release
    if [[ "$ID" != "ubuntu" ]]; then
      errors+=("This script is designed for Ubuntu. Detected: $ID")
    fi
  else
    errors+=("Cannot detect OS. /etc/os-release not found.")
  fi
  
  # Check internet
  if ! curl -s --connect-timeout 5 https://nodejs.org > /dev/null; then
    errors+=("No internet connectivity. Cannot reach nodejs.org")
  fi
  
  # Report errors
  if [[ ${#errors[@]} -gt 0 ]]; then
    for err in "${errors[@]}"; do
      if [[ "$OUTPUT_FORMAT" == "json" ]]; then
        echo "{\"level\":\"error\",\"check\":\"prerequisite\",\"message\":\"$err\"}"
      else
        echo -e "${RED}[PREREQ FAIL]${NC} $err" >&2
      fi
    done
    exit 1
  fi
  
  info "Prerequisites OK"
}

# Confirm before proceeding
confirm() {
  if [[ "$SKIP_CONFIRM" == "true" ]]; then
    return 0
  fi
  
  echo ""
  echo "This script will install:"
  echo "  - Node.js 20 LTS"
  echo "  - OpenClaw"
  echo "  - Claude Code CLI"
  echo "  - Systemd service"
  echo ""
  read -p "Continue? [y/N] " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    info "Aborted by user"
    exit 0
  fi
}

# Main installation
install_packages() {
  info "Updating system packages..."
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
  
  info "Installing dependencies..."
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    curl \
    git \
    build-essential \
    unzip \
    jq \
    htop \
    tmux
}

install_nodejs() {
  if command -v node &> /dev/null && [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -ge 20 ]]; then
    info "Node.js $(node -v) already installed"
  else
    info "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs
  fi
}

install_openclaw() {
  info "Installing OpenClaw..."
  sudo npm install -g openclaw --silent
  
  info "Installing Claude Code CLI..."
  sudo npm install -g @anthropic-ai/claude-code --silent
}

initialize_openclaw() {
  info "Initializing OpenClaw..."
  if [[ ! -d "/home/${OPENCLAW_USER}/.openclaw" ]]; then
    sudo -u "$OPENCLAW_USER" openclaw init --non-interactive 2>/dev/null || true
  fi
  
  mkdir -p "${WORKSPACE_DIR}/memory"
  
  # Create workspace files
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
EOF

  cat > "${WORKSPACE_DIR}/SOUL.md" << 'EOF'
# SOUL.md - Work Instance

You are a work-focused AI assistant.

## Core Principles
- Professional and efficient
- Focus on work projects and tasks
- Keep responses concise and actionable
- Don't mix personal and work contexts
EOF

  cat > "${WORKSPACE_DIR}/USER.md" << 'EOF'
# USER.md - About the User

- **Name:** [Your name]
- **Role:** [Your role]
- **Team:** [Your team]
- **Timezone:** [Your timezone]

## Work Context
[Add your work context here]
EOF

  cat > "${WORKSPACE_DIR}/MEMORY.md" << 'EOF'
# MEMORY.md - Work Long-Term Memory

## Active Projects
[Add projects here]

## Key Decisions
[Track important decisions]
EOF

  chown -R "${OPENCLAW_USER}:${OPENCLAW_USER}" "/home/${OPENCLAW_USER}/.openclaw"
}

setup_systemd() {
  info "Creating systemd service..."
  
  local openclaw_path
  openclaw_path=$(which openclaw)
  
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
ExecStart=${openclaw_path} gateway start --foreground
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openclaw
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/${OPENCLAW_USER}/.openclaw
PrivateTmp=true
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
}

setup_helpers() {
  info "Creating helper scripts..."
  
  sudo tee /usr/local/bin/openclaw-logs > /dev/null << 'EOF'
#!/bin/bash
journalctl -u openclaw -f --no-hostname "$@"
EOF
  sudo chmod +x /usr/local/bin/openclaw-logs
  
  sudo tee /usr/local/bin/openclaw-status > /dev/null << 'EOF'
#!/bin/bash
echo "=== OpenClaw Service Status ==="
systemctl status openclaw --no-pager || true
echo ""
echo "=== Recent Logs ==="
journalctl -u openclaw -n 20 --no-pager --no-hostname
EOF
  sudo chmod +x /usr/local/bin/openclaw-status
}

# Final output
print_summary() {
  if [[ "$OUTPUT_FORMAT" == "json" ]]; then
    cat << EOF
{
  "status": "success",
  "message": "OpenClaw setup complete",
  "workspace": "${WORKSPACE_DIR}",
  "next_steps": [
    {"step": 1, "command": "claude login", "description": "Authenticate Claude Code with your OAuth account"},
    {"step": 2, "command": "openclaw config", "description": "Configure OpenClaw settings"},
    {"step": 3, "command": "sudo systemctl enable --now openclaw", "description": "Start the OpenClaw service"}
  ],
  "verification": {
    "command": "openclaw-status",
    "description": "Check service status and recent logs"
  },
  "helper_commands": ["openclaw-status", "openclaw-logs"]
}
EOF
  else
    echo ""
    echo "=========================================="
    echo -e "${GREEN}  Setup Complete!${NC}"
    echo "=========================================="
    echo ""
    echo "NEXT STEPS (required):"
    echo ""
    echo "  1. Authenticate Claude Code with your account:"
    echo "     ${BLUE}claude login${NC}"
    echo ""
    echo "  2. Configure OpenClaw:"
    echo "     ${BLUE}openclaw config${NC}"
    echo ""
    echo "  3. Start the service:"
    echo "     ${BLUE}sudo systemctl enable --now openclaw${NC}"
    echo ""
    echo "VERIFICATION:"
    echo "  ${BLUE}openclaw-status${NC}  - Check service status"
    echo "  ${BLUE}openclaw-logs${NC}    - Follow live logs"
    echo ""
    echo "Workspace: ${WORKSPACE_DIR}"
    echo ""
  fi
}

# Main
main() {
  parse_args "$@"
  setup_colors
  
  if [[ "$OUTPUT_FORMAT" == "json" ]]; then
    echo "{\"level\":\"info\",\"message\":\"OpenClaw AWS Setup v${VERSION}\"}"
  else
    echo "=========================================="
    echo "  OpenClaw Work Instance Setup v${VERSION}"
    echo "=========================================="
  fi
  
  check_prerequisites
  confirm
  
  install_packages
  install_nodejs
  install_openclaw
  initialize_openclaw
  setup_systemd
  setup_helpers
  
  print_summary
}

main "$@"
