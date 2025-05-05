# AWS Provider設定
provider "aws" {
  region = var.aws_region
}

# Parameter Store（環境変数の保存）
locals {
  ssm_parameters = {
    "zoom_webhook_secret_token" = {
      name        = "ZOOM_WEBHOOK_SECRET_TOKEN"
      description = "Zoom Webhook Secret Token"
      type        = "SecureString"
      value       = var.zoom_webhook_secret_token
    },
    "zoom_account_id" = {
      name        = "ZOOM_ACCOUNT_ID"
      description = "Zoom Account ID"
      type        = "SecureString"
      value       = var.zoom_account_id
    },
    "zoom_client_id" = {
      name        = "ZOOM_CLIENT_ID"
      description = "Zoom Client ID"
      type        = "SecureString"
      value       = var.zoom_client_id
    },
    "zoom_client_secret" = {
      name        = "ZOOM_CLIENT_SECRET"
      description = "Zoom Client Secret"
      type        = "SecureString"
      value       = var.zoom_client_secret
    },
    "salesforce_base_url" = {
      name        = "SALESFORCE_BASE_URL"
      description = "Salesforce Base URL"
      type        = "String"
      value       = var.salesforce_base_url
    },
    "salesforce_client_id" = {
      name        = "SALESFORCE_CLIENT_ID"
      description = "Salesforce Client ID"
      type        = "SecureString"
      value       = var.salesforce_client_id
    },
    "salesforce_client_secret" = {
      name        = "SALESFORCE_CLIENT_SECRET"
      description = "Salesforce Client Secret"
      type        = "SecureString"
      value       = var.salesforce_client_secret
    }
  }
}

resource "aws_ssm_parameter" "parameters" {
  for_each = local.ssm_parameters

  name        = "/${var.app_name}/${var.environment}/${each.value.name}"
  description = each.value.description
  type        = each.value.type
  value       = each.value.value
  tags        = local.common_tags
}

# ECRリポジトリ（Lambdaコンテナイメージの保存先）
resource "aws_ecr_repository" "app_repository" {
  name                 = "${var.app_name}-${var.environment}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

# Lambda実行ロール
resource "aws_iam_role" "lambda_execution_role" {
  name = "${var.app_name}-${var.environment}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# Lambda実行ロールにポリシーをアタッチ
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Parameter Storeへのアクセス権限
resource "aws_iam_policy" "parameter_store_access" {
  name        = "${var.app_name}-${var.environment}-ssm-policy"
  description = "Allow access to Parameter Store parameters"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_parameter_store_access" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = aws_iam_policy.parameter_store_access.arn
}

# Lambda関数
resource "aws_lambda_function" "app_lambda" {
  function_name = "${var.app_name}-${var.environment}"
  role          = aws_iam_role.lambda_execution_role.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.app_repository.repository_url}:latest"
  timeout       = 30
  memory_size   = 512

  environment {
    variables = {
      NODE_ENV                               = var.environment
      PARAMETER_STORE_PATH                   = "/${var.app_name}/${var.environment}"
      PORT                                   = "8080"
      SALESFORCE_OPPORTUNITY_ID_REGEX        = "^\\[Opp-([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})\\]"
      SALESFORCE_EVENT_SUBJECT_PREFIX        = "[Zoom録画] "
      SALESFORCE_EVENT_DURATION_MINUTES      = "60"
      SALESFORCE_EVENT_ZOOM_UUID_FIELD       = "ZoomMeetingId__c"
      SALESFORCE_EVENT_MEETING_SUMMARY_FIELD = "Description"
    }
  }

  tags = local.common_tags
}

# API Gateway
resource "aws_apigatewayv2_api" "api_gateway" {
  name          = "${var.app_name}-${var.environment}-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }

  tags = local.common_tags
}

# API Gateway ステージ
resource "aws_apigatewayv2_stage" "api_stage" {
  api_id      = aws_apigatewayv2_api.api_gateway.id
  name        = var.environment
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      ip               = "$context.identity.sourceIp"
      requestTime      = "$context.requestTime"
      httpMethod       = "$context.httpMethod"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      protocol         = "$context.protocol"
      responseLength   = "$context.responseLength"
      path             = "$context.path"
      integrationError = "$context.integrationErrorMessage"
    })
  }

  tags = local.common_tags
}

# API Gateway CloudWatch Logs
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/${var.app_name}-${var.environment}"
  retention_in_days = 30
  tags              = local.common_tags
}

# Lambda CloudWatch Logs
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.app_lambda.function_name}"
  retention_in_days = 30
  tags              = local.common_tags
}

# API Gateway と Lambda の統合
resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.api_gateway.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.app_lambda.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# API Gateway ルート
resource "aws_apigatewayv2_route" "status_route" {
  api_id    = aws_apigatewayv2_api.api_gateway.id
  route_key = "GET /status"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_route" "webhook_route" {
  api_id    = aws_apigatewayv2_api.api_gateway.id
  route_key = "POST /webhook/zoom"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_route" "api_route" {
  api_id    = aws_apigatewayv2_api.api_gateway.id
  route_key = "ANY /api/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# Lambda実行権限
resource "aws_lambda_permission" "api_gateway_permission" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.app_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api_gateway.execution_arn}/*/*"
}

# 現在のAWSアカウント情報を取得
data "aws_caller_identity" "current" {}

# 共通タグ
locals {
  common_tags = {
    Environment = var.environment
    Project     = var.app_name
    ManagedBy   = "terraform"
  }
}
