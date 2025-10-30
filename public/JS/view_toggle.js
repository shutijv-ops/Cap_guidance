/* View toggle state */
let currentView = 'list'; // or 'calendar'
let calendarInstance = null;

function updateViewButtons() {
  const listViewBtn = document.getElementById('listViewBtn');
  const calendarViewBtn = document.getElementById('calendarViewBtn');
  
  // Update button states
  if (currentView === 'list') {
    listViewBtn.classList.add('primary');
    calendarViewBtn.classList.remove('primary');
  } else {
    listViewBtn.classList.remove('primary');
    calendarViewBtn.classList.add('primary');
  }
}

function toggleView(view) {
  const listView = document.getElementById('listView');
  const calendarView = document.getElementById('calendarView');
  
  // If clicking the current view's button, do nothing
  if (view === currentView) {
    return;
  }
  
  currentView = view;
  
  // Handle view switching
  if (view === 'calendar') {
    listView.classList.add('hidden');
    calendarView.classList.remove('hidden');
    
    // Initialize calendar if needed
    if (!calendarInstance) {
      calendarInstance = new AppointmentCalendar(calendarView, appointments);
    } else {
      calendarInstance.updateAppointments(appointments);
    }
    
    // Hide list-specific controls
    document.getElementById('selectAllAppointments')?.parentElement?.classList.add('hidden');
  } else {
    listView.classList.remove('hidden');
    calendarView.classList.add('hidden');
    
    // Show list-specific controls
    document.getElementById('selectAllAppointments')?.parentElement?.classList.remove('hidden');
    
    // Refresh the list view
    if (typeof populateAppointmentsTable === 'function') {
      populateAppointmentsTable(currentFilter || 'all');
    }
  }
  
  // Update button states
  updateViewButtons();
}

// Export for use in admin_dashboard.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { toggleView };
}