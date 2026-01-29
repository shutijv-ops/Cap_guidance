# JRMSU Counseling Appointment System - Architectural Diagram

## System Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER (Frontend)                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │  Student Portal  │    │   Admin Portal   │    │   Counselor      │   │
│  │  (Public Access) │    │  (Protected)     │    │   Portal         │   │
│  │                  │    │                  │    │   (Protected)    │   │
│  ├──────────────────┤    ├──────────────────┤    ├──────────────────┤   │
│  │ landing.html     │    │ admin_dash.html  │    │ appointment.html │   │
│  │ student_dash.html│    │ appointment.html │    │ calendar.html    │   │
│  │ appointment.html │    │ settings.html    │    │                  │   │
│  │ calendar.html    │    │ reports.html     │    │                  │   │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘   │
│          │                        │                        │              │
│  ┌──────────────────┐    ┌──────────────────────┐  ┌──────────────────┐ │
│  │  Student JS      │    │   Admin Dashboard    │  │  Counselor JS    │ │
│  │  Controllers     │    │   JS Controllers     │  │  Controllers     │ │
│  ├──────────────────┤    ├──────────────────────┤  ├──────────────────┤ │
│  │ landing.js       │    │ admin_dashboard.js   │  │ appointment.js   │ │
│  │ student_dash.js  │    │ appointment_detail.js│  │ calendar.js      │ │
│  │ appointment.js   │    │ tab_utils.js         │  │ view_toggle.js   │ │
│  │ calendar.js      │    │ view_toggle.js       │  │ reports.js       │ │
│  │ reports.js       │    │ reports.js           │  │                  │ │
│  │ view_toggle.js   │    │                      │  │                  │ │
│  └──────────────────┘    └──────────────────────┘  └──────────────────┘ │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP/HTTPS
                                    │
┌────────────────────────────────────────────────────────────────────────────┐
│                      APPLICATION SERVER LAYER                              │
├────────────────────────────────────────────────────────────────────────────┤
│                         Express.js Server                                   │
│                         (Node.js Runtime)                                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ AUTHENTICATION & SESSION MANAGEMENT                              │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │ POST   /api/admin/login          - Admin/Counselor Login        │    │
│  │ GET    /api/admin/check          - Verify Session Status        │    │
│  │ POST   /api/admin/logout         - Logout & Clear Session       │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ APPOINTMENT MANAGEMENT ENDPOINTS                                 │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │ POST   /api/appointments/student - Student Submit Appointment    │    │
│  │ POST   /api/appointments/request - Request New Appointment      │    │
│  │ POST   /api/appointments         - Create Appointment (Admin)   │    │
│  │ GET    /api/appointments         - List All Appointments        │    │
│  │ GET    /api/appointment/:ref     - Get Appointment Details      │    │
│  │ PUT    /api/appointments/:ref    - Update Appointment Status    │    │
│  │                                   (Approve/Reject/Reschedule)   │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ COUNSELOR MANAGEMENT ENDPOINTS                                   │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │ GET    /api/counselors           - List All Counselors          │    │
│  │ POST   /api/counselors           - Create New Counselor         │    │
│  │ PUT    /api/counselors/:id       - Update Counselor Profile    │    │
│  │ GET    /api/counselor            - Get Current Counselor Info   │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ SCHEDULE & AVAILABILITY ENDPOINTS                                │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │ GET    /api/schedules/:date      - Get Schedules for Date       │    │
│  │ GET    /api/bookedSlots          - Get All Booked Time Slots    │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ NOTIFICATION & REAL-TIME ENDPOINTS                               │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │ GET    /api/notifications/sse    - Server-Sent Events Stream    │    │
│  │ GET    /api/notifications        - Get Notifications List       │    │
│  │ DELETE /api/notifications/:id    - Delete Notification          │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ REPORTING & ANALYTICS ENDPOINTS                                  │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │ GET    /api/reports/monthly      - Monthly Statistics Report    │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ UTILITY ENDPOINTS                                                │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │ POST   /api/migrateApprovedSchedules - Migrate Schedules        │    │
│  │ GET    /health                   - Health Check                 │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ BUSINESS LOGIC LAYER                                             │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │ • Appointment Validation & Scheduling                            │    │
│  │ • Counselor Assignment Logic                                     │    │
│  │ • Availability Checking                                          │    │
│  │ • Email Service Integration (SendGrid)                           │    │
│  │ • Status Management (Pending, Approved, Rescheduled, Rejected)   │    │
│  │ • Real-time Notification Broadcasting                            │    │
│  │ • Appointment Lifecycle Management                               │    │
│  │ • Data Migration & Cleanup                                       │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Mongoose ODM
                                    │
┌────────────────────────────────────────────────────────────────────────────┐
│                          DATA ACCESS LAYER                                 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Mongoose Models & Schemas                                        │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │ • Counselor Collection                                           │    │
│  │   - Title, FirstName, MiddleName, LastName                      │    │
│  │   - Email, Username, Password (hashed)                          │    │
│  │   - Role (Counselor/Admin), Status                              │    │
│  │   - CreatedAt, UpdatedAt                                        │    │
│  │   - Availability/Schedule Info                                  │    │
│  │                                                                  │    │
│  │ • Appointment Collection (MongoDB)                              │    │
│  │   - StudentID, StudentName, Email, Course, Year                 │    │
│  │   - Date, Time, Duration                                        │    │
│  │   - CounselorID, Counselor Name                                 │    │
│  │   - Status, Reference Number                                    │    │
│  │   - Reason, Notes, Remarks                                      │    │
│  │   - CreatedAt, UpdatedAt, ApprovedAt                            │    │
│  │                                                                  │    │
│  │ • Notification Collection                                       │    │
│  │   - Message, Type, UserID                                       │    │
│  │   - CreatedAt, Read Status                                      │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ TCP/IP Connection
                                    │
┌────────────────────────────────────────────────────────────────────────────┐
│                          DATABASE LAYER                                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────┐         ┌──────────────────────────┐      │
│  │   MongoDB Database       │         │   JSON Files             │      │
│  ├──────────────────────────┤         ├──────────────────────────┤      │
│  │ Collections:             │         │ • appointments.json      │      │
│  │ • counselors             │         │  (Fallback/Legacy Data)  │      │
│  │ • appointments           │         └──────────────────────────┘      │
│  │ • notifications          │                                            │
│  │                          │                                            │
│  │ (Default MongoDB URI or  │                                            │
│  │  MongoDB Atlas Instance) │                                            │
│  └──────────────────────────┘                                            │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

## External Services

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES & CONFIG                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐         ┌──────────────────────────────┐      │
│  │   SendGrid Email     │         │   Environment Variables       │      │
│  │   API Service        │         │   (.env Configuration)        │      │
│  ├──────────────────────┤         ├──────────────────────────────┤      │
│  │ • Appointment        │         │ • SENDGRID_API_KEY           │      │
│  │   Confirmations      │         │ • FROM_EMAIL                 │      │
│  │ • Approval Emails    │         │ • MONGODB_URI                │      │
│  │ • Rejection Notices  │         │ • NODE_ENV                   │      │
│  │ • Reschedule Updates │         │ • PORT                       │      │
│  │ • Email Templates    │         │ • Other Configuration        │      │
│  │   with HTML Content  │         │                              │      │
│  └──────────────────────┘         └──────────────────────────────┘      │
│                                                                              │
│  ┌──────────────────────┐         ┌──────────────────────────────┐      │
│  │   MongoDB Atlas/     │         │   File System (Fallback)     │      │
│  │   Local MongoDB      │         │                              │      │
│  ├──────────────────────┤         ├──────────────────────────────┤      │
│  │ • Cloud or Local     │         │ • appointments.json          │      │
│  │   MongoDB Instance   │         │ • Legacy Data Storage        │      │
│  │ • Primary Database   │         │ • Development Fallback       │      │
│  │                      │         │                              │      │
│  └──────────────────────┘         └──────────────────────────────┘      │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

## User Roles & Workflows

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER ROLES & FLOWS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  STUDENT WORKFLOW                                                    │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  1. Access Landing Page                                              │  │
│  │  2. View Available Counselors & Schedules                            │  │
│  │  3. Create Appointment Request                                       │  │
│  │  4. Track Appointment Status (Pending → Approved/Rejected)           │  │
│  │  5. Receive Email Notifications                                      │  │
│  │  6. View Calendar & Manage Appointments                              │  │
│  │  7. Generate Reports of Counseling Sessions                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  GUIDANCE COUNSELOR WORKFLOW                                          │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  1. Login to Counselor Portal                                        │  │
│  │  2. View Pending Appointment Requests                                │  │
│  │  3. Approve/Reject/Reschedule Appointments                           │  │
│  │  4. Manage Calendar & Availability                                   │  │
│  │  5. Receive Appointment Details & Student Info                       │  │
│  │  6. View Dashboard with Session Statistics                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  ADMIN WORKFLOW                                                      │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  1. Access Admin Dashboard                                           │  │
│  │  2. Manage Counselor Accounts & Status                               │  │
│  │  3. Monitor All Appointments System-Wide                             │  │
│  │  4. View Activity Logs & Reports                                     │  │
│  │  5. Configure System Settings                                        │  │
│  │  6. Generate System Reports & Analytics                              │  │
│  │  7. Manage Data & System Health                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram - Appointment Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    APPOINTMENT LIFECYCLE & DATA FLOW                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   STUDENT                    SERVER                   ADMIN/COUNSELOR       │
│      │                          │                            │              │
│  1. Landing Page Access    ──→ Serve landing.html           │              │
│      │                          │                            │              │
│  2. View Counselors        ──→ GET /api/counselors ─────────┘              │
│      │                          │                                           │
│  3. Check Availability     ──→ GET /api/schedules/:date                    │
│      │                          │                                           │
│  4. Submit Appointment     ──→ POST /api/appointments/student               │
│      │                          │                                           │
│      │                          ├─ Validate Request                        │
│      │                          ├─ Store in Database                       │
│      │                          ├─ Generate Reference Number               │
│      │                          │                                           │
│      │                          ├────→ Notify Counselor (SSE) ──────────→  │
│      │                          │                                │          │
│      │ (Receive Confirmation)   │                          Review Pending │
│      │← Email Notification ─────┤                          Requests       │
│      │  (Reference #)           │                                │         │
│      │                          │                                │         │
│      │                          │←──────────────────────────────┤          │
│      │                          │  5. Admin/Counselor Decision   │          │
│      │                          │     - Approve                  │          │
│      │                          │     - Reject                   │          │
│      │                          │     - Reschedule              │          │
│      │                          │                                │          │
│      │   PUT /api/appointments/:ref    ← Update Status ────────┘          │
│      │                          │                                           │
│      │                          ├─ Update Database                         │
│      │                          ├─ Broadcast SSE Notification              │
│      │                          ├─ Send Email via SendGrid                 │
│      │                          │                                           │
│      │← Email Update ───────────┤   (Approved/Rejected/Rescheduled)        │
│      │                          │                                           │
│  6. View Appointment Status    │                                            │
│      ├─ Dashboard            ──→ GET /api/appointments                    │
│      │                          │   (Filter by Student)                    │
│      │                          │                                           │
│      └─ Calendar View        ──→ GET /api/appointment/:ref                │
│                                   (Detailed View)                           │
│                                   │                                           │
│                        7. Appointment Scheduled                              │
│      ┌───────────────────────────────────────────────────────┐             │
│      │                                                           │             │
│      └─→ Attend Counseling Session ─→ Counselor Records ─→ Database        │
│                                        Notes & Status Update                 │
│                                                                               │
│        8. Generate Reports (Post-Session)                                   │
│      ┌────────────────────────────────┐                                    │
│      │                                 │                                    │
│      └→ GET /api/reports/monthly  ──→ Generate Statistics & Analytics      │
│                                        │                                    │
│                                        └→ Monthly Report Data               │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

REAL-TIME NOTIFICATIONS FLOW:
┌─────────────────────────────────────────────────────────────────────────────┐
│  • SSE (Server-Sent Events) via GET /api/notifications/sse                  │
│  • Appointment Status Updates (Real-time Push)                              │
│  • Admin Alerts (New Requests, System Events)                               │
│  • Notification Storage in Database                                         │
│  • Delete Notifications via DELETE /api/notifications/:id                   │
│  • Retrieve Notifications via GET /api/notifications                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TECHNOLOGY STACK                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  FRONTEND:                                                                   │
│  ├─ HTML5 (Semantic markup)                                                 │
│  ├─ CSS3 (Responsive styling)                                               │
│  └─ JavaScript (Vanilla JS for UI logic)                                    │
│                                                                               │
│  BACKEND:                                                                    │
│  ├─ Node.js (Runtime environment)                                           │
│  ├─ Express.js 5.1.0 (Web framework & API)                                  │
│  ├─ Mongoose 8.19.2 (MongoDB ODM)                                           │
│  ├─ dotenv 17.2.3 (Environment configuration)                              │
│  └─ @sendgrid/mail 8.1.6 (Email service)                                   │
│                                                                               │
│  DATABASE:                                                                   │
│  ├─ MongoDB (Document database)                                             │
│  └─ JSON Files (Local data storage)                                         │
│                                                                               │
│  EXTERNAL SERVICES:                                                          │
│  └─ SendGrid (Email delivery)                                               │
│                                                                               │
│  DEVELOPMENT:                                                                │
│  └─ nodemon 3.1.10 (Auto-restart development server)                        │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Features by Module

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SYSTEM FEATURES & MODULES                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  APPOINTMENT MANAGEMENT                                                      │
│  ├─ Create appointment requests                                             │
│  ├─ View appointment history                                                │
│  ├─ Reschedule appointments                                                 │
│  ├─ Cancel appointments                                                     │
│  └─ Track appointment status (Pending, Approved, Rejected, Rescheduled)     │
│                                                                               │
│  COUNSELOR MANAGEMENT                                                        │
│  ├─ Register counselors (Admin)                                             │
│  ├─ Manage counselor profiles                                               │
│  ├─ Set counselor availability                                              │
│  ├─ Assign counselors to appointments                                       │
│  └─ Track counselor status (Active, On Leave, Inactive)                     │
│                                                                               │
│  NOTIFICATION SYSTEM                                                         │
│  ├─ Email confirmations (SendGrid)                                          │
│  ├─ Approval notifications                                                  │
│  ├─ Reschedule alerts                                                       │
│  └─ System notifications                                                    │
│                                                                               │
│  REPORTING & ANALYTICS                                                       │
│  ├─ View appointment reports                                                │
│  ├─ Activity logs & audit trail                                             │
│  ├─ System usage statistics                                                 │
│  ├─ Dashboard with key metrics                                              │
│  └─ Generate PDF reports                                                    │
│                                                                               │
│  CALENDAR & SCHEDULING                                                       │
│  ├─ View counselor availability                                             │
│  ├─ Interactive calendar interface                                          │
│  ├─ Time slot management                                                    │
│  └─ Conflict detection & prevention                                         │
│                                                                               │
│  USER MANAGEMENT                                                             │
│  ├─ Student authentication                                                  │
│  ├─ Admin login                                                             │
│  ├─ Counselor login                                                         │
│  ├─ Session management                                                      │
│  └─ Role-based access control                                               │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Security & Environment Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   SECURITY & CONFIGURATION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Environment Variables (.env):                                              │
│  ├─ SENDGRID_API_KEY (Email service authentication)                         │
│  ├─ FROM_EMAIL (Sender email address)                                       │
│  ├─ MONGODB_URI (Database connection string)                                │
│  ├─ PORT (Server port configuration)                                        │
│  ├─ NODE_ENV (Development/Production)                                       │
│  └─ Other sensitive configuration                                           │
│                                                                               │
│  Cross-Origin Resource Sharing (CORS):                                       │
│  ├─ Allows requests from frontend                                           │
│  ├─ Methods: GET, POST, PUT, DELETE, OPTIONS                                │
│  └─ Content-Type header support                                             │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```
