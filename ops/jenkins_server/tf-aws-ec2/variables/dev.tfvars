aws_region = "us-east-1"
aws_account_id = "026764164607"
backend_jenkins_bucket = "terraform-eks-cicd-ballandbeer1"
backend_jenkins_bucket_key = "jenkins/terraform.tfstate"
vpc_name       = "jenkins-vpc"
vpc_cidr       = "10.0.0.0/16"
public_subnets = ["10.0.1.0/24"]
instance_type  = "m5.large"
jenkins_ec2_instance = "Jenkins-Build-Server"
jenkins_security_group = "jenkins-sg"