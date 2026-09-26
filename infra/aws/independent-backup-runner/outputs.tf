output "role_arn" {
  value       = aws_iam_role.backup_runner.arn
  description = "IAM role ARN for the independent backup runner."
}
