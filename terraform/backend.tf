# ============================================
# Terraform Backend Configuration (S3 + DynamoDB)
# ============================================
# Uncomment and customize for production use
# ============================================

# terraform {
#   backend "s3" {
#     bucket         = "your-terraform-state-bucket-name"
#     key            = "xianxia-chat/terraform.tfstate"
#     region         = "ap-southeast-1"
#     encrypt        = true
#     dynamodb_table = "terraform-state-lock"
#   }
# }

# ============================================
# DynamoDB Table for State Locking
# ============================================
# Run this manually once to create the state lock table:
#
# aws dynamodb create-table \
#   --table-name terraform-state-lock \
#   --attribute-definitions AttributeName=LockID,AttributeType=S \
#   --key-schema AttributeName=LockID,KeyType=HASH \
#   --billing-mode PAY_PER_REQUEST \
#   --region ap-southeast-1
# ============================================
