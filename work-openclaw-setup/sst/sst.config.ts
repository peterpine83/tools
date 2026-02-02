/// <reference path="./.sst/platform/config.d.ts" />

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
    const keyName = new sst.Secret("KeyName"); // Your EC2 key pair name
    
    // Security Group
    const securityGroup = new aws.ec2.SecurityGroup("OpenClawSG", {
      description: "OpenClaw work instance security group",
      ingress: [
        {
          description: "SSH",
          fromPort: 22,
          toPort: 22,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"], // Restrict to your IP in production
        },
        {
          description: "HTTPS for webchat",
          fromPort: 443,
          toPort: 443,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
    });

    // Get latest Ubuntu 24.04 AMI
    const ubuntu = await aws.ec2.getAmi({
      mostRecent: true,
      owners: ["099720109477"], // Canonical
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

    // Cloud-init user data
    const userData = `#!/bin/bash
set -e

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git build-essential jq htop tmux

# Install OpenClaw and Claude Code
npm install -g openclaw @anthropic-ai/claude-code

# Initialize for ubuntu user
sudo -u ubuntu openclaw init --non-interactive || true
mkdir -p /home/ubuntu/.openclaw/workspace/memory
chown -R ubuntu:ubuntu /home/ubuntu/.openclaw

# Create systemd service
cat > /etc/systemd/system/openclaw.service << 'EOF'
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
ExecStart=/usr/bin/openclaw gateway start --foreground
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

# Helper scripts
echo '#!/bin/bash
journalctl -u openclaw -f' > /usr/local/bin/openclaw-logs
chmod +x /usr/local/bin/openclaw-logs

echo '#!/bin/bash
systemctl status openclaw --no-pager
journalctl -u openclaw -n 20 --no-pager' > /usr/local/bin/openclaw-status
chmod +x /usr/local/bin/openclaw-status

# Workspace files
cat > /home/ubuntu/.openclaw/workspace/AGENTS.md << 'AGENTS'
# Work OpenClaw Instance
Read SOUL.md and USER.md each session.
This instance is for work projects only.
AGENTS

cat > /home/ubuntu/.openclaw/workspace/SOUL.md << 'SOUL'
# SOUL.md - Work Instance
Professional, efficient, work-focused AI assistant.
SOUL

cat > /home/ubuntu/.openclaw/workspace/USER.md << 'USER'
# USER.md
- **Name:** [Your name]
- **Timezone:** America/New_York
USER

chown -R ubuntu:ubuntu /home/ubuntu/.openclaw
echo "Setup complete" > /home/ubuntu/setup-complete.txt
`;

    // EC2 Instance
    const instance = new aws.ec2.Instance("OpenClawInstance", {
      ami: ubuntu.id,
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

    // Elastic IP
    const eip = new aws.ec2.Eip("OpenClawEIP", {
      instance: instance.id,
      domain: "vpc",
    });

    return {
      instanceId: instance.id,
      publicIp: eip.publicIp,
      sshCommand: $interpolate`ssh -i ~/.ssh/${keyName.value}.pem ubuntu@${eip.publicIp}`,
    };
  },
});
