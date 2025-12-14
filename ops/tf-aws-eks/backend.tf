terraform {
  backend "s3" {
    bucket = "terraform-bnb-states"
    key    = "kubernetes/terraform.tfstate"
    region = "ap-southeast-1"
  }
}