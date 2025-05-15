terraform {
  backend "s3" {
    bucket = "terraform-eks-cicd-ballandbeer6"
    key    = "eks/terraform.tfstate"
    region = "us-east-1"
  }
}