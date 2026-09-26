# Production schema recovery status

## Recovered source evidence

From Helix revision `38903b021cca75189a99e1ed88b508bae577f048`:

- `workspaces`, `workspace_files`, and `workspace_events` are defined by `migrations/0002_workspaces.sql`.
- `omnikali_tasks` and `omnikali_task_events` are defined by `production/gateway/state/schema.sql`.
- The task schema references `workspaces(id)`.

These artifacts are preserved in `reference/production/`.

## What is not yet established

Source files do not prove that these exact migration files are the complete database state of the accepted production instance.

Before migration automation is allowed to mutate production, it must recover, through an authorized non-secret inspection path:

1. applied migration identifiers and ordering;
2. actual table, column, index, and constraint definitions;
3. schema ownership and privileges relevant to the gateway runtime;
4. whether the task tables were created by `schema.sql` outside the numbered application migration chain;
5. compatibility of the recovered source schema with the deployed database;
6. a rollback/recovery procedure that preserves durable task ownership.

## Safety rule

Do not execute a guessed migration chain against production. Source artifacts are evidence until reconciled with the live database state.
