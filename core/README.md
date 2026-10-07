# Core boundary

This directory is the forward-compatible home for reusable Grasshopper domain logic that must not depend on a deployment provider or a concrete execution environment.

During the migration, the existing src/ tree remains the compatibility implementation. New cross-environment logic belongs here or in src/environment/ when it is part of the runtime bootstrap path. Do not copy known-good implementations into both locations.

Rules:
- no AWS/GCP/OCI/Android-specific credentials;
- no host-specific paths or ports as constants;
- deployment adapters consume core contracts, never the reverse;
- environment parameters are loaded through the environment contract;
- preserve existing production behavior until an equivalent test proves replacement.
