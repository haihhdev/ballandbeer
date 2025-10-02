variable "aws_region" {
  description = "The region where the infrastructure should be deployed to"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming prefix"
  type        = string
  default     = "ballandbeer"
}

variable "environment" {
  description = "Environment name (dev, test, prod)"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block for EKS VPC"
  type        = string
  default     = "192.168.0.0/16"
}

variable "public_subnets" {
  description = "List of public subnet CIDR ranges"
  type        = list(string)
  default     = ["192.168.1.0/24", "192.168.2.0/24", "192.168.3.0/24"]
}

variable "private_subnets" {
  description = "List of private subnet CIDR ranges"
  type        = list(string)
  default     = ["192.168.4.0/24", "192.168.5.0/24", "192.168.6.0/24"]
}

variable "instance_type" {
  description = "EC2 instance type for EKS nodes (use types with 'g' for Graviton/ARM, e.g., t4g.medium, m6g.large)"
  type        = string
  default     = "t4g.small"
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.33"
}

variable "node_group_min_size" {
  description = "Minimum number of nodes in the EKS node group"
  type        = number
  default     = 1
}

variable "node_group_max_size" {
  description = "Maximum number of nodes in the EKS node group"
  type        = number
  default     = 5
}

variable "node_group_desired_size" {
  description = "Desired number of nodes in the EKS node group"
  type        = number
  default     = 3
}