terraform {
  backend "s3" {
    bucket = "terraform-eks-cicd-170604"
    key    = "jenkins/terraform.tfstate"
    region = "us-east-1"
  }
}