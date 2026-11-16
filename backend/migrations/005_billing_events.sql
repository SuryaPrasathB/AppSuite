-- 005: Billing events / webhook idempotency and invoice history

CREATE TABLE IF NOT EXISTS billing_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    gateway VARCHAR(50) NOT NULL DEFAULT 'manual',
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(50) NOT NULL DEFAULT 'processed',
    payload_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_billing_tenant_created (tenant_id, created_at)
);

-- Ensure Default Organization (tenant_id = 1) has an active Enterprise subscription
INSERT IGNORE INTO subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
VALUES (1, 3, 'active', NOW(), DATE_ADD(NOW(), INTERVAL 365 DAY));
