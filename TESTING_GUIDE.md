# Student Authentication System - Testing Guide

## Prerequisites
1. MongoDB must be running
2. Environment variable `MONGODB_URI` should be set (or default: `mongodb://localhost:27017/capstone`)

## Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Sample Student Data
```bash
node seed-students.js
```

This will create 8 sample students in your database. Output:
```
Connected to MongoDB
Successfully created 8 sample students:
  - JRMSU2023001: Juan Dela Cruz (juan.delacruz@jrmsu.edu.ph)
    Default Password: Dela Cruz
  - JRMSU2023002: Maria Santos (maria.santos@jrmsu.edu.ph)
    Default Password: Santos
  ... (6 more students)
```

### 3. Start the Server
```bash
npm start
```

The server will start at `http://localhost:3000`

## Testing the Login Flow

### Test 1: First-Time Login (Password Change Required)
1. Navigate to `http://localhost:3000`
2. Click **"Profile"** → Select **"Student"**
3. Enter:
   - **School ID**: `JRMSU2023001`
   - **Password**: `Dela Cruz` (the student's last name)
4. Click **"Login"**
5. **Password Change Modal** should appear
6. Enter:
   - **Current Password**: `Dela Cruz`
   - **New Password**: `MyNewPassword123`
   - **Confirm Password**: `MyNewPassword123`
7. Click **"Change Password"**
8. System redirects to **Student Dashboard**

### Test 2: Subsequent Login (New Password)
1. Logout or open in new incognito window
2. Click **"Profile"** → Select **"Student"**
3. Enter:
   - **School ID**: `JRMSU2023001`
   - **Password**: `MyNewPassword123`
4. Click **"Login"**
5. **Student Dashboard** loads immediately (no password change)

### Test 3: Wrong Credentials
1. Click **"Profile"** → Select **"Student"**
2. Enter:
   - **School ID**: `JRMSU2023001`
   - **Password**: `WrongPassword`
3. Click **"Login"**
4. Alert: **"Invalid school ID or password"**

### Test 4: Non-Existent School ID
1. Click **"Profile"** → Select **"Student"**
2. Enter:
   - **School ID**: `INVALID123`
   - **Password**: `SomePassword`
3. Click **"Login"**
4. Alert: **"Invalid school ID or password"**

## API Testing (Using Postman or curl)

### Login Endpoint
**POST** `http://localhost:3000/api/student/login`

Request:
```json
{
  "schoolId": "JRMSU2023001",
  "password": "Dela Cruz"
}
```

Response (Success):
```json
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

### Change Password Endpoint
**POST** `http://localhost:3000/api/student/change-password`

Request:
```json
{
  "studentId": "STUDENT_ID_FROM_LOGIN",
  "oldPassword": "Dela Cruz",
  "newPassword": "MyNewPassword123"
}
```

Response (Success):
```json
{
  "ok": true,
  "message": "Password changed successfully"
}
```

Response (Wrong Old Password):
```json
{
  "error": "Current password is incorrect"
}
```

### Get Student Details
**GET** `http://localhost:3000/api/student/STUDENT_ID_FROM_LOGIN`

Response:
```json
{
  "_id": "...",
  "schoolId": "JRMSU2023001",
  "firstName": "Juan",
  "lastName": "Dela Cruz",
  "email": "juan.delacruz@jrmsu.edu.ph",
  "passwordChanged": true,
  "status": "Active",
  "createdAt": "2026-01-28T...",
  "updatedAt": "2026-01-28T..."
}
```

## Sample Student Credentials

Use these for testing:

| School ID | First Name | Last Name | Default Password |
|-----------|-----------|-----------|------------------|
| JRMSU2023001 | Juan | Dela Cruz | Dela Cruz |
| JRMSU2023002 | Maria | Santos | Santos |
| JRMSU2023003 | Jose | Reyes | Reyes |
| JRMSU2023004 | Anna | Garcia | Garcia |
| JRMSU2023005 | Miguel | Lopez | Lopez |
| JRMSU2023006 | Sofia | Torres | Torres |
| JRMSU2023007 | Carlos | Morales | Morales |
| JRMSU2023008 | Isabel | Cruz | Cruz |

## Troubleshooting

### Issue: "Cannot find module 'bcryptjs'"
**Solution**: Run `npm install`

### Issue: MongoDB Connection Error
**Solution**: 
- Ensure MongoDB is running: `mongod`
- Check `MONGODB_URI` environment variable
- Default: `mongodb://localhost:27017/capstone`

### Issue: Student Already Exists
**Solution**: If seeding fails due to duplicates:
1. Delete the students collection from MongoDB
2. Run `node seed-students.js` again

### Issue: Password Change Modal Closes Without Saving
**Solution**: Ensure:
- All three password fields are filled
- New password is at least 6 characters
- New password and confirm password match

## Database Verification

To check if students were created successfully:

```bash
# Using MongoDB shell
mongosh

# In the MongoDB shell:
use capstone
db.students.find().pretty()

# Check specific student:
db.students.findOne({ schoolId: "JRMSU2023001" })
```

## Security Notes

✅ **Implemented:**
- Password hashing with bcryptjs (10-round salt)
- Password validation on change
- First-login password change enforcement
- Session-based authentication with HttpOnly cookies
- No passwords returned in API responses

⚠️ **For Production:**
- Implement JWT tokens instead of session cookies
- Add rate limiting for login attempts
- Add email verification for new accounts
- Implement forgot password feature
- Add password reset tokens with expiration
- Use HTTPS only
- Add CSRF protection
- Implement password strength requirements

## Expected Behavior Summary

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| First Login | School ID + Default Password | Password Change Modal |
| Password Change | Old + New + Confirm | Success → Dashboard |
| Subsequent Login | School ID + New Password | Dashboard (direct) |
| Wrong Password | School ID + Wrong Password | Error Alert |
| Invalid ID | Non-existent ID | Error Alert |
