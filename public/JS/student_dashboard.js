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
  const nameDisplay = document.querySelector('.user-details .name');
  const studentIdDisplay = document.querySelector('.user-details .student-id');
  const appointmentsList = document.querySelector('.appointments-list');
  const logoutBtn = document.getElementById('logoutBtn');
  const footerYear = document.getElementById('footerYear');
  const sortAscBtn = document.getElementById('sortAscBtn');
  const sortDescBtn = document.getElementById('sortDescBtn');
  const newApptBtn = document.getElementById('newApptBtn');
  const apptModal = document.getElementById('apptModal');
  const closeModal = document.getElementById('closeModal');
  const apptForm = document.getElementById('apptForm');
  const apptMsg = document.getElementById('apptMsg');
  let appointmentsCache = [];
  // Modal logic
  // Urgency logic
  // Time slot selection logic
  if (timeSlotGrid && apptTimeInput) {
    timeSlotGrid.addEventListener('click', (e) => {
      const button = e.target.closest('.time-slot-btn');
      if (button && !button.disabled) {
        // Remove active from all
        Array.from(timeSlotGrid.querySelectorAll('.time-slot-btn')).forEach(btn => {
          if (!btn.disabled) {
            btn.style.background = '#fff';
            btn.style.borderColor = '#d4af37';
          }
        });
          // Remove selected class from all buttons
          Array.from(timeSlotGrid.querySelectorAll('.time-slot-btn')).forEach(btn => {
            btn.classList.remove('selected');
          });
          
          // Add selected class to clicked button
          button.classList.add('selected');
          apptTimeInput.value = button.getAttribute('data-time');
      }
    });
  }
  // Set minimum date to today
  if (apptDate) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    apptDate.min = `${yyyy}-${mm}-${dd}`;
    
    // Update time slots when date changes
    apptDate.addEventListener('change', () => {
      if (apptDate.value) {
        updateTimeSlots(apptDate.value);
      }
    });
  }

  // Urgency change handler (radio group)
  function handleUrgencyChange() {
    const val = getSelectedUrgency();
    if (!dateTimeFields) return;
    if (val === 'Crisis') {
      // Auto-schedule for today, disable date/time fields
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      apptDate.value = `${yyyy}-${mm}-${dd}`;
      apptDate.setAttribute('disabled', 'disabled');
      updateTimeSlots(`${yyyy}-${mm}-${dd}`);
      apptTimeInput.value = '09:00';
      if (timeSlotGrid) {
        Array.from(timeSlotGrid.querySelectorAll('.time-slot-btn')).forEach(btn => {
          btn.setAttribute('disabled', 'disabled');
          btn.style.opacity = '0.5';
          btn.style.cursor = 'not-allowed';
          if (btn.getAttribute('data-time') === '09:00') {
            btn.style.background = 'var(--gold,#d4af37)';
            btn.style.borderColor = 'var(--nav,#0a2342)';
          } else {
            btn.style.background = '#fff';
            btn.style.borderColor = '#d4af37';
          }
        });
      }
    } else {
      document.getElementById('apptDate').removeAttribute('disabled');
      apptTimeInput.value = '';
      document.getElementById('apptDate').value = '';
      if (timeSlotGrid) {
        Array.from(timeSlotGrid.querySelectorAll('.time-slot-btn')).forEach(btn => {
          btn.removeAttribute('disabled');
          btn.style.opacity = '1';
          btn.style.cursor = 'pointer';
          btn.style.background = '#fff';
          btn.style.borderColor = '#d4af37';
        });
      }
    }
  }

  // Attach listeners to urgency radio inputs
  if (apptUrgencyInputs && apptUrgencyInputs.length) {
    apptUrgencyInputs.forEach(inp => inp.addEventListener('change', handleUrgencyChange));
  }
  if (newApptBtn && apptModal) {
    newApptBtn.addEventListener('click', () => {
      apptModal.style.display = 'flex';
      apptMsg.style.display = 'none';
      apptForm.reset();
    });
  }
  if (closeModal && apptModal) {
    closeModal.addEventListener('click', () => {
      apptModal.style.display = 'none';
    });
  }
  window.addEventListener('click', (e) => {
    if (e.target === apptModal) {
      apptModal.style.display = 'none';
    }
  });

  // Form submission logic
  if (apptForm) {
    apptForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!studentData) return;
  const urgency = getSelectedUrgency();
      let date = document.getElementById('apptDate').value;
      let time = document.getElementById('apptTime').value;
      const reason = document.getElementById('apptReason').value;
      apptMsg.style.display = 'none';
      // If crisis, auto-schedule for today
      if (urgency === 'Crisis') {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        date = `${yyyy}-${mm}-${dd}`;
        time = '09:00';
      }
      try {
        const res = await fetch('/api/appointments/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentid: studentData.studentId,
            fname: studentData.fname,
            mname: studentData.mname || '',
            lname: studentData.lname,
            suffix: studentData.suffix || '',
            course: studentData.course,
            year: studentData.year,
            contact: studentData.contact,
            email: studentData.email,
            date,
            time,
            reason,
            urgency
          })
        });
        if (!res.ok) throw new Error('Failed to submit request');
        apptMsg.textContent = 'Appointment request submitted!';
        apptMsg.style.color = 'green';
        apptMsg.style.display = 'block';
        apptForm.reset();
        setTimeout(() => {
          apptModal.style.display = 'none';
          renderAppointments(studentData.studentId, studentData.email);
        }, 1200);
      } catch (err) {
        apptMsg.textContent = 'Error submitting request. Please try again.';
        apptMsg.style.color = 'red';
        apptMsg.style.display = 'block';
      }
    });
  }

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
    return JSON.parse(studentData);
  }

  function updateUserInfo(data) {
    if (!data) return;
    
    if (avatarText) {
      avatarText.textContent = data.name.charAt(0).toUpperCase();
    }
    if (nameDisplay) {
      nameDisplay.textContent = data.name;
    }
    if (studentIdDisplay) {
      studentIdDisplay.textContent = data.studentId;
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

    try {
      const response = await fetch('/api/appointments/student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ studentId, email })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }

      const appointments = await response.json();
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
          <a href="appointment.html" class="btn" style="display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: var(--nav); color: white; text-decoration: none; border-radius: 0.375rem;">
            Schedule an Appointment
          </a>
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

  function handleLogout() {
    sessionStorage.removeItem('studentData');
    window.location.href = 'landing.html';
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

