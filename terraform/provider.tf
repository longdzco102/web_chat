# ============================================
# Terraform Backend & Infrastructure
# ============================================
# Creates AWS VPC, Subnets, EC2, RDS (PostgreSQL), Security Groups
# For Xianxia Chat Web Application
# ============================================

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # Remote state configuration (S3)
  backend "s3" {
    bucket = "your-terraform-state-bucket"
    key    = "webchat/terraform.tfstate"
    region = "ap-southeast-1"
    # Enable state locking with DynamoDB
    # dynamodb_table = "terraform-state-lock"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
