data "tls_certificate" "eks_oidc" {
  url = module.eks.cluster_oidc_issuer_url
}

resource "aws_iam_openid_connect_provider" "eks_oidc" {
  count = length(data.aws_iam_openid_connect_provider.existing_oidc) == 0 ? 1 : 0

  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks_oidc.certificates[0].sha1_fingerprint]
  url             = module.eks.cluster_oidc_issuer_url

  tags = merge(
    local.common_tags,
    {
      Name = "${local.cluster_name}-oidc-provider"
    }
  )
}

data "aws_iam_openid_connect_provider" "existing_oidc" {
  url = module.eks.cluster_oidc_issuer_url
}

locals {
  oidc_provider_arn = length(data.aws_iam_openid_connect_provider.existing_oidc) > 0 ? data.aws_iam_openid_connect_provider.existing_oidc.arn : aws_iam_openid_connect_provider.eks_oidc[0].arn
  oidc_provider     = replace(module.eks.cluster_oidc_issuer_url, "https://", "")
}

resource "aws_iam_role" "cluster_autoscaler" {
  name = "${local.cluster_name}-cluster-autoscaler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = local.oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${local.oidc_provider}:sub" = "system:serviceaccount:kube-system:cluster-autoscaler-aws-cluster-autoscaler"
            "${local.oidc_provider}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "${local.cluster_name}-cluster-autoscaler-role"
    }
  )
}

resource "aws_iam_role_policy_attachment" "cluster_autoscaler" {
  role       = aws_iam_role.cluster_autoscaler.name
  policy_arn = aws_iam_policy.cluster_autoscaler.arn
}
