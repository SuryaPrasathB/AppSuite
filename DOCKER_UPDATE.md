# Docker Deployment & Update Guide

This guide details the step-by-step process for taking source code changes from your Development PC, packaging them into Docker images, and deploying them to your offline Server PC.

---

## Part 1: On Your Development PC

Whenever you make changes to the frontend (`.tsx` files), backend (`.py` files), or dependencies, follow these steps to build and package those changes.

### 1. Build the Latest Images
Open your terminal in the root project folder (`AppSuite`) and run:
```bash
docker compose up -d --build
```
This forces Docker to compile your latest source code into new `appsuite-frontend:latest` and `appsuite-backend:latest` images.

### 2. Export Images to a `.tar` File
Once the build is successful, package the newly built images (along with the database image) into a single `.tar` archive so it can be transferred:
```bash
docker save -o appsuite-images.tar appsuite-frontend:latest appsuite-backend:latest mysql:8
```
*Depending on the size of the images, this command may take a few minutes to complete.*

### 3. Transfer Files to the Server PC
You only need to transfer two items to your Server PC:
1. The generated `appsuite-images.tar` file.
2. The `docker-compose.yml` file (if you have made any configuration changes to it).

*(You do **not** need to transfer the `frontend` or `backend` source code folders).*

---

## Part 2: On Your Server PC

Once the files have been moved to the Server PC, follow these steps to deploy the update.

### 1. Load the Docker Images
Open your terminal on the server in the folder where you placed the `.tar` file and run:
```bash
docker load -i appsuite-images.tar
```
*This extracts the updated images into the server's local Docker environment.*

### 2. Restart the Containers
In the exact same folder (where your `docker-compose.yml` is located), run the following commands to stop the old containers and start the new ones:
```bash
docker-compose down
docker-compose up -d
```
*(Notice there is no `--build` flag here, because the images are already built and loaded).*

### 3. Run Database Migrations (If Required)
If your update includes database schema changes (like adding new tables or columns), you must manually run the migration scripts against the live server database. 

*If your update only contains UI or simple backend logic changes without database schema modifications, you can skip this step.*

To run your migration scripts, execute them inside the running backend container:
```bash
docker exec -it smart_store_backend python db_update.py
docker exec -it smart_store_backend python update_projects_parent_db.py
docker exec -it smart_store_backend python update_task_comments_db.py
docker exec -it smart_store_backend python add_announcements_table.py
```
*If a script hangs or freezes for a long time, press `Ctrl + C`, restart the database (`docker restart smart_store_db`), and try running the script again to clear any database locks.*

---,  ,
## Troubleshooting

- **Mount Denied Error (Too many colons):** If you see an error like `mount denied: the source path ... too many colons` when starting containers on Windows, ensure your `docker-compose.yml` uses forward slashes for absolute paths. (e.g., Use `D:/PROJECTS:/projects` instead of `D:\PROJECTS:/projects`).
