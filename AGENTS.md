# Repository workflow

## Commit policy

- After completing and validating requested file changes, automatically create a focused Git commit without waiting for a separate commit request.
- Preserve unrelated pre-existing changes and never include them merely to make the working tree clean.
- Push each validated focused commit to its current tracked remote branch automatically. A push to `main` triggers `.github/workflows/pages.yml`; wait for that workflow and verify the published Store before reporting completion.
- If a push is rejected, preserve local work, diagnose safely, and report or resolve the divergence without destructive Git operations.
- Report the resulting commit hash, message, pushed branch, and Store deployment result.
