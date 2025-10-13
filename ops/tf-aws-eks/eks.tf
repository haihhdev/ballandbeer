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

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # Cluster addons
  # EKS Addons
  addons = {
    # VPC-CNI must be installed before compute resources
    vpc-cni = {
      before_compute = true
    }
    # Pod Identity agent for AWS service access
    eks-pod-identity-agent = {
      before_compute = true
    }
    coredns    = {}
    kube-proxy = {}
    # aws-ebs-csi-driver = {}
  }

  # EKS Managed Node Groups using new compute_config in v21
  eks_managed_node_groups = {
    main = {
      name = "${local.name_prefix}-node-group"

      # Scaling configuration
      min_size     = var.node_group_min_size
      max_size     = var.node_group_max_size
      desired_size = var.node_group_desired_size

      # Instance configuration
      instance_types = [var.instance_type]
      capacity_type  = var.capacity_type

      # Use appropriate AMI type based on architecture
      ami_type = local.ami_type

      # IAM role
      iam_role_use_name_prefix = false

      # Block device mappings
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

      # Labels for node groups
      labels = {
        architecture = local.is_graviton ? "arm64" : "amd64"
        environment  = var.environment
        managed-by   = "terraform"
      }

      tags = merge(
        local.common_tags,
        {
          Name         = "${local.name_prefix}-eks-node"
          Architecture = local.is_graviton ? "ARM64" : "x86_64"
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