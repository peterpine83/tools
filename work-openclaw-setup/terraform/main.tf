################################
# OpenClaw Work Instance - AWS
################################

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

################################
# Variables
################################

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.small"
}

variable "key_name" {
  description = "Name of existing EC2 key pair"
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH (your IP)"
  type        = string
  default     = "0.0.0.0/0"  # Restrict this to your IP!
}

variable "enable_https" {
  description = "Open port 443 for webchat"
  type        = bool
  default     = false
}

variable "instance_name" {
  description = "Name tag for the instance"
  type        = string
  default     = "openclaw-work"
}

################################
# Data Sources
################################

# Latest Ubuntu 24.04 LTS AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

################################
# Security Group
################################

resource "aws_security_group" "openclaw" {
  name        = "${var.instance_name}-sg"
  description = "Security group for OpenClaw work instance"

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
    description = "SSH access"
  }

  # HTTPS (optional)
  dynamic "ingress" {
    for_each = var.enable_https ? [1] : []
    content {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTPS for webchat"
    }
  }

  # Outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = {
    Name = "${var.instance_name}-sg"
  }
}

################################
# EC2 Instance
################################

resource "aws_instance" "openclaw" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  key_name      = var.key_name

  vpc_security_group_ids = [aws_security_group.openclaw.id]

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = file("${path.module}/cloud-init.yaml")

  tags = {
    Name = var.instance_name
  }

  lifecycle {
    ignore_changes = [ami] # Don't recreate on AMI updates
  }
}

################################
# Elastic IP (optional)
################################

resource "aws_eip" "openclaw" {
  instance = aws_instance.openclaw.id
  domain   = "vpc"

  tags = {
    Name = "${var.instance_name}-eip"
  }
}

################################
# Outputs
################################

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.openclaw.id
}

output "public_ip" {
  description = "Elastic IP address"
  value       = aws_eip.openclaw.public_ip
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_eip.openclaw.public_ip}"
}

output "next_steps" {
  description = "What to do after deploy"
  value       = <<-EOT
    
    1. Wait 2-3 minutes for cloud-init to complete
    2. SSH in: ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_eip.openclaw.public_ip}
    3. Check setup progress: tail -f /var/log/cloud-init-output.log
    4. Authenticate Claude: claude login
    5. Configure OpenClaw: openclaw config
    6. Start service: sudo systemctl start openclaw && sudo systemctl enable openclaw
  EOT
}
