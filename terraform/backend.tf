# # For Production: Configure remote state backend
# # Example: AWS S3
# terraform {
#   backend "s3" {
#     bucket = "my-terraform-state-bucket"
#     key    = "datadog/terraform.tfstate"
#     region = "us-east-1"
#   }
# }
