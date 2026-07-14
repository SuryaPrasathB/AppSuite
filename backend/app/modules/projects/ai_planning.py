import json
from typing import Dict, Any
from app.services.llm.provider import get_llm_provider

# System prompt base that enforces constraints
SYSTEM_PROMPT_TEMPLATE = """You are an expert project planner and coordinator.
Create a detailed execution plan based on the following project context.
You MUST output valid, parseable JSON matching the schema below.
Rules:
1. Break down the project into logical sequential phases.
2. Under each phase, define tasks.
3. Every task must have a duration (estimatedDays and estimatedHours) and optional storyPoints, complexity (LOW, MEDIUM, HIGH), priority, and confidenceScore (0.0 to 1.0).
4. Break each task down into detailed subtasks (minimum 3 subtasks per task).
5. Specify realistic dependencies between tasks. Use only the task IDs defined in the plan.
6. Identify groups of tasks that can run in parallel (parallelGroups).
7. Generate standard milestones (milestones).
8. Suggest project risks with mitigation strategies (risks).
9. Suggest resource matching based on team member skills if available (resourceSuggestions).
10. DO NOT include any calendar dates (e.g. '2026-07-20'). Only provide duration values in days/hours.
11. Return ONLY the JSON object. No explanations, no markdown tags.

JSON Schema format to follow:
{{
  "project": {{
    "name": "Project Name",
    "complexity": "LOW/MEDIUM/HIGH",
    "estimatedDurationDays": 10
  }},
  "phases": [
    {{ "id": "phase_id", "name": "Phase Name", "sequenceOrder": 1 }}
  ],
  "tasks": [
    {{
      "id": "task_id",
      "phaseId": "phase_id",
      "name": "Task Name",
      "description": "Task details",
      "estimatedHours": 8,
      "estimatedDays": 1,
      "storyPoints": 2,
      "complexity": "LOW/MEDIUM/HIGH",
      "confidenceScore": 0.95,
      "priority": "LOW/MEDIUM/HIGH"
    }}
  ],
  "subtasks": [
    {{ "id": "subtask_id", "taskId": "task_id", "name": "Subtask Name" }}
  ],
  "dependencies": [
    {{ "taskId": "task_id_2", "dependsOnTaskId": "task_id_1", "dependencyType": "FS", "lagDays": 0 }}
  ],
  "parallelGroups": [
    {{ "groupId": "group_1", "taskIds": ["task_id_3", "task_id_4"] }}
  ],
  "milestones": [
    {{ "id": "milestone_1", "name": "Milestone Name", "associatedTaskId": "task_id_1" }}
  ],
  "risks": [
    {{ "riskDescription": "Risk details", "impactLevel": "LOW/MEDIUM/HIGH", "probabilityLevel": "LOW/MEDIUM/HIGH", "mitigationStrategy": "Mitigation steps" }}
  ],
  "resourceSuggestions": [
    {{ "taskId": "task_id_1", "suggestedRole": "Developer", "requiredSkills": ["Python", "SQL"] }}
  ]
}}
"""

PROJECT_TYPE_PROMPTS = {
    "software": "Focus on agile development practices, source control setup, DB design, API endpoints, testing, frontend-backend integration, and deployment/CI-CD.",
    "hardware": "Focus on schematic design, component sourcing, PCB routing/fabrication, casing design/3D printing, firmware integration, and hardware testing/compliance certification.",
    "research": "Focus on literature review, methodology setup, data collection, experiments, analysis, review/peer-review, documentation, and reporting findings.",
    "manufacturing": "Focus on tooling setup, bill of materials (BOM) auditing, quality assurance procedures, pilot runs, production planning, packaging, and safety/maintenance scheduling.",
    "construction": "Focus on site analysis, architectural layouts, structural/foundation tasks, procurement of materials, electrical/plumbing layout, interior/exterior finishing, and safety approvals.",
    "generic": "Break down the project logically into core sequential execution steps tailored to the goals."
}

class AIPlanningService:
    @staticmethod
    def generate_plan(payload: Dict[str, Any], provider_name: str = "Ollama") -> Dict[str, Any]:
        """
        Generates the raw planning data from LLM and validates JSON structure.
        """
        project_type = payload.get("projectType", "generic").lower()
        type_hint = PROJECT_TYPE_PROMPTS.get(project_type, PROJECT_TYPE_PROMPTS["generic"])

        # Format prompt
        prompt = f"{SYSTEM_PROMPT_TEMPLATE}\n\nProject Type: {project_type.upper()}\nFocus: {type_hint}\n\nProject metadata:\n"
        prompt += f"Name: {payload.get('name')}\n"
        prompt += f"Description: {payload.get('description')}\n"
        prompt += f"Objectives: {payload.get('objectives')}\n"
        prompt += f"Scope: {payload.get('scope')}\n"
        prompt += f"Technologies: {payload.get('technologies')}\n"
        prompt += f"Team members pool: {payload.get('teamMembers')}\n"
        prompt += f"Constraints: {payload.get('constraints')}\n"
        prompt += f"Budget: {payload.get('budget')}\n"

        provider = get_llm_provider(provider_name)
        result = provider.generate_plan_json(payload, prompt)
        
        # Validate schema structure
        required_keys = ["project", "phases", "tasks", "subtasks", "dependencies", "parallelGroups", "milestones", "risks", "resourceSuggestions"]
        for key in required_keys:
            if key not in result:
                result[key] = [] if key != "project" else {}

        return result
