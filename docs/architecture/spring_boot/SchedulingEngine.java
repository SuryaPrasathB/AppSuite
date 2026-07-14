package com.appsuite.planning.service;

import com.appsuite.planning.model.ProjectRequest;
import com.appsuite.planning.model.dto.ProjectExecutionPlanDto;
import com.appsuite.planning.model.dto.ScheduledProjectDto;

public interface SchedulingEngine {
    /**
     * Executes Forward and Backward Pass calculations (CPM),
     * computes float/slack, identifies the critical path, 
     * levels resources, and maps durations to real calendar days.
     */
    ScheduledProjectDto calculateSchedule(ProjectExecutionPlanDto rawPlan, ProjectRequest metadata);
}
