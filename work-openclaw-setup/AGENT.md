# Agent Instructions

This directory contains infrastructure-as-code for deploying an OpenClaw instance on AWS.

## Quick Decision Tree

1. **Does the user have SST installed?** → Use `sst/`
2. **Does the user have Pulumi installed?** → Use `pulumi/`
3. **Does the user have Terraform installed?** → Use `terraform/`
4. **None of the above?** → Use `setup-openclaw-aws.sh` (requires SSH access to an Ubuntu EC2 instance)

## Prerequisites to Verify

Before running any deployment, confirm the user has:

1. **AWS credentials configured** (`aws sts get-caller-identity` should succeed)
2. **An EC2 key pair** (ask: "What's the name of your EC2 key pair? If you don't have one, I can create it.")
3. **Desired AWS region** (default: us-east-1)

## Required Information

| Parameter | Required | Default | How to Ask |
|-----------|----------|---------|------------|
| `keyName` | Yes | none | "What's your EC2 key pair name?" |
| `region` | No | us-east-1 | "Which AWS region?" |
| `instanceType` | No | t3.small | "Instance size? (t3.micro for light use, t3.small recommended)" |
| `allowedSshCidr` | No | 0.0.0.0/0 | "Restrict SSH to your IP? (run `curl -s ifconfig.me`)" |

## Deployment Commands

### SST v3 (Recommended)
```bash
cd sst
npm install
npx sst secret set KeyName <key-name>
npx sst deploy --stage production
```

### Pulumi
```bash
cd pulumi
npm install
pulumi stack init production
pulumi config set keyName <key-name>
pulumi config set aws:region <region>
pulumi up --yes
```

### Terraform
```bash
cd terraform
terraform init
terraform apply -var="key_name=<key-name>" -var="aws_region=<region>" -auto-approve
```

### Manual Script (on existing EC2)
```bash
ssh ubuntu@<instance-ip> 'curl -fsSL <raw-script-url> | bash'
```

## Post-Deployment Steps

After infrastructure is deployed, the user MUST:

1. **SSH into the instance** (use the ssh command from deployment output)
2. **Wait for cloud-init** (`tail -f /var/log/cloud-init-output.log` or check for `/home/ubuntu/setup-complete.txt`)
3. **Authenticate Claude Code**: `claude login` — IMPORTANT: Use their WORK OAuth credentials
4. **Configure OpenClaw**: `openclaw config`
5. **Start service**: `sudo systemctl enable --now openclaw`

## Verification Commands

```bash
# Check if setup completed
cat /home/ubuntu/setup-complete.txt

# Check service status
openclaw-status

# Test OpenClaw is responding
openclaw status
```

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Permission denied (publickey)" | Wrong key or key not added | Verify key name matches, check `~/.ssh/` |
| cloud-init still running | Just deployed | Wait 2-3 minutes, check `/var/log/cloud-init-output.log` |
| "command not found: openclaw" | cloud-init not finished | Wait for setup-complete.txt |
| Service won't start | Not configured yet | Run `openclaw config` first |

## Teardown Commands

```bash
# SST
npx sst remove --stage production

# Pulumi  
pulumi destroy --yes

# Terraform
terraform destroy -auto-approve
```
