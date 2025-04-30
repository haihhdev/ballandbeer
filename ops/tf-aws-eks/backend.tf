terraform {
  backend "s3" {
    bucket = "terraform-eks-cicd-ballandbeer"
    key    = "eks/terraform.tfstate"
    region = "us-east-1"
  }
}