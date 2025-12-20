terraform {
  backend "s3" {
    bucket = "terraform-bnb-haohai"
    key    = "kubernetes/terraform.tfstate"
    region = "ap-southeast-1"
  }
}