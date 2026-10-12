# ============================================
# RDS Database (PostgreSQL)
# ============================================

resource "aws_db_instance" "main" {
  identifier           = "${var.project_name}-db"
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = var.db_instance_class
  allocated_storage    = var.db_allocated_storage
  db_name              = "webchat"
  username             = "admin"
  password             = var.db_password
  db_subnet_group_name = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  # Storage
  storage_type         = "gp3"
  iops                 = 3000
  storage_throughput   = 125
  
  # Backup configuration
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"
  
  # Performance insights
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  
  # Security
  publicly_accessible  = false
  skip_final_snapshot  = false
  final_snapshot_identifier = "${var.project_name}-final-snapshot"
  deletion_protection  = false  # Set true in production
  
  # Parameter group
  parameter_group_name = "default.postgres15"
  
  tags = {
    Name = "${var.project_name}-rds"
  }
}

# ============================================
# IAM Roles
# ============================================

# RDS Enhanced Monitoring Role
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.project_name}-rds-monitoring-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "monitoring.rds.amazonaws.com"
      }
    }]
  })
  
  tags = {
    Name = "${var.project_name}-rds-monitoring-role"
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring_attach" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
  role       = aws_iam_role.rds_monitoring.name
}
