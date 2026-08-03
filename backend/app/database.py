import sys
import json
import mysql.connector
from typing import Dict, List, Any, Optional
from datetime import datetime
from app.config import settings
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
                       WHERE bi.product_id = p.id AND b.status = 'APPROVED'
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
            
        return products

    @staticmethod
    def add_product(product: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """
            INSERT INTO products (code, name, description, category, unit, min_quantity, max_quantity, barcode, qr_code, image_url, manufacturer, link, standard_cost, latest_cost, average_cost, currency)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
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
        cursor.execute("SELECT id, name, role, phone, email, department, username, created_at FROM employees ORDER BY name ASC")
        employees = cursor.fetchall()
        cursor.close()
        conn.close()
        for emp in employees:
            if emp.get('created_at'):
                emp['created_at'] = emp['created_at'].isoformat()
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
    def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, role, username, password_hash, email, department FROM employees WHERE username = %s", (username,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if user and user.get("password_hash"):
            # Check password
            if bcrypt.checkpw(password.encode('utf-8'), user["password_hash"].encode('utf-8')):
                del user["password_hash"]
                return user
        return None

    # PROJECTS METHODS
    @staticmethod
    def get_projects(page: int = 1, limit: int = 100, search: str = None, status: str = None) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        where_clauses = []
        params = []

        if search:
            where_clauses.append("(p.name LIKE %s OR p.code LIKE %s OR p.client_name LIKE %s)")
            params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

        if status and status != 'All':
            where_clauses.append("p.status = %s")
            params.append(status)

        where_str = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        # Count total
        cursor.execute(f"SELECT COUNT(*) as total FROM projects p {where_str}", tuple(params))
        total = cursor.fetchone()["total"]

        offset = (page - 1) * limit
        params.extend([limit, offset])

        cursor.execute(f"""
            SELECT p.*,
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
            if p.get('start_date') and hasattr(p['start_date'], 'isoformat'):
                p['start_date'] = p['start_date'].isoformat()
            if p.get('end_date') and hasattr(p['end_date'], 'isoformat'):
                p['end_date'] = p['end_date'].isoformat()
            if p.get('date_of_delivery') and hasattr(p['date_of_delivery'], 'isoformat'):
                p['date_of_delivery'] = p['date_of_delivery'].isoformat()
            
            # boolean conversion
            for k in ['has_software', 'has_firmware', 'has_transformer']:
                if k in p:
                    p[k] = bool(p[k])
                    
            # Calculate completion percentage
            total_tasks = p.get('total_dynamic_tasks', 0) + p.get('total_static_tasks', 0)
            completed_tasks = p.get('completed_dynamic_tasks', 0) + p.get('completed_static_tasks', 0)
            
            # Remove intermediate keys if desired, or keep them for frontend usage
            # p.pop('total_dynamic_tasks', None)
            # p.pop('completed_dynamic_tasks', None)
            # p.pop('total_static_tasks', None)
            # p.pop('completed_static_tasks', None)
            
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
    def get_all_projects_unpaginated() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM projects")
        projects = cursor.fetchall()
        cursor.close()
        conn.close()
        return projects

    @staticmethod
    def add_project(project: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            INSERT INTO projects (code, name, po_number, client_name, description, status, start_date, end_date, 
                                  project_incharge, has_software, has_firmware, has_transformer, no_of_panels, folder_path, date_of_delivery)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            project.get("code"), project.get("name"), project.get("po_number"),
            project.get("client_name"), project.get("description"), project.get("status", "PLANNING"),
            project.get("start_date") or None, project.get("end_date") or None,
            project.get("project_incharge"), 
            1 if project.get("has_software") else 0,
            1 if project.get("has_firmware") else 0,
            1 if project.get("has_transformer") else 0,
            project.get("no_of_panels", 1),
            project.get("folder_path"),
            project.get("date_of_delivery") or None
        )
        cursor.execute(query, values)
        conn.commit()
        project["id"] = cursor.lastrowid
        project["created_at"] = datetime.now().isoformat()
        cursor.close()
        conn.close()
        return project

    @staticmethod
    def update_project(proj_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        updates = []
        values = []
        for key in ["code", "name", "po_number", "client_name", "description", "status", "start_date", "end_date", "project_incharge", "no_of_panels", "folder_path", "date_of_delivery"]:
            if key in data:
                updates.append(f"{key} = %s")
                if key in ["start_date", "end_date", "date_of_delivery"] and not data[key]:
                    values.append(None)
                else:
                    values.append(data[key])
                    
        for key in ["has_software", "has_firmware", "has_transformer"]:
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
            for k in ['has_software', 'has_firmware', 'has_transformer']:
                if k in p:
                    p[k] = bool(p[k])
        return p

    @staticmethod
    def delete_project(proj_id: int) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("DELETE FROM projects WHERE id = %s", (proj_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return True

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
    def get_dynamic_tasks(project_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT t.*, e.name as assignee_name, e.role as assignee_role 
            FROM dynamic_tasks t
            LEFT JOIN employees e ON t.assignee_id = e.id
            WHERE t.project_id = %s
            ORDER BY t.id ASC
        """, (project_id,))
        tasks = cursor.fetchall()
        cursor.close()
        conn.close()
        for t in tasks:
            if t.get('created_at'):
                t['created_at'] = t['created_at'].isoformat()
            if t.get('updated_at'):
                t['updated_at'] = t['updated_at'].isoformat()
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
            SELECT dt.*, e.name as assignee_name, p.name as project_name
            FROM dynamic_tasks dt
            LEFT JOIN employees e ON dt.assignee_id = e.id
            LEFT JOIN projects p ON dt.project_id = p.id
            ORDER BY dt.created_at DESC
        """
        cursor.execute(query)
        tasks = cursor.fetchall()
        cursor.close()
        conn.close()
        for t in tasks:
            if t.get('created_at'):
                t['created_at'] = t['created_at'].isoformat()
            if t.get('updated_at'):
                t['updated_at'] = t['updated_at'].isoformat()
            if t.get('start_date') and hasattr(t['start_date'], 'isoformat'):
                t['start_date'] = t['start_date'].isoformat()
            if t.get('due_date') and hasattr(t['due_date'], 'isoformat'):
                t['due_date'] = t['due_date'].isoformat()
        return tasks

    @staticmethod
    def add_dynamic_task(project_id: int, task: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            INSERT INTO dynamic_tasks (project_id, parent_id, title, description, status, priority, assignee_id, start_date, due_date, dependencies)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            project_id,
            task.get("parent_id") or None,
            task.get("title"),
            task.get("description") or None,
            task.get("status", "TODO"),
            task.get("priority", "MEDIUM"),
            task.get("assignee_id") or None,
            task.get("start_date") or None,
            task.get("due_date") or None,
            task.get("dependencies") or None
        )
        cursor.execute(query, values)
        conn.commit()
        task_id = cursor.lastrowid
        cursor.close()
        conn.close()
        task["id"] = task_id
        task["project_id"] = project_id
        return task

    @staticmethod
    def update_dynamic_task(task_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        updates = []
        values = []
        fields = ["parent_id", "title", "description", "status", "priority", "assignee_id", "start_date", "due_date", "dependencies"]
        for key in fields:
            if key in data:
                updates.append(f"{key} = %s")
                if key in ["parent_id", "assignee_id", "start_date", "due_date", "dependencies"] and not data[key]:
                    values.append(None)
                else:
                    values.append(data[key])
                    
        if not updates:
            cursor.close()
            conn.close()
            return data
            
        values.append(task_id)
        query = f"UPDATE dynamic_tasks SET {', '.join(updates)} WHERE id = %s"
        cursor.execute(query, values)
        conn.commit()
        
        cursor.execute("SELECT * FROM dynamic_tasks WHERE id = %s", (task_id,))
        t = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if t:
            if t.get('created_at'):
                t['created_at'] = t['created_at'].isoformat()
            if t.get('updated_at'):
                t['updated_at'] = t['updated_at'].isoformat()
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
    def get_boms(project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        if project_id:
            cursor.execute("""
                SELECT b.*, p.name as project_name, p.code as project_code 
                FROM boms b
                LEFT JOIN projects p ON b.project_id = p.id
                WHERE b.project_id = %s
                ORDER BY b.id DESC
            """, (project_id,))
        else:
            cursor.execute("""
                SELECT b.*, p.name as project_name, p.code as project_code 
                FROM boms b
                LEFT JOIN projects p ON b.project_id = p.id
                ORDER BY b.id DESC
            """)
        boms = cursor.fetchall()
        cursor.close()
        conn.close()
        for b in boms:
            if b.get('created_at'):
                b['created_at'] = b['created_at'].isoformat()
            if b.get('updated_at'):
                b['updated_at'] = b['updated_at'].isoformat()
        return boms

    @staticmethod
    def create_bom(project_id: int, name: str, items: List[Dict[str, Any]], status: str = 'DRAFT') -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            INSERT INTO boms (project_id, name, status)
            VALUES (%s, %s, %s)
        """, (project_id, name, status))
        bom_id = cursor.lastrowid
        
        for item in items:
            product_id = item.get("product_id")
            cursor.execute("""
                INSERT INTO bom_items (bom_id, product_id, manual_product_name, part_number, manufacturer, link, quantity_required, quantity_issued, remarks, custom_fields)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                bom_id, 
                product_id if product_id else None,
                item.get("manual_product_name"),
                item.get("part_number"),
                item.get("manufacturer"),
                item.get("link"),
                item.get("quantity_required", 1), 
                0.00, 
                item.get("remarks", ""),
                json.dumps(item.get("custom_fields", {}))
            ))
            
        conn.commit()
        cursor.close()
        conn.close()
        return {"id": bom_id, "project_id": project_id, "name": name, "status": "DRAFT"}

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
            
        if bom.get('created_at'):
            bom['created_at'] = bom['created_at'].isoformat()
        if bom.get('updated_at'):
            bom['updated_at'] = bom['updated_at'].isoformat()
            
        cursor.execute("""
            SELECT bi.id, bi.bom_id, bi.product_id, bi.quantity_required, bi.quantity_issued, bi.remarks,
                   bi.manual_product_name, bi.part_number, bi.manufacturer, bi.link, bi.custom_fields,
                   p.name as product_name, p.code as product_code, p.unit as product_unit,
                   COALESCE((SELECT SUM(quantity) FROM product_locations WHERE product_id = bi.product_id), 0.00) as current_stock
            FROM bom_items bi
            LEFT JOIN products p ON bi.product_id = p.id
            WHERE bi.bom_id = %s
        """, (bom_id,))
        items = cursor.fetchall()
        for item in items:
            item["quantity_required"] = float(item["quantity_required"])
            item["quantity_issued"] = float(item["quantity_issued"])
            item["current_stock"] = float(item["current_stock"])
            
            if not item.get("product_id"):
                item["product_name"] = item.get("manual_product_name") or "Manual Item"
                item["product_code"] = "MANUAL"
                item["product_unit"] = "pcs"
            
            try:
                item["custom_fields"] = json.loads(item.get("custom_fields") or "{}")
            except:
                item["custom_fields"] = {}
            
        bom["items"] = items
        cursor.close()
        conn.close()
        return bom

    @staticmethod
    def update_bom_status(bom_id: int, status: str) -> bool:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("UPDATE boms SET status = %s WHERE id = %s", (status, bom_id))
        conn.commit()
        cursor.close()
        conn.close()
        return True

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
                                      date_of_delivery, constraints, budget, priority)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                project_data.get("priority", "MEDIUM")
            )
            cursor.execute(query_proj, proj_values)
            project_id = cursor.lastrowid

            # Maps to keep track of generated IDs to database IDs
            phase_id_map = {}
            task_id_map = {}

            # 2. Insert Phases (as parent tasks in dynamic_tasks)
            for phase in plan_json.get("phases", []):
                query_phase = """
                    INSERT INTO dynamic_tasks (project_id, parent_id, title, description, status, priority)
                    VALUES (%s, NULL, %s, %s, 'TODO', 'MEDIUM')
                """
                cursor.execute(query_phase, (project_id, phase["name"], phase.get("description") or ""))
                db_phase_id = cursor.lastrowid
                phase_id_map[phase["id"]] = db_phase_id

            # 3. Insert Tasks (as child tasks in dynamic_tasks pointing to phase task ID)
            for t in plan_json.get("tasks", []):
                db_phase_id = phase_id_map.get(t["phaseId"])
                query_task = """
                    INSERT INTO dynamic_tasks (project_id, parent_id, title, description, status, priority, start_date, due_date)
                    VALUES (%s, %s, %s, %s, 'TODO', %s, %s, %s)
                """
                cursor.execute(query_task, (
                    project_id,
                    db_phase_id,
                    t["name"],
                    t.get("description") or "",
                    t.get("priority", "MEDIUM"),
                    t.get("earliestStartDate") or None,
                    t.get("earliestFinishDate") or None
                ))
                db_task_id = cursor.lastrowid
                task_id_map[t["id"]] = db_task_id

            # 4. Insert Subtasks (as child tasks in dynamic_tasks pointing to task task ID)
            for sub in plan_json.get("subtasks", []):
                db_task_id = task_id_map.get(sub["taskId"])
                if db_task_id:
                    query_sub = """
                        INSERT INTO dynamic_tasks (project_id, parent_id, title, status, priority)
                        VALUES (%s, %s, %s, 'TODO', 'MEDIUM')
                    """
                    cursor.execute(query_sub, (project_id, db_task_id, sub["name"]))

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
        cursor.execute("SELECT * FROM announcements WHERE is_active = TRUE ORDER BY created_at DESC LIMIT %s", (limit,))
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
            if t.get('created_at'):
                t['created_at'] = t['created_at'].isoformat()
            if t.get('closed_at'):
                t['closed_at'] = t['closed_at'].isoformat()
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
            if p_id == "":
                p_id = None
                
            cursor.execute(query, (
                p_id,
                data.get("custom_project_name"),
                data.get("creator_id"),
                data.get("assignee_id"),
                data["title"],
                data.get("description", ""),
                json.dumps(history)
            ))
            ticket_id = cursor.lastrowid
            conn.commit()
            return ticket_id
        except Exception as e:
            conn.rollback()
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
            
            if "assignee_id" in data and data["assignee_id"] != ticket.get("assignee_id"):
                updates.append("assignee_id = %s")
                values.append(data["assignee_id"])
                history.append({"action": f"Assigned to employee {data['assignee_id']}", "timestamp": datetime.now().isoformat()})
                
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
            
            cursor.execute("SELECT * FROM service_tickets WHERE id = %s", (ticket_id,))
            updated_ticket = cursor.fetchone()
            
            if updated_ticket:
                if updated_ticket.get('created_at'):
                    updated_ticket['created_at'] = updated_ticket['created_at'].isoformat()
                if updated_ticket.get('closed_at'):
                    updated_ticket['closed_at'] = updated_ticket['closed_at'].isoformat()
                    
            return updated_ticket
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def update_project(project_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            updates = []
            values = []
            for k, v in data.items():
                updates.append(f"{k} = %s")
                values.append(v)
            if not updates:
                return None
            values.append(project_id)
            query = f"UPDATE projects SET {', '.join(updates)} WHERE id = %s"
            cursor.execute(query, tuple(values))
            conn.commit()
            
            cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
            updated_proj = cursor.fetchone()
            if updated_proj and updated_proj.get('created_at'):
                updated_proj['created_at'] = updated_proj['created_at'].isoformat()
            if updated_proj and updated_proj.get('start_date'):
                updated_proj['start_date'] = updated_proj['start_date'].isoformat()
            if updated_proj and updated_proj.get('end_date'):
                updated_proj['end_date'] = updated_proj['end_date'].isoformat()
            return updated_proj
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
