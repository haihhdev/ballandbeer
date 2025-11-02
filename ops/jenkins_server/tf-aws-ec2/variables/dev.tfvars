aws_region     = "ap-southeast-1"
project_name   = "ballandbeer"
environment    = "dev"
vpc_cidr       = "10.0.0.0/16"
public_subnets = ["10.0.1.0/24"]
instance_type  = "t4g.medium"

# Spot Instance Configuration
use_spot                  = true
spot_allocation_strategy  = "lowest-price"
spot_max_price           = ""