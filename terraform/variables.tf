# 基本設定
variable "aws_region" {
  description = "AWSリージョン"
  type        = string
  default     = "ap-northeast-1" # 東京リージョン
}

variable "app_name" {
  description = "アプリケーション名"
  type        = string
  default     = "zoom-salesforce-integration"
}

variable "environment" {
  description = "環境名（dev, staging, prod など）"
  type        = string
  default     = "dev"
}

# Zoom API 設定
variable "zoom_webhook_secret_token" {
  description = "Zoom Webhook Secret Token"
  type        = string
  sensitive   = true
}

variable "zoom_account_id" {
  description = "Zoom Account ID"
  type        = string
  sensitive   = true
}

variable "zoom_client_id" {
  description = "Zoom Client ID"
  type        = string
  sensitive   = true
}

variable "zoom_client_secret" {
  description = "Zoom Client Secret"
  type        = string
  sensitive   = true
}

# Salesforce API 設定
variable "salesforce_base_url" {
  description = "Salesforce Base URL"
  type        = string
  default     = "https://login.salesforce.com"
}

variable "salesforce_client_id" {
  description = "Salesforce Client ID"
  type        = string
  sensitive   = true
}

variable "salesforce_client_secret" {
  description = "Salesforce Client Secret"
  type        = string
  sensitive   = true
}
