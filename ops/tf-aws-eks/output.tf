output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "cluster_version" {
  description = "The Kubernetes server version for the EKS cluster"
  value       = module.eks.cluster_version
}

output "node_group_role_name" {
  description = "Name of the EKS node group IAM role"
  value       = module.eks.eks_managed_node_groups["main"].iam_role_name
}

output "node_group_role_arn" {
  description = "ARN of the EKS node group IAM role"
  value       = module.eks.eks_managed_node_groups["main"].iam_role_arn
}

output "vpc_id" {
  description = "VPC ID where EKS is deployed"
  value       = module.vpc.vpc_id
}

output "private_subnets" {
  description = "List of IDs of private subnets"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "List of IDs of public subnets"
  value       = module.vpc.public_subnets
}

output "architecture" {
  description = "Architecture type (ARM64 or x86_64)"
  value       = local.is_graviton ? "ARM64" : "x86_64"
}

output "ami_type" {
  description = "AMI type used for EKS nodes"
  value       = local.ami_type
}

output "cluster_autoscaler_role_arn" {
  description = "ARN of IAM role for Cluster Autoscaler service account"
  value       = aws_iam_role.cluster_autoscaler.arn
}

output "oidc_provider_arn" {
  description = "ARN of the OIDC Provider for EKS"
  value       = local.oidc_provider_arn
}