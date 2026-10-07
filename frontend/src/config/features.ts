/**
 * AppSuite Features Class & Flags Configuration.
 * Provides boolean toggles to control modular system features.
 */

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  default: boolean;
}

export class Features {
  // Feature 1: Project access restriction
  static RESTRICT_PROJECT_ACCESS_TO_INVOLVED_USERS: boolean = true;

  // Feature 2: Admin bypass for restrictions
  static ADMIN_BYPASS_RESTRICTIONS: boolean = true;

  // Feature 3: Configurable electrical industry user categories
  static CONFIGURABLE_USER_CATEGORIES: boolean = true;

  // Feature 4: Strict task assignment
  static STRICT_TASK_ASSIGNMENT: boolean = false;

  // Feature 5: Automatic project code generation
  static AUTO_PROJECT_CODE_GENERATION: boolean = true;

  // Feature 6: AI-assisted project planning & scheduling
  static AI_PROJECT_PLANNING: boolean = true;

  // Feature 7: Soft-deletion and recycle bin for projects
  static ENABLE_PROJECT_RECYCLE_BIN: boolean = true;

  // Feature 8: Hierarchical multi-tier subprojects
  static ENABLE_SUBPROJECTS_HIERARCHY: boolean = true;

  // Feature 9: Service Desk & Field Tickets module
  static ENABLE_SERVICE_DESK: boolean = true;

  // Feature 10: Automatic directory file synchronization
  static AUTO_SYNC_PROJECT_FILES: boolean = true;

  /**
   * Helper to check if a user is involved in a project client-side
   */
  static isUserInvolved(project: any, user: any): boolean {
    if (!this.RESTRICT_PROJECT_ACCESS_TO_INVOLVED_USERS) return true;
    if (!user) return false;
    if (this.ADMIN_BYPASS_RESTRICTIONS && (user.role === 'Administrator' || user.role === 'Store Manager')) {
      return true;
    }

    const userName = (user.name || '').trim().toLowerCase();
    const username = (user.username || '').trim().toLowerCase();
    const incharge = (project.project_incharge || '').trim().toLowerCase();

    // Check project in-charge
    if (incharge && (incharge === userName || incharge === username)) {
      return true;
    }

    // Check project tasks assignees if present
    if (Array.isArray(project.tasks)) {
      const isAssigned = project.tasks.some((t: any) => {
        if (t.assignee_id && t.assignee_id === user.id) return true;
        if (Array.isArray(t.assignee_ids) && t.assignee_ids.includes(user.id)) return true;
        if (Array.isArray(t.assignees) && t.assignees.some((a: any) => a.id === user.id)) return true;
        return false;
      });
      if (isAssigned) return true;
    }

    return false;
  }
}
