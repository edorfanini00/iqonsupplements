# Messages retry adaptation review

Starting Body HEAD: `e0162d2a95fd9a7e657fe34c0d32a95302c71ac9`.

Only `removeMessage` changed: preserve the existing message row and active panel until the existing nonprovider helper returns a readable positive acknowledgement. Errors retain the existing operation UUID. All JSX remains byte-identical by AST comparison.

`native-account-reviewed-adaptation.json` prepends the exact inverse of that handler-only change before the already-reviewed import/delegate inverses. Expected SHA256 is unchanged: `cd77a1e555a0cd2506e32b06f498c43ba9ba68cdc305613bf4678a80dbfc5f8f`, verified against the original `336cee2` Git blob. Native account UI parity passes8/8.

Actual-source callback plus actual mutation/UUID helper tests: RED6 failures (premature removal), GREEN8/8. Lost, truncated, negative HTTP/DTO, missing-positive DTO preserve original state and same-UUID retry; success clears it; cancel sends nothing. Test lives at `scripts/affiliates/messages-delete-retry.test.cjs`. Nonprovider regression10/10 and configured Next `tsc --noEmit --incremental false` pass. Retained local logs are named `messages-*.log`; initial missing-test-path error is distinct from real RED evidence.

Original browser Messages acceptance remains pending. No server, database, provider, deployment, config, migration or production operation. Combined finite residual matrix and fuller date/currency/race proof: sibling Health `combined-final-native-residual.md` and `messages-delete-local-proof.md`.
