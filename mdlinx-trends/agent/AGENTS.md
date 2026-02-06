# AGENTS.md — MDLinx Trends Agent Setup

This document is the canonical reference for deploying the MDLinx Trends Agent.
An AI coding agent (Claude Code, Codex, etc.) should be able to read this file
and execute the full deployment without human intervention.

## Overview

Deploy a security-hardened OpenClaw instance on AWS that monitors trending
medical misinformation and generates evidence-based content for editorial teams.

## Prerequisites

| Requirement | Check Command | Expected |
|-------------|---------------|----------|
| AWS CLI configured | `aws sts get-caller-identity` | Shows DEV account ID |
| AWS profile set | `echo $AWS_PROFILE` | `dev` or your dev profile |
| SST v3 installed | `npx sst version` | v3.x |
| Node.js 22+ | `node --version` | v22.x+ |
| EC2 key pair exists | `aws ec2 describe-key-pairs --key-names <name>` | Key pair found |
| Your public IP | `curl -s ifconfig.me` | Your IP address |

## One-Command Deploy

```bash
# From repo root:
./deploy.sh
```

This script will:
1. Validate prerequisites
2. Deploy AWS infrastructure via SST
3. Wait for EC2 instance to be ready
4. SSH in and complete OpenClaw setup
5. Copy agent workspace files
6. Verify everything is running

## Manual Deploy (Step by Step)

### Step 1: Deploy Infrastructure

```bash
cd sst
npm install
export AWS_PROFILE=dev

npx sst secret set KeyName <your-ec2-keypair>
npx sst secret set AllowedIP $(curl -s ifconfig.me)
npx sst deploy --stage production
```

### Step 2: Wait for Bootstrap

```bash
# Get IP from SST output
SSH_CMD=$(npx sst output sshCommand --stage production)

# Wait for cloud-init to finish (3-5 min)
ssh -o StrictHostKeyChecking=no -i ~/.ssh/<key>.pem ubuntu@<ip> \
  'while [ ! -f /home/ubuntu/setup-complete.txt ]; do echo "waiting..."; sleep 10; done; echo "READY"'
```

### Step 3: Copy Agent Workspace

```bash
# From repo root:
scp -i ~/.ssh/<key>.pem -r agent/workspace/ ubuntu@<ip>:/home/ubuntu/.openclaw/workspace/
```

### Step 4: Configure OpenClaw

```bash
ssh -i ~/.ssh/<key>.pem ubuntu@<ip> << 'EOF'
  # Authenticate Claude
  claude login

  # Apply OpenClaw config
  cp ~/.openclaw/workspace/_config/openclaw.json ~/.openclaw/openclaw.json

  # Start service
  sudo systemctl enable --now openclaw

  # Verify
  openclaw-status
EOF
```

## Verification Checklist

After deployment, verify each component:

```bash
# On the VPS:
openclaw-status                              # Gateway running
openclaw browser --browser-profile openclaw status  # Browser available
node --version                                # v22.x+
chromium-browser --version                    # Chromium installed
curl -s https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=test  # PubMed API reachable
```

## File Structure

```
mdlinx-trends/
├── deploy.sh                    # One-command deploy script
├── AGENTS.md                    # This file (agent instructions)
├── PROJECT.md                   # Vision, constraints, architecture
├── BACKLOG.md                   # Prioritized tasks
├── LEARNINGS.md                 # Captured insights
├── SECURITY.md                  # CTO/IT security document
│
├── sst/                         # Infrastructure as Code
│   ├── sst.config.ts            # SST v3 config (AWS resources)
│   ├── package.json
│   └── ...
│
└── agent/                       # Agent workspace + setup
    ├── workspace/               # Gets copied to ~/.openclaw/workspace/
    │   ├── AGENTS.md            # Agent behavior instructions
    │   ├── SOUL.md              # Agent identity + medical guardrails
    │   ├── USER.md              # User context
    │   ├── MEMORY.md            # Long-term memory
    │   ├── TOOLS.md             # Tool-specific notes
    │   ├── HEARTBEAT.md         # Periodic check instructions
    │   ├── templates/           # Content generation templates
    │   │   ├── discussion-guide.md
    │   │   └── editorial-brief.md
    │   └── skills/              # Custom skills for this agent
    │       ├── pubmed/
    │       │   └── SKILL.md
    │       ├── trend-monitor/
    │       │   └── SKILL.md
    │       └── content-gen/
    │           └── SKILL.md
    ├── _config/
    │   └── openclaw.json        # OpenClaw configuration
    └── setup-browser.sh         # Chromium install script
```

## Teardown

```bash
cd sst
npx sst remove --stage production
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| SSH timeout | IP changed → `npx sst secret set AllowedIP $(curl -s ifconfig.me) && npx sst deploy --stage production` |
| OpenClaw won't start | Run `openclaw onboard --install-daemon` then `sudo systemctl restart openclaw` |
| Browser not working | Check `chromium-browser --headless --dump-dom https://example.com` |
| PubMed API errors | Check outbound HTTPS in security group |
| Claude auth expired | Re-run `claude login` |
