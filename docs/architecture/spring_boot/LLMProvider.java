package com.appsuite.planning.service;

import com.appsuite.planning.model.ProjectRequest;

public interface LLMProvider {
    /**
     * Executes the call to the respective LLM model endpoint.
     */
    String generatePlanJson(ProjectRequest request, String promptTemplate) throws Exception;

    /**
     * Returns the name of this provider.
     */
    String getProviderName();
}
