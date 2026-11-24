import re
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional


def _text_field(
    key: str,
    label: str,
    is_required: bool = False,
    options: Optional[List[str]] = None,
    field_type: Optional[str] = None,
    unit_suffix: Optional[str] = None,
    min_val: Optional[float] = None,
) -> Dict[str, Any]:
    resolved_type = field_type or ("select" if options else "text")
    field: Dict[str, Any] = {
        "key": key,
        "label": label,
        "type": resolved_type,
        "width": "third",
        "summary": key in ("model", "series"),
    }
    if options:
        field["options"] = [{"label": v, "value": v} for v in options]
    validation: Dict[str, Any] = {}
    if is_required:
        validation["required"] = True
    if min_val is not None:
        validation["min"] = min_val
    if validation:
        field["validation"] = validation
    if unit_suffix:
        field["unitSuffix"] = unit_suffix
    return field


MANUFACTURER_FIELD: Dict[str, Any] = {
    "key": "manufacturer",
    "label": "Manufacturer",
    "type": "select",
    "validation": {"required": True},
    "width": "third",
    "summary": True,
}


def _cat(
    code: str,
    label: str,
    description: str,
    fields: List[Dict[str, Any]],
    name_template: str = "{description}, {series} {model}",
    code_template: str = "{codePrefix}-{manufacturerShort}-{series}",
    code_prefix: Optional[str] = None,
    defaults: Optional[Dict[str, str]] = None,
    aliases: Optional[List[str]] = None,
    keywords: Optional[List[str]] = None,
) -> Dict[str, Any]:
    return {
        "code": code,
        "label": label,
        "description": description,
        "code_prefix": (code_prefix or code[:3]).upper(),
        "name_template": name_template.replace("{description}", description),
        "code_template": code_template,
        "fields_schema": [MANUFACTURER_FIELD, *fields],
        "defaults": defaults or {},
        "aliases": aliases or [],
        "keywords": keywords or [],
        "is_system": True,
    }


DEFAULT_CATEGORY_SCHEMAS: List[Dict[str, Any]] = [
    _cat(
        "MCB",
        "MCB",
        "Miniature Circuit Breaker (MCB)",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("series", "Series"),
            _text_field("model", "Model / Product Family"),
            _text_field("poles", "Poles", True, ["1P", "1P+N", "2P", "3P", "3P+N", "4P"]),
            _text_field("current", "Current Rating", True, ["1A", "2A", "6A", "10A", "16A", "20A", "32A", "40A", "63A"]),
            _text_field("curve", "Curve / Tripping Curve", True, ["B", "C", "D", "K", "Z"]),
            _text_field("breakingCapacity", "Breaking Capacity", True, ["6kA", "10kA", "15kA", "25kA"]),
            _text_field("standard", "Standard / Compliance", False, ["IEC 60898-1", "IS/IEC 60947-2", "IEC 60947-2"]),
            _text_field("frequency", "Frequency", False, ["50Hz", "60Hz", "50/60Hz"]),
        ],
        name_template="{category}, {series} {model}, {poles}, {current}, {curve} Curve, {breakingCapacity} ({standard})",
        code_template="{codePrefix}-{manufacturerShort}-{series}-{poles}-{current}-{curve}-{breakingCapacity}",
        code_prefix="MCB",
        defaults={"poles": "1P", "current": "1A", "curve": "C", "breakingCapacity": "10kA", "frequency": "50/60Hz"},
        aliases=["Miniature Circuit Breaker", "Circuit Breaker", "RCBO", "Breaker"],
        keywords=["mcb", "miniature circuit breaker", "rcbo", "circuit breaker", "breaker"],
    ),
    _cat(
        "RELAY",
        "Relay",
        "Industrial Relay",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("relayType", "Relay Type", True, ["Plug-in Relay", "Interface Relay", "Solid State Relay", "Safety Relay", "Timer Relay"]),
            _text_field("series", "Series"),
            _text_field("model", "Model"),
            _text_field("coilVoltage", "Coil Voltage", True, ["12V DC", "24V DC", "48V DC", "110V AC", "230V AC"]),
            _text_field("contactConfiguration", "Contact Configuration", True, ["1 CO (SPDT)", "2 CO (DPDT)", "3 CO", "4 CO"]),
            _text_field("contactRating", "Contact Rating", True, ["5A", "6A", "10A", "16A"]),
            _text_field("mountingType", "Mounting Type", True, ["Plug-in (Socket Mount)", "DIN Rail", "PCB Mount", "Panel Mount"]),
            _text_field("operatingIndicator", "Operating Indicator", False, ["None", "LED", "Mechanical + LED"]),
            _text_field("standard", "Standard / Compliance"),
        ],
        name_template="{relayType}, {series} {model}, {contactConfiguration}, {coilVoltage} Coil, {contactRating}, {mountingType}",
        code_template="{codePrefix}-{manufacturerShort}-{series}-{contactConfiguration}-{coilVoltage}-{contactRating}",
        code_prefix="REL",
        defaults={"relayType": "Plug-in Relay", "coilVoltage": "24V DC", "contactConfiguration": "2 CO (DPDT)", "contactRating": "10A"},
        aliases=["SSR", "Solid State Relay", "Interface Relay", "Timer Relay", "Electromechanical Relay"],
        keywords=["relay", "relays", "ssr", "solid state relay", "spdt", "dpdt"],
    ),
    _cat(
        "CABLE",
        "Cable",
        "Industrial Cable",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("cableType", "Cable Type", True, ["Power Cable", "Control Cable", "Instrumentation Cable", "Ethernet Cable", "Flexible Cable"]),
            _text_field("series", "Series"),
            _text_field("coreCount", "Core Count", True, ["1C", "2C", "3C", "4C", "5C", "7C", "12C", "24C"]),
            _text_field("conductorSize", "Conductor Size", True, ["0.5 sq.mm", "0.75 sq.mm", "1.5 sq.mm", "2.5 sq.mm", "4 sq.mm", "6 sq.mm"]),
            _text_field("color", "Color"),
            _text_field("length", "Length", True, field_type="number", unit_suffix="m", min_val=0.01),
            _text_field("shielding", "Shielding", False, ["Unshielded", "Shielded", "Armoured"]),
            _text_field("standard", "Standard / Compliance"),
        ],
        name_template="{cableType}, {coreCount}, {conductorSize}, {color}, {length}",
        code_template="{codePrefix}-{manufacturerShort}-{cableType}-{coreCount}-{conductorSize}-{length}",
        code_prefix="CAB",
        defaults={"cableType": "Control Cable", "coreCount": "4C", "conductorSize": "2.5 sq.mm"},
        aliases=["Wire", "Wiring", "Power Cable", "Control Cable", "Ethernet Cable"],
        keywords=["cable", "wire", "conductor", "armoured", "shielded", "sq.mm"],
    ),
    _cat(
        "PLC",
        "PLC",
        "Programmable Logic Controller (PLC)",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("series", "Series"),
            _text_field("model", "Model"),
            _text_field("cpuType", "CPU Type", True),
            _text_field("communication", "Communication", True),
            _text_field("ioCount", "I/O Count", True, field_type="number", min_val=0),
            _text_field("supplyVoltage", "Supply Voltage"),
            _text_field("programMemory", "Program Memory"),
        ],
        name_template="{category}, {series} {model}, {cpuType}, {ioCount} I/O, {communication}",
        code_template="{codePrefix}-{manufacturerShort}-{series}-{cpuType}-{ioCount}",
        code_prefix="PLC",
        aliases=["Programmable Logic Controller", "PLC Module", "Controller"],
        keywords=["plc", "programmable logic", "simatic", "s7-1200", "s7-1500", "cpu module"],
    ),
    _cat(
        "MCCB",
        "MCCB",
        "Moulded Case Circuit Breaker (MCCB)",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("series", "Series"),
            _text_field("model", "Model"),
            _text_field("poles", "Poles", True),
            _text_field("current", "Frame / Current Rating", True),
            _text_field("breakingCapacity", "Breaking Capacity", True),
            _text_field("tripUnit", "Trip Unit", True),
            _text_field("standard", "Standard / Compliance"),
        ],
        name_template="{description}, {series} {model}, {poles}, {current}, {breakingCapacity}, {tripUnit}",
        code_template="{codePrefix}-{manufacturerShort}-{series}-{poles}-{current}-{breakingCapacity}",
        code_prefix="MCC",
        aliases=["Moulded Case Circuit Breaker", "Molded Case Circuit Breaker"],
        keywords=["mccb", "moulded case", "molded case"],
    ),
    _cat(
        "ACB",
        "ACB",
        "Air Circuit Breaker (ACB)",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("series", "Series"),
            _text_field("model", "Model"),
            _text_field("poles", "Poles", True),
            _text_field("current", "Current Rating", True),
            _text_field("breakingCapacity", "Breaking Capacity", True),
            _text_field("drawout", "Mounting", True),
        ],
        name_template="{description}, {series} {model}, {poles}, {current}, {breakingCapacity}",
        aliases=["Air Circuit Breaker"],
        keywords=["acb", "air circuit breaker"],
    ),
    _cat(
        "CONTACTOR",
        "Contactor",
        "Contactor",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("series", "Series"),
            _text_field("model", "Model"),
            _text_field("coilVoltage", "Coil Voltage", True),
            _text_field("current", "Operational Current", True),
            _text_field("poles", "Poles", True),
            _text_field("utilizationCategory", "Utilization Category"),
        ],
        name_template="{description}, {series} {model}, {poles}, {current}, {coilVoltage}",
        aliases=["Power Contactor", "Magnetic Contactor"],
        keywords=["contactor", "contactors", "tesys", "lc1d"],
    ),
    _cat(
        "HMI",
        "HMI",
        "Human Machine Interface (HMI)",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("series", "Series"),
            _text_field("model", "Model"),
            _text_field("displaySize", "Display Size", True),
            _text_field("resolution", "Resolution"),
            _text_field("communication", "Communication", True),
            _text_field("supplyVoltage", "Supply Voltage"),
        ],
        name_template="{description}, {series} {model}, {displaySize}, {supplyVoltage}",
        aliases=["Touch Panel", "Operator Panel", "Human Machine Interface"],
        keywords=["hmi", "touch panel", "operator panel", "human machine interface"],
    ),
    _cat(
        "SENSOR",
        "Sensor",
        "Industrial Sensor",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("sensorType", "Sensor Type", True),
            _text_field("series", "Series"),
            _text_field("model", "Model"),
            _text_field("sensingRange", "Sensing Range", True),
            _text_field("outputType", "Output Type", True),
            _text_field("supplyVoltage", "Supply Voltage"),
        ],
        name_template="{sensorType}, {series} {model}, {sensingRange}, {outputType}",
        aliases=["Proximity Sensor", "Photoelectric Sensor", "Temperature Sensor", "Pressure Sensor"],
        keywords=["sensor", "proximity", "photoelectric", "inductive", "capacitive", "thermocouple"],
    ),
    _cat(
        "TERMINAL",
        "Terminal Block",
        "Terminal Block",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("series", "Series"),
            _text_field("model", "Model"),
            _text_field("terminalType", "Terminal Type", True),
            _text_field("conductorSize", "Conductor Size", True),
            _text_field("current", "Current Rating"),
            _text_field("color", "Color"),
        ],
        name_template="{terminalType}, {series} {model}, {conductorSize}, {current}, {color}",
        aliases=["DIN Rail Terminal", "Connector Block", "Terminal"],
        keywords=["terminal block", "din rail terminal", "feed-through terminal"],
    ),
    _cat(
        "SMPS",
        "SMPS",
        "Switched Mode Power Supply (SMPS)",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("series", "Series"),
            _text_field("model", "Model"),
            _text_field("inputVoltage", "Input Voltage", True),
            _text_field("outputVoltage", "Output Voltage", True),
            _text_field("outputCurrent", "Output Current", True),
            _text_field("power", "Power Rating"),
        ],
        name_template="{description}, {series} {model}, {outputVoltage}, {outputCurrent}, {power}",
        aliases=["Power Supply", "DC Power Supply", "Switched Mode Power Supply"],
        keywords=["smps", "power supply", "switched mode", "24vdc power"],
    ),
    _cat(
        "TRANSFORMER",
        "Transformer",
        "Electrical Transformer",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("transformerType", "Transformer Type", True),
            _text_field("model", "Model"),
            _text_field("primaryVoltage", "Primary Voltage", True),
            _text_field("secondaryVoltage", "Secondary Voltage", True),
            _text_field("power", "VA / Power Rating", True),
            _text_field("frequency", "Frequency"),
        ],
        name_template="{transformerType}, {model}, {primaryVoltage}/{secondaryVoltage}, {power}",
        aliases=["Control Transformer", "Isolation Transformer", "Step Down Transformer"],
        keywords=["transformer", "control transformer", "isolation transformer"],
    ),
    _cat(
        "VFD",
        "VFD",
        "Variable Frequency Drive (VFD)",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("series", "Series"),
            _text_field("model", "Model"),
            _text_field("power", "Motor Power", True),
            _text_field("inputVoltage", "Input Voltage", True),
            _text_field("outputCurrent", "Output Current"),
            _text_field("communication", "Communication"),
        ],
        name_template="{description}, {series} {model}, {power}, {inputVoltage}",
        aliases=["AC Drive", "Inverter", "Frequency Inverter", "Motor Drive"],
        keywords=["vfd", "variable frequency drive", "ac drive", "inverter", "altivar", "sinamics"],
    ),
    _cat(
        "PUSHBUTTON",
        "Push Button",
        "Industrial Push Button",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("series", "Series"),
            _text_field("model", "Model"),
            _text_field("operatorType", "Operator Type", True),
            _text_field("color", "Color", True),
            _text_field("contactConfiguration", "Contact Configuration", True),
            _text_field("diameter", "Mounting Diameter"),
        ],
        name_template="{operatorType} Push Button, {series} {model}, {color}, {contactConfiguration}",
        aliases=["Pushbutton", "Emergency Stop", "E-Stop", "Selector Switch"],
        keywords=["push button", "pushbutton", "emergency stop", "selector switch"],
    ),
    _cat(
        "LAMP",
        "Indicator Lamp",
        "Indicator Lamp",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("series", "Series"),
            _text_field("model", "Model"),
            _text_field("color", "Color", True),
            _text_field("supplyVoltage", "Supply Voltage", True),
            _text_field("lampType", "Lamp Type"),
            _text_field("diameter", "Mounting Diameter"),
        ],
        name_template="{color} {lampType} Indicator Lamp, {series} {model}, {supplyVoltage}",
        aliases=["Pilot Light", "Pilot Lamp", "LED Indicator", "Signal Lamp"],
        keywords=["indicator lamp", "pilot light", "pilot lamp", "led indicator"],
    ),
    _cat(
        "LIMITSWITCH",
        "Limit Switch",
        "Industrial Limit Switch",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("series", "Series"),
            _text_field("model", "Model"),
            _text_field("actuatorType", "Actuator Type", True),
            _text_field("contactConfiguration", "Contact Configuration", True),
            _text_field("enclosureRating", "Enclosure Rating"),
        ],
        name_template="{description}, {series} {model}, {actuatorType}, {contactConfiguration}",
        aliases=["Micro Switch", "Position Switch"],
        keywords=["limit switch", "micro switch", "position switch"],
    ),
    _cat(
        "CT",
        "CT",
        "Current Transformer (CT)",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("model", "Model"),
            _text_field("ratio", "CT Ratio", True),
            _text_field("burden", "Burden", True),
            _text_field("accuracyClass", "Accuracy Class", True),
            _text_field("windowSize", "Window Size"),
        ],
        name_template="{description}, {model}, Ratio: {ratio}, Burden: {burden}, Class: {accuracyClass}",
        code_prefix="CT",
        aliases=["Current Transformer"],
        keywords=["current transformer", "ct ratio"],
    ),
    _cat(
        "PT",
        "PT",
        "Potential Transformer (PT)",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("model", "Model"),
            _text_field("ratio", "Voltage Ratio", True),
            _text_field("burden", "Burden", True),
            _text_field("accuracyClass", "Accuracy Class", True),
            _text_field("frequency", "Frequency"),
        ],
        name_template="{description}, {model}, Ratio: {ratio}, Burden: {burden}, Class: {accuracyClass}",
        code_prefix="PT",
        aliases=["Voltage Transformer", "Potential Transformer"],
        keywords=["potential transformer", "voltage transformer"],
    ),
    _cat(
        "METER",
        "Energy Meter",
        "Energy Meter",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("series", "Series"),
            _text_field("model", "Model"),
            _text_field("meterType", "Meter Type", True),
            _text_field("phase", "Phase", True),
            _text_field("currentInput", "Current Input"),
            _text_field("communication", "Communication"),
        ],
        name_template="{meterType} Meter, {series} {model}, {phase}",
        aliases=["Power Meter", "Multifunction Meter", "MFM", "kWh Meter"],
        keywords=["energy meter", "power meter", "multifunction meter", "kwh meter"],
    ),
    _cat(
        "TOOL",
        "Tool",
        "Industrial Tool",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("toolType", "Tool Type", True),
            _text_field("model", "Model"),
            _text_field("size", "Size / Capacity", True),
            _text_field("material", "Material"),
            _text_field("driveSize", "Drive Size"),
        ],
        name_template="{toolType}, {model}, Size: {size}",
        aliases=["Hand Tool", "Power Tool", "Crimping Tool"],
        keywords=["tool", "crimper", "screwdriver", "wrench", "pliers", "stripper"],
    ),
    _cat(
        "CONSUMABLE",
        "Consumable",
        "Industrial Consumable",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("consumableType", "Consumable Type", True),
            _text_field("model", "Model / Grade"),
            _text_field("size", "Size", True),
            _text_field("packSize", "Pack Size", True),
            _text_field("shelfLife", "Shelf Life"),
        ],
        name_template="{consumableType}, {model}, Size: {size}, Pack: {packSize}",
        aliases=["Consumables", "Fastener", "Cable Tie", "Ferrule", "Lug"],
        keywords=["consumable", "ferrule", "cable tie", "heat shrink", "solder", "tape", "lug"],
    ),
    _cat(
        "FUSE",
        "Fuse",
        "Fuse / Fuse Link",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("series", "Series"),
            _text_field("model", "Model / Size"),
            _text_field("fuseType", "Fuse Type", True, ["DIAZED / Bottle Fuse", "Cylindrical Fuse", "NH Blade Fuse", "Glass Fuse", "HRC Fuse", "Semiconductor Protection (Ultra-Fast)"]),
            _text_field("current", "Current Rating", True, ["2A", "4A", "6A", "10A", "16A", "20A", "25A", "32A", "35A", "40A", "50A", "63A", "80A", "100A"]),
            _text_field("voltage", "Voltage Rating", True, ["250V", "415V", "500V", "660V", "690V"]),
            _text_field("characteristic", "Tripping Characteristic", False, ["gG/gL (General Purpose)", "aM (Motor Protection)", "gR/aR (Semiconductor Protection)", "Quick-acting (FE)", "Slow-acting"]),
            _text_field("standard", "Standard / Compliance"),
        ],
        name_template="{category}, {series} {model}, {current}, {voltage}, {characteristic}",
        code_template="{codePrefix}-{manufacturerShort}-{series}-{current}-{voltage}",
        code_prefix="FUS",
        aliases=["Fuse Link", "HRC Fuse", "Glass Fuse", "Cartridge Fuse"],
        keywords=["fuse", "fuses", "silized", "hrc fuse", "fuse link"],
    ),
    _cat(
        "CAPACITOR",
        "Capacitor",
        "Capacitor",
        [
            _text_field("partNumber", "Part Number"),
            _text_field("series", "Series"),
            _text_field("model", "Package / Size"),
            _text_field("capacitance", "Capacitance", True),
            _text_field("voltage", "Voltage Rating", True),
            _text_field("dielectric", "Dielectric"),
            _text_field("tolerance", "Tolerance"),
        ],
        name_template="{description}, {series} {model}, {capacitance}, {voltage}, {dielectric}, {tolerance}",
        code_template="{codePrefix}-{manufacturerShort}-{series}-{capacitance}-{voltage}",
        code_prefix="CAP",
        aliases=["MLCC", "Ceramic Capacitor", "Electrolytic Capacitor", "Film Capacitor"],
        keywords=["capacitor", "capacitance", "mlcc", "ceramic capacitor", "electrolytic"],
    ),
]


def normalize_category_name(name: str) -> str:
    """Normalize a category name for duplicate comparison (lowercase, strip punctuation, basic singularize)."""
    s = re.sub(r"[^a-z0-9\s]+", " ", (name or "").lower()).strip()
    s = re.sub(r"\s+", " ", s)
    # Basic English singularization on each word
    words = []
    for w in s.split():
        if len(w) > 4 and w.endswith("ies"):
            w = w[:-3] + "y"
        elif len(w) > 3 and w.endswith("es") and not w.endswith(("ses", "xes", "zes", "ches", "shes")):
            w = w[:-1]
        elif len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        words.append(w)
    return " ".join(words)


def generate_category_code(label: str) -> str:
    """Generate a clean uppercase identifier code from a category label."""
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", (label or "").strip()).strip("_").upper()
    return cleaned[:40] or "CUSTOM"


def generate_code_prefix(label: str) -> str:
    """Generate a 3-letter prefix from a category label."""
    words = [w for w in re.sub(r"[^a-zA-Z0-9\s]+", "", (label or "")).split() if w]
    if len(words) >= 3:
        return (words[0][0] + words[1][0] + words[2][0]).upper()
    if len(words) == 2:
        return (words[0][:2] + words[1][0]).upper()
    if words:
        return words[0][:3].upper().ljust(3, "X")
    return "CAT"


def compute_category_similarity(
    candidate_label: str,
    candidate_description: str,
    candidate_aliases: List[str],
    candidate_field_labels: List[str],
    existing_categories: List[Dict[str, Any]],
    exclude_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Compare a candidate category against existing categories by normalized name,
    aliases, description, fuzzy similarity, and technical spec overlap.
    """
    norm_label = normalize_category_name(candidate_label)
    norm_code = generate_category_code(candidate_label)
    cand_tokens = set(norm_label.split()) if norm_label else set()
    cand_fields = {
        normalize_category_name(f)
        for f in candidate_field_labels
        if f and normalize_category_name(f) not in ("manufacturer", "part number", "series", "model")
    }

    exact_match = None
    similar_matches: List[Dict[str, Any]] = []

    for cat in existing_categories:
        if exclude_id is not None and cat.get("id") == exclude_id:
            continue

        cat_label = cat.get("label") or ""
        cat_code = cat.get("code") or ""
        cat_desc = cat.get("description") or ""
        cat_aliases = cat.get("aliases") or []

        norm_cat_label = normalize_category_name(cat_label)
        norm_cat_aliases = [normalize_category_name(a) for a in cat_aliases if a]

        # 1. Exact / normalized match
        if norm_label and (
            norm_label == norm_cat_label
            or norm_code == cat_code.upper()
            or norm_label in norm_cat_aliases
        ):
            reason = (
                f"Matches alias of '{cat_label}'"
                if norm_label in norm_cat_aliases and norm_label != norm_cat_label
                else f"Category '{cat_label}' already exists"
            )
            exact_match = {
                "id": cat.get("id"),
                "code": cat_code,
                "label": cat_label,
                "description": cat_desc,
                "product_count": cat.get("product_count", 0),
                "score": 1.0,
                "reason": reason,
            }
            continue

        best_score = 0.0
        reasons: List[str] = []

        # 2. Fuzzy / substring / token overlap against label, description, aliases
        if norm_label:
            compare_targets = [
                (norm_cat_label, "name"),
                (normalize_category_name(cat_desc), "description"),
                *[(a, "alias") for a in norm_cat_aliases],
            ]
            for target, source_kind in compare_targets:
                if not target:
                    continue
                ratio = SequenceMatcher(None, norm_label, target).ratio()
                target_tokens = set(target.split())
                token_overlap = (
                    len(cand_tokens & target_tokens) / max(1, min(len(cand_tokens), len(target_tokens)))
                    if cand_tokens and target_tokens
                    else 0.0
                )
                is_substring = (
                    len(norm_label) >= 3 and (norm_label in target or target in norm_label)
                )
                score = max(ratio, token_overlap * 0.9, 0.82 if is_substring else 0.0)
                if score > best_score:
                    best_score = score
                    if is_substring or token_overlap >= 0.8:
                        reasons = [f"Similar {source_kind} to '{cat_label}'"]
                    elif ratio >= 0.72:
                        reasons = [f"Close spelling to '{cat_label}' ({source_kind})"]

        # 3. Technical spec field overlap
        if len(cand_fields) >= 2:
            cat_fields_raw = cat.get("fields_schema") or []
            cat_field_norms = {
                normalize_category_name(f.get("label") or f.get("key") or "")
                for f in cat_fields_raw
                if isinstance(f, dict)
                and (f.get("key") or "") not in ("manufacturer", "partNumber", "series", "model")
            }
            if cat_field_norms:
                overlap = cand_fields & cat_field_norms
                overlap_ratio = len(overlap) / max(1, min(len(cand_fields), len(cat_field_norms)))
                if overlap_ratio >= 0.65 and len(overlap) >= 2:
                    spec_score = round(0.7 + overlap_ratio * 0.25, 2)
                    if spec_score > best_score:
                        best_score = spec_score
                    reasons.append(
                        f"Shares {len(overlap)} technical specs ({', '.join(sorted(overlap)[:3])})"
                    )

        if best_score >= 0.72:
            similar_matches.append(
                {
                    "id": cat.get("id"),
                    "code": cat_code,
                    "label": cat_label,
                    "description": cat_desc,
                    "product_count": cat.get("product_count", 0),
                    "score": round(best_score, 2),
                    "reason": " · ".join(dict.fromkeys(reasons)) or f"Similar to '{cat_label}'",
                }
            )

    similar_matches.sort(key=lambda m: m["score"], reverse=True)
    return {
        "exact_match": exact_match,
        "similar_matches": similar_matches[:5],
    }
