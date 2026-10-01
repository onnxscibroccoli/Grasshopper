# Implementation philosophy

Derived from older Broccoli (`docs/ROADMAP.md`, `docs/VISION.md`, `docs/INTENT_AUTOMATION_NORTH_STAR.md`, `docs/KERNEL.md`, `INSTRUCTIONS.md`). Graph: `docs/BROCCOLI_KNOWLEDGE_GRAPH.md`.

Grasshopper keeps the loop. It does not import the pile.

## The inversion, as a control-plane rule

Broccoli's useful claim was not "more agents." It was that the user's signal comes back to the user: encrypted, offline-first, revocable, auditable. Grasshopper implements that as ownership of desired state.

- The control plane owns identity, task lifecycle, locks, and reconciliation.
- An environment is an adapter. A provider is a transport. Neither is the domain.
- User data is exportable and wipeable. Secrets stay off the issue tracker.
- A brain-injury constraint still applies: fewer decisions, more defaults, a confirmation instead of a review.

## The atom

Broccoli kernel, preserved as the Grasshopper task shape:

```
intent -> cheapest matcher -> one schema -> dry-run -> execute -> event -> remember
```

Rules taken from `runtime/kernel.py` and the north star:

1. One intent fires one schema. Do not classify again after a schema has matched.
2. Cheap cascade before a model: exact schema, then pattern, then small local classifier, then provider. Echo or the deterministic `ok:` / `fail:` environment must prove the loop with no token.
3. Dry-run promotes. Device, VM, and desktop adapters run only after the schema is already boring.
4. Cap the loop. `NEED_USER` pauses. Exhaustion is an event, not a spin.
5. Confirmation is a notification or a durable task result, not a paste back into chat.

## What older Broccoli did that later sessions stopped doing

- It named the user and the felt win: "bluetooth" becomes on, confirmed, logged.
- It treated Grok as the accessibility surface, not the product.
- It required the phone to close its own loop. Mac chat was optional.
- It refused to stop the daemon at the end of install.
- It wrote `.new`, ran `self_test.sh`, and moved only on PASS.
- It said placeholder milestones were lies.

Grasshopper equivalents:

- A task is done when observed state matches desired state, not when a document says so.
- Do not replace a validated Helix path because a new diagram looks cleaner.
- Do not edit a known-good executor (`lib/rish_run.sh`) to excuse a broken caller.
- Finish an install with the daemon still running and the next gate named.
- A missing artifact is NOT_PROVEN. An RC=0 with empty stdout is not a pass.

## Adapter order

Same cheap-first idea, mapped onto Grasshopper environments:

1. Deterministic in-process adapter (`ok:` / `fail:`).
2. Local process adapter with a bounded command policy.
3. Remote host adapter.
4. QEMU/libvirt, only behind the existing production contract.
5. Android/Termux adapter, only through the proven Broccoli/Rish call: `RISH_PRESERVE_ENV=0` and a shell-written file on shared storage.
6. Browser/desktop observation after the execution hop is proven.

Ruto and a secondary Grok display stay behind the Android artifact gate.

## Evidence discipline

Collectors publish evidence. They do not silently remediate. That is the Broccoli problem-solver rule, and it is why Grasshopper docs outnumber code.

Record separately:

- proven fact
- observation
- hypothesis
- planned change
- failure
- recovery

Update `docs/BROCCOLI_KNOWLEDGE_GRAPH.md` when a node changes status. Do not add a node for a log file.

## Non-goals

- Rebuilding Broccoli's root script pile inside Grasshopper.
- Making a provider mandatory for a control-plane test.
- Treating surveillance-shaped telemetry as a feature. Insight is for the user or it is not collected.
- Claiming a milestone from an issue title.

## Felt win

The first Grasshopper behavior that counts is still the Broccoli one, under a stricter contract: an authorized agent says the intent, the cheapest schema matches, a dry-run passes, the adapter performs it, and a durable result comes back without a human reviewing the implementation.
