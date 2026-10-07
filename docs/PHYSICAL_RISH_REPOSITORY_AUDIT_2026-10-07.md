# Physical Rish repository audit — 2026-10-07

All 30 accessible account repositories were scanned at the commits below. Raw substring hits were manually classified: prose, translations, contributor names, and obfuscated identifiers are not launch consumers. Candidate counts do not represent executable integrations.

Eight repositories have proposed launcher/policy changes. These branches and draft PRs are **PROPOSED, not merged defaults**; exact-commit production-contract gates still govern rollout. Remaining repositories need no launcher edit at the inspected commits. Physical evidence does not prove OCI R2.

[Machine-readable audit](PHYSICAL_RISH_REPOSITORY_AUDIT_2026-10-07.json) · [Current physical launcher policy](PHYSICAL_ANDROID_LAUNCHER_POLICY_2026-10-07.md)

| Repository | Inspected default commit | Classification | Proposed change / disposition |
|---|---|---|---|
| onnxscibroccoli/Grasshopper | `6df6eb072299e6b637aaea7b86f47ba94ee0e293` | ACTIVE_AUDIT_FIX_PROPOSED | Proposed branch; PR pending |
| onnxscibroccoli/broccoli-core | `95041af6e0acb75e5c03363e2becf13b959d0e96` | CANONICAL_IMPLEMENTATION_UPDATE_PROPOSED | Proposed branch; PR pending |
| onnxscibroccoli/omnikali | `c29ef9210354008f1b77ed77c770bd30158cfd81` | POLICY_DOCUMENTATION_PROPOSED | [Draft PR](https://github.com/onnxscibroccoli/omnikali/pull/7) — PROPOSED |
| onnxscibroccoli/GPTOmniKali-full-stack | `46349f264ffac5574aedb22b6113477589cad385` | CONSUMER_UPDATE_PROPOSED | [Draft PR](https://github.com/onnxscibroccoli/GPTOmniKali-full-stack/pull/7) — PROPOSED |
| onnxscibroccoli/helix | `8f687036344e1c09c592b9fbfb9f8036b07614c0` | FALSE_SUBSTRING_MATCH | English word flourish in UI design guidance, not a Rish launch. |
| onnxscibroccoli/grasshopper-kubernetes | `5d77c5dc0accd1fb75903e364faba89f1faa3fc2` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/omn-kali-knowledge-graph-master | `b22ba6d22a9cc39c937bb871f7f3fde9333859d7` | HISTORICAL_SUPERSESSION_PROPOSED | [Draft PR](https://github.com/onnxscibroccoli/omn-kali-knowledge-graph-master/pull/11) — PROPOSED |
| onnxscibroccoli/broccoli-rish | `0218a9a39a33ae0b5343c1051c537ffa36544819` | LEGACY_PUBLIC_LAUNCHER_RETIREMENT_PROPOSED | Proposed branch; PR pending |
| onnxscibroccoli/kiln | `fed47797e3cbde14fee7b0634bb688f7125f0081` | CONSUMER_UPDATE_PROPOSED | [Draft PR](https://github.com/onnxscibroccoli/kiln/pull/2) — PROPOSED |
| onnxscibroccoli/kali-node | `6e3db0e92997f89e1f30231d0709d5bf8809d216` | CONSUMER_UPDATE_PROPOSED | [Draft PR](https://github.com/onnxscibroccoli/kali-node/pull/41) — PROPOSED |
| onnxscibroccoli/dectalk-live | `a8d5a67d13a53518ab345c97d6ac52c6b902fe0f` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/morphe-desktop | `9bc059777b21b5f33fa8323b0b364bc92222b637` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/morphe-patches-template | `57538a3b85ccd3c9a24ed3cc06ec722787563879` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/morphe-manager | `2d9e7f65af9e03370650d7840d20a47096def3be` | FALSE_SUBSTRING_MATCH | Uzbek translation strings contain rish as a substring, not a Rish launch. |
| onnxscibroccoli/oauth2-proxy | `bea3f04bf87b93f5354f392fe2216a88e6031350` | FALSE_SUBSTRING_MATCH | Historical changelog contributor @rishi1111, not a Rish launch. |
| onnxscibroccoli/morphe-patches | `18ffc1f7b30219a70a4ab4f5d4d05b156b4a3fe3` | FALSE_SUBSTRING_MATCH | Obfuscated identifier gEAvkRISHQsK, not a Rish launch. |
| onnxscibroccoli/omnikali-link | `98d8124791eca8530756c8302e7832981386c1a3` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/ara-github-write-test | `bb93800e72f01e31e10ca29e8ee7760afe07408c` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/ara-github-write-test-2 | `1a39b497f29ee6cbba6fc5251b5629b5dbacd396` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/shizuku-virtual-mic | `615687a46d7c1c1682d5326d9c6c06aa5df2aea9` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/android-virtual-mic-shizuku | `e737a3c8d6d69be4822ab7c50bc2db5dc631da17` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/shizuku-silent-mic | `6fe4ad8801e6e6537e51096166812d3366a3ec8f` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/onnxscibroccoli.github.io | `40de96bfd1071c5de77d31dcec386a91f65647d4` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/newsroom-desk | `ebe418d02e9051eaeff95f834bedfe94d8993120` | HISTORICAL_NONEXECUTABLE_REFERENCE | Editorial package records existing rish_display.py evidence; no public launcher or executable consumer. |
| onnxscibroccoli/lattice | `0a2f53bb9105c4151e9d7667a7b627ff7fa58c2e` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/half-a-mile | `9ccd14f49228f8d9ab64427b4023924cd4a9aa1c` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/lattice-audit | `858d6d4fc5f5f34f6e3823161ef70bfb43749483` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/noVNC | `acca57b997f206683d27796829ee1f72da37002a` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/Morphe-Patches-2 | `fb52a3e46a7bf6aadef9e2a648bdea2131951f39` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |
| onnxscibroccoli/morphe-patches-1 | `d60e85c68ab6c268b497f849000645da263c3b4d` | NO_RISH_MATCH | Tracked-file candidate scan found no Rish reference requiring retirement. |

## Bounded contract

Task: PHYSICAL-RISH-LAUNCHER-RETIREMENT-20261007. Node: verified OCI grasshopper-workstation, development repository only, RDC transport. Acceptance: lifecycle regression tests, complete repository tests, degradation guard, diff checks. Resource envelope: source edits and local Node tests only; no guest/phone changes or paid capacity. Lease: this development turn, subprocess tests bounded by five-second fixture timeouts. Recovery: revert this isolated commit; no deployment or remote session changes. Evidence: source scan commits above, local test results, and proposed PRs.

The coordinator-reported fresh phone proof is broccoli-core `d74726a`, uid 2000, SDK 35. It is attributed evidence, not a new test performed by this audit.
