# Android archive storage benchmark - 2026-10-01

Device: android-phone-a146u
RDC: 566d623e-df45-4b16-b2be-4cbd08567a49
Android API: 35

Observed single-file fsync writes:

| Destination | 256 KiB | 1 MiB | 4 MiB | 16 MiB |
|---|---:|---:|---:|---:|
| Termux native cache | 4.64 MB/s | 18.52 MB/s | 58.88 MB/s | 132.07 MB/s |
| /sdcard/OmniKali shared storage | 3.84 MB/s | 14.44 MB/s | 51.29 MB/s | 122.38 MB/s |

These measurements are device-specific and are not treated as RAM-equivalent performance.

Decision for the first archive implementation:
- use bounded pages;
- target approximately 4 MiB maximum page payload when byte accounting is available;
- keep checkpoint metadata small;
- benchmark again before changing the page target on a different device or storage medium.

The existing importer still has a message-count bound. A future byte-bounded builder should enforce the 4 MiB target directly.
