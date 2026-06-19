from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any
from app.database import DBStore

router = APIRouter(prefix="/layout", tags=["Digital Twin Store Layout"])

@router.get("/racks")
def get_all_racks():
    """
    Returns unique list of racks, their zone, and coordinates for the visual grid.
    """
    locations = DBStore.get_locations()
    racks_map = {}
    
    for loc in locations:
        key = (loc["zone"], loc["rack"])
        if key not in racks_map:
            # Let's count how many shelves are in this rack
            rack_shelves = set(l["shelf"] for l in locations if l["rack"] == loc["rack"] and l["zone"] == loc["zone"])
            rack_bins = set(l["bin"] for l in locations if l["rack"] == loc["rack"] and l["zone"] == loc["zone"])
            
            # Find what items are currently stored in this rack
            stored_products_set = set()
            for l in locations:
                if l["rack"] == loc["rack"] and l["zone"] == loc["zone"]:
                    for pl in DBStore.get_product_locations():
                        if pl["location_id"] == l["id"] and pl["quantity"] > 0:
                            prod = next((p for p in DBStore.get_products() if p["id"] == pl["product_id"]), None)
                            if prod:
                                stored_products_set.add(prod["name"])

            racks_map[key] = {
                "zone": loc["zone"],
                "rack": loc["rack"],
                "row_index": loc["row_index"],
                "col_index": loc["col_index"],
                "shelves_count": len(rack_shelves),
                "bins_count": len(rack_bins),
                "stored_items": list(stored_products_set)
            }
            
    return list(racks_map.values())

@router.get("/rack/{rack_code}")
def get_rack_detail(rack_code: str):
    """
    Drills down into a specific rack, returning shelves, bins, and quantities.
    """
    locations = DBStore.get_locations()
    rack_locs = [l for l in locations if l["rack"].lower() == rack_code.lower()]
    
    if not rack_locs:
        raise HTTPException(status_code=404, detail=f"Rack '{rack_code}' not found in store.")
        
    zone = rack_locs[0]["zone"]
    row_index = rack_locs[0]["row_index"]
    col_index = rack_locs[0]["col_index"]
    
    # Structure: Shelves -> Bins -> Content
    shelves_dict: Dict[str, Any] = {}
    
    for loc in rack_locs:
        shelf_name = loc["shelf"]
        bin_name = loc["bin"]
        
        if shelf_name not in shelves_dict:
            shelves_dict[shelf_name] = []
            
        # Check what products are in this specific bin location
        bin_contents = []
        for pl in DBStore.get_product_locations():
            if pl["location_id"] == loc["id"]:
                prod = next((p for p in DBStore.get_products() if p["id"] == pl["product_id"]), None)
                if prod:
                    bin_contents.append({
                        "product_id": prod["id"],
                        "product_name": prod["name"],
                        "product_code": prod["code"],
                        "quantity": pl["quantity"],
                        "unit": prod["unit"]
                    })
                    
        shelves_dict[shelf_name].append({
            "location_id": loc["id"],
            "bin": bin_name,
            "contents": bin_contents
        })
        
    # Format as list of shelves
    shelves_list = []
    for shelf_name, bins in shelves_dict.items():
        # Sort bins alphabetically
        bins.sort(key=lambda x: x["bin"])
        shelves_list.append({
            "shelf": shelf_name,
            "bins": bins
        })
        
    # Sort shelves alphabetically (e.g. Shelf 1, Shelf 2)
    shelves_list.sort(key=lambda x: x["shelf"])
    
    return {
        "zone": zone,
        "rack": rack_code,
        "row_index": row_index,
        "col_index": col_index,
        "shelves": shelves_list
    }
