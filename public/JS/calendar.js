/* Calendar View for Appointments */
class AppointmentCalendar {
  constructor(container, appointments = []) {
    this.container = container;
    this.appointments = appointments;
    this.currentDate = new Date();
    this.init();
  }

  init() {
    this.render();
    this.attachHandlers();
  }

  attachHandlers() {
    const prevBtn = this.container.querySelector('.prev-month');
    const nextBtn = this.container.querySelector('.next-month');
    const todayBtn = this.container.querySelector('.today');

    prevBtn?.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.render();
    });

    nextBtn?.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.render();
    });

    todayBtn?.addEventListener('click', () => {
      this.currentDate = new Date();
      this.render();
    });
  }

  getMonthData() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay(); // 0-6 (Sun-Sat)
    const totalDays = lastDay.getDate();
    
    // Get previous month's padding days
    const prevMonth = new Date(year, month - 1, 0);
    const prevMonthDays = prevMonth.getDate();
    const prevDays = Array.from({length: startPadding}, (_, i) => ({
      date: new Date(year, month - 1, prevMonthDays - startPadding + i + 1),
      isOtherMonth: true
    }));
    
    // Current month days
    const currentDays = Array.from({length: totalDays}, (_, i) => ({
      date: new Date(year, month, i + 1),
      isOtherMonth: false
    }));
    
    // Calculate end padding needed
    const totalCells = Math.ceil((startPadding + totalDays) / 7) * 7;
    const endPadding = totalCells - (startPadding + totalDays);
    const nextDays = Array.from({length: endPadding}, (_, i) => ({
      date: new Date(year, month + 1, i + 1),
      isOtherMonth: true
    }));
    
    return [...prevDays, ...currentDays, ...nextDays];
  }

  getAppointmentsForDate(date) {
    return this.appointments.filter(a => {
      if (!a.date) return false;
      const appDate = new Date(a.date);
      return appDate.getFullYear() === date.getFullYear() &&
             appDate.getMonth() === date.getMonth() &&
             appDate.getDate() === date.getDate();
    });
  }

  formatAppointment(appointment) {
    const time = appointment.time || '';
    const name = `${appointment.fname || ''} ${appointment.lname || ''}`.trim();
    const status = appointment.status?.toLowerCase() || 'pending';
    return `
      <div class="calendar-event ${status}" title="${name} - ${time}">
        ${time} ${name}
      </div>
    `;
  }

  render() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = this.getMonthData();
    const today = new Date();

    this.container.innerHTML = `
      <div class="calendar-view">
        <div class="calendar-header">
          <div class="calendar-title">
            ${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}
          </div>
          <div class="calendar-nav">
            <button class="btn ghost prev-month">←</button>
            <button class="btn ghost today">Today</button>
            <button class="btn ghost next-month">→</button>
          </div>
        </div>
        <div class="calendar-grid">
          ${weekDays.map(day => `
            <div class="calendar-weekday">${day}</div>
          `).join('')}
          
          ${days.map(({date, isOtherMonth}) => {
            const appointments = this.getAppointmentsForDate(date);
            const isToday = date.toDateString() === today.toDateString();
            const maxDisplay = 3;
            
            return `
              <div class="calendar-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}">
                <div class="date">${date.getDate()}</div>
                ${appointments.slice(0, maxDisplay).map(app => this.formatAppointment(app)).join('')}
                ${appointments.length > maxDisplay ? 
                  `<div class="calendar-more">+${appointments.length - maxDisplay} more</div>` : 
                  ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.attachHandlers();
  }

  updateAppointments(appointments) {
    this.appointments = appointments;
    this.render();
  }
}

// Export for use in admin_dashboard.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AppointmentCalendar };
}