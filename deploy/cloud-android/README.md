# Cloud Android deployment adapter

This adapter owns only lifecycle and host-specific mechanics. It must consume environments/cloud-android.json and the screen-control contract rather than embedding environment detection or domain policy.

The established scripts under scripts/cloud-android/ remain compatibility entrypoints while migration proceeds.
