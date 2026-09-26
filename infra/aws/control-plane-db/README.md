# Helix production PostgreSQL infrastructure

This module is the reproducible infrastructure definition for the already-validated production PostgreSQL architecture. It does not create a replacement application topology and it does not move PostgreSQL into the EC2 compute node.

## Contract

The module provisions one private Amazon RDS for PostgreSQL control-plane instance inside an existing production VPC. The application security groups are the only network clients allowed to reach TCP/5432.

The definition preserves the production contract:

- PostgreSQL is the authoritative durable control-plane store.
- RDS is private and Multi-AZ.
- storage is encrypted.
- deletion protection is enabled.
- automated backups are retained for the configured recovery window.
- the RDS-managed master password stays in AWS Secrets Manager.
- IAM database authentication remains enabled.
- PostgreSQL logs and upgrades are exported to CloudWatch.
- at least two DB subnets in distinct Availability Zones are required.
- no database password or connection string belongs in Terraform source or tfvars.

## Production target

backup_retention_days defaults to 14. This is the intended PITR target.

The live production instance was observed at 1 day and an attempted increase to 14 days was rejected by AWS because the account is currently subject to the Free Tier backup-retention restriction. That failed mutation did not change the live database configuration.

Therefore:

- this module encodes the desired reproducible configuration;
- the live production state remains a separate acceptance fact;
- no deployment may report the 14-day target as achieved until an authorized AWS change succeeds and the resulting RDS configuration is verified.

## Required inputs

Supply the actual production values from an authorized infrastructure identity:

- vpc_id
- db_subnet_ids with at least two distinct Availability Zones
- allowed_security_group_ids

Do not invent IDs and do not place credentials in *.tfvars.

## Apply gate

Before terraform apply:

1. reconcile the supplied VPC and subnets against the live production network;
2. verify the application security groups are the intended gateway/worker clients;
3. snapshot the current RDS configuration and Terraform state;
4. run terraform fmt and terraform validate;
5. review the plan for destructive or network-changing actions;
6. apply only from an authorized infrastructure identity;
7. verify Multi-AZ, encryption, deletion protection, private reachability, backup retention, and Secrets Manager ownership;
8. rerun production readiness and acceptance evidence.

This module is intentionally fail-closed around missing production network inputs.
