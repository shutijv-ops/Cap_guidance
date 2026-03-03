// Check login and redirect to dashboard or show login modal
function checkLoginAndRedirect() {
  const studentData = sessionStorage.getItem('studentData');
  
  if (studentData) {
    // Already logged in - redirect to dashboard
    sessionStorage.setItem('appointmentAccessFromDashboard', 'true');
    window.location.href = '/HTML/student_dashboard.html';
  } else {
    // Not logged in - show login modal
    document.getElementById('loginModal').style.display = 'flex';
  }
}

// Toggle password visibility for all password fields
function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
  } else {
    input.type = 'password';
  }
}

// NAV MENU TOGGLE
const navToggle = document.getElementById("navToggle");
const navMenu = document.querySelector("nav ul");

navToggle.addEventListener("click", () => {
  navMenu.classList.toggle("active");
});

// Close menu when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".nav-container")) {
    navMenu.classList.remove("active");
  }
});

// LOGIN MODAL
const profileBtn = document.getElementById("profileBtn");
const loginModal = document.getElementById("loginModal");
const chooseStudentBtn = document.getElementById("chooseStudentBtn");
const chooseAdminBtn = document.getElementById("chooseAdminBtn");
const studentForm = document.getElementById("studentForm");
const adminForm = document.getElementById("adminForm");
const profileChooser = document.getElementById("profileChooser");

// Admin preview elements (show counselor name/role dynamically)
const adminPreviewName = document.getElementById('adminPreviewName');
const adminPreviewRole = document.getElementById('adminPreviewRole');
const adminUserInput = document.getElementById('adminUser');

async function updateAdminPreview() {
  try {
    const uname = (adminUserInput?.value || '').trim();
    if (!uname) {
      if (adminPreviewName) adminPreviewName.textContent = 'Counselor';
      if (adminPreviewRole) adminPreviewRole.textContent = 'Guidance Counselor';
      return;
    }
    const res = await fetch('/api/counselors');
    if (!res.ok) return;
    const list = await res.json();
    const match = list.find(c => (c.username || '').toLowerCase() === uname.toLowerCase() || (c.email || '').toLowerCase() === uname.toLowerCase());
    if (match) {
      if (adminPreviewName) adminPreviewName.textContent = `${match.title || ''} ${match.firstName || ''}${match.middleName ? ' ' + match.middleName : ''} ${match.lastName || ''}`.trim();
      if (adminPreviewRole) adminPreviewRole.textContent = match.role || 'Guidance Counselor';
    } else {
      if (adminPreviewName) adminPreviewName.textContent = 'Counselor';
      if (adminPreviewRole) adminPreviewRole.textContent = 'Guidance Counselor';
    }
  } catch (e) {
    // ignore errors — keep default preview
  }
}

if (adminUserInput) {
  adminUserInput.addEventListener('input', () => { updateAdminPreview(); });
}

profileBtn.addEventListener("click", (e) => {
  e.preventDefault();
  loginModal.style.display = "flex";
});

// Check if redirected from appointment page (show login modal automatically)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('showLogin') === 'true') {
  loginModal.style.display = "flex";
  profileChooser.style.display = "block";
  studentForm.style.display = "none";
  adminForm.style.display = "none";
}

// Choose Student
chooseStudentBtn.addEventListener("click", () => {
  profileChooser.style.display = "none";
  studentForm.style.display = "block";
});

// Choose Admin
chooseAdminBtn.addEventListener("click", () => {
  profileChooser.style.display = "none";
  adminForm.style.display = "block";
});

// Admin / Counselor login submit (unified)
const adminLoginBtn = document.getElementById('adminLoginBtn');
if(adminLoginBtn){
  adminLoginBtn.addEventListener('click', async () => {
    const user = document.getElementById('adminUser').value || '';
    const pass = document.getElementById('adminPass').value || '';
    try{
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }), credentials: 'include' });
      if(!res.ok){
        const e = await res.json().catch(()=>({}));
        showActionModal(e.error || 'Login failed', { type: 'error' });
        return;
      }
      const data = await res.json();
      // Persist authenticated user info for dashboard pages
      try { sessionStorage.setItem('authUser', JSON.stringify(data.user || {})); } catch (e) {}
      // Prefer explicit flags from server; fall back to role text
      if (data?.isAdmin) {
        window.location.href = '/HTML/admin_dashboard.html';
      } else if (data?.isCounselor) {
        window.location.href = '/HTML/counselor_dashboard.html';
      } else {
        const role = (data?.user?.role || '').toString().toLowerCase();
        if(role.includes('admin')) window.location.href = '/HTML/admin_dashboard.html';
        else window.location.href = '/HTML/counselor_dashboard.html';
      }
    }catch(err){
      console.error('Login error', err);
      showActionModal('Login failed', { type: 'error' });
    }
  });
}

// Student login submit
const studentLoginBtn = document.getElementById('studentLoginBtn');
if(studentLoginBtn) {
  studentLoginBtn.addEventListener('click', async () => {
    const schoolId = document.getElementById('schoolId').value?.trim();
    const password = document.getElementById('studentPassword').value?.trim();

    if (!schoolId || !password) {
      showActionModal('Please enter both School ID and Password', { type: 'error' });
      return;
    }

    try {
      // Call new student login API
      const res = await fetch('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, password })
      });

      if (!res.ok) {
        const error = await res.json();
        showActionModal(error.error || 'Login failed', { type: 'error' });
        return;
      }

      const data = await res.json();
      const student = data.student;

      // Store student data in session
      sessionStorage.setItem('studentData', JSON.stringify({
        id: student.id,
        studentId: student.schoolId,
        schoolId: student.schoolId,
        fname: student.firstName,
        mname: student.middleName || '',
        lname: student.lastName,
        suffix: student.suffix || '',
        course: student.course || '',
        year: student.year || '',
        contact: student.contact || '',
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        fullName: student.fullName,
        passwordChanged: student.passwordChanged
      }));

      // If password hasn't been changed, show password change modal
      if (!student.passwordChanged) {
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('passwordChangeModal').style.display = 'flex';
        document.getElementById('currentPassword').focus();
      } else {
        // Redirect to student dashboard
        window.location.href = '/HTML/student_dashboard.html';
      }
    } catch(err) {
      console.error('Student login error:', err);
      showActionModal('Login failed. Please try again.', { type: 'error' });
    }
  });
}

// Password Change Modal
const changePasswordBtn = document.getElementById('changePasswordBtn');
const passwordChangeModal = document.getElementById('passwordChangeModal');
if (changePasswordBtn) {
  changePasswordBtn.addEventListener('click', async () => {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const messageDiv = document.getElementById('passwordChangeMessage');

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      messageDiv.innerHTML = '<span style="color: red;">All fields are required</span>';
      return;
    }

    if (newPassword.length < 6) {
      messageDiv.innerHTML = '<span style="color: red;">Password must be at least 6 characters</span>';
      return;
    }

    if (newPassword !== confirmPassword) {
      messageDiv.innerHTML = '<span style="color: red;">Passwords do not match</span>';
      return;
    }

    try {
      const studentData = JSON.parse(sessionStorage.getItem('studentData'));
      const res = await fetch('/api/student/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: studentData.id,
          oldPassword: currentPassword,
          newPassword: newPassword
        })
      });

      if (!res.ok) {
        const error = await res.json();
        messageDiv.innerHTML = `<span style="color: red;">${error.error || 'Failed to change password'}</span>`;
        return;
      }

      // Update password changed flag in session
      studentData.passwordChanged = true;
      sessionStorage.setItem('studentData', JSON.stringify(studentData));

      messageDiv.innerHTML = '<span style="color: green;">Password changed successfully! Redirecting...</span>';
      
      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = '/HTML/student_dashboard.html';
      }, 2000);

    } catch(err) {
      console.error('Password change error:', err);
      messageDiv.innerHTML = '<span style="color: red;">An error occurred. Please try again.</span>';
    }
  });
}

// Skip password change button
const skipPasswordBtn = document.getElementById('skipPasswordBtn');
if (skipPasswordBtn) {
  skipPasswordBtn.addEventListener('click', () => {
    // Update password changed flag in session to skip for now
    const studentData = JSON.parse(sessionStorage.getItem('studentData'));
    studentData.passwordChanged = true; // Mark as changed to allow proceeding
    sessionStorage.setItem('studentData', JSON.stringify(studentData));
    
    // Close modal and redirect to dashboard
    document.getElementById('passwordChangeModal').style.display = 'none';
    window.location.href = '/HTML/student_dashboard.html';
  });
}

// Close password change modal when clicking outside
window.addEventListener("click", (e) => {
  if (e.target === passwordChangeModal) {
    // Don't allow closing without changing password on first login
    const studentData = JSON.parse(sessionStorage.getItem('studentData'));
    if (!studentData?.passwordChanged) {
      alert('You can change your password later or click Skip for Now');
      return;
    }
    passwordChangeModal.style.display = "none";
  }
});

// Close modal when clicking outside
window.addEventListener("click", (e) => {
  if (e.target === loginModal) {
    loginModal.style.display = "none";
    studentForm.style.display = "none";
    adminForm.style.display = "none";
    profileChooser.style.display = "block";
  }
});

// Alternate mental wellness illustration images every 3 seconds
(function(){
  const img = document.querySelector('.mental-wellness-illustration');
  if(!img) return;

  const images = ['/images/mental%20wellness.png', '/images/mental%20wellness2.png'];
  // Determine starting index from current src (fall back to 0)
  const current = img.getAttribute('src') || '';
  let idx = images.findIndex(p => p === current);
  if (idx === -1) idx = 0;
  const fadeClass = 'mw-fade';

  // Ensure the image starts fully visible
  img.classList.remove(fadeClass);

  setInterval(() => {
    // add fade class to fade out
    img.classList.add(fadeClass);
    // after fade duration, swap src and remove fade to fade in
    setTimeout(() => {
      idx = (idx + 1) % images.length;
      img.src = images[idx];
      // remove fade class on next animation frame to trigger fade-in transition
      requestAnimationFrame(() => img.classList.remove(fadeClass));
    }, 500);
  }, 3000);
})();
