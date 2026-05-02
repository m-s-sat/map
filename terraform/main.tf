module "monitors" {
  source       = "./modules/monitors"
  environment  = var.environment
  service_name = var.service_name
}

module "dashboards" {
  source       = "./modules/dashboards"
  environment  = var.environment
  service_name = var.service_name
}

module "synthetics" {
  source       = "./modules/synthetics"
  environment  = var.environment
  service_name = var.service_name
  app_url      = var.app_url
}
