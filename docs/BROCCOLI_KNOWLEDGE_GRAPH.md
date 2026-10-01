# Broccoli Core knowledge graph

**GRAPH TAG:** `BROCCOLI-KG-2026-10-01`  
**Source snapshot:** `onnxscibroccoli/broccoli-core` @ `c4abf1c643dafad3f64004b76758e4e1c232b120`  
**Role:** historical device executor and philosophy source. Not the OmniKali production control plane.

Grasshopper consumes this graph. It does not copy the repo pile.

## Two layers

Older Broccoli is helpful because it states a loop and a user. Later Broccoli is mostly transport debris around that loop.

| Layer | Where | Use |
|---|---|---|
| Philosophy | `docs/ROADMAP.md`, `docs/VISION.md`, `docs/INTENT_AUTOMATION_NORTH_STAR.md`, `docs/KERNEL.md`, `INSTRUCTIONS.md` | Adopt |
| Atom | `runtime/kernel.py`, `runtime/intent_schema.py`, `runtime/onyx.py`, `runtime/eventbus/` | Extract contracts |
| Known-good device hop | `lib/rish_run.sh` called with `RISH_PRESERVE_ENV=0` | Call, do not edit |
| Leftover | root `*.log`, `*.bak.*`, `advance_step*.sh`, `docs/ENGINEERING.md` ("see chat"), placeholder milestone claims | Do not grow |

## Graph

```
User intent
  -> Kernel.tick
      -> cheap cascade: schema index -> Markov -> ONNX -> LLM
      -> one schema
      -> dry-run, then executor
      -> EventBus IntentSeen / IntentDone
      -> encrypted memory
  -> confirmation notification

Device loop (separate from the kernel)
  Termux executor
    -> idle >= 3s
    -> Grok app is accessibility surface only (ai.x.grok)
    -> rish UI dump
    -> extract blocks
    -> self_test, then mv on PASS
    -> known-good shell: RISH_PRESERVE_ENV=0 bash lib/rish_run.sh
         -> uid 2000(shell), sdk 35

Problem loop
  collectors publish evidence
    -> reasoner
    -> remediation plan
    -> workflow
    -> verification
    -> knowledge
  collectors do not solve

What is not a node
  Grok is not the product
  Mac chat is not required to close the phone loop
  a provider is not the domain
  a log is not a milestone
```

## Nodes

| Node | Evidence | Status |
|---|---|---|
| Kernel atom | `runtime/kernel.py`: sense, schema, act or dry-run, confirm, remember. One phrase, one schema | Real |
| Intent library | `runtime/intent_schema.py` | Real |
| ONNX router | `runtime/onnx_runtime.py`, keyword fallback if no model | Real, optional |
| Provider loop | `runtime/onyx.py`: NEXT / DONE / NEED_USER, max steps, Echo offline | Real |
| Event bus | `runtime/eventbus/`, provider events | Real |
| Encrypted memory | `runtime/memory_vector.py`, mode 600 | Real |
| Automation executors | bluetooth, reminder, calendar, notification, watchme replay | Bound in kernel |
| Termux wire | `INSTRUCTIONS.md`: idle gate, native Grok, no Chrome, daemon must stay up | Contract |
| Rish shell | interactive 2026-10-01: `BROCCOLI_RISH_OK`, `uid=2000(shell)`, sdk `35` | Proven from Termux |
| RDC handoff | empty RC=0 is not execution; shell cannot write Termux home | NOT_PROVEN |
| Cloudflare edge | client stub, must not block the phone | Optional |
| Root script pile | hundreds of one-off shells and logs | Leftover |

## Edges that matter

- User owns data. Sensors point back at the user. No phone-home training.
- Provider is a transport. Echo must prove the loop with zero tokens.
- Dry-run promotes a schema. Device execution is a later edge.
- Confirmation is a notification, not a code review.
- Critical file change is `.new` -> `self_test.sh` -> `mv` only on PASS.
- Phone closes its own loop. Mac/browser chat is optional context.
- Collector emits evidence. Reasoner decides. Executor acts.
- Known-good Rish is called. It is not rewritten to satisfy a new transport.

## Explicit non-edges

- Broccoli does not own Grasshopper desired state.
- A GitHub issue saying M1–M10 shipped is not an edge unless the file exists and a test runs.
- `am` RC=0 is not an edge to Termux execution.
- Desktop Commander remote is not an edge to Android.

## Canonical marker

`BROCCOLI-KG-2026-10-01`
