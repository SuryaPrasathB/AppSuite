-- 003: Create tenants, departments, tenant_settings, and tenant_user_categories tables

CREATE TABLE IF NOT EXISTS tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    status ENUM('trial', 'active', 'past_due', 'suspended', 'expired') NOT NULL DEFAULT 'active',
    plan_id INT NULL,
    max_users INT NOT NULL DEFAULT 25,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenants_status (status)
);

INSERT IGNORE INTO tenants (id, name, slug, status, max_users)
VALUES (1, 'Default Organization', 'default', 'active', 100);

CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL DEFAULT 1,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dept_tenant_name (tenant_id, name),
    INDEX idx_departments_tenant (tenant_id)
);

CREATE TABLE IF NOT EXISTS tenant_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    setting_key VARCHAR(150) NOT NULL,
    setting_value_json JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tenant_setting (tenant_id, setting_key),
    INDEX idx_tenant_settings_tenant (tenant_id)
);

CREATE TABLE IF NOT EXISTS tenant_user_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    category VARCHAR(150) NOT NULL,
    department VARCHAR(150) DEFAULT 'General',
    description VARCHAR(500) DEFAULT '',
    access_level VARCHAR(100) DEFAULT 'Employee',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tenant_category (tenant_id, category),
    INDEX idx_tenant_categories_tenant (tenant_id)
);
