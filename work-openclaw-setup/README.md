# Work OpenClaw AWS Setup

Deploy a separate OpenClaw instance for work, billed to your work's Claude OAuth.

> **🤖 AI Agents:** See [AGENT.md](./AGENT.md) for structured instructions, decision trees, and copy-paste commands.

## Deploy Options

| Option | Best For |
|--------|----------|
| **SST v3** | Simplest TypeScript DX, you already use SST |
| **Pulumi** | Pure IaC, no framework overhead |
| **Terraform** | Team already uses Terraform |
| **Manual** | One-off, just want it running |

---

## Option 1: SST v3 (Recommended)

```bash
cd sst
npm install

# Set your EC2 key pair name as a secret
npx sst secret set KeyName your-key-name

# Deploy
npx sst deploy --stage production
```

That's it. SST outputs your SSH command.

**To tear down:**
```bash
npx sst remove --stage production
```

---

## Option 2: Pulumi

```bash
cd pulumi
npm install

# Create stack
pulumi stack init production

# Set config
pulumi config set keyName your-key-name
pulumi config set allowedSshCidr "YOUR.IP.ADDRESS/32"  # optional
pulumi config set aws:region us-east-1

# Deploy
pulumi up
```

**To tear down:**
```bash
pulumi destroy
```

---

## Option 3: Terraform

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars

terraform init
terraform apply
```

---

## Option 4: Manual (Quick Start)

### 1. Launch EC2 Instance

**Via AWS Console:**
- AMI: Ubuntu 24.04 LTS
- Instance type: `t3.small` (2 vCPU, 2GB RAM) — ~$15/mo
- Storage: 20GB gp3
- Security group: Allow SSH (22), optionally HTTPS (443)

**Via AWS CLI:**
```bash
# Create security group
aws ec2 create-security-group \
  --group-name openclaw-work-sg \
  --description "OpenClaw work instance"

# Allow SSH
aws ec2 authorize-security-group-ingress \
  --group-name openclaw-work-sg \
  --protocol tcp --port 22 --cidr YOUR_IP/32

# Launch instance
aws ec2 run-instances \
  --image-id ami-0c7217cdde317cfec \
  --instance-type t3.small \
  --key-name your-key \
  --security-groups openclaw-work-sg \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=openclaw-work}]'
```

### 2. SSH and Run Setup

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@<instance-ip>

# Download and run setup script
curl -fsSL https://raw.githubusercontent.com/point-labs-dev/work-openclaw-setup/main/setup-openclaw-aws.sh | bash

# Or if you have the script locally:
# scp setup-openclaw-aws.sh ubuntu@<ip>:~
# ssh ubuntu@<ip> 'bash setup-openclaw-aws.sh'
```

### 3. Authenticate Claude Code

```bash
# IMPORTANT: Use your WORK credentials here
claude login
```

This opens a browser for OAuth. Sign in with your **work** Claude account.

### 4. Configure OpenClaw

```bash
openclaw config
```

Set up:
- Model preferences
- Channels (Slack, etc.)
- Any work-specific settings

### 5. Start Service

```bash
sudo systemctl start openclaw
sudo systemctl enable openclaw

# Check status
openclaw-status
```

## Optional: Elastic IP

For a static IP that persists across stops/starts:

```bash
# Allocate
aws ec2 allocate-address --domain vpc

# Associate (get allocation-id from above, instance-id from console)
aws ec2 associate-address \
  --instance-id i-xxxx \
  --allocation-id eipalloc-xxxx
```

## Optional: Domain + HTTPS

If you want webchat access:

1. Point a domain to your instance IP (Route53 or your DNS)
2. Install Caddy for automatic HTTPS:

```bash
sudo apt install -y caddy

sudo tee /etc/caddy/Caddyfile << EOF
work-claw.yourcompany.com {
    reverse_proxy localhost:3000
}
EOF

sudo systemctl restart caddy
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `openclaw-status` | Service status + recent logs |
| `openclaw-logs` | Follow live logs |
| `openclaw config` | Edit configuration |
| `sudo systemctl restart openclaw` | Restart service |
| `claude logout && claude login` | Re-authenticate Claude |

## Cost Estimate

| Resource | Cost/Month |
|----------|------------|
| t3.small (on-demand) | ~$15 |
| 20GB gp3 storage | ~$2 |
| Elastic IP (optional) | Free while attached |
| **Total** | **~$17/mo** |

Save ~30% with Reserved Instances or Savings Plans if running long-term.

## Troubleshooting

**Service won't start:**
```bash
journalctl -u openclaw -n 50 --no-pager
```

**Claude auth issues:**
```bash
claude logout
claude login
sudo systemctl restart openclaw
```

**Check if OpenClaw is listening:**
```bash
ss -tlnp | grep node
```
