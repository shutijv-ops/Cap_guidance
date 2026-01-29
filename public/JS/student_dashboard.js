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
  function showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal logout-confirm';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px">
          <div class="modal-body">
            <span class="modal-icon">🔒</span>
            <h3 class="modal-message">${message}</h3>
            <p class="modal-submessage">You will be redirected to the login page</p>
          </div>
          <div class="modal-footer">
            <button class="button button-secondary" id="cancelBtn">Stay Signed In</button>
            <button class="button button-primary" id="confirmBtn">Yes, Logout</button>
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
        alert('Please select an urgency level');
        return;
      }
      if (!modalReason.value.trim()) {
        alert('Please describe your concern');
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
        alert('Please select a date');
        return;
      }
      if (!modalApptTime.value) {
        alert('Please select a time slot');
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
        alert('Please agree to the terms and conditions');
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
          alert(error.error || 'Failed to submit appointment');
          return;
        }
        
        const result = await response.json();
        alert('Appointment submitted successfully! Reference: ' + result.refNumber);
        apptModal.style.display = 'none';
        renderAppointments(studentData.studentId, studentData.email);
      } catch (error) {
        console.error('Error submitting appointment:', error);
        alert('Error submitting appointment');
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
        </div>
      `;
    }).join('');
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
    renderAppointments(studentData.studentId, studentData.email);
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
});

