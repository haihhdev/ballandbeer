terraform {
  backend "s3" {
    bucket = "terraform-eks-cicd-ballandbeer"
    key    = "jenkins/terraform.tfstate"
    region = "us-east-1"
  }
}