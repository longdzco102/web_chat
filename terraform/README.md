# ============================================
# Terraform Configuration
# ============================================
# 
# This directory contains Terraform configurations for:
# - VPC Networking (Public/Private Subnets, NAT Gateway)
# - EC2 Instance with Docker
# - RDS PostgreSQL Database
# - Security Groups
# - IAM Roles
#
# ============================================
# Quick Start
# ============================================
#
# 1. Initialize Terraform:
#    cd terraform
#    terraform init
#
# 2. Create terraform.tfvars file:
#    cp terraform.tfvars.example terraform.tfvars
#    # Edit terraform.tfvars with your values
#
# 3. Plan and apply:
#    terraform plan -out=tfplan
#    terraform apply tfplan
#
# ============================================
# Prerequisites
# ============================================
#
# - AWS CLI configured with credentials
# - SSH key pair created in AWS EC2
# - S3 bucket for remote state (optional)
# - DynamoDB table for state locking (optional)
#
# ============================================
# Project Structure
# ============================================
#
# terraform/
# ├── provider.tf        # AWS provider configuration
# ├── variables.tf       # Input variables
# ├── network.tf         # VPC, Subnets, NAT Gateway
# ├── security_groups.tf # Security groups
# ├── ec2.tf             # EC2 instance
# ├── rds.tf             # RDS database
# ├── outputs.tf         # Output values
# ├── backend.tf         # Remote state config
# ├── userdata.sh       # EC2 initialization script
# ├── terraform.tfvars.example
# └── README.md          # This file
#
# ============================================
