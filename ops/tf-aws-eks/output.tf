output "node_group_role_name" {
  value = aws_iam_role.eks_node_role.name
}

output "cluster_name" {
  value = aws_eks_cluster.main.name
}