# API Contract Notes

This is the first backend scaffold, so the contract is intentionally small and stable.

## Account Context

App/API requests should pass JWT access tokens:

```http
Authorization: Bearer <accessToken>
```

Access tokens are short lived. Clients obtain them through `POST /v1/auth/login` and rotate them through `POST /v1/auth/refresh`.

During development only, requests can still pass account context through headers:

```http
x-account-id: account_parent_1
x-account-role: parent
```

Production should use verified JWT claims. Development headers are ignored in production.

## Auth Flow

- `POST /v1/accounts/register` creates a parent, tutor, or integration account. Child accounts cannot self-register.
- `POST /v1/auth/login` returns an access token and refresh token.
- `POST /v1/auth/refresh` validates and rotates a refresh token.
- `POST /v1/auth/logout` revokes one refresh token.
- `POST /v1/auth/logout-all` revokes all refresh tokens for the authenticated account.
- `POST /v1/auth/child-links` lets a parent create an active child record. A parent can include optional `loginCredentials` to provision a child login account for that record.
- `PUT /v1/auth/child-links/:linkId` lets a parent update child details and toggle child login. Enabling login after creation requires `loginCredentials`; disabling login disables the linked child account.
- `POST /v1/auth/guardian-links` lets the head parent create a one-time add-guardian code for a child they created.
- `POST /v1/auth/guardian-links/activate` lets another parent activate an add-guardian code.
- `GET /v1/auth/child-links/:linkId/guardians` lists guardian access for the child. Only the head parent can call it.
- `DELETE /v1/auth/child-links/:linkId/guardians/:guardianAccountId` removes a non-head guardian from that child. The head parent cannot remove themselves.

## Sharing Model

The backend separates three classes of data:

- Diary entries: activity metadata and evidence references.
- Tutor statistics: aggregated duration and subject totals only.
- Guardian education diary: fuller evidence-led records controlled by the guardian.

Images are uploaded through presigned URLs and are not passed through the API process.
