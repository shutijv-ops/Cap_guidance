# Student Authentication System Implementation

## Overview
A new student authentication system has been implemented with the following features:
- Students login with **School ID** and **Password**
- Default password is the student's **Last Name**
- On first login, students are **required to change their password**
- Password change flag tracks if a student has changed their initial password

## Changes Made

### 1. **New Database Model** (`models/students.js`)
- Created a new Student schema with:
  - `schoolId` (unique, required)
  - `firstName`, `lastName`
  - `email` (unique, lowercase)
  - `password` (bcrypt hashed)
  - `passwordChanged` (boolean, default: false)
  - `status` (Active/Inactive)
  - Password hashing using bcryptjs before save
  - `comparePassword()` method for authentication
  - `setPasswordChanged()` method for marking password update

### 2. **Sample Student Data** (`seed-students.js`)
- Created 8 sample students with the following structure:
  - School ID: JRMSU2023001-JRMSU2023008
  - Names: Juan Dela Cruz, Maria Santos, Jose Reyes, Anna Garcia, Miguel Lopez, Sofia Torres, Carlos Morales, Isabel Cruz
  - Emails: firstname.lastname@jrmsu.edu.ph
  - Default Password: Last Name (e.g., "Dela Cruz", "Santos")

**To seed the database:**
```bash
node seed-students.js
```

### 3. **Student Authentication APIs** (Updated `server.js`)

#### **POST /api/student/login**
- Authenticates student with `schoolId` and `password`
- Returns student data with `passwordChanged` flag
- Response includes:
  - Student ID, School ID, Name, Email
  - `passwordChanged` boolean flag

```javascript
{
  "ok": true,
  "student": {
    "id": "...",
    "schoolId": "JRMSU2023001",
    "firstName": "Juan",
    "lastName": "Dela Cruz",
    "email": "juan.delacruz@jrmsu.edu.ph",
    "fullName": "Juan Dela Cruz",
    "passwordChanged": false
  }
}
```

#### **POST /api/student/change-password**
- Requires: `studentId`, `oldPassword`, `newPassword`
- Validates old password before allowing change
- Sets `passwordChanged` flag to true
- Minimum 6 character password requirement

#### **GET /api/student/:id**
- Fetches student details (excludes password)

### 4. **Updated Frontend** 

#### **Landing Page (`public/HTML/landing.html`)**
- Updated student login form:
  - **School ID** input field
  - **Password** input field (replaces email)
  - Added password hint: "Default password is your last name"
  - Removed old email-based authentication

#### **Password Change Modal** (`landing.html`)
- New modal displayed after first login
- Fields:
  - Current Password
  - New Password (min 6 characters)
  - Confirm Password
- Cannot close without completing password change on first login

#### **Login Logic** (`public/JS/landing.js`)
- Updated student login handler:
  1. Calls `/api/student/login` with schoolId and password
  2. Checks `passwordChanged` flag
  3. If `false`: Shows password change modal
  4. If `true`: Redirects to student dashboard
  
- Password change handler:
  1. Validates all fields
  2. Calls `/api/student/change-password`
  3. Updates session data
  4. Redirects to dashboard after 2 seconds

#### **Styling** (`public/CSS/landing.css`)
- Added password change modal styles
- Smooth animation for modal appearance
- Focus states for input fields
- Message display area for validation feedback

### 5. **Dependencies** (`package.json`)
- Added `bcryptjs` ^2.4.3 for password hashing

## User Flow

### First-Time Login
1. Student enters **School ID** and **Last Name** (default password)
2. System validates credentials
3. Password change modal appears
4. Student enters current password and new password
5. System validates and updates password
6. Redirects to student dashboard

### Subsequent Logins
1. Student enters **School ID** and **Updated Password**
2. System validates credentials
3. Redirects directly to student dashboard

## Sample Test Credentials

| School ID | First Name | Last Name | Email | Default Password |
|-----------|-----------|-----------|-------|------------------|
| JRMSU2023001 | Juan | Dela Cruz | juan.delacruz@jrmsu.edu.ph | Dela Cruz |
| JRMSU2023002 | Maria | Santos | maria.santos@jrmsu.edu.ph | Santos |
| JRMSU2023003 | Jose | Reyes | jose.reyes@jrmsu.edu.ph | Reyes |
| JRMSU2023004 | Anna | Garcia | anna.garcia@jrmsu.edu.ph | Garcia |
| JRMSU2023005 | Miguel | Lopez | miguel.lopez@jrmsu.edu.ph | Lopez |
| JRMSU2023006 | Sofia | Torres | sofia.torres@jrmsu.edu.ph | Torres |
| JRMSU2023007 | Carlos | Morales | carlos.morales@jrmsu.edu.ph | Morales |
| JRMSU2023008 | Isabel | Cruz | isabel.cruz@jrmsu.edu.ph | Cruz |

## Security Features
- ✅ Passwords hashed using bcryptjs (10-round salt)
- ✅ Password stored securely in database
- ✅ First-login password change enforcement
- ✅ Minimum 6-character password requirement
- ✅ Session-based authentication with cookies (HttpOnly)
- ✅ No password returned in API responses

## Next Steps (Optional Enhancements)
1. Add "Forgot Password" functionality
2. Implement email verification for new accounts
3. Add password strength requirements
4. Add login attempt rate limiting
5. Add logout functionality
6. Add student profile page to update account details
7. Add password expiration policy

## Files Modified/Created
- ✅ Created: `models/students.js`
- ✅ Created: `seed-students.js`
- ✅ Modified: `server.js` (added Student import and 3 new endpoints)
- ✅ Modified: `package.json` (added bcryptjs dependency)
- ✅ Modified: `public/HTML/landing.html` (updated login form and added password change modal)
- ✅ Modified: `public/JS/landing.js` (updated login logic)
- ✅ Modified: `public/CSS/landing.css` (added password change modal styles)
