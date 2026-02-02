# Work OpenClaw AWS Setup

Deploy a **security-hardened** OpenClaw instance on AWS for work use, billed to your work Claude Max account.

**Target: DEV AWS account** (not production)

> **🤖 AI Agents:** See [AGENTS.md](./AGENTS.md) for structured deployment instructions.

## Security Features

This setup prioritizes security for enterprise/work environments:

| Feature | Description |
|---------|-------------|
| **SSH IP Restriction** | SSH only allowed from your specific IP |
| **IMDSv2 Required** | Prevents SSRF attacks against instance metadata |
| **Encrypted Storage** | EBS volume encrypted at rest |
| **Auto Security Updates** | unattended-upgrades enabled |
| **Fail2ban** | Protects against SSH brute-force |
| **No Password Auth** | SSH key-only authentication |
| **No Root Login** | Root SSH access disabled |
| **UFW Firewall** | Only necessary ports open |
| **Hardened Systemd** | NoNewPrivileges, ProtectSystem, etc. |
| **SSM Access** | Keyless emergency access via AWS Session Manager |

## Quick Start

### 1. Prerequisites

```bash
# Use your DEV AWS account (not production!)
export AWS_PROFILE=dev  # adjust to your dev profile name

# Verify you're in the right account
aws sts get-caller-identity

# Get your IP (needed for SSH restriction)
curl -s ifconfig.me
```

### 2. Deploy with SST

```bash
cd sst
npm install

# Make sure dev profile is set
export AWS_PROFILE=dev

# Set required secrets
npx sst secret set KeyName your-ec2-keypair-name
npx sst secret set AllowedIP $(curl -s ifconfig.me)

# Deploy
npx sst deploy --stage production
```

> **Note:** `--stage production` is SST's stage name (controls deletion behavior), not your AWS account. The AWS account is determined by `AWS_PROFILE`.

### 3. Complete Setup

```bash
# SSH in (use command from deploy output)
ssh -i ~/.ssh/your-key.pem ubuntu@<elastic-ip>

# Wait for cloud-init (check for this file)
cat /home/ubuntu/setup-complete.txt

# Authenticate with your WORK Claude account
claude login

# Configure OpenClaw
openclaw config

# Start the service
sudo systemctl enable --now openclaw

# Verify
openclaw-status
```

## IP Address Changes

If your IP changes, update the security group:

```bash
npx sst secret set AllowedIP <new-ip>
npx sst deploy --stage production
```

## Emergency Access

If locked out (IP changed, lost key), use AWS Session Manager:

```bash
aws ssm start-session --target <instance-id>
```

## Costs

| Resource | Cost/Month |
|----------|------------|
| t3.small (on-demand) | ~$15 |
| 20GB gp3 EBS | ~$2 |
| Elastic IP | Free (while attached) |
| **Total** | **~$17/mo** |

## Teardown

```bash
npx sst remove --stage production
```

## File Structure

```
work-openclaw-setup/
├── AGENTS.md          # AI agent instructions (Codex)
├── CLAUDE.md          # Symlink for Claude Code
├── README.md          # This file
├── setup-openclaw-aws.sh  # Manual setup script (if needed)
└── sst/
    ├── sst.config.ts  # SST v3 infrastructure
    └── package.json
```
