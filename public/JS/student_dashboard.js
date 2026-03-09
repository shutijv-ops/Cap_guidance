document.addEventListener('DOMContentLoaded', () => {
  const timeSlotGrid = document.getElementById('timeSlotGrid');
  const apptTimeInput = document.getElementById('apptTime');
  const apptUrgencyInputs = document.querySelectorAll('input[name="apptUrgency"]');
  const dateTimeFields = document.getElementById('dateTimeFields');
  const apptDate = document.getElementById('apptDate');

  function getSelectedUrgency() {
    const sel = document.querySelector('input[name="apptUrgency"]:checked');
    return sel ? sel.value : null;
  }

  // Function to fetch and update available time slots
  async function updateTimeSlots(date) {
    try {
      const response = await fetch(`/api/schedules/${date}`);
      if (!response.ok) throw new Error('Failed to fetch time slots');
      const slots = await response.json();
      
      // Update time slot buttons
      if (timeSlotGrid) {
        timeSlotGrid.innerHTML = '';
        slots.forEach(slot => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'time-slot-btn';
          button.setAttribute('data-time', slot.time);
          button.textContent = slot.time;
          button.style.cssText = `
            background:#fff;
            border:1.5px solid #d4af37;
            border-radius:10px;
            padding:0.7rem 0;
            font-size:1.07rem;
            color:var(--nav,#0a2342);
            font-weight:500;
            cursor:pointer;
            box-shadow:0 2px 8px rgba(212,175,55,0.07);
            transition:background 0.2s, border 0.2s;
          `;

          if (slot.status === 'booked') {
            button.disabled = true;
            button.style.background = '#E5E7EB';  // Light gray background
            button.style.borderColor = '#9CA3AF'; // Darker gray border
            button.style.color = '#6B7280';       // Medium gray text
            button.style.cursor = 'not-allowed';
            button.style.opacity = '0.7';         // Slightly faded appearance
            button.title = 'This time slot is unavailable';
            // Add a visual indicator for unavailable slots (use slot.time)
            button.innerHTML = `${slot.time} <span style="font-size: 0.8em; margin-left: 4px;">(Unavailable)</span>`;
          }

          timeSlotGrid.appendChild(button);
        });
      }
    } catch (error) {
      console.error('Error fetching time slots:', error);
    }
  }
  // Elements
  const avatarText = document.querySelector('.avatar-text');
  const nameDisplay = document.querySelector('.name');
  const studentIdDisplay = document.querySelector('.student-id');
  const appointmentsList = document.querySelector('.appointments-list');
  const logoutBtn = document.getElementById('logoutBtn');
  // --- Logout confirmation modal (copied from admin_dashboard.js) ---
  function showConfirmDialog(title, message, opts = {}) {
    const confirmText = opts.confirmText || 'Yes, Logout';
    const cancelText = opts.cancelText || 'Stay Signed In';
    const submessage = opts.submessage || 'You will be redirected to the login page';
    const icon = typeof opts.icon !== 'undefined' ? opts.icon : '🔒';
    const align = opts.alignButtons || 'end'; // 'end' | 'center' | 'start'
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal logout-confirm';
      const footerClass = align === 'center' ? 'modal-footer center' : (align === 'start' ? 'modal-footer start' : 'modal-footer');
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 420px">
          <div class="modal-body">
            ${icon ? `<span class="modal-icon">${icon}</span>` : ''}
            <h3 class="modal-message">${message}</h3>
            <p class="modal-submessage">${submessage}</p>
          </div>
          <div class="${footerClass}">
            <button class="button button-secondary" id="cancelBtn">${cancelText}</button>
            <button class="button button-primary" id="confirmBtn">${confirmText}</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const cancelBtn = modal.querySelector('#cancelBtn');
      const confirmBtn = modal.querySelector('#confirmBtn');
      cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(false);
      });
      confirmBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(true);
      });
    });
  }
  const footerYear = document.getElementById('footerYear');
  const sortAscBtn = document.getElementById('sortAscBtn');
  const apptModal = document.getElementById('apptModal');
  const closeModal = document.getElementById('closeModal');
  
  // Multi-step modal navigation
  let currentModalStep = 1;
  
  // Modal steps and buttons
  const modalSteps = [1, 2, 3, 4];
  const modalStep1 = document.getElementById('modalStep1');
  const modalStep2 = document.getElementById('modalStep2');
  const modalStep3 = document.getElementById('modalStep3');
  const modalStep4 = document.getElementById('modalStep4');
  
  // Step 1 buttons
  const modalToStep2 = document.getElementById('modalToStep2');
  const modalReason = document.getElementById('modalReason');
  const modalCharCount = document.getElementById('modalCharCount');
  
  // Step 2 buttons
  const modalBackTo1 = document.getElementById('modalBackTo1');
  const modalToStep3 = document.getElementById('modalToStep3');
  const modalStudentId = document.getElementById('modalStudentId');
  const modalFname = document.getElementById('modalFname');
  const modalMname = document.getElementById('modalMname');
  const modalLname = document.getElementById('modalLname');
  const modalSuffix = document.getElementById('modalSuffix');
  const modalCourse = document.getElementById('modalCourse');
  const modalYear = document.getElementById('modalYear');
  const modalContact = document.getElementById('modalContact');
  const modalEmail = document.getElementById('modalEmail');
  
  // Step 3 buttons
  const modalBackTo2 = document.getElementById('modalBackTo2');
  const modalToStep4 = document.getElementById('modalToStep4');
  const modalApptDate = document.getElementById('modalApptDate');
  const modalApptTime = document.getElementById('modalApptTime');
  const modalTimeSlotGrid = document.getElementById('modalTimeSlotGrid');
  
  // Step 4 buttons
  const modalBackTo3 = document.getElementById('modalBackTo3');
  const modalSubmitBtn = document.getElementById('modalSubmitBtn');
  const modalAgree = document.getElementById('modalAgree');
  
  // Modal navigation function
  function showModalStep(stepNum) {
    currentModalStep = stepNum;
    document.querySelectorAll('[id^="modalStep"]').forEach(el => el.style.display = 'none');
    document.getElementById(`modalStep${stepNum}`).style.display = 'block';
  }
  
  // Close modal
  if (closeModal) {
    closeModal.addEventListener('click', () => {
      apptModal.style.display = 'none';
    });
  }
  
  // Character count for reason
  if (modalReason) {
    modalReason.addEventListener('input', () => {
      modalCharCount.textContent = modalReason.value.length;
    });
  }
  
  // Step 1 -> 2
  if (modalToStep2) {
    modalToStep2.addEventListener('click', () => {
      const urgency = document.querySelector('input[name="modalUrgency"]:checked')?.value;
      if (!urgency) {
        showToast('Please select an urgency level', 'error');
        return;
      }
      if (!modalReason.value.trim()) {
        showToast('Please describe your concern', 'error');
        return;
      }
      showModalStep(2);
    });
  }
  
  // Step 2 -> 1
  if (modalBackTo1) {
    modalBackTo1.addEventListener('click', () => showModalStep(1));
  }
  
  // Step 2 -> 3
  if (modalToStep3) {
    modalToStep3.addEventListener('click', () => showModalStep(3));
  }
  
  // Step 3 -> 2
  if (modalBackTo2) {
    modalBackTo2.addEventListener('click', () => showModalStep(2));
  }
  
  // Step 3 -> 4 (with time slot handling)
  if (modalToStep4) {
    modalToStep4.addEventListener('click', () => {
      if (!modalApptDate.value) {
        showToast('Please select a date', 'error');
        return;
      }
      if (!modalApptTime.value) {
        showToast('Please select a time slot', 'error');
        return;
      }
      // Populate confirmation step
      const studentData = JSON.parse(sessionStorage.getItem('studentData')) || {};
      const urgency = document.querySelector('input[name="modalUrgency"]:checked')?.value;
      document.getElementById('modalConfName').textContent = `${studentData.fname || ''} ${studentData.lname || ''}`;
      document.getElementById('modalConfId').textContent = studentData.studentId || '';
      document.getElementById('modalConfCourse').textContent = studentData.course || '';
      document.getElementById('modalConfYear').textContent = studentData.year || '';
      document.getElementById('modalConfUrgency').textContent = urgency || '';
      const dateObj = new Date(modalApptDate.value);
      const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      document.getElementById('modalConfDateTime').textContent = `${dateStr} at ${modalApptTime.value}`;
      document.getElementById('modalConfReason').textContent = modalReason.value;
      showModalStep(4);
    });
  }
  
  // Step 4 -> 3
  if (modalBackTo3) {
    modalBackTo3.addEventListener('click', () => showModalStep(3));
  }
  
  // Time slot selection in Step 3
  if (modalApptDate) {
    modalApptDate.addEventListener('change', async () => {
      if (!modalApptDate.value) return;
      try {
        const response = await fetch(`/api/schedules/${modalApptDate.value}`);
        if (!response.ok) throw new Error('Failed to fetch time slots');
        const slots = await response.json();
        
        modalTimeSlotGrid.innerHTML = '';
        slots.forEach(slot => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = slot.time;
          button.style.cssText = `padding:0.5rem 1rem; border:1.5px solid #d4af37; background:#fff; border-radius:8px; cursor:pointer; font-weight:600;`;
          if (slot.status === 'booked') {
            button.disabled = true;
            button.style.background = '#e5e7eb';
            button.style.borderColor = '#9ca3af';
            button.style.color = '#6b7280';
            button.style.cursor = 'not-allowed';
          }
          button.addEventListener('click', (e) => {
            e.preventDefault();
            if (!button.disabled) {
              document.querySelectorAll('#modalTimeSlotGrid button').forEach(b => {
                b.style.background = '#fff';
                b.style.borderColor = '#d4af37';
              });
              button.style.background = '#d4af37';
              button.style.borderColor = '#0a2342';
              modalApptTime.value = slot.time;
            }
          });
          modalTimeSlotGrid.appendChild(button);
        });
      } catch (error) {
        console.error('Error fetching time slots:', error);
      }
    });
  }
  
  // Submit appointment
  if (modalSubmitBtn) {
    modalSubmitBtn.addEventListener('click', async () => {
      if (!modalAgree.checked) {
        showToast('Please agree to the terms and conditions', 'error');
        return;
      }
      
      const studentData = JSON.parse(sessionStorage.getItem('studentData')) || {};
      const urgency = document.querySelector('input[name="modalUrgency"]:checked')?.value;
      
      const appointmentData = {
        studentid: studentData.studentId,
        fname: studentData.fname,
        mname: studentData.mname || '',
        lname: studentData.lname,
        suffix: studentData.suffix || '',
        course: studentData.course,
        year: studentData.year,
        contact: studentData.contact,
        email: studentData.email,
        date: modalApptDate.value,
        time: modalApptTime.value,
        reason: modalReason.value,
        urgency: urgency
      };
      
      try {
        const response = await fetch('/api/appointments/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appointmentData)
        });
        
        if (!response.ok) {
          const error = await response.json();
          showToast(error.error || 'Failed to submit appointment', 'error');
          return;
        }

        const result = await response.json();
        showToast('Appointment submitted — Ref: ' + result.refNumber, 'success');
        apptModal.style.display = 'none';
        renderAppointments(studentData.studentId, studentData.email);
      } catch (error) {
        console.error('Error submitting appointment:', error);
        showToast('Error submitting appointment', 'error');
      }
    });
  }
  
  
  let appointmentsCache = [];

  // Update footer year
  if (footerYear) {
    footerYear.textContent = new Date().getFullYear();
  }

  // Helper functions
  function checkAuth() {
    const studentData = sessionStorage.getItem('studentData');
    if (!studentData) {
      window.location.href = 'landing.html';
      return null;
    }
    const parsed = JSON.parse(studentData);
    console.log('DEBUG: checkAuth() returning:', parsed);
    return parsed;
  }

  // Simple toast helper
  function showToast(message, type = 'info', timeout = 3500) {
    try {
      let container = document.getElementById('globalToastContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'globalToastContainer';
        container.style.position = 'fixed';
        container.style.right = '20px';
        container.style.bottom = '20px';
        container.style.zIndex = '99999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '8px';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = 'toast toast-' + (type || 'info');
      toast.textContent = message;
      toast.style.minWidth = '200px';
      toast.style.padding = '10px 14px';
      toast.style.borderRadius = '8px';
      toast.style.boxShadow = '0 8px 24px rgba(2,6,23,0.12)';
      toast.style.color = '#fff';
      toast.style.fontWeight = '600';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'opacity 220ms ease, transform 220ms ease';

      // color by type
      if (type === 'success') toast.style.background = '#16a34a';
      else if (type === 'error') toast.style.background = '#dc2626';
      else if (type === 'warning') toast.style.background = '#f59e0b';
      else toast.style.background = '#0f172a';

      container.appendChild(toast);
      // animate in
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
      });

      const t = setTimeout(() => {
        // animate out
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => { try { container.removeChild(toast); } catch (e) {} }, 220);
      }, timeout);

      // allow click to dismiss
      toast.addEventListener('click', () => {
        clearTimeout(t);
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => { try { container.removeChild(toast); } catch (e) {} }, 180);
      });
    } catch (e) {
      console.warn('showToast failed', e);
    }
  }

  function updateUserInfo(data) {
    console.log('DEBUG: updateUserInfo() called with:', data);
    if (!data) return;
    
    if (avatarText) {
      avatarText.textContent = data.fname.charAt(0).toUpperCase();
    }
    if (nameDisplay) {
      const fullName = `${data.fname} ${data.mname ? data.mname + ' ' : ''}${data.lname}${data.suffix ? ' ' + data.suffix : ''}`;
      nameDisplay.textContent = fullName;
      console.log('DEBUG: Set nameDisplay to:', fullName);
    }
    if (studentIdDisplay) {
      studentIdDisplay.textContent = data.studentId;
      console.log('DEBUG: Set studentIdDisplay to:', data.studentId);
    }
  }

  function formatStatus(status) {
    if (!status) return 'Pending';
    
    if (status.toLowerCase() === 'rescheduled/approved') {
      return 'Rescheduled & Approved';
    }

    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  function getStatusClass(status) {
    if (!status) return 'pending';
    
    let statusClass = status.toLowerCase();
    if (statusClass === 'rescheduled/approved') {
      return 'rescheduledapproved';
    }
    
    return statusClass.replace(/[^a-z0-9]+/g, '');
  }

  async function renderAppointments(studentId, email) {
    if (!appointmentsList) return;
    
    console.log('DEBUG: renderAppointments() called with studentId:', studentId, 'email:', email);

    try {
      const response = await fetch('/api/appointments/student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ studentId, email })
      });

      console.log('DEBUG: Appointments response status:', response.status);
      
      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }

      const appointments = await response.json();
      console.log('DEBUG: Appointments fetched:', appointments);
      appointmentsCache = appointments;
      renderSortedAppointments('desc');
    } catch (error) {
      console.error('Error fetching appointments:', error);
      appointmentsList.innerHTML = `
        <div style="text-align: center; color: #dc2626; padding: 1rem;">
          Error loading appointments. Please try again later.
        </div>
      `;
    }
  }

  function renderSortedAppointments(order) {
    if (!appointmentsList) return;
    if (!appointmentsCache || appointmentsCache.length === 0) {
      appointmentsList.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <p>No appointments found.</p>
        </div>
      `;
      return;
    }
    let sortedAppointments = [...appointmentsCache];
    sortedAppointments.sort((a, b) => {
      if (order === 'asc') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      } else {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });
    appointmentsList.innerHTML = sortedAppointments.map(apt => {
      const displayStatus = formatStatus(apt.status);
      const statusClass = getStatusClass(apt.status);
      // Show cancel button only when status is pending (case-insensitive)
      const isPending = !(apt.status) || String(apt.status).toLowerCase() === 'pending';
      const cancelBtnHtml = isPending ? `<button class="btn btn-danger btn-cancel" data-ref="${apt.refNumber}">Cancel</button>` : '';
      return `
        <div class="appointment-card">
          <div class="appointment-header">
            <div>
              <div class="appointment-title">${apt.urgency} Level Consultation</div>
              <div class="appointment-ref">Ref: ${apt.refNumber}</div>
            </div>
            <span class="appointment-status status-${statusClass}">${displayStatus}</span>
          </div>
          <div class="appointment-date">
            ${apt.date ? `Scheduled for ${apt.date} at ${apt.time}` : 'Schedule pending'}
          </div>
          <div class="appointment-reason">
            ${apt.reason}
          </div>
          <div class="appointment-actions" style="margin-top:8px; text-align:right;">
            ${cancelBtnHtml}
          </div>
        </div>
      `;
    }).join('');
    
    // Attach event listeners for cancel buttons
    appointmentsList.querySelectorAll('.btn-cancel').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const ref = btn.getAttribute('data-ref');
        if (!ref) return;
        // Confirm using existing confirm dialog helper (custom labels)
          const confirmed = await showConfirmDialog('Cancel Appointment', 'Are you sure you want to cancel this appointment?', { confirmText: 'Yes, Cancel', cancelText: 'Keep Appointment', submessage: 'This will cancel your pending appointment.', icon: '⚠️', alignButtons: 'center', align: 'center' });
        if (!confirmed) return;
        try {
          const res = await fetch(`/api/appointments/${encodeURIComponent(ref)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Cancelled', actor: (studentData && studentData.studentId) ? studentData.studentId : undefined })
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            showToast(j.error || 'Failed to cancel appointment', 'error');
            return;
          }
          const j = await res.json();
          showToast('Appointment cancelled', 'success');
          // Refresh the list
          renderAppointments((studentData && studentData.studentId) ? studentData.studentId : (studentData && studentData.studentid), (studentData && studentData.email));
        } catch (err) {
          console.error('Cancel failed', err);
          showToast('Error cancelling appointment', 'error');
        }
      });
    });
  }

  

  // SETTINGS SECTION FUNCTIONALITY
  function setupSettings(studentData) {
    // Populate account info
    document.getElementById('settingsFirstName').textContent = studentData.firstName || '-';
    document.getElementById('settingsLastName').textContent = studentData.lastName || '-';
    document.getElementById('settingsSchoolId').textContent = studentData.schoolId || '-';
    document.getElementById('settingsEmail').textContent = studentData.email || '-';
    document.getElementById('settingsCourse').textContent = studentData.course || '-';
    document.getElementById('settingsYear').textContent = studentData.year || '-';

    // Change password button
    const changePasswordBtn = document.getElementById('changePasswordSettingsBtn');
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', async () => {
        const currentPassword = document.getElementById('settingsCurrentPassword').value?.trim();
        const newPassword = document.getElementById('settingsNewPassword').value?.trim();
        const confirmPassword = document.getElementById('settingsConfirmPassword').value?.trim();
        const messageDiv = document.getElementById('settingsPasswordMessage');

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
          messageDiv.innerHTML = '<span style="color: red;">All fields are required</span>';
          messageDiv.style.display = 'block';
          return;
        }

        if (newPassword.length < 6) {
          messageDiv.innerHTML = '<span style="color: red;">Password must be at least 6 characters</span>';
          messageDiv.style.display = 'block';
          return;
        }

        if (newPassword !== confirmPassword) {
          messageDiv.innerHTML = '<span style="color: red;">Passwords do not match</span>';
          messageDiv.style.display = 'block';
          return;
        }

        try {
          messageDiv.innerHTML = '<span style="color: #6b7280;">Changing password...</span>';
          messageDiv.style.display = 'block';

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
            messageDiv.style.display = 'block';
            return;
          }

          messageDiv.innerHTML = '<span style="color: green;">Password changed successfully!</span>';
          messageDiv.style.display = 'block';

          // Clear form
          document.getElementById('settingsCurrentPassword').value = '';
          document.getElementById('settingsNewPassword').value = '';
          document.getElementById('settingsConfirmPassword').value = '';

          // Clear message after 3 seconds
          setTimeout(() => {
            messageDiv.style.display = 'none';
          }, 3000);

        } catch(err) {
          console.error('Password change error:', err);
          messageDiv.innerHTML = '<span style="color: red;">An error occurred. Please try again.</span>';
          messageDiv.style.display = 'block';
        }
      });
    }
  }

  // Setup section navigation
  function setupSectionNavigation() {
    const navItems = document.querySelectorAll('.side-nav a');
    const sections = document.querySelectorAll('.main-content section');

    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = item.getAttribute('href').substring(1);

        // Remove active class from all sections and nav items
        sections.forEach(section => {
          section.classList.remove('active-section');
          section.style.display = 'none';
        });
        navItems.forEach(nav => nav.classList.remove('active'));

        // Add active class to selected section and nav item
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
          targetSection.classList.add('active-section');
          targetSection.style.display = 'block';
          item.classList.add('active');
        }
      });
    });
  }

  async function handleLogout() {
    const confirmLogout = await showConfirmDialog('Confirm Logout', 'Are you sure you want to logout?');
    if (confirmLogout) {
      sessionStorage.removeItem('studentData');
      window.location.href = 'landing.html';
    }
  }

  // Initialize dashboard
  const studentData = checkAuth();
  if (studentData) {
    updateUserInfo(studentData);
    setupSettings(studentData);
    setupSectionNavigation();
    renderAppointments(studentData.studentId, studentData.email);
    renderMyReferrals(studentData.studentId);
    if (sortAscBtn) {
      sortAscBtn.addEventListener('click', () => renderSortedAppointments('asc'));
    }
    if (sortDescBtn) {
      sortDescBtn.addEventListener('click', () => renderSortedAppointments('desc'));
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }
  }

  // ----- Peer Referral Modal & Actions -----
  // Create modal HTML dynamically to avoid cluttering template further
  const referFriendBtn = document.getElementById('referFriendBtn');
  let referralModal = null;
  function createReferralModal(){
    if(referralModal) return referralModal;
    const modal = document.createElement('div');
    modal.className = 'modal referral-modal';
    modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(10,34,66,0.18); justify-content:center; align-items:center; z-index:1200; overflow:auto; padding:2rem;';
    modal.innerHTML = `
      <div class="modal-content referral-content" role="dialog" aria-modal="true" aria-label="Peer Concern Referral">
        <div class="referral-header" style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
          <div>
            <h3 style="margin:0; color:#0a2342;">Peer Concern Referral</h3>
            <div style="color:#6b7280; font-size:0.95rem; margin-top:4px;">All referrals are handled confidentially by the Guidance Office.</div>
          </div>
          <button id="closeReferralModal" class="close-modal">&times;</button>
        </div>
        <div class="referral-body" style="margin-top:12px;">
        <form id="referralForm">
          <fieldset class="referral-grid">
            <legend class="sr-only">About the Referrer</legend>
            <label class="ref-label full"><span class="ref-label-title">Full Name*</span><input id="r_referrerName" required class="ref-input"/></label>
            <label class="ref-label"><span class="ref-label-title">Student ID*</span><input id="r_referrerStudentId" required class="ref-input"/></label>
            <label class="ref-label"><span class="ref-label-title">Contact Email*</span><input id="r_referrerEmail" type="email" required class="ref-input"/></label>
            <label class="ref-label"><span class="ref-label-title">Relationship to Student</span>
              <select id="r_relationship" class="ref-input"><option>Friend</option><option>Classmate</option><option>Roommate</option><option>Sibling</option><option>Other</option></select>
            </label>

            <legend class="sr-only">Student of Concern</legend>
            <label class="ref-label full"><span class="ref-label-title">Student Full Name*</span><input id="r_studentName" required class="ref-input"/></label>
            <label class="ref-label"><span class="ref-label-title">Student ID*</span><input id="r_studentId" required class="ref-input"/></label>
            <label class="ref-label"><span class="ref-label-title">Course</span>
              <select id="r_course" class="ref-input">
                <option value="">Select Course</option>
                <optgroup label="CNAHS - College of Nursing and Allied Health Sciences">
                  <option>Bachelor of Science in Midwifery</option>
                  <option>Bachelor of Science in Nursing</option>
                </optgroup>
                <optgroup label="CBA - College of Business Administration">
                  <option>Bachelor of Science in Accountancy</option>
                  <option>Bachelor of Science in Accounting -Information Systems</option>
                  <option>Bachelor of Science in Business -Administration – Financial Management</option>
                  <option>Bachelor of Science in Business -Administration – Marketing Management</option>
                  <option>Bachelor of Science in Entrepreneurship</option>
                  <option>Bachelor of Science in Internal Auditing</option>
                  <option>Bachelor of Science in Management Accounting</option>
                </optgroup>
                <optgroup label="CLAMS - College of Liberal Arts and Marine Sciences">
                  <option>Bachelor of Arts in English Language Studies</option>
                  <option>Bachelor of Arts in Political Science</option>
                  <option>Bachelor of Science in Marine Biology</option>
                </optgroup>
                <optgroup label="CTED - College of Teacher Education">
                  <option>Bachelor of Culture and Arts Education</option>
                  <option>Bachelor of Early Childhood Education</option>
                  <option>Bachelor of Elementary Education</option>
                  <option>Bachelor of Physical Education</option>
                  <option>Bachelor of Secondary Education – English</option>
                  <option>Bachelor of Secondary Education – Filipino</option>
                  <option>Bachelor of Secondary Education – Mathematics</option>
                  <option>Bachelor of Secondary Education – Science</option>
                  <option>Bachelor of Secondary Education – Social Studies</option>
                </optgroup>
                <optgroup label="CCJE - College of Criminal Justice Education">
                  <option>Bachelor of Science in Criminology</option>
                </optgroup>
                <optgroup label="COE - College of Engineering">
                  <option>Bachelor of Science in Civil Engineering major in Structural Engineering</option>
                  <option>Bachelor of Science in Computer Engineering</option>
                  <option>Bachelor of Science in Electrical Engineering</option>
                  <option>Bachelor of Science in Electronics Engineering</option>
                </optgroup>
                <optgroup label="SOM - School of Maritime">
                  <option>Bachelor of Science in Marine Engineering</option>
                  <option>Bachelor of Science in Marine Transportation</option>
                </optgroup>
                <optgroup label="CME - College of Management and Entrepreneurship">
                  <option>Bachelor of Science in Hospitality Management</option>
                  <option>Bachelor of Science in Tourism Management</option>
                </optgroup>
                <optgroup label="CCS - College of Computing Studies">
                  <option>Bachelor of Science in Computer Science</option>
                  <option>Bachelor of Science in Information Systems</option>
                  <option>Bachelor of Science in Information Technology</option>
                </optgroup>
              </select>
            </label>
            <label class="ref-label"><span class="ref-label-title">Year</span>
              <select id="r_year" class="ref-input">
                <option value="">Select Year</option>
                <option>1st Year</option>
                <option>2nd Year</option>
                <option>3rd Year</option>
                <option>4th Year</option>
                <option>5th+ Year</option>
              </select>
            </label>
            <label class="ref-label full"><span class="ref-label-title">Does the student know about this referral?</span>
              <select id="r_studentAware" class="ref-input"><option>Yes</option><option>No</option><option>Not Sure</option></select>
            </label>

            <legend class="sr-only">Concern Details</legend>
            <div class="concern-types" style="grid-column:1 / -1; display:flex; gap:0.5rem; flex-wrap:wrap;">
              <label class="concern-item"><input type="checkbox" name="r_concernType" value="Academic"/> Academic</label>
              <label class="concern-item"><input type="checkbox" name="r_concernType" value="Emotional Stress"/> Emotional Stress</label>
              <label class="concern-item"><input type="checkbox" name="r_concernType" value="Anxiety / Shyness"/> Anxiety / Shyness</label>
              <label class="concern-item"><input type="checkbox" name="r_concernType" value="Behavioral"/> Behavioral</label>
              <label class="concern-item"><input type="checkbox" name="r_concernType" value="Social / Peer Issue"/> Social / Peer Issue</label>
              <label class="concern-item"><input type="checkbox" name="r_concernType" value="Other"/> Other</label>
            </div>

            <label class="ref-label full"><span class="ref-label-title">Short description (max 500 chars)*</span>
              <textarea id="r_description" maxlength="500" required class="ref-textarea"></textarea>
              <div class="desc-count" id="r_descCount">0 / 500</div>
            </label>

            <label class="ref-label full"><span class="ref-label-title">Urgency Level</span>
              <select id="r_urgency" class="ref-input"><option>Normal</option><option>Urgent</option></select>
            </label>

          </fieldset>
          <div class="referral-actions">
            <button type="button" id="r_cancel" class="btn btn-ghost">Cancel</button>
            <button type="submit" id="r_submit" class="btn btn-primary">Submit Referral</button>
          </div>
        </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    referralModal = modal;
    return modal;
  }

  function openReferralModal(){
    const modal = createReferralModal();
    // prefill referrer info from session
    const student = JSON.parse(sessionStorage.getItem('studentData') || '{}');
    modal.querySelector('#r_referrerName').value = `${student.fname || ''} ${student.lname || ''}`.trim();
    modal.querySelector('#r_referrerStudentId').value = student.studentId || student.schoolId || '';
    modal.querySelector('#r_referrerEmail').value = student.email || '';
    modal.style.display = 'flex';

    const desc = modal.querySelector('#r_description');
    const descCount = modal.querySelector('#r_descCount');
    desc.addEventListener('input', ()=>{ descCount.textContent = `${desc.value.length} / 500`; });

    modal.querySelector('#r_cancel').addEventListener('click', ()=> modal.style.display = 'none');

    const form = modal.querySelector('#referralForm');
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const payload = {
        referrerName: modal.querySelector('#r_referrerName').value.trim(),
        referrerStudentId: modal.querySelector('#r_referrerStudentId').value.trim(),
        referrerEmail: modal.querySelector('#r_referrerEmail').value.trim(),
        relationship: modal.querySelector('#r_relationship').value,
        studentName: modal.querySelector('#r_studentName').value.trim(),
        studentId: modal.querySelector('#r_studentId').value.trim(),
        studentCourseYearSection: ((modal.querySelector('#r_course').value || '').trim() + (modal.querySelector('#r_year').value ? ' - ' + modal.querySelector('#r_year').value.trim() : '')).trim(),
        studentAware: modal.querySelector('#r_studentAware').value,
        concernTypes: Array.from(modal.querySelectorAll('input[name="r_concernType"]:checked')).map(i=>i.value),
        description: modal.querySelector('#r_description').value.trim(),
        urgency: modal.querySelector('#r_urgency').value
      };

      // Basic validation
      if(!payload.referrerName || !payload.referrerStudentId || !payload.referrerEmail || !payload.studentName || !payload.studentId || !payload.description || !modal.querySelector('#r_course').value || !modal.querySelector('#r_year').value){
        showToast('Please complete required fields', 'error');
        return;
      }

      try{
        const res = await fetch('/api/referrals', {
          method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        if(!res.ok){ const j = await res.json().catch(()=>({})); showToast('Failed to submit referral: '+(j.error||res.statusText), 'error'); return; }
        const j = await res.json();
        showToast('Referral submitted — thank you.', 'success');
        modal.style.display = 'none';
        // refresh list
        renderMyReferrals(payload.referrerStudentId);
      }catch(err){ console.error('Submit referral failed', err); showToast('Error submitting referral', 'error'); }
    }, { once: true });
  }

  if(referFriendBtn) referFriendBtn.addEventListener('click', openReferralModal);

  // Render the student's referrals list
  async function renderMyReferrals(studentId){
    const el = document.getElementById('myReferralsList');
    if(!el) return;
    try{
      const res = await fetch(`/api/referrals?studentId=${encodeURIComponent(studentId)}`);
      if(!res.ok) throw new Error('Failed');
      const j = await res.json();
      const items = j.referrals || [];
      if(items.length === 0){ el.innerHTML = '<div style="padding:1rem; color:#6b7280;">You have not submitted any peer referrals.</div>'; return; }
      el.innerHTML = items.map(it=>{
        return `<div style="border-bottom:1px solid #eef5fb; padding:0.5rem 0;"><div style="display:flex; justify-content:space-between; align-items:center;"><div><strong>${it.studentName}</strong> <div style="color:#6b7280; font-size:0.9rem;">Ref ID: ${it.refId} • ${new Date(it.createdAt).toLocaleString()}</div></div><div style="text-align:right;"><div style="font-weight:700;">${it.urgency}</div><div style="color:#6b7280; font-size:0.9rem;">Status: ${it.status}</div></div></div><div style="margin-top:0.5rem; color:#0a2342;">Concern: ${(it.concernTypes || []).join(', ')} — ${it.description}</div></div>`;
      }).join('');
    }catch(err){ console.error('Could not load referrals', err); el.innerHTML = '<div style="padding:1rem; color:#dc2626;">Could not load referrals.</div>'; }
  }
});

