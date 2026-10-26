# Version Drift Log (Guide §1.1 pins vs. what `npm install` actually resolved)

Per `[D14]` in `plan/implementation-plan.md`: the planning sandbox had no registry access, so
some pins were chosen without `npm view` verification. On the first networked `npm install`
(U0 PR), replace any pin the registry rejects with the nearest same-major version and record it here.

## Pins taken verbatim from the Guide (host-verified with `npm view`)

`ai`, `@ai-sdk/google`, `unified`, `remark-*`, `web-tree-sitter`, `tree-sitter-wasms`,
`better-sqlite3`, `drizzle-orm`, `@octokit/rest`, `@mdx-js/mdx`, `vitest`, plus the pre-existing
`zod@4.6.7` and `typescript@5.9.2`.

## Pins chosen in U0 WITHOUT registry verification — confirm or bump on first install

| Package                 | Pin in repo | Rationale                                                                              | Resolved on first install |
| ----------------------- | ----------- | -------------------------------------------------------------------------------------- | ------------------------- |
| `eslint`                | 9.30.1      | known-good ESLint 9 flat-config release                                                | _pending_                 |
| `@eslint/js`            | 9.30.1      | must match `eslint`                                                                    | _pending_                 |
| `typescript-eslint`     | 8.72.0      | latest 8.x per `npm view` on host; supports `typescript@5.9.x`                         | **8.72.0**                |
| `prettier`              | 3.6.2       | known-good 3.x                                                                         | _pending_                 |
| `@types/node`           | 22.15.3     | Node 22 typings; any 22.x works                                                        | _pending_                 |
| `@types/better-sqlite3` | 7.6.13      | typings are stable across better-sqlite3 majors                                        | _pending_                 |
| `drizzle-kit`           | 0.31.4      | must be compatible with `drizzle-orm@0.45.4`; bump if `drizzle-kit generate` complains | _pending_                 |
| `yaml`                  | 2.8.0       | any 2.x works                                                                          | _pending_                 |
| `diff`                  | 8.0.2       | v8 ships its own types (no `@types/diff` needed)                                       | _pending_                 |

## Drift record

| Date       | Package             | Guide/U0 pin | Resolved | Reason                                                                                                                             |
| ---------- | ------------------- | ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-26 | `typescript-eslint` | 8.35.1 (U0)  | 8.72.0   | `ERESOLVE`: 8.35.1 peer `typescript@">=4.8.4 <5.9.0"` conflicts with the repo's `typescript@5.9.2`; resolved to latest 8.x on host |
