package com.appsuite.planning.service;

import com.appsuite.planning.model.ProjectRequest;
import com.appsuite.planning.model.dto.ProjectExecutionPlanDto;

public interface AIPlanningService {
    /**
     * Sends the structured prompt context to the selected LLM provider,
     * parses the response and maps it to a validated DTO.
     */
    ProjectExecutionPlanDto planProject(ProjectRequest request, String providerName);
}
