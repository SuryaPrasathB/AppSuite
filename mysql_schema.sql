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



