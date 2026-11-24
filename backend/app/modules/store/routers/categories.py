from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from app.database import ProductCategoryStore
from app.dependencies import get_current_user
from app.modules.store.category_defaults import (
    MANUFACTURER_FIELD,
    compute_category_similarity,
    generate_category_code,
    generate_code_prefix,
    normalize_category_name,
)

router = APIRouter(prefix="/categories", tags=["Product Categories"])


class FieldOptionModel(BaseModel):
    label: str
    value: str
    short: Optional[str] = None


class FieldValidationModel(BaseModel):
    required: Optional[bool] = None
    min: Optional[float] = None
    max: Optional[float] = None
    minLength: Optional[int] = None
    maxLength: Optional[int] = None
    pattern: Optional[str] = None
    message: Optional[str] = None


class CategoryFieldModel(BaseModel):
    key: str
    label: str
    type: str = "text"
    placeholder: Optional[str] = None
    helpText: Optional[str] = None
    defaultValue: Optional[str] = None
    options: Optional[List[FieldOptionModel]] = None
    validation: Optional[FieldValidationModel] = None
    width: Optional[str] = "third"
    unitSuffix: Optional[str] = None
    summary: Optional[bool] = None
    includeInName: Optional[bool] = None
    includeInCode: Optional[bool] = None


class CategorySimilarityRequest(BaseModel):
    label: str = ""
    description: Optional[str] = ""
    aliases: List[str] = []
    field_labels: List[str] = []
    exclude_id: Optional[int] = None


class CategoryCreateRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    code: Optional[str] = None
    code_prefix: Optional[str] = None
    name_template: Optional[str] = None
    code_template: Optional[str] = None
    fields_schema: List[Dict[str, Any]] = []
    defaults: Dict[str, str] = {}
    aliases: List[str] = []
    keywords: List[str] = []


class CategoryUpdateRequest(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    code_prefix: Optional[str] = None
    name_template: Optional[str] = None
    code_template: Optional[str] = None
    fields_schema: Optional[List[Dict[str, Any]]] = None
    defaults: Optional[Dict[str, str]] = None
    aliases: Optional[List[str]] = None
    keywords: Optional[List[str]] = None


class CategoryMergeRequest(BaseModel):
    field_mapping: Dict[str, str] = {}
    add_unmapped_fields: bool = False
    preserve_in_notes: bool = True


def _ensure_base_fields(fields_schema: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Ensure every category starts with Manufacturer, Part Number, Series, Model."""
    cleaned: List[Dict[str, Any]] = []
    seen_keys = set()

    has_mfg = any(isinstance(f, dict) and f.get("key") == "manufacturer" for f in fields_schema)
    if not has_mfg:
        cleaned.append(dict(MANUFACTURER_FIELD))
        seen_keys.add("manufacturer")

    for f in fields_schema:
        if not isinstance(f, dict):
            continue
        key = (f.get("key") or "").strip()
        if not key or key in seen_keys:
            continue
        seen_keys.add(key)
        cleaned.append(f)

    # Guarantee partNumber, series, model exist right after manufacturer if not already added
    base_defaults = [
        ("partNumber", "Part Number"),
        ("series", "Series"),
        ("model", "Model"),
    ]
    insert_idx = 1 if cleaned and cleaned[0].get("key") == "manufacturer" else 0
    for key, label in base_defaults:
        if key not in seen_keys:
            cleaned.insert(
                insert_idx,
                {
                    "key": key,
                    "label": label,
                    "type": "text",
                    "width": "third",
                    "summary": key in ("model", "series"),
                },
            )
            seen_keys.add(key)
            insert_idx += 1

    return cleaned


def _build_default_templates(fields_schema: List[Dict[str, Any]]):
    name_tokens = ["{category}", "{series} {model}"]
    code_tokens = ["{codePrefix}", "{manufacturerShort}", "{series}"]

    for f in fields_schema:
        key = f.get("key")
        if key in ("manufacturer", "partNumber", "series", "model"):
            continue
        if f.get("includeInName", True):
            name_tokens.append(f"{{{key}}}")
        if f.get("includeInCode", False):
            code_tokens.append(f"{{{key}}}")

    # Cap auto-built templates to keep names/codes readable
    name_template = ", ".join(name_tokens[:7])
    code_template = "-".join(code_tokens[:5])
    return name_template, code_template


@router.get("")
def list_categories():
    return ProductCategoryStore.list_categories()


@router.post("/check-similar")
def check_similar_categories(req: CategorySimilarityRequest):
    existing = ProductCategoryStore.list_categories()
    return compute_category_similarity(
        candidate_label=req.label,
        candidate_description=req.description or "",
        candidate_aliases=req.aliases,
        candidate_field_labels=req.field_labels,
        existing_categories=existing,
        exclude_id=req.exclude_id,
    )


@router.post("")
def create_category(req: CategoryCreateRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    if current_user.get("role") != "Administrator":
        raise HTTPException(status_code=403, detail="Only administrators can create product categories.")

    label = req.label.strip()
    if not label:
        raise HTTPException(status_code=400, detail="Category name cannot be empty.")

    existing = ProductCategoryStore.list_categories()
    similarity = compute_category_similarity(
        candidate_label=label,
        candidate_description=req.description or label,
        candidate_aliases=req.aliases,
        candidate_field_labels=[],
        existing_categories=existing,
    )
    if similarity["exact_match"]:
        raise HTTPException(
            status_code=400,
            detail=f"Duplicate category: {similarity['exact_match']['reason']}.",
        )

    code = (req.code or generate_category_code(label)).strip().upper()
    # Ensure code uniqueness
    existing_codes = {c["code"].upper() for c in existing}
    if code in existing_codes:
        suffix = 2
        while f"{code}_{suffix}" in existing_codes:
            suffix += 1
        code = f"{code}_{suffix}"

    code_prefix = (req.code_prefix or generate_code_prefix(label)).strip().upper()[:10]
    fields_schema = _ensure_base_fields(req.fields_schema)
    default_name_tpl, default_code_tpl = _build_default_templates(fields_schema)

    clean_aliases = list(dict.fromkeys([a.strip() for a in req.aliases if a and a.strip()]))
    clean_keywords = list(
        dict.fromkeys(
            [
                label.lower(),
                normalize_category_name(label),
                *[a.lower() for a in clean_aliases],
                *[k.strip().lower() for k in req.keywords if k and k.strip()],
            ]
        )
    )
    clean_keywords = [k for k in clean_keywords if k]

    created = ProductCategoryStore.create_category(
        {
            "code": code,
            "label": label,
            "description": (req.description or label).strip(),
            "code_prefix": code_prefix,
            "name_template": (req.name_template or default_name_tpl).strip(),
            "code_template": (req.code_template or default_code_tpl).strip(),
            "fields_schema": fields_schema,
            "defaults": req.defaults or {},
            "aliases": clean_aliases,
            "keywords": clean_keywords,
            "is_system": False,
            "created_by": current_user.get("name") or current_user.get("username") or "Administrator",
        }
    )
    return created


@router.put("/{category_id}")
def update_category(
    category_id: int,
    req: CategoryUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    if current_user.get("role") != "Administrator":
        raise HTTPException(status_code=403, detail="Only administrators can update product categories.")

    existing_cat = ProductCategoryStore.get_by_id(category_id)
    if not existing_cat:
        raise HTTPException(status_code=404, detail="Category not found.")

    update_data = req.model_dump(exclude_unset=True)

    if "label" in update_data and update_data["label"] is not None:
        new_label = update_data["label"].strip()
        if not new_label:
            raise HTTPException(status_code=400, detail="Category name cannot be empty.")
        all_cats = ProductCategoryStore.list_categories()
        sim = compute_category_similarity(
            candidate_label=new_label,
            candidate_description=update_data.get("description") or existing_cat.get("description") or "",
            candidate_aliases=update_data.get("aliases") or existing_cat.get("aliases") or [],
            candidate_field_labels=[],
            existing_categories=all_cats,
            exclude_id=category_id,
        )
        if sim["exact_match"]:
            raise HTTPException(
                status_code=400,
                detail=f"Duplicate category: {sim['exact_match']['reason']}.",
            )
        update_data["label"] = new_label

    if "fields_schema" in update_data and update_data["fields_schema"] is not None:
        update_data["fields_schema"] = _ensure_base_fields(update_data["fields_schema"])
        if "name_template" not in update_data and not existing_cat.get("is_system"):
            default_name_tpl, default_code_tpl = _build_default_templates(update_data["fields_schema"])
            update_data["name_template"] = default_name_tpl
            if "code_template" not in update_data:
                update_data["code_template"] = default_code_tpl

    if "code_prefix" in update_data and update_data["code_prefix"] is not None:
        update_data["code_prefix"] = update_data["code_prefix"].strip().upper()[:10]

    if "aliases" in update_data and update_data["aliases"] is not None:
        update_data["aliases"] = list(dict.fromkeys([a.strip() for a in update_data["aliases"] if a and a.strip()]))

    if "keywords" in update_data and update_data["keywords"] is not None:
        update_data["keywords"] = list(dict.fromkeys([k.strip().lower() for k in update_data["keywords"] if k and k.strip()]))

    updated = ProductCategoryStore.update_category(category_id, update_data)
    return updated


@router.delete("/{category_id}")
def delete_category(category_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    if current_user.get("role") != "Administrator":
        raise HTTPException(status_code=403, detail="Only administrators can delete product categories.")
    try:
        deleted = ProductCategoryStore.delete_category(category_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Category not found.")
        return {"success": True, "message": "Category deleted successfully."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{source_id}/merge/{target_id}")
def merge_categories(
    source_id: int,
    target_id: int,
    req: CategoryMergeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    if current_user.get("role") != "Administrator":
        raise HTTPException(status_code=403, detail="Only administrators can merge product categories.")
    try:
        result = ProductCategoryStore.merge_categories(
            source_id=source_id,
            target_id=target_id,
            field_mapping=req.field_mapping,
            add_unmapped_fields=req.add_unmapped_fields,
            preserve_in_notes=req.preserve_in_notes,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
