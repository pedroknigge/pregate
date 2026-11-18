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

The [review-trust workflow](../../.github/workflows/review-trust.yml) runs this every Monday at 12:00 UTC, and when someone starts it by hand. It checks the repository out without credentials, writes the markdown into the job summary, and uploads the markdown and JSON as an artifact. The workflow token can read contents and pull requests, and it can upload that artifact. It cannot push, and it cannot comment.

## Limits

The rate is an upper bound on "something that landed was later reverted," not that count.

- A squash-merge message quotes every commit on the pull request. An intermediate `This reverts commit` inside that message counts, even when the pull request itself landed and nobody reverted it afterwards.
- A direct push of a revert counts in the numerator and not in the denominator. A quiet week can show a rate above 1, or no rate at all when nothing merged.
- Rebase merges that do not record a pull request number are invisible unless the API is used. An earlier `(#N)` in a subject that ends with a different `(#M)` is not a second pull request.
- The API result replaces commit-subject pull request counts. A pull request merged into some other branch is counted, and it may not be one of the commits on the branch the report is reading.
- The scan stops after 5,000 recently updated closed pull requests. The report says when that happens.
- Open-to-merge time starts when the pull request was opened, not when the first commit was written. It is absent without a token.
- Nothing here records who approved, whether review was required, or whether a revert repaired a failure that review should have caught. A revert of a revert counts. A low rate is not permission to drop review.

The script is [`scripts/trust-metrics.ts`](../../scripts/trust-metrics.ts). It uses the TypeScript standard library and `git`. It does not add a dependency.
