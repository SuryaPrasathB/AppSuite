-- Smart Store Management System
-- MySQL Database Schema

CREATE DATABASE IF NOT EXISTS smart_store;
USE smart_store;

-- 1. VENDORS TABLE
CREATE TABLE IF NOT EXISTS vendors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    gst_number VARCHAR(100),
    is_preferred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit VARCHAR(50) DEFAULT 'pcs',
    min_quantity DECIMAL(10, 2) DEFAULT 0.00,
    max_quantity DECIMAL(10, 2) DEFAULT 0.00,
    barcode VARCHAR(100),
    qr_code VARCHAR(100),
    image_url TEXT,
    standard_cost DECIMAL(12, 2) DEFAULT 0.00,
    latest_cost DECIMAL(12, 2) DEFAULT 0.00,
    average_cost DECIMAL(12, 2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'INR',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. PRODUCT VENDORS MAP
CREATE TABLE IF NOT EXISTS product_vendors (
    product_id INT,
    vendor_id INT,
    is_preferred BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (product_id, vendor_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

-- 4. LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    zone VARCHAR(100) NOT NULL,
    rack VARCHAR(100) NOT NULL,
    shelf VARCHAR(100) NOT NULL,
    bin VARCHAR(100) NOT NULL,
    row_index INT DEFAULT 0,
    col_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(zone, rack, shelf, bin)
);

-- 5. PRODUCT LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS product_locations (
    product_id INT,
    location_id INT,
    quantity DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
    PRIMARY KEY (product_id, location_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

-- 6. INVENTORY TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_name VARCHAR(255) NOT NULL,
    user_role VARCHAR(100) NOT NULL,
    product_id INT,
    quantity DECIMAL(10, 2) NOT NULL,
    action VARCHAR(50) NOT NULL,
    from_location_id INT,
    to_location_id INT,
    remarks TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (from_location_id) REFERENCES locations(id) ON DELETE SET NULL,
    FOREIGN KEY (to_location_id) REFERENCES locations(id) ON DELETE SET NULL
);

-- 7. PURCHASE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS purchase_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    requester VARCHAR(255) NOT NULL,
    product_id INT,
    quantity DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    remarks TEXT,
    approved_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    change_remarks TEXT,
    history_logs TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- INDEXES
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_product_locations_product ON product_locations(product_id);

-- 8. EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    role VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    po_number VARCHAR(255),
    client_name VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'PLANNING',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. BILL OF MATERIALS (BOMs) TABLE
CREATE TABLE IF NOT EXISTS boms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 11. BOM ITEMS TABLE
CREATE TABLE IF NOT EXISTS bom_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bom_id INT,
    product_id INT,
    quantity_required DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
    quantity_issued DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    remarks TEXT,
    FOREIGN KEY (bom_id) REFERENCES boms(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- INDEXES FOR PROJECTS & BOMS
CREATE INDEX idx_boms_project ON boms(project_id);
CREATE INDEX idx_bom_items_bom ON bom_items(bom_id);

-- 12. SERVICE TICKETS TABLE
CREATE TABLE IF NOT EXISTS service_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    employee_id INT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'OPEN',
    resolution_notes TEXT,
    resolution_time_mins INT,
    history_logs TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);
CREATE INDEX idx_service_tickets_project ON service_tickets(project_id);
CREATE INDEX idx_service_tickets_status ON service_tickets(status);

-- 13. SEED DEFAULT USERS (Password for all is their username)
INSERT INTO employees (name, role, username, password_hash) VALUES 
('Surya (Admin)', 'Administrator', 'admin', '$2b$12$Nq5m4G7lq1/r/rD8P9qX/.e.2N0y2VqN4A5U7wU8G9R/Pz/C/r5/u'),
('Adarsh (Store Manager)', 'Store Manager', 'manager', '$2b$12$Nq5m4G7lq1/r/rD8P9qX/.e.2N0y2VqN4A5U7wU8G9R/Pz/C/r5/u'),
('Rahul (Operator)', 'Store Operator', 'operator', '$2b$12$Nq5m4G7lq1/r/rD8P9qX/.e.2N0y2VqN4A5U7wU8G9R/Pz/C/r5/u'),
('Vikram (Purchase Team)', 'Purchase Team', 'purchaser', '$2b$12$Nq5m4G7lq1/r/rD8P9qX/.e.2N0y2VqN4A5U7wU8G9R/Pz/C/r5/u');
