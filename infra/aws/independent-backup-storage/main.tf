resource "aws_s3_bucket" "backups" {
  bucket = var.bucket_name

  tags = {
    Purpose = "OmniKali independent PostgreSQL recovery"
    Managed = "terraform"
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.kms_key_arn
      sse_algorithm     = "aws:kms"
    }

    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "retain-independent-recovery-points"
    status = "Enabled"

    filter {
      prefix = var.backup_prefix
    }

    expiration {
      days = var.expiration_days
    }

    noncurrent_version_expiration {
      noncurrent_days = var.expiration_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_policy" "tls_only" {
  bucket = aws_s3_bucket.backups.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource = [
        aws_s3_bucket.backups.arn,
        "${aws_s3_bucket.backups.arn}/*"
      ]
      Condition = {
        Bool = {
          "aws:SecureTransport" = "false"
        }
      }
    }]
  })
}
