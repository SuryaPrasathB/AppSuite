-- 002: Create auth_tokens table for invite-only onboarding and password resets

CREATE TABLE IF NOT EXISTS auth_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    tenant_id INT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NULL,
    purpose ENUM('invite', 'password_reset') NOT NULL,
    role VARCHAR(100) NULL,
    department VARCHAR(100) NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_auth_tokens_email_purpose (email, purpose),
    INDEX idx_auth_tokens_expires (expires_at)
);
