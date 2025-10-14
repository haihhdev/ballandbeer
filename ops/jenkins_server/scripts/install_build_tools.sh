#!/bin/bash

set -e

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
  x86_64)
    AWS_ARCH="x86_64"
    KUBECTL_ARCH="amd64"
    SNYK_ARCH="linux"
    ;;
  aarch64)
    AWS_ARCH="aarch64"
    KUBECTL_ARCH="arm64"
    SNYK_ARCH="linux-arm64"
    ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

echo "=== Detected Architecture: $ARCH ==="

echo "=== Installing Jenkins ==="
sudo yum install -y wget
sudo wget -O /etc/yum.repos.d/jenkins.repo https://pkg.jenkins.io/redhat/jenkins.repo
sudo rpm --import https://pkg.jenkins.io/redhat/jenkins.io-2023.key
sudo yum upgrade -y
sudo yum install -y java-17-amazon-corretto-devel jenkins
sudo systemctl daemon-reload
sudo systemctl enable jenkins
sudo systemctl start jenkins

echo "=== Installing Git ==="
sudo yum install -y git

echo "=== Installing Docker ==="
sudo yum install -y docker
sudo usermod -aG docker ec2-user
sudo usermod -aG docker jenkins
sudo systemctl enable docker
sudo systemctl start docker
sudo chmod 777 /var/run/docker.sock

echo "=== Starting SonarQube Docker Container ==="
docker run -d \
  --name sonar \
  --restart=unless-stopped \
  -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
  -p 9000:9000 \
  sonarqube:lts-community

echo "=== Installing AWS CLI (${AWS_ARCH}) ==="
curl "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_ARCH}.zip" -o "awscliv2.zip"
sudo yum install -y unzip
unzip awscliv2.zip
sudo ./aws/install

echo "=== Installing Terraform ==="
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://rpm.releases.hashicorp.com/AmazonLinux/hashicorp.repo
sudo yum -y install terraform

echo "=== Installing kubectl (${KUBECTL_ARCH}) ==="
KUBECTL_VERSION=$(curl -L -s https://dl.k8s.io/release/stable.txt)
curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${KUBECTL_ARCH}/kubectl"
chmod +x ./kubectl
sudo mv ./kubectl /usr/local/bin/kubectl

echo "=== Installing Trivy ==="
sudo tee /etc/yum.repos.d/trivy.repo << 'EOF'
[trivy]
name=Trivy repository
baseurl=https://aquasecurity.github.io/trivy-repo/rpm/releases/$basearch/
gpgcheck=1
enabled=1
gpgkey=https://aquasecurity.github.io/trivy-repo/rpm/public.key
EOF
sudo yum -y update
sudo yum -y install trivy

echo "=== Installing Helm ==="
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh

echo "=== Installing SonarScanner CLI ==="
SONAR_VERSION=5.0.1.3006
wget https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SONAR_VERSION}-linux.zip
unzip sonar-scanner-cli-${SONAR_VERSION}-linux.zip
sudo mv sonar-scanner-${SONAR_VERSION}-linux /opt/sonar-scanner
sudo ln -s /opt/sonar-scanner/bin/sonar-scanner /usr/local/bin/sonar-scanner

echo "=== Installing Snyk CLI (${SNYK_ARCH}) ==="
sudo yum install -y jq curl
SNYK_VERSION=$(curl -s https://api.github.com/repos/snyk/cli/releases/latest | jq -r '.tag_name')
curl -Lo snyk https://github.com/snyk/cli/releases/download/${SNYK_VERSION}/snyk-${SNYK_ARCH}
chmod +x snyk
sudo mv snyk /usr/local/bin/snyk

echo "=== Verifying Installation ==="
java -version
git --version
docker --version
aws --version
terraform -version
kubectl version --client
trivy --version
helm version
sonar-scanner --version
snyk --version

echo "=== Setup Completed Successfully ==="
