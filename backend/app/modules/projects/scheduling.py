from datetime import datetime, timedelta
from typing import Dict, Any, List, Set

class SchedulingEngine:
    @staticmethod
    def calculate_schedule(raw_plan: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes CPM (Critical Path Method) forward & backward passes,
        calculates slack, flags critical path tasks, and maps offsets to actual calendar dates.
        """
        # Read metadata
        start_date_str = metadata.get("startDate") or metadata.get("start_date") or datetime.now().strftime("%Y-%m-%d")
        project_start = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        
        working_days_str = metadata.get("workingDays") or "MON,TUE,WED,THU,FRI"
        working_days = {d.strip().upper() for d in working_days_str.split(",")}
        
        holidays_list = metadata.get("holidays") or []
        holidays = {datetime.strptime(h, "%Y-%m-%d").date() for h in holidays_list if h}

        tasks = raw_plan.get("tasks", [])
        dependencies = raw_plan.get("dependencies", [])

        # 1. Map tasks by ID
        task_map = {t["id"]: t for t in tasks}
        
        # Initialize scheduling fields
        for t in tasks:
            t["es"] = 0
            t["ef"] = 0
            t["ls"] = 0
            t["lf"] = 0
            t["slack"] = 0
            t["isCriticalPath"] = False
            t["predecessors"] = []
            t["successors"] = []

        # 2. Build adjacency list
        for dep in dependencies:
            task_id = dep["taskId"]
            depends_on = dep["dependsOnTaskId"]
            
            if task_id in task_map and depends_on in task_map:
                task_map[task_id]["predecessors"].append(depends_on)
                task_map[depends_on]["successors"].append(task_id)

        # 3. Topological Sort (Cycle Detection using Kahn's Algorithm)
        in_degree = {t["id"]: len(t["predecessors"]) for t in tasks}
        queue = [t["id"] for t in tasks if in_degree[t["id"]] == 0]
        topo_order = []

        while queue:
            curr = queue.pop(0)
            topo_order.append(curr)
            for succ in task_map[curr]["successors"]:
                in_degree[succ] -= 1
                if in_degree[succ] == 0:
                    queue.append(succ)

        # Cycle resolution: if topological sort didn't visit all tasks, a cycle exists.
        # We break cycles by removing back-edges to prevent crash.
        if len(topo_order) < len(tasks):
            visited = set(topo_order)
            unvisited = [t["id"] for t in tasks if t["id"] not in visited]
            for u in unvisited:
                task_map[u]["predecessors"] = []  # break incoming dependencies
                topo_order.append(u)

        # 4. Forward Pass
        for tid in topo_order:
            t = task_map[tid]
            duration = int(t.get("estimatedDays") or 1)
            
            # ES = max(EF of predecessors)
            es_val = 0
            for pred_id in t["predecessors"]:
                es_val = max(es_val, task_map[pred_id]["ef"])
            t["es"] = es_val
            t["ef"] = es_val + duration

        # 5. Backward Pass
        if not topo_order:
            max_duration = 0
        else:
            max_duration = max(task_map[tid]["ef"] for tid in topo_order)

        for tid in reversed(topo_order):
            t = task_map[tid]
            duration = int(t.get("estimatedDays") or 1)
            
            # If no successors, LF = project duration max_duration
            if not t["successors"]:
                lf_val = max_duration
            else:
                lf_val = min(task_map[succ_id]["ls"] for succ_id in t["successors"])
            
            t["lf"] = lf_val
            t["ls"] = lf_val - duration

        # 6. Calculate Slack and Critical Path flag
        for t in tasks:
            t["slack"] = t["lf"] - t["ef"]
            t["isCriticalPath"] = (t["slack"] == 0)

        # Helper: add working days to calendar date
        def add_working_days(start_date_val, days_to_add):
            curr_date = start_date_val
            added = 0
            while added < days_to_add:
                curr_date += timedelta(days=1)
                # Check day of week
                day_name = curr_date.strftime("%a").upper() # MON, TUE, etc.
                # If it's a working day and not a holiday, increment added count
                if day_name in working_days and curr_date not in holidays:
                    added += 1
            return curr_date

        # Helper: calculate date string from offset
        def get_calendar_date(offset_days):
            if offset_days <= 0:
                return project_start.strftime("%Y-%m-%d")
            return add_working_days(project_start, offset_days).strftime("%Y-%m-%d")

        # 7. Map relative offsets to actual Calendar dates
        for t in tasks:
            t_es_days = t["es"]
            t_ef_days = t["ef"]
            t_ls_days = t["ls"]
            t_lf_days = t["lf"]
            
            t["earliestStartDate"] = get_calendar_date(t_es_days)
            t["earliestFinishDate"] = get_calendar_date(t_ef_days)
            t["latestStartDate"] = get_calendar_date(t_ls_days)
            t["latestFinishDate"] = get_calendar_date(t_lf_days)

        # Cleanup internal predecessor/successor lists before returning
        for t in tasks:
            t.pop("predecessors", None)
            t.pop("successors", None)

        return raw_plan
