package com.appsuite.planning.controller;

import com.appsuite.planning.model.ProjectRequest;
import com.appsuite.planning.model.dto.ScheduledProjectDto;
import com.appsuite.planning.service.ProjectService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects")
public class ProjectPlanningController {

    private final ProjectService projectService;

    public ProjectPlanningController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @PostMapping("/generate-plan")
    public ResponseEntity<ScheduledProjectDto> generateProjectPlan(
            @RequestBody ProjectRequest request,
            @RequestParam(defaultValue = "Ollama") String provider) {
        ScheduledProjectDto scheduledProject = projectService.createAndScheduleProject(request, provider);
        return new ResponseEntity<>(scheduledProject, HttpStatus.CREATED);
    }
}
