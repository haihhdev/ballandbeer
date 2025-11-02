terraform {
  backend "s3" {
    bucket = "terraform-ballandbeer-state"
    key    = "kubernetes/terraform.tfstate"
    region = "ap-southeast-1"
  }
}