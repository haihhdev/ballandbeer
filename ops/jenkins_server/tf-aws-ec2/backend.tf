terraform {
  backend "s3" {
    bucket = "terraform-eks-cicd-ballandbeer6"
    key    = "jenkins/terraform.tfstate"
    region = "us-east-1"
  }
}