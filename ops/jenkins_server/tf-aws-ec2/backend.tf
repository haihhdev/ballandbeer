terraform {
  backend "s3" {
    bucket = "terraform-bnb-haohai"
    key    = "jenkins/terraform.tfstate"
    region = "ap-southeast-1"
  }
}