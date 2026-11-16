# AppSuite Project Module — SaaS Implementation Plan

This document tracks the architecture, security, administration, billing, and deployment roadmap to convert the **AppSuite Project Management Module** from a single-office Docker setup into a multi-tenant B2B SaaS on **MySQL**.

---

## Key Product Decisions

- **Scope:** Launch with the **Project Management module only** (`projects`, `dynamic-tasks`, `service-tickets`, `notifications`, `announcements`). Keep `store` and `bom` disabled via module flags for future upsell tiers.
- **Database:** Stick with **MySQL 8** (Managed Cloud MySQL in production) using a **Shared Database + `tenant_id`** multi-tenancy model.
- **Document / File Storage:** **Do not host customer files in the cloud.** Make the Documents/File Sync section controlled by a per-tenant feature flag (`ENABLE_PROJECT_DOCUMENTS`):
  - **Cloud SaaS tenants (default):** `ENABLE_PROJECT_DOCUMENTS = false` — Documents tab, upload UI, and file sync endpoints are hidden/disabled completely. *(Optional lightweight alternative: allow pasting external Google Drive / OneDrive / SharePoint links instead of uploading files.)*
  - **On-Premise / Physical Server tenants:** `ENABLE_PROJECT_DOCUMENTS = true` — Uses their mounted local/network storage (`PROJECTS_BASE_DIR`).

---

## Phase 1: Security & Authentication Foundation

### 1.1 Replace Mock Authentication (`backend/app/dependencies.py`)
- [x] Replace `"mock-jwt-token-for-{username}"` with real signed **JWT Access Tokens** (15–30 min expiry) using `PyJWT` or `python-jose`.
- [x] Include `sub` (`user_id`), `tenant_id`, `role`, `is_super_admin`, and `exp` in JWT claims. *(Added `sub`, `username`, `role`, `iat`, `exp`; `tenant_id` and `is_super_admin` will be added in Phase 2.)*
- [x] Implement **Refresh Tokens** (7–30 days) stored in `HttpOnly`, `Secure`, `SameSite=Lax` cookies and hashed in a `user_sessions` table (enables instant session revocation on logout or tenant suspension). *(Backend `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout` cookie + `user_sessions` rotation and frontend `apiClient.ts` 401 auto-refresh/logout implemented.)*
- [x] Enforce `bcrypt` password hashing on all user creation/login flows. *(Verified already enforced in `DBStore.authenticate_user` and employee creation/update.)*
- [x] Build **Invite-Only Onboarding** (time-limited token emailed to set password) and **Forgot / Reset Password** flow. *(Backend `002_auth_tokens.sql`, `/api/auth/invite`, `/api/auth/accept-invite`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `email_service.py`, and frontend `AcceptInvite`, `ForgotPassword`, `ResetPassword` pages implemented.)*
- [ ] Add optional **2FA (TOTP)** for Company Admins and **mandatory 2FA** for Super Admins.

### 1.2 API & Config Hardening
- [x] Move all secrets (`MYSQL_PASSWORD`, `JWT_SECRET_KEY`, AI API keys, SMTP/email keys) out of `docker-compose.yml` and `config.py` into `.env` / cloud secret manager. *(Added `.env` support in `config.py` and `.env.example`; `docker-compose.yml` env vars still need production `.env` injection.)*
- [x] Restrict `CORSMiddleware` `allow_origins` in `backend/app/main.py` from `["*"]` to actual SaaS domain(s). *(Configurable via `CORS_ORIGINS` env var.)*
- [x] Add rate limiting (`slowapi` or reverse-proxy rules) on `/api/auth/login` and `/api/auth/forgot-password`. *(Added sliding-window `rate_limiter.py` on login, forgot-password, reset-password, and accept-invite.)*
- [x] Create an `audit_logs` table (`id`, `tenant_id`, `actor_id`, `action`, `target_type`, `target_id`, `ip_address`, `metadata_json`, `created_at`) for sensitive actions. *(Created via `001_audit_logs_and_sessions.sql` + `audit_service.py`.)*

### 1.3 MySQL Connection Pooling & Migrations
- [x] Replace per-request `mysql.connector.connect()` in `backend/app/database.py` with `mysql.connector.pooling.MySQLConnectionPool`.
- [x] Set up **Alembic** (or a versioned `schema_migrations` runner) to replace manual `update_*.py` / `migrate_*.py` scripts and startup `init_*` methods. *(Implemented lightweight versioned SQL runner in `backend/app/migrations/runner.py`.)*

---

## Phase 2: Multi-Tenancy & Module Isolation

### 2.1 Core Module Refactoring
- [x] Extract `auth` and `employees` routers out of `backend/app/modules/store/routers` into a shared `backend/app/modules/core` module. *(Moved to `backend/app/modules/core/routers/`, with backwards-compatible re-exports in `store/routers/`.)*
- [x] Add module-level toggles (`ENABLE_STORE_MODULE`, `ENABLE_BOM_MODULE`, `ENABLE_PROJECT_DOCUMENTS`) so Store/BOM routes and frontend navigation are cleanly disabled for SaaS. *(Backend `require_feature` gates on Store, BOM, and Project Documents routes + frontend `Portal`, `Sidebar`, and `ProjectWorkspace` hiding implemented.)*

### 2.2 Multi-Tenant Database Schema
- [x] Create `tenants` table (`id`, `name`, `slug`, `status`, `plan_id`, `max_users`, `created_at`, `updated_at`). *(Created in `003_tenants.sql` with Default Organization `id=1`, `departments`, `tenant_settings`, and `tenant_user_categories`.)*
- [x] Add indexed `tenant_id` (`NOT NULL`, FK to `tenants.id`) to all tenant-scoped tables: *(Automated idempotently via `backend/app/migrations/multi_tenant.py` for all existing tables in MySQL 8.)*
  - [x] `employees` (users)
  - [x] `departments`
  - [x] `projects`
  - [x] `dynamic_tasks` & `task_comments`
  - [x] `project_notes` & `project_activities`
  - [x] `service_tickets`
  - [x] `notifications` & `announcements`
  - [x] `description_histories`
- [ ] Update all queries in `backend/app/database.py` and routers to filter strictly by `tenant_id` from the authenticated JWT—never from request body/params. *(Auth, `get_projects`, and `get_all_projects_unpaginated` updated; remaining `DBStore` project/task/ticket/employee queries to be scoped incrementally.)*

### 2.3 Move Local JSON Configs to MySQL
- [x] Replace `backend/features_config.json`, `backend/project_config.json`, and `backend/user_categories.json` with MySQL tables keyed by `tenant_id`: *(Implemented in `backend/app/services/tenant_config_service.py` + `backend/app/modules/features_router.py` backed by `tenant_settings` and `tenant_user_categories`, with local JSON fallback for Tenant 1.)*
  - [x] `tenant_settings` (workflow configs, feature flags, project code format, timezone, working days)
  - [x] `tenant_user_categories` / `departments`
- [x] Enforce `ENABLE_PROJECT_DOCUMENTS`:
  - [x] Backend: Return `403`/`404` on `/projects/{id}/upload`, `/files/...`, and directory sync when disabled for the tenant.
  - [x] Frontend: Hide the Documents tab/section completely when `ENABLE_PROJECT_DOCUMENTS` is `false`.

### 2.4 Real-Time Events Scoping (`backend/app/modules/projects/events.py`)
- [x] Scope SSE/event queues by `(tenant_id, project_id)` and `(tenant_id, user_id)` so real-time updates never leak across companies.
- [x] Remove cross-tenant `_global_subscribers` broadcasts.

---

## Phase 3: Level 2 — Company Admin Portal (Customer)

Accessible only to `company_admin` users, strictly scoped to their `tenant_id`.

- [x] **Invite Employees:** Email + role + department -> generates `invitation_token`, sends invite email, enforces `active_users + pending_invites <= max_users`. *(Enforced in `auth_service.py` + `GET/DELETE /api/company-admin/invites` + Team & Invites UI.)*
- [x] **Create Departments:** CRUD for `departments` scoped to `tenant_id`; used in workload, standups, and filtering.
- [x] **Assign Permissions:** Role management (`company_admin`, `project_manager`, `member`, `viewer`) + granular feature permissions (create projects, delete tasks, view service desk, export reports).
- [x] **Create Projects:** Create/archive/restore projects, assign project leads, manage templates and custom project codes. *(Quick access from Company Admin header + `/projects` workspace.)*
- [x] **Configure Workflows:** Customize task statuses, priorities, project categories, and service desk rules in `tenant_settings`.
- [x] **Manage Company Settings:** Company name, timezone, working days/holidays, notification preferences, and external link/document settings.
- [x] **View Company Reports:** Company-wide completion rates, overdue tasks by department, employee workload, and service ticket metrics.

---

## Phase 4: Level 1 — App Suite Super Admin Portal (Your Private Portal)

Hosted on a restricted route/subdomain (e.g., `admin.yourproduct.com`) with mandatory 2FA and separate `super_admin` authentication.

- [x] **Register New Companies:** Provision a new `tenant`, assign initial plan/limits, and trigger the first Company Admin invite email.
- [x] **Activate / Suspend Accounts:** Toggle `tenants.status` (`active` / `suspended`). Middleware blocks suspended tenants immediately and revokes active sessions.
- [x] **Manage Subscriptions:** Assign/change plans, extend trials, override seat limits, and view billing history.
- [x] **View Customer Usage:** Dashboard showing per-tenant active users vs. `max_users`, project/task counts, API activity, and last active timestamp.
- [x] **Monitor Server Health:** API uptime/latency, error rates, MySQL connection pool status, CPU/RAM/disk usage, and background job status.
- [x] **Manage Customer Support:** Inbound support ticket queue from Company Admins + **Read-Only Impersonation** (requires reason, logged in `audit_logs`).
- [x] **Trigger Backups & Restore:** On-demand `mysqldump` snapshot trigger to encrypted cloud storage, backup history viewer, and single-tenant data export (SQL/JSON). *(JSON snapshot trigger to `backend/backups/` + single-tenant JSON export implemented.)*
- [x] **Manage Application Versions:** Display deployed backend/frontend version/Git SHA, manage release notes, and toggle beta feature flags per tenant.

---

## Phase 5: Subscriptions, Expiry & Renewal

### 5.1 Billing Schema
- [x] Create `plans` table (`id`, `name`, `price_monthly`, `price_yearly`, `max_users`, `max_projects`, `features_json`).
- [x] Create `subscriptions` table (`id`, `tenant_id`, `plan_id`, `status`, `current_period_start`, `current_period_end`, `grace_period_end`, `gateway_customer_id`, `gateway_sub_id`).
- [x] Create `billing_events` table (`005_billing_events.sql`) to log payment webhooks, renewals, reminders, and lifecycle transitions, plus seed Tenant 1 on Enterprise.

### 5.2 Lifecycle & Enforcement
- [x] **Daily Cron Job:** (`subscription_lifecycle_task()` in `backend/app/main.py` calling `run_subscription_lifecycle_check`)
  - [x] Send renewal/trial-ending reminders at 7 days, 3 days, and 1 day before `current_period_end`.
  - [x] On failed renewal / period end, transition to `grace_period` (7 days) with an in-app warning banner (`SubscriptionBanner.tsx`) for Company Admins.
  - [x] After `grace_period_end`, transition to `expired`: block mutations (`POST`/`PUT`/`PATCH`/`DELETE`) and normal employee logins (`get_current_user` in `dependencies.py`), showing a "Subscription Expired — Renew to Restore Access" banner and Billing tab in `CompanyAdmin.tsx` (never auto-delete data immediately).
- [x] **Payment Gateway Integration:** Implemented `/api/webhooks/billing` (with `X-Webhook-Secret` verification) plus `/api/billing/status`, `/api/billing/plans`, `/api/billing/invoices`, and `/api/billing/renew` to update subscription status and period dates automatically.
- [ ] **Quota Middleware:** Enforce `max_users`, `max_projects`, and `plan.features_json` (e.g., `AI_PROJECT_PLANNING`) at the API layer. *(Note: `max_users` in invite creation and `max_projects` via `enforce_project_quota` in `create_project` are enforced; `plan.features_json` gating in `tenant_config_service.py` remains pending.)*

---

## Phase 6: Cloud Hosting, CI/CD & Launch

- [ ] **Managed Database:** Provision **Managed MySQL 8** (DigitalOcean Managed MySQL / AWS RDS) with private VPC networking and automated daily backups.
- [ ] **App Hosting:** Deploy `frontend` and `backend` Docker containers on a Cloud VPS or container host behind **Caddy / Nginx + Cloudflare** (HTTPS/SSL, DDoS protection).
- [ ] **Transactional Email:** Connect **Resend**, **Postmark**, or **AWS SES** for invites, password resets, and subscription alerts.
- [ ] **CI/CD Pipeline:** Set up **GitHub Actions** to run tests, build Docker images, push to GitHub Container Registry (`ghcr.io`), run Alembic migrations, and deploy automatically (replacing manual `.tar` transfers).
- [ ] **Pilot Launch:** Onboard 1–3 pilot companies, validate billing/onboarding flows, and monitor logs before general release.
