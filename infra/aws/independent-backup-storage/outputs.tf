output "bucket_arn" {
  value       = aws_s3_bucket.backups.arn
  description = "ARN of the independent backup bucket."
}

output "bucket_name" {
  value       = aws_s3_bucket.backups.bucket
  description = "Name of the independent backup bucket."
}

output "backup_uri" {
  value       = "s3://${aws_s3_bucket.backups.bucket}/${trimsuffix(var.backup_prefix, "/")}/"
  description = "S3 URI prefix to provide to the backup runner."
}
