# ============================================
# Terraform Outputs
# ============================================

# VPC & Network
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "VPC CIDR Block"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_id" {
  description = "Public Subnet ID"
  value       = aws_subnet.public_1.id
}

output "private_subnet_ids" {
  description = "Private Subnet IDs"
  value       = [aws_subnet.private_1.id, aws_subnet.private_2.id]
}

# EC2 Instance
output "ec2_instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.app_server.id
}

output "ec2_public_ip" {
  description = "EC2 Public IP (Elastic IP)"
  value       = aws_eip.ec2.public_ip
}

output "ec2_private_ip" {
  description = "EC2 Private IP"
  value       = aws_instance.app_server.private_ip
}

output "ec2_hostname" {
  description = "EC2 Instance hostname"
  value       = aws_instance.app_server.public_dns
}

# RDS Database
output "db_instance_id" {
  description = "RDS Instance ID"
  value       = aws_db_instance.main.id
}

output "db_endpoint" {
  description = "RDS Endpoint"
  value       = aws_db_instance.main.endpoint
}

output "db_address" {
  description = "RDS Database Address"
  value       = aws_db_instance.main.address
}

output "db_port" {
  description = "RDS Database Port"
  value       = aws_db_instance.main.port
}

output "db_name" {
  description = "RDS Database Name"
  value       = aws_db_instance.main.db_name
}

# Security Groups
output "ec2_security_group_id" {
  description = "EC2 Security Group ID"
  value       = aws_security_group.ec2.id
}

output "rds_security_group_id" {
  description = "RDS Security Group ID"
  value       = aws_security_group.rds.id
}

output "alb_security_group_id" {
  description = "ALB Security Group ID"
  value       = aws_security_group.alb.id
}

# Application URLs
output "app_url" {
  description = "Application URL (via EC2 Elastic IP)"
  value       = "http://${aws_eip.ec2.public_ip}"
}

output "ssh_command" {
  description = "SSH command to connect to EC2"
  value       = "ssh -i ~/.ssh/${var.key_pair_name}.pem ubuntu@${aws_eip.ec2.public_ip}"
}

# SSM Session Manager (No bastion needed!)
output "ssm_connect_command" {
  description = "SSM Session Manager connection command"
  value       = "aws ssm start-session --target ${aws_instance.app_server.id} --region ${var.aws_region}"
}
