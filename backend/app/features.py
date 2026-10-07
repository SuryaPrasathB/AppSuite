"""
AppSuite Feature Management System.
Defines the Features class with boolean toggles to control modular application features.
Features can be queried, dynamically toggled at runtime, and persisted to features_config.json.
"""

import os
import json
from typing import Dict, Any, Optional, List, Tuple

CONFIG_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "features_config.json")


class Features:
    """
    Central Features configuration and toggle manager.
    Attributes are boolean toggles representing system capabilities.
    """

    # Feature 1: Project access restriction
    # When True: Regular employees only see projects they are actively involved in (in-charge, task assignee, ticket assignee).
    # When False: All users can see all projects in the system.
    RESTRICT_PROJECT_ACCESS_TO_INVOLVED_USERS: bool = True

    # Feature 2: Admin bypass for restrictions
    # When True: Administrator and Store Manager bypass the project involvement filter.
    ADMIN_BYPASS_RESTRICTIONS: bool = True

    # Feature 3: Configurable electrical industry user categories
    # Enables dynamic professional categories (Testing Engineer, Electrical Designer, Electrician, etc.)
    CONFIGURABLE_USER_CATEGORIES: bool = True

    # Feature 4: Strict task assignment
    # When True: Only team members already involved in the project can be assigned new tasks.
    STRICT_TASK_ASSIGNMENT: bool = False

    # Feature 5: Automatic project code generation
    AUTO_PROJECT_CODE_GENERATION: bool = True

    # Feature 6: AI-assisted project planning & scheduling
    AI_PROJECT_PLANNING: bool = True

    # Feature 7: Soft-deletion and recycle bin for projects
    ENABLE_PROJECT_RECYCLE_BIN: bool = True

    # Feature 8: Hierarchical multi-tier subprojects
    ENABLE_SUBPROJECTS_HIERARCHY: bool = True

    # Feature 9: Service Desk & Field Tickets module
    ENABLE_SERVICE_DESK: bool = True

    # Feature 10: Automatic directory file synchronization
    AUTO_SYNC_PROJECT_FILES: bool = True

    # Roles considered privileged (bypass involvement checks when ADMIN_BYPASS_RESTRICTIONS is True)
    UNRESTRICTED_ROLES = ["Administrator", "Store Manager"]

    # Human-readable metadata describing each feature toggle
    METADATA = {
        "RESTRICT_PROJECT_ACCESS_TO_INVOLVED_USERS": {
            "name": "Restrict Projects to Involved Users",
            "description": "Users can only view and access projects where they are assigned as in-charge, task assignees, or ticket assignees.",
            "category": "Security & Access",
            "default": True
        },
        "ADMIN_BYPASS_RESTRICTIONS": {
            "name": "Admin Full Visibility Bypass",
            "description": "Allows Administrators and Store Managers to view all projects regardless of involvement.",
            "category": "Security & Access",
            "default": True
        },
        "CONFIGURABLE_USER_CATEGORIES": {
            "name": "Configurable User Categories",
            "description": "Enables professional electrical industry roles (Testing Engineer, Electrical Designer, Electrician, etc.).",
            "category": "User Management",
            "default": True
        },
        "STRICT_TASK_ASSIGNMENT": {
            "name": "Strict Task Assignment",
            "description": "Restricts task assignment only to team members already assigned to the project.",
            "category": "Workflow",
            "default": False
        },
        "AUTO_PROJECT_CODE_GENERATION": {
            "name": "Auto Project Code Generation",
            "description": "Automatically generates standardized project serial numbers (e.g., 440/PRJ/0926).",
            "category": "Projects",
            "default": True
        },
        "AI_PROJECT_PLANNING": {
            "name": "AI Project Planning Assistant",
            "description": "Enables LLM-assisted Work Breakdown Structure (WBS), subtask decomposition, and risk assessments.",
            "category": "AI Features",
            "default": True
        },
        "ENABLE_PROJECT_RECYCLE_BIN": {
            "name": "Project Recycle Bin",
            "description": "Enables soft-deletion of projects with 30-day recovery and restore capability.",
            "category": "Data Safety",
            "default": True
        },
        "ENABLE_SUBPROJECTS_HIERARCHY": {
            "name": "Sub-project Hierarchy",
            "description": "Supports nesting child panels / sub-assemblies under major parent projects.",
            "category": "Projects",
            "default": True
        },
        "ENABLE_SERVICE_DESK": {
            "name": "Service Desk & Field Tickets",
            "description": "Enables customer ticket management, issue tracking, and field engineering logs.",
            "category": "Operations",
            "default": True
        },
        "AUTO_SYNC_PROJECT_FILES": {
            "name": "Automatic Project File Sync",
            "description": "Automatically indexes files from network / local project directory when opening a workspace.",
            "category": "Filesystem",
            "default": True
        }
    }

    @classmethod
    def load_config(cls):
        """Loads feature flag values from features_config.json if present."""
        if os.path.exists(CONFIG_FILE_PATH):
            try:
                with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for key, val in data.items():
                        if hasattr(cls, key) and isinstance(val, bool):
                            setattr(cls, key, val)
            except Exception as e:
                print(f"Warning: Could not read features_config.json: {e}")

    @classmethod
    def save_config(cls):
        """Persists current feature flag values to features_config.json."""
        data = {}
        for key in cls.METADATA.keys():
            data[key] = getattr(cls, key, cls.METADATA[key]["default"])
        try:
            with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not save features_config.json: {e}")

    @classmethod
    def is_enabled(cls, feature_name: str) -> bool:
        """Check if a specific feature toggle is enabled."""
        cls.load_config()
        return bool(getattr(cls, feature_name, False))

    @classmethod
    def set_feature(cls, feature_name: str, enabled: bool) -> bool:
        """Update and persist a specific feature toggle."""
        if feature_name in cls.METADATA:
            setattr(cls, feature_name, bool(enabled))
            cls.save_config()
            return True
        return False

    @classmethod
    def get_all(cls) -> List[Dict[str, Any]]:
        """Returns all features with current enabled status and metadata."""
        cls.load_config()
        result = []
        for key, meta in cls.METADATA.items():
            result.append({
                "key": key,
                "name": meta["name"],
                "description": meta["description"],
                "category": meta["category"],
                "enabled": getattr(cls, key, meta["default"]),
                "default": meta["default"]
            })
        return result

    @classmethod
    def get_project_involvement_condition(cls, current_user: Optional[Dict[str, Any]]) -> Tuple[str, List[Any]]:
        """
        Returns SQL WHERE clause and parameters to filter projects to only those the current user is involved in.
        If feature toggle is disabled or user is privileged admin/manager, returns ('1=1', []).
        """
        if not cls.is_enabled("RESTRICT_PROJECT_ACCESS_TO_INVOLVED_USERS"):
            return "1=1", []

        if not current_user:
            # If no authenticated user is supplied and restriction is ON, deny
            return "1=0", []

        user_role = current_user.get("role", "")
        if cls.is_enabled("ADMIN_BYPASS_RESTRICTIONS") and user_role in cls.UNRESTRICTED_ROLES:
            return "1=1", []

        user_id = current_user.get("id")
        user_name = current_user.get("name") or ""
        username = current_user.get("username") or ""

        # Condition checks:
        # 1. User is project in-charge (by name or username)
        # 2. User is assigned to any dynamic task or in task_assignees in this project
        # 3. User is involved in any sub-project (in-charge or task assignee)
        # 4. User is project in-charge of the parent project
        # 5. User is assigned to or created service tickets for this project
        sql = """(
            (p.project_incharge = %s OR p.project_incharge = %s)
            OR EXISTS (
                SELECT 1 FROM dynamic_tasks dt 
                WHERE dt.project_id = p.id 
                AND (dt.assignee_id = %s OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = dt.id AND ta.employee_id = %s))
            )
            OR EXISTS (
                SELECT 1 FROM projects sub_p 
                WHERE sub_p.parent_id = p.id 
                AND (
                    sub_p.project_incharge = %s OR sub_p.project_incharge = %s
                    OR EXISTS (
                        SELECT 1 FROM dynamic_tasks sdt 
                        WHERE sdt.project_id = sub_p.id 
                        AND (sdt.assignee_id = %s OR EXISTS (SELECT 1 FROM task_assignees sta WHERE sta.task_id = sdt.id AND sta.employee_id = %s))
                    )
                )
            )
            OR (p.parent_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM projects par_p 
                WHERE par_p.id = p.parent_id 
                AND (par_p.project_incharge = %s OR par_p.project_incharge = %s)
            ))
            OR EXISTS (
                SELECT 1 FROM service_tickets st 
                WHERE st.project_id = p.id 
                AND (st.assignee_id = %s OR st.creator_id = %s OR st.resolved_by = %s)
            )
        )"""

        params = [
            user_name, username,
            user_id, user_id,
            user_name, username,
            user_id, user_id,
            user_name, username,
            user_id, user_id, user_id
        ]

        return sql, params

    @classmethod
    def user_is_involved_in_project(cls, current_user: Optional[Dict[str, Any]], project_id: int, cursor) -> bool:
        """
        Validates if a specific user is involved in a single project.
        """
        if not cls.is_enabled("RESTRICT_PROJECT_ACCESS_TO_INVOLVED_USERS"):
            return True

        if not current_user:
            return False

        user_role = current_user.get("role", "")
        if cls.is_enabled("ADMIN_BYPASS_RESTRICTIONS") and user_role in cls.UNRESTRICTED_ROLES:
            return True

        user_id = current_user.get("id")
        user_name = current_user.get("name") or ""
        username = current_user.get("username") or ""

        query = """
            SELECT 1 FROM projects p
            WHERE p.id = %s AND (
                (p.project_incharge = %s OR p.project_incharge = %s)
                OR EXISTS (
                    SELECT 1 FROM dynamic_tasks dt 
                    WHERE dt.project_id = p.id 
                    AND (dt.assignee_id = %s OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = dt.id AND ta.employee_id = %s))
                )
                OR EXISTS (
                    SELECT 1 FROM projects sub_p 
                    WHERE sub_p.parent_id = p.id 
                    AND (
                        sub_p.project_incharge = %s OR sub_p.project_incharge = %s
                        OR EXISTS (
                            SELECT 1 FROM dynamic_tasks sdt 
                            WHERE sdt.project_id = sub_p.id 
                            AND (sdt.assignee_id = %s OR EXISTS (SELECT 1 FROM task_assignees sta WHERE sta.task_id = sdt.id AND sta.employee_id = %s))
                        )
                    )
                )
                OR (p.parent_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM projects par_p 
                    WHERE par_p.id = p.parent_id 
                    AND (par_p.project_incharge = %s OR par_p.project_incharge = %s)
                ))
                OR EXISTS (
                    SELECT 1 FROM service_tickets st 
                    WHERE st.project_id = p.id 
                    AND (st.assignee_id = %s OR st.creator_id = %s OR st.resolved_by = %s)
                )
            )
            LIMIT 1
        """
        params = [
            project_id,
            user_name, username,
            user_id, user_id,
            user_name, username,
            user_id, user_id,
            user_name, username,
            user_id, user_id, user_id
        ]
        cursor.execute(query, tuple(params))
        return cursor.fetchone() is not None


# Initialize on import
Features.load_config()
