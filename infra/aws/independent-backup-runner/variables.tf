variable "region" {
  type        = string
  description = "AWS region for the backup runner role."
}

variable "role_name" {
  type        = string
  description = "Explicit IAM role name for the independent PostgreSQL backup runner."
}

variable "secret_arn" {
  type        = string
  description = "Secrets Manager ARN containing the dedicated PostgreSQL backup credentials."
}

variable "bucket_arn" {
  type        = string
  description = "S3 bucket ARN used for independent backups."
}

variable "backup_prefix" {
  type        = string
  description = "Object prefix writable by the backup runner."
  default     = "postgres/"
}

variable "kms_key_arn" {
  type        = string
  description = "KMS key ARN used for S3 SSE-KMS."
}
