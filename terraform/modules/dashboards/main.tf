resource "datadog_dashboard" "service_overview" {
  title       = "[${var.environment}] ${var.service_name} Overview"
  description = "High-level overview of ${var.service_name} in ${var.environment}"
  layout_type = "ordered"

  widget {
    timeseries_definition {
      title = "Request Rate"
      request {
        q = "sum:http.server.requests.total{service:${var.service_name},env:${var.environment}}.as_rate()"
      }
    }
  }

  widget {
    timeseries_definition {
      title = "Error Rate"
      request {
        q = "sum:http.server.requests.errors{service:${var.service_name},env:${var.environment}}.as_rate() / sum:http.server.requests.total{service:${var.service_name},env:${var.environment}}.as_rate() * 100"
      }
    }
  }

  widget {
    timeseries_definition {
      title = "Container RAM Usage (%)"
      request {
        q = "avg:kubernetes.memory.usage_pct{kube_deployment:${var.service_name},env:${var.environment}} * 100"
      }
    }
  }

  widget {
    timeseries_definition {
      title = "Pod Health (Available Replicas)"
      request {
        q = "sum:kubernetes.deployments.replicas_available{kube_deployment:${var.service_name},env:${var.environment}}"
      }
    }
  }

  widget {
    timeseries_definition {
      title = "P95 Latency"
      request {
        q = "p95:http.server.requests.latency{service:${var.service_name},env:${var.environment}}"
      }
    }
  }
}

variable "environment" {}
variable "service_name" {}
