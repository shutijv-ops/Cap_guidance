# JRMSU Counseling Appointment System - Simple Architecture Diagram

```mermaid
graph TB
    subgraph CLIENT["👥 FRONTEND"]
        S["📱 Student Portal"]
        A["🔒 Admin Portal"]
        C["🔒 Counselor Portal"]
    end

    subgraph SERVER["🖥️ BACKEND - Express.js"]
        API["API Endpoints<br/>Authentication<br/>Appointments<br/>Counselors<br/>Notifications"]
        LOGIC["Business Logic<br/>Validation<br/>Email Service"]
    end

    subgraph DB["💾 DATABASE"]
        MONGO[("MongoDB")]
    end

    subgraph EXT["🌐 EXTERNAL"]
        MAIL["SendGrid<br/>Email"]
    end

    CLIENT -->|HTTP/HTTPS| SERVER
    SERVER -->|Mongoose| DB
    SERVER -->|API Call| MAIL

    style CLIENT fill:#e3f2fd,stroke:#2196F3,stroke-width:2px
    style SERVER fill:#fff3e0,stroke:#FF9800,stroke-width:2px
    style DB fill:#f3e5f5,stroke:#9C27B0,stroke-width:2px
    style EXT fill:#e8f5e9,stroke:#4CAF50,stroke-width:2px
```

---

## Simple System Flow

```
STUDENT              ADMIN/COUNSELOR          SERVER             DATABASE
  │                        │                    │                    │
  ├─ Submit Request ──────────────────────────→ │                    │
  │                                              ├─ Validate        │
  │  ← ─ ─ Email Confirmation ← ─ ─ ─ ─ ─ ─ ─ ─┤ Store ──────────→ │
  │                                              │                    │
  │  View Status ──────────────────────────────→ │                    │
  │  ← ─ ─ Status Result ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ├ Retrieve ────────→ │
  │                                              │                    │
  │                        ├─ Approve/Reject ──→ │                    │
  │                        │                    ├─ Update ──────────→ │
  │  ← ─ ─ Decision Email ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤                    │
  │                                              │                    │
```

---

## Three User Portals

```
┌─────────────────────┬─────────────────────┬─────────────────────┐
│   Student Portal    │    Admin Portal     │  Counselor Portal   │
│   (Public Access)   │   (Protected)       │    (Protected)      │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ • View Counselors   │ • Manage Users      │ • View Requests     │
│ • Book Appointment  │ • View All Data     │ • Approve/Reject    │
│ • Track Status      │ • Generate Reports  │ • Schedule Manage   │
│ • View Calendar     │ • System Settings   │ • See Notifications │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

---

## Key Features

```
FRONTEND                BACKEND                 DATABASE
├─ HTML Pages      ├─ Express.js         ├─ MongoDB
├─ CSS Styling     ├─ 24+ API Routes     ├─ 3 Collections
├─ JavaScript      ├─ Authentication     │  ├─ Counselors
└─ User Interface  ├─ Email Integration  │  ├─ Appointments
                   ├─ Real-time Updates  │  └─ Notifications
                   └─ Data Validation    └─ JSON Fallback
```
