# ============================================
# EC2 Instance (Application Server)
# ============================================

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# EC2 Instance
resource "aws_instance" "app_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.private_1.id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  key_name               = var.key_pair_name
  
  # User data - Docker installation and app deployment
  user_data = templatefile("${path.module}/userdata.sh", {
    APP_PORT      = var.app_port
    DB_HOST       = aws_db_instance.main.address
    DB_PORT       = "5432"
    DB_NAME       = "webchat"
    DB_USER       = "admin"
    REGION        = var.aws_region
  })
  
  # Root volume
  root_block_device {
    volume_type = "gp3"
    volume_size = 30
    iops        = 3000
    throughput  = 125
    encrypted   = true
  }
  
  # Instance profile for SSM access
  iam_instance_profile = aws_iam_instance_profile.ec2_ssm.name
  
  # Tenancy
  tenancy = "default"
  
  tags = {
    Name = "${var.project_name}-ec2"
    Type = "ApplicationServer"
  }
}

# ============================================
# IAM Instance Profile (for SSM Session Manager)
# ============================================

resource "aws_iam_role" "ec2_ssm" {
  name = "${var.project_name}-ec2-ssm-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
  
  tags = {
    Name = "${var.project_name}-ec2-ssm-role"
  }
}

resource "aws_iam_instance_profile" "ec2_ssm" {
  name = "${var.project_name}-ec2-ssm-profile"
  role = aws_iam_role.ec2_ssm.name
}

resource "aws_iam_role_policy_attachment" "ssm_agent" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  role       = aws_iam_role.ec2_ssm.name
}

# ============================================
# Elastic IP (for EC2)
# ============================================

resource "aws_eip" "ec2" {
  domain = "vpc"
  
  # Associate with instance when available
  instance = aws_instance.app_server.id
  
  tags = {
    Name = "${var.project_name}-ec2-eip"
  }
  
  depends_on = [aws_internet_gateway.main]
}
