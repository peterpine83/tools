/// <reference path="./.sst/platform/config.d.ts" />

/**
 * MDLinx Trends Agent — SST v3 Infrastructure
 * Security-hardened OpenClaw instance on AWS
 *
 * Based on peterpine83/tools with additions:
 * - Node.js 22 (OpenClaw requirement)
 * - Chromium headless browser
 * - PubMed/health API outbound access
 *
 * Deploy:
 *   npx sst secret set KeyName <ec2-keypair>
 *   npx sst secret set AllowedIP $(curl -s ifconfig.me)
 *   npx sst deploy --stage production
 */

export default $config({
  app(input) {
    return {
      name: "mdlinx-trends-agent",
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
    const keyName = new sst.Secret("KeyName");
    const allowedIP = new sst.Secret("AllowedIP");

    // ── Security Group ─────────────────────────────────
    const securityGroup = new aws.ec2.SecurityGroup("MdlinxAgentSG", {
      description: "MDLinx Trends Agent - restricted access",
      ingress: [
        {
          description: "SSH - admin IP only",
          fromPort: 22,
          toPort: 22,
          protocol: "tcp",
          cidrBlocks: [$interpolate`${allowedIP.value}/32`],
        },
      ],
      egress: [
        {
          description: "HTTPS outbound (Anthropic, OpenAI, PubMed, CDC, etc.)",
          fromPort: 443,
          toPort: 443,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"],
        },
        {
          description: "HTTP outbound (package managers, some APIs)",
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

    // ── IAM Role ───────────────────────────────────────
    const instanceRole = new aws.iam.Role("MdlinxAgentRole", {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: { Service: "ec2.amazonaws.com" },
          },
        ],
      }),
    });

    // SSM for emergency keyless access
    new aws.iam.RolePolicyAttachment("SSMPolicy", {
      role: instanceRole.name,
      policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
    });

    const instanceProfile = new aws.iam.InstanceProfile("MdlinxAgentProfile", {
      role: instanceRole.name,
    });

    // ── AMI ────────────────────────────────────────────
    const ubuntu = await aws.ec2.getAmi({
      mostRecent: true,
      owners: ["099720109477"], // Canonical
      filters: [
        {
          name: "name",
          values: [
            "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*",
          ],
        },
        { name: "virtualization-type", values: ["hvm"] },
      ],
    });

    // ── User Data (bootstrap script) ───────────────────
    const userData = `#!/bin/bash
set -e
exec > >(tee /var/log/mdlinx-agent-setup.log) 2>&1
echo "=== MDLinx Trends Agent Setup — $(date) ==="

#===========================================
# SECURITY HARDENING
#===========================================

apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unattended-upgrades

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# Fail2ban
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# SSH hardening
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
echo "MaxAuthTries 3" >> /etc/ssh/sshd_config
systemctl reload sshd

# UFW firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw --force enable

#===========================================
# NODE.JS 22 (OpenClaw requirement)
#===========================================

curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs git build-essential jq htop tmux curl unzip

echo "Node.js version: $(node -v)"

#===========================================
# HEADLESS BROWSER (Chromium)
#===========================================

DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \\
  chromium-browser \\
  fonts-liberation \\
  libnss3 \\
  libatk-bridge2.0-0 \\
  libdrm2 \\
  libxkbcommon0 \\
  libgbm1 \\
  libasound2t64 2>/dev/null || \\
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \\
  chromium-browser \\
  fonts-liberation \\
  libnss3 \\
  libatk-bridge2.0-0 \\
  libdrm2 \\
  libxkbcommon0 \\
  libgbm1 \\
  libasound2

echo "Chromium version: $(chromium-browser --version 2>/dev/null || echo 'not found')"

#===========================================
# OPENCLAW + CLAUDE CODE
#===========================================

npm install -g openclaw @anthropic-ai/claude-code --silent

# Initialize OpenClaw
sudo -u ubuntu openclaw init --non-interactive 2>/dev/null || true
mkdir -p /home/ubuntu/.openclaw/workspace/memory
mkdir -p /home/ubuntu/.openclaw/workspace/templates
mkdir -p /home/ubuntu/.openclaw/workspace/skills
chown -R ubuntu:ubuntu /home/ubuntu/.openclaw

#===========================================
# SYSTEMD SERVICE (hardened)
#===========================================

cat > /etc/systemd/system/openclaw.service << 'UNIT'
[Unit]
Description=OpenClaw Gateway — MDLinx Trends Agent
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
ReadWritePaths=/home/ubuntu/.openclaw /tmp
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
MemoryDenyWriteExecute=false
RestrictRealtime=true

Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload

#===========================================
# HELPER SCRIPTS
#===========================================

cat > /usr/local/bin/openclaw-logs << 'SCRIPT'
#!/bin/bash
journalctl -u openclaw -f --no-hostname "$@"
SCRIPT
chmod +x /usr/local/bin/openclaw-logs

cat > /usr/local/bin/openclaw-status << 'SCRIPT'
#!/bin/bash
echo "=== MDLinx Trends Agent Status ==="
echo ""
echo "--- Service ---"
systemctl status openclaw --no-pager 2>/dev/null || echo "Not running"
echo ""
echo "--- Versions ---"
echo "Node.js: $(node -v 2>/dev/null || echo 'N/A')"
echo "OpenClaw: $(openclaw --version 2>/dev/null || echo 'N/A')"
echo "Claude: $(claude --version 2>/dev/null || echo 'N/A')"
echo "Chromium: $(chromium-browser --version 2>/dev/null || echo 'N/A')"
echo ""
echo "--- Workspace ---"
ls ~/.openclaw/workspace/ 2>/dev/null || echo "Not found"
echo ""
echo "--- Recent Logs ---"
journalctl -u openclaw -n 20 --no-pager --no-hostname 2>/dev/null || echo "No logs"
SCRIPT
chmod +x /usr/local/bin/openclaw-status

#===========================================
# DONE
#===========================================

echo "=== SECURITY SUMMARY ==="
echo "- Auto security updates: ENABLED"
echo "- Fail2ban: ENABLED"
echo "- SSH password auth: DISABLED"
echo "- Root login: DISABLED"
echo "- UFW firewall: ENABLED"
echo "- IMDSv2: REQUIRED (set in SST)"
echo "========================="
echo ""
echo "Setup complete at $(date)"
echo "Run 'claude login' and then 'sudo systemctl enable --now openclaw' to start."

touch /home/ubuntu/setup-complete.txt
chown ubuntu:ubuntu /home/ubuntu/setup-complete.txt
`;

    // ── EC2 Instance ───────────────────────────────────
    const instance = new aws.ec2.Instance("MdlinxAgentInstance", {
      ami: ubuntu.id,
      instanceType: "t3.small",
      keyName: keyName.value,
      iamInstanceProfile: instanceProfile.name,
      vpcSecurityGroupIds: [securityGroup.id],

      // SECURITY: Require IMDSv2
      metadataOptions: {
        httpTokens: "required",
        httpPutResponseHopLimit: 1,
        httpEndpoint: "enabled",
      },

      rootBlockDevice: {
        volumeSize: 30, // 30GB for Chromium + workspace
        volumeType: "gp3",
        encrypted: true,
        deleteOnTermination: true,
      },

      userData: userData,

      tags: {
        Name: "mdlinx-trends-agent",
        Project: "mdlinx-trends",
        Environment: "poc",
        ManagedBy: "sst",
      },
    });

    // Elastic IP
    const eip = new aws.ec2.Eip("MdlinxAgentEIP", {
      instance: instance.id,
      domain: "vpc",
      tags: { Name: "mdlinx-trends-agent-eip" },
    });

    return {
      instanceId: instance.id,
      publicIp: eip.publicIp,
      sshCommand: $interpolate`ssh -i ~/.ssh/${keyName.value}.pem ubuntu@${eip.publicIp}`,
      ssmCommand: $interpolate`aws ssm start-session --target ${instance.id}`,
      securityFeatures: [
        "SSH restricted to admin IP only",
        "IMDSv2 required (SSRF protection)",
        "EBS encrypted at rest (30GB gp3)",
        "Automatic security updates",
        "Fail2ban (SSH brute-force protection)",
        "SSH password auth disabled",
        "Root login disabled",
        "UFW firewall (deny all incoming)",
        "Systemd service hardened",
        "SSM Session Manager (emergency access)",
      ],
      nextSteps: [
        "1. Run: ./deploy.sh --key <keypair> --skip-infra  (to copy workspace files)",
        "2. SSH in and run: claude login",
        "3. Start: sudo systemctl enable --now openclaw",
        "4. Verify: openclaw-status",
        "5. Test: openclaw chat → 'What medical misinformation is trending?'",
      ],
    };
  },
});
