-- Smart Store Management System
-- Supabase / PostgreSQL Database Schema

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. VENDORS TABLE
CREATE TABLE IF NOT EXISTS vendors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    gst_number VARCHAR(100),
    is_preferred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit VARCHAR(50) DEFAULT 'pcs',
    min_quantity NUMERIC(10, 2) DEFAULT 0.00,
    max_quantity NUMERIC(10, 2) DEFAULT 0.00,
    barcode VARCHAR(100),
    qr_code VARCHAR(100),
    image_url TEXT,
    standard_cost NUMERIC(12, 2) DEFAULT 0.00,
    latest_cost NUMERIC(12, 2) DEFAULT 0.00,
    average_cost NUMERIC(12, 2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'INR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. PRODUCT VENDORS MAP (For multiple vendor assignments)
CREATE TABLE IF NOT EXISTS product_vendors (
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    vendor_id INT REFERENCES vendors(id) ON DELETE CASCADE,
    is_preferred BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (product_id, vendor_id)
);

-- 4. LOCATIONS TABLE (Zones, Racks, Shelves, Bins and Matrix coordinate for layout mapping)
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    zone VARCHAR(100) NOT NULL,            -- e.g., 'Zone A', 'Zone B'
    rack VARCHAR(100) NOT NULL,            -- e.g., 'A1', 'A2', 'B1'
    shelf VARCHAR(100) NOT NULL,           -- e.g., 'Shelf 1', 'Shelf 2'
    bin VARCHAR(100) NOT NULL,             -- e.g., 'Bin 1', 'Bin 2'
    row_index INT DEFAULT 0,               -- Matrix Y-coordinate
    col_index INT DEFAULT 0,               -- Matrix X-coordinate
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(zone, rack, shelf, bin)
);

-- 5. PRODUCT LOCATIONS TABLE (Quantities of products in physical bins)
CREATE TABLE IF NOT EXISTS product_locations (
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    location_id INT REFERENCES locations(id) ON DELETE CASCADE,
    quantity NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    PRIMARY KEY (product_id, location_id)
);

-- 6. INVENTORY TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_name VARCHAR(255) NOT NULL,       -- Recording operator name
    user_role VARCHAR(100) NOT NULL,       -- Recording operator role (e.g., Administrator, Store Operator)
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    quantity NUMERIC(10, 2) NOT NULL,
    action VARCHAR(50) NOT NULL,           -- 'STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'ADJUSTMENT'
    from_location_id INT REFERENCES locations(id) ON DELETE SET NULL,
    to_location_id INT REFERENCES locations(id) ON DELETE SET NULL,
    remarks TEXT
);

-- 7. PURCHASE REQUESTS TABLE (Raised by various teams)
CREATE TABLE IF NOT EXISTS purchase_requests (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    requester VARCHAR(255) NOT NULL,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    quantity NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',  -- 'PENDING', 'APPROVED', 'DECLINED', 'DELIVERED'
    remarks TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    change_remarks TEXT,
    history_logs TEXT DEFAULT '[]' -- JSON array string tracking timeline history
);

-- INDEXES FOR FASTER PRODUCT AND LOCATION SEARCH
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_locations_composite ON locations(zone, rack, shelf, bin);
CREATE INDEX IF NOT EXISTS idx_product_locations_product ON product_locations(product_id);


-- ==========================================
-- SEED MOCK DATA
-- ==========================================

-- Insert Vendors
INSERT INTO vendors (name, contact_person, phone, email, address, gst_number, is_preferred) VALUES
('Siemens Industrial Electrics Ltd', 'Aditya Sharma', '+91 98765 43210', 'sales@siemens-industrial.in', 'Tech Park, Block B, Bengaluru, KA', '29AAAAA1111A1Z1', true),
('SKF Bearings India Co', 'Neha Patel', '+91 87654 32109', 'support@skf-bearings.co.in', 'GIDC Industrial Estate, Vadodara, GJ', '24BBBBB2222B2Z2', false),
('PackWell Box & Cartons Co', 'Rajesh Kumar', '+91 76543 21098', 'order@packwell.co.in', 'Okhla Industrial Area, Phase-III, New Delhi', '07CCCCC3333C3Z3', true),
('Apex Hydraulics Ltd', 'Vikram Singh', '+91 99988 77766', 'contact@apex-hydraulics.com', 'Ambattur Industrial Estate, Chennai, TN', '33DDDDD4444D4Z4', false);

-- Insert Products
INSERT INTO products (code, name, description, category, unit, min_quantity, max_quantity, barcode, qr_code, image_url) VALUES
('ELEC-001', 'MCB 16A Single Pole', 'Siemens high-performance single pole MCB for industrial lighting circuits.', 'Electrical', 'pcs', 10.00, 100.00, '8901072001147', 'ELEC001QR', 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?q=80&w=200&auto=format&fit=crop'),
('ELEC-002', 'MCB 32A Double Pole', 'Siemens double pole circuit breaker for power distribution boards.', 'Electrical', 'pcs', 15.00, 120.00, '8901072001154', 'ELEC002QR', 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?q=80&w=200&auto=format&fit=crop'),
('MECH-001', 'Ball Bearing 6204-2RSH', 'SKF deep groove ball bearing with rubber seals on both sides.', 'Mechanical', 'pcs', 20.00, 150.00, '7316576620478', 'MECH001QR', 'https://images.unsplash.com/photo-1530124560072-aab8cf10d598?q=80&w=200&auto=format&fit=crop'),
('MECH-002', 'Shaft Coupling D25 L30', 'Flexible spider jaw coupling, diameter 25mm, length 30mm.', 'Mechanical', 'pcs', 10.00, 80.00, '8902341234567', 'MECH002QR', 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=200&auto=format&fit=crop'),
('PACK-001', 'Carton Box Medium (5ply)', 'Heavy-duty 5-ply corrugated carton box for heavy material packing.', 'Packaging', 'pcs', 50.00, 500.00, '8904561239871', 'PACK001QR', 'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?q=80&w=200&auto=format&fit=crop');

-- Associate Products with Vendors
INSERT INTO product_vendors (product_id, vendor_id, is_preferred) VALUES
(1, 1, true), -- MCB 16A with Siemens
(2, 1, true), -- MCB 32A with Siemens
(3, 2, true), -- Ball Bearing with SKF
(4, 2, false), -- Shaft Coupling with SKF (alternate)
(4, 4, true), -- Shaft Coupling with Apex (preferred)
(5, 3, true); -- Carton Box with PackWell

-- Insert Locations representing grid racks
-- Zone A (Electrics) has Rack A1-A4
-- Zone B (Mechanicals) has Rack B1-B4
-- Zone C (Packaging) has Rack C1-C4
-- Racks A1-A4 are row 0, B1-B4 are row 1, C1-C4 are row 2.
-- Each Rack has 3 Shelves (Shelf 1, Shelf 2, Shelf 3).
-- Each Shelf has 2 Bins (Bin 1, Bin 2).
-- Let's populate specific target locations:
INSERT INTO locations (zone, rack, shelf, bin, row_index, col_index) VALUES
('Zone A', 'A1', 'Shelf 1', 'Bin 1', 0, 0),
('Zone A', 'A1', 'Shelf 1', 'Bin 2', 0, 0),
('Zone A', 'A1', 'Shelf 2', 'Bin 1', 0, 0),
('Zone A', 'A2', 'Shelf 2', 'Bin 1', 0, 1),
('Zone A', 'A2', 'Shelf 2', 'Bin 2', 0, 1),
('Zone A', 'A3', 'Shelf 1', 'Bin 1', 0, 2),
('Zone A', 'A4', 'Shelf 3', 'Bin 2', 0, 3),

('Zone B', 'B1', 'Shelf 3', 'Bin 2', 1, 0),
('Zone B', 'B1', 'Shelf 1', 'Bin 1', 1, 0),
('Zone B', 'B2', 'Shelf 1', 'Bin 1', 1, 1),
('Zone B', 'B3', 'Shelf 2', 'Bin 1', 1, 2),
('Zone B', 'B4', 'Shelf 3', 'Bin 1', 1, 3),

('Zone C', 'C1', 'Shelf 1', 'Bin 1', 2, 0),
('Zone C', 'C2', 'Shelf 2', 'Bin 1', 2, 1),
('Zone C', 'C3', 'Shelf 3', 'Bin 1', 2, 2),
('Zone C', 'C4', 'Shelf 1', 'Bin 2', 2, 3);

-- Seed quantities at locations
INSERT INTO product_locations (product_id, location_id, quantity) VALUES
(1, 1, 45.00), -- MCB 16A in Zone A, Rack A1, Shelf 1, Bin 1: 45 units
(1, 3, 20.00), -- MCB 16A also in Zone A, Rack A1, Shelf 2, Bin 1: 20 units (Total: 65 units -> Healthy)
(2, 4, 8.00),  -- MCB 32A in Zone A, Rack A2, Shelf 2, Bin 1: 8 units (Total: 8 units -> Low Stock, Min 15)
(3, 8, 5.00),  -- Ball Bearing 6204 in Zone B, Rack B1, Shelf 3, Bin 2: 5 units (Total: 5 units -> Critical, Min 20)
(4, 10, 12.00),-- Shaft Coupling D25 in Zone B, Rack B2, Shelf 1, Bin 1: 12 units (Total: 12 units -> Healthy, Min 10)
(5, 13, 0.00); -- Carton Box in Zone C, Rack C1, Shelf 1, Bin 1: 0 units (Total: 0 units -> Out of Stock, Min 50)

-- Seed Inventory Transactions history
INSERT INTO inventory_transactions (user_name, user_role, product_id, quantity, action, from_location_id, to_location_id, remarks) VALUES
('Surya (Admin)', 'Administrator', 1, 50.00, 'STOCK_IN', NULL, 1, 'Initial batch intake for MCB 16A'),
('Surya (Admin)', 'Administrator', 1, 5.00, 'STOCK_OUT', 1, NULL, 'Issued 5 units to Maintenance Team'),
('Adarsh (Store Manager)', 'Store Manager', 1, 20.00, 'TRANSFER', 1, 3, 'Transfer for display shelf stock balancing'),
('Adarsh (Store Manager)', 'Store Manager', 2, 10.00, 'STOCK_IN', NULL, 4, 'Intake of MCB 32A'),
('Adarsh (Store Manager)', 'Store Manager', 2, 2.00, 'STOCK_OUT', 4, NULL, 'Replaced burnt out breaker in panel 4'),
('Rahul (Operator)', 'Store Operator', 3, 5.00, 'STOCK_IN', NULL, 8, 'Received from SKF'),
('Rahul (Operator)', 'Store Operator', 4, 15.00, 'STOCK_IN', NULL, 10, 'Received from Apex'),
('Rahul (Operator)', 'Store Operator', 4, 3.00, 'STOCK_OUT', 10, NULL, 'Used in conveyor assembly line');

-- Seed Purchase Requests
INSERT INTO purchase_requests (requester, product_id, quantity, status, remarks) VALUES
('Adarsh (Store Manager)', 2, 30.00, 'PENDING', 'Stock level critically low (8 left, min is 15)'),
('Vikram (Purchase Team)', 3, 50.00, 'APPROVED', 'Order being placed with SKF Bearings India Co');
