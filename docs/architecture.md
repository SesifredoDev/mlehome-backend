# Backend Architecture

## Layers

- API gateway boundary: Fastify HTTP API designed to sit behind Cloudflare or another edge gateway.
- Auth/linking: student link codes connect parent, child, tutor, and integration accounts.
- Diary: structured activity records with duration, subject, evidence references, and curriculum tags.
- Evidence: presigned S3 uploads for images or documents.
- Privacy: GDPR-oriented review and report inclusion decisions.
- OCR: inference adapter boundary for future OCR providers.
- Reports: JSON report projections for tutor statistics and guardian education diaries.
- Curriculum: national curriculum standards data lookup and tagging.

## Local Infrastructure

`docker-compose.yml` runs:

- `api`: Node 22 TypeScript service
- `mongo`: curriculum and records store
- `minio`: S3-compatible local image storage
- `minio-init`: creates the local evidence bucket

## First Production Decisions Still Needed

- Real identity provider and JWT verification.
- Tenant model for tuition centres.
- OCR provider selection.
- Report renderer format: PDF, DOCX, or both.
- Retention policy and deletion workflow for evidence images.
- Legal review of consent wording and third-party processing flows.
