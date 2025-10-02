variable "aws_region" {
  description = "The region where the infrastructure should be deployed to"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming prefix"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, test, prod)"
  type        = string
}



variable "vpc_cidr" {
  description = "VPC CIDR block for Jenkins Server VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnets" {
  description = "List of public subnet CIDR ranges"
  type        = list(string)
  default     = ["10.0.1.0/24"]
}

variable "instance_type" {
  description = "EC2 instance type for Jenkins server (use types with 'g' for Graviton/ARM, e.g., t4g.medium, m6g.large)"
  type        = string
  default     = "t3.small"
}