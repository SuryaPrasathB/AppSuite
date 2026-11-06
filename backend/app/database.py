import sys
import json
import mysql.connector
from typing import Dict, List, Any, Optional
from datetime import datetime
from app.config import settings
from app.features import Features
import bcrypt

def get_db_connection():
    return mysql.connector.connect(
        host=settings.MYSQL_HOST,
        user=settings.MYSQL_USER,
        password=settings.MYSQL_PASSWORD,
        database=settings.MYSQL_DATABASE
    )

class DBStore:
    @staticmethod
    def init_description_history_table():
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS description_histories (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    entity_type VARCHAR(50) NOT NULL,
                    entity_id INT NOT NULL,
                    old_description TEXT,
                    new_description TEXT,
                    user_id INT DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE SET NULL,
                    INDEX idx_entity (entity_type, entity_id, created_at)
                )
            """)
            conn.commit()
            cursor.close()
            conn.close()
        except Exception as e:
            print("init_description_history_table error:", e)

    @staticmethod
    def init_project_columns():
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cols = [
                ("category", "VARCHAR(50) DEFAULT 'STANDARD'"),
                ("milestone", "VARCHAR(255) DEFAULT NULL"),
                ("parent_id", "INT NULL"),
                ("is_parent", "BOOLEAN DEFAULT FALSE"),
                ("is_template", "BOOLEAN DEFAULT FALSE"),
                ("template_id", "INT NULL"),
                ("deleted_at", "TIMESTAMP NULL DEFAULT NULL"),
                ("project_incharge", "VARCHAR(255) DEFAULT NULL"),
                ("has_software", "BOOLEAN DEFAULT FALSE"),
                ("has_firmware", "BOOLEAN DEFAULT FALSE"),
                ("has_transformer", "BOOLEAN DEFAULT FALSE"),
                ("no_of_panels", "INT DEFAULT 1"),
                ("folder_path", "VARCHAR(500) DEFAULT NULL"),
                ("date_of_delivery", "DATE DEFAULT NULL"),
            ]
            for col_name, col_type in cols:
                cursor.execute(f"SHOW COLUMNS FROM projects LIKE '{col_name}'")
                if not cursor.fetchone():
                    cursor.execute(f"ALTER TABLE projects ADD COLUMN {col_name} {col_type}")
                    print(f"Added {col_name} column to projects table.")

            # Ensure global_milestones table exists
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS global_milestones (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE
                )
            """)
            conn.commit()
            cursor.close()
            conn.close()
        except Exception as e:
            print("init_project_columns error:", e)

    @staticmethod
    def init_project_category_column():
        DBStore.init_project_columns()

    @staticmethod
    def init_bom_procurement_columns():
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            bom_cols = [
                ("issued_at", "TIMESTAMP NULL DEFAULT NULL"),
                ("customer_name", "VARCHAR(255) NULL DEFAULT NULL"),
                ("target_delivery_date", "DATE NULL DEFAULT NULL"),
                ("is_template", "BOOLEAN NOT NULL DEFAULT FALSE"),
                ("template_category", "VARCHAR(100) NULL DEFAULT NULL"),
                ("revision", "VARCHAR(20) NOT NULL DEFAULT 'A'"),
                ("root_bom_id", "INT NULL DEFAULT NULL"),
                ("parent_bom_id", "INT NULL DEFAULT NULL"),
                ("eco_id", "INT NULL DEFAULT NULL"),
                ("is_reserved", "BOOLEAN NOT NULL DEFAULT FALSE"),
            ]
            for col_name, col_def in bom_cols:
                cursor.execute(f"SHOW COLUMNS FROM boms LIKE '{col_name}'")
                if not cursor.fetchone():
                    cursor.execute(f"ALTER TABLE boms ADD COLUMN {col_name} {col_def}")

            item_cols = [
                ("manual_product_name", "VARCHAR(255) NULL DEFAULT NULL"),
                ("part_number", "VARCHAR(255) NULL DEFAULT NULL"),
                ("manufacturer", "VARCHAR(255) NULL DEFAULT NULL"),
                ("link", "TEXT NULL"),
                ("custom_fields", "TEXT NULL"),
                ("unit_price", "DECIMAL(12, 2) NOT NULL DEFAULT 0.00"),
                ("procurement_status", "VARCHAR(50) NOT NULL DEFAULT 'YET_TO_ORDER'"),
                ("ordered_date", "DATE NULL DEFAULT NULL"),
                ("expected_delivery_date", "DATE NULL DEFAULT NULL"),
                ("delivered_date", "DATE NULL DEFAULT NULL"),
                ("parent_item_id", "INT NULL DEFAULT NULL"),
                ("is_assembly", "BOOLEAN NOT NULL DEFAULT FALSE"),
                ("level", "INT NOT NULL DEFAULT 1"),
            ]
            for col_name, col_def in item_cols:
                cursor.execute(f"SHOW COLUMNS FROM bom_items LIKE '{col_name}'")
                if not cursor.fetchone():
                    cursor.execute(f"ALTER TABLE bom_items ADD COLUMN {col_name} {col_def}")

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS engineering_change_orders (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    eco_number VARCHAR(100) NOT NULL UNIQUE,
                    title VARCHAR(255) NOT NULL,
                    description TEXT NULL,
                    reason TEXT NULL,
                    initiator VARCHAR(255) NULL,
                    status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
                    source_bom_id INT NULL,
                    target_bom_id INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    approved_at TIMESTAMP NULL
                )
            """)

            cursor.execute("UPDATE boms SET root_bom_id = id WHERE root_bom_id IS NULL")

            cursor.execute("UPDATE boms SET issued_at = created_at WHERE issued_at IS NULL AND status IN ('APPROVED', 'ISSUED', 'COMPLETED')")
            conn.commit()
            cursor.close()
            conn.close()
        except Exception as e:
            print("init_bom_procurement_columns error:", e)

    @staticmethod
    def get_vendors() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM vendors")
        vendors = cursor.fetchall()
        cursor.close()
        conn.close()
        # Convert datetime to string
        for v in vendors:
            if v.get('created_at'):
                v['created_at'] = v['created_at'].isoformat()
            # MySQL boolean comes back as 1 or 0
            v['is_preferred'] = bool(v.get('is_preferred'))
        return vendors

    @staticmethod
    def add_vendor(vendor: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            INSERT INTO vendors (name, contact_person, phone, email, address, gst_number, is_preferred)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            vendor.get("name"), vendor.get("contact_person"), vendor.get("phone"),
            vendor.get("email"), vendor.get("address"), vendor.get("gst_number"),
            1 if vendor.get("is_preferred") else 0
        )
        cursor.execute(query, values)
        conn.commit()
        vendor["id"] = cursor.lastrowid
        vendor["created_at"] = datetime.now().isoformat()
        cursor.close()
        conn.close()
        return vendor

    @staticmethod
    def update_vendor(vendor_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        updates = []
        values = []
        for key in ["name", "contact_person", "phone", "email", "address", "gst_number"]:
            if key in data:
                updates.append(f"{key} = %s")
                values.append(data[key])
        
        if "is_preferred" in data:
            updates.append("is_preferred = %s")
            values.append(1 if data["is_preferred"] else 0)
            
        if not updates:
            return data
            
        values.append(vendor_id)
        query = f"UPDATE vendors SET {', '.join(updates)} WHERE id = %s"
        cursor.execute(query, values)
        conn.commit()
        
        cursor.execute("SELECT * FROM vendors WHERE id = %s", (vendor_id,))
        v = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if v and v.get('created_at'):
            v['created_at'] = v['created_at'].isoformat()
        if v:
            v['is_preferred'] = bool(v.get('is_preferred'))
        return v

    @staticmethod
    def get_products() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT p.*, 
                   COALESCE(SUM(pl.quantity), 0) as current_quantity,
                   (
                       SELECT COALESCE(SUM(GREATEST(0, bi.quantity_required - bi.quantity_issued)), 0)
                       FROM bom_items bi
                       JOIN boms b ON bi.bom_id = b.id
                       WHERE bi.product_id = p.id AND (b.status = 'APPROVED' OR b.is_reserved = TRUE)
                   ) as reserved_quantity
            FROM products p
            LEFT JOIN product_locations pl ON p.id = pl.product_id
            GROUP BY p.id
        """)
        products = cursor.fetchall()
        
        cursor.execute("SELECT * FROM product_vendors")
        all_pvs = cursor.fetchall()
        
        cursor.execute("SELECT * FROM vendors")
        vendors_map = {v["id"]: v["name"] for v in cursor.fetchall()}
        
        cursor.execute("""
            SELECT pl.*, l.zone, l.rack, l.shelf, l.bin, l.row_index, l.col_index 
            FROM product_locations pl 
            JOIN locations l ON pl.location_id = l.id
        """)
        all_pls = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        for p in products:
            if p.get('created_at'):
                p['created_at'] = p['created_at'].isoformat()
            
            p['min_quantity'] = float(p['min_quantity'] or 0)
            p['max_quantity'] = float(p['max_quantity'] or 0)
            p['standard_cost'] = float(p.get('standard_cost') or 0)
            p['latest_cost'] = float(p.get('latest_cost') or 0)
            p['average_cost'] = float(p.get('average_cost') or 0)
            total_qty = float(p['current_quantity'] or 0)
            p['current_quantity'] = total_qty
            p['reserved_quantity'] = float(p.get('reserved_quantity') or 0)
            
            if total_qty == 0:
                p['status'] = "OUT_OF_STOCK"
            elif total_qty < p["min_quantity"] * 0.5:
                p['status'] = "CRITICAL"
            elif total_qty < p["min_quantity"]:
                p['status'] = "LOW_STOCK"
            else:
                p['status'] = "HEALTHY"
                
            p_vendors = [pv for pv in all_pvs if pv["product_id"] == p["id"]]
            pref_pv = next((pv for pv in p_vendors if pv["is_preferred"]), None)
            
            p['preferred_vendor_id'] = pref_pv["vendor_id"] if pref_pv else None
            p['preferred_vendor'] = vendors_map.get(p['preferred_vendor_id'], "N/A") if pref_pv else "N/A"
            p['vendor_ids'] = [pv["vendor_id"] for pv in p_vendors]
            
            p['locations'] = [
                {
                    "location_id": pl["location_id"],
                    "zone": pl["zone"],
                    "rack": pl["rack"],
                    "shelf": pl["shelf"],
                    "bin": pl["bin"],
                    "row_index": pl["row_index"],
                    "col_index": pl["col_index"],
                    "quantity": float(pl["quantity"])
                }
                for pl in all_pls if pl["product_id"] == p["id"]
            ]

            if not p.get('manufacturer') and p.get('description'):
                try:
                    desc_data = json.loads(p['description'])
                    if isinstance(desc_data, dict):
                        mfg = (
                            desc_data.get('specifications', {}).get('manufacturer') or
                            desc_data.get('additional', {}).get('manufacturer') or
                            ''
                        )
                        if mfg:
                            p['manufacturer'] = mfg
                except Exception:
                    pass
            
        return products

    @staticmethod
    def add_product(product: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """
            INSERT INTO products (code, name, description, category, unit, min_quantity, max_quantity, barcode, qr_code, image_url, manufacturer, link, standard_cost, latest_cost, average_cost, currency)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        if not product.get("manufacturer") and product.get("description"):
            try:
                desc_data = json.loads(product["description"])
                if isinstance(desc_data, dict):
                    mfg = (
                        desc_data.get("specifications", {}).get("manufacturer") or
                        desc_data.get("additional", {}).get("manufacturer") or
                        ""
                    )
                    if mfg:
                        product["manufacturer"] = mfg
            except Exception:
                pass

        values = (
            product.get("code"), product.get("name"), product.get("description"),
            product.get("category"), product.get("unit", "pcs"), 
            product.get("min_quantity", 0), product.get("max_quantity", 0),
            product.get("barcode", ""), product.get("qr_code", ""), product.get("image_url", ""),
            product.get("manufacturer", ""), product.get("link", ""),
            product.get("standard_cost", 0.0), product.get("latest_cost", 0.0),
            product.get("average_cost", 0.0), product.get("currency", "INR")
        )
        cursor.execute(query, values)
        p_id = cursor.lastrowid
        product["id"] = p_id
        
        vendor_ids = product.get("vendor_ids", [])
        preferred_vendor_id = product.get("preferred_vendor_id")
        
        if vendor_ids:
            pv_query = "INSERT INTO product_vendors (product_id, vendor_id, is_preferred) VALUES (%s, %s, %s)"
            pv_values = [(p_id, v_id, 1 if v_id == preferred_vendor_id else 0) for v_id in vendor_ids]
            cursor.executemany(pv_query, pv_values)
            
        # Try to parse location from description and map it
        description = product.get("description")
        if description:
            try:
                desc_data = json.loads(description)
                store_info = desc_data.get("store", {})
                zone = store_info.get("zone")
                rack = store_info.get("rack")
                shelf = store_info.get("shelf")
                bin_name = store_info.get("bin")
                
                if rack and shelf:
                    if not bin_name:
                        bin_name = "Bin 1"
                    if not zone:
                        isAisle1 = rack in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2']
                        isAisle2 = rack in ['A3', 'A4', 'B3', 'B4', 'C4', 'D3', 'D4']
                        isAisle3 = rack in ['A5', 'A6', 'B5', 'B6', 'C5', 'C6', 'D5', 'D6']
                        zone = 'Zone A' if isAisle1 else 'Zone B' if isAisle2 else 'Zone C' if isAisle3 else 'Zone D'
                    
                    row_idx = 0
                    col_idx = 0
                    if rack.startswith('B'):
                        row_idx = 1
                    elif rack.startswith('C'):
                        row_idx = 2
                    elif rack.startswith('D'):
                        row_idx = 3
                    
                    try:
                        col_idx = int(rack[1:]) - 1
                    except Exception:
                        pass
                        
                    if not shelf.startswith("Shelf "):
                        shelf = f"Shelf {shelf}"
                    if not bin_name.startswith("Bin "):
                        bin_name = f"Bin {bin_name}"
                        
                    cursor.execute("SELECT id FROM locations WHERE zone = %s AND rack = %s AND shelf = %s AND bin = %s", (zone, rack, shelf, bin_name))
                    loc_row = cursor.fetchone()
                    if loc_row:
                        loc_id = loc_row["id"]
                    else:
                        cursor.execute("""
                            INSERT INTO locations (zone, rack, shelf, bin, row_index, col_index)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (zone, rack, shelf, bin_name, row_idx, col_idx))
                        loc_id = cursor.lastrowid
                        
                    cursor.execute("INSERT INTO product_locations (product_id, location_id, quantity) VALUES (%s, %s, %s)", (p_id, loc_id, float(product.get("initial_quantity", 0.0))))
            except Exception as e:
                print("Error mapping product location during add:", e, file=sys.stderr)
            
        conn.commit()
        cursor.close()
        conn.close()
        product["created_at"] = datetime.now().isoformat()
        return product

    @staticmethod
    def update_product(product_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        if ("manufacturer" not in data or not data.get("manufacturer")) and data.get("description"):
            try:
                desc_data = json.loads(data["description"])
                if isinstance(desc_data, dict):
                    mfg = (
                        desc_data.get("specifications", {}).get("manufacturer") or
                        desc_data.get("additional", {}).get("manufacturer") or
                        ""
                    )
                    if mfg:
                        data["manufacturer"] = mfg
            except Exception:
                pass

        updates = []
        values = []
        fields = ["code", "name", "description", "category", "unit", "min_quantity", "max_quantity", "barcode", "qr_code", "image_url", "manufacturer", "link", "standard_cost", "latest_cost", "average_cost", "currency"]
        for key in fields:
            if key in data:
                updates.append(f"{key} = %s")
                values.append(data[key])
                
        if updates:
            values.append(product_id)
            query = f"UPDATE products SET {', '.join(updates)} WHERE id = %s"
            cursor.execute(query, values)
            
        if "vendor_ids" in data:
            cursor.execute("DELETE FROM product_vendors WHERE product_id = %s", (product_id,))
            vendor_ids = data["vendor_ids"]
            preferred_vendor_id = data.get("preferred_vendor_id")
            if vendor_ids:
                pv_query = "INSERT INTO product_vendors (product_id, vendor_id, is_preferred) VALUES (%s, %s, %s)"
                pv_values = [(product_id, v_id, 1 if v_id == preferred_vendor_id else 0) for v_id in vendor_ids]
                cursor.executemany(pv_query, pv_values)
                
        # Try to parse location from description and map it
        if "description" in data:
            description = data["description"]
            if description:
                try:
                    desc_data = json.loads(description)
                    store_info = desc_data.get("store", {})
                    zone = store_info.get("zone")
                    rack = store_info.get("rack")
                    shelf = store_info.get("shelf")
                    bin_name = store_info.get("bin")
                    
                    if rack and shelf:
                        if not bin_name:
                            bin_name = "Bin 1"
                        if not zone:
                            isAisle1 = rack in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2']
                            isAisle2 = rack in ['A3', 'A4', 'B3', 'B4', 'C4', 'D3', 'D4']
                            isAisle3 = rack in ['A5', 'A6', 'B5', 'B6', 'C5', 'C6', 'D5', 'D6']
                            zone = 'Zone A' if isAisle1 else 'Zone B' if isAisle2 else 'Zone C' if isAisle3 else 'Zone D'
                        
                        row_idx = 0
                        col_idx = 0
                        if rack.startswith('B'):
                            row_idx = 1
                        elif rack.startswith('C'):
                            row_idx = 2
                        elif rack.startswith('D'):
                            row_idx = 3
                        
                        try:
                            col_idx = int(rack[1:]) - 1
                        except Exception:
                            pass
                            
                        if not shelf.startswith("Shelf "):
                            shelf = f"Shelf {shelf}"
                        if not bin_name.startswith("Bin "):
                            bin_name = f"Bin {bin_name}"
                            
                        cursor.execute("SELECT id FROM locations WHERE zone = %s AND rack = %s AND shelf = %s AND bin = %s", (zone, rack, shelf, bin_name))
                        loc_row = cursor.fetchone()
                        if loc_row:
                            loc_id = loc_row["id"]
                        else:
                            cursor.execute("""
                                INSERT INTO locations (zone, rack, shelf, bin, row_index, col_index)
                                VALUES (%s, %s, %s, %s, %s, %s)
                            """, (zone, rack, shelf, bin_name, row_idx, col_idx))
                            loc_id = cursor.lastrowid
                            
                        cursor.execute("SELECT location_id FROM product_locations WHERE product_id = %s", (product_id,))
                        existing_pls = [r["location_id"] for r in cursor.fetchall()]
                        if loc_id not in existing_pls:
                            cursor.execute("DELETE FROM product_locations WHERE product_id = %s AND quantity = 0", (product_id,))
                            cursor.execute("INSERT INTO product_locations (product_id, location_id, quantity) VALUES (%s, %s, %s)", (product_id, loc_id, float(data.get("initial_quantity", 0.0))))
                        elif "initial_quantity" in data:
                            cursor.execute("UPDATE product_locations SET quantity = %s WHERE product_id = %s AND location_id = %s", (float(data["initial_quantity"]), product_id, loc_id))
                except Exception as e:
                    print("Error mapping product location during update:", e, file=sys.stderr)
                    
        conn.commit()
        cursor.execute("SELECT * FROM products WHERE id = %s", (product_id,))
        p = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if p and p.get('created_at'):
            p['created_at'] = p['created_at'].isoformat()
            p['min_quantity'] = float(p['min_quantity'] or 0)
            p['max_quantity'] = float(p['max_quantity'] or 0)
        return p

    @staticmethod
    def delete_product(product_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("DELETE FROM products WHERE id = %s", (product_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def get_locations() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM locations")
        locs = cursor.fetchall()
        cursor.close()
        conn.close()
        for l in locs:
            if l.get('created_at'):
                l['created_at'] = l['created_at'].isoformat()
        return locs

    @staticmethod
    def add_location(loc: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Default zone and row/col logic if not provided
        rack = loc.get("rack", "")
        zone = loc.get("zone")
        if not zone and rack:
            isAisle1 = rack in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2']
            isAisle2 = rack in ['A3', 'A4', 'B3', 'B4', 'C4', 'D3', 'D4']
            isAisle3 = rack in ['A5', 'A6', 'B5', 'B6', 'C5', 'C6', 'D5', 'D6']
            zone = 'Zone A' if isAisle1 else 'Zone B' if isAisle2 else 'Zone C' if isAisle3 else 'Zone D'
            
        row_idx = loc.get("row_index", 0)
        col_idx = loc.get("col_index", 0)
        
        shelf = loc.get("shelf", "Shelf 1")
        if not shelf.startswith("Shelf "):
            shelf = f"Shelf {shelf}"
            
        bin_name = loc.get("bin", "Bin 1")
        if not bin_name.startswith("Bin "):
            bin_name = f"Bin {bin_name}"

        query = """
            INSERT INTO locations (zone, rack, shelf, bin, row_index, col_index)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (zone, rack, shelf, bin_name, row_idx, col_idx))
        loc_id = cursor.lastrowid
        conn.commit()
        
        cursor.execute("SELECT * FROM locations WHERE id = %s", (loc_id,))
        new_loc = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if new_loc and new_loc.get('created_at'):
            new_loc['created_at'] = new_loc['created_at'].isoformat()
            
        return new_loc

    @staticmethod
    def get_product_locations() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM product_locations")
        pls = cursor.fetchall()
        cursor.close()
        conn.close()
        for pl in pls:
            pl['quantity'] = float(pl['quantity'])
        return pls

    @staticmethod
    def update_product_location(product_id: int, location_id: int, quantity_delta: float) -> float:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT quantity FROM product_locations WHERE product_id = %s AND location_id = %s", (product_id, location_id))
        row = cursor.fetchone()
        
        if row:
            new_qty = max(0.0, float(row["quantity"]) + quantity_delta)
            cursor.execute("UPDATE product_locations SET quantity = %s WHERE product_id = %s AND location_id = %s", (new_qty, product_id, location_id))
        else:
            new_qty = max(0.0, quantity_delta)
            cursor.execute("INSERT INTO product_locations (product_id, location_id, quantity) VALUES (%s, %s, %s)", (product_id, location_id, new_qty))
            
        conn.commit()
        cursor.close()
        conn.close()
        return new_qty

    @staticmethod
    def bulk_stock_out(stock_outs: List[Dict[str, Any]], user_name: str, user_role: str, recipient: str, remarks: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        for item in stock_outs:
            cursor.execute("SELECT quantity FROM product_locations WHERE product_id = %s AND location_id = %s", (item["product_id"], item["location_id"]))
            row = cursor.fetchone()
            current_qty = float(row["quantity"]) if row else 0.0
            if current_qty < item["quantity"]:
                cursor.execute("SELECT name FROM products WHERE id = %s", (item["product_id"],))
                p = cursor.fetchone()
                p_name = p["name"] if p else f"ID {item['product_id']}"
                cursor.close()
                conn.close()
                raise ValueError(f"Insufficient stock for '{p_name}'. Available: {current_qty}, Requested: {item['quantity']}.")

        detailed_items = []
        for item in stock_outs:
            DBStore.update_product_location(item["product_id"], item["location_id"], -item["quantity"])
            
            cursor.execute("SELECT name, code FROM products WHERE id = %s", (item["product_id"],))
            p = cursor.fetchone()
            
            cursor.execute("SELECT zone, rack, shelf, bin FROM locations WHERE id = %s", (item["location_id"],))
            l = cursor.fetchone()
            
            detailed_items.append({
                "product_id": item["product_id"],
                "product_name": p["name"] if p else "Unknown",
                "product_code": p["code"] if p else "N/A",
                "location_id": item["location_id"],
                "location_label": f"{l['zone']}-Rack {l['rack']}-Shelf {l['shelf']}-Bin {l['bin']}" if l else "Unknown",
                "quantity": item["quantity"],
                "remarks": item.get("remarks")
            })

        total_qty = sum(item["quantity"] for item in stock_outs)
        cursor.execute("""
            INSERT INTO inventory_transactions (user_name, user_role, quantity, action, remarks)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_name, user_role, total_qty, 'STOCK_OUT', json.dumps(detailed_items)))
        
        tx_id = cursor.lastrowid
        conn.commit()
        cursor.close()
        conn.close()
        return [{"id": tx_id, "action": "STOCK_OUT", "quantity": total_qty}]

    @staticmethod
    def bulk_stock_in(stock_ins: List[Dict[str, Any]], user_name: str, user_role: str, source: str, remarks: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        detailed_items = []
        for item in stock_ins:
            DBStore.update_product_location(item["product_id"], item["location_id"], item["quantity"])
            
            cursor.execute("SELECT name, code FROM products WHERE id = %s", (item["product_id"],))
            p = cursor.fetchone()
            
            cursor.execute("SELECT zone, rack, shelf, bin FROM locations WHERE id = %s", (item["location_id"],))
            l = cursor.fetchone()
            
            detailed_items.append({
                "product_id": item["product_id"],
                "product_name": p["name"] if p else "Unknown",
                "product_code": p["code"] if p else "N/A",
                "location_id": item["location_id"],
                "location_label": f"{l['zone']}-Rack {l['rack']}-Shelf {l['shelf']}-Bin {l['bin']}" if l else "Unknown",
                "quantity": item["quantity"],
                "remarks": item.get("remarks")
            })

        total_qty = sum(item["quantity"] for item in stock_ins)
        cursor.execute("""
            INSERT INTO inventory_transactions (user_name, user_role, quantity, action, remarks)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_name, user_role, total_qty, 'STOCK_IN', json.dumps(detailed_items)))
        
        tx_id = cursor.lastrowid
        conn.commit()
        cursor.close()
        conn.close()
        return [{"id": tx_id, "action": "STOCK_IN", "quantity": total_qty}]

    @staticmethod
    def get_transactions() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT it.*, p.name as p_name, p.code as p_code,
                   fl.zone as f_zone, fl.rack as f_rack, fl.shelf as f_shelf, fl.bin as f_bin,
                   tl.zone as t_zone, tl.rack as t_rack, tl.shelf as t_shelf, tl.bin as t_bin
            FROM inventory_transactions it
            LEFT JOIN products p ON it.product_id = p.id
            LEFT JOIN locations fl ON it.from_location_id = fl.id
            LEFT JOIN locations tl ON it.to_location_id = tl.id
            ORDER BY it.created_at DESC
        """)
        txs = cursor.fetchall()
        cursor.close()
        conn.close()
        
        result = []
        for t in txs:
            if t.get('created_at'):
                t['created_at'] = t['created_at'].isoformat()
            t['quantity'] = float(t['quantity'])
            
            if t.get('product_id') is None and t.get('remarks') and t['remarks'].startswith('['):
                try:
                    items_parsed = json.loads(t["remarks"])
                except:
                    items_parsed = []
                is_stock_in = t.get("action") == "STOCK_IN"
                
                if len(items_parsed) == 1:
                    # Treat as a regular single-item transaction
                    single_item = items_parsed[0]
                    t['product_name'] = single_item.get("product_name", "Unknown")
                    t['product_code'] = single_item.get("product_code", "N/A")
                    t['from_location'] = None if is_stock_in else single_item.get("location_label")
                    t['to_location'] = single_item.get("location_label") if is_stock_in else None
                    t['items'] = []  # Clear items so it doesn't render as bulk
                else:
                    t['product_name'] = "Bulk Intake" if is_stock_in else "Bulk Dispatch"
                    t['product_code'] = "BULK"
                    
                    # If all items share the same location, display that specific location instead of "Multiple Locations"
                    unique_locs = list(set(item.get("location_label", "") for item in items_parsed if item.get("location_label")))
                    loc_display = unique_locs[0] if len(unique_locs) == 1 else "Multiple Locations"

                    t['from_location'] = None if is_stock_in else loc_display
                    t['to_location'] = loc_display if is_stock_in else None
                    t['items'] = items_parsed
            else:
                t['product_name'] = t.pop('p_name') or "Unknown"
                t['product_code'] = t.pop('p_code') or "N/A"
                if t.get('f_zone'):
                    t['from_location'] = f"{t['f_zone']}-{t['f_rack']}-{t['f_shelf']}-{t['f_bin']}"
                else:
                    t['from_location'] = None
                if t.get('t_zone'):
                    t['to_location'] = f"{t['t_zone']}-{t['t_rack']}-{t['t_shelf']}-{t['t_bin']}"
                else:
                    t['to_location'] = None
                t['items'] = []
                
            result.append(t)
        return result

    @staticmethod
    def add_transaction(tx: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            INSERT INTO inventory_transactions 
            (user_name, user_role, product_id, quantity, action, from_location_id, to_location_id, remarks)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            tx.get("user_name"), tx.get("user_role"), tx.get("product_id"),
            tx.get("quantity", 0), tx.get("action"), tx.get("from_location_id"),
            tx.get("to_location_id"), tx.get("remarks")
        )
        cursor.execute(query, values)
        tx["id"] = cursor.lastrowid
        conn.commit()
        cursor.close()
        conn.close()
        tx["created_at"] = datetime.now().isoformat()
        return tx

    @staticmethod
    def get_purchase_requests() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM purchase_requests ORDER BY created_at DESC")
        reqs = cursor.fetchall()
        cursor.close()
        conn.close()
        for r in reqs:
            if r.get('created_at'): r['created_at'] = r['created_at'].isoformat()
            if r.get('approved_at'): r['approved_at'] = r['approved_at'].isoformat()
            if r.get('delivered_at'): r['delivered_at'] = r['delivered_at'].isoformat()
            r['quantity'] = float(r['quantity'])
            
            try:
                r['items'] = json.loads(r.get("remarks") or "[]")
                if not isinstance(r['items'], list):
                    r['items'] = []
            except:
                r['items'] = []
                
            try:
                r['history_logs'] = json.loads(r.get("history_logs") or "[]")
            except:
                r['history_logs'] = []
        return reqs

    @staticmethod
    def add_purchase_request(req: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        items_json = json.dumps(req.get("items", []))
        history = [{"timestamp": datetime.now().isoformat(), "user": req.get("requester"), "action": "Raised request for new products"}]
        
        query = """
            INSERT INTO purchase_requests (requester, product_id, quantity, status, remarks, history_logs)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (req.get("requester"), None, 0, "PENDING", items_json, json.dumps(history)))
        req["id"] = cursor.lastrowid
        conn.commit()
        cursor.close()
        conn.close()
        return req

    @staticmethod
    def update_purchase_request(req_id: int, status: str, user_name: str, change_remarks: Optional[str] = None, items_updates: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM purchase_requests WHERE id = %s", (req_id,))
        req = cursor.fetchone()
        
        if not req:
            cursor.close()
            conn.close()
            raise ValueError(f"Request ID {req_id} not found.")
            
        old_status = req["status"]
        history_actions = []
        updates = []
        values = []
        
        if items_updates:
            updates.append("remarks = %s")
            values.append(json.dumps(items_updates))
            history_actions.append("Adjusted requested items/quantities")
            
        if status != old_status:
            updates.append("status = %s")
            values.append(status)
            history_actions.append(f"Status changed from {old_status} to {status}")
            
            if status in ["APPROVED", "DECLINED"]:
                updates.append("approved_at = CURRENT_TIMESTAMP")
            elif status == "DELIVERED":
                updates.append("delivered_at = CURRENT_TIMESTAMP")
                
        if change_remarks:
            updates.append("change_remarks = %s")
            values.append(change_remarks)
            
        try:
            history = json.loads(req.get("history_logs") or "[]")
        except:
            history = []
            
        for act in history_actions:
            history.append({
                "timestamp": datetime.now().isoformat(),
                "user": user_name,
                "action": act + (f" (Remarks: {change_remarks})" if change_remarks else "")
            })
            
        updates.append("history_logs = %s")
        values.append(json.dumps(history))
        
        values.append(req_id)
        cursor.execute(f"UPDATE purchase_requests SET {', '.join(updates)} WHERE id = %s", values)
        conn.commit()
        
        if status == "DELIVERED" and old_status != "DELIVERED":
            items = items_updates if items_updates else json.loads(req.get("remarks") or "[]")
            for item in items:
                cursor.execute("SELECT id FROM products WHERE code = %s", (item["code"],))
                if not cursor.fetchone():
                    cursor.execute("""
                        INSERT INTO products (code, name, description, category, unit, min_quantity, max_quantity)
                        VALUES (%s, %s, %s, %s, %s, 0, 0)
                    """, (item["code"], item["name"], "Auto registered from product request delivery.", item.get("category", "Electrical"), item.get("unit", "pcs")))
            conn.commit()
            
        cursor.execute("SELECT * FROM purchase_requests WHERE id = %s", (req_id,))
        updated_req = cursor.fetchone()
        cursor.close()
        conn.close()
        return updated_req

    @staticmethod
    def get_employees() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, name, role, phone, email, department, username, created_at,
                   last_login_at, last_seen_at, presence_status, status_message,
                   TIMESTAMPDIFF(SECOND, last_seen_at, NOW()) AS seconds_since_seen,
                   TIMESTAMPDIFF(SECOND, last_login_at, NOW()) AS seconds_since_login
            FROM employees 
            ORDER BY name ASC
        """)
        employees = cursor.fetchall()
        cursor.close()
        conn.close()
        for emp in employees:
            if not emp.get('last_seen_at') and emp.get('last_login_at'):
                emp['last_seen_at'] = emp['last_login_at']
                emp['seconds_since_seen'] = emp.get('seconds_since_login')

            if emp.get('created_at'):
                emp['created_at'] = emp['created_at'].isoformat() + 'Z'
            if emp.get('last_login_at'):
                emp['last_login_at'] = emp['last_login_at'].isoformat() + 'Z'
            if emp.get('last_seen_at'):
                emp['last_seen_at'] = emp['last_seen_at'].isoformat() + 'Z'

            seconds = emp.get('seconds_since_seen')
            raw_presence = (emp.get('presence_status') or 'offline').lower()

            if seconds is None:
                emp['computed_status'] = 'offline'
            elif raw_presence == 'busy' and seconds < 600:
                emp['computed_status'] = 'busy'
            elif raw_presence == 'offline':
                emp['computed_status'] = 'offline'
            elif seconds <= 180:  # within 3 minutes
                emp['computed_status'] = 'online'
            elif seconds <= 600:  # between 3 and 10 minutes
                emp['computed_status'] = 'away'
            else:
                emp['computed_status'] = 'offline'

        return employees

    @staticmethod
    def get_employees_with_workload() -> List[Dict[str, Any]]:
        employees = DBStore.get_employees()
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            
            # Fetch all active (non-completed, non-cancelled) tasks with assignees
            query = """
                SELECT DISTINCT dt.id, dt.title, dt.project_id, dt.status, dt.priority, 
                       dt.start_date, dt.due_date, p.name as project_name, p.code as project_code,
                       COALESCE(ta.employee_id, dt.assignee_id) as employee_id
                FROM dynamic_tasks dt
                LEFT JOIN task_assignees ta ON dt.id = ta.task_id
                LEFT JOIN projects p ON dt.project_id = p.id
                WHERE dt.status NOT IN ('COMPLETED', 'CANCELLED')
                  AND (ta.employee_id IS NOT NULL OR dt.assignee_id IS NOT NULL)
                ORDER BY dt.due_date ASC, dt.id ASC
            """
            cursor.execute(query)
            rows = cursor.fetchall()
            cursor.close()
            conn.close()

            today_str = datetime.now().strftime("%Y-%m-%d")

            emp_tasks: Dict[int, List[Dict[str, Any]]] = {}
            for r in rows:
                emp_id = r.get('employee_id')
                if not emp_id:
                    continue
                try:
                    emp_id = int(emp_id)
                except (ValueError, TypeError):
                    continue

                if emp_id not in emp_tasks:
                    emp_tasks[emp_id] = []

                due_str = None
                if r.get('due_date'):
                    due_str = r['due_date'].isoformat() if hasattr(r['due_date'], 'isoformat') else str(r['due_date'])

                start_str = None
                if r.get('start_date'):
                    start_str = r['start_date'].isoformat() if hasattr(r['start_date'], 'isoformat') else str(r['start_date'])

                is_overdue = False
                if due_str and due_str.split('T')[0] < today_str:
                    is_overdue = True

                emp_tasks[emp_id].append({
                    "id": r['id'],
                    "title": r['title'],
                    "project_id": r['project_id'],
                    "project_name": r.get('project_name') or 'Project',
                    "project_code": r.get('project_code') or '',
                    "status": r.get('status', 'TODO'),
                    "priority": r.get('priority', 'Medium'),
                    "start_date": start_str,
                    "due_date": due_str,
                    "is_overdue": is_overdue
                })

            for emp in employees:
                e_id = emp['id']
                tasks = emp_tasks.get(e_id, [])
                emp['active_task_count'] = len(tasks)
                emp['in_progress_count'] = sum(1 for t in tasks if t['status'] == 'IN_PROGRESS')
                emp['overdue_task_count'] = sum(1 for t in tasks if t['is_overdue'])

                start_dates = [t['start_date'].split('T')[0] for t in tasks if t.get('start_date')]
                due_dates = [t['due_date'].split('T')[0] for t in tasks if t.get('due_date')]

                if tasks:
                    emp['engaged_from'] = min(start_dates) if start_dates else (min(due_dates) if due_dates else None)
                    emp['engaged_until'] = max(due_dates) if due_dates else (max(start_dates) if start_dates else None)
                    emp['next_available_date'] = emp['engaged_until']
                else:
                    emp['engaged_from'] = None
                    emp['engaged_until'] = None
                    emp['next_available_date'] = None

                # Keep up to 8 tasks for quick peek
                emp['active_tasks'] = tasks[:8]

        except Exception as e:
            print(f"Error enriching employees with workload: {e}", file=sys.stderr)
            for emp in employees:
                emp['active_task_count'] = 0
                emp['in_progress_count'] = 0
                emp['overdue_task_count'] = 0
                emp['engaged_from'] = None
                emp['engaged_until'] = None
                emp['next_available_date'] = None
                emp['active_tasks'] = []

        return employees

    @staticmethod
    def add_employee(employee: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        username = employee.get("username")
        password = employee.get("password")
        hashed_pw = None
        if password:
            pwd_bytes = password.encode('utf-8')
            salt = bcrypt.gensalt()
            hashed_pw = bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')
            
        query = """
            INSERT INTO employees (name, role, phone, email, department, username, password_hash)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            employee.get("name"), employee.get("role"), employee.get("phone"),
            employee.get("email"), employee.get("department"), username, hashed_pw
        )
        cursor.execute(query, values)
        conn.commit()
        employee["id"] = cursor.lastrowid
        employee["created_at"] = datetime.now().isoformat()
        if "password" in employee:
            del employee["password"]
        cursor.close()
        conn.close()
        return employee

    @staticmethod
    def update_employee(emp_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        updates = []
        values = []
        for key in ["name", "role", "phone", "email", "department", "username"]:
            if key in data:
                updates.append(f"{key} = %s")
                values.append(data[key])
                
        if "password" in data and data["password"]:
            pwd_bytes = data["password"].encode('utf-8')
            salt = bcrypt.gensalt()
            hashed_pw = bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')
            updates.append("password_hash = %s")
            values.append(hashed_pw)
                
        if not updates:
            return data
            
        values.append(emp_id)
        query = f"UPDATE employees SET {', '.join(updates)} WHERE id = %s"
        cursor.execute(query, values)
        conn.commit()
        
        cursor.execute("SELECT id, name, role, phone, email, department, username, created_at FROM employees WHERE id = %s", (emp_id,))
        emp = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if emp and emp.get('created_at'):
            emp['created_at'] = emp['created_at'].isoformat()
        return emp

    @staticmethod
    def delete_employee(emp_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("DELETE FROM employees WHERE id = %s", (emp_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def update_user_heartbeat(user_id: int, presence_status: Optional[str] = None, status_message: Optional[str] = None) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor()
        if presence_status and status_message is not None:
            cursor.execute("UPDATE employees SET last_seen_at = NOW(), presence_status = %s, status_message = %s WHERE id = %s", (presence_status, status_message, user_id))
        elif presence_status:
            cursor.execute("UPDATE employees SET last_seen_at = NOW(), presence_status = %s WHERE id = %s", (presence_status, user_id))
        elif status_message is not None:
            cursor.execute("UPDATE employees SET last_seen_at = NOW(), status_message = %s WHERE id = %s", (status_message, user_id))
        else:
            # If offline, wake to online; if already away or busy, keep that status
            cursor.execute("UPDATE employees SET last_seen_at = NOW(), presence_status = IF(presence_status = 'offline', 'online', presence_status) WHERE id = %s", (user_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def update_user_presence(user_id: int, presence_status: str, status_message: Optional[str] = None) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor()
        if status_message is not None:
            cursor.execute("UPDATE employees SET presence_status = %s, status_message = %s, last_seen_at = NOW() WHERE id = %s", (presence_status, status_message, user_id))
        else:
            cursor.execute("UPDATE employees SET presence_status = %s, last_seen_at = NOW() WHERE id = %s", (presence_status, user_id))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def set_user_offline(user_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE employees SET presence_status = 'offline', last_seen_at = NOW() WHERE id = %s", (user_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, name, role, username, password_hash, email, department,
                   last_login_at, last_seen_at, presence_status, status_message
            FROM employees WHERE username = %s
        """, (username,))
        user = cursor.fetchone()
        
        if user and user.get("password_hash"):
            # Check password
            if bcrypt.checkpw(password.encode('utf-8'), user["password_hash"].encode('utf-8')):
                del user["password_hash"]
                # Update last_login_at and set to online
                update_cursor = conn.cursor()
                update_cursor.execute("""
                    UPDATE employees 
                    SET last_login_at = NOW(), last_seen_at = NOW(), presence_status = 'online' 
                    WHERE id = %s
                """, (user["id"],))
                conn.commit()
                update_cursor.close()
                cursor.close()
                conn.close()

                user["last_login_at"] = datetime.now().isoformat()
                user["last_seen_at"] = datetime.now().isoformat()
                user["presence_status"] = "online"
                user["computed_status"] = "online"
                return user

        cursor.close()
        conn.close()
        return None

    # PROJECTS METHODS
    @staticmethod
    def get_projects(page: int = 1, limit: int = 100, search: Optional[str] = None, status: Optional[str] = None, parent_id: Optional[int] = None, root_only: bool = False, current_user: Optional[Dict[str, Any]] = None, category: Optional[str] = None) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        where_clauses = ["p.deleted_at IS NULL"]
        params = []

        # Apply project access restriction feature
        inv_sql, inv_params = Features.get_project_involvement_condition(current_user)
        if inv_sql != "1=1":
            where_clauses.append(inv_sql)
            params.extend(inv_params)

        if search:
            where_clauses.append("(p.name LIKE %s OR p.code LIKE %s OR p.client_name LIKE %s)")
            params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

        if status and status != 'All':
            where_clauses.append("p.status = %s")
            params.append(status)

        if category and category != 'All':
            if category == 'STANDARD':
                where_clauses.append("(p.category = 'STANDARD' OR p.category IS NULL)")
            else:
                where_clauses.append("p.category = %s")
                params.append(category)

        if parent_id is not None:
            where_clauses.append("p.parent_id = %s")
            params.append(parent_id)
        elif root_only:
            where_clauses.append("p.parent_id IS NULL")

        where_str = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        # Count total
        cursor.execute(f"SELECT COUNT(*) as total FROM projects p {where_str}", tuple(params))
        total = cursor.fetchone()["total"]

        offset = (page - 1) * limit
        params.extend([limit, offset])

        cursor.execute(f"""
            SELECT p.*,
                parent_proj.name as parent_name,
                parent_proj.client_name as parent_client_name,
                (SELECT COUNT(*) FROM projects sub_p WHERE sub_p.parent_id = p.id) as sub_projects_count,
                (SELECT COUNT(*) FROM dynamic_tasks dt WHERE dt.project_id = p.id) as total_dynamic_tasks,
                (SELECT COUNT(*) FROM dynamic_tasks dt WHERE dt.project_id = p.id AND dt.status = 'COMPLETED') as completed_dynamic_tasks,
                (SELECT COUNT(*) FROM project_tasks pt WHERE pt.project_id = p.id) as total_static_tasks,
                (
                    SELECT COUNT(DISTINCT pt.task_name) 
                    FROM project_tasks pt 
                    INNER JOIN project_files pf ON pt.project_id = pf.project_id AND pt.task_name = pf.task_name
                    WHERE pt.project_id = p.id
                ) as completed_static_tasks
            FROM projects p 
            LEFT JOIN projects parent_proj ON p.parent_id = parent_proj.id
            {where_str}
            ORDER BY p.id DESC
            LIMIT %s OFFSET %s
        """, tuple(params))
        projects = cursor.fetchall()
        cursor.close()
        conn.close()
        for p in projects:
            if p.get('created_at'):
                p['created_at'] = p['created_at'].isoformat()
            if p.get('parent_id') and p.get('parent_client_name'):
                p['client_name'] = p.get('parent_client_name')
            p.pop('parent_client_name', None)
            
            if p.get('start_date') and hasattr(p['start_date'], 'isoformat'):
                p['start_date'] = p['start_date'].isoformat()
            if p.get('end_date') and hasattr(p['end_date'], 'isoformat'):
                p['end_date'] = p['end_date'].isoformat()
            if p.get('date_of_delivery') and hasattr(p['date_of_delivery'], 'isoformat'):
                p['date_of_delivery'] = p['date_of_delivery'].isoformat()
            
            # boolean conversion
            for k in ['has_software', 'has_firmware', 'has_transformer', 'is_parent', 'is_template']:
                if k in p:
                    p[k] = bool(p[k])
            p['category'] = p.get('category') or 'STANDARD'
                    
            # Calculate completion percentage
            total_tasks = p.get('total_dynamic_tasks', 0) + p.get('total_static_tasks', 0)
            completed_tasks = p.get('completed_dynamic_tasks', 0) + p.get('completed_static_tasks', 0)
            
            if total_tasks > 0:
                p['completion_percentage'] = int((completed_tasks / total_tasks) * 100)
            else:
                p['completion_percentage'] = 100 if p.get('status') == 'COMPLETED' else 0

        return {
            "data": projects,
            "total": total,
            "page": page,
            "limit": limit
        }

    @staticmethod
    def get_all_projects_unpaginated(current_user: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        where_clauses = ["p.deleted_at IS NULL"]
        params = []

        inv_sql, inv_params = Features.get_project_involvement_condition(current_user)
        if inv_sql != "1=1":
            where_clauses.append(inv_sql)
            params.extend(inv_params)

        where_str = " WHERE " + " AND ".join(where_clauses)
        cursor.execute(f"""
            SELECT p.*, parent_proj.name as parent_name, parent_proj.client_name as parent_client_name
            FROM projects p
            LEFT JOIN projects parent_proj ON p.parent_id = parent_proj.id
            {where_str}
        """, tuple(params))
        projects = cursor.fetchall()
        cursor.close()
        conn.close()
        for p in projects:
            if p.get('parent_id') and p.get('parent_client_name'):
                p['client_name'] = p.get('parent_client_name')
            p.pop('parent_client_name', None)
            for k in ['has_software', 'has_firmware', 'has_transformer', 'is_parent', 'is_template']:
                if k in p:
                    p[k] = bool(p[k])
            p['category'] = p.get('category') or 'STANDARD'
        return projects

    @staticmethod
    def get_all_project_codes() -> List[str]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT code FROM projects WHERE code IS NOT NULL")
        codes = [row[0] for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        return codes

    @staticmethod
    def add_project(project: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("SHOW COLUMNS FROM projects")
            existing_cols = {row['Field'] for row in cursor.fetchall()}

            field_mapping = {
                "code": project.get("code"),
                "name": project.get("name"),
                "po_number": project.get("po_number"),
                "client_name": project.get("client_name"),
                "description": project.get("description"),
                "status": project.get("status", "PLANNING"),
                "start_date": project.get("start_date") or None,
                "end_date": project.get("end_date") or None,
                "project_incharge": project.get("project_incharge"),
                "has_software": 1 if project.get("has_software") else 0,
                "has_firmware": 1 if project.get("has_firmware") else 0,
                "has_transformer": 1 if project.get("has_transformer") else 0,
                "no_of_panels": project.get("no_of_panels", 1),
                "folder_path": project.get("folder_path"),
                "date_of_delivery": project.get("date_of_delivery") or None,
                "parent_id": project.get("parent_id") or None,
                "is_parent": 1 if project.get("is_parent") else 0,
                "is_template": 1 if project.get("is_template") else 0,
                "category": project.get("category") or "STANDARD",
                "milestone": project.get("milestone")
            }

            insert_cols = [c for c in field_mapping.keys() if c in existing_cols]
            insert_vals = [field_mapping[c] for c in insert_cols]
            placeholders = ["%s"] * len(insert_cols)

            query = f"INSERT INTO projects ({', '.join(insert_cols)}) VALUES ({', '.join(placeholders)})"
            cursor.execute(query, tuple(insert_vals))
            conn.commit()
            project["id"] = cursor.lastrowid
            project["category"] = project.get("category") or "STANDARD"
            project["created_at"] = datetime.now().isoformat()
            return project
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def update_project(proj_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        updates = []
        values = []
        for key in ["code", "name", "po_number", "client_name", "description", "status", "start_date", "end_date", "project_incharge", "no_of_panels", "folder_path", "date_of_delivery", "parent_id", "category", "milestone"]:
            if key in data:
                updates.append(f"{key} = %s")
                if key in ["start_date", "end_date", "date_of_delivery", "parent_id"] and not data[key]:
                    values.append(None)
                else:
                    values.append(data[key])
                    
        for key in ["has_software", "has_firmware", "has_transformer", "is_parent", "is_template"]:
            if key in data:
                updates.append(f"{key} = %s")
                values.append(1 if data[key] else 0)
                    
        if not updates:
            return data
            
        values.append(proj_id)
        query = f"UPDATE projects SET {', '.join(updates)} WHERE id = %s"
        cursor.execute(query, values)
        conn.commit()
        
        cursor.execute("SELECT * FROM projects WHERE id = %s", (proj_id,))
        p = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if p:
            if p.get('created_at'):
                p['created_at'] = p['created_at'].isoformat()
            if p.get('start_date') and hasattr(p['start_date'], 'isoformat'):
                p['start_date'] = p['start_date'].isoformat()
            if p.get('end_date') and hasattr(p['end_date'], 'isoformat'):
                p['end_date'] = p['end_date'].isoformat()
            if p.get('date_of_delivery') and hasattr(p['date_of_delivery'], 'isoformat'):
                p['date_of_delivery'] = p['date_of_delivery'].isoformat()
            for k in ['has_software', 'has_firmware', 'has_transformer', 'is_parent', 'is_template']:
                if k in p:
                    p[k] = bool(p[k])
            p['category'] = p.get('category') or 'STANDARD'
        return p

    @staticmethod
    def delete_project(proj_id: int, delete_subprojects: bool = False) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        if delete_subprojects:
            cursor.execute("UPDATE projects SET deleted_at = CURRENT_TIMESTAMP WHERE parent_id = %s", (proj_id,))
            
        cursor.execute("UPDATE projects SET deleted_at = CURRENT_TIMESTAMP WHERE id = %s", (proj_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def force_delete_project(proj_id: int, delete_subprojects: bool = False) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        if delete_subprojects:
            cursor.execute("DELETE FROM projects WHERE parent_id = %s", (proj_id,))
        else:
            cursor.execute("UPDATE projects SET parent_id = NULL WHERE parent_id = %s", (proj_id,))
            
        cursor.execute("DELETE FROM projects WHERE id = %s", (proj_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def get_deleted_projects() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM projects WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
        projects = cursor.fetchall()
        cursor.close()
        conn.close()
        for p in projects:
            if p.get('created_at'):
                p['created_at'] = p['created_at'].isoformat()
            if p.get('deleted_at'):
                p['deleted_at'] = p['deleted_at'].isoformat()
        return projects

    @staticmethod
    def restore_project(proj_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("UPDATE projects SET deleted_at = NULL WHERE id = %s", (proj_id,))
        
        # also restore subprojects if any
        cursor.execute("UPDATE projects SET deleted_at = NULL WHERE parent_id = %s", (proj_id,))
        
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def cleanup_recycle_bin(days: int = 30) -> None:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Delete projects where deleted_at is older than 30 days
        cursor.execute("DELETE FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL %s DAY", (days,))
        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def get_project_tasks(project_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM project_tasks WHERE project_id = %s", (project_id,))
        tasks = cursor.fetchall()
        cursor.close()
        conn.close()
        for t in tasks:
            if t.get('created_at'):
                t['created_at'] = t['created_at'].isoformat()
        return tasks

    @staticmethod
    def get_project_files(project_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM project_files WHERE project_id = %s", (project_id,))
        files = cursor.fetchall()
        cursor.close()
        conn.close()
        for f in files:
            if f.get('uploaded_at'):
                f['uploaded_at'] = f['uploaded_at'].isoformat()
        return files

    @staticmethod
    def add_project_task(project_id: int, task_name: str, status: str = 'PENDING') -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "INSERT INTO project_tasks (project_id, task_name, status) VALUES (%s, %s, %s)",
            (project_id, task_name, status)
        )
        conn.commit()
        task_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return {"id": task_id, "project_id": project_id, "task_name": task_name, "status": status}
        
    @staticmethod
    def update_project_task(project_id: int, task_name: str, status: str) -> None:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "UPDATE project_tasks SET status = %s WHERE project_id = %s AND task_name = %s",
            (status, project_id, task_name)
        )
        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def add_project_file(project_id: int, task_name: str, file_name: str, file_path: str) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "INSERT INTO project_files (project_id, task_name, file_name, file_path) VALUES (%s, %s, %s, %s)",
            (project_id, task_name, file_name, file_path)
        )
        conn.commit()
        file_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return {"id": file_id, "project_id": project_id, "task_name": task_name, "file_name": file_name, "file_path": file_path}

    @staticmethod
    def get_project_file(file_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM project_files WHERE id = %s", (file_id,))
        file_record = cursor.fetchone()
        cursor.close()
        conn.close()
        if file_record and file_record.get('uploaded_at'):
            file_record['uploaded_at'] = file_record['uploaded_at'].isoformat()
        return file_record

    @staticmethod
    def delete_project_file(file_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("DELETE FROM project_files WHERE id = %s", (file_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def _enrich_task_assignees(cursor, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not tasks:
            return tasks
        task_ids = [t['id'] for t in tasks]
        format_strings = ','.join(['%s'] * len(task_ids))
        cursor.execute(f"""
            SELECT ta.task_id, ta.employee_id, e.name as employee_name, e.role as employee_role
            FROM task_assignees ta
            JOIN employees e ON ta.employee_id = e.id
            WHERE ta.task_id IN ({format_strings})
        """, tuple(task_ids))
        assignee_rows = cursor.fetchall()
        
        assignees_map = {}
        for row in assignee_rows:
            tid = row['task_id']
            if tid not in assignees_map:
                assignees_map[tid] = []
            assignees_map[tid].append({
                "id": row['employee_id'],
                "name": row['employee_name'],
                "role": row['employee_role']
            })

        for t in tasks:
            tid = t['id']
            assigned_list = assignees_map.get(tid, [])
            if not assigned_list and t.get('assignee_id'):
                if t.get('assignee_name'):
                    assigned_list = [{
                        "id": t['assignee_id'],
                        "name": t['assignee_name'],
                        "role": t.get('assignee_role', 'Employee')
                    }]
            t['assignees'] = assigned_list
            t['assignee_ids'] = [a['id'] for a in assigned_list]
            if assigned_list:
                t['assignee_id'] = assigned_list[0]['id']
                t['assignee_name'] = ", ".join([a['name'] for a in assigned_list])
                t['assignee_role'] = assigned_list[0]['role']
            else:
                t['assignee_name'] = t.get('assignee_name') or 'Unassigned'

        return tasks

    @staticmethod
    def get_dynamic_tasks(project_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT t.*, e.name as assignee_name, e.role as assignee_role, p.name as project_name,
                   COALESCE(NULLIF(p.client_name, ''), parent_p.client_name) as client_name,
                   COALESCE(NULLIF(p.client_name, ''), parent_p.client_name) as customer_name,
                   (SELECT COUNT(*) FROM task_comments c WHERE c.task_id = t.id) as comment_count
            FROM dynamic_tasks t
            LEFT JOIN employees e ON t.assignee_id = e.id
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN projects parent_p ON p.parent_id = parent_p.id
            WHERE t.project_id = %s
            ORDER BY t.sort_order ASC, t.id ASC
        """, (project_id,))
        tasks = cursor.fetchall()
        DBStore._enrich_task_assignees(cursor, tasks)
        cursor.close()
        conn.close()
        for t in tasks:
            if t.get('created_at'):
                t['created_at'] = t['created_at'].isoformat()
            if t.get('updated_at'):
                t['updated_at'] = t['updated_at'].isoformat()
            if t.get('completed_at'):
                t['completed_at'] = t['completed_at'].isoformat()
            if t.get('start_date') and hasattr(t['start_date'], 'isoformat'):
                t['start_date'] = t['start_date'].isoformat()
            if t.get('due_date') and hasattr(t['due_date'], 'isoformat'):
                t['due_date'] = t['due_date'].isoformat()
        return tasks

    @staticmethod
    def get_all_dynamic_tasks() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT dt.*, e.name as assignee_name, e.role as assignee_role, p.name as project_name, p.code as project_code,
                   COALESCE(NULLIF(p.client_name, ''), parent_p.client_name) as client_name,
                   COALESCE(NULLIF(p.client_name, ''), parent_p.client_name) as customer_name,
                   (SELECT COUNT(*) FROM task_comments c WHERE c.task_id = dt.id) as comment_count
            FROM dynamic_tasks dt
            LEFT JOIN employees e ON dt.assignee_id = e.id
            LEFT JOIN projects p ON dt.project_id = p.id
            LEFT JOIN projects parent_p ON p.parent_id = parent_p.id
            ORDER BY dt.sort_order ASC, dt.id ASC
        """
        cursor.execute(query)
        tasks = cursor.fetchall()
        DBStore._enrich_task_assignees(cursor, tasks)
        cursor.close()
        conn.close()
        for t in tasks:
            if t.get('created_at'):
                t['created_at'] = t['created_at'].isoformat()
            if t.get('updated_at'):
                t['updated_at'] = t['updated_at'].isoformat()
            if t.get('completed_at'):
                t['completed_at'] = t['completed_at'].isoformat()
            if t.get('start_date') and hasattr(t['start_date'], 'isoformat'):
                t['start_date'] = t['start_date'].isoformat()
            if t.get('due_date') and hasattr(t['due_date'], 'isoformat'):
                t['due_date'] = t['due_date'].isoformat()
        return tasks

    @staticmethod
    def get_task_comments(task_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT c.*, e.name as user_name, e.role as user_role, e.email as user_email
            FROM task_comments c
            LEFT JOIN employees e ON c.user_id = e.id
            WHERE c.task_id = %s
            ORDER BY c.created_at ASC
        """, (task_id,))
        comments = cursor.fetchall()
        cursor.close()
        conn.close()
        for c in comments:
            if c.get('created_at'):
                c['created_at'] = c['created_at'].isoformat()
            if c.get('updated_at'):
                c['updated_at'] = c['updated_at'].isoformat()
        return comments

    @staticmethod
    def add_task_comment(task_id: int, user_id: Optional[int], content: str) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "INSERT INTO task_comments (task_id, user_id, content) VALUES (%s, %s, %s)",
            (task_id, user_id, content)
        )
        conn.commit()
        comment_id = cursor.lastrowid
        cursor.execute("""
            SELECT c.*, e.name as user_name, e.role as user_role, e.email as user_email
            FROM task_comments c
            LEFT JOIN employees e ON c.user_id = e.id
            WHERE c.id = %s
        """, (comment_id,))
        comment = cursor.fetchone()
        cursor.close()
        conn.close()
        if comment:
            if comment.get('created_at'):
                comment['created_at'] = comment['created_at'].isoformat()
            if comment.get('updated_at'):
                comment['updated_at'] = comment['updated_at'].isoformat()
        return comment

    @staticmethod
    def delete_task_comment(comment_id: int, user_id: Optional[int] = None) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor()
        if user_id:
            cursor.execute("DELETE FROM task_comments WHERE id = %s AND user_id = %s", (comment_id, user_id))
        else:
            cursor.execute("DELETE FROM task_comments WHERE id = %s", (comment_id,))
        conn.commit()
        affected = cursor.rowcount
        cursor.close()
        conn.close()
        return affected > 0

    @staticmethod
    def add_dynamic_task(project_id: int, task: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        assignee_ids = task.get("assignee_ids") or []
        primary_assignee_id = task.get("assignee_id")
        if not primary_assignee_id and assignee_ids:
            primary_assignee_id = assignee_ids[0]
        elif primary_assignee_id and primary_assignee_id not in assignee_ids:
            assignee_ids.append(primary_assignee_id)

        sort_order = task.get("sort_order")
        if sort_order is None:
            cursor.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM dynamic_tasks WHERE project_id = %s", (project_id,))
            row = cursor.fetchone()
            sort_order = row["next_order"] if row and row.get("next_order") is not None else 0

        completed_at = task.get("completed_at")
        if not completed_at and task.get("status") == "COMPLETED":
            from datetime import datetime
            completed_at = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

        query = """
            INSERT INTO dynamic_tasks (project_id, parent_id, title, description, status, priority, assignee_id, start_date, due_date, completed_at, dependencies, sort_order)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            project_id,
            task.get("parent_id") or None,
            task.get("title"),
            task.get("description") or None,
            task.get("status", "TODO"),
            task.get("priority", "MEDIUM"),
            primary_assignee_id or None,
            task.get("start_date") or None,
            task.get("due_date") or None,
            completed_at or None,
            task.get("dependencies") or None,
            sort_order
        )
        cursor.execute(query, values)
        task_id = cursor.lastrowid

        for emp_id in assignee_ids:
            if emp_id:
                cursor.execute("INSERT IGNORE INTO task_assignees (task_id, employee_id) VALUES (%s, %s)", (task_id, emp_id))

        conn.commit()
        
        cursor.execute("""
            SELECT t.*, e.name as assignee_name, e.role as assignee_role, p.name as project_name,
                   COALESCE(NULLIF(p.client_name, ''), parent_p.client_name) as client_name,
                   COALESCE(NULLIF(p.client_name, ''), parent_p.client_name) as customer_name
            FROM dynamic_tasks t
            LEFT JOIN employees e ON t.assignee_id = e.id
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN projects parent_p ON p.parent_id = parent_p.id
            WHERE t.id = %s
        """, (task_id,))
        created_task_list = cursor.fetchall()
        DBStore._enrich_task_assignees(cursor, created_task_list)
        cursor.close()
        conn.close()
        t = created_task_list[0] if created_task_list else task
        if t:
            if t.get('created_at') and hasattr(t['created_at'], 'isoformat'):
                t['created_at'] = t['created_at'].isoformat()
            if t.get('updated_at') and hasattr(t['updated_at'], 'isoformat'):
                t['updated_at'] = t['updated_at'].isoformat()
            if t.get('completed_at') and hasattr(t['completed_at'], 'isoformat'):
                t['completed_at'] = t['completed_at'].isoformat()
            if t.get('start_date') and hasattr(t['start_date'], 'isoformat'):
                t['start_date'] = t['start_date'].isoformat()
            if t.get('due_date') and hasattr(t['due_date'], 'isoformat'):
                t['due_date'] = t['due_date'].isoformat()
        return t

    @staticmethod
    def update_dynamic_task(task_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        assignee_ids = data.get("assignee_ids")
        if assignee_ids is not None:
            primary_assignee_id = assignee_ids[0] if len(assignee_ids) > 0 else None
            data["assignee_id"] = primary_assignee_id
            cursor.execute("DELETE FROM task_assignees WHERE task_id = %s", (task_id,))
            for emp_id in assignee_ids:
                if emp_id:
                    cursor.execute("INSERT IGNORE INTO task_assignees (task_id, employee_id) VALUES (%s, %s)", (task_id, emp_id))

        updates = []
        values = []
        fields = ["parent_id", "title", "description", "status", "priority", "assignee_id", "start_date", "due_date", "dependencies", "sort_order"]
        for key in fields:
            if key in data:
                updates.append(f"{key} = %s")
                if key in ["parent_id", "assignee_id", "start_date", "due_date", "dependencies"] and not data[key]:
                    values.append(None)
                else:
                    values.append(data[key])
                    
        if "completed_at" in data:
            updates.append("completed_at = %s")
            values.append(data["completed_at"] or None)
        elif "status" in data:
            if data["status"] == "COMPLETED":
                updates.append("completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)")
            else:
                updates.append("completed_at = NULL")
                    
        if updates:
            values.append(task_id)
            query = f"UPDATE dynamic_tasks SET {', '.join(updates)} WHERE id = %s"
            cursor.execute(query, values)
            
        conn.commit()
        
        cursor.execute("""
            SELECT t.*, e.name as assignee_name, e.role as assignee_role, p.name as project_name,
                   COALESCE(NULLIF(p.client_name, ''), parent_p.client_name) as client_name,
                   COALESCE(NULLIF(p.client_name, ''), parent_p.client_name) as customer_name
            FROM dynamic_tasks t
            LEFT JOIN employees e ON t.assignee_id = e.id
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN projects parent_p ON p.parent_id = parent_p.id
            WHERE t.id = %s
        """, (task_id,))
        updated_task_list = cursor.fetchall()
        DBStore._enrich_task_assignees(cursor, updated_task_list)
        cursor.close()
        conn.close()
        
        t = updated_task_list[0] if updated_task_list else None
        if t:
            if t.get('created_at'):
                t['created_at'] = t['created_at'].isoformat()
            if t.get('updated_at'):
                t['updated_at'] = t['updated_at'].isoformat()
            if t.get('completed_at'):
                t['completed_at'] = t['completed_at'].isoformat()
            if t.get('start_date') and hasattr(t['start_date'], 'isoformat'):
                t['start_date'] = t['start_date'].isoformat()
            if t.get('due_date') and hasattr(t['due_date'], 'isoformat'):
                t['due_date'] = t['due_date'].isoformat()
        return t

    @staticmethod
    def delete_dynamic_task(task_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("DELETE FROM dynamic_tasks WHERE id = %s", (task_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    # BOM METHODS
    @staticmethod
    def get_boms(project_id: Optional[int] = None, is_template: Optional[bool] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        base_query = """
            SELECT b.*, p.name as project_name, p.code as project_code,
                   (SELECT COUNT(*) FROM bom_items bi WHERE bi.bom_id = b.id) as total_items,
                   (SELECT COUNT(*) FROM bom_items bi WHERE bi.bom_id = b.id AND bi.procurement_status = 'ORDERED') as ordered_count,
                   (SELECT COUNT(*) FROM bom_items bi WHERE bi.bom_id = b.id AND bi.procurement_status = 'DELIVERED') as delivered_count,
                   (SELECT COUNT(*) FROM bom_items bi WHERE bi.bom_id = b.id AND COALESCE(bi.procurement_status, 'YET_TO_ORDER') = 'YET_TO_ORDER') as yet_to_order_count
            FROM boms b
            LEFT JOIN projects p ON b.project_id = p.id
            WHERE 1=1
        """
        params = []
        if project_id:
            base_query += " AND b.project_id = %s"
            params.append(project_id)
        if is_template is not None:
            base_query += " AND b.is_template = %s"
            params.append(is_template)

        cursor.execute(base_query + " ORDER BY b.id DESC", tuple(params))
        boms = cursor.fetchall()
        cursor.close()
        conn.close()
        for b in boms:
            b['is_template'] = bool(b.get('is_template'))
            b['is_reserved'] = bool(b.get('is_reserved'))
            b['revision'] = b.get('revision') or 'A'
            b['root_bom_id'] = b.get('root_bom_id') or b['id']
            if b.get('created_at') and hasattr(b['created_at'], 'isoformat'):
                b['created_at'] = b['created_at'].isoformat()
            if b.get('updated_at') and hasattr(b['updated_at'], 'isoformat'):
                b['updated_at'] = b['updated_at'].isoformat()
            if b.get('issued_at') and hasattr(b['issued_at'], 'isoformat'):
                b['issued_at'] = b['issued_at'].isoformat()
            if b.get('target_delivery_date') and hasattr(b['target_delivery_date'], 'isoformat'):
                b['target_delivery_date'] = b['target_delivery_date'].isoformat()
        return boms

    @staticmethod
    def create_bom(
        project_id: Optional[int],
        name: str,
        items: List[Dict[str, Any]],
        status: str = 'DRAFT',
        customer_name: Optional[str] = None,
        issued_at: Optional[str] = None,
        target_delivery_date: Optional[str] = None,
        is_template: bool = False,
        template_category: Optional[str] = None,
        revision: str = 'A',
        root_bom_id: Optional[int] = None,
        parent_bom_id: Optional[int] = None,
        eco_id: Optional[int] = None
    ) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        effective_issued_at = issued_at
        if not effective_issued_at and status in ('APPROVED', 'ISSUED', 'COMPLETED'):
            effective_issued_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        cursor.execute("""
            INSERT INTO boms (
                project_id, name, status, customer_name, issued_at, target_delivery_date,
                is_template, template_category, revision, root_bom_id, parent_bom_id, eco_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            project_id if project_id else None,
            name,
            status,
            customer_name,
            effective_issued_at,
            target_delivery_date or None,
            is_template,
            template_category,
            revision or 'A',
            root_bom_id,
            parent_bom_id,
            eco_id
        ))
        bom_id = cursor.lastrowid
        if not root_bom_id:
            cursor.execute("UPDATE boms SET root_bom_id = %s WHERE id = %s", (bom_id, bom_id))
        
        for item in items:
            product_id = item.get("product_id")
            proc_status = item.get("procurement_status") or "YET_TO_ORDER"
            cursor.execute("""
                INSERT INTO bom_items (
                    bom_id, product_id, manual_product_name, part_number, manufacturer,
                    link, quantity_required, quantity_issued, unit_price, remarks,
                    custom_fields, procurement_status, ordered_date, expected_delivery_date, delivered_date,
                    parent_item_id, is_assembly, level
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                bom_id, 
                product_id if product_id else None,
                item.get("manual_product_name"),
                item.get("part_number"),
                item.get("manufacturer"),
                item.get("link"),
                item.get("quantity_required", 1), 
                0.00, 
                item.get("unit_price", 0.0) or 0.0,
                item.get("remarks", ""),
                json.dumps(item.get("custom_fields", {})),
                proc_status,
                item.get("ordered_date") or None,
                item.get("expected_delivery_date") or None,
                item.get("delivered_date") or None,
                item.get("parent_item_id") or None,
                bool(item.get("is_assembly", False)),
                item.get("level", 1)
            ))
            
        conn.commit()
        cursor.close()
        conn.close()
        return {"id": bom_id, "project_id": project_id, "name": name, "status": status, "revision": revision or 'A'}

    @staticmethod
    def get_bom_details(bom_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT b.*, p.name as project_name, p.code as project_code 
            FROM boms b
            LEFT JOIN projects p ON b.project_id = p.id
            WHERE b.id = %s
        """, (bom_id,))
        bom = cursor.fetchone()
        if not bom:
            cursor.close()
            conn.close()
            return None
            
        bom['is_template'] = bool(bom.get('is_template'))
        bom['is_reserved'] = bool(bom.get('is_reserved'))
        bom['revision'] = bom.get('revision') or 'A'
        bom['root_bom_id'] = bom.get('root_bom_id') or bom['id']

        if bom.get('created_at') and hasattr(bom['created_at'], 'isoformat'):
            bom['created_at'] = bom['created_at'].isoformat()
        if bom.get('updated_at') and hasattr(bom['updated_at'], 'isoformat'):
            bom['updated_at'] = bom['updated_at'].isoformat()
        if bom.get('issued_at') and hasattr(bom['issued_at'], 'isoformat'):
            bom['issued_at'] = bom['issued_at'].isoformat()
        if bom.get('target_delivery_date') and hasattr(bom['target_delivery_date'], 'isoformat'):
            bom['target_delivery_date'] = bom['target_delivery_date'].isoformat()
            
        cursor.execute("""
            SELECT bi.id, bi.bom_id, bi.product_id, bi.quantity_required, bi.quantity_issued, bi.remarks,
                   bi.manual_product_name, bi.part_number, bi.manufacturer, bi.link, bi.custom_fields,
                   bi.unit_price, bi.procurement_status, bi.ordered_date, bi.expected_delivery_date, bi.delivered_date,
                   bi.parent_item_id, bi.is_assembly, bi.level,
                   p.name as product_name, p.code as product_code, p.unit as product_unit,
                   COALESCE((SELECT SUM(quantity) FROM product_locations WHERE product_id = bi.product_id), 0.00) as current_stock,
                   (
                       SELECT COALESCE(SUM(GREATEST(0, other_bi.quantity_required - other_bi.quantity_issued)), 0)
                       FROM bom_items other_bi
                       JOIN boms other_b ON other_bi.bom_id = other_b.id
                       WHERE other_bi.product_id = bi.product_id AND (other_b.status = 'APPROVED' OR other_b.is_reserved = TRUE)
                   ) as total_reserved_stock
            FROM bom_items bi
            LEFT JOIN products p ON bi.product_id = p.id
            WHERE bi.bom_id = %s
            ORDER BY bi.level ASC, bi.id ASC
        """, (bom_id,))
        items = cursor.fetchall()
        for item in items:
            item["quantity_required"] = float(item["quantity_required"] or 0)
            item["quantity_issued"] = float(item["quantity_issued"] or 0)
            item["current_stock"] = float(item["current_stock"] or 0)
            item["unit_price"] = float(item.get("unit_price") or 0)
            item["procurement_status"] = item.get("procurement_status") or "YET_TO_ORDER"

            for d_col in ("ordered_date", "expected_delivery_date", "delivered_date"):
                if item.get(d_col) and hasattr(item[d_col], 'isoformat'):
                    item[d_col] = item[d_col].isoformat()
            
            if not item.get("product_id"):
                item["product_name"] = item.get("manual_product_name") or "Manual Item"
                item["product_code"] = "MANUAL"
                item["product_unit"] = "pcs"
            
            try:
                item["custom_fields"] = json.loads(item.get("custom_fields") or "{}")
            except:
                item["custom_fields"] = {}

            item["is_assembly"] = bool(item.get("is_assembly"))
            item["level"] = int(item.get("level") or 1)
            item["parent_item_id"] = item.get("parent_item_id")
            item["total_reserved_stock"] = float(item.get("total_reserved_stock") or 0)
            
        bom["items"] = items
        cursor.close()
        conn.close()
        return bom

    @staticmethod
    def update_bom_status(
        bom_id: int,
        status: str,
        issued_at: Optional[str] = None,
        target_delivery_date: Optional[str] = "__UNSET__"
    ) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        updates = ["status = %s"]
        params: List[Any] = [status]

        if issued_at:
            updates.append("issued_at = %s")
            params.append(issued_at)
        elif status in ('APPROVED', 'ISSUED', 'COMPLETED'):
            updates.append("issued_at = COALESCE(issued_at, CURRENT_TIMESTAMP)")

        if target_delivery_date != "__UNSET__":
            updates.append("target_delivery_date = %s")
            params.append(target_delivery_date or None)

        params.append(bom_id)
        cursor.execute(f"UPDATE boms SET {', '.join(updates)} WHERE id = %s", tuple(params))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def _sync_bom_completion_status(cursor, bom_id: int) -> None:
        cursor.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN procurement_status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered
            FROM bom_items
            WHERE bom_id = %s
        """, (bom_id,))
        stats = cursor.fetchone()
        total = int(stats["total"] or 0) if stats else 0
        delivered = int(stats["delivered"] or 0) if stats else 0

        cursor.execute("SELECT status FROM boms WHERE id = %s", (bom_id,))
        bom_row = cursor.fetchone()
        if not bom_row:
            return
        current_status = bom_row.get("status")

        if total > 0 and delivered == total:
            cursor.execute(
                "UPDATE boms SET status = 'COMPLETED', issued_at = COALESCE(issued_at, CURRENT_TIMESTAMP) WHERE id = %s",
                (bom_id,)
            )
        elif current_status == 'COMPLETED' and delivered < total:
            cursor.execute("UPDATE boms SET status = 'APPROVED' WHERE id = %s", (bom_id,))

    @staticmethod
    def update_bom_item_procurement(bom_id: int, item_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM bom_items WHERE id = %s AND bom_id = %s", (item_id, bom_id))
        existing = cursor.fetchone()
        if not existing:
            cursor.close()
            conn.close()
            return None

        status = data.get("procurement_status", existing.get("procurement_status") or "YET_TO_ORDER")
        today_str = datetime.now().strftime('%Y-%m-%d')

        ordered_date = data.get("ordered_date") if "ordered_date" in data else existing.get("ordered_date")
        expected_delivery_date = data.get("expected_delivery_date") if "expected_delivery_date" in data else existing.get("expected_delivery_date")
        delivered_date = data.get("delivered_date") if "delivered_date" in data else existing.get("delivered_date")
        remarks = data.get("remarks") if "remarks" in data else existing.get("remarks")

        if status == "YET_TO_ORDER":
            if "ordered_date" not in data:
                ordered_date = None
            if "expected_delivery_date" not in data:
                expected_delivery_date = None
            if "delivered_date" not in data:
                delivered_date = None
        elif status == "ORDERED":
            if not ordered_date:
                ordered_date = today_str
            if "delivered_date" not in data:
                delivered_date = None
        elif status == "DELIVERED":
            if not delivered_date:
                delivered_date = today_str

        cursor.execute("""
            UPDATE bom_items
            SET procurement_status = %s,
                ordered_date = %s,
                expected_delivery_date = %s,
                delivered_date = %s,
                remarks = %s
            WHERE id = %s AND bom_id = %s
        """, (
            status,
            ordered_date or None,
            expected_delivery_date or None,
            delivered_date or None,
            remarks,
            item_id,
            bom_id
        ))
        DBStore._sync_bom_completion_status(cursor, bom_id)
        conn.commit()
        cursor.close()
        conn.close()
        return DBStore.get_bom_details(bom_id)

    @staticmethod
    def bulk_update_bom_items_procurement(bom_id: int, item_ids: List[int], data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not item_ids:
            return DBStore.get_bom_details(bom_id)

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        status = data.get("procurement_status", "YET_TO_ORDER")
        today_str = datetime.now().strftime('%Y-%m-%d')

        placeholders = ", ".join(["%s"] * len(item_ids))
        cursor.execute(f"SELECT * FROM bom_items WHERE bom_id = %s AND id IN ({placeholders})", [bom_id, *item_ids])
        rows = cursor.fetchall()

        for row in rows:
            item_id = row["id"]
            ordered_date = data.get("ordered_date") if data.get("ordered_date") else row.get("ordered_date")
            expected_delivery_date = data.get("expected_delivery_date") if data.get("expected_delivery_date") else row.get("expected_delivery_date")
            delivered_date = data.get("delivered_date") if data.get("delivered_date") else row.get("delivered_date")

            if status == "YET_TO_ORDER":
                ordered_date = None
                expected_delivery_date = None
                delivered_date = None
            elif status == "ORDERED":
                if not ordered_date:
                    ordered_date = today_str
                delivered_date = None
            elif status == "DELIVERED":
                if not delivered_date:
                    delivered_date = today_str

            cursor.execute("""
                UPDATE bom_items
                SET procurement_status = %s,
                    ordered_date = %s,
                    expected_delivery_date = %s,
                    delivered_date = %s
                WHERE id = %s AND bom_id = %s
            """, (
                status,
                ordered_date or None,
                expected_delivery_date or None,
                delivered_date or None,
                item_id,
                bom_id
            ))

        DBStore._sync_bom_completion_status(cursor, bom_id)
        conn.commit()
        cursor.close()
        conn.close()
        return DBStore.get_bom_details(bom_id)

    @staticmethod
    def delete_bom(bom_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("DELETE FROM bom_items WHERE bom_id = %s", (bom_id,))
        cursor.execute("DELETE FROM boms WHERE id = %s", (bom_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def issue_bom_stock(bom_id: int, issuings: List[Dict[str, Any]], user_name: str, user_role: str) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        for issue in issuings:
            if not issue.get("product_id"):
                continue
            cursor.execute("SELECT quantity FROM product_locations WHERE product_id = %s AND location_id = %s", 
                           (issue["product_id"], issue["location_id"]))
            row = cursor.fetchone()
            current_qty = float(row["quantity"]) if row else 0.0
            if current_qty < issue["quantity"]:
                cursor.execute("SELECT name FROM products WHERE id = %s", (issue["product_id"],))
                p = cursor.fetchone()
                p_name = p["name"] if p else f"ID {issue['product_id']}"
                cursor.close()
                conn.close()
                raise ValueError(f"Insufficient stock for '{p_name}'. Available: {current_qty}, Requested: {issue['quantity']}.")
        
        detailed_items = []
        for issue in issuings:
            if issue.get("product_id") and issue.get("location_id"):
                DBStore.update_product_location(issue["product_id"], issue["location_id"], -issue["quantity"])
                
                cursor.execute("SELECT name, code FROM products WHERE id = %s", (issue["product_id"],))
                p = cursor.fetchone()
                
                cursor.execute("SELECT zone, rack, shelf, bin FROM locations WHERE id = %s", (issue["location_id"],))
                l = cursor.fetchone()
            else:
                p = None
                l = None
                
            cursor.execute("UPDATE bom_items SET quantity_issued = quantity_issued + %s WHERE id = %s", 
                           (issue["quantity"], issue["bom_item_id"]))
            
            cursor.execute("SELECT manual_product_name FROM bom_items WHERE id = %s", (issue["bom_item_id"],))
            manual_item = cursor.fetchone()
            
            detailed_items.append({
                "product_id": issue.get("product_id"),
                "product_name": p["name"] if p else (manual_item["manual_product_name"] if manual_item else "Service/Labour"),
                "product_code": p["code"] if p else "MANUAL",
                "location_id": issue.get("location_id"),
                "location_label": f"{l['zone']}-Rack {l['rack']}-Shelf {l['shelf']}-Bin {l['bin']}" if l else "N/A",
                "quantity": issue["quantity"],
                "remarks": f"Issued for BOM ID: {bom_id}"
            })
            
        total_qty = sum(issue["quantity"] for issue in issuings)
        cursor.execute("""
            INSERT INTO inventory_transactions (user_name, user_role, quantity, action, remarks)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_name, user_role, total_qty, 'STOCK_OUT', json.dumps(detailed_items)))
        
        conn.commit()
        cursor.close()
        conn.close()
        return {"success": True, "total_issued": total_qty}

    @staticmethod
    def add_bom_item(bom_id: int, item: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id FROM boms WHERE id = %s", (bom_id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            raise ValueError(f"BOM {bom_id} not found")

        product_id = item.get("product_id")
        proc_status = item.get("procurement_status") or "YET_TO_ORDER"
        parent_item_id = item.get("parent_item_id")
        is_assembly = bool(item.get("is_assembly", False))
        level = int(item.get("level", 1))

        cursor.execute("""
            INSERT INTO bom_items (
                bom_id, product_id, manual_product_name, part_number, manufacturer,
                link, quantity_required, quantity_issued, unit_price, remarks,
                custom_fields, procurement_status, ordered_date, expected_delivery_date, delivered_date,
                parent_item_id, is_assembly, level
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            bom_id,
            product_id if product_id else None,
            item.get("manual_product_name"),
            item.get("part_number"),
            item.get("manufacturer"),
            item.get("link"),
            item.get("quantity_required", 1),
            0.00,
            item.get("unit_price", 0.0) or 0.0,
            item.get("remarks", ""),
            json.dumps(item.get("custom_fields", {})),
            proc_status,
            item.get("ordered_date") or None,
            item.get("expected_delivery_date") or None,
            item.get("delivered_date") or None,
            parent_item_id if parent_item_id else None,
            is_assembly,
            level
        ))
        DBStore._sync_bom_completion_status(cursor, bom_id)
        conn.commit()
        cursor.close()
        conn.close()
        return DBStore.get_bom_details(bom_id)

    @staticmethod
    def update_bom_item(bom_id: int, item_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM bom_items WHERE id = %s AND bom_id = %s", (item_id, bom_id))
        existing = cursor.fetchone()
        if not existing:
            cursor.close()
            conn.close()
            return None

        allowed_fields = [
            'product_id', 'manual_product_name', 'part_number', 'manufacturer',
            'link', 'quantity_required', 'quantity_issued', 'unit_price', 'remarks',
            'procurement_status', 'ordered_date', 'expected_delivery_date', 'delivered_date',
            'parent_item_id', 'is_assembly', 'level'
        ]
        updates = []
        params = []
        for f in allowed_fields:
            if f in data:
                val = data[f]
                if f in ('product_id', 'parent_item_id') and (val == '' or val is None):
                    val = None
                elif f == 'is_assembly':
                    val = bool(val)
                elif f in ('quantity_required', 'quantity_issued', 'unit_price'):
                    val = float(val or 0)
                elif f in ('ordered_date', 'expected_delivery_date', 'delivered_date') and not val:
                    val = None
                updates.append(f"{f} = %s")
                params.append(val)

        if 'custom_fields' in data:
            updates.append("custom_fields = %s")
            params.append(json.dumps(data['custom_fields']))

        if updates:
            params.extend([item_id, bom_id])
            cursor.execute(f"UPDATE bom_items SET {', '.join(updates)} WHERE id = %s AND bom_id = %s", tuple(params))

        DBStore._sync_bom_completion_status(cursor, bom_id)
        conn.commit()
        cursor.close()
        conn.close()
        return DBStore.get_bom_details(bom_id)

    @staticmethod
    def delete_bom_item(bom_id: int, item_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("DELETE FROM bom_items WHERE parent_item_id = %s AND bom_id = %s", (item_id, bom_id))
        cursor.execute("DELETE FROM bom_items WHERE id = %s AND bom_id = %s", (item_id, bom_id))
        DBStore._sync_bom_completion_status(cursor, bom_id)
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def update_bom_header(bom_id: int, data: Dict[str, Any]) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        allowed = ['name', 'project_id', 'customer_name', 'target_delivery_date', 'is_template', 'template_category']
        updates = []
        params = []
        for key in allowed:
            if key in data:
                val = data[key]
                if key == 'project_id' and (val == '' or val is None):
                    val = None
                elif key == 'is_template':
                    val = bool(val)
                elif key == 'target_delivery_date' and not val:
                    val = None
                updates.append(f"{key} = %s")
                params.append(val)
        if not updates:
            cursor.close()
            conn.close()
            return True
        params.append(bom_id)
        cursor.execute(f"UPDATE boms SET {', '.join(updates)} WHERE id = %s", tuple(params))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def clone_bom(
        bom_id: int,
        new_name: str,
        project_id: Optional[int] = None,
        as_template: bool = False,
        reset_procurement: bool = True
    ) -> Dict[str, Any]:
        source = DBStore.get_bom_details(bom_id)
        if not source:
            raise ValueError(f"Source BOM {bom_id} not found")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        target_proj = project_id if project_id else (None if as_template else source.get("project_id"))
        cursor.execute("""
            INSERT INTO boms (project_id, name, status, customer_name, is_template, template_category, revision, root_bom_id)
            VALUES (%s, %s, 'DRAFT', %s, %s, %s, 'A', NULL)
        """, (
            target_proj,
            new_name,
            source.get("customer_name") if not as_template else None,
            as_template,
            source.get("template_category")
        ))
        new_bom_id = cursor.lastrowid
        cursor.execute("UPDATE boms SET root_bom_id = %s WHERE id = %s", (new_bom_id, new_bom_id))

        old_to_new_ids = {}
        items = source.get("items", [])
        items_sorted = sorted(items, key=lambda x: (1 if x.get("parent_item_id") else 0, x.get("id")))

        for item in items_sorted:
            proc_status = 'YET_TO_ORDER' if reset_procurement else item.get('procurement_status', 'YET_TO_ORDER')
            ord_date = None if reset_procurement else item.get('ordered_date')
            exp_date = None if reset_procurement else item.get('expected_delivery_date')
            del_date = None if reset_procurement else item.get('delivered_date')
            qty_issued = 0.00 if reset_procurement else item.get('quantity_issued', 0.00)

            mapped_parent_id = old_to_new_ids.get(item.get("parent_item_id"))

            cursor.execute("""
                INSERT INTO bom_items (
                    bom_id, product_id, manual_product_name, part_number, manufacturer,
                    link, quantity_required, quantity_issued, unit_price, remarks,
                    custom_fields, procurement_status, ordered_date, expected_delivery_date, delivered_date,
                    parent_item_id, is_assembly, level
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                new_bom_id,
                item.get("product_id"),
                item.get("manual_product_name"),
                item.get("part_number"),
                item.get("manufacturer"),
                item.get("link"),
                item.get("quantity_required", 1),
                qty_issued,
                item.get("unit_price", 0.0) or 0.0,
                item.get("remarks", ""),
                json.dumps(item.get("custom_fields", {})),
                proc_status,
                ord_date,
                exp_date,
                del_date,
                mapped_parent_id,
                bool(item.get("is_assembly", False)),
                item.get("level", 1)
            ))
            old_to_new_ids[item["id"]] = cursor.lastrowid

        conn.commit()
        cursor.close()
        conn.close()
        return DBStore.get_bom_details(new_bom_id)

    @staticmethod
    def toggle_bom_template(bom_id: int, is_template: bool, category: Optional[str] = None) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("UPDATE boms SET is_template = %s, template_category = %s WHERE id = %s", (is_template, category, bom_id))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def get_bom_stock_reservation(bom_id: int) -> Dict[str, Any]:
        bom = DBStore.get_bom_details(bom_id)
        if not bom:
            raise ValueError(f"BOM {bom_id} not found")

        items = bom.get("items", [])
        total_items = 0
        fully_reserved_count = 0
        partial_reserved_count = 0
        shortfall_count = 0
        reservation_details = []

        is_bom_active_res = bool(bom.get("is_reserved")) or bom.get("status") == "APPROVED"

        for item in items:
            if not item.get("product_id"):
                continue
            total_items += 1
            req_qty = float(item.get("quantity_required", 0))
            issued_qty = float(item.get("quantity_issued", 0))
            remaining_req = max(0.0, req_qty - issued_qty)
            current_stock = float(item.get("current_stock", 0))
            total_reserved = float(item.get("total_reserved_stock", 0))

            this_item_reserved = remaining_req if is_bom_active_res else 0.0
            other_boms_reserved = max(0.0, total_reserved - this_item_reserved)
            free_available = max(0.0, current_stock - other_boms_reserved)

            if is_bom_active_res:
                if current_stock >= remaining_req:
                    status = "FULLY_RESERVED"
                    fully_reserved_count += 1
                elif current_stock > 0:
                    status = "PARTIALLY_RESERVED"
                    partial_reserved_count += 1
                else:
                    status = "OUT_OF_STOCK"
                    shortfall_count += 1
            else:
                if free_available >= remaining_req:
                    status = "AVAILABLE_TO_RESERVE"
                elif free_available > 0:
                    status = "PARTIAL_AVAILABLE"
                    partial_reserved_count += 1
                else:
                    status = "SHORTFALL"
                    shortfall_count += 1

            reservation_details.append({
                "item_id": item["id"],
                "product_id": item["product_id"],
                "product_name": item["product_name"],
                "part_number": item["part_number"] or item["product_code"],
                "quantity_required": req_qty,
                "quantity_issued": issued_qty,
                "remaining_required": remaining_req,
                "current_store_stock": current_stock,
                "total_reserved_store": total_reserved,
                "free_unreserved_stock": free_available,
                "reservation_status": status
            })

        return {
            "bom_id": bom_id,
            "bom_name": bom["name"],
            "is_reserved": bool(bom.get("is_reserved")),
            "bom_status": bom.get("status"),
            "total_catalog_items": total_items,
            "fully_reserved_count": fully_reserved_count,
            "partial_reserved_count": partial_reserved_count,
            "shortfall_count": shortfall_count,
            "items": reservation_details
        }

    @staticmethod
    def toggle_bom_stock_reservation(bom_id: int, reserve: bool) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("UPDATE boms SET is_reserved = %s WHERE id = %s", (reserve, bom_id))
        conn.commit()
        cursor.close()
        conn.close()
        return DBStore.get_bom_stock_reservation(bom_id)

    @staticmethod
    def create_bulk_purchase_request(
        bom_id: int,
        items_payload: Optional[List[Dict[str, Any]]] = None,
        user_name: str = "BOM Builder",
        remarks: Optional[str] = None
    ) -> Dict[str, Any]:
        bom = DBStore.get_bom_details(bom_id)
        if not bom:
            raise ValueError(f"BOM {bom_id} not found")

        pr_items = []
        if items_payload and len(items_payload) > 0:
            for it in items_payload:
                pr_items.append({
                    "name": it.get("name") or it.get("product_name"),
                    "code": it.get("code") or it.get("part_number") or it.get("product_code") or "N/A",
                    "category": it.get("category", "Electrical"),
                    "unit": it.get("unit") or it.get("product_unit") or "pcs",
                    "quantity": float(it.get("quantity", 1))
                })
        else:
            for item in bom.get("items", []):
                req = float(item.get("quantity_required", 0))
                issued = float(item.get("quantity_issued", 0))
                stock = float(item.get("current_stock", 0))
                shortage = max(0.0, req - issued - stock)
                if shortage > 0:
                    pr_items.append({
                        "name": item.get("product_name"),
                        "code": item.get("part_number") or item.get("product_code") or "MANUAL",
                        "category": "Electrical",
                        "unit": item.get("product_unit") or "pcs",
                        "quantity": shortage
                    })

        if not pr_items:
            raise ValueError("No shortage items found in this BOM to generate a Purchase Request.")

        req_remarks = remarks or f"Consolidated Bulk PR for shortages in BOM: '{bom['name']}' (Project: {bom.get('project_name') or 'N/A'})"
        new_req = {
            "requester": user_name,
            "remarks": req_remarks,
            "items": pr_items,
            "status": "PENDING"
        }
        created = DBStore.add_purchase_request(new_req)

        employees = DBStore.get_employees()
        for emp in employees:
            if emp.get("role") in ["Administrator", "Store Manager"]:
                DBStore.add_notification(
                    user_id=emp["id"],
                    title="Bulk PR Raised from BOM",
                    message=f"A bulk purchase request with {len(pr_items)} item(s) was raised for BOM '{bom['name']}'.",
                    link="/requests"
                )

        return {
            "success": True,
            "request_id": created.get("id"),
            "items_count": len(pr_items),
            "items": pr_items
        }

    @staticmethod
    def search_boms(
        query: Optional[str] = None,
        part_number: Optional[str] = None,
        product_id: Optional[int] = None,
        project_id: Optional[int] = None
    ) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        sql = """
            SELECT bi.id as item_id, bi.bom_id, bi.product_id, bi.manual_product_name,
                   bi.part_number, bi.manufacturer, bi.quantity_required, bi.quantity_issued,
                   bi.unit_price, bi.procurement_status, bi.remarks, bi.is_assembly, bi.level,
                   b.name as bom_name, b.status as bom_status, b.revision as bom_revision,
                   b.is_template, b.target_delivery_date,
                   p.id as project_id, p.name as project_name, p.code as project_code,
                   prod.name as catalog_product_name, prod.code as catalog_product_code, prod.unit as catalog_product_unit,
                   COALESCE((SELECT SUM(quantity) FROM product_locations WHERE product_id = bi.product_id), 0.00) as current_stock
            FROM bom_items bi
            JOIN boms b ON bi.bom_id = b.id
            LEFT JOIN projects p ON b.project_id = p.id
            LEFT JOIN products prod ON bi.product_id = prod.id
            WHERE 1=1
        """
        params = []
        if query:
            q = f"%{query.strip()}%"
            sql += """ AND (
                bi.part_number LIKE %s OR bi.manual_product_name LIKE %s OR bi.manufacturer LIKE %s
                OR prod.name LIKE %s OR prod.code LIKE %s OR b.name LIKE %s OR p.name LIKE %s
            )"""
            params.extend([q, q, q, q, q, q, q])
        if part_number:
            sql += " AND (bi.part_number LIKE %s OR prod.code LIKE %s)"
            pn = f"%{part_number.strip()}%"
            params.extend([pn, pn])
        if product_id:
            sql += " AND bi.product_id = %s"
            params.append(product_id)
        if project_id:
            sql += " AND b.project_id = %s"
            params.append(project_id)

        sql += " ORDER BY b.id DESC, bi.id ASC LIMIT 200"
        cursor.execute(sql, tuple(params))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        where_used_summary = {}
        formatted_results = []
        for r in rows:
            r["quantity_required"] = float(r["quantity_required"] or 0)
            r["quantity_issued"] = float(r["quantity_issued"] or 0)
            r["unit_price"] = float(r["unit_price"] or 0)
            r["current_stock"] = float(r["current_stock"] or 0)
            r["is_assembly"] = bool(r.get("is_assembly"))
            r["is_template"] = bool(r.get("is_template"))
            if r.get("target_delivery_date") and hasattr(r["target_delivery_date"], 'isoformat'):
                r["target_delivery_date"] = r["target_delivery_date"].isoformat()

            item_key = (r.get("part_number") or r.get("catalog_product_code") or r.get("manual_product_name") or "Unknown").strip()
            if item_key not in where_used_summary:
                where_used_summary[item_key] = {
                    "item_key": item_key,
                    "product_name": r.get("catalog_product_name") or r.get("manual_product_name"),
                    "part_number": r.get("part_number") or r.get("catalog_product_code"),
                    "total_boms_count": 0,
                    "total_quantity_required": 0.0,
                    "boms": []
                }
            where_used_summary[item_key]["total_boms_count"] += 1
            where_used_summary[item_key]["total_quantity_required"] += r["quantity_required"]
            where_used_summary[item_key]["boms"].append({
                "bom_id": r["bom_id"],
                "bom_name": r["bom_name"],
                "project_name": r["project_name"],
                "revision": r["bom_revision"],
                "quantity": r["quantity_required"]
            })
            formatted_results.append(r)

        return {
            "total_matches": len(formatted_results),
            "results": formatted_results,
            "where_used": list(where_used_summary.values())
        }

    @staticmethod
    def create_bom_revision(
        bom_id: int,
        eco_number: str,
        title: str,
        reason: str,
        user_name: str,
        new_revision: Optional[str] = None
    ) -> Dict[str, Any]:
        source = DBStore.get_bom_details(bom_id)
        if not source:
            raise ValueError(f"Source BOM {bom_id} not found")

        curr_rev = source.get("revision") or "A"
        if not new_revision:
            try:
                if len(curr_rev) == 1 and curr_rev.isalpha():
                    next_rev = chr(ord(curr_rev.upper()) + 1)
                else:
                    next_rev = f"{curr_rev}.1"
            except:
                next_rev = f"{curr_rev}-REV"
        else:
            next_rev = new_revision

        root_id = source.get("root_bom_id") or source["id"]

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            INSERT INTO engineering_change_orders (eco_number, title, reason, initiator, status, source_bom_id)
            VALUES (%s, %s, %s, %s, 'APPROVED', %s)
        """, (eco_number, title, reason, user_name, bom_id))
        eco_id = cursor.lastrowid

        rev_name = f"{source['name']} (Rev {next_rev})"
        cursor.execute("""
            INSERT INTO boms (
                project_id, name, status, customer_name, target_delivery_date,
                is_template, template_category, revision, root_bom_id, parent_bom_id, eco_id
            )
            VALUES (%s, %s, 'DRAFT', %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            source.get("project_id"),
            rev_name,
            source.get("customer_name"),
            source.get("target_delivery_date"),
            source.get("is_template", False),
            source.get("template_category"),
            next_rev,
            root_id,
            bom_id,
            eco_id
        ))
        new_bom_id = cursor.lastrowid

        cursor.execute("UPDATE engineering_change_orders SET target_bom_id = %s WHERE id = %s", (new_bom_id, eco_id))

        old_to_new_ids = {}
        items = source.get("items", [])
        items_sorted = sorted(items, key=lambda x: (1 if x.get("parent_item_id") else 0, x.get("id")))

        for item in items_sorted:
            mapped_parent_id = old_to_new_ids.get(item.get("parent_item_id"))
            cursor.execute("""
                INSERT INTO bom_items (
                    bom_id, product_id, manual_product_name, part_number, manufacturer,
                    link, quantity_required, quantity_issued, unit_price, remarks,
                    custom_fields, procurement_status, ordered_date, expected_delivery_date, delivered_date,
                    parent_item_id, is_assembly, level
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                new_bom_id,
                item.get("product_id"),
                item.get("manual_product_name"),
                item.get("part_number"),
                item.get("manufacturer"),
                item.get("link"),
                item.get("quantity_required", 1),
                0.00,
                item.get("unit_price", 0.0) or 0.0,
                item.get("remarks", ""),
                json.dumps(item.get("custom_fields", {})),
                "YET_TO_ORDER",
                None,
                None,
                None,
                mapped_parent_id,
                bool(item.get("is_assembly", False)),
                item.get("level", 1)
            ))
            old_to_new_ids[item["id"]] = cursor.lastrowid

        conn.commit()
        cursor.close()
        conn.close()

        employees = DBStore.get_employees()
        for emp in employees:
            if emp.get("role") in ["Administrator", "Store Manager"]:
                DBStore.add_notification(
                    user_id=emp["id"],
                    title=f"New BOM Revision ({next_rev}) via {eco_number}",
                    message=f"BOM '{source['name']}' was revised to Rev {next_rev} under ECO {eco_number}.",
                    link=f"/bom"
                )

        return DBStore.get_bom_details(new_bom_id)

    @staticmethod
    def get_bom_revisions(bom_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, root_bom_id FROM boms WHERE id = %s", (bom_id,))
        row = cursor.fetchone()
        if not row:
            cursor.close()
            conn.close()
            return []

        root_id = row.get("root_bom_id") or row["id"]
        cursor.execute("""
            SELECT b.*, eco.eco_number, eco.title as eco_title, eco.reason as eco_reason
            FROM boms b
            LEFT JOIN engineering_change_orders eco ON b.eco_id = eco.id
            WHERE b.root_bom_id = %s OR b.id = %s
            ORDER BY b.id ASC
        """, (root_id, root_id))
        revisions = cursor.fetchall()
        cursor.close()
        conn.close()
        for r in revisions:
            r["is_template"] = bool(r.get("is_template"))
            r["is_reserved"] = bool(r.get("is_reserved"))
            if r.get("created_at") and hasattr(r["created_at"], 'isoformat'):
                r["created_at"] = r["created_at"].isoformat()
            if r.get("updated_at") and hasattr(r["updated_at"], 'isoformat'):
                r["updated_at"] = r["updated_at"].isoformat()
        return revisions

    @staticmethod
    def compare_boms(source_bom_id: int, target_bom_id: int) -> Dict[str, Any]:
        source = DBStore.get_bom_details(source_bom_id)
        target = DBStore.get_bom_details(target_bom_id)
        if not source or not target:
            raise ValueError("One or both BOMs not found for comparison")

        def item_signature(item: Dict[str, Any]) -> str:
            if item.get("product_id"):
                return f"PROD_{item['product_id']}"
            pn = (item.get("part_number") or "").strip().lower()
            name = (item.get("manual_product_name") or item.get("product_name") or "").strip().lower()
            return f"MANUAL_{pn}_{name}"

        source_items = {item_signature(it): it for it in source.get("items", [])}
        target_items = {item_signature(it): it for it in target.get("items", [])}

        all_keys = set(source_items.keys()).union(set(target_items.keys()))

        added = []
        removed = []
        modified = []
        unchanged = []

        source_total_cost = 0.0
        target_total_cost = 0.0

        for key in all_keys:
            s_item = source_items.get(key)
            t_item = target_items.get(key)

            if s_item and not t_item:
                removed.append(s_item)
                source_total_cost += float(s_item.get("quantity_required", 0)) * float(s_item.get("unit_price", 0))
            elif t_item and not s_item:
                added.append(t_item)
                target_total_cost += float(t_item.get("quantity_required", 0)) * float(t_item.get("unit_price", 0))
            else:
                s_cost = float(s_item.get("quantity_required", 0)) * float(s_item.get("unit_price", 0))
                t_cost = float(t_item.get("quantity_required", 0)) * float(t_item.get("unit_price", 0))
                source_total_cost += s_cost
                target_total_cost += t_cost

                qty_diff = float(t_item.get("quantity_required", 0)) - float(s_item.get("quantity_required", 0))
                price_diff = float(t_item.get("unit_price", 0)) - float(s_item.get("unit_price", 0))
                is_changed = (abs(qty_diff) > 0.0001 or abs(price_diff) > 0.0001 or
                              (s_item.get("remarks") or "") != (t_item.get("remarks") or "") or
                              (s_item.get("part_number") or "") != (t_item.get("part_number") or ""))

                if is_changed:
                    modified.append({
                        "signature": key,
                        "product_name": t_item.get("product_name") or s_item.get("product_name"),
                        "part_number": t_item.get("part_number") or s_item.get("part_number"),
                        "old_quantity": float(s_item.get("quantity_required", 0)),
                        "new_quantity": float(t_item.get("quantity_required", 0)),
                        "quantity_diff": qty_diff,
                        "old_unit_price": float(s_item.get("unit_price", 0)),
                        "new_unit_price": float(t_item.get("unit_price", 0)),
                        "price_diff": price_diff,
                        "old_cost": s_cost,
                        "new_cost": t_cost,
                        "cost_diff": t_cost - s_cost,
                        "old_remarks": s_item.get("remarks"),
                        "new_remarks": t_item.get("remarks"),
                        "source_item": s_item,
                        "target_item": t_item
                    })
                else:
                    unchanged.append(t_item)

        return {
            "source_bom": {
                "id": source["id"],
                "name": source["name"],
                "revision": source.get("revision", "A"),
                "status": source.get("status"),
                "total_items": len(source.get("items", [])),
                "total_cost": round(source_total_cost, 2)
            },
            "target_bom": {
                "id": target["id"],
                "name": target["name"],
                "revision": target.get("revision", "A"),
                "status": target.get("status"),
                "total_items": len(target.get("items", [])),
                "total_cost": round(target_total_cost, 2)
            },
            "summary": {
                "added_count": len(added),
                "removed_count": len(removed),
                "modified_count": len(modified),
                "unchanged_count": len(unchanged),
                "cost_variance": round(target_total_cost - source_total_cost, 2)
            },
            "added": added,
            "removed": removed,
            "modified": modified,
            "unchanged": unchanged
        }

    @staticmethod
    def get_ecos() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT eco.*, 
                   sb.name as source_bom_name, sb.revision as source_bom_revision,
                   tb.name as target_bom_name, tb.revision as target_bom_revision,
                   p.name as project_name
            FROM engineering_change_orders eco
            LEFT JOIN boms sb ON eco.source_bom_id = sb.id
            LEFT JOIN boms tb ON eco.target_bom_id = tb.id
            LEFT JOIN projects p ON tb.project_id = p.id OR sb.project_id = p.id
            ORDER BY eco.id DESC
        """)
        ecos = cursor.fetchall()
        cursor.close()
        conn.close()
        for e in ecos:
            if e.get("created_at") and hasattr(e["created_at"], 'isoformat'):
                e["created_at"] = e["created_at"].isoformat()
            if e.get("approved_at") and hasattr(e["approved_at"], 'isoformat'):
                e["approved_at"] = e["approved_at"].isoformat()
        return ecos

    @staticmethod
    def get_project_notes(project_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT n.*, e.name as created_by_name 
            FROM project_notes n
            LEFT JOIN employees e ON n.created_by = e.id
            WHERE n.project_id = %s
            ORDER BY n.created_at DESC
        """, (project_id,))
        notes = cursor.fetchall()
        cursor.close()
        conn.close()
        for n in notes:
            if n.get('created_at'): n['created_at'] = n['created_at'].isoformat()
            if n.get('updated_at'): n['updated_at'] = n['updated_at'].isoformat()
        return notes

    @staticmethod
    def add_project_note(project_id: int, content: str, created_by: int = None) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "INSERT INTO project_notes (project_id, content, created_by) VALUES (%s, %s, %s)",
            (project_id, content, created_by)
        )
        note_id = cursor.lastrowid
        conn.commit()
        
        cursor.execute("""
            SELECT n.*, e.name as created_by_name 
            FROM project_notes n
            LEFT JOIN employees e ON n.created_by = e.id
            WHERE n.id = %s
        """, (note_id,))
        note = cursor.fetchone()
        cursor.close()
        conn.close()
        if note and note.get('created_at'): note['created_at'] = note['created_at'].isoformat()
        if note and note.get('updated_at'): note['updated_at'] = note['updated_at'].isoformat()
        return note

    @staticmethod
    def get_project_activities(project_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT a.*, e.name as user_name 
            FROM project_activities a
            LEFT JOIN employees e ON a.user_id = e.id
            WHERE a.project_id = %s
            ORDER BY a.created_at DESC
        """, (project_id,))
        activities = cursor.fetchall()
        cursor.close()
        conn.close()
        for a in activities:
            if a.get('created_at'): a['created_at'] = a['created_at'].isoformat()
        return activities

    @staticmethod
    def get_all_project_activities(limit: int = 50) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT a.*, e.name as user_name, p.name as project_name
            FROM project_activities a
            LEFT JOIN employees e ON a.user_id = e.id
            LEFT JOIN projects p ON a.project_id = p.id
            ORDER BY a.created_at DESC
            LIMIT %s
        """, (limit,))
        activities = cursor.fetchall()
        cursor.close()
        conn.close()
        for a in activities:
            if a.get('created_at'): a['created_at'] = a['created_at'].isoformat()
        return activities


    @staticmethod
    def add_project_activity(project_id: int, action: str, description: str = None, user_id: int = None) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        if user_id is not None:
            cursor.execute("SELECT id FROM employees WHERE id = %s", (user_id,))
            if not cursor.fetchone():
                user_id = None
        cursor.execute(
            "INSERT INTO project_activities (project_id, action, description, user_id) VALUES (%s, %s, %s, %s)",
            (project_id, action, description, user_id)
        )
        activity_id = cursor.lastrowid
        conn.commit()
        
        cursor.execute("""
            SELECT a.*, e.name as user_name 
            FROM project_activities a
            LEFT JOIN employees e ON a.user_id = e.id
            WHERE a.id = %s
        """, (activity_id,))
        activity = cursor.fetchone()
        cursor.close()
        conn.close()
        if activity and activity.get('created_at'): activity['created_at'] = activity['created_at'].isoformat()
        return activity

    @staticmethod
    def record_description_change(entity_type: str, entity_id: int, old_description: Optional[str], new_description: Optional[str], user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        clean_old = (old_description or "").strip()
        clean_new = (new_description or "").strip()
        if clean_old == clean_new:
            return None

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        if user_id is not None:
            cursor.execute("SELECT id FROM employees WHERE id = %s", (user_id,))
            if not cursor.fetchone():
                user_id = None
        cursor.execute(
            """INSERT INTO description_histories (entity_type, entity_id, old_description, new_description, user_id)
               VALUES (%s, %s, %s, %s, %s)""",
            (entity_type, entity_id, old_description, new_description, user_id)
        )
        rec_id = cursor.lastrowid
        conn.commit()

        cursor.execute("""
            SELECT dh.*, e.name as user_name
            FROM description_histories dh
            LEFT JOIN employees e ON dh.user_id = e.id
            WHERE dh.id = %s
        """, (rec_id,))
        record = cursor.fetchone()
        cursor.close()
        conn.close()
        if record and record.get('created_at'):
            record['created_at'] = record['created_at'].isoformat()
        return record

    @staticmethod
    def get_description_history(entity_type: str, entity_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT dh.*, e.name as user_name
            FROM description_histories dh
            LEFT JOIN employees e ON dh.user_id = e.id
            WHERE dh.entity_type = %s AND dh.entity_id = %s
            ORDER BY dh.created_at DESC
        """, (entity_type, entity_id))
        records = cursor.fetchall()
        cursor.close()
        conn.close()
        for r in records:
            if r.get('created_at'):
                r['created_at'] = r['created_at'].isoformat()
        return records

    @staticmethod
    def get_notifications(user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM notifications WHERE user_id = %s ORDER BY created_at DESC LIMIT %s",
            (user_id, limit)
        )
        notifications = cursor.fetchall()
        cursor.close()
        conn.close()
        for n in notifications:
            if n.get('created_at'):
                n['created_at'] = n['created_at'].isoformat()
            n['is_read'] = bool(n.get('is_read'))
        return notifications

    @staticmethod
    def add_notification(user_id: int, title: str, message: str = None, link: str = None) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "INSERT INTO notifications (user_id, title, message, link) VALUES (%s, %s, %s, %s)",
            (user_id, title, message, link)
        )
        notif_id = cursor.lastrowid
        conn.commit()
        
        cursor.execute("SELECT * FROM notifications WHERE id = %s", (notif_id,))
        notif = cursor.fetchone()
        cursor.close()
        conn.close()
        if notif and notif.get('created_at'):
            notif['created_at'] = notif['created_at'].isoformat()
        if notif:
            notif['is_read'] = bool(notif.get('is_read'))
        return notif

        if notif:
            notif['is_read'] = bool(notif.get('is_read'))
        return notif

    @staticmethod
    def mark_notification_read(notification_id: int, user_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "UPDATE notifications SET is_read = TRUE WHERE id = %s AND user_id = %s",
            (notification_id, user_id)
        )
        success = cursor.rowcount > 0
        conn.commit()
        cursor.close()
        conn.close()
        return success

    @staticmethod
    def mark_all_notifications_read(user_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "UPDATE notifications SET is_read = TRUE WHERE user_id = %s",
            (user_id,)
        )
        success = cursor.rowcount > 0
        conn.commit()
        cursor.close()
        conn.close()
        return success

    @staticmethod
    def save_ai_project_plan(project_data: Dict[str, Any], plan_json: Dict[str, Any]) -> int:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            # 1. Insert Project
            query_proj = """
                INSERT INTO projects (code, name, po_number, client_name, description, status, start_date, end_date, 
                                      project_incharge, has_software, has_firmware, has_transformer, no_of_panels, folder_path, 
                                      date_of_delivery, constraints, budget, priority, category)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            proj_values = (
                project_data.get("code"),
                project_data.get("name"),
                project_data.get("po_number"),
                project_data.get("client_name"),
                project_data.get("description"),
                "PLANNING",
                project_data.get("start_date") or None,
                project_data.get("end_date") or None,
                project_data.get("project_incharge"),
                1 if project_data.get("has_software") else 0,
                1 if project_data.get("has_firmware") else 0,
                1 if project_data.get("has_transformer") else 0,
                project_data.get("no_of_panels", 1),
                project_data.get("folder_path"),
                project_data.get("date_of_delivery") or None,
                project_data.get("constraints"),
                project_data.get("budget"),
                project_data.get("priority", "MEDIUM"),
                project_data.get("category") or "STANDARD"
            )
            cursor.execute(query_proj, proj_values)
            project_id = cursor.lastrowid

            # Maps to keep track of generated IDs to database IDs
            phase_id_map = {}
            task_id_map = {}

            # 2. Insert Phases (as parent tasks in dynamic_tasks)
            current_sort_order = 0
            for phase in plan_json.get("phases", []):
                query_phase = """
                    INSERT INTO dynamic_tasks (project_id, parent_id, title, description, status, priority, sort_order)
                    VALUES (%s, NULL, %s, %s, 'TODO', 'MEDIUM', %s)
                """
                cursor.execute(query_phase, (project_id, phase["name"], phase.get("description") or "", current_sort_order))
                current_sort_order += 1
                db_phase_id = cursor.lastrowid
                phase_id_map[phase["id"]] = db_phase_id

            # 3. Insert Tasks (as child tasks in dynamic_tasks pointing to phase task ID)
            for t in plan_json.get("tasks", []):
                db_phase_id = phase_id_map.get(t["phaseId"])
                query_task = """
                    INSERT INTO dynamic_tasks (project_id, parent_id, title, description, status, priority, start_date, due_date, sort_order)
                    VALUES (%s, %s, %s, %s, 'TODO', %s, %s, %s, %s)
                """
                cursor.execute(query_task, (
                    project_id,
                    db_phase_id,
                    t["name"],
                    t.get("description") or "",
                    t.get("priority", "MEDIUM"),
                    t.get("earliestStartDate") or None,
                    t.get("earliestFinishDate") or None,
                    current_sort_order
                ))
                current_sort_order += 1
                db_task_id = cursor.lastrowid
                task_id_map[t["id"]] = db_task_id

            # 4. Insert Subtasks (as child tasks in dynamic_tasks pointing to task task ID)
            for sub in plan_json.get("subtasks", []):
                db_task_id = task_id_map.get(sub["taskId"])
                if db_task_id:
                    query_sub = """
                        INSERT INTO dynamic_tasks (project_id, parent_id, title, status, priority, sort_order)
                        VALUES (%s, %s, %s, 'TODO', 'MEDIUM', %s)
                    """
                    cursor.execute(query_sub, (project_id, db_task_id, sub["name"], current_sort_order))
                    current_sort_order += 1

            # 5. Insert Dependencies
            for dep in plan_json.get("dependencies", []):
                db_task_id = task_id_map.get(dep["taskId"])
                db_dep_id = task_id_map.get(dep["dependsOnTaskId"])
                if db_task_id and db_dep_id:
                    query_dep = """
                        INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type, lag_days)
                        VALUES (%s, %s, %s, %s)
                    """
                    cursor.execute(query_dep, (db_task_id, db_dep_id, dep.get("dependencyType", "FS"), dep.get("lagDays", 0)))

            # 6. Insert Resource Suggestions
            for sug in plan_json.get("resourceSuggestions", []):
                db_task_id = task_id_map.get(sug["taskId"])
                if db_task_id:
                    query_sug = """
                        INSERT INTO resource_suggestions (task_id, suggested_role, required_skills)
                        VALUES (%s, %s, %s)
                    """
                    skills_str = ",".join(sug.get("requiredSkills", []))
                    cursor.execute(query_sug, (db_task_id, sug.get("suggestedRole"), skills_str))

            # 7. Insert Milestones
            for ms in plan_json.get("milestones", []):
                db_task_id = task_id_map.get(ms["associatedTaskId"])
                query_ms = """
                    INSERT INTO project_milestones (project_id, name, description, associated_task_id)
                    VALUES (%s, %s, %s, %s)
                """
                cursor.execute(query_ms, (project_id, ms["name"], ms.get("description") or "", db_task_id))

            # 8. Insert Risks
            for risk in plan_json.get("risks", []):
                query_risk = """
                    INSERT INTO project_risks (project_id, risk_description, impact_level, probability_level, mitigation_strategy)
                    VALUES (%s, %s, %s, %s, %s)
                """
                cursor.execute(query_risk, (
                    project_id,
                    risk["riskDescription"],
                    risk.get("impactLevel", "MEDIUM"),
                    risk.get("probabilityLevel", "MEDIUM"),
                    risk.get("mitigationStrategy")
                ))

            conn.commit()
            return project_id
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def log_activity(user_id: int, action: str, entity_type: str, entity_id: int, details: Dict[str, Any] = None) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
            VALUES (%s, %s, %s, %s, %s)
        """
        values = (user_id, action, entity_type, entity_id, json.dumps(details) if details else None)
        try:
            cursor.execute(query, values)
            conn.commit()
            return True
        except:
            return False
        finally:
            cursor.close()
            conn.close()

    # Announcements
    @staticmethod
    def get_active_announcements(limit=5) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM announcements WHERE is_active = TRUE AND created_at >= NOW() - INTERVAL '23:59:59' HOUR_SECOND ORDER BY created_at DESC LIMIT %s", (limit,))
        announcements = cursor.fetchall()
        cursor.close()
        conn.close()
        for a in announcements:
            if a.get('created_at'):
                a['created_at'] = a['created_at'].isoformat()
        return announcements

    @staticmethod
    def create_announcement(data: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = "INSERT INTO announcements (message, created_by) VALUES (%s, %s)"
        cursor.execute(query, (data.get("message"), user_id))
        conn.commit()
        announcement_id = cursor.lastrowid
        cursor.execute("SELECT * FROM announcements WHERE id = %s", (announcement_id,))
        announcement = cursor.fetchone()
        cursor.close()
        conn.close()
        if announcement and announcement.get('created_at'):
            announcement['created_at'] = announcement['created_at'].isoformat()
        return announcement

    @staticmethod
    def deactivate_announcement(announcement_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE announcements SET is_active = FALSE WHERE id = %s", (announcement_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    @staticmethod
    def update_announcement(announcement_id: int, message: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("UPDATE announcements SET message = %s WHERE id = %s", (message, announcement_id))
        conn.commit()
        cursor.execute("SELECT * FROM announcements WHERE id = %s", (announcement_id,))
        announcement = cursor.fetchone()
        cursor.close()
        conn.close()
        if announcement and announcement.get('created_at'):
            announcement['created_at'] = announcement['created_at'].isoformat()
        return announcement

    @staticmethod
    def get_service_tickets(project_id: Optional[int] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = "SELECT st.*, COALESCE(p.name, st.custom_project_name) as project_name, COALESCE(p.code, 'MANUAL') as project_code, cr.name as creator_name, asn.name as assignee_name, res.name as resolver_name FROM service_tickets st LEFT JOIN projects p ON st.project_id = p.id LEFT JOIN employees cr ON st.creator_id = cr.id LEFT JOIN employees asn ON st.assignee_id = asn.id LEFT JOIN employees res ON st.resolved_by = res.id WHERE 1=1"
        params = []
        if project_id:
            query += " AND st.project_id = %s"
            params.append(project_id)
        if status:
            query += " AND st.status = %s"
            params.append(status)
        query += " ORDER BY st.created_at DESC"
        cursor.execute(query, tuple(params))
        tickets = cursor.fetchall()
        cursor.close()
        conn.close()
        for t in tickets:
            t['ticket_id'] = f"SR-{str(t['id']).zfill(8)}"
            if t.get('created_at') and hasattr(t['created_at'], 'isoformat'):
                t['created_at'] = t['created_at'].isoformat()
            if t.get('closed_at') and hasattr(t['closed_at'], 'isoformat'):
                t['closed_at'] = t['closed_at'].isoformat()
            if t.get('updated_at') and hasattr(t['updated_at'], 'isoformat'):
                t['updated_at'] = t['updated_at'].isoformat()
        return tickets

    @staticmethod
    def create_service_ticket(data: Dict[str, Any]) -> int:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            # Auto-reopen project if closed
            if data.get("project_id") and str(data.get("project_id")).strip() != "":
                cursor.execute("SELECT status FROM projects WHERE id = %s", (data["project_id"],))
                proj = cursor.fetchone()
                if proj and proj["status"] == "CLOSED":
                    cursor.execute("UPDATE projects SET status = 'IN_PROGRESS' WHERE id = %s", (data["project_id"],))

            query = """
                INSERT INTO service_tickets (project_id, custom_project_name, creator_id, assignee_id, title, description, status, history_logs)
                VALUES (%s, %s, %s, %s, %s, %s, 'OPEN', %s)
            """
            history = [{"action": "Ticket Created", "timestamp": datetime.now().isoformat()}]
            p_id = data.get("project_id")
            if p_id is not None and str(p_id).strip() in ("", "null", "undefined", "None", "0", "NaN"):
                p_id = None
                
            c_id = data.get("creator_id")
            if c_id is not None and str(c_id).strip() in ("", "null", "undefined", "None", "NaN"):
                c_id = None
                
            a_id = data.get("assignee_id")
            if a_id is not None and str(a_id).strip() in ("", "null", "undefined", "None", "0", "NaN"):
                a_id = None
                
            cursor.execute(query, (
                p_id,
                data.get("custom_project_name"),
                c_id,
                a_id,
                data["title"],
                data.get("description", ""),
                json.dumps(history)
            ))
            ticket_id = cursor.lastrowid
            conn.commit()
            return ticket_id
        except Exception as e:
            conn.rollback()
            with open('error.log', 'w') as f: f.write(str(e))
            raise e
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def update_service_ticket(ticket_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("SELECT * FROM service_tickets WHERE id = %s", (ticket_id,))
            ticket = cursor.fetchone()
            if not ticket:
                return None
            
            history = json.loads(ticket.get("history_logs") or "[]")
            updates = []
            values = []
            
            if "status" in data and data["status"] != ticket["status"]:
                updates.append("status = %s")
                values.append(data["status"])
                history.append({"action": f"Status changed to {data['status']}", "timestamp": datetime.now().isoformat()})
                
                if data["status"] == "CLOSED":
                    updates.append("closed_at = %s")
                    closed_time = datetime.now()
                    values.append(closed_time)
                    
                    created_time = ticket["created_at"]
                    # Calculate diff in minutes
                    diff = closed_time - created_time
                    diff_mins = int(diff.total_seconds() / 60)
                    updates.append("resolution_time_mins = %s")
                    values.append(diff_mins)
                elif data["status"] == "OPEN":
                    updates.append("closed_at = NULL")
                    updates.append("resolution_time_mins = NULL")

            if "title" in data and data["title"] is not None and data["title"] != ticket.get("title"):
                updates.append("title = %s")
                values.append(data["title"])
                history.append({"action": f"Title updated to '{data['title']}'", "timestamp": datetime.now().isoformat()})

            if "description" in data and data["description"] != ticket.get("description"):
                updates.append("description = %s")
                values.append(data["description"])
                history.append({"action": "Description updated", "timestamp": datetime.now().isoformat()})

            if "project_id" in data:
                p_id = data["project_id"]
                if p_id is not None and str(p_id).strip() in ("", "null", "undefined", "None", "0", "NaN"):
                    p_id = None
                elif p_id is not None:
                    try:
                        p_id = int(p_id)
                    except (ValueError, TypeError):
                        p_id = None
                if p_id != ticket.get("project_id"):
                    updates.append("project_id = %s")
                    values.append(p_id)
                    history.append({"action": f"Project changed to {p_id}", "timestamp": datetime.now().isoformat()})
                    if p_id is not None and "custom_project_name" not in data:
                        updates.append("custom_project_name = NULL")

            if "custom_project_name" in data:
                c_name = data["custom_project_name"]
                if c_name is not None and str(c_name).strip() in ("", "null", "undefined", "None"):
                    c_name = None
                if c_name != ticket.get("custom_project_name"):
                    updates.append("custom_project_name = %s")
                    values.append(c_name)
                    if c_name:
                        history.append({"action": f"Custom project name set to '{c_name}'", "timestamp": datetime.now().isoformat()})
                        if "project_id" not in data:
                            updates.append("project_id = NULL")

            if "assignee_id" in data:
                a_id = data["assignee_id"]
                if a_id is not None and str(a_id).strip() in ("", "null", "undefined", "None", "0", "NaN"):
                    a_id = None
                elif a_id is not None:
                    try:
                        a_id = int(a_id)
                    except (ValueError, TypeError):
                        a_id = None
                if a_id != ticket.get("assignee_id"):
                    updates.append("assignee_id = %s")
                    values.append(a_id)
                    history.append({"action": f"Assigned to employee {a_id}", "timestamp": datetime.now().isoformat()})
                
            if "resolution_notes" in data:
                updates.append("resolution_notes = %s")
                values.append(data["resolution_notes"])
                
            if "resolution_images" in data:
                updates.append("resolution_images = %s")
                values.append(data["resolution_images"])
                
            if "resolved_by" in data:
                updates.append("resolved_by = %s")
                values.append(data["resolved_by"])
                history.append({"action": f"Resolved by employee {data['resolved_by']}", "timestamp": datetime.now().isoformat()})
                
            if updates:
                updates.append("history_logs = %s")
                values.append(json.dumps(history))
                
                values.append(ticket_id)
                query = f"UPDATE service_tickets SET {', '.join(updates)} WHERE id = %s"
                cursor.execute(query, tuple(values))
                conn.commit()
            
            cursor.execute('''SELECT st.*, COALESCE(p.name, st.custom_project_name) as project_name, COALESCE(p.code, 'MANUAL') as project_code, cr.name as creator_name, asn.name as assignee_name, res.name as resolver_name FROM service_tickets st LEFT JOIN projects p ON st.project_id = p.id LEFT JOIN employees cr ON st.creator_id = cr.id LEFT JOIN employees asn ON st.assignee_id = asn.id LEFT JOIN employees res ON st.resolved_by = res.id WHERE st.id = %s''', (ticket_id,))
            updated_ticket = cursor.fetchone()
            
            if updated_ticket:
                if updated_ticket.get('created_at') and hasattr(updated_ticket['created_at'], 'isoformat'):
                    updated_ticket['created_at'] = updated_ticket['created_at'].isoformat()
                if updated_ticket.get('closed_at') and hasattr(updated_ticket['closed_at'], 'isoformat'):
                    updated_ticket['closed_at'] = updated_ticket['closed_at'].isoformat()
                if updated_ticket.get('updated_at') and hasattr(updated_ticket['updated_at'], 'isoformat'):
                    updated_ticket['updated_at'] = updated_ticket['updated_at'].isoformat()
                    
            return updated_ticket
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
    @staticmethod
    def init_stock_drafts_table():
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS stock_drafts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    draft_type VARCHAR(50) NOT NULL,
                    reference_no VARCHAR(100),
                    title VARCHAR(255),
                    user_name VARCHAR(100),
                    user_role VARCHAR(100),
                    total_items INT DEFAULT 0,
                    total_quantity DECIMAL(10, 2) DEFAULT 0.0,
                    data JSON NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_type (draft_type, updated_at)
                )
            """)
            conn.commit()
            cursor.close()
            conn.close()
        except Exception as e:
            print("init_stock_drafts_table error:", e)

    @staticmethod
    def get_stock_drafts(draft_type: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        if draft_type:
            cursor.execute("""
                SELECT * FROM stock_drafts 
                WHERE draft_type = %s 
                ORDER BY updated_at DESC
            """, (draft_type,))
        else:
            cursor.execute("""
                SELECT * FROM stock_drafts 
                ORDER BY updated_at DESC
            """)
        drafts = cursor.fetchall()
        cursor.close()
        conn.close()
        for d in drafts:
            if d.get('created_at') and hasattr(d['created_at'], 'isoformat'):
                d['created_at'] = d['created_at'].isoformat()
            if d.get('updated_at') and hasattr(d['updated_at'], 'isoformat'):
                d['updated_at'] = d['updated_at'].isoformat()
            if d.get('total_quantity') is not None:
                d['total_quantity'] = float(d['total_quantity'])
            if isinstance(d.get('data'), str):
                try:
                    d['data'] = json.loads(d['data'])
                except:
                    pass
        return drafts

    @staticmethod
    def get_stock_draft(draft_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM stock_drafts WHERE id = %s", (draft_id,))
        draft = cursor.fetchone()
        cursor.close()
        conn.close()
        if not draft:
            return None
        if draft.get('created_at') and hasattr(draft['created_at'], 'isoformat'):
            draft['created_at'] = draft['created_at'].isoformat()
        if draft.get('updated_at') and hasattr(draft['updated_at'], 'isoformat'):
            draft['updated_at'] = draft['updated_at'].isoformat()
        if draft.get('total_quantity') is not None:
            draft['total_quantity'] = float(draft['total_quantity'])
        if isinstance(draft.get('data'), str):
            try:
                draft['data'] = json.loads(draft['data'])
            except:
                pass
        return draft

    @staticmethod
    def save_stock_draft(draft: Dict[str, Any], draft_id: Optional[int] = None) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        draft_type = draft.get("draft_type", "STOCK_IN")
        reference_no = draft.get("reference_no", "")
        title = draft.get("title", "")
        user_name = draft.get("user_name", "Storekeeper")
        user_role = draft.get("user_role", "Storekeeper")
        total_items = int(draft.get("total_items", 0))
        total_quantity = float(draft.get("total_quantity", 0.0))
        data_json = json.dumps(draft.get("data", {}))

        if draft_id:
            cursor.execute("""
                UPDATE stock_drafts 
                SET draft_type = %s, reference_no = %s, title = %s, user_name = %s, user_role = %s,
                    total_items = %s, total_quantity = %s, data = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (draft_type, reference_no, title, user_name, user_role, total_items, total_quantity, data_json, draft_id))
            saved_id = draft_id
        else:
            cursor.execute("""
                INSERT INTO stock_drafts (draft_type, reference_no, title, user_name, user_role, total_items, total_quantity, data)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (draft_type, reference_no, title, user_name, user_role, total_items, total_quantity, data_json))
            saved_id = cursor.lastrowid

        conn.commit()
        cursor.close()
        conn.close()
        return DBStore.get_stock_draft(saved_id)

    @staticmethod
    def delete_stock_draft(draft_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM stock_drafts WHERE id = %s", (draft_id,))
        conn.commit()
        deleted = cursor.rowcount > 0
        cursor.close()
        conn.close()
        return deleted


class AssetStore:
    @staticmethod
    def get_assets() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT a.*, e.name as assigned_employee_name 
            FROM assets a 
            LEFT JOIN employees e ON a.assigned_to = e.id
        """)
        assets = cursor.fetchall()
        cursor.close()
        conn.close()
        for a in assets:
            if a.get('created_at'):
                a['created_at'] = a['created_at'].isoformat()
            if a.get('updated_at'):
                a['updated_at'] = a['updated_at'].isoformat()
            if a.get('purchase_date') and hasattr(a['purchase_date'], 'isoformat'):
                a['purchase_date'] = a['purchase_date'].isoformat()
            if a.get('purchase_cost') is not None:
                a['purchase_cost'] = float(a['purchase_cost'])
        return assets

    @staticmethod
    def add_asset(asset: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            INSERT INTO assets (asset_code, name, category, type, status, assigned_to, purchase_date, purchase_cost, serial_number, location_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            asset.get("asset_code"), asset.get("name"), asset.get("category"),
            asset.get("type", "COMPANY"), asset.get("status", "AVAILABLE"),
            asset.get("assigned_to"), asset.get("purchase_date"),
            asset.get("purchase_cost"), asset.get("serial_number"), asset.get("location_id")
        )
        cursor.execute(query, values)
        conn.commit()
        asset_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return AssetStore.get_asset(asset_id)

    @staticmethod
    def get_asset(asset_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT a.*, e.name as assigned_employee_name 
            FROM assets a 
            LEFT JOIN employees e ON a.assigned_to = e.id 
            WHERE a.id = %s
        """, (asset_id,))
        asset = cursor.fetchone()
        cursor.close()
        conn.close()
        if asset:
            if asset.get('created_at'):
                asset['created_at'] = asset['created_at'].isoformat()
            if asset.get('updated_at'):
                asset['updated_at'] = asset['updated_at'].isoformat()
            if asset.get('purchase_date') and hasattr(asset['purchase_date'], 'isoformat'):
                asset['purchase_date'] = asset['purchase_date'].isoformat()
            if asset.get('purchase_cost') is not None:
                asset['purchase_cost'] = float(asset['purchase_cost'])
        return asset

    @staticmethod
    def update_asset(asset_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        updates = []
        values = []
        allowed_fields = ["asset_code", "name", "category", "type", "status", "assigned_to", "purchase_date", "purchase_cost", "serial_number", "location_id"]
        for key in allowed_fields:
            if key in data:
                updates.append(f"{key} = %s")
                values.append(data[key])
                
        if not updates:
            return AssetStore.get_asset(asset_id)
            
        values.append(asset_id)
        query = f"UPDATE assets SET {', '.join(updates)} WHERE id = %s"
        cursor.execute(query, values)
        conn.commit()
        cursor.close()
        conn.close()
        return AssetStore.get_asset(asset_id)

    @staticmethod
    def delete_asset(asset_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM assets WHERE id = %s", (asset_id,))
        conn.commit()
        rows = cursor.rowcount
        cursor.close()
        conn.close()
        return rows > 0
