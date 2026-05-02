resource "datadog_synthetics_test" "uptime_check" {
  name      = "[${var.environment}] ${var.service_name} Uptime Check"
  type      = "api"
  subtype   = "http"
  status    = "live"
  locations = ["aws:us-east-1", "aws:eu-west-1"]

  request_definition {
    method = "GET"
    url    = var.app_url
  }

  assertion {
    type     = "statusCode"
    operator = "is"
    target   = "200"
  }

  assertion {
    type     = "header"
    operator = "contains"
    property = "content-type"
    target   = "application/json"
  }

  assertion {
    type     = "body"
    operator = "contains"
    target   = "status\": \"running"
  }

  options_list {
    tick_every = 300
  }
}

variable "environment" {}
variable "service_name" {}
variable "app_url" {
  type        = string
  description = "The URL of the application to check"
}
