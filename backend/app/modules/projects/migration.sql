-- AppSuite Projects Module Migration SQL
-- Run this schema update on your smart_store MySQL / Supabase PostgreSQL database.

-- Alter projects table to include constraints, budget, priority
ALTER TABLE projects ADD COLUMN constraints TEXT DEFAULT NULL;
ALTER TABLE projects ADD COLUMN budget DECIMAL(15, 2) DEFAULT NULL;
ALTER TABLE projects ADD COLUMN priority VARCHAR(20) DEFAULT 'MEDIUM';

-- Create Project Risks Table
CREATE TABLE IF NOT EXISTS project_risks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    risk_description TEXT NOT NULL,
    impact_level VARCHAR(20) DEFAULT 'MEDIUM',
    probability_level VARCHAR(20) DEFAULT 'MEDIUM',
    mitigation_strategy TEXT DEFAULT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Create Project Milestones Table
CREATE TABLE IF NOT EXISTS project_milestones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    associated_task_id INT DEFAULT NULL,
    target_date DATE DEFAULT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Create Task Dependencies Table (SS, FF, FS, SF relationships)
CREATE TABLE IF NOT EXISTS task_dependencies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    depends_on_task_id INT NOT NULL,
    dependency_type VARCHAR(20) DEFAULT 'FS',
    lag_days INT DEFAULT 0,
    FOREIGN KEY (task_id) REFERENCES dynamic_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_task_id) REFERENCES dynamic_tasks(id) ON DELETE CASCADE
);

-- Create Resource Suggestions Table (assignee suggestions mapping based on skills)
CREATE TABLE IF NOT EXISTS resource_suggestions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    suggested_role VARCHAR(100),
    required_skills TEXT,
    FOREIGN KEY (task_id) REFERENCES dynamic_tasks(id) ON DELETE CASCADE
);
