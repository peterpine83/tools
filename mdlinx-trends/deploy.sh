#!/bin/bash
set -euo pipefail

#######################################
# MDLinx Trends Agent — One-Command Deploy
#
# Usage: ./deploy.sh [OPTIONS]
#
# Options:
#   --profile <name>    AWS profile (default: dev)
#   --key <name>        EC2 key pair name (required)
#   --key-file <path>   Path to SSH private key (default: ~/.ssh/<key>.pem)
#   --ip <address>      Your IP (default: auto-detected)
#   --region <region>   AWS region (default: us-east-1)
#   --skip-infra        Skip SST deploy (just update agent workspace)
#   --skip-setup        Skip post-deploy setup (just deploy infra)
#   --json              JSON output for agent parsing
#   --yes               Skip confirmations
#   -h, --help          Show help
#######################################

VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Defaults
AWS_PROFILE_NAME="${AWS_PROFILE:-dev}"
KEY_NAME=""
KEY_FILE=""
MY_IP=""
REGION="us-east-1"
SKIP_INFRA=false
SKIP_SETUP=false
OUTPUT_FORMAT="text"
SKIP_CONFIRM=false
INSTANCE_IP=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1" >&2; exit 1; }
step()    { echo -e "\n${BOLD}${BLUE}── $1 ──${NC}\n"; }

usage() {
  cat << 'EOF'
MDLinx Trends Agent — One-Command Deploy

Usage: ./deploy.sh --key <ec2-keypair-name> [OPTIONS]

Required:
  --key <name>          EC2 key pair name in your AWS account

Optional:
  --profile <name>      AWS profile (default: dev)
  --key-file <path>     SSH private key path (default: ~/.ssh/<key>.pem)
  --ip <address>        Your public IP (default: auto-detect via ifconfig.me)
  --region <region>     AWS region (default: us-east-1)
  --skip-infra          Skip infrastructure deploy, just update agent files
  --skip-setup          Skip post-deploy setup, just deploy infrastructure
  --json                JSON output for agent parsing
  --yes                 Skip confirmation prompts
  -h, --help            Show this help

Examples:
  # Full deploy
  ./deploy.sh --key my-keypair

  # Update agent workspace files only (infra already deployed)
  ./deploy.sh --key my-keypair --skip-infra

  # Agent-friendly (no prompts, JSON output)
  ./deploy.sh --key my-keypair --yes --json

EOF
  exit 0
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --profile)   AWS_PROFILE_NAME="$2"; shift 2 ;;
      --key)       KEY_NAME="$2"; shift 2 ;;
      --key-file)  KEY_FILE="$2"; shift 2 ;;
      --ip)        MY_IP="$2"; shift 2 ;;
      --region)    REGION="$2"; shift 2 ;;
      --skip-infra) SKIP_INFRA=true; shift ;;
      --skip-setup) SKIP_SETUP=true; shift ;;
      --json)      OUTPUT_FORMAT="json"; shift ;;
      --yes|-y)    SKIP_CONFIRM=true; shift ;;
      -h|--help)   usage ;;
      *)           error "Unknown option: $1. Use --help for usage." ;;
    esac
  done

  [[ -z "$KEY_NAME" ]] && error "Missing required: --key <ec2-keypair-name>"
  [[ -z "$KEY_FILE" ]] && KEY_FILE="$HOME/.ssh/${KEY_NAME}.pem"
  [[ -z "$MY_IP" ]] && MY_IP=$(curl -s ifconfig.me)
}

validate_prerequisites() {
  step "Validating Prerequisites"

  # Check AWS CLI
  command -v aws &>/dev/null || error "AWS CLI not installed"
  info "AWS CLI found"

  # Check AWS credentials
  export AWS_PROFILE="$AWS_PROFILE_NAME"
  aws sts get-caller-identity &>/dev/null || error "AWS credentials invalid for profile: $AWS_PROFILE_NAME"
  local account_id=$(aws sts get-caller-identity --query Account --output text)
  info "AWS account: $account_id (profile: $AWS_PROFILE_NAME)"

  # Check Node.js
  command -v node &>/dev/null || error "Node.js not installed"
  local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  [[ "$node_version" -ge 18 ]] || error "Node.js 18+ required (found: $(node -v))"
  info "Node.js $(node -v)"

  # Check SSH key
  [[ -f "$KEY_FILE" ]] || error "SSH key not found: $KEY_FILE"
  info "SSH key: $KEY_FILE"

  # Check EC2 key pair exists
  aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" &>/dev/null \
    || error "EC2 key pair '$KEY_NAME' not found in $REGION"
  info "EC2 key pair: $KEY_NAME"

  # Check IP
  [[ -n "$MY_IP" ]] || error "Could not detect your IP"
  info "Your IP: $MY_IP"

  # Check SST directory
  [[ -d "$SCRIPT_DIR/sst" ]] || error "sst/ directory not found"
  info "SST config found"
}

confirm_deploy() {
  if [[ "$SKIP_CONFIRM" == "true" ]]; then return 0; fi

  echo ""
  echo -e "${BOLD}Deploy MDLinx Trends Agent:${NC}"
  echo "  AWS Profile:  $AWS_PROFILE_NAME"
  echo "  Region:       $REGION"
  echo "  Key Pair:     $KEY_NAME"
  echo "  SSH Key:      $KEY_FILE"
  echo "  Your IP:      $MY_IP"
  echo "  Skip Infra:   $SKIP_INFRA"
  echo "  Skip Setup:   $SKIP_SETUP"
  echo ""
  read -p "Continue? [y/N] " -n 1 -r
  echo ""
  [[ $REPLY =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }
}

deploy_infrastructure() {
  if [[ "$SKIP_INFRA" == "true" ]]; then
    info "Skipping infrastructure deploy (--skip-infra)"
    # Get existing IP from SST output
    INSTANCE_IP=$(cd "$SCRIPT_DIR/sst" && npx sst output publicIp --stage production 2>/dev/null || echo "")
    [[ -n "$INSTANCE_IP" ]] || error "Cannot find existing instance IP. Run without --skip-infra first."
    info "Existing instance: $INSTANCE_IP"
    return 0
  fi

  step "Deploying Infrastructure (SST)"

  cd "$SCRIPT_DIR/sst"
  npm install --silent

  # Set secrets
  info "Setting SST secrets..."
  npx sst secret set KeyName "$KEY_NAME" --stage production 2>/dev/null
  npx sst secret set AllowedIP "$MY_IP" --stage production 2>/dev/null

  # Deploy
  info "Running sst deploy (this takes 2-3 minutes)..."
  npx sst deploy --stage production

  # Get outputs
  INSTANCE_IP=$(npx sst output publicIp --stage production)
  info "Instance IP: $INSTANCE_IP"

  cd "$SCRIPT_DIR"
}

wait_for_bootstrap() {
  step "Waiting for Instance Bootstrap"

  info "Waiting for SSH to be available..."
  local max_attempts=30
  local attempt=0
  while [[ $attempt -lt $max_attempts ]]; do
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i "$KEY_FILE" ubuntu@"$INSTANCE_IP" 'echo ok' &>/dev/null; then
      break
    fi
    attempt=$((attempt + 1))
    echo -n "."
    sleep 10
  done
  echo ""
  [[ $attempt -lt $max_attempts ]] || error "SSH never became available after 5 minutes"
  info "SSH connected"

  info "Waiting for cloud-init to complete (3-5 min)..."
  ssh -o StrictHostKeyChecking=no -i "$KEY_FILE" ubuntu@"$INSTANCE_IP" \
    'while [ ! -f /home/ubuntu/setup-complete.txt ]; do echo -n "."; sleep 10; done; echo ""'
  info "Bootstrap complete"
}

copy_workspace() {
  step "Copying Agent Workspace"

  local remote="ubuntu@$INSTANCE_IP"
  local ssh_opts="-o StrictHostKeyChecking=no -i $KEY_FILE"

  # Ensure directories exist
  ssh $ssh_opts "$remote" 'mkdir -p ~/.openclaw/workspace/memory ~/.openclaw/workspace/templates ~/.openclaw/workspace/skills'

  # Copy workspace files
  info "Copying workspace files..."
  scp $ssh_opts -r "$SCRIPT_DIR/agent/workspace/"* "$remote":~/.openclaw/workspace/

  # Copy OpenClaw config
  info "Copying OpenClaw config..."
  scp $ssh_opts "$SCRIPT_DIR/agent/_config/openclaw.json" "$remote":~/.openclaw/openclaw.json

  # Fix ownership
  ssh $ssh_opts "$remote" 'sudo chown -R ubuntu:ubuntu ~/.openclaw'

  info "Workspace files deployed"
}

install_browser() {
  step "Installing Headless Browser"

  local remote="ubuntu@$INSTANCE_IP"
  local ssh_opts="-o StrictHostKeyChecking=no -i $KEY_FILE"

  ssh $ssh_opts "$remote" << 'REMOTE_SCRIPT'
    # Check if already installed
    if command -v chromium-browser &>/dev/null; then
      echo "Chromium already installed: $(chromium-browser --version)"
      exit 0
    fi

    echo "Installing Chromium..."
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
      chromium-browser \
      fonts-liberation \
      libnss3 \
      libatk-bridge2.0-0 \
      libdrm2 \
      libxkbcommon0 \
      libgbm1 \
      libasound2t64 2>/dev/null || \
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
      chromium-browser \
      fonts-liberation \
      libnss3 \
      libatk-bridge2.0-0 \
      libdrm2 \
      libxkbcommon0 \
      libgbm1 \
      libasound2

    echo "Chromium installed: $(chromium-browser --version)"
REMOTE_SCRIPT

  info "Headless browser installed"
}

verify_deployment() {
  step "Verifying Deployment"

  local remote="ubuntu@$INSTANCE_IP"
  local ssh_opts="-o StrictHostKeyChecking=no -i $KEY_FILE"

  ssh $ssh_opts "$remote" << 'VERIFY'
    echo "=== Verification ==="

    # Node.js
    echo -n "Node.js: "
    node --version 2>/dev/null || echo "NOT INSTALLED"

    # OpenClaw
    echo -n "OpenClaw: "
    openclaw --version 2>/dev/null || echo "NOT INSTALLED"

    # Claude Code
    echo -n "Claude Code: "
    claude --version 2>/dev/null || echo "NOT INSTALLED"

    # Chromium
    echo -n "Chromium: "
    chromium-browser --version 2>/dev/null || echo "NOT INSTALLED"

    # Workspace files
    echo ""
    echo "Workspace files:"
    ls -la ~/.openclaw/workspace/ 2>/dev/null || echo "  NOT FOUND"

    echo ""
    echo "Skills:"
    ls -la ~/.openclaw/workspace/skills/ 2>/dev/null || echo "  NOT FOUND"

    echo ""
    echo "Templates:"
    ls -la ~/.openclaw/workspace/templates/ 2>/dev/null || echo "  NOT FOUND"

    # Config
    echo ""
    echo "OpenClaw config:"
    cat ~/.openclaw/openclaw.json 2>/dev/null || echo "  NOT FOUND"

    # PubMed API reachability
    echo ""
    echo -n "PubMed API: "
    curl -s --connect-timeout 5 "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=1&term=test" | jq -r '.esearchresult.count // "UNREACHABLE"' 2>/dev/null || echo "UNREACHABLE"

    echo ""
    echo "=== Verification Complete ==="
VERIFY

  info "Deployment verified"
}

print_summary() {
  step "Deployment Complete"

  if [[ "$OUTPUT_FORMAT" == "json" ]]; then
    cat << EOF
{
  "status": "success",
  "instanceIp": "$INSTANCE_IP",
  "sshCommand": "ssh -i $KEY_FILE ubuntu@$INSTANCE_IP",
  "nextSteps": [
    "SSH in: ssh -i $KEY_FILE ubuntu@$INSTANCE_IP",
    "Authenticate Claude: claude login",
    "Start OpenClaw: sudo systemctl enable --now openclaw",
    "Verify: openclaw-status"
  ]
}
EOF
  else
    echo ""
    echo -e "${GREEN}${BOLD}MDLinx Trends Agent deployed successfully!${NC}"
    echo ""
    echo -e "  ${BOLD}Instance IP:${NC}  $INSTANCE_IP"
    echo -e "  ${BOLD}SSH Command:${NC}  ssh -i $KEY_FILE ubuntu@$INSTANCE_IP"
    echo ""
    echo -e "${BOLD}Remaining manual steps:${NC}"
    echo ""
    echo -e "  1. SSH in:"
    echo -e "     ${BLUE}ssh -i $KEY_FILE ubuntu@$INSTANCE_IP${NC}"
    echo ""
    echo -e "  2. Authenticate Claude Code (use your WORK Claude Max account):"
    echo -e "     ${BLUE}claude login${NC}"
    echo ""
    echo -e "  3. Start the OpenClaw service:"
    echo -e "     ${BLUE}sudo systemctl enable --now openclaw${NC}"
    echo ""
    echo -e "  4. Verify everything is running:"
    echo -e "     ${BLUE}openclaw-status${NC}"
    echo ""
    echo -e "  5. Test the agent:"
    echo -e "     ${BLUE}openclaw chat${NC}"
    echo -e "     Then ask: ${YELLOW}\"What medical misinformation topics are trending right now?\"${NC}"
    echo ""
  fi
}

# ─── Main ─────────────────────────────────────────────────
main() {
  parse_args "$@"

  echo -e "${BOLD}MDLinx Trends Agent — Deploy v${VERSION}${NC}"
  echo ""

  validate_prerequisites
  confirm_deploy
  deploy_infrastructure

  if [[ "$SKIP_SETUP" == "true" ]]; then
    info "Skipping post-deploy setup (--skip-setup)"
    print_summary
    exit 0
  fi

  wait_for_bootstrap
  install_browser
  copy_workspace
  verify_deployment
  print_summary
}

main "$@"
