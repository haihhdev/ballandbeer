terraform {
  backend "s3" {
    bucket = "terraform-ballandbeer-state"
    key    = "jenkins/terraform.tfstate"
    region = "ap-southeast-1"
  }
}