variable "datadog_api_key" {
  type        = string
  description = "Datadog API Key"
  sensitive   = true
}

variable "datadog_app_key" {
  type        = string
  description = "Datadog APP Key"
  sensitive   = true
}

variable "environment" {
  type        = string
  description = "Environment name (e.g. staging, production)"
  default     = "staging"
}

variable "service_name" {
  type        = string
  description = "Base service name"
  default     = "india-map"
}

variable "app_url" {
  type        = string
  description = "The URL of the application"
}
