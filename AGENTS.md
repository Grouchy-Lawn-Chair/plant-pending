# Plant Pending Development Rules

## Simplest fix first

Before adding observers, DOM patches, correction layers, fallback logic, post-processing, or other workarounds:

1. Reproduce the issue and identify where the incorrect value or behavior originates.
2. Check whether the source can be fixed directly with a small change.
3. Recheck the reasoning and data flow before coding.
4. Prefer the smallest source-level fix that preserves existing behavior.
5. Use a workaround only when a direct fix is impossible or clearly unsafe.
6. Explain why a workaround is necessary before adding it.
7. Remove obsolete workaround code when a direct fix replaces it.

## Verification

- Do not claim a fix is verified unless the relevant typecheck, test, or browser behavior was actually checked.
- Run only the checks relevant to the change, unless a broader regression check is warranted.
- Keep one authoritative source of truth for each behavior and avoid duplicated or conflicting rules.
