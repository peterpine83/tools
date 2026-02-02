# AGENTS.md - Work OpenClaw Setup

Deploy a security-hardened OpenClaw instance on AWS for work use.

**Target: DEV account** (not production)

## Prerequisites

Before deploying, verify you're using the **dev** AWS account:

```bash
# 1. Set AWS profile to dev account
export AWS_PROFILE=dev  # or whatever the dev profile is named

# 2. Verify correct account
aws sts get-caller-identity
# Should show the DEV account ID, not production

# 3. Get user's IP address (required for SSH restriction)
curl -s ifconfig.me
```

**IMPORTANT:** Ask the user: "What's your AWS profile name for the dev account?" (common names: `dev`, `development`, `work-dev`)

## Required Information

| Parameter | Required | How to Get |
|-----------|----------|------------|
| `AWS_PROFILE` | Yes | "What's your AWS profile name for the **dev** account?" |
| `KeyName` | Yes | "What's your EC2 key pair name in the dev account? (AWS Console → EC2 → Key Pairs)" |
| `AllowedIP` | Yes | "What's your IP? Run: `curl -s ifconfig.me`" |
| `region` | No (default: us-east-1) | "Which AWS region?" |

## Deployment

```bash
cd sst
npm install

# IMPORTANT: Use dev AWS profile
export AWS_PROFILE=dev  # adjust to your dev profile name

# Set required secrets
npx sst secret set KeyName <key-pair-name>
npx sst secret set AllowedIP <ip-address>

# Deploy to dev account
npx sst deploy --stage production
```

**Note:** The `--stage production` refers to SST's stage naming (retain on delete), not the AWS account. The AWS account is controlled by `AWS_PROFILE`.

## Post-Deployment (REQUIRED)

After `sst deploy` completes:

```bash
# 1. SSH into instance (use sshCommand from output)
ssh -i ~/.ssh/<key>.pem ubuntu@<ip>

# 2. Verify setup completed
cat /home/ubuntu/setup-complete.txt

# 3. Authenticate Claude Code with WORK account (Claude Max $200/mo)
claude login

# 4. Configure OpenClaw
openclaw config

# 5. Start service
sudo systemctl enable --now openclaw

# 6. Verify
openclaw-status
```

## Security Features (Enabled by Default)

- ✅ SSH restricted to single IP (AllowedIP secret)
- ✅ IMDSv2 required (SSRF protection)
- ✅ EBS encrypted at rest
- ✅ Automatic security updates (unattended-upgrades)
- ✅ Fail2ban (SSH brute-force protection)
- ✅ SSH password authentication disabled
- ✅ Root login disabled
- ✅ UFW firewall enabled
- ✅ Systemd service hardened (NoNewPrivileges, ProtectSystem, etc.)
- ✅ SSM Session Manager available (keyless emergency access)

## Available Models (Work Accounts)

- **Claude Max** ($200/mo) - Primary, used via `claude login`
- **ChatGPT Pro** - Available if needed for specific tasks

## Update SSH IP

If your IP changes:

```bash
npx sst secret set AllowedIP <new-ip>
npx sst deploy --stage production
```

## Teardown

```bash
npx sst remove --stage production
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Permission denied (publickey)" | Verify key name matches, check `~/.ssh/` |
| "Connection timed out" | Your IP changed - update AllowedIP secret |
| cloud-init still running | Wait 3-5 min, check `/var/log/openclaw-setup.log` |
| "command not found: openclaw" | Setup not finished - wait for setup-complete.txt |
| Service won't start | Run `openclaw config` first |
| Need emergency access | Use SSM: `aws ssm start-session --target <instance-id>` |
