# Quick Start Guide - Student Authentication

## 🚀 Quick Setup (3 Steps)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Seed Sample Students
```bash
node seed-students.js
```
This creates 8 students. You'll see:
```
JRMSU2023001: Juan Dela Cruz | Password: Dela Cruz
JRMSU2023002: Maria Santos | Password: Santos
JRMSU2023003: Jose Reyes | Password: Reyes
... (5 more)
```

### Step 3: Start Server
```bash
npm start
```
Open: `http://localhost:3000`

---

## 🔑 Test Login

1. Click **Profile** → **Student**
2. Enter:
   - **School ID**: `JRMSU2023001`
   - **Password**: `Dela Cruz`
3. Click **Login**
4. **Change Password Modal** appears on first login
5. Enter new password (min 6 chars)
6. **Dashboard** loads

---

## 📋 Sample Students

| School ID | Name | Email | Default Password |
|-----------|------|-------|------------------|
| JRMSU2023001 | Juan Dela Cruz | juan.delacruz@jrmsu.edu.ph | Dela Cruz |
| JRMSU2023002 | Maria Santos | maria.santos@jrmsu.edu.ph | Santos |
| JRMSU2023003 | Jose Reyes | jose.reyes@jrmsu.edu.ph | Reyes |
| JRMSU2023004 | Anna Garcia | anna.garcia@jrmsu.edu.ph | Garcia |
| JRMSU2023005 | Miguel Lopez | miguel.lopez@jrmsu.edu.ph | Lopez |
| JRMSU2023006 | Sofia Torres | sofia.torres@jrmsu.edu.ph | Torres |
| JRMSU2023007 | Carlos Morales | carlos.morales@jrmsu.edu.ph | Morales |
| JRMSU2023008 | Isabel Cruz | isabel.cruz@jrmsu.edu.ph | Cruz |

---

## 🔐 API Endpoints

### Login
```
POST /api/student/login
Body: { "schoolId": "JRMSU2023001", "password": "Dela Cruz" }
```

### Change Password
```
POST /api/student/change-password
Body: { "studentId": "...", "oldPassword": "Dela Cruz", "newPassword": "New123" }
```

### Get Student
```
GET /api/student/{studentId}
```

---

## 🎯 Key Features

✅ Login with School ID + Password
✅ Default password = Last Name
✅ Password change on first login (mandatory)
✅ Secure hashing with bcryptjs
✅ Session-based authentication
✅ Minimum 6-character password

---

## 📝 Files Changed

**Created (2):**
- `models/students.js` - Student schema
- `seed-students.js` - Create sample data

**Modified (5):**
- `server.js` - Auth APIs
- `package.json` - bcryptjs dependency
- `public/HTML/landing.html` - Login form
- `public/JS/landing.js` - Login logic
- `public/CSS/landing.css` - Modal styles

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot find bcryptjs" | Run `npm install` |
| MongoDB connection error | Ensure MongoDB is running |
| Students already exist | Delete students collection, re-seed |
| Password modal won't close | Ensure passwords match and are 6+ chars |

---

## 📚 Documentation

- **Full Details**: `STUDENT_AUTH_IMPLEMENTATION.md`
- **Testing Guide**: `TESTING_GUIDE.md`
- **This File**: `QUICKSTART.md`

---

## 🔄 User Flow

```
Landing Page
    ↓
Profile → Student
    ↓
School ID + Password
    ↓
First Login? → Change Password Modal
            ↓
         Dashboard
```

---

**Ready to test? Start with:** `npm install && node seed-students.js && npm start`
