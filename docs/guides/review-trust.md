# Review trust

This report counts what landed on `main`, so a later decision about loosening review has a number in front of it. It does not score review quality.

Run it from a checkout:

```sh
bun scripts/trust-metrics.ts --since YYYY-MM-DD
bun scripts/trust-metrics.ts --since YYYY-MM-DD --json
```

`--since` is a UTC calendar date. Commits before that midnight are left out. Omit it to read the whole first-parent history. The default output is markdown. `--json` prints the same report as JSON.

Each row is an ISO week (Monday start, UTC) of the **committer** date. With `--since`, the table starts at that date's week, including a row of zeros when the window opens before the first event, and it stops at the latest included event. Without `--since`, it starts at the first commit. Days of the first week that fall before `--since` are not counted. The columns are:

- **Commits to main** are first-parent commits on the selected branch. The default is `main` when that ref exists, otherwise `origin/main`. A commit that arrived only on a side branch is not one of these, including when the merge commit is.
- **Merged PRs** are pull requests that landed that week. Without `GITHUB_TOKEN`, a pull request is a commit subject `Merge pull request #N`, or a subject that ends with `(#N)`. The same number counts once. With a token, and a github.com `origin`, the count is the pull requests whose `merged_at` falls in the week, and the row includes the **median time from open to merge** (`merged_at` minus `created_at`). An even count uses the mean of the two central values.
- **Reverts** are commits whose subject starts with the word `Revert`, commits whose message contains `This reverts commit`, and pull requests whose title starts with the word `Revert`. A commit that matches more than one of these is one revert. `Reverted` does not match.
- **Revert rate** is reverts divided by merged pull requests that week. A week with no merged pull request has no rate. The total rate divides the totals. It is not the average of the weekly rates.
- **Without rewrite** is merged agent pull requests that were not a major rewrite, divided by merged agent pull requests that week. It sits beside the revert rate. It is absent without a token, and absent when the week has no merged agent pull request. The total divides the totals.

The [review-trust workflow](../../.github/workflows/review-trust.yml) runs this every Monday at 12:00 UTC, and when someone starts it by hand. It checks the repository out without credentials, writes the markdown into the job summary, and uploads the markdown and JSON as an artifact. The workflow token can read contents and pull requests, and it can upload that artifact. It cannot push, and it cannot comment.

## Limits

The rate is an upper bound on "something that landed was later reverted," not that count.

- A squash-merge message quotes every commit on the pull request. An intermediate `This reverts commit` inside that message counts, even when the pull request itself landed and nobody reverted it afterwards.
- A direct push of a revert counts in the numerator and not in the denominator. A quiet week can show a rate above 1, or no rate at all when nothing merged.
- Rebase merges that do not record a pull request number are invisible unless the API is used. An earlier `(#N)` in a subject that ends with a different `(#M)` is not a second pull request.
- The API result replaces commit-subject pull request counts. A pull request merged into some other branch is counted, and it may not be one of the commits on the branch the report is reading.
- The scan stops after 5,000 recently updated closed pull requests. The report says when that happens.
- Open-to-merge time starts when the pull request was opened, not when the first commit was written. It is absent without a token.
- An agent pull request is one whose body contains `<!-- CURSOR_AGENT_PR_BODY_BEGIN -->`, or whose user type is `Bot`. Cursor's agent opens the pull request on the human account and writes that marker, so the login is not the signal. The pull list the script already fetches includes the body and the user type. A human pull request without the marker is not an agent pull request.
- A closed pull request that was not merged is excluded from the without-rewrite rate. A merged agent pull request with no submitted review stays in the denominator. No review is not itself a rewrite. A replaced opening head still is.
- The initial head is the tip of the commits still on the pull request whose committer date is at or before the pull request was opened. The tip is the one that is not a parent of another commit in that set. The initial diff is the three-dot compare of the base ref to that commit. Changed lines are additions plus deletions. When no commit is dated at or before open, the opening head is gone. A push that is not forced cannot drop it, so that is a force-push that replaced the initial head. A rewritten commit that keeps a committer date at or before open is still on the list, and is not counted as a replaced head. The commit list does not keep the discarded sha.
- The first review is the earliest pull request review with `submitted_at`. A review with no `submitted_at` is pending and is not first. A dismissed review counts. Follow-up lines are the three-dot compare from that review's commit to the pull request head. When the head has more than one parent, the compare ends at the first parent, so merging the base branch is not a follow-up.
- Those follow-up lines are a major rewrite when they are more than half of the initial diff. Half is the constant `MAJOR_REWRITE_LINE_FRACTION` in [`scripts/agent-rewrite.ts`](../../scripts/agent-rewrite.ts), set to 0.5. Equal to half is not a major rewrite. Other repositories use 0.3; change that one constant. The line rule does not apply when the initial diff has 0 changed lines, when the review's commit is no longer on the pull request, or when a compare returns 300 files. That length is the compare endpoint's cap, and a partial sum is not used.
- Nothing here records who approved, whether review was required, or whether a revert repaired a failure that review should have caught. A revert of a revert counts. A low rate is not permission to drop review. The without-rewrite rate does not say the review was right.

The script is [`scripts/trust-metrics.ts`](../../scripts/trust-metrics.ts). It uses the TypeScript standard library and `git`. It does not add a dependency.
