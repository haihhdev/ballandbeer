terraform {
  backend "s3" {
    bucket = "terraform-bnb-bucket"
    key    = "kubernetes/terraform.tfstate"
    region = "ap-southeast-1"
  }
}