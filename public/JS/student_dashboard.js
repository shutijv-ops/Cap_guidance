document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const avatarText = document.querySelector('.avatar-text');
  const nameDisplay = document.querySelector('.user-details .name');
  const studentIdDisplay = document.querySelector('.user-details .student-id');
  const appointmentsList = document.querySelector('.appointments-list');
  const logoutBtn = document.getElementById('logoutBtn');
  const footerYear = document.getElementById('footerYear');
  const sortAscBtn = document.getElementById('sortAscBtn');
  const sortDescBtn = document.getElementById('sortDescBtn');
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

