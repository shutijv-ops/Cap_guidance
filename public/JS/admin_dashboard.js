/* main.js — SPA navigation & data population */

/* ---------- Runtime data (will be loaded from server) ---------- */
const stats = {
  totalAppointments: 0,
  pendingRequests: 0,
  activeStudents: 0,
  counselors: 0,
  totalStudents: 0,
  activeCases: 0,
  recentAppointments: 0,
  highPriorityCount: 0
};

let requests = [];
let appointments = [];
let students = [];
let counselors = [];

/* Priority colors and labels for donut chart */
const PRIORITY_COLORS = {
  'High': '#fb923c',
  'Medium': '#86efac',
  'Low': '#60a5fa',
  'Emergency': '#fb7185'
};

/* Calculate priority distribution from appointments */
function calculatePriorityData(appointments) {
  // Count appointments by priority (use urgency field)
  const counts = {};
  appointments.forEach(a => {
    const p = (a.urgency || 'Low').toString();
    counts[p] = (counts[p] || 0) + 1;
  });
  
  // Convert to chart data format
  const total = appointments.length || 1; // avoid divide by zero
  const data = Object.entries(counts).map(([priority, count]) => ({
    label: `${priority} Priority`,
    value: Math.round((count / total) * 100),
    color: PRIORITY_COLORS[priority] || '#94a3b8' // fallback color
  }));
  
  // Ensure we have entries for common priorities (with 0 if none)
  const priorities = new Set(data.map(d => d.label));
  ['High Priority', 'Medium Priority', 'Low Priority'].forEach(label => {
    if (!priorities.has(label)) {
      data.push({ label, value: 0, color: PRIORITY_COLORS[label.split(' ')[0]] || '#94a3b8' });
    }
  });
  
  return data.sort((a,b) => b.value - a.value); // sort by value descending
}

/* Update the chart when data changes */
function updatePriorityChart(){
  const data = calculatePriorityData(appointments);
  const donut = document.getElementById('donutChart');
  const legend = document.getElementById('chartLegend');
  if(donut && legend){
    renderDonut(donut, data);
    buildLegend(legend, data);
  }
}

const schedule = [
  { time: '9:00 AM - 10:00 AM', name: 'Emma Johnson', type: 'Academic', dot: '#10b981' },
  { time: '11:00 AM - 12:00 PM', name: 'Michael Lee', type: 'Personal', dot: '#ef4444' },
  { time: '2:00 PM - 3:00 PM', name: 'Available', type: '', dot: '#cbd5e1' },
  { time: '3:30 PM - 4:30 PM', name: 'Sophia Parker', type: 'Career', dot: '#f59e0b' }
];

/* ---------- DOM refs ---------- */
const yearEl = document.getElementById('year');
const totalAppointmentsEl = document.getElementById('totalAppointments');
const pendingRequestsEl = document.getElementById('pendingRequests');
const activeStudentsEl = document.getElementById('activeStudents');
const counselorsEl = document.getElementById('counselors');

/* SPA view management */
const navButtons = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const globalSearch = document.getElementById('globalSearch');

/* initialize */
async function init() {
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  // verify admin auth first; if unauthorized redirect to landing
  try{
    const chk = await fetch('/api/admin/check');
    if(!chk.ok){ window.location.href = '/HTML/landing.html'; return; }
  }catch(e){ window.location.href = '/HTML/landing.html'; return; }

  // load remote data and then set UI
  await loadRemoteData();
  // set top stats
  totalAppointmentsEl.textContent = stats.totalAppointments;
  pendingRequestsEl.textContent = stats.pendingRequests;
  activeStudentsEl.textContent = stats.activeStudents;
  counselorsEl.textContent = stats.counselors;

  // populate dashboard widgets
  populateRequestsTable();
  populateSchedule();
  updatePriorityChart();

  // Set up filter handlers
  document.getElementById('tabAllAppts').onclick = () => {
    setActiveTab('all');
    populateAppointmentsTable('all');
  };
  document.getElementById('tabUpcoming').onclick = () => {
    setActiveTab('upcoming');
    populateAppointmentsTable('upcoming');
  };
  document.getElementById('tabPending').onclick = () => {
    setActiveTab('pending');
    populateAppointmentsTable('pending');
  };
  document.getElementById('tabPast').onclick = () => {
    setActiveTab('past');
    populateAppointmentsTable('past');
  };

  // Set up additional filter handlers
  const filters = ['filterPriority', 'filterCounselor', 'rangeFrom', 'rangeTo'];
  filters.forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      populateAppointmentsTable(currentFilter);
    });
  });

  // Reset filters handler
  document.getElementById('resetFilters')?.addEventListener('click', () => {
    document.getElementById('rangeFrom').value = '';
    document.getElementById('rangeTo').value = '';
    document.getElementById('filterPriority').value = 'All Priorities';
    document.getElementById('filterCounselor').value = 'All Counselors';
    setActiveTab('all');
    populateAppointmentsTable('all');
  });

  // View toggle handlers
  // List view button always shows list
  document.querySelector('.btn:not(#calendarViewBtn)').addEventListener('click', () => toggleView('list'));
  
  // Calendar button toggles between calendar and list
  document.getElementById('calendarViewBtn').addEventListener('click', () => {
    // Will switch to list if calendar is already showing
    toggleView('calendar');
  });
  
  // populate appointments view & students & counselors
  populateAppointmentsTable();
  updateTabCounts();
  populateStudentsTable();
  populateCounselorsTable();
  populateFilterCounselors();

  // nav listeners
  navButtons.forEach(btn => btn.addEventListener('click', navHandler));
  document.querySelectorAll('[data-view]').forEach(el => {
    if (el.dataset.view && el.dataset.view !== 'dashboard') {
      // view links (e.g., View All) can also route
      el.addEventListener('click', (e) => {
        if (e.target.dataset.view) navigateTo(e.target.dataset.view);
      });
    }
  });

  // hamburger
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', () => {
      if (sidebar.style.display === 'block') sidebar.style.display = 'none';
      else sidebar.style.display = 'block';
    });
  }

  // global search - searches active table content
  if (globalSearch) {
    globalSearch.addEventListener('input', () => {
      const q = globalSearch.value.toLowerCase().trim();
      const active = document.querySelector('.view:not(.hidden)');
      if (!active) return;
      const rows = active.querySelectorAll('tbody tr');
      rows.forEach(r => {
        const txt = r.innerText.toLowerCase();
        r.style.display = txt.indexOf(q) > -1 ? '' : 'none';
      });
    });
  }

  // ensure sidebar visibility on resize
  window.addEventListener('resize', handleResize);
  handleResize();
}

/* ---------- Navigation ---------- */
function navHandler(e) {
  const view = e.currentTarget.dataset.view;
  navigateTo(view);
}
function navigateTo(viewName) {
  // set active nav
  navButtons.forEach(b => b.classList.toggle('active', b.dataset.view === viewName));
  // show view
  views.forEach(v => v.classList.toggle('hidden', v.dataset.view !== viewName));
  // close sidebar on mobile
  if (window.innerWidth <= 1100) sidebar.style.display = 'none';
}

/* ---------- Populate Dashboard Requests Table ---------- */
function createBadge(priority) {
  const el = document.createElement('span'); el.className = 'badge';
  if (priority === 'High') el.classList.add('high');
  else if (priority === 'Medium') el.classList.add('medium');
  else if (priority === 'Low') el.classList.add('low');
  else el.classList.add('emergency');
  el.textContent = priority;
  return el;
}
function createStatus(status) {
  const el = document.createElement('div');
  const s = (status || '').toString().toLowerCase();
  if(s === 'approved') el.className = 'status-pill status-approved';
  else if(s === 'denied') el.className = 'status-pill status-denied';
  else el.className = 'status-pill status-pending';
  el.textContent = status || '';
  return el;
}
function populateRequestsTable() {
  const tbody = document.querySelector('#requestsTable tbody');
  tbody.innerHTML = '';
  requests.forEach(r => {
    const tr = document.createElement('tr');
    tr.dataset.ref = r.ref || r.refNumber || '';

    const initials = (r.fname ? r.fname[0] : 'U') + (r.lname ? r.lname[0] : '');
    const tdStudent = document.createElement('td');
    tdStudent.innerHTML = `
      <div class="student-cell">
        <div class="student-avatar" style="background:linear-gradient(135deg,#7c3aed,#4f46e5)">${initials}</div>
        <div class="stu-meta"><div class="name">${r.fname || ''} ${r.lname || ''}</div><div class="id">${r.studentid || ''}</div></div>
      </div>`;
    tr.appendChild(tdStudent);

    const tdType = document.createElement('td'); tdType.textContent = r.course || 'General'; tr.appendChild(tdType);
    const tdDate = document.createElement('td'); tdDate.textContent = r.date ? `${r.date} ${r.time || ''}` : (r.date || ''); tr.appendChild(tdDate);

    const tdPriority = document.createElement('td'); tdPriority.appendChild(createBadge(r.urgency || 'Low')); tr.appendChild(tdPriority);
    const tdStatus = document.createElement('td'); tdStatus.appendChild(createStatus(r.status || 'Pending')); tr.appendChild(tdStatus);

    const tdAction = document.createElement('td'); tdAction.className = 'actions';
    const approveBtn = document.createElement('button'); approveBtn.className='action-btn'; approveBtn.innerHTML='✔️'; approveBtn.title='Approve';
    approveBtn.addEventListener('click', () => handleAdminActionApprove(tr.dataset.ref, tr));
    const denyBtn = document.createElement('button'); denyBtn.className='action-btn'; denyBtn.innerHTML='❌'; denyBtn.title='Deny';
    denyBtn.addEventListener('click', () => handleAdminActionDeny(tr.dataset.ref, tr));
    const assignBtn = document.createElement('button'); assignBtn.className='action-btn'; assignBtn.innerHTML='👤'; assignBtn.title='Assign';
    assignBtn.addEventListener('click', () => handleAdminAssign(tr.dataset.ref, tr));
    tdAction.appendChild(approveBtn); tdAction.appendChild(denyBtn); tdAction.appendChild(assignBtn);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  });
}

/* ---------- Schedule ---------- */
function populateSchedule() {
  const scheduleList = document.getElementById('scheduleList');
  scheduleList.innerHTML = '';
  // Build today's schedule from appointments loaded from server
  const todayKey = new Date().toISOString().slice(0,10); // yyyy-mm-dd
  // only include approved/booked appointments in today's schedule
  const todayAppts = appointments.filter(a => {
    if(!a || !a.date) return false;
    const s = (a.status || '').toString().toLowerCase();
    return a.date === todayKey && (s === 'approved' || s === 'booked');
  });

  // helper: parse time like '9:00 AM' to minutes
  const parseTime = (t) => {
    if(!t) return 0;
    const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if(!m) return 0;
    let h = parseInt(m[1],10); const mm = parseInt(m[2],10); const ampm = m[3].toUpperCase();
    if(ampm === 'PM' && h !== 12) h += 12;
    if(ampm === 'AM' && h === 12) h = 0;
    return h*60 + mm;
  };

  todayAppts.sort((x,y) => parseTime(x.time) - parseTime(y.time));

  if(todayAppts.length === 0){
    const li = document.createElement('li'); li.className = 'schedule-item';
    li.innerHTML = `<div style="width:74px; text-align:right; font-size:13px; color:#6b7280;">—</div><div style="flex:1;"><div class="s-name">No bookings today</div><div class="schedule-meta"><span class="text-muted">No scheduled appointments</span></div></div>`;
    scheduleList.appendChild(li);
    return;
  }

  todayAppts.forEach(s => {
    const li = document.createElement('li'); li.className = 'schedule-item';
    li.innerHTML = `<div style="width:74px; text-align:right; font-size:13px; color:#6b7280;">${s.time}</div>
      <div style="flex:1;"><div class="s-name">${s.fname || ''} ${s.lname || ''}</div>
      <div class="schedule-meta">${s.course ? `<span class="s-type" style="background:#e6eef7;color:#0b63ff;">${s.course}</span>` : '<span class="text-muted">No details</span>'}</div></div>`;
    scheduleList.appendChild(li);
  });
}

/* ---------- Donut Chart (SVG) ---------- */
function renderDonut(svgEl, data) {
  const total = data.reduce((s,d)=>s+d.value,0);
  const radius = 16;
  const circumference = 2*Math.PI*radius;
  let offset = 0;
  svgEl.innerHTML = '';
  const bg = document.createElementNS('http://www.w3.org/2000/svg','circle');
  bg.setAttribute('cx','18'); bg.setAttribute('cy','18'); bg.setAttribute('r', radius.toString());
  bg.setAttribute('fill','transparent'); bg.setAttribute('stroke','#f3f4f6'); bg.setAttribute('stroke-width','8');
  svgEl.appendChild(bg);

  data.forEach(d => {
    const slice = document.createElementNS('http://www.w3.org/2000/svg','circle');
    slice.setAttribute('cx','18'); slice.setAttribute('cy','18'); slice.setAttribute('r', radius.toString());
    slice.setAttribute('fill','transparent'); slice.setAttribute('stroke', d.color); slice.setAttribute('stroke-width','8');
    slice.setAttribute('stroke-linecap','butt');
    const fraction = d.value / total;
    const dash = (fraction * circumference).toFixed(2);
    const gap = (circumference - dash).toFixed(2);
    slice.setAttribute('stroke-dasharray', `${dash} ${gap}`);
    slice.setAttribute('transform', `rotate(-90 18 18)`);
    slice.style.strokeDashoffset = -offset;
    offset += parseFloat(dash);
    svgEl.appendChild(slice);
  });

  const hole = document.createElementNS('http://www.w3.org/2000/svg','circle');
  hole.setAttribute('cx','18'); hole.setAttribute('cy','18'); hole.setAttribute('r','10.2'); hole.setAttribute('fill','#fff');
  svgEl.appendChild(hole);
}
function buildLegend(container, data) {
  container.innerHTML = '';
  data.forEach(d => {
    const row = document.createElement('div'); row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px';
    row.innerHTML = `<div style="width:12px;height:12px;border-radius:3px;background:${d.color}"></div><div style="font-size:13px;color:#374151">${d.label} <span style="color:#6b7280;font-weight:700;margin-left:8px">${d.value}%</span></div>`;
    container.appendChild(row);
  });
}

/* ---------- Appointments View ---------- */
/* Appointment filtering and display */
let currentFilter = 'all'; // track active filter

function isUpcoming(appt) {
  if(!appt.date) return false;
  const today = new Date().toISOString().slice(0,10);
  return appt.date >= today;
}

function isPending(appt) {
  const s = (appt.status || '').toString().toLowerCase();
  return s === 'pending' || s === '' || s === 'requested' || !appt.status;
}

function isPast(appt) {
  if(!appt.date) return false;
  const today = new Date().toISOString().slice(0,10);
  return appt.date < today;
}

function filterAppointments(filter = currentFilter) {
  let filtered = [...appointments]; // start with all
  
  // Apply tab filter
  if(filter === 'upcoming') filtered = filtered.filter(isUpcoming);
  else if(filter === 'pending') filtered = filtered.filter(isPending);
  else if(filter === 'past') filtered = filtered.filter(isPast);
  
  // Apply additional filters
  const priority = document.getElementById('filterPriority').value;
  const counselor = document.getElementById('filterCounselor').value;
  const from = document.getElementById('rangeFrom').value;
  const to = document.getElementById('rangeTo').value;
  
  if(priority !== 'All Priorities') {
    filtered = filtered.filter(a => (a.urgency || 'Low') === priority);
  }
  if(counselor !== 'All Counselors') {
    filtered = filtered.filter(a => a.counselor === counselor);
  }
  if(from) {
    filtered = filtered.filter(a => a.date >= from);
  }
  if(to) {
    filtered = filtered.filter(a => a.date <= to);
  }
  
  return filtered;
}

function updateTabCounts() {
  const allCount = appointments.length;
  const upcomingCount = appointments.filter(isUpcoming).length;
  const pendingCount = appointments.filter(isPending).length;
  const pastCount = appointments.filter(isPast).length;
  
  document.querySelector('#tabAllAppts .pill').textContent = allCount;
  document.querySelector('#tabUpcoming .pill').textContent = upcomingCount;
  document.querySelector('#tabPending .pill').textContent = pendingCount;
  document.querySelector('#tabPast .pill').textContent = pastCount;
}

function populateAppointmentsTable(filter = currentFilter) {
  currentFilter = filter;
  const filtered = filterAppointments(filter);
  const tbody = document.querySelector('#appointmentsTable tbody');
  tbody.innerHTML = '';
  
  filtered.forEach(a => {
    const tr = document.createElement('tr');
    tr.dataset.ref = a.ref || '';

    const tdChk = document.createElement('td'); tdChk.innerHTML = `<input type="checkbox" />`; tr.appendChild(tdChk);

    const initials = (a.fname? a.fname[0] : 'U') + (a.lname? a.lname[0] : '');
    const tdStudent = document.createElement('td');
    tdStudent.innerHTML = `<div class="student-cell"><div class="student-avatar" style="background:linear-gradient(135deg,#7c3aed,#4f46e5)">${initials}</div><div class="stu-meta"><div class="name">${a.fname || ''} ${a.lname || ''}</div><div class="id">${a.studentid || ''}</div></div></div>`;
    tr.appendChild(tdStudent);

    const tdType = document.createElement('td'); tdType.textContent = a.course || ''; tr.appendChild(tdType);
    const tdDT = document.createElement('td'); tdDT.textContent = a.date ? `${a.date} ${a.time || ''}` : ''; tr.appendChild(tdDT);
    const tdCoun = document.createElement('td'); tdCoun.textContent = a.counselor || 'Unassigned'; tr.appendChild(tdCoun);

    const tdPriority = document.createElement('td'); tdPriority.appendChild(createBadge(a.urgency || 'Low')); tr.appendChild(tdPriority);
    const tdStatus = document.createElement('td'); tdStatus.appendChild(createStatus(a.status || 'Pending')); tr.appendChild(tdStatus);

    const tdAction = document.createElement('td'); tdAction.className='actions';
    const viewBtn = document.createElement('button'); viewBtn.className='action-btn'; viewBtn.title='View'; viewBtn.innerHTML='👁️';
    viewBtn.onclick = ()=> alert('Open appointment details for ' + (a.fname || '') + ' ' + (a.lname || ''));
    tdAction.appendChild(viewBtn);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  });
}

/* ---------- Students View ---------- */
function populateStudentsTable() {
  const tbody = document.querySelector('#studentsTable tbody');
  tbody.innerHTML = '';
  students.forEach(s => {
    const tr = document.createElement('tr');

    const tdChk = document.createElement('td'); tdChk.innerHTML = `<input type="checkbox" />`; tr.appendChild(tdChk);

    const tdStudent = document.createElement('td');
    tdStudent.innerHTML = `<div class="student-cell"><div class="student-avatar" style="background:linear-gradient(135deg,#34d399,#10b981)">${s.initials}</div><div class="stu-meta"><div class="name">${s.name}</div><div class="id">${s.id}</div></div></div>`;
    tr.appendChild(tdStudent);

    const tdDept = document.createElement('td'); tdDept.textContent = s.dept; tr.appendChild(tdDept);
    const tdYear = document.createElement('td'); tdYear.textContent = s.year; tr.appendChild(tdYear);

    const tdStatus = document.createElement('td');
    const st = document.createElement('div'); st.className = 'status-pill';
    st.classList.add(s.status === 'Active' ? 'status-approved' : 'status-pending');
    st.textContent = s.status;
    tdStatus.appendChild(st);
    tr.appendChild(tdStatus);

    const tdLast = document.createElement('td'); tdLast.textContent = s.lastAppt; tr.appendChild(tdLast);
    const tdSess = document.createElement('td'); tdSess.textContent = s.sessions; tr.appendChild(tdSess);

    const tdAction = document.createElement('td'); tdAction.className='actions';
    const viewBtn = document.createElement('button'); viewBtn.className='action-btn'; viewBtn.title='View'; viewBtn.innerHTML='👁️';
    const editBtn = document.createElement('button'); editBtn.className='action-btn'; editBtn.title='Edit'; editBtn.innerHTML='✏️';
    tdAction.appendChild(viewBtn); tdAction.appendChild(editBtn);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  });

  // set small stats
  document.getElementById('totalStudents').textContent = stats.totalStudents;
  document.getElementById('activeCases').textContent = stats.activeCases;
  document.getElementById('recentAppointments').textContent = stats.recentAppointments;
  document.getElementById('highPriorityCount').textContent = stats.highPriorityCount;
}

/* ---------- Counselors Table ---------- */
function populateCounselorsTable() {
  const tbody = document.querySelector('#counselorsTable tbody');
  tbody.innerHTML = '';
  counselors.forEach(c => {
    const tr = document.createElement('tr');
    const tdAvatar = document.createElement('td'); tdAvatar.innerHTML = `<div class="student-avatar" style="background:linear-gradient(135deg,#7c3aed,#4f46e5);width:44px;height:44px;border-radius:10px">${c.name.split(' ')[0][0]}${c.name.split(' ')[1] ? c.name.split(' ')[1][0] : ''}</div>`; tr.appendChild(tdAvatar);
    const tdName = document.createElement('td'); tdName.textContent = c.name; tr.appendChild(tdName);
    const tdEmail = document.createElement('td'); tdEmail.textContent = c.email; tr.appendChild(tdEmail);
    const tdStatus = document.createElement('td'); tdStatus.textContent = c.status; tr.appendChild(tdStatus);
    const tdLeave = document.createElement('td'); tdLeave.textContent = c.onLeave ? 'Yes' : 'No'; tr.appendChild(tdLeave);
    const tdActions = document.createElement('td'); tdActions.className='actions'; tdActions.innerHTML = '<button class="action-btn">✏️</button>'; tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}

/* populate counselor options for filters */
function populateFilterCounselors(){
  const sel = document.getElementById('filterCounselor');
  sel.innerHTML = '<option>All Counselors</option>';
  counselors.forEach(c => {
    const opt = document.createElement('option'); opt.textContent = c.name; sel.appendChild(opt);
  });
}

/* ---------- Simple helpers ---------- */
function handleResize() {
  if (window.innerWidth > 1100) sidebar.style.display = 'flex';
  else sidebar.style.display = 'none';
}

/* ---------- Remote data loader ---------- */
async function loadRemoteData(){
  try{
    const res = await fetch('/api/appointments');
    if(!res.ok) throw new Error('failed to fetch appointments');
    const data = await res.json();
    // server returns { appointments: [...] }
    const docs = data.appointments || [];
    // map to local appointments structure
    appointments = docs.map(d => ({
      ref: d.refNumber,
      studentid: d.studentid,
      fname: d.fname,
      lname: d.lname,
      course: d.course,
      date: d.date,
      time: d.time,
      urgency: d.urgency,
      status: d.status || 'Pending',
      counselor: d.counselor || null,
      createdAt: d.createdAt
    }));

    // requests are appointments that are not yet approved/denied.
    // Treat 'booked', 'pending', empty or missing status as pending requests.
    const pendingStatuses = new Set(['pending','requested','']);
    requests = appointments.filter(a => {
      const s = (a.status || '').toString().toLowerCase();
      return pendingStatuses.has(s) || !a.status;
    });

    // students: unique student ids
    const studentMap = new Map();
    appointments.forEach(a => {
      if(a.studentid && !studentMap.has(a.studentid)){
        studentMap.set(a.studentid, { initials: (a.fname? a.fname[0]:'') + (a.lname? a.lname[0]:''), name: `${a.fname} ${a.lname}`, id: a.studentid, lastAppt: a.date, dept: a.course || '' });
      }
    });
    students = Array.from(studentMap.values());

    // counselors list
    const counselorSet = new Set();
    appointments.forEach(a => { if(a.counselor) counselorSet.add(a.counselor); });
    counselors = Array.from(counselorSet).map(name => ({ name, email: '', status: 'Active', onLeave: false }));

    // stats
  stats.totalAppointments = appointments.length;
  stats.pendingRequests = requests.length;
    stats.activeStudents = students.length;
    stats.counselors = counselors.length || 0;
    stats.totalStudents = students.length;
    stats.recentAppointments = Math.min(appointments.length, 20);

  }catch(err){
    console.warn('Remote data load failed, falling back to local samples', err);
    // keep existing sample data if present
  }
}

/* ---------- Init app ---------- */
// initialize app and then start realtime subscription
init().then(() => initRealtime());
/* JavaScript to handle appointments, calendar view, and all other functionalities */

// Realtime updates via Server-Sent Events (SSE)
function initRealtime(){
  if(typeof EventSource === 'undefined') return; // not supported
  try{
    const es = new EventSource('/api/appointments/stream');
    es.addEventListener('appointment', (e) => {
      try{
        const appt = JSON.parse(e.data);
        // prepend to requests table and appointments list
        prependAppointment(appt);
        // only show as request if status is pending/booked
        const s = (appt.status || '').toString().toLowerCase();
        if(!appt.status || s === '' || s === 'pending' || s === 'requested'){
          prependRequest(appt);
          pendingRequestsEl.textContent = Number(pendingRequestsEl.textContent || 0) + 1;
        }
        // update total appointments count and refresh chart
        totalAppointmentsEl.textContent = Number(totalAppointmentsEl.textContent || 0) + 1;
        updatePriorityChart();
        // update calendar if active
        if (currentView === 'calendar' && calendarInstance) {
          calendarInstance.updateAppointments(appointments);
        }
      }catch(err){ console.error('Failed to parse SSE appointment', err); }
    });
    // listen for updates (status/counselor changes)
    es.addEventListener('appointment:update', (e) => {
      try{
        const appt = JSON.parse(e.data);
        applyAppointmentUpdate(appt);
      }catch(err){ console.error('Failed to parse SSE appointment:update', err); }
    });
    es.onerror = (err) => { console.warn('SSE error', err); es.close(); };
  }catch(err){ console.warn('Realtime init failed', err); }
}

function prependRequest(appt){
  const tbody = document.querySelector('#requestsTable tbody');
  // avoid duplicate rows for same ref
  const ref = appt.refNumber || appt.ref || '';
  if(ref){
    const existing = document.querySelector(`#requestsTable tbody tr[data-ref="${ref}"]`);
    if(existing){
      // update status cell
      const statusCell = existing.querySelector('td:nth-child(5)');
      if(statusCell){ statusCell.innerHTML = ''; statusCell.appendChild(createStatus(appt.status || 'Pending')); }
      return existing;
    }
  }
  const tr = document.createElement('tr');
  if(ref) tr.dataset.ref = ref;
  const initials = (appt.fname ? appt.fname[0] : 'U') + (appt.lname ? appt.lname[0] : ' ');
  const studentCell = document.createElement('td');
  studentCell.innerHTML = `<div class="student-cell"><div class="student-avatar" style="background:linear-gradient(135deg,#7c3aed,#4f46e5)">${initials}</div><div class="stu-meta"><div class="name">${appt.fname} ${appt.lname}</div><div class="id">${appt.studentid}</div></div></div>`;
  tr.appendChild(studentCell);
  const tdType = document.createElement('td'); tdType.textContent = appt.course || 'General'; tr.appendChild(tdType);
  const tdDate = document.createElement('td'); tdDate.textContent = appt.date ? new Date(appt.date).toLocaleString() : (appt.date || '—'); tr.appendChild(tdDate);
  const tdPriority = document.createElement('td'); tdPriority.appendChild(createBadge(appt.urgency || 'Low')); tr.appendChild(tdPriority);
  const tdStatus = document.createElement('td'); tdStatus.appendChild(createStatus(appt.status || 'Pending')); tr.appendChild(tdStatus);
  const tdAction = document.createElement('td'); tdAction.className='actions';
  const approveBtn = document.createElement('button'); approveBtn.className='action-btn'; approveBtn.title='Approve'; approveBtn.innerHTML='✔️';
  approveBtn.addEventListener('click', () => handleAdminActionApprove(appt.refNumber || appt.ref, tr));
  const denyBtn = document.createElement('button'); denyBtn.className='action-btn'; denyBtn.title='Deny'; denyBtn.innerHTML='❌';
  denyBtn.addEventListener('click', () => handleAdminActionDeny(appt.refNumber || appt.ref, tr));
  const assignBtn = document.createElement('button'); assignBtn.className='action-btn'; assignBtn.title='Assign'; assignBtn.innerHTML='👤';
  assignBtn.addEventListener('click', () => handleAdminAssign(appt.refNumber || appt.ref, tr));
  tdAction.appendChild(approveBtn); tdAction.appendChild(denyBtn); tdAction.appendChild(assignBtn);
  tr.appendChild(tdAction);
  tbody.insertBefore(tr, tbody.firstChild);
}

function prependAppointment(appt){
  // add to appointments table in appointments view
  const tbody = document.querySelector('#appointmentsTable tbody');
  if(!tbody) return;
  const ref = appt.refNumber || appt.ref || '';
  if(ref){
    const existing = document.querySelector(`#appointmentsTable tbody tr[data-ref="${ref}"]`);
    if(existing) return existing;
  }
  const tr = document.createElement('tr');
  if(ref) tr.dataset.ref = ref;
  tr.innerHTML = `<td><input type="checkbox" /></td>
    <td><div class="student-cell"><div class="student-avatar" style="background:linear-gradient(135deg,#7c3aed,#4f46e5)">${(appt.fname?appt.fname[0]:'U')}${(appt.lname?appt.lname[0]:'')}</div><div class="stu-meta"><div class="name">${appt.fname} ${appt.lname}</div><div class="id">${appt.studentid}</div></div></div></td>
    <td>${appt.course || 'General'}</td>
    <td>${appt.date || ''} ${appt.time || ''}</td>
    <td>Unassigned</td>
    <td></td>
    <td>${appt.urgency || 'Low'}</td>
    <td><button class="action-btn">👁️</button></td>`;
  tbody.insertBefore(tr, tbody.firstChild);
}

/* ---------- Admin actions (approve/deny/assign) ---------- */
async function updateAppointment(ref, payload){
  if(!ref) return null;
  try{
    const res = await fetch(`/api/appointments/${encodeURIComponent(ref)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('update failed');
    return await res.json();
  }catch(err){ console.error('updateAppointment error', err); alert('Failed to update appointment'); return null; }
}

function handleAdminActionApprove(ref, tr){
  if(!ref){ alert('No reference available'); return; }
  if(!confirm('Approve this appointment?')) return;
  updateAppointment(ref, { status: 'Approved' }).then(result => {
    if(result && result.appointment){ applyAppointmentUpdate(result.appointment); }
  });
}

function handleAdminActionDeny(ref, tr){
  if(!ref){ alert('No reference available'); return; }
  if(!confirm('Deny this appointment?')) return;
  updateAppointment(ref, { status: 'Denied' }).then(result => {
    if(result && result.appointment){ applyAppointmentUpdate(result.appointment); }
  });
}

function handleAdminAssign(ref, tr){
  if(!ref){ alert('No reference available'); return; }
  const name = prompt('Assign counselor (enter name)');
  if(!name) return;
  updateAppointment(ref, { counselor: name }).then(result => {
    if(result && result.appointment){ applyAppointmentUpdate(result.appointment); }
  });
}

function applyAppointmentUpdate(appt){
  if(!appt || !appt.refNumber) return;
  const ref = appt.refNumber;
  const status = (appt.status || '').toString();
  const statusLower = status.toLowerCase();

  // update requests table row: if approved/denied remove from requests; otherwise update/insert
  const reqRow = document.querySelector(`#requestsTable tbody tr[data-ref="${ref}"]`);
  if(statusLower === 'approved' || statusLower === 'denied' || statusLower === 'booked'){
    if(reqRow){ reqRow.remove(); }
    // decrement pending count if visible
    const cur = Number(pendingRequestsEl.textContent || 0);
    pendingRequestsEl.textContent = Math.max(0, cur - 1);
  }else{
    // still pending: update status cell or add row if missing
    if(reqRow){
      const statusCell = reqRow.querySelector('td:nth-child(5)');
      if(statusCell){ statusCell.innerHTML = ''; statusCell.appendChild(createStatus(appt.status || 'Pending')); }
    }else{
      // insert as new pending request at top
      prependRequest(appt);
      pendingRequestsEl.textContent = Number(pendingRequestsEl.textContent || 0) + 1;
    }
  }

  // update appointments table row (details)
  const apptRow = document.querySelector(`#appointmentsTable tbody tr[data-ref="${ref}"]`);
  if(apptRow){
    const cols = apptRow.querySelectorAll('td');
    if(cols[4]) cols[4].textContent = appt.counselor || 'Unassigned';
    if(cols[6]) cols[6].textContent = appt.urgency || '';
    // update status column if present (col 5 or 6 depending on table structure)
    // attempt to find a status cell and update it
    const statusCell = apptRow.querySelector('td:nth-child(7)');
    if(statusCell){ statusCell.innerHTML = ''; statusCell.appendChild(createStatus(appt.status || 'Pending')); }
    
    // refresh chart if urgency changed since that affects priority distribution
    if('urgency' in appt) updatePriorityChart();
  }
}

// start realtime after init finished
initRealtime();

