# API Gateway URL
output "api_gateway_url" {
  description = "API Gateway URL"
  value       = "${aws_apigatewayv2_api.api_gateway.api_endpoint}/${aws_apigatewayv2_stage.api_stage.name}"
}

# Webhook URL
output "webhook_url" {
  description = "Zoom Webhook URL"
  value       = "${aws_apigatewayv2_api.api_gateway.api_endpoint}/${aws_apigatewayv2_stage.api_stage.name}/webhook/zoom"
}

# ECR Repository URL
output "ecr_repository_url" {
  description = "ECR Repository URL"
  value       = aws_ecr_repository.app_repository.repository_url
}

# Lambda Function Name
output "lambda_function_name" {
  description = "Lambda Function Name"
  value       = aws_lambda_function.app_lambda.function_name
}

# Parameter Store Path
output "parameter_store_path" {
  description = "Parameter Store Path"
  value       = "/${var.app_name}/${var.environment}"
}
