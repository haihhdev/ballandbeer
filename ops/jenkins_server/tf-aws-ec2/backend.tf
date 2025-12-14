terraform {
  backend "s3" {
    bucket = "terraform-bnb-states"
    key    = "jenkins/terraform.tfstate"
    region = "ap-southeast-1"
  }
}