import sys
import json
import mysql.connector
from typing import Dict, List, Any, Optional
from datetime import datetime
from app.config import settings

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
                   COALESCE(SUM(pl.quantity), 0) as current_quantity
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
            total_qty = float(p['current_quantity'] or 0)
            p['current_quantity'] = total_qty
            
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
            INSERT INTO products (code, name, description, category, unit, min_quantity, max_quantity, barcode, qr_code, image_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            product.get("code"), product.get("name"), product.get("description"),
            product.get("category"), product.get("unit", "pcs"), 
            product.get("min_quantity", 0), product.get("max_quantity", 0),
            product.get("barcode", ""), product.get("qr_code", ""), product.get("image_url", "")
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
                        
                    cursor.execute("INSERT INTO product_locations (product_id, location_id, quantity) VALUES (%s, %s, 0.00)", (p_id, loc_id))
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
        fields = ["code", "name", "description", "category", "unit", "min_quantity", "max_quantity", "barcode", "qr_code", "image_url"]
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
                            cursor.execute("INSERT INTO product_locations (product_id, location_id, quantity) VALUES (%s, %s, 0.00)", (product_id, loc_id))
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
                t['product_name'] = "Bulk Intake" if is_stock_in else "Bulk Dispatch"
                t['product_code'] = "BULK"
                t['from_location'] = None if is_stock_in else "Multiple Locations"
                t['to_location'] = "Multiple Locations" if is_stock_in else None
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
