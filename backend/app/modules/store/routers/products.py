from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.database import DBStore
from app.dependencies import get_current_user

router = APIRouter(prefix="/products", tags=["Products"])

class ProductCreate(BaseModel):
    code: str = Field(..., description="Unique product identifier code")
    name: str = Field(..., description="Name of the product")
    description: Optional[str] = None
    category: str
    unit: str = "pcs"
    min_quantity: float = 0.0
    max_quantity: float = 0.0
    barcode: Optional[str] = None
    qr_code: Optional[str] = None
    image_url: Optional[str] = None
    vendor_ids: List[int] = []
    preferred_vendor_id: Optional[int] = None
    manufacturer: Optional[str] = None
    link: Optional[str] = None
    initial_quantity: float = 0.0
    standard_cost: float = 0.0
    latest_cost: float = 0.0
    average_cost: float = 0.0
    currency: str = "INR"

class ProductUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    min_quantity: Optional[float] = None
    max_quantity: Optional[float] = None
    barcode: Optional[str] = None
    qr_code: Optional[str] = None
    image_url: Optional[str] = None
    vendor_ids: Optional[List[int]] = None
    preferred_vendor_id: Optional[int] = None
    manufacturer: Optional[str] = None
    link: Optional[str] = None
    standard_cost: Optional[float] = None
    latest_cost: Optional[float] = None
    average_cost: Optional[float] = None
    currency: Optional[str] = None
    initial_quantity: Optional[float] = None

@router.get("")
def list_products():
    return DBStore.get_products()

@router.post("")
def create_product(product: ProductCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    if current_user.get("role") != "Administrator":
        raise HTTPException(status_code=403, detail="Only administrators can add items to the inventory catalog.")
    # Check if product code already exists
    existing = [p for p in DBStore.get_products() if p["code"] == product.code]
    if existing:
        raise HTTPException(status_code=400, detail=f"Product with code '{product.code}' already exists.")
    
    # Check if product with the same part number already exists
    import json
    new_desc = product.description or ""
    new_part_no = ""
    try:
        new_parsed = json.loads(new_desc)
        new_part_no = (
            new_parsed.get("specifications", {}).get("partNumber", "") or 
            new_parsed.get("additional", {}).get("manufacturerPartNumber", "")
        )
    except Exception:
        pass

    new_part_no = new_part_no.strip().lower()
    if new_part_no:
        for p in DBStore.get_products():
            p_desc = p.get("description") or ""
            try:
                p_parsed = json.loads(p_desc)
                p_part_no = (
                    p_parsed.get("specifications", {}).get("partNumber", "") or 
                    p_parsed.get("additional", {}).get("manufacturerPartNumber", "") or
                    p_parsed.get("additional", {}).get("supplierPartNumber", "")
                )
                if p_part_no.strip().lower() == new_part_no:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Product with part number '{new_part_no}' already exists with code '{p.get('code')}'"
                    )
            except Exception as e:
                if isinstance(e, HTTPException):
                    raise e
                continue

    new_product = product.model_dump()
    created = DBStore.add_product(new_product)
    return created

@router.get("/fetch-mpn-details")
def fetch_mpn_details(mpn: str):
    import urllib.parse
    import requests
    from bs4 import BeautifulSoup
    import re

    if not mpn or len(mpn.strip()) < 3:
        raise HTTPException(status_code=400, detail="Please provide a valid manufacturer part number (MPN).")

    mpn = mpn.strip()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
    }

    combined_desc = ""
    product_name = mpn
    datasheet_url = None
    extracted_brand = "Unknown"

    if mpn.startswith("http://") or mpn.startswith("https://"):
        url = mpn
        try:
            res = requests.get(url, headers=headers, timeout=15)
            res.raise_for_status()
            
            content_type = res.headers.get("Content-Type", "")
            if "application/pdf" in content_type or url.lower().endswith(".pdf"):
                import PyPDF2
                import io
                datasheet_url = url
                pdf_file = io.BytesIO(res.content)
                reader = PyPDF2.PdfReader(pdf_file)
                text = ""
                for i in range(min(5, len(reader.pages))):
                    text += reader.pages[i].extract_text() + "\n"
                combined_desc = text
                product_name = "Imported via PDF"
            else:
                soup = BeautifulSoup(res.text, "html.parser")
                # Remove script and style elements
                for script in soup(["script", "style"]):
                    script.extract()
                combined_desc = soup.get_text(separator=" ", strip=True)
                product_name = soup.title.get_text(strip=True) if soup.title else "Imported via URL"
                datasheet_url = url

        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {str(e)}")
            
    else:
        # DuckDuckGo HTML search performs better and returns actual results via POST query
        search_url = "https://html.duckduckgo.com/html/"
        
        try:
            res = requests.post(search_url, data={"q": mpn}, headers=headers, timeout=10)
            res.raise_for_status()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to query search engine: {str(e)}")

        soup = BeautifulSoup(res.text, "html.parser")
        results = soup.select(".result__snippet")
        links = soup.select("a.result__url")
        titles = soup.select(".result__title")

        description_snippets = [snippet.get_text(strip=True) for snippet in results[:3]]
        combined_desc = " | ".join(description_snippets) if description_snippets else f"Details for part number {mpn}."
        
        for link in links:
            href = link.get('href', '')
            if ".pdf" in href.lower() or "datasheet" in href.lower():
                datasheet_url = href.strip()
                break

        if titles:
            raw_title = titles[0].get_text(strip=True)
            raw_title = re.sub(r"\s*\|\s*.*", "", raw_title)
            raw_title = re.sub(r"\s*-\s*.*", "", raw_title)
            if len(raw_title) > len(mpn):
                product_name = raw_title

    # Image URL defaults to None since we only set it if a proper image is extracted
    # Detect brands from text
    desc_lower = combined_desc.lower()
    mpn_lower = mpn.lower()
    
    if mpn_lower.startswith("6es7") or "siemens" in desc_lower:
        extracted_brand = "Siemens"
    elif mpn_lower.startswith("lc1") or mpn_lower.startswith("a9f") or "schneider" in desc_lower:
        extracted_brand = "Schneider Electric"
    elif "omron" in desc_lower:
        extracted_brand = "Omron"
    elif "abb" in desc_lower:
        extracted_brand = "ABB"
    elif "kemet" in desc_lower:
        extracted_brand = "KEMET"

    # Guess category
    category = "Electrical"
    if "plc" in desc_lower or "module" in desc_lower or "programmable logic" in desc_lower:
        category = "PLC"
    elif "capacitor" in desc_lower or "capacitance" in desc_lower or "mlcc" in desc_lower:
        category = "CAPACITOR"
    elif "acb" in desc_lower or "air circuit breaker" in desc_lower:
        category = "ACB"
    elif "mccb" in desc_lower or "moulded case" in desc_lower or "molded case" in desc_lower:
        category = "MCCB"
    elif "breaker" in desc_lower or "mcb" in desc_lower or "rcbo" in desc_lower:
        category = "MCB"
    elif "contactor" in desc_lower or "contactors" in desc_lower:
        category = "CONTACTOR"
    elif "fuse" in desc_lower or "fuses" in desc_lower or "silized" in desc_lower:
        category = "FUSE"
    elif "relay" in desc_lower or "relays" in desc_lower:
        category = "RELAY"

    # Image URL defaults to None since we only set it if a proper image is extracted
    image_url = None

    # Construct simple specifications list
    specs = {
        "Part Number / MPN": mpn if not (mpn.startswith("http://") or mpn.startswith("https://")) else "Extracted from URL",
        "Brand": extracted_brand,
    }
    
    # Try parsing specs from description
    amp_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:a|amp|ampere)", combined_desc, re.IGNORECASE)
    if amp_match and category != "CAPACITOR":
        specs["Current Rating"] = f"{amp_match.group(1)}A"
    
    volt_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:v|volt|vdc|vac)", combined_desc, re.IGNORECASE)
    if volt_match:
        specs["Voltage Rating"] = f"{volt_match.group(1)}V"
        
    poles_match = re.search(r"(\d+)\s*(?:pole|p\b)", combined_desc, re.IGNORECASE)
    if poles_match:
        specs["Poles"] = f"{poles_match.group(1)}P"

    cap_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:uf|nf|pf|µf|microfarad|nanofarad|picofarad)", combined_desc, re.IGNORECASE)
    if cap_match:
        specs["Capacitance"] = cap_match.group(0).strip()

    if category == "CAPACITOR":
        # Extract Package / Size
        pkg_match = re.search(r"\b(0201|0402|0603|0805|1206|1210|1808|1812|2220)\b", combined_desc)
        if pkg_match:
            specs["Package / Size"] = pkg_match.group(1)
        else:
            pkg_mpn = re.search(r"(0201|0402|0603|0805|1206|1210|1808|1812|2220)", mpn)
            if pkg_mpn:
                specs["Package / Size"] = pkg_mpn.group(1)

        # Extract Dielectric
        dielectric_match = re.search(r"\b(X7R|X5R|C0G|NP0|Y5V|Z5U)\b", combined_desc, re.IGNORECASE)
        if dielectric_match:
            specs["Dielectric"] = dielectric_match.group(1).upper()
        else:
            dielectric_mpn = re.search(r"(X7R|X5R|C0G|NP0|Y5V|Z5U)", mpn, re.IGNORECASE)
            if dielectric_mpn:
                specs["Dielectric"] = dielectric_mpn.group(1).upper()

        # Extract Tolerance
        tol_match = re.search(r"(±\s*\d+%|\b\d+\s*%)", combined_desc)
        if tol_match:
            specs["Tolerance"] = tol_match.group(1).replace(" ", "")

    return {
        "brand": extracted_brand,
        "name": product_name,
        "description": combined_desc[:250] + "..." if len(combined_desc) > 250 else combined_desc,
        "category": category,
        "image_url": image_url,
        "datasheet_url": datasheet_url,
        "specifications": specs
    }

@router.put("/{product_id}")
def update_product(product_id: int, product: ProductUpdate):
    try:
        updated = DBStore.update_product(product_id, product.model_dump(exclude_unset=True))
        return updated
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{product_id}")
def delete_product(product_id: int):
    try:
        DBStore.delete_product(product_id)
        return {"success": True, "message": "Product deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



