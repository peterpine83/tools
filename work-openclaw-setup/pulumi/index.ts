import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config();
const keyName = config.require("keyName");
const allowedSshCidr = config.get("allowedSshCidr") || "0.0.0.0/0";

// Security Group
const securityGroup = new aws.ec2.SecurityGroup("openclaw-sg", {
  description: "OpenClaw work instance",
  ingress: [
    {
      description: "SSH",
      fromPort: 22,
      toPort: 22,
      protocol: "tcp",
      cidrBlocks: [allowedSshCidr],
    },
    {
      description: "HTTPS",
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

// Latest Ubuntu 24.04
const ubuntu = aws.ec2.getAmiOutput({
  mostRecent: true,
  owners: ["099720109477"],
  filters: [
    { name: "name", values: ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"] },
    { name: "virtualization-type", values: ["hvm"] },
  ],
});

// User data script
const userData = `#!/bin/bash
set -e

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git build-essential jq htop tmux

npm install -g openclaw @anthropic-ai/claude-code

sudo -u ubuntu openclaw init --non-interactive || true
mkdir -p /home/ubuntu/.openclaw/workspace/memory
chown -R ubuntu:ubuntu /home/ubuntu/.openclaw

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

echo '#!/bin/bash
journalctl -u openclaw -f' > /usr/local/bin/openclaw-logs
chmod +x /usr/local/bin/openclaw-logs

echo '#!/bin/bash
systemctl status openclaw --no-pager
journalctl -u openclaw -n 20 --no-pager' > /usr/local/bin/openclaw-status
chmod +x /usr/local/bin/openclaw-status

cat > /home/ubuntu/.openclaw/workspace/AGENTS.md << 'AGENTS'
# Work OpenClaw Instance
Read SOUL.md and USER.md each session. Work projects only.
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
`;

// EC2 Instance
const instance = new aws.ec2.Instance("openclaw-instance", {
  ami: ubuntu.id,
  instanceType: "t3.small",
  keyName: keyName,
  vpcSecurityGroupIds: [securityGroup.id],
  rootBlockDevice: {
    volumeSize: 20,
    volumeType: "gp3",
    encrypted: true,
  },
  userData: userData,
  tags: { Name: "openclaw-work" },
});

// Elastic IP
const eip = new aws.ec2.Eip("openclaw-eip", {
  instance: instance.id,
  domain: "vpc",
});

// Outputs
export const instanceId = instance.id;
export const publicIp = eip.publicIp;
export const sshCommand = pulumi.interpolate`ssh -i ~/.ssh/${keyName}.pem ubuntu@${eip.publicIp}`;
