variable "region" {
  type        = string
  description = "AWS region for the independent backup bucket."
}

variable "bucket_name" {
  type        = string
  description = "Globally unique S3 bucket name. Must be supplied explicitly."
}

variable "kms_key_arn" {
  type        = string
  description = "Existing customer-managed KMS key ARN used for S3 default encryption."
}

variable "expiration_days" {
  type        = number
  description = "Minimum object age before lifecycle expiration."
  default     = 30

  validation {
    condition     = var.expiration_days >= 14
    error_message = "expiration_days must be at least 14."
  }
}

variable "backup_prefix" {
  type        = string
  description = "Logical prefix used by the backup runner."
  default     = "postgres/"
}
