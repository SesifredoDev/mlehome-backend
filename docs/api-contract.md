# API Contract Notes

This is the first backend scaffold, so the contract is intentionally small and stable.

## Account Context

During development, requests can pass account context through headers:

```http
x-account-id: account_parent_1
x-account-role: parent
```

Production should replace this with verified JWT claims from the public API gateway.

## Sharing Model

The backend separates three classes of data:

- Diary entries: activity metadata and evidence references.
- Tutor statistics: aggregated duration and subject totals only.
- Guardian education diary: fuller evidence-led records controlled by the guardian.

Images are uploaded through presigned URLs and are not passed through the API process.
