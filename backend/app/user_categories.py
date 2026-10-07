"""
User Categories Configuration Service.
Manages professional job titles and categories suited for an electrical/automation engineering firm.
Supports reading from and persisting to backend/user_categories.json.
"""

import os
import json
from typing import List, Dict, Any, Optional

CATEGORIES_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "user_categories.json")

DEFAULT_CATEGORIES: List[Dict[str, Any]] = [
    {
        "category": "Testing Engineer",
        "department": "Quality & Testing",
        "description": "Performs routine, functional, HV, insulation, dielectric, and FAT/SAT testing on control panels.",
        "access_level": "Employee"
    },
    {
        "category": "Mechanical Designer",
        "department": "Mechanical Engineering",
        "description": "Designs 3D enclosure structures, sheet metal fabrication drawings, busbar clearances, and GA layouts.",
        "access_level": "Employee"
    },
    {
        "category": "Electrical Designer",
        "department": "Electrical Engineering",
        "description": "Prepares electrical schematics, SLD diagrams, control circuit layouts, terminal charts, and BOM specifications.",
        "access_level": "Employee"
    },
    {
        "category": "Development Engineer",
        "department": "R&D / Systems",
        "description": "Develops embedded systems, firmware, custom electronics, communication gateways, and IoT modules.",
        "access_level": "Employee"
    },
    {
        "category": "Electrician",
        "department": "Production & Assembly",
        "description": "Executes main power cabling, busbar assembly, MCCB/switchgear installation, and physical terminations.",
        "access_level": "Employee"
    },
    {
        "category": "Automation / PLC Programmer",
        "department": "Automation & Controls",
        "description": "Programs PLCs, HMIs, SCADA systems, VFD drives, and field communication networks (Modbus, Profinet).",
        "access_level": "Employee"
    },
    {
        "category": "Commissioning Engineer",
        "department": "Field & Site Services",
        "description": "Conducts on-site panel installation, energization, site acceptance testing (SAT), and client handover.",
        "access_level": "Employee"
    },
    {
        "category": "Quality Assurance (QA/QC) Engineer",
        "department": "Quality Assurance",
        "description": "Maintains ISO standards, inspects incoming raw materials, audits panel assembly, and signs test certs.",
        "access_level": "Employee"
    },
    {
        "category": "HR",
        "department": "Human Resources",
        "description": "Manages human resource operations, employee onboarding, attendance, safety compliance, and records.",
        "access_level": "Employee"
    },
    {
        "category": "Project Manager",
        "department": "Project Management",
        "description": "Coordinates project scheduling, resource allocation, customer milestone delivery, and tracking.",
        "access_level": "Employee"
    },
    {
        "category": "Store Manager",
        "department": "Store & Warehouse",
        "description": "Oversees inventory stock levels, warehouse bins, goods receipts, and warehouse logistics.",
        "access_level": "Store Manager"
    },
    {
        "category": "Store Operator",
        "department": "Store & Warehouse",
        "description": "Handles daily stock-in, material issue for BOMs, physical transfers, and inventory counts.",
        "access_level": "Store Operator"
    },
    {
        "category": "Purchase Team",
        "department": "Procurement",
        "description": "Manages supplier RFQs, purchase orders, component procurement, and vendor relations.",
        "access_level": "Purchase Team"
    },
    {
        "category": "Administrator",
        "department": "Management",
        "description": "Full system administrator access to all modules, users, configurations, and settings.",
        "access_level": "Administrator"
    }
]


class UserCategoriesManager:
    """Manages reading, adding, updating, and deleting user categories."""

    @staticmethod
    def get_all() -> List[Dict[str, Any]]:
        """Returns the list of configured user categories."""
        if not os.path.exists(CATEGORIES_FILE_PATH):
            UserCategoriesManager.save(DEFAULT_CATEGORIES)
            return DEFAULT_CATEGORIES
        try:
            with open(CATEGORIES_FILE_PATH, "r", encoding="utf-8") as f:
                categories = json.load(f)
                if isinstance(categories, list) and len(categories) > 0:
                    return categories
                return DEFAULT_CATEGORIES
        except Exception as e:
            print(f"Warning: Could not read {CATEGORIES_FILE_PATH}: {e}")
            return DEFAULT_CATEGORIES

    @staticmethod
    def save(categories: List[Dict[str, Any]]) -> bool:
        """Persists the category list to user_categories.json."""
        try:
            with open(CATEGORIES_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(categories, f, indent=2)
            return True
        except Exception as e:
            print(f"Failed to save user categories: {e}")
            return False

    @staticmethod
    def add_category(category_data: Dict[str, Any]) -> Dict[str, Any]:
        """Adds a new user category."""
        categories = UserCategoriesManager.get_all()
        cat_name = category_data.get("category", "").strip()
        if not cat_name:
            raise ValueError("Category name cannot be empty")

        # Check existing
        for c in categories:
            if c.get("category", "").lower() == cat_name.lower():
                raise ValueError(f"Category '{cat_name}' already exists")

        new_entry = {
            "category": cat_name,
            "department": category_data.get("department", "General").strip(),
            "description": category_data.get("description", "").strip(),
            "access_level": category_data.get("access_level", "Employee").strip()
        }
        categories.append(new_entry)
        UserCategoriesManager.save(categories)
        return new_entry

    @staticmethod
    def update_category(cat_name: str, category_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Updates an existing category by name."""
        categories = UserCategoriesManager.get_all()
        updated_entry = None
        for i, c in enumerate(categories):
            if c.get("category", "").lower() == cat_name.lower():
                categories[i] = {
                    "category": category_data.get("category", c["category"]).strip(),
                    "department": category_data.get("department", c.get("department", "General")).strip(),
                    "description": category_data.get("description", c.get("description", "")).strip(),
                    "access_level": category_data.get("access_level", c.get("access_level", "Employee")).strip()
                }
                updated_entry = categories[i]
                break

        if updated_entry:
            UserCategoriesManager.save(categories)
        return updated_entry

    @staticmethod
    def delete_category(cat_name: str) -> bool:
        """Deletes a category from the configured list."""
        categories = UserCategoriesManager.get_all()
        original_len = len(categories)
        categories = [c for c in categories if c.get("category", "").lower() != cat_name.lower()]
        if len(categories) < original_len:
            UserCategoriesManager.save(categories)
            return True
        return False
