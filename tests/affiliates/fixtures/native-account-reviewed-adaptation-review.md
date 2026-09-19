# Messages adaptation reconciliation

Pinned original: `336cee2:app/affiliates/admin/messages/page.tsx`, SHA256 `cd77a1e555a0cd2506e32b06f498c43ba9ba68cdc305613bf4678a80dbfc5f8f` (independently computed with git show + shasum).

The account adaptation from `53006e2` reversed only the native account import and reply call. Subsequent `25be5f8` added exactly two nonprovider changes: the nonproviderMutationFetch import and DELETE fetch delegation. Review of `git diff 53006e2..adbdc0c -- app/affiliates/admin/messages/page.tsx` found no other changes. Both exact strings are now reversed by the manifest before checking the unchanged original hash. No original hash was changed; no JSX or source file was altered in this reconciliation. The eight native-account UI preservation assertions now pass.

This is source-preservation qualification, not message archive lost-ack behavior. The existing message DELETE handler still removes its control optimistically; its original-form uncertainty/retry gate remains unqualified. Do not infer Notes recovery applies to Messages.
