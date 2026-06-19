import sys
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
from app.config import settings

# Initialize Supabase client if credentials are provided
supabase_client = None
if not settings.use_mock_db:
    try:
        from supabase import create_client, Client
        supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        print("Connected to Supabase successfully!")
    except Exception as e:
        print(f"Error initializing Supabase client: {e}. Falling back to Mock DB.", file=sys.stderr)

# ==========================================
# MOCK DATABASE STORE (FALLBACK & SEED DATA)
# ==========================================

mock_vendors: List[Dict[str, Any]] = [
    {
        "id": 1,
        "name": "Siemens Industrial Electrics Ltd",
        "contact_person": "Aditya Sharma",
        "phone": "+91 98765 43210",
        "email": "sales@siemens-industrial.in",
        "address": "Tech Park, Block B, Bengaluru, KA",
        "gst_number": "29AAAAA1111A1Z1",
        "is_preferred": True,
        "created_at": datetime.now().isoformat()
    },
    {
        "id": 2,
        "name": "SKF Bearings India Co",
        "contact_person": "Neha Patel",
        "phone": "+91 87654 32109",
        "email": "support@skf-bearings.co.in",
        "address": "GIDC Industrial Estate, Vadodara, GJ",
        "gst_number": "24BBBBB2222B2Z2",
        "is_preferred": False,
        "created_at": datetime.now().isoformat()
    },
    {
        "id": 3,
        "name": "PackWell Box & Cartons Co",
        "contact_person": "Rajesh Kumar",
        "phone": "+91 76543 21098",
        "email": "order@packwell.co.in",
        "address": "Okhla Industrial Area, Phase-III, New Delhi",
        "gst_number": "07CCCCC3333C3Z3",
        "is_preferred": True,
        "created_at": datetime.now().isoformat()
    },
    {
        "id": 4,
        "name": "Apex Hydraulics Ltd",
        "contact_person": "Vikram Singh",
        "phone": "+91 99988 77766",
        "email": "contact@apex-hydraulics.com",
        "address": "Ambattur Industrial Estate, Chennai, TN",
        "gst_number": "33DDDDD4444D4Z4",
        "is_preferred": False,
        "created_at": datetime.now().isoformat()
    }
]

mock_products: List[Dict[str, Any]] = [
    {
        "id": 1,
        "code": "ELEC-001",
        "name": "MCB 16A Single Pole",
        "description": "Siemens high-performance single pole MCB for industrial lighting circuits.",
        "category": "Electrical",
        "unit": "pcs",
        "min_quantity": 10.00,
        "max_quantity": 100.00,
        "barcode": "8901072001147",
        "qr_code": "ELEC001QR",
        "image_url": "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?q=80&w=200&auto=format&fit=crop",
        "created_at": datetime.now().isoformat()
    },
    {
        "id": 2,
        "code": "ELEC-002",
        "name": "MCB 32A Double Pole",
        "description": "Siemens double pole circuit breaker for power distribution boards.",
        "category": "Electrical",
        "unit": "pcs",
        "min_quantity": 15.00,
        "max_quantity": 120.00,
        "barcode": "8901072001154",
        "qr_code": "ELEC002QR",
        "image_url": "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?q=80&w=200&auto=format&fit=crop",
        "created_at": datetime.now().isoformat()
    },
    {
        "id": 3,
        "code": "MECH-001",
        "name": "Ball Bearing 6204-2RSH",
        "description": "SKF deep groove ball bearing with rubber seals on both sides.",
        "category": "Mechanical",
        "unit": "pcs",
        "min_quantity": 20.00,
        "max_quantity": 150.00,
        "barcode": "7316576620478",
        "qr_code": "MECH001QR",
        "image_url": "https://images.unsplash.com/photo-1530124560072-aab8cf10d598?q=80&w=200&auto=format&fit=crop",
        "created_at": datetime.now().isoformat()
    },
    {
        "id": 4,
        "code": "MECH-002",
        "name": "Shaft Coupling D25 L30",
        "description": "Flexible spider jaw coupling, diameter 25mm, length 30mm.",
        "category": "Mechanical",
        "unit": "pcs",
        "min_quantity": 10.00,
        "max_quantity": 80.00,
        "barcode": "8902341234567",
        "qr_code": "MECH002QR",
        "image_url": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=200&auto=format&fit=crop",
        "created_at": datetime.now().isoformat()
    },
    {
        "id": 5,
        "code": "PACK-001",
        "name": "Carton Box Medium (5ply)",
        "description": "Heavy-duty 5-ply corrugated carton box for heavy material packing.",
        "category": "Packaging",
        "unit": "pcs",
        "min_quantity": 50.00,
        "max_quantity": 500.00,
        "barcode": "8904561239871",
        "qr_code": "PACK001QR",
        "image_url": "https://images.unsplash.com/photo-1595079676339-1534801ad6cf?q=80&w=200&auto=format&fit=crop",
        "created_at": datetime.now().isoformat()
    }
]

mock_product_vendors: List[Dict[str, Any]] = [
    {"product_id": 1, "vendor_id": 1, "is_preferred": True},
    {"product_id": 2, "vendor_id": 1, "is_preferred": True},
    {"product_id": 3, "vendor_id": 2, "is_preferred": True},
    {"product_id": 4, "vendor_id": 2, "is_preferred": False},
    {"product_id": 4, "vendor_id": 4, "is_preferred": True},
    {"product_id": 5, "vendor_id": 3, "is_preferred": True}
]

mock_locations: List[Dict[str, Any]] = [
    {"id": 1, "zone": "Zone A", "rack": "A1", "shelf": "Shelf 1", "bin": "Bin 1", "row_index": 0, "col_index": 0},
    {"id": 2, "zone": "Zone A", "rack": "A1", "shelf": "Shelf 1", "bin": "Bin 2", "row_index": 0, "col_index": 0},
    {"id": 3, "zone": "Zone A", "rack": "A1", "shelf": "Shelf 2", "bin": "Bin 1", "row_index": 0, "col_index": 0},
    {"id": 4, "zone": "Zone A", "rack": "A2", "shelf": "Shelf 2", "bin": "Bin 1", "row_index": 0, "col_index": 1},
    {"id": 5, "zone": "Zone A", "rack": "A2", "shelf": "Shelf 2", "bin": "Bin 2", "row_index": 0, "col_index": 1},
    {"id": 6, "zone": "Zone A", "rack": "A3", "shelf": "Shelf 1", "bin": "Bin 1", "row_index": 0, "col_index": 2},
    {"id": 7, "zone": "Zone A", "rack": "A4", "shelf": "Shelf 3", "bin": "Bin 2", "row_index": 0, "col_index": 3},
    
    {"id": 8, "zone": "Zone B", "rack": "B1", "shelf": "Shelf 3", "bin": "Bin 2", "row_index": 1, "col_index": 0},
    {"id": 9, "zone": "Zone B", "rack": "B1", "shelf": "Shelf 1", "bin": "Bin 1", "row_index": 1, "col_index": 0},
    {"id": 10, "zone": "Zone B", "rack": "B2", "shelf": "Shelf 1", "bin": "Bin 1", "row_index": 1, "col_index": 1},
    {"id": 11, "zone": "Zone B", "rack": "B3", "shelf": "Shelf 2", "bin": "Bin 1", "row_index": 1, "col_index": 2},
    {"id": 12, "zone": "Zone B", "rack": "B4", "shelf": "Shelf 3", "bin": "Bin 1", "row_index": 1, "col_index": 3},
    
    {"id": 13, "zone": "Zone C", "rack": "C1", "shelf": "Shelf 1", "bin": "Bin 1", "row_index": 2, "col_index": 0},
    {"id": 14, "zone": "Zone C", "rack": "C2", "shelf": "Shelf 2", "bin": "Bin 1", "row_index": 2, "col_index": 1},
    {"id": 15, "zone": "Zone C", "rack": "C3", "shelf": "Shelf 3", "bin": "Bin 1", "row_index": 2, "col_index": 2},
    {"id": 16, "zone": "Zone C", "rack": "C4", "shelf": "Shelf 1", "bin": "Bin 2", "row_index": 2, "col_index": 3}
]

mock_product_locations: List[Dict[str, Any]] = [
    {"product_id": 1, "location_id": 1, "quantity": 45.00},
    {"product_id": 1, "location_id": 3, "quantity": 20.00},
    {"product_id": 2, "location_id": 4, "quantity": 8.00},
    {"product_id": 3, "location_id": 8, "quantity": 5.00},
    {"product_id": 4, "location_id": 10, "quantity": 12.00},
    {"product_id": 5, "location_id": 13, "quantity": 0.00}
]

mock_inventory_transactions: List[Dict[str, Any]] = [
    {
        "id": 1,
        "created_at": datetime.now().isoformat(),
        "user_name": "Surya (Admin)",
        "user_role": "Administrator",
        "product_id": 1,
        "quantity": 50.00,
        "action": "STOCK_IN",
        "from_location_id": None,
        "to_location_id": 1,
        "remarks": "Initial batch intake for MCB 16A"
    },
    {
        "id": 2,
        "created_at": datetime.now().isoformat(),
        "user_name": "Surya (Admin)",
        "user_role": "Administrator",
        "product_id": 1,
        "quantity": 5.00,
        "action": "STOCK_OUT",
        "from_location_id": 1,
        "to_location_id": None,
        "remarks": "Issued 5 units to Maintenance Team"
    },
    {
        "id": 3,
        "created_at": datetime.now().isoformat(),
        "user_name": "Adarsh (Store Manager)",
        "user_role": "Store Manager",
        "product_id": 1,
        "quantity": 20.00,
        "action": "TRANSFER",
        "from_location_id": 1,
        "to_location_id": 3,
        "remarks": "Transfer for display shelf stock balancing"
    },
    {
        "id": 4,
        "created_at": datetime.now().isoformat(),
        "user_name": "Adarsh (Store Manager)",
        "user_role": "Store Manager",
        "product_id": 2,
        "quantity": 10.00,
        "action": "STOCK_IN",
        "from_location_id": None,
        "to_location_id": 4,
        "remarks": "Intake of MCB 32A"
    },
    {
        "id": 5,
        "created_at": datetime.now().isoformat(),
        "user_name": "Adarsh (Store Manager)",
        "user_role": "Store Manager",
        "product_id": 2,
        "quantity": 2.00,
        "action": "STOCK_OUT",
        "from_location_id": 4,
        "to_location_id": None,
        "remarks": "Replaced burnt out breaker in panel 4"
    },
    {
        "id": 6,
        "created_at": datetime.now().isoformat(),
        "user_name": "Rahul (Operator)",
        "user_role": "Store Operator",
        "product_id": 3,
        "quantity": 5.00,
        "action": "STOCK_IN",
        "from_location_id": None,
        "to_location_id": 8,
        "remarks": "Received from SKF"
    },
    {
        "id": 7,
        "created_at": datetime.now().isoformat(),
        "user_name": "Rahul (Operator)",
        "user_role": "Store Operator",
        "product_id": 4,
        "quantity": 15.00,
        "action": "STOCK_IN",
        "from_location_id": None,
        "to_location_id": 10,
        "remarks": "Received from Apex"
    },
    {
        "id": 8,
        "created_at": datetime.now().isoformat(),
        "user_name": "Rahul (Operator)",
        "user_role": "Store Operator",
        "product_id": 4,
        "quantity": 3.00,
        "action": "STOCK_OUT",
        "from_location_id": 10,
        "to_location_id": None,
        "remarks": "Used in conveyor assembly line"
    }
]

mock_purchase_requests: List[Dict[str, Any]] = [
    {
        "id": 1,
        "created_at": datetime.now().isoformat(),
        "requester": "Adarsh (Store Manager)",
        "status": "PENDING",
        "remarks": "Urgent request for prototype component assembly",
        "approved_at": None,
        "delivered_at": None,
        "change_remarks": None,
        "items": json.dumps([
            {"name": "USB-C Interface Board", "code": "REQ-001", "category": "Electrical", "unit": "pcs", "quantity": 30.00},
            {"name": "Aluminum Bracket M5", "code": "REQ-002", "category": "Mechanical", "unit": "pcs", "quantity": 15.00}
        ]),
        "history_logs": json.dumps([
            {"timestamp": datetime.now().isoformat(), "user": "Adarsh (Store Manager)", "action": "Raised request for new products"}
        ])
    },
    {
        "id": 2,
        "created_at": datetime.now().isoformat(),
        "requester": "Vikram (Purchase Team)",
        "status": "APPROVED",
        "remarks": "Order placed for custom packaging trials",
        "approved_at": datetime.now().isoformat(),
        "delivered_at": None,
        "change_remarks": "Approved after confirmation",
        "items": json.dumps([
            {"name": "Heavy Duty Box 10ply", "code": "REQ-003", "category": "Packaging", "unit": "pcs", "quantity": 50.00}
        ]),
        "history_logs": json.dumps([
            {"timestamp": datetime.now().isoformat(), "user": "Vikram (Purchase Team)", "action": "Raised request for custom packaging"},
            {"timestamp": datetime.now().isoformat(), "user": "Vikram (Purchase Team)", "action": "Approved request items"}
        ])
    }
]

# Database helper functions to access tables uniformly in routers
class DBStore:
    @staticmethod
    def get_vendors() -> List[Dict[str, Any]]:
        return mock_vendors

    @staticmethod
    def add_vendor(vendor: Dict[str, Any]) -> Dict[str, Any]:
        vendor["id"] = max([v["id"] for v in mock_vendors] or [0]) + 1
        vendor["created_at"] = datetime.now().isoformat()
        mock_vendors.append(vendor)
        return vendor

    @staticmethod
    def update_vendor(vendor_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        for v in mock_vendors:
            if v["id"] == vendor_id:
                v["name"] = data.get("name", v["name"])
                v["contact_person"] = data.get("contact_person", v["contact_person"])
                v["phone"] = data.get("phone", v["phone"])
                v["email"] = data.get("email", v["email"])
                v["address"] = data.get("address", v["address"])
                v["gst_number"] = data.get("gst_number", v["gst_number"])
                v["is_preferred"] = data.get("is_preferred", v["is_preferred"])
                return v
        raise ValueError(f"Vendor ID {vendor_id} not found.")

    @staticmethod
    def get_products() -> List[Dict[str, Any]]:
        products_enriched = []
        for p in mock_products:
            total_qty = sum(pl["quantity"] for pl in mock_product_locations if pl["product_id"] == p["id"])
            
            if total_qty == 0:
                status = "OUT_OF_STOCK"
            elif total_qty < p["min_quantity"] * 0.5:
                status = "CRITICAL"
            elif total_qty < p["min_quantity"]:
                status = "LOW_STOCK"
            else:
                status = "HEALTHY"
                
            # Preferred Vendor
            pref_vendor_id = next((pv["vendor_id"] for pv in mock_product_vendors if pv["product_id"] == p["id"] and pv["is_preferred"]), None)
            pref_vendor = next((v["name"] for v in mock_vendors if v["id"] == pref_vendor_id), "N/A")
            
            # Map of associated vendor IDs
            associated_vendor_ids = [pv["vendor_id"] for pv in mock_product_vendors if pv["product_id"] == p["id"]]
            
            prod_locs = []
            for pl in mock_product_locations:
                if pl["product_id"] == p["id"]:
                    loc = next((l for l in mock_locations if l["id"] == pl["location_id"]), None)
                    if loc:
                        prod_locs.append({
                            "location_id": loc["id"],
                            "zone": loc["zone"],
                            "rack": loc["rack"],
                            "shelf": loc["shelf"],
                            "bin": loc["bin"],
                            "row_index": loc["row_index"],
                            "col_index": loc["col_index"],
                            "quantity": pl["quantity"]
                        })

            products_enriched.append({
                **p,
                "current_quantity": total_qty,
                "status": status,
                "preferred_vendor": pref_vendor,
                "preferred_vendor_id": pref_vendor_id,
                "vendor_ids": associated_vendor_ids,
                "locations": prod_locs
            })
        return products_enriched

    @staticmethod
    def add_product(product: Dict[str, Any]) -> Dict[str, Any]:
        product["id"] = max([p["id"] for p in mock_products] or [0]) + 1
        product["created_at"] = datetime.now().isoformat()
        
        # Pull custom vendor keys if they were passed
        vendor_ids = product.pop("vendor_ids", [])
        preferred_vendor_id = product.pop("preferred_vendor_id", None)
        
        mock_products.append(product)
        
        # Save vendor mappings
        for v_id in vendor_ids:
            mock_product_vendors.append({
                "product_id": product["id"],
                "vendor_id": v_id,
                "is_preferred": (v_id == preferred_vendor_id)
            })
            
        return product

    @staticmethod
    def update_product(product_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        target_p = None
        for p in mock_products:
            if p["id"] == product_id:
                p["code"] = data.get("code", p["code"])
                p["name"] = data.get("name", p["name"])
                p["description"] = data.get("description", p["description"])
                p["category"] = data.get("category", p["category"])
                p["unit"] = data.get("unit", p["unit"])
                p["min_quantity"] = float(data.get("min_quantity", p["min_quantity"]))
                p["max_quantity"] = float(data.get("max_quantity", p["max_quantity"]))
                p["barcode"] = data.get("barcode", p["barcode"])
                p["qr_code"] = data.get("qr_code", p["qr_code"])
                p["image_url"] = data.get("image_url", p["image_url"])
                target_p = p
                break
                
        if not target_p:
            raise ValueError(f"Product ID {product_id} not found.")

        # Re-map vendors
        vendor_ids = data.get("vendor_ids", [])
        preferred_vendor_id = data.get("preferred_vendor_id", None)
        
        # Clear previous vendor mappings
        global mock_product_vendors
        mock_product_vendors = [pv for pv in mock_product_vendors if pv["product_id"] != product_id]
        
        # Insert updated vendor mappings
        for v_id in vendor_ids:
            mock_product_vendors.append({
                "product_id": product_id,
                "vendor_id": v_id,
                "is_preferred": (v_id == preferred_vendor_id)
            })
            
        return target_p

    @staticmethod
    def get_locations() -> List[Dict[str, Any]]:
        return mock_locations

    @staticmethod
    def get_product_locations() -> List[Dict[str, Any]]:
        return mock_product_locations

    @staticmethod
    def update_product_location(product_id: int, location_id: int, quantity_delta: float) -> float:
        for pl in mock_product_locations:
            if pl["product_id"] == product_id and pl["location_id"] == location_id:
                pl["quantity"] = max(0.0, pl["quantity"] + quantity_delta)
                return pl["quantity"]
        new_pl = {"product_id": product_id, "location_id": location_id, "quantity": max(0.0, quantity_delta)}
        mock_product_locations.append(new_pl)
        return new_pl["quantity"]

    @staticmethod
    def bulk_stock_out(stock_outs: List[Dict[str, Any]], user_name: str, user_role: str, recipient: str, remarks: Optional[str] = None) -> List[Dict[str, Any]]:
        # Validate stock availability first
        for item in stock_outs:
            p_id = item["product_id"]
            loc_id = item["location_id"]
            qty = item["quantity"]
            
            pl_record = next((pl for pl in mock_product_locations if pl["product_id"] == p_id and pl["location_id"] == loc_id), None)
            current_qty = pl_record["quantity"] if pl_record else 0.0
            
            if current_qty < qty:
                prod = next((p for p in mock_products if p["id"] == p_id), {"name": f"ID {p_id}"})
                raise ValueError(f"Insufficient stock for '{prod['name']}'. Available: {current_qty}, Requested: {qty}.")

        # Execute stock deductions
        detailed_items = []
        for item in stock_outs:
            p_id = item["product_id"]
            loc_id = item["location_id"]
            qty = item["quantity"]
            
            DBStore.update_product_location(p_id, loc_id, -qty)
            
            prod = next((p for p in mock_products if p["id"] == p_id), None)
            loc = next((l for l in mock_locations if l["id"] == loc_id), None)
            loc_label = f"{loc['zone']}-Rack {loc['rack']}-Shelf {loc['shelf']}-Bin {loc['bin']}" if loc else "Unknown"
            
            detailed_items.append({
                "product_id": p_id,
                "product_name": prod["name"] if prod else "Unknown",
                "product_code": prod["code"] if prod else "N/A",
                "location_id": loc_id,
                "location_label": loc_label,
                "quantity": qty,
                "remarks": item.get("remarks")
            })

        # Save single consolidated transaction
        tx = {
            "user_name": user_name,
            "user_role": user_role,
            "product_id": None,
            "quantity": sum(item["quantity"] for item in stock_outs),
            "action": "STOCK_OUT",
            "from_location_id": None,
            "to_location_id": None,
            "recipient": recipient,
            "remarks": remarks or "Bulk Dispatch",
            "items": json.dumps(detailed_items)
        }
        created_tx = DBStore.add_transaction(tx)
        return [created_tx]

    @staticmethod
    def bulk_stock_in(stock_ins: List[Dict[str, Any]], user_name: str, user_role: str, source: str, remarks: Optional[str] = None) -> List[Dict[str, Any]]:
        # Execute stock additions
        detailed_items = []
        for item in stock_ins:
            p_id = item["product_id"]
            loc_id = item["location_id"]
            qty = item["quantity"]
            
            DBStore.update_product_location(p_id, loc_id, qty)
            
            prod = next((p for p in mock_products if p["id"] == p_id), None)
            loc = next((l for l in mock_locations if l["id"] == loc_id), None)
            loc_label = f"{loc['zone']}-Rack {loc['rack']}-Shelf {loc['shelf']}-Bin {loc['bin']}" if loc else "Unknown"
            
            detailed_items.append({
                "product_id": p_id,
                "product_name": prod["name"] if prod else "Unknown",
                "product_code": prod["code"] if prod else "N/A",
                "location_id": loc_id,
                "location_label": loc_label,
                "quantity": qty,
                "remarks": item.get("remarks")
            })

        # Save single consolidated transaction
        tx = {
            "user_name": user_name,
            "user_role": user_role,
            "product_id": None,
            "quantity": sum(item["quantity"] for item in stock_ins),
            "action": "STOCK_IN",
            "from_location_id": None,
            "to_location_id": None,
            "recipient": source,  # supplier name maps to recipient in db schema
            "remarks": remarks or "Bulk Intake",
            "items": json.dumps(detailed_items)
        }
        created_tx = DBStore.add_transaction(tx)
        return [created_tx]

    @staticmethod
    def get_transactions() -> List[Dict[str, Any]]:
        txs = []
        for t in mock_inventory_transactions:
            if t.get("product_id") is None and t.get("items"):
                try:
                    items_parsed = json.loads(t["items"]) if isinstance(t["items"], str) else t["items"]
                except:
                    items_parsed = []
                is_stock_in = t.get("action") == "STOCK_IN"
                txs.append({
                    **t,
                    "product_name": "Bulk Intake" if is_stock_in else "Bulk Dispatch",
                    "product_code": "BULK",
                    "from_location": None if is_stock_in else "Multiple Locations",
                    "to_location": "Multiple Locations" if is_stock_in else None,
                    "items": items_parsed
                })
            else:
                prod = next((p for p in mock_products if p["id"] == t["product_id"]), None)
                from_loc = next((l for l in mock_locations if l["id"] == t["from_location_id"]), None) if t["from_location_id"] else None
                to_loc = next((l for l in mock_locations if l["id"] == t["to_location_id"]), None) if t["to_location_id"] else None
                
                txs.append({
                    **t,
                    "product_name": prod["name"] if prod else "Unknown",
                    "product_code": prod["code"] if prod else "N/A",
                    "from_location": f"{from_loc['zone']}-{from_loc['rack']}-{from_loc['shelf']}-{from_loc['bin']}" if from_loc else None,
                    "to_location": f"{to_loc['zone']}-{to_loc['rack']}-{to_loc['shelf']}-{to_loc['bin']}" if to_loc else None
                })
        return sorted(txs, key=lambda x: x["created_at"], reverse=True)

    @staticmethod
    def add_transaction(tx: Dict[str, Any]) -> Dict[str, Any]:
        tx["id"] = max([t["id"] for t in mock_inventory_transactions] or [0]) + 1
        tx["created_at"] = datetime.now().isoformat()
        mock_inventory_transactions.append(tx)
        return tx

    @staticmethod
    def get_purchase_requests() -> List[Dict[str, Any]]:
        reqs = []
        for r in mock_purchase_requests:
            try:
                items = json.loads(r["items"]) if isinstance(r["items"], str) else r["items"]
            except:
                items = []
            reqs.append({
                **r,
                "items": items
            })
        return sorted(reqs, key=lambda x: x["created_at"], reverse=True)

    @staticmethod
    def add_purchase_request(req: Dict[str, Any]) -> Dict[str, Any]:
        req["id"] = max([r["id"] for r in mock_purchase_requests] or [0]) + 1
        req["created_at"] = datetime.now().isoformat()
        req["approved_at"] = None
        req["delivered_at"] = None
        req["change_remarks"] = None
        
        history = [
            {"timestamp": req["created_at"], "user": req["requester"], "action": "Raised request for new products"}
        ]
        req["history_logs"] = json.dumps(history)
        
        if isinstance(req.get("items"), list):
            req["items"] = json.dumps(req["items"])
            
        mock_purchase_requests.append(req)
        return req

    @staticmethod
    def update_purchase_request(req_id: int, status: str, user_name: str, change_remarks: Optional[str] = None, items_updates: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        target_req = None
        for r in mock_purchase_requests:
            if r["id"] == req_id:
                target_req = r
                break
                
        if not target_req:
            raise ValueError(f"Request ID {req_id} not found.")

        old_status = target_req["status"]
        
        history = []
        try:
            history = json.loads(target_req["history_logs"] or "[]")
        except:
            pass
            
        history_actions = []
        
        # Adjust items if provided
        if items_updates:
            target_req["items"] = json.dumps(items_updates)
            history_actions.append("Adjusted requested items/quantities")

        # Check if status changed
        if status != old_status:
            target_req["status"] = status
            history_actions.append(f"Status changed from {old_status} to {status}")
            
            if status in ["APPROVED", "DECLINED"]:
                target_req["approved_at"] = datetime.now().isoformat()
            elif status == "DELIVERED":
                target_req["delivered_at"] = datetime.now().isoformat()
                
        if change_remarks:
            target_req["change_remarks"] = change_remarks
            
        # Update logs
        for act in history_actions:
            history.append({
                "timestamp": datetime.now().isoformat(),
                "user": user_name,
                "action": act + (f" (Remarks: {change_remarks})" if change_remarks else "")
            })
        target_req["history_logs"] = json.dumps(history)
        
        # Automated product registration on DELIVERED
        if status == "DELIVERED" and old_status != "DELIVERED":
            try:
                items = json.loads(target_req["items"]) if isinstance(target_req["items"], str) else target_req["items"]
            except:
                items = []
                
            for item in items:
                existing = [p for p in mock_products if p["code"].lower() == item["code"].lower()]
                if not existing:
                    new_prod = {
                        "id": max([p["id"] for p in mock_products] or [0]) + 1,
                        "code": item["code"],
                        "name": item["name"],
                        "description": "Auto registered from product request delivery.",
                        "category": item.get("category", "Electrical"),
                        "unit": item.get("unit", "pcs"),
                        "min_quantity": 0.0,
                        "max_quantity": 0.0,
                        "barcode": "",
                        "qr_code": "",
                        "image_url": "",
                        "created_at": datetime.now().isoformat()
                    }
                    mock_products.append(new_prod)
            
        return target_req
