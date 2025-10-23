# StorageClass for EBS CSI Driver

resource "kubernetes_storage_class_v1" "ebs_gp3" {
  metadata {
    name = "gp3"
    annotations = {
      "storageclass.kubernetes.io/is-default-class" = "true"
    }
  }

  storage_provisioner    = "ebs.csi.aws.com"
  reclaim_policy         = "Delete"
  allow_volume_expansion = true
  volume_binding_mode    = "WaitForFirstConsumer"

  parameters = {
    type      = "gp3"
    encrypted = "true"
    # GP3 specific parameters
    iops       = "3000"
    throughput = "125"
  }

  # Ensure EBS CSI Driver is installed before creating StorageClass
  depends_on = [
    module.eks
  ]
}

# Optional: Remove default annotation from gp2 StorageClass
resource "kubernetes_annotations" "gp2_default" {
  api_version = "storage.k8s.io/v1"
  kind        = "StorageClass"

  metadata {
    name = "gp2"
  }

  annotations = {
    "storageclass.kubernetes.io/is-default-class" = "false"
  }

  # Only modify if gp2 exists
  force = true

  depends_on = [
    module.eks
  ]
}
