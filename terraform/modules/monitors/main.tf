resource "datadog_monitor" "service_availability" {
  name               = "[${var.environment}] ${var.service_name} Availability"
  type               = "service check"
  query              = "\"ntp.status\".over(\"service:${var.service_name}\",\"env:${var.environment}\").last(2).count_by_status()"
  message            = "Service ${var.service_name} is down in ${var.environment}! @all"
  tags               = ["env:${var.environment}", "service:${var.service_name}"]

  monitor_thresholds {
    critical = 1
    warning  = 1
  }
}

resource "datadog_monitor" "pod_restarts" {
  name               = "[${var.environment}] ${var.service_name} High Pod Restarts"
  type               = "metric alert"
  query              = "sum(last_30m):sum:kubernetes.containers.restarts{kube_deployment:${var.service_name},env:${var.environment}} > 3"
  message            = "Pod restarts for ${var.service_name} are high in ${var.environment}. Potential crash loop! @all"
  tags               = ["env:${var.environment}", "service:${var.service_name}", "type:k8s"]

  monitor_thresholds {
    critical = 3
    warning  = 1
  }
}

resource "datadog_monitor" "oom_kills" {
  name               = "[${var.environment}] ${var.service_name} OOM Kills Detected"
  type               = "metric alert"
  query              = "sum(last_5m):sum:kubernetes.pods.oom_kills{kube_deployment:${var.service_name},env:${var.environment}} > 0"
  message            = "OOM Kill detected for ${var.service_name} in ${var.environment}! The 2GB limit might have been exceeded. @all"
  tags               = ["env:${var.environment}", "service:${var.service_name}", "type:k8s"]

  monitor_thresholds {
    critical = 0
  }
}

resource "datadog_monitor" "ram_usage" {
  name               = "[${var.environment}] ${var.service_name} High Container RAM Usage"
  type               = "metric alert"
  query              = "avg(last_5m):avg:kubernetes.memory.usage_pct{kube_deployment:${var.service_name},env:${var.environment}} * 100 > 90"
  message            = "Container RAM usage is over 90% for ${var.service_name} in ${var.environment}. @all"
  tags               = ["env:${var.environment}", "service:${var.service_name}", "type:k8s"]

  monitor_thresholds {
    critical = 90
    warning  = 80
  }
}

resource "datadog_monitor" "deployment_health" {
  name               = "[${var.environment}] ${var.service_name} Deployment Unhealthy"
  type               = "metric alert"
  query              = "avg(last_5m):sum:kubernetes.deployments.replicas_available{kube_deployment:${var.service_name},env:${var.environment}} / sum:kubernetes.deployments.replicas_desired{kube_deployment:${var.service_name},env:${var.environment}} < 1"
  message            = "Deployment ${var.service_name} has fewer available replicas than desired in ${var.environment}. @all"
  tags               = ["env:${var.environment}", "service:${var.service_name}", "type:k8s"]

  monitor_thresholds {
    critical = 1
  }
}

resource "datadog_monitor" "error_rate" {
  name               = "[${var.environment}] ${var.service_name} High Error Rate"
  type               = "query alert"
  query              = "sum(last_5m):sum:http.server.requests.errors{service:${var.service_name},env:${var.environment}}.as_rate() / sum:http.server.requests.total{service:${var.service_name},env:${var.environment}}.as_rate() * 100 > 5"
  message            = "Error rate for ${var.service_name} is above 5% in ${var.environment}. @all"
  tags               = ["env:${var.environment}", "service:${var.service_name}"]

  monitor_thresholds {
    critical = 5
    warning  = 2
  }
}

variable "environment" {}
variable "service_name" {}
