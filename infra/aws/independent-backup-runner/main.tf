data "aws_iam_policy_document" "trust" {
  statement {
    sid     = "Ec2Trust"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "backup" {
  statement {
    sid    = "ReadBackupDatabaseSecret"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret"
    ]
    resources = [var.secret_arn]
  }

  statement {
    sid    = "ListBackupPrefix"
    effect = "Allow"
    actions = ["s3:ListBucket"]
    resources = [var.bucket_arn]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["${var.backup_prefix}*"]
    }
  }

  statement {
    sid    = "WriteBackupObjects"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:AbortMultipartUpload"
    ]
    resources = ["${var.bucket_arn}/${var.backup_prefix}*"]
  }

  statement {
    sid    = "EncryptS3Objects"
    effect = "Allow"
    actions = [
      "kms:GenerateDataKey",
      "kms:Decrypt"
    ]
    resources = [var.kms_key_arn]
  }
}

resource "aws_iam_role" "backup_runner" {
  name               = var.role_name
  assume_role_policy = data.aws_iam_policy_document.trust.json

  tags = {
    Purpose = "OmniKali independent PostgreSQL backup runner"
    Managed = "terraform"
  }
}

resource "aws_iam_role_policy" "backup" {
  name   = "${var.role_name}-policy"
  role   = aws_iam_role.backup_runner.id
  policy = data.aws_iam_policy_document.backup.json
}
