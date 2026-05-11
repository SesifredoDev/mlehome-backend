# MLE Home Backend

Docker-first TypeScript API for the MLE Home education diary concept.

## Local Run

```bash
docker compose up --build
```

API: `http://localhost:3000`

MongoDB: `mongodb://localhost:27017/mlehome`

MinIO console: `http://localhost:9001` with `minioadmin` / `minioadmin`

## API Shape

- `GET /health` and `GET /health/ready`
- `POST /v1/accounts/register`
- `GET /v1/accounts/me`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `POST /v1/auth/logout-all`
- `POST /v1/auth/student-links`
- `POST /v1/auth/student-links/activate`
- `POST /v1/diary/entries`
- `GET /v1/diary/students/:studentId/entries`
- `GET /v1/diary/students/:studentId/stats`
- `POST /v1/evidence/uploads`
- `POST /v1/evidence/:evidenceId/confirm`
- `POST /v1/ocr/infer`
- `POST /v1/privacy/reviews`
- `PATCH /v1/privacy/evidence/:evidenceId/decision`
- `GET /v1/reports/students/:studentId/stats`
- `GET /v1/reports/students/:studentId/education-diary`
- `GET /v1/tutors/students`
- `GET /v1/tutors/students/:studentId/summary`
- `GET /v1/curriculum/standards`
- `GET /v1/integrations/developer/manifest`

Production-style authentication is represented by bearer access tokens:

```http
Authorization: Bearer <accessToken>
```

Refresh tokens are opaque tokens returned by login and refresh calls. Refreshing rotates the refresh token, so clients should replace the stored refresh token every time `/v1/auth/refresh` succeeds.

Development account context can still be represented by headers outside production:

- `x-account-id`
- `x-account-role` as `parent`, `child`, `tutor`, or `integration`

These headers are only a local development fallback. Use JWTs for app/API flows.
