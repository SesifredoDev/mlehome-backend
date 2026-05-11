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

Development authentication is represented by headers:

- `x-account-id`
- `x-account-role` as `parent`, `child`, `tutor`, or `integration`

These are placeholders for the real auth gateway/JWT layer.
