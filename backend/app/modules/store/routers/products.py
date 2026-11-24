from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.database import DBStore, ProductCategoryStore
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

def _match_best_category(
    categories: List[Dict[str, Any]],
    text: str,
    mpn: str,
    hint_category_code: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    import re

    haystack = f"{text} {mpn}".lower()
    best_cat = None
    best_score = 0

    for cat in categories:
        score = 0
        code = (cat.get("code") or "").lower()
        label = (cat.get("label") or "").lower()
        aliases = [str(a).lower() for a in (cat.get("aliases") or []) if a]
        keywords = [str(k).lower() for k in (cat.get("keywords") or []) if k]

        # Build deduplicated search terms with weights
        terms = []
        if code:
            terms.append((code, 3))
        if label and label != code:
            terms.append((label, 3))
        for a in aliases:
            terms.append((a, 2))
        for kw in keywords:
            terms.append((kw, 2))

        seen_terms = set()
        for term, weight in terms:
            term = term.strip()
            if not term or term in seen_terms:
                continue
            seen_terms.add(term)
            if len(term) <= 4:
                if re.search(rf"\b{re.escape(term)}\b", haystack):
                    score += weight + (1 if len(term) >= 3 else 0)
            else:
                if term in haystack:
                    # Prefer longer, more specific multi-word matches
                    score += weight + (2 if " " in term else 1)

        if score > best_score:
            best_score = score
            best_cat = cat

    if best_cat and best_score > 0:
        return best_cat

    if hint_category_code:
        for cat in categories:
            if (cat.get("code") or "").lower() == hint_category_code.lower():
                return cat

    return None


def _extract_generic_engineering_specs(combined_desc: str, mpn: str) -> Dict[str, str]:
    import re

    extracted: Dict[str, str] = {}

    # Voltage (prefer explicit AC/DC voltage)
    volt_match = re.search(r"(\d+(?:\.\d+)?)\s*(V\s*(?:DC|AC)|VDC|VAC|V\b|Volt(?:s)?)", combined_desc, re.IGNORECASE)
    if volt_match:
        num = volt_match.group(1)
        unit = volt_match.group(2).upper().replace("VOLTS", "V").replace("VOLT", "V").strip()
        if unit in ("VDC", "V DC"):
            extracted["voltage"] = f"{num}V DC"
        elif unit in ("VAC", "V AC"):
            extracted["voltage"] = f"{num}V AC"
        else:
            extracted["voltage"] = f"{num}V"

    # Current
    amp_match = re.search(r"(\d+(?:\.\d+)?)\s*(mA|A|Amp|Ampere)\b", combined_desc, re.IGNORECASE)
    if amp_match:
        unit = "mA" if amp_match.group(2).lower() == "ma" else "A"
        extracted["current"] = f"{amp_match.group(1)}{unit}"

    # Poles
    poles_match = re.search(r"\b(\d)\s*(?:pole|poles|P)\b", combined_desc, re.IGNORECASE)
    if poles_match:
        extracted["poles"] = f"{poles_match.group(1)}P"

    # Breaking capacity
    ka_match = re.search(r"(\d+(?:\.\d+)?)\s*kA\b", combined_desc, re.IGNORECASE)
    if ka_match:
        extracted["breakingCapacity"] = f"{ka_match.group(1)}kA"

    # Tripping curve
    curve_match = re.search(r"(?:curve\s+([BCDKZ])|\b([BCDKZ])\s+curve)\b", combined_desc, re.IGNORECASE)
    if curve_match:
        extracted["curve"] = (curve_match.group(1) or curve_match.group(2)).upper()

    # Capacitance
    cap_match = re.search(r"(\d+(?:\.\d+)?)\s*(uF|µF|nF|pF|mF|microfarad|nanofarad|picofarad)\b", combined_desc, re.IGNORECASE)
    if cap_match:
        extracted["capacitance"] = f"{cap_match.group(1)}{cap_match.group(2)}"

    # Resistance
    res_match = re.search(r"(\d+(?:\.\d+)?)\s*(MΩ|kΩ|Ω|MOhm|kOhm|Ohm)\b", combined_desc, re.IGNORECASE)
    if res_match:
        extracted["resistance"] = f"{res_match.group(1)} {res_match.group(2)}"

    # Inductance
    ind_match = re.search(r"(\d+(?:\.\d+)?)\s*(mH|uH|µH|nH)\b", combined_desc, re.IGNORECASE)
    if ind_match:
        extracted["inductance"] = f"{ind_match.group(1)}{ind_match.group(2)}"

    # Power
    pwr_match = re.search(r"(\d+(?:\.\d+)?)\s*(kW|W|VA|kVA|HP)\b", combined_desc, re.IGNORECASE)
    if pwr_match:
        extracted["power"] = f"{pwr_match.group(1)}{pwr_match.group(2)}"

    # Frequency
    freq_match = re.search(r"(\d+(?:/\d+)?)\s*(Hz|kHz|MHz)\b", combined_desc, re.IGNORECASE)
    if freq_match:
        extracted["frequency"] = f"{freq_match.group(1)}{freq_match.group(2)}"

    # Package / Size (SMD + common IC/transistor packages)
    pkg_pattern = r"\b(0201|0402|0603|0805|1206|1210|1808|1812|2220|SOT-?23|SOT-?223|TO-?220|TO-?92|SOIC-?\d+|QFP-?\d+|DIP-?\d+|SMA|SMB|SMC)\b"
    pkg_match = re.search(pkg_pattern, combined_desc, re.IGNORECASE) or re.search(pkg_pattern, mpn, re.IGNORECASE)
    if pkg_match:
        extracted["package"] = pkg_match.group(1).upper()

    # Dielectric
    dielectric_match = re.search(r"\b(X7R|X5R|C0G|NP0|Y5V|Z5U)\b", combined_desc, re.IGNORECASE) or re.search(
        r"(X7R|X5R|C0G|NP0|Y5V|Z5U)", mpn, re.IGNORECASE
    )
    if dielectric_match:
        extracted["dielectric"] = dielectric_match.group(1).upper()

    # Tolerance
    tol_match = re.search(r"(±\s*\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?\s*%)", combined_desc)
    if tol_match:
        extracted["tolerance"] = tol_match.group(1).replace(" ", "")

    # IP / Enclosure rating
    ip_match = re.search(r"\b(IP\d{2}[A-Z]?)\b", combined_desc, re.IGNORECASE)
    if ip_match:
        extracted["enclosureRating"] = ip_match.group(1).upper()

    # Core count / Conductor size
    core_match = re.search(r"\b(\d{1,2})\s*(?:core|cores|C)\b", combined_desc, re.IGNORECASE)
    if core_match:
        extracted["coreCount"] = f"{core_match.group(1)}C"
    cond_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:sq\.?\s*mm|mm2|mm²)\b", combined_desc, re.IGNORECASE)
    if cond_match:
        extracted["conductorSize"] = f"{cond_match.group(1)} sq.mm"

    # Communication protocols
    comm_matches = re.findall(r"\b(Modbus|Profinet|Profibus|Ethernet|RS485|RS232|CANopen|EtherCAT|BACnet)\b", combined_desc, re.IGNORECASE)
    if comm_matches:
        extracted["communication"] = ", ".join(dict.fromkeys([c for c in comm_matches]))

    # Sensing range / dimensions in mm
    mm_match = re.search(r"(\d+(?:\.\d+)?)\s*mm\b", combined_desc, re.IGNORECASE)
    if mm_match:
        extracted["dimensions_mm"] = f"{mm_match.group(1)}mm"

    return extracted


def _map_specs_to_category_schema(
    category: Optional[Dict[str, Any]],
    extracted: Dict[str, str],
    combined_desc: str,
) -> Dict[str, str]:
    """Dynamically map extracted values onto ANY category's fields_schema (built-in or custom)."""
    if not category:
        return {}

    import re

    fields = category.get("fields_schema") or []
    mapped: Dict[str, str] = {}
    desc_lower = combined_desc.lower()

    # Concept-to-keywords mapping for dynamic field matching
    concept_rules = [
        ("voltage", ["voltage", "volt", "coilvoltage", "supplyvoltage", "inputvoltage", "outputvoltage", "primaryvoltage", "secondaryvoltage"], ["v", "vdc", "vac", "kv"]),
        ("current", ["current", "amp", "ampere", "contactrating", "outputcurrent", "currentinput"], ["a", "ma", "ka"]),
        ("poles", ["pole", "poles"], ["p"]),
        ("breakingCapacity", ["breaking", "ka", "interrupting"], ["ka"]),
        ("curve", ["curve", "tripping"], []),
        ("capacitance", ["capacitance", "farad"], ["uf", "nf", "pf", "µf"]),
        ("resistance", ["resistance", "ohm", "impedance"], ["ω", "ohm", "kω", "mω"]),
        ("inductance", ["inductance", "henry"], ["uh", "mh", "nh", "µh"]),
        ("power", ["power", "watt", "va", "burden", "motorpower"], ["w", "kw", "va", "kva", "hp"]),
        ("frequency", ["frequency", "freq"], ["hz", "khz", "mhz"]),
        ("package", ["package", "footprint", "case", "size", "model"], []),
        ("dielectric", ["dielectric"], []),
        ("tolerance", ["tolerance"], ["%"]),
        ("enclosureRating", ["ip", "enclosure", "ingress", "protection"], []),
        ("coreCount", ["core", "cores"], ["c"]),
        ("conductorSize", ["conductor", "cross", "gauge", "awg"], ["sq.mm", "mm2"]),
        ("communication", ["comm", "protocol", "interface", "bus"], []),
        ("dimensions_mm", ["range", "sensing", "diameter", "length", "width", "height", "pitch"], ["mm"]),
    ]

    for field in fields:
        if not isinstance(field, dict):
            continue
        key = field.get("key") or ""
        if not key or key in ("manufacturer", "partNumber"):
            continue
        label_lower = (field.get("label") or "").lower()
        key_lower = key.lower()
        unit_lower = (field.get("unitSuffix") or "").lower().strip()
        field_type = field.get("type") or "text"
        options = field.get("options") or []

        # 1. If select field, check if any exact option value/label appears in the scraped text
        if field_type == "select" and options:
            for opt in options:
                opt_val = str(opt.get("value") or "")
                if not opt_val:
                    continue
                if len(opt_val) <= 3:
                    if re.search(rf"\b{re.escape(opt_val)}\b", combined_desc, re.IGNORECASE):
                        mapped[key] = opt_val
                        break
                elif opt_val.lower() in desc_lower:
                    mapped[key] = opt_val
                    break
            if key in mapped:
                continue

        # 2. Match via generic engineering concept rules (key, label, or unitSuffix)
        for concept, tokens, units in concept_rules:
            if concept not in extracted:
                continue
            # Avoid filling 'current' into capacitor model or vice-versa
            if concept == "current" and (category.get("code") or "").upper() == "CAPACITOR":
                continue
            if (
                any(tok in key_lower or tok in label_lower for tok in tokens)
                or (unit_lower and unit_lower in units)
            ):
                val = extracted[concept]
                # If number field, strip non-numeric suffix
                if field_type == "number":
                    num_m = re.search(r"\d+(?:\.\d+)?", val)
                    if num_m:
                        mapped[key] = num_m.group(0)
                else:
                    mapped[key] = val
                break

    return mapped


def _try_llm_extract(
    combined_desc: str,
    mpn: str,
    categories: List[Dict[str, Any]],
    target_category: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Tier 2 optional LLM extraction using configured cloud LLM provider, if API key is set."""
    import os
    import json
    from app.services.llm.provider import get_llm_provider

    provider_name = None
    if os.getenv("GEMINI_API_KEY"):
        provider_name = "gemini"
    elif os.getenv("OPENAI_API_KEY"):
        provider_name = "openai"
    elif os.getenv("ANTHROPIC_API_KEY"):
        provider_name = "claude"

    if not provider_name:
        return None

    try:
        provider = get_llm_provider(provider_name)
        cat_summary = [{"code": c["code"], "label": c["label"]} for c in categories]
        fields_info = []
        if target_category:
            for f in target_category.get("fields_schema") or []:
                if f.get("key") in ("manufacturer", "partNumber"):
                    continue
                fields_info.append(
                    {
                        "key": f.get("key"),
                        "label": f.get("label"),
                        "type": f.get("type"),
                        "unit": f.get("unitSuffix"),
                        "options": [o.get("value") for o in (f.get("options") or [])][:12],
                    }
                )

        prompt = (
            "Extract industrial/electronic component specifications from the text below and return JSON only.\n"
            f"Part Number / Query: {mpn}\n"
            f"Available Categories: {json.dumps(cat_summary)}\n"
            f"Target Category Fields: {json.dumps(fields_info)}\n"
            f"Scraped Text:\n{combined_desc[:2500]}\n\n"
            'Return JSON with exact shape: {"brand": "string or empty", "category_code": "matching code from Available Categories or empty", "mapped_specifications": {"fieldKey": "value"}}. '
            "Only include keys present in Target Category Fields that are clearly supported by the text."
        )
        res = provider.generate_plan_json({}, prompt)
        if isinstance(res, dict):
            return res
    except Exception:
        return None
    return None


@router.get("/fetch-mpn-details")
def fetch_mpn_details(mpn: str, category_code: Optional[str] = None, use_ai: bool = False):
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
                    text += (reader.pages[i].extract_text() or "") + "\n"
                combined_desc = text
                product_name = "Imported via PDF"
            else:
                soup = BeautifulSoup(res.text, "html.parser")
                for script in soup(["script", "style"]):
                    script.extract()
                combined_desc = soup.get_text(separator=" ", strip=True)
                product_name = soup.title.get_text(strip=True) if soup.title else "Imported via URL"
                datasheet_url = url

        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {str(e)}")

    else:
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

        description_snippets = [snippet.get_text(strip=True) for snippet in results[:4]]
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

    desc_lower = f"{product_name} {combined_desc}".lower()
    mpn_lower = mpn.lower()

    # Detect common industrial & electronic brands
    brand_patterns = [
        ("Siemens", ["siemens", "simatic", "sinamics", "sirius", "sentron"], ["6es7", "3rt", "3rv", "5sy"]),
        ("Schneider Electric", ["schneider", "tesys", "acti9", "altivar", "modicon"], ["lc1", "a9f", "gv2"]),
        ("ABB", ["abb ", "abb,"], ["1svr", "1sam", "s20"]),
        ("Omron", ["omron"], ["my2", "my4", "g2r", "e2e"]),
        ("Phoenix Contact", ["phoenix contact"], []),
        ("L&T", ["l&t", "larsen", "lauritz knudsen"], []),
        ("Mitsubishi Electric", ["mitsubishi"], ["fx3", "fx5"]),
        ("Rockwell Automation", ["rockwell", "allen-bradley", "allen bradley"], []),
        ("LAPP", ["lapp", "olflex"], []),
        ("KEMET", ["kemet"], []),
        ("Murata", ["murata"], ["grm"]),
        ("TDK", ["tdk"], []),
        ("Vishay", ["vishay"], ["crcw"]),
        ("Yageo", ["yageo"], ["rc0"]),
        ("Texas Instruments", ["texas instruments"], ["lm", "tps", "sn74"]),
        ("STMicroelectronics", ["stmicroelectronics"], ["stm32"]),
    ]
    for brand_name, text_hits, prefix_hits in brand_patterns:
        if any(mpn_lower.startswith(p) for p in prefix_hits) or any(h in desc_lower for h in text_hits):
            extracted_brand = brand_name
            break

    # Load dynamic categories from DB (fallback to built-in defaults)
    try:
        all_categories = ProductCategoryStore.list_categories()
    except Exception:
        from app.modules.store.category_defaults import DEFAULT_CATEGORY_SCHEMAS
        all_categories = DEFAULT_CATEGORY_SCHEMAS

    matched_cat = _match_best_category(
        all_categories,
        f"{product_name} {combined_desc}",
        mpn,
        hint_category_code=category_code,
    )

    # Tier 1: Generic engineering unit & dynamic schema extraction
    generic_specs = _extract_generic_engineering_specs(f"{product_name} {combined_desc}", mpn)
    mapped_specs = _map_specs_to_category_schema(matched_cat, generic_specs, f"{product_name} {combined_desc}")
    extraction_method = "rules"

    # Tier 2: Optional LLM extraction (if requested and configured)
    if use_ai:
        llm_res = _try_llm_extract(f"{product_name}\n{combined_desc}", mpn, all_categories, matched_cat)
        if llm_res:
            extraction_method = "ai"
            if llm_res.get("brand") and extracted_brand == "Unknown":
                extracted_brand = str(llm_res["brand"])
            if llm_res.get("category_code"):
                llm_cat = next(
                    (c for c in all_categories if c["code"].lower() == str(llm_res["category_code"]).lower()),
                    None,
                )
                if llm_cat:
                    matched_cat = llm_cat
            if isinstance(llm_res.get("mapped_specifications"), dict):
                for k, v in llm_res["mapped_specifications"].items():
                    if v is not None and str(v).strip():
                        mapped_specs[k] = str(v).strip()

    # Human-readable specifications summary (backwards-compatible)
    specs: Dict[str, str] = {
        "Part Number / MPN": mpn if not (mpn.startswith("http://") or mpn.startswith("https://")) else "Extracted from URL",
        "Brand": extracted_brand,
    }
    for k, v in generic_specs.items():
        specs[k] = v

    return {
        "brand": extracted_brand,
        "name": product_name,
        "description": combined_desc[:250] + "..." if len(combined_desc) > 250 else combined_desc,
        "category": matched_cat["code"] if matched_cat else (category_code or "Electrical"),
        "category_label": matched_cat["label"] if matched_cat else (category_code or "Electrical"),
        "image_url": None,
        "datasheet_url": datasheet_url,
        "specifications": specs,
        "mapped_specifications": mapped_specs,
        "extraction_method": extraction_method,
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



