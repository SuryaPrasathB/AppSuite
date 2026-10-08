# AppSuite Mobile — Dedicated Enterprise Smartphone App

A dedicated, native mobile application for **AppSuite**, engineered in **Flutter 3 (Dart)** for iOS and Android smartphones.

This mobile application provides feature parity with the desktop AppSuite system while utilizing smartphone native capabilities (local heads-up notifications, overdue task warnings, camera capture for service tickets, and background sync).

---

## Architecture & Tech Stack

* **Framework**: Flutter 3.35.6 (Compiled natively to ARM64 machine code, zero WebViews)
* **State Management**: Flutter Riverpod 3 (Notifier & NotifierProvider)
* **Networking**: Dio (with dynamic backend URL configuration, JWT Bearer auto-injection, error interceptors)
* **Security & Storage**: `flutter_secure_storage` (AES encrypted JWT tokens) & `shared_preferences`
* **Real-Time & Alerts**: `flutter_local_notifications` (Heads-up overdue task warnings & task assignment alerts)
* **Hardware Camera**: `image_picker` (Camera capture for Service Ticket defect logs & resolution proofs)
* **Design System**: Slate/Tailwind dark theme matching AppSuite web aesthetics

---

## App Structure & Features

```
mobile/lib/
├── core/
│   ├── constants/api_constants.dart      # Endpoints & server host configuration
│   ├── network/api_client.dart           # Dio client with Bearer token injection
│   ├── services/notification_service.dart# Local notifications engine (overdue alerts)
│   ├── storage/secure_storage_service.dart# Encrypted token storage
│   └── theme/app_theme.dart              # AppSuite dark slate theme
├── features/
│   ├── auth/                             # Login, session persistence & server endpoint dialog
│   ├── notifications/                    # Notification center, unread badges & polling
│   └── projects/                         # Phase 1: Full Projects Module
│       ├── models/project_models.dart    # Projects, DynamicTasks, Tickets, Standup
│       ├── providers/projects_provider.dart# Riverpod state notifier
│       └── views/
│           ├── projects_home_view.dart   # Bottom navigation shell
│           ├── project_workspace_view.dart# Workspace (Tasks, Kanban Board, Details)
│           ├── task_comments_sheet.dart  # Threaded discussion bottom sheet
│           └── tabs/
│               ├── dashboard_tab.dart    # KPI metrics, Overdue banner, Quick actions
│               ├── projects_list_tab.dart# Search, status filters, progress bars
│               ├── my_tasks_tab.dart     # Personal queue, overdue warning, status menu
│               ├── service_tickets_tab.dart# Tickets desk, native camera resolution
│               └── standup_tab.dart      # Daily standup logging & blocker monitor
└── main.dart                             # App entrypoint & ProviderScope
```

---

## How to Run on Smartphone or Emulator

### 1. Connecting to the Backend
By default:
* **Android Emulator**: Automatically points to `http://10.0.2.2:8000` (which routes to your machine's `localhost:8000`).
* **Physical Smartphone (WiFi)**: On the login screen, tap **"Configure Server Endpoint"** and enter your computer's local LAN IP (e.g., `http://192.168.1.15:8000`).

### 2. Launching the App
In the `mobile` directory:

```bash
# Check connected devices
flutter devices

# Launch on Android emulator or connected smartphone
flutter run
```

### 3. Default Credentials
Use the same credentials as your desktop web app:
* **Username**: `admin`
* **Password**: `admin123`
*(Or any registered employee account)*

---

## Next Steps for Full Feature Parity

| Phase | Module | Status | Capabilities |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Projects & Field Service** | ✅ **Complete** | Dashboard, All Projects, Workspace (Kanban/Tasks), My Tasks (Overdue alerts), Service Tickets (Camera photos), Daily Standup, In-App & Local Notifications. |
| **Phase 2** | **Smart Store & Warehouse** | *Planned* | Continuous Barcode/QR Scanning, Stock-In, Issue Material, Return Material, Asset Auditing. |
| **Phase 3** | **BOM (Bill of Materials)** | *Planned* | BOM directory, part catalogs, item revisions. |
| **Phase 4** | **Portal & Employee Directory** | *Planned* | User presence tracking, system announcements. |
