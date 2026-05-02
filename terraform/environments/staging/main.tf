module "datadog_infrastructure" {
  source = "../../"

  environment  = "staging"
  service_name = "india-map-staging"
  app_url      = "https://staging-api.ms-sat.live"

  datadog_api_key = var.datadog_api_key
  datadog_app_key = var.datadog_app_key
}

variable "datadog_api_key" { sensitive = true }
variable "datadog_app_key" { sensitive = true }
