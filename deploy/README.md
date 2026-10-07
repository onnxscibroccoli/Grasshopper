# Deployment boundary

Deployment-specific behavior belongs under this boundary. Provider and host mechanics must consume the core contracts and environment configuration rather than embedding business logic.

Current compatibility locations:
- infra/aws/ provider infrastructure;
- scripts/cloud-android/ Cloud Android lifecycle tooling;
- scripts/gcp/ GCP deployment tooling;
- scripts/oci-* OCI workstation lifecycle tooling.

New deployment code should be added under deploy/<target>/ first. Existing scripts are migrated incrementally with compatibility wrappers, not duplicated implementations.
