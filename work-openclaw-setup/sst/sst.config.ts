/// <reference path="./.sst/platform/config.d.ts" />

/**
 * OpenClaw Work Instance - SST v3 Configuration
 * 
 * AGENT INSTRUCTIONS:
 * 1. Ensure AWS credentials are configured (`aws sts get-caller-identity`)
 * 2. Set the EC2 key pair name: `npx sst secret set KeyName <your-key-name>`
 * 3. Deploy: `npx sst deploy --stage production`
 * 4. SSH using the output command, then run: claude login && openclaw config
 * 
 * REQUIRED SECRETS:
 * - KeyName: Name of an existing EC2 key pair in the target region
 * 
 * OPTIONAL CUSTOMIZATION:
 * - Change region in app() below
 * - Change instanceType in the Instance resource
 * - Modify security group rules for tighter access
 */

export default $config({
  app(input) {
    return {
      name: "openclaw-work",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          // AGENT: Change region here if needed (default: us-east-1)
          region: "us-east-1",
        },
      },
    };
  },
  async run() {
    // REQUIRED: EC2 key pair name (set via: npx sst secret set KeyName <name>)
    const keyName = new sst.Secret("KeyName");
    
    // Security Group - controls network access to the instance
    const securityGroup = new aws.ec2.SecurityGroup("OpenClawSG", {
      description: "OpenClaw work instance security group",
      ingress: [
        {
          description: "SSH access",
          fromPort: 22,
          toPort: 22,
          protocol: "tcp",
          // AGENT: For better security, restrict to user's IP:
          // Run `curl -s ifconfig.me` to get their IP, then use ["<IP>/32"]
          cidrBlocks: ["0.0.0.0/0"],
        },
        {
          description: "HTTPS for webchat (optional)",
          fromPort: 443,
          toPort: 443,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
      egress: [
        {
          description: "All outbound traffic",
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
    });

    // Get latest Ubuntu 24.04 LTS AMI (auto-updates on each deploy)
    const ubuntu = await aws.ec2.getAmi({
      mostRecent: true,
      owners: ["099720109477"], // Canonical's AWS account
      filters: [
        {
          name: "name",
          values: ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"],
        },
        {
          name: "virtualization-type",
          values: ["hvm"],
        },
      ],
    });

    // Cloud-init script - runs on first boot
    // Installs Node.js, OpenClaw, Claude Code, and creates systemd service
    const userData = `#!/bin/bash
set -e

# Log all output for debugging
exec > >(tee /var/log/openclaw-setup.log) 2>&1
echo "Starting OpenClaw setup at $(date)"

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git build-essential jq htop tmux

# Install OpenClaw and Claude Code CLI
npm install -g openclaw @anthropic-ai/claude-code

# Initialize OpenClaw for ubuntu user
sudo -u ubuntu openclaw init --non-interactive || true
mkdir -p /home/ubuntu/.openclaw/workspace/memory
chown -R ubuntu:ubuntu /home/ubuntu/.openclaw

# Create systemd service
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
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/ubuntu/.openclaw
PrivateTmp=true
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

# Helper: View logs
cat > /usr/local/bin/openclaw-logs << 'SCRIPT'
#!/bin/bash
journalctl -u openclaw -f --no-hostname "$@"
SCRIPT
chmod +x /usr/local/bin/openclaw-logs

# Helper: Check status
cat > /usr/local/bin/openclaw-status << 'SCRIPT'
#!/bin/bash
echo "=== OpenClaw Service Status ==="
systemctl status openclaw --no-pager || true
echo ""
echo "=== Recent Logs ==="
journalctl -u openclaw -n 20 --no-pager --no-hostname
SCRIPT
chmod +x /usr/local/bin/openclaw-status

# Workspace starter files
cat > /home/ubuntu/.openclaw/workspace/AGENTS.md << 'MD'
# Work OpenClaw Instance
Read SOUL.md and USER.md each session.
This instance is for work projects only.
MD

cat > /home/ubuntu/.openclaw/workspace/SOUL.md << 'MD'
# SOUL.md - Work Instance
Professional, efficient, work-focused AI assistant.
MD

cat > /home/ubuntu/.openclaw/workspace/USER.md << 'MD'
# USER.md
- **Name:** [Your name]
- **Role:** [Your role]
- **Timezone:** [Your timezone]
MD

cat > /home/ubuntu/.openclaw/workspace/MEMORY.md << 'MD'
# MEMORY.md - Work Long-Term Memory

## Active Projects
[Add projects here]
MD

chown -R ubuntu:ubuntu /home/ubuntu/.openclaw

# Signal completion
echo "OpenClaw setup completed at $(date)" > /home/ubuntu/setup-complete.txt
chown ubuntu:ubuntu /home/ubuntu/setup-complete.txt

echo "Setup complete!"
`;

    // EC2 Instance
    const instance = new aws.ec2.Instance("OpenClawInstance", {
      ami: ubuntu.id,
      // AGENT: Change instance type if needed
      // t3.micro ($7/mo) - light use
      // t3.small ($15/mo) - recommended
      // t3.medium ($30/mo) - heavy use
      instanceType: "t3.small",
      keyName: keyName.value,
      vpcSecurityGroupIds: [securityGroup.id],
      rootBlockDevice: {
        volumeSize: 20,
        volumeType: "gp3",
        encrypted: true,
      },
      userData: userData,
      tags: {
        Name: "openclaw-work",
      },
    });

    // Elastic IP - static IP that persists across instance stops
    const eip = new aws.ec2.Eip("OpenClawEIP", {
      instance: instance.id,
      domain: "vpc",
    });

    // Outputs - used for post-deploy instructions
    return {
      instanceId: instance.id,
      publicIp: eip.publicIp,
      sshCommand: $interpolate`ssh -i ~/.ssh/${keyName.value}.pem ubuntu@${eip.publicIp}`,
      nextSteps: [
        "1. SSH into instance using sshCommand above",
        "2. Wait for setup: cat /home/ubuntu/setup-complete.txt",
        "3. Authenticate: claude login",
        "4. Configure: openclaw config", 
        "5. Start service: sudo systemctl enable --now openclaw",
      ],
    };
  },
});
