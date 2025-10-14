# We'll be using publicly available modules for creating different services instead of resources
# https://registry.terraform.io/browse/modules?provider=aws

# Creating a VPC for EKS
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 6.4"

  name = "${local.name_prefix}-vpc"
  cidr = var.vpc_cidr

  azs             = data.aws_availability_zones.azs.names
  public_subnets  = var.public_subnets
  private_subnets = var.private_subnets

  enable_dns_hostnames = true
  enable_dns_support   = true

  # NAT Gateway configuration
  enable_nat_gateway = true
  single_nat_gateway = true

  # Enable VPC Flow Logs for security monitoring
  enable_flow_log                      = false
  create_flow_log_cloudwatch_iam_role  = false
  create_flow_log_cloudwatch_log_group = false

  # Tags for EKS cluster discovery
  tags = merge(
    local.common_tags,
    {
      Name                                          = "${local.name_prefix}-vpc"
      "kubernetes.io/cluster/${local.cluster_name}" = "shared"
    }
  )

  # Tags for public subnets (for external load balancers)
  public_subnet_tags = {
    Name                                          = "${local.name_prefix}-public-subnet"
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                      = "1"
  }

  # Tags for private subnets (for internal load balancers)
  private_subnet_tags = {
    Name                                          = "${local.name_prefix}-private-subnet"
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"             = "1"
  }
}