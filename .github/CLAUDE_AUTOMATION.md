# Claude automation — how the agent picks up issues and opens PRs

Two workflows let Claude Code work this repo like a teammate:

| Workflow                                                          | What it does                                                                                | How it starts                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`claude-issue-solver.yml`](./workflows/claude-issue-solver.yml) | Works **every open issue** by default: implements a fix on a new branch, opens a PR for it. | Any issue opened/reopened · every 6h (oldest unstarted) · manual dispatch |
| [`claude-mention.yml`](./workflows/claude-mention.yml)           | Responds in-thread to `@claude …` and can push changes / open a PR on request.              | Commenting `@claude` on an issue/PR, or assigning the issue to Claude    |

## The autonomous loop (issue → branch → PR)

```
 any issue opened/reopened                every 6 hours (schedule)
            │                                      │
            ▼                                      ▼
   ┌─────────────────────────────────────────────────────┐
   │  Pick: newest filed, or oldest eligible open issue   │
   │        (skips opted-out, assigned, already-handled)  │
   │  Claim: add `claude:wip`, comment on the issue       │
   │  Solve: Claude reads the issue, branches, codes,     │
   │         runs typecheck, commits, pushes, opens a PR  │
   │  Hand off: drop `claude:wip`, add `claude:pr-open`   │
   └─────────────────────────────────────────────────────┘
            │
            ▼
   PR "Closes #N"  →  you review & merge  →  issue closes
```

It runs on **all** open issues. To exclude one, add any of these labels:
`claude:ignore`, `wontfix`, `blocked`, `question` — or assign the issue to a
person. `claude:wip` is a lock so two runs never grab the same issue; on failure
it's released and the issue retries. `claude:pr-open` marks an issue done so it's
never re-picked. A human always reviews the PR before merge.

## One-time setup

1. **Add the auth secret** — use your Claude Code subscription (Pro/Max), no API key needed:

   ```bash
   claude setup-token        # generates an OAuth token from your Pro/Max subscription
   gh secret set CLAUDE_CODE_OAUTH_TOKEN   # run from a clone; targets this repo
   # paste the token from the command above
   ```

   > Prefer pay-as-you-go API billing instead? Set `ANTHROPIC_API_KEY` and switch
   > the `claude_code_oauth_token:` line in each workflow to `anthropic_api_key:`.
   > Don't set both — pick one.

2. **Let Actions write code and open PRs**
   Repo → **Settings → Actions → General → Workflow permissions** →
   - select **Read and write permissions**
   - tick **Allow GitHub Actions to create and approve pull requests**

That's it. The workflow auto-creates its state/opt-out labels (`claude:wip`,
`claude:pr-open`, `claude:ignore`) on first run. No runners to manage — it all
runs on GitHub-hosted Actions.

## Using it

- **Default:** just open issues. Every open issue gets a PR within ~6h (or
  immediately on open). Nothing to label.
- **Exclude an issue:** add `claude:ignore` (or `wontfix` / `blocked` /
  `question`), or assign it to a person.
- **Run on a specific issue now:**

  ```bash
  gh workflow run "Claude Issue Solver" -f issue_number=12
  ```

- **Throughput:** the schedule works the **oldest eligible** issue, one per run.
  Tighten the `cron` in [`claude-issue-solver.yml`](./workflows/claude-issue-solver.yml)
  to drain a backlog faster (mind the credit pool — see below).
- **Ask conversationally:** comment `@claude please add a test for the lifecycle
  projection` on any issue or PR.

## Good first issues to feed it

The bugs from the code review are ideal starter tasks — small, well-scoped, each
with a file reference and a suggested fix. Just create them; no label needed:

```bash
gh issue create \
  --title "renderTemplate collapses newlines in multi-line message bodies" \
  --body "apps/web/src/server/campaigns/render.ts:27-32 uses .replace(/\\s{2,}/g,' ')
which flattens intentional line breaks in email/RCS bodies. Collapse only
horizontal whitespace (/[ \\t]{2,}/g) and trim per line, preserving \\n."
```

## Notes & guardrails

- **Security:** only the validated **integer issue number** is passed into the
  job. The issue title/body are never interpolated into a shell or the prompt —
  Claude fetches them itself — so a malicious issue can't inject commands.
- **CI on the bot's PR:** PRs opened with the built-in `GITHUB_TOKEN` do **not**
  trigger other workflows (GitHub's loop-prevention). If you want CI to run on
  Claude's PRs automatically, swap `github_token` for a **GitHub App token**
  (e.g. `actions/create-github-app-token`) or a fine-grained PAT secret.
- **Continuous monitoring:** the `schedule:` cron is the always-on watcher — it
  runs in GitHub's cloud, so your machine can be off. It acts on **every** open
  issue (minus opt-outs), so be deliberate about what issues exist in the repo.
- **Cost / blast radius:** running on all issues means every vague, duplicate, or
  ill-formed issue still triggers a paid run. Use `claude:ignore` liberally, keep
  issues well-scoped, and watch the credit pool. These headless Actions runs draw
  from the **Agent credit pool** (separate from your interactive 5-hour limits as
  of 2026-06-15): ~$20/mo on Pro, $100 on Max 5x, $200 on Max 20x. Keep the
  `cron` interval sane (hours, not minutes). The token from `claude setup-token`
  is long-lived but can expire — regenerate and re-set the secret if runs start
  failing auth.
- **Scope:** the prompt tells Claude to keep changes minimal, never touch
  `.github/workflows/`, and open a **draft** PR when it isn't confident rather
  than guessing.
