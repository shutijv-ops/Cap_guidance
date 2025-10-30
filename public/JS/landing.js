// NAV MENU TOGGLE
const navToggle = document.getElementById("navToggle");
const navMenu = document.querySelector("nav ul");

navToggle.addEventListener("click", () => {
  navMenu.style.display = navMenu.style.display === "flex" ? "none" : "flex";
});

// LOGIN MODAL
const profileBtn = document.getElementById("profileBtn");
const loginModal = document.getElementById("loginModal");
const chooseStudentBtn = document.getElementById("chooseStudentBtn");
const chooseAdminBtn = document.getElementById("chooseAdminBtn");
const studentForm = document.getElementById("studentForm");
const adminForm = document.getElementById("adminForm");
const profileChooser = document.getElementById("profileChooser");

profileBtn.addEventListener("click", (e) => {
  e.preventDefault();
  loginModal.style.display = "flex";
});

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

// Admin login submit
const adminLoginBtn = document.getElementById('adminLoginBtn');
if(adminLoginBtn){
  adminLoginBtn.addEventListener('click', async () => {
    const user = document.getElementById('adminUser').value || '';
    const pass = document.getElementById('adminPass').value || '';
    try{
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) });
      if(!res.ok){
        const e = await res.json().catch(()=>({}));
        alert(e.error || 'Login failed');
        return;
      }
      // success — redirect to admin dashboard
      window.location.href = '/HTML/admin_dashboard.html';
    }catch(err){
      console.error('Admin login error', err);
      alert('Login failed');
    }
  });
}

// Close modal when clicking outside
window.addEventListener("click", (e) => {
  if (e.target === loginModal) {
    loginModal.style.display = "none";
    studentForm.style.display = "none";
    adminForm.style.display = "none";
    profileChooser.style.display = "block";
  }
});
