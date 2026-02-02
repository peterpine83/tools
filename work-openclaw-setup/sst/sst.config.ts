/// <reference path="./.sst/platform/config.d.ts" />

/**
 * OpenClaw Work Instance - SST v3 Configuration
 * SECURITY-HARDENED for enterprise/work environments
 * 
 * AGENT INSTRUCTIONS:
 * 1. Verify AWS credentials: `aws sts get-caller-identity`
 * 2. Get user's IP for SSH restriction: `curl -s ifconfig.me`
 * 3. Set required secrets:
 *    - `npx sst secret set KeyName <ec2-key-pair-name>`
 *    - `npx sst secret set AllowedIP <user-ip-address>`
 * 4. Deploy: `npx sst deploy --stage production`
 * 5. SSH and complete setup (see post-deploy steps)
 * 
 * REQUIRED SECRETS:
 * - KeyName: Name of existing EC2 key pair
 * - AllowedIP: IP address allowed to SSH (e.g., "203.0.113.50")
 * 
 * AVAILABLE MODELS (work accounts):
 * - Claude Max ($200/mo) - claude login uses this
 * - ChatGPT Pro - available if needed
 */

export default $config({
  app(input) {
    return {
      name: "openclaw-work",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "us-east-1",
        },
      },
    };
  },
  async run() {
    // REQUIRED SECRETS
    const keyName = new sst.Secret("KeyName");
    const allowedIP = new sst.Secret("AllowedIP");

    //===========================================
    // SECURITY GROUP - Restrictive by default
    //===========================================
    const securityGroup = new aws.ec2.SecurityGroup("OpenClawSG", {
      description: "OpenClaw work instance - restricted access",
      
      ingress: [
        {
          description: "SSH - restricted to allowed IP only",
          fromPort: 22,
          toPort: 22,
          protocol: "tcp",
          // SECURITY: Only allow SSH from specified IP
          cidrBlocks: [$interpolate`${allowedIP.value}/32`],
        },
        // NOTE: HTTPS (443) intentionally omitted
        // Add only if webchat is needed, and consider using AWS ALB + WAF
      ],
      
      egress: [
        {
          description: "HTTPS outbound (API calls)",
          fromPort: 443,
          toPort: 443,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"],
        },
        {
          description: "HTTP outbound (package managers)",
          fromPort: 80,
          toPort: 80,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"],
        },
        {
          description: "DNS",
          fromPort: 53,
          toPort: 53,
          protocol: "udp",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
    });

    //===========================================
    // IAM ROLE - Minimal permissions
    //===========================================
    const instanceRole = new aws.iam.Role("OpenClawRole", {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
          Action: "sts:AssumeRole",
          Effect: "Allow",
          Principal: { Service: "ec2.amazonaws.com" },
        }],
      }),
    });

    // Only attach SSM for secure access (no need for SSH keys in emergencies)
    new aws.iam.RolePolicyAttachment("SSMPolicy", {
      role: instanceRole.name,
      policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
    });

    const instanceProfile = new aws.iam.InstanceProfile("OpenClawProfile", {
      role: instanceRole.name,
    });

    //===========================================
    // AMI - Latest Ubuntu 24.04 LTS
    //===========================================
    const ubuntu = await aws.ec2.getAmi({
      mostRecent: true,
      owners: ["099720109477"],
      filters: [
        { name: "name", values: ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"] },
        { name: "virtualization-type", values: ["hvm"] },
      ],
    });

    //===========================================
    // USER DATA - Security-hardened setup
    //===========================================
    const userData = `#!/bin/bash
set -e
exec > >(tee /var/log/openclaw-setup.log) 2>&1
echo "Starting OpenClaw setup at $(date)"

#===========================================
# SECURITY HARDENING
#===========================================

# Automatic security updates
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unattended-upgrades
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# Install fail2ban for SSH protection
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Harden SSH
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
echo "MaxAuthTries 3" >> /etc/ssh/sshd_config
systemctl reload sshd

# Set up firewall (UFW)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw --force enable

#===========================================
# APPLICATION SETUP
#===========================================

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs git build-essential jq htop tmux

# Install OpenClaw and Claude Code CLI
npm install -g openclaw @anthropic-ai/claude-code --silent

# Initialize OpenClaw for ubuntu user
sudo -u ubuntu openclaw init --non-interactive 2>/dev/null || true
mkdir -p /home/ubuntu/.openclaw/workspace/memory
chown -R ubuntu:ubuntu /home/ubuntu/.openclaw

# Create systemd service with security hardening
cat > /etc/systemd/system/openclaw.service << 'EOF'
[Unit]
Description=OpenClaw Gateway
After=network.target
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu
ExecStart=/usr/bin/openclaw gateway start --foreground
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openclaw

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/ubuntu/.openclaw
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictNamespaces=true
LockPersonality=true
MemoryDenyWriteExecute=false
RestrictRealtime=true

Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

# Helper scripts
cat > /usr/local/bin/openclaw-logs << 'SCRIPT'
#!/bin/bash
journalctl -u openclaw -f --no-hostname "$@"
SCRIPT
chmod +x /usr/local/bin/openclaw-logs

cat > /usr/local/bin/openclaw-status << 'SCRIPT'
#!/bin/bash
echo "=== OpenClaw Service Status ==="
systemctl status openclaw --no-pager || true
echo ""
echo "=== Recent Logs ==="
journalctl -u openclaw -n 20 --no-pager --no-hostname
SCRIPT
chmod +x /usr/local/bin/openclaw-status

# Workspace files
cat > /home/ubuntu/.openclaw/workspace/AGENTS.md << 'MD'
# Work OpenClaw Instance

## Session Start
1. Read SOUL.md and USER.md
2. Check memory/YYYY-MM-DD.md for context

## Guidelines
- Work projects only
- Keep work and personal separate
- This instance bills to work Claude Max account
MD

cat > /home/ubuntu/.openclaw/workspace/SOUL.md << 'MD'
# SOUL.md - Work Instance

Professional, efficient, security-conscious AI assistant.

## Principles
- Focus on work tasks
- Respect data boundaries
- Follow security best practices
MD

cat > /home/ubuntu/.openclaw/workspace/USER.md << 'MD'
# USER.md
- **Name:** [Your name]
- **Role:** [Your role]
- **Timezone:** [Your timezone]
MD

cat > /home/ubuntu/.openclaw/workspace/MEMORY.md << 'MD'
# MEMORY.md - Work Memory

## Active Projects
[Add projects here]
MD

chown -R ubuntu:ubuntu /home/ubuntu/.openclaw

# Signal completion
echo "OpenClaw setup completed at $(date)" > /home/ubuntu/setup-complete.txt
chown ubuntu:ubuntu /home/ubuntu/setup-complete.txt

echo "=== SECURITY SUMMARY ==="
echo "- Automatic security updates: ENABLED"
echo "- Fail2ban: ENABLED"
echo "- SSH password auth: DISABLED"
echo "- Root login: DISABLED"
echo "- UFW firewall: ENABLED"
echo "========================="
`;

    //===========================================
    // EC2 INSTANCE
    //===========================================
    const instance = new aws.ec2.Instance("OpenClawInstance", {
      ami: ubuntu.id,
      instanceType: "t3.small",
      keyName: keyName.value,
      iamInstanceProfile: instanceProfile.name,
      vpcSecurityGroupIds: [securityGroup.id],
      
      // SECURITY: Require IMDSv2 (prevents SSRF attacks)
      metadataOptions: {
        httpTokens: "required",
        httpPutResponseHopLimit: 1,
        httpEndpoint: "enabled",
      },
      
      rootBlockDevice: {
        volumeSize: 20,
        volumeType: "gp3",
        encrypted: true,  // SECURITY: Encrypted at rest
        deleteOnTermination: true,
      },
      
      userData: userData,
      
      tags: {
        Name: "openclaw-work",
        Environment: "production",
        ManagedBy: "sst",
      },
    });

    // Elastic IP for stable access
    const eip = new aws.ec2.Eip("OpenClawEIP", {
      instance: instance.id,
      domain: "vpc",
      tags: { Name: "openclaw-work-eip" },
    });

    //===========================================
    // OUTPUTS
    //===========================================
    return {
      instanceId: instance.id,
      publicIp: eip.publicIp,
      sshCommand: $interpolate`ssh -i ~/.ssh/${keyName.value}.pem ubuntu@${eip.publicIp}`,
      ssmCommand: $interpolate`aws ssm start-session --target ${instance.id}`,
      securityFeatures: [
        "SSH restricted to your IP only",
        "IMDSv2 required (SSRF protection)",
        "EBS encrypted at rest",
        "Automatic security updates",
        "Fail2ban enabled",
        "SSH password auth disabled",
        "Root login disabled",
        "UFW firewall enabled",
        "Systemd service hardened",
      ],
      nextSteps: [
        "1. SSH in using sshCommand (or use ssmCommand for keyless access)",
        "2. Wait for setup: cat /home/ubuntu/setup-complete.txt",
        "3. Authenticate: claude login (uses work Claude Max account)",
        "4. Configure: openclaw config",
        "5. Start service: sudo systemctl enable --now openclaw",
      ],
    };
  },
});
