# CONEXIA Production Guide

CONEXIA is an institutional repository for partnership documents.

Architecture:

```text
React + Vite
Laravel API
Supabase Auth
Supabase PostgreSQL
Configured private file disk
```

Supabase is used for authentication and PostgreSQL. React must not access the
database or storage directly.

## Roles

- `department_staff`: creates submissions, uploads files, tracks corrections,
  and requests renewals for its own department.
- `iro_staff`: logs incoming submissions, routes documents, and archives
  completed workflows.
- `iro_admin`: views reports, archive records, and operational summaries.
- `legal_counsel`: reviews assigned documents, returns corrections, approves,
  and completes notarization.
- `super_admin`: manages governance and users only. This role must not access
  partnership document contents.

## Workflow

```text
Submitted
Logged
Under Legal Review
Corrections Needed
Approved
Pending Notarization
Notarized
Archived
```

Archived records are excluded from active queues.

## Required Environment

Backend production variables:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.example.edu
FRONTEND_URL=https://conexia.example.edu

DB_CONNECTION=pgsql
DB_HOST=
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=
DB_PASSWORD=
DB_SSLMODE=require

SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_JWKS_CACHE_SECONDS=3600

CACHE_STORE=database
QUEUE_CONNECTION=database
SESSION_DRIVER=file
SESSION_ENCRYPT=true
FILESYSTEM_DISK=local

LOG_CHANNEL=stack
LOG_STACK=daily
LOG_LEVEL=warning
LOG_DAILY_DAYS=14

MAIL_MAILER=smtp
MAIL_HOST=
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=noreply@example.edu
```

Frontend production variables:

```env
VITE_API_BASE_URL=https://api.example.edu/api
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Do not commit real secrets, service-role keys, database passwords, JWTs, or
storage credentials.

## Installation

Backend:

```bash
cd backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
php artisan migrate --force
```

Frontend:

```bash
cd frontend
npm ci
npm run build
```

Serve `frontend/dist` from the web host or CDN. Point API requests to the
Laravel API host.

## Deployment

Run on every release:

```bash
cd backend
php artisan down
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan optimize
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
php artisan up
```

Then build the frontend:

```bash
cd frontend
npm ci
npm run build
```

After deploy, restart workers:

```bash
php artisan queue:restart
```

## Scheduler And Queues

Run the scheduler every minute on the server:

```bash
* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1
```

Run at least one queue worker:

```bash
php artisan queue:work database --tries=3 --timeout=90
```

Expiry notification generation is scheduled with:

```bash
php artisan conexia:sync-expiry-notifications
```

It is duplicate-safe and runs hourly.

## API Summary

Core protected endpoints:

- `GET /api/me`
- `GET /api/department/dashboard`
- `GET /api/department/documents`
- `POST /api/department/documents`
- `PATCH /api/department/documents/{id}/resubmit`
- `GET /api/iro/dashboard`
- `GET /api/iro/documents/incoming`
- `GET /api/iro/documents/status`
- `PATCH /api/iro/documents/{id}/log`
- `PATCH /api/iro/documents/{id}/assign-legal`
- `PATCH /api/iro/documents/{id}/archive`
- `GET /api/legal/dashboard`
- `GET /api/legal/documents/review`
- `PATCH /api/legal/documents/{id}/decision`
- `GET /api/legal/documents/notarization`
- `PATCH /api/legal/documents/{id}/submit-notarization`
- `PATCH /api/legal/documents/{id}/complete-notarization`
- `GET /api/legal/history`
- `GET /api/documents/{document}/files`
- `POST /api/documents/{document}/files`
- `GET /api/documents/{document}/files/{file}/download`
- `GET /api/documents/{document}/files/{file}/preview`
- `DELETE /api/documents/{document}/files/{file}`
- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/{id}/read`
- `PATCH /api/notifications/read-all`
- `GET /api/expiry`
- `GET /api/iro/archive`
- `GET /api/iro/reports`
- `GET /api/super-admin/dashboard`
- `GET /api/users`
- `PATCH /api/users/{profile}/status`
- `PATCH /api/users/{profile}/assignment`
- `GET /api/departments`

List endpoints support `page`, `per_page`, `search`, `status`, `sort`, and
`direction` where applicable.

## Security Checklist

- `APP_ENV=production`
- `APP_DEBUG=false`
- CORS restricted to `FRONTEND_URL`
- API routes require Supabase JWT authentication
- Role middleware protects role-specific endpoints
- API throttling is enabled
- Security headers are applied globally
- Uploads allow only PDF, DOCX, and ODT up to 25 MB
- Raw storage paths are never returned by file APIs
- Public registration remains disabled
- Super Admin cannot access document workflows

## Backups

Database:

- Use Supabase automated backups or scheduled `pg_dump`.
- Keep daily backups for at least 14 days.
- Keep monthly backups according to institutional policy.
- Test restore into a staging database before relying on backups.

Uploaded files:

- Back up the configured private storage disk.
- Keep file backups aligned with database backup timestamps.
- Restore files before reopening document preview/download endpoints.

Restore order:

1. Put the app into maintenance mode.
2. Restore PostgreSQL.
3. Restore private uploaded files.
4. Run migrations if the restored database is older than the deployed code.
5. Clear and rebuild Laravel caches.
6. Smoke test login, document lists, file preview, and workflow actions.

## Monitoring

Monitor:

- `/up` and `/api/health`
- Queue worker status
- Failed jobs table
- Scheduler execution
- Disk usage for uploaded files and logs
- Database connections
- HTTP 401, 403, 404, 422, and 500 rates
- API response time
- Supabase JWKS fetch failures

## Troubleshooting

- `GET /api/me` returns 401: verify the bearer token, Supabase JWKS access,
  `SUPABASE_URL`, issuer, audience, and system clock.
- CORS errors: verify `FRONTEND_URL` exactly matches the deployed frontend
  origin.
- Upload fails with 422: confirm file type is PDF, DOCX, or ODT and size is
  under 25 MB.
- Missing notifications: run
  `php artisan conexia:sync-expiry-notifications` and check scheduler logs.
- Stale configuration: run `php artisan optimize:clear`, then rebuild caches.
