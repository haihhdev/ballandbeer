output "jenkins_server_public_ip" {
  description = "Public IP address of the Jenkins EC2 instance"
  value       = module.ec2_instance.public_ip
}

output "jenkins_server_instance_id" {
  description = "Instance ID of the Jenkins server"
  value       = module.ec2_instance.id
}

output "jenkins_url" {
  description = "Jenkins web UI URL"
  value       = "http://${module.ec2_instance.public_ip}:8080"
}

output "vpc_id" {
  description = "VPC ID where Jenkins is deployed"
  value       = module.vpc.vpc_id
}

output "security_group_id" {
  description = "Security group ID for Jenkins"
  value       = module.sg.security_group_id
}

output "ami_id_used" {
  description = "AMI ID used for the Jenkins instance"
  value       = local.ami_id
}

output "architecture" {
  description = "Architecture type (ARM64 or x86_64)"
  value       = local.is_graviton ? "ARM64" : "x86_64"
}