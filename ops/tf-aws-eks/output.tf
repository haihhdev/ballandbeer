output "node_group_role_name" {
  description = "Name of the EKS node group IAM role"
  value       = module.eks.eks_managed_node_groups["nodes"].iam_role_name
}

output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
}