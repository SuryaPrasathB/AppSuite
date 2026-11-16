-- 004: Super Admin, Plans, Subscriptions, Support Tickets, Releases, and Backup Records

CREATE TABLE IF NOT EXISTS plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    price_yearly DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    max_users INT NOT NULL DEFAULT 10,
    max_projects INT NOT NULL DEFAULT 25,
    features_json JSON NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO plans (id, name, slug, price_monthly, price_yearly, max_users, max_projects, features_json)
VALUES
    (1, 'Starter', 'starter', 29.00, 290.00, 10, 25, '{"AI_PROJECT_PLANNING": false, "ENABLE_SERVICE_DESK": true, "ENABLE_PROJECT_DOCUMENTS": false}'),
    (2, 'Pro', 'pro', 79.00, 790.00, 50, 200, '{"AI_PROJECT_PLANNING": true, "ENABLE_SERVICE_DESK": true, "ENABLE_PROJECT_DOCUMENTS": false}'),
    (3, 'Enterprise', 'enterprise', 199.00, 1990.00, 500, 5000, '{"AI_PROJECT_PLANNING": true, "ENABLE_SERVICE_DESK": true, "ENABLE_PROJECT_DOCUMENTS": true}');

CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL UNIQUE,
    plan_id INT NOT NULL DEFAULT 1,
    status ENUM('trialing', 'active', 'past_due', 'grace_period', 'expired', 'canceled') NOT NULL DEFAULT 'active',
    current_period_start DATETIME NULL,
    current_period_end DATETIME NULL,
    grace_period_end DATETIME NULL,
    gateway_customer_id VARCHAR(255) NULL,
    gateway_sub_id VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_subs_status_end (status, current_period_end)
);

CREATE TABLE IF NOT EXISTS platform_support_tickets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    submitted_by INT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    status ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    admin_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_support_tenant_status (tenant_id, status)
);

CREATE TABLE IF NOT EXISTS app_releases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    version VARCHAR(50) NOT NULL,
    git_sha VARCHAR(64) NULL,
    notes TEXT NULL,
    deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO app_releases (id, version, git_sha, notes)
VALUES (1, '1.0.0-saas', 'initial', 'Initial SaaS platform baseline with multi-tenancy and Company Admin portal.');

CREATE TABLE IF NOT EXISTS backup_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NULL,
    filename VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    status ENUM('completed', 'failed') NOT NULL DEFAULT 'completed',
    triggered_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
