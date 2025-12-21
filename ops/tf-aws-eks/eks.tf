# Ref - https://registry.terraform.io/modules/terraform-aws-modules/eks/aws/latest

data "aws_availability_zones" "azs" {}

# Local variables for architecture detection and naming
locals {
  # Detect if instance type contains 'g' (Graviton/ARM instances)
  is_graviton = length(regexall("g", var.instance_type)) > 0

  # Select appropriate AMI type based on architecture
  ami_type = local.is_graviton ? "AL2023_ARM_64_STANDARD" : "AL2023_x86_64_STANDARD"

  # Common tags for all resources
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  # Resource name prefix
  name_prefix = "${var.project_name}-${var.environment}"

  # Cluster name
  cluster_name = "${local.name_prefix}-eks"
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 21.0"

  name               = local.cluster_name
  kubernetes_version = var.cluster_version

  # Cluster endpoint access
  endpoint_public_access  = true
  endpoint_private_access = true

  # Adds the current caller identity as an administrator via cluster access entry
  enable_cluster_creator_admin_permissions = true

  # Enable OIDC provider for IRSA
  enable_irsa = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # EKS Addons
  addons = {
    vpc-cni = {
      before_compute = true
      resolve_conflicts_on_create = "OVERWRITE"
    }
    eks-pod-identity-agent = {
      before_compute = true
    }
    coredns = {
    }
    kube-proxy = {
    }
  }

  # EKS Managed Node Groups
  eks_managed_node_groups = {
    # Infrastructure Node Group - On-Demand, excluded from autoscaler
    infrastructure = {
      name = "${local.name_prefix}-infra-node-group"

      min_size     = 2
      max_size     = 2
      desired_size = 2

      instance_types = [var.infra_instance_type]
      capacity_type  = "ON_DEMAND"
      ami_type       = local.ami_type

      iam_role_use_name_prefix = false

      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = 50
            volume_type           = "gp3"
            iops                  = 3000
            throughput            = 125
            encrypted             = true
            delete_on_termination = true
          }
        }
      }

      labels = {
        node-type    = "infrastructure"
        architecture = local.is_graviton ? "arm64" : "amd64"
        environment  = var.environment
        managed-by   = "terraform"
      }

      taints = {
        infrastructure = {
          key    = "infrastructure"
          value  = "true"
          effect = "NO_SCHEDULE"
        }
      }

      tags = merge(
        local.common_tags,
        {
          Name                                              = "${local.name_prefix}-infra-node"
          Architecture                                      = local.is_graviton ? "ARM64" : "x86_64"
          NodeType                                          = "infrastructure"
          "k8s.io/cluster-autoscaler/${local.cluster_name}" = "owned"
          "k8s.io/cluster-autoscaler/enabled"               = "false"
        }
      )
    }

    # Application Node Group - Spot instances with autoscaling
    main = {
      name = "${local.name_prefix}-node-group"

      min_size     = var.node_group_min_size
      max_size     = var.node_group_max_size
      desired_size = var.node_group_desired_size

      instance_types = [var.instance_type]
      capacity_type  = var.capacity_type
      ami_type       = local.ami_type

      iam_role_use_name_prefix = false

      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = 50
            volume_type           = "gp3"
            iops                  = 3000
            throughput            = 125
            encrypted             = true
            delete_on_termination = true
          }
        }
      }

      labels = {
        node-type    = "application"
        architecture = local.is_graviton ? "arm64" : "amd64"
        environment  = var.environment
        managed-by   = "terraform"
      }

      tags = merge(
        local.common_tags,
        {
          Name                                              = "${local.name_prefix}-eks-node"
          Architecture                                      = local.is_graviton ? "ARM64" : "x86_64"
          NodeType                                          = "application"
          "k8s.io/cluster-autoscaler/${local.cluster_name}" = "owned"
          "k8s.io/cluster-autoscaler/enabled"               = "true"
        }
      )
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name = local.cluster_name
    }
  )
}

resource "aws_eks_addon" "ebs_csi_driver" {
  cluster_name             = module.eks.cluster_name
  addon_name               = "aws-ebs-csi-driver"
  addon_version            = data.aws_eks_addon_version.ebs_csi.version
  service_account_role_arn = aws_iam_role.ebs_csi_driver.arn

  depends_on = [
    module.eks.eks_managed_node_groups
  ]
}

data "aws_eks_addon_version" "ebs_csi" {
  addon_name         = "aws-ebs-csi-driver"
  kubernetes_version = var.cluster_version
  most_recent        = true
}