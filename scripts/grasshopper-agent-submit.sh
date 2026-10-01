#!/usr/bin/env bash
set -Eeuo pipefail

die(){ printf '[grasshopper-agent-submit] ERROR: %s\n' "$*" >&2; exit 1; }
log(){ printf '[grasshopper-agent-submit] %s\n' "$*"; }

REPO_DIR="$(pwd)"
BRANCH=""
TITLE=""
BODY_FILE=""
TEST_COMMAND="npm test"
BASE="main"

usage(){
  cat <<'USAGE'
Usage:
  grasshopper-agent-submit.sh --branch NAME --title TITLE --body-file FILE [--repo DIR] [--test-command CMD]

Purpose:
  Turn an already-completed development change into a tested branch and PR.
  GitHub Actions remain the authority for merge. This tool never merges.

Required:
  --branch NAME       New feature branch name
  --title TITLE       Pull request title
  --body-file FILE    Pull request body file

Optional:
  --repo DIR          Git worktree/repository, default: current directory
  --test-command CMD  Local test command, default: npm test
  --base NAME         PR base branch, default: main
USAGE
}

while (($#)); do
  case "$1" in
    --repo) REPO_DIR="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --body-file) BODY_FILE="$2"; shift 2 ;;
    --test-command) TEST_COMMAND="$2"; shift 2 ;;
    --base) BASE="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[[ -n "$BRANCH" ]] || die "--branch is required"
[[ -n "$TITLE" ]] || die "--title is required"
[[ -n "$BODY_FILE" ]] || die "--body-file is required"
[[ "$BRANCH" != "main" && "$BRANCH" != "master" ]] || die "refusing to submit directly from a protected base branch"
[[ "$BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || die "invalid branch name"
cd "$REPO_DIR"
git rev-parse --show-toplevel >/dev/null 2>&1 || die "not a git repository"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

command -v git >/dev/null 2>&1 || die "git is required"
command -v gh >/dev/null 2>&1 || die "GitHub CLI (gh) is required"
[[ -f "$BODY_FILE" ]] || die "PR body file not found: $BODY_FILE"

if [[ -n "$(git status --porcelain)" ]]; then
  log "Development changes detected."
else
  die "no development changes are present"
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    die "local branch already exists: $BRANCH"
  fi
  git switch -c "$BRANCH"
fi

log "Fetching protected base: origin/$BASE"
git fetch origin "$BASE" --quiet

if git merge-base --is-ancestor "origin/$BASE" HEAD; then
  :
else
  die "working branch is not based on origin/$BASE; reconcile it before submission"
fi

log "Running local production-contract test command: $TEST_COMMAND"
bash -lc "$TEST_COMMAND"

log "Staging development changes"
git add -A

if git diff --cached --quiet; then
  die "nothing remains to commit after tests"
fi

log "Creating development commit"
git commit -m "$TITLE"

log "Pushing branch to origin"
git push --set-upstream origin "$BRANCH"

REPO_SLUG="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
log "Creating pull request in $REPO_SLUG"
PR_URL="$(gh pr create   --repo "$REPO_SLUG"   --base "$BASE"   --head "$BRANCH"   --title "$TITLE"   --body-file "$BODY_FILE"   --no-maintainer-edit)"

printf 'PR_URL=%s\n' "$PR_URL"
printf 'PR_BRANCH=%s\n' "$BRANCH"
printf 'PR_BASE=%s\n' "$BASE"
printf 'PR_HEAD_SHA=%s\n' "$(git rev-parse HEAD)"
printf 'LOCAL_TEST=PASS\n'
printf 'GITHUB_MERGE=DELEGATED_TO_ACTIONS\n'
