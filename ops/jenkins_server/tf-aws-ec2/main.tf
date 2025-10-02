# We'll be using publicly available modules for creating different services instead of resources
# https://registry.terraform.io/browse/modules?provider=aws

# Local variables for architecture detection and naming
locals {
  # Detect if instance type contains 'g' (Graviton/ARM instances)
  is_graviton = length(regexall("g", var.instance_type)) > 0

  # Select appropriate AMI based on architecture
  ami_id = local.is_graviton ? data.aws_ami.amazon_linux_arm.id : data.aws_ami.amazon_linux_x86.id

  # Common tags for all resources
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  # Resource name prefix
  name_prefix = "${var.project_name}-${var.environment}"
}

# Creating a VPC
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 6.4"

  name = "${local.name_prefix}-vpc"
  cidr = var.vpc_cidr

  azs                     = data.aws_availability_zones.azs.names
  public_subnets          = var.public_subnets
  map_public_ip_on_launch = true

  enable_dns_hostnames = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-vpc"
    }
  )

  public_subnet_tags = {
    Name = "${local.name_prefix}-public-subnet"
  }
}

# Security Group
module "sg" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "~> 5.0"

  name        = "${local.name_prefix}-jenkins-sg"
  description = "Security Group for Jenkins Server"
  vpc_id      = module.vpc.vpc_id

  ingress_with_cidr_blocks = [
    {
      from_port   = 8080
      to_port     = 8080
      protocol    = "tcp"
      description = "Jenkins Web UI"
      cidr_blocks = "0.0.0.0/0"
    },
    {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      description = "HTTPS"
      cidr_blocks = "0.0.0.0/0"
    },
    {
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      description = "HTTP"
      cidr_blocks = "0.0.0.0/0"
    },
    {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      description = "SSH"
      cidr_blocks = "0.0.0.0/0"
    },
    {
      from_port   = 9000
      to_port     = 9000
      protocol    = "tcp"
      description = "SonarQube"
      cidr_blocks = "0.0.0.0/0"
    }
  ]

  egress_with_cidr_blocks = [
    {
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      cidr_blocks = "0.0.0.0/0"
    }
  ]

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-jenkins-sg"
    }
  )
}

# EC2 Instance for Jenkins
module "ec2_instance" {
  source  = "terraform-aws-modules/ec2-instance/aws"
  version = "~> 6.1"

  name = "${local.name_prefix}-jenkins-server"

  instance_type               = var.instance_type
  ami                         = local.ami_id
  key_name                    = "${var.project_name}kp"
  monitoring                  = true
  vpc_security_group_ids      = [module.sg.security_group_id]
  subnet_id                   = module.vpc.public_subnets[0]
  associate_public_ip_address = true
  user_data                   = file("../scripts/install_build_tools.sh")
  availability_zone           = data.aws_availability_zones.azs.names[0]

  root_block_device = {
    size                  = 50
    type                  = "gp3"
    delete_on_termination = true
    encrypted             = true
  }

  tags = merge(
    local.common_tags,
    {
      Name         = "${local.name_prefix}-jenkins-server"
      Architecture = local.is_graviton ? "ARM64" : "x86_64"
      AMI          = local.ami_id
    }
  )
}