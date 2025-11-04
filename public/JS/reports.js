/* Reports & Analytics Module */

// Create mock data for testing
function createMockData() {
  const now = new Date();
  const currentYear = now.getFullYear();
  return Array.from({length: 12}, (_, i) => {
    const date = new Date(currentYear, i, 15);
    const count = Math.floor(Math.random() * 50) + 10;
    return Array.from({length: count}, () => ({
      date: date.toISOString(),
      urgency: ['Crisis', 'High', 'Medium', 'Low'][Math.floor(Math.random() * 4)]
    }));
  }).flat();
}

// Function to check if Chart.js is loaded
function waitForChartJs() {
  return new Promise((resolve, reject) => {
    const maxAttempts = 50;
    let attempts = 0;
    
    const checkChart = () => {
      if (typeof Chart !== 'undefined') {
        console.log('Chart.js is loaded');
        resolve();
      } else if (attempts >= maxAttempts) {
        reject(new Error('Chart.js failed to load'));
      } else {
        attempts++;
        console.log('Waiting for Chart.js...', attempts);
        setTimeout(checkChart, 100);
      }
    };
    checkChart();
  });
}

const URGENCY_COLORS = {
  'Crisis': { 
    line: '#dc2626',
    fill: 'rgba(220, 38, 38, 0.1)',
    hover: 'rgba(220, 38, 38, 0.2)'
  },
  'High': { 
    line: '#ea580c',
    fill: 'rgba(234, 88, 12, 0.1)',
    hover: 'rgba(234, 88, 12, 0.2)'
  },
  'Medium': { 
    line: '#ca8a04',
    fill: 'rgba(202, 138, 4, 0.1)',
    hover: 'rgba(202, 138, 4, 0.2)'
  },
  'Low': { 
    line: '#2563eb',
    fill: 'rgba(37, 99, 235, 0.1)',
    hover: 'rgba(37, 99, 235, 0.2)'
  }
};

// Reference to chart instances
let monthlyBarChart = null;
let urgencyLineChart = null;
// Local copy of appointments used by reports module
let reportsAppointments = [];
let reportsWatcherInterval = null;

// Prepare monthly data slots
function getMonthlySlots(year) {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i,
    label: new Date(year, i).toLocaleString('default', { month: 'short' }),
    total: 0,
    urgencies: {
      Crisis: 0,
      High: 0,
      Medium: 0,
      Low: 0
    }
  }));
}

// Process appointments data for charts
function prepareReportData(appointments) {
  const currentYear = new Date().getFullYear();
  const months = getMonthlySlots(currentYear);
  
  appointments.forEach(appt => {
    const date = new Date(appt.date);
    if (date.getFullYear() !== currentYear) return;
    
    const month = date.getMonth();
    months[month].total++;
    
    const urgency = (appt.urgency || '').toString();
    if (urgency.includes('Crisis')) months[month].urgencies.Crisis++;
    else if (urgency.includes('High')) months[month].urgencies.High++;
    else if (urgency.includes('Medium')) months[month].urgencies.Medium++;
    else months[month].urgencies.Low++;
  });
  
  return months;
}

// Animate number counting up
function animateNumber(elementId, target) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const start = parseInt(element.textContent.replace(/[^0-9.-]+/g, '')) || 0;
  const duration = 1000;
  const steps = 60;
  const step = (target - start) / steps;
  
  let current = start;
  const updateNumber = () => {
    current += step;
    if ((step > 0 && current >= target) || (step < 0 && current <= target)) {
      element.textContent = target;
    } else {
      element.textContent = Math.round(current);
      requestAnimationFrame(updateNumber);
    }
  };
  requestAnimationFrame(updateNumber);
}

async function initCharts(appointments) {
  try {
    await waitForChartJs();
    
    // Configure Chart.js defaults
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.color = '#64748b';
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.backgroundColor = '#1e293b';
    Chart.defaults.plugins.tooltip.titleColor = '#f8fafc';
    Chart.defaults.plugins.tooltip.bodyColor = '#f8fafc';
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.displayColors = true;
    Chart.defaults.plugins.tooltip.intersect = false;
    Chart.defaults.plugins.tooltip.mode = 'index';
    
    // Get canvas contexts
    const barCanvas = document.getElementById('monthlyBarChart');
    const lineCanvas = document.getElementById('urgencyLineChart');

    if (!barCanvas || !lineCanvas) {
      console.warn('Chart canvases not found');
      return;
    }

    // Clean up existing charts
    if (monthlyBarChart) monthlyBarChart.destroy();
    if (urgencyLineChart) urgencyLineChart.destroy();

    // Prepare data
    const months = prepareReportData(appointments);
    const labels = months.map(m => m.label);

    // Update summary statistics with animation
    const monthCount = months[new Date().getMonth()]?.total || 0;
    const avgSessions = Math.round(appointments.length / 12 * 10) / 10;

    animateNumber('reportMonthCount', monthCount);
    animateNumber('reportAvgSession', avgSessions);

    // Create monthly bar chart
    monthlyBarChart = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total Appointments',
          data: months.map(m => m.total),
          backgroundColor: '#4f46e5',
          hoverBackgroundColor: '#6366f1',
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.parsed.y} appointments`
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: '#f1f5f9'
            }
          }
        }
      }
    });

    // Create urgency line chart datasets
    const urgencyDatasets = Object.entries(URGENCY_COLORS).map(([urgency, colors]) => ({
      label: urgency,
      data: months.map(m => m.urgencies[urgency]),
      borderColor: colors.line,
      backgroundColor: colors.fill,
      hoverBackgroundColor: colors.hover,
      fill: true,
      tension: 0.4
    }));

    // Create urgency line chart
    urgencyLineChart = new Chart(lineCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: urgencyDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'center',
            labels: {
              boxWidth: 12,
              usePointStyle: true,
              padding: 20
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            stacked: false,
            grid: {
              color: '#f1f5f9'
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to initialize charts:', error);
  }
}

// Update existing charts with new appointment data (or create them if missing)
async function updateCharts(appointments) {
  // ensure Chart.js loaded
  try { await waitForChartJs(); } catch(e){ console.warn('Chart.js not available for update', e); return; }

  // normalize months and labels
  const months = prepareReportData(appointments);
  const labels = months.map(m => m.label);

  // summary
  const monthCount = months[new Date().getMonth()]?.total || 0;
  const avgSessions = Math.round(appointments.length / 12 * 10) / 10;
  animateNumber('reportMonthCount', monthCount);
  animateNumber('reportAvgSession', avgSessions);

  // Update or create bar chart
  if (monthlyBarChart) {
    monthlyBarChart.data.labels = labels;
    monthlyBarChart.data.datasets[0].data = months.map(m => m.total);
    monthlyBarChart.update();
  } else {
    await initCharts(appointments);
    return;
  }

  // Update line chart datasets
  if (urgencyLineChart) {
    urgencyLineChart.data.labels = labels;
    const urgencyDatas = Object.keys(URGENCY_COLORS);
    urgencyDatas.forEach((u, idx) => {
      if (urgencyLineChart.data.datasets[idx]) {
        urgencyLineChart.data.datasets[idx].data = months.map(m => m.urgencies[u]);
      }
    });
    urgencyLineChart.update();
  }
}

// Fetch aggregated monthly report data from server (preferred) with optional filters
async function fetchAggregatedReports(filters = {}){
  const year = filters.year || new Date().getFullYear();
  const params = new URLSearchParams();
  params.set('year', String(year));
  if(filters.from) params.set('from', filters.from);
  if(filters.to) params.set('to', filters.to);
  if(filters.counselor && filters.counselor !== 'All Counselors') params.set('counselor', filters.counselor);
  if(filters.priority && filters.priority !== 'All Priorities') params.set('priority', filters.priority);

  try{
    const res = await fetch('/api/reports/monthly?' + params.toString());
    if(!res.ok) throw new Error('failed to fetch aggregated reports');
    const data = await res.json();
    // expect { year, months: [{month:0,label:'Jan',total:...,urgencies:{...}}, ...] }
    return data.months || [];
  }catch(err){
    console.warn('Aggregated reports fetch failed, falling back to client aggregation', err);
    // Fallback: prepare from available appointments
    const source = (window.appointments && window.appointments.length) ? window.appointments : reportsAppointments;
    return prepareReportData(source);
  }
}

// Render charts from server-provided months array
async function renderChartsFromMonths(months){
  try{ await waitForChartJs(); }catch(e){ console.warn('Chart.js not ready for render', e); return; }

  const labels = months.map(m => m.label);
  const totals = months.map(m => m.total || 0);

  // Update stats
  const monthCount = months[new Date().getMonth()]?.total || 0;
  const avgSessions = Math.round((totals.reduce((s,n)=>s+n,0) / 12) * 10) / 10;
  animateNumber('reportMonthCount', monthCount);
  animateNumber('reportAvgSession', avgSessions);

  const barCanvas = document.getElementById('monthlyBarChart');
  const lineCanvas = document.getElementById('urgencyLineChart');
  if(!barCanvas || !lineCanvas) return;

  // Create or update bar chart
  if(monthlyBarChart){
    monthlyBarChart.data.labels = labels;
    monthlyBarChart.data.datasets[0].data = totals;
    monthlyBarChart.update();
  } else {
    monthlyBarChart = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Total Appointments', data: totals, backgroundColor: '#4f46e5', borderRadius:6, borderSkipped:false }]
      },
      options: {
        responsive: true, maintainAspectRatio:false,
        plugins: { legend:{ display:false }},
        scales: { x:{ grid:{ display:false } }, y:{ beginAtZero:true, grid:{ color:'#f1f5f9' } } }
      }
    });
  }

  // Prepare urgency datasets
  const urgencyDatasets = Object.entries(URGENCY_COLORS).map(([urgency, colors]) => ({
    label: urgency,
    data: months.map(m => (m.urgencies && m.urgencies[urgency]) ? m.urgencies[urgency] : 0),
    borderColor: colors.line,
    backgroundColor: colors.fill,
    fill: true,
    tension: 0.4
  }));

  if(urgencyLineChart){
    urgencyLineChart.data.labels = labels;
    urgencyLineChart.data.datasets = urgencyDatasets;
    urgencyLineChart.update();
  } else {
    urgencyLineChart = new Chart(lineCanvas, {
      type: 'line',
      data: { labels, datasets: urgencyDatasets },
      options: {
        responsive:true, maintainAspectRatio:false,
        interaction:{ intersect:false, mode:'index' },
        plugins:{ legend:{ position:'top', align:'center' } },
        scales:{ x:{ grid:{ display:false } }, y:{ beginAtZero:true, grid:{ color:'#f1f5f9' } } }
      }
    });
  }
}

// Initialize and render reports with animations
async function initReports() {
  console.log('Initializing reports...');

  // Ensure Reports view is visible
  const reportsView = document.getElementById('view-reports');
  if (!reportsView || reportsView.classList.contains('hidden')) {
    console.log('Reports view is hidden, skipping render');
    return;
  }

  // Fetch aggregated monthly data from server (most accurate for large datasets)
  const initialFilters = getReportFilters();
  const months = await fetchAggregatedReports({ year: new Date().getFullYear(), from: initialFilters.from, to: initialFilters.to, counselor: initialFilters.counselor, priority: initialFilters.priority });
  // Render charts from aggregated months
  await renderChartsFromMonths(months);

  // Wire filters and realtime after initial render
  setupReportFilters();
  initReportsRealtime();
  // keep watcher so if admin_dashboard updates window.appointments we can fallback to client refresh
  startWindowAppointmentsWatcher();
}

// Function to initialize reports on view change
function initReportsOnView() {
  console.log('Setting up reports view observer...');
  
  // Watch for navigation clicks
  const reportsNav = document.querySelector('[data-view="reports"]');
  if (reportsNav) {
    reportsNav.addEventListener('click', () => {
      console.log('Reports nav clicked');
      setTimeout(initReports, 100);
    });
  }

  // Setup mutation observer to watch for view changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const reportsView = document.getElementById('view-reports');
        if (reportsView && !reportsView.classList.contains('hidden')) {
          console.log('Reports view shown, initializing...');
          setTimeout(initReports, 100);
        }
      }
    });
  });

  // Watch for changes to reports view
  const reportsView = document.getElementById('view-reports');
  if (reportsView) {
    observer.observe(reportsView, { attributes: true });
    if (!reportsView.classList.contains('hidden')) {
      console.log('Reports view active on load, initializing...');
      setTimeout(initReports, 100);
    }
  }
}

// Read current filter values from DOM
function getReportFilters(){
  const priority = document.getElementById('filterPriority')?.value || 'All Priorities';
  const counselor = document.getElementById('filterCounselor')?.value || 'All Counselors';
  const from = document.getElementById('rangeFrom')?.value || '';
  const to = document.getElementById('rangeTo')?.value || '';
  return { priority, counselor, from, to };
}

// Filter appointment list by selected filters
function applyFiltersToAppointments(appts, filters){
  let list = Array.isArray(appts) ? appts.slice() : [];
  if(filters.priority && filters.priority !== 'All Priorities'){
    list = list.filter(a => ((a.urgency||'').toString() === filters.priority));
  }
  if(filters.counselor && filters.counselor !== 'All Counselors'){
    list = list.filter(a => (a.counselor || '') === filters.counselor);
  }
  if(filters.from){
    const fromDate = new Date(filters.from);
    list = list.filter(a => { try{ return new Date(a.date) >= fromDate; }catch(e){ return false; } });
  }
  if(filters.to){
    const toDate = new Date(filters.to);
    list = list.filter(a => { try{ return new Date(a.date) <= toDate; }catch(e){ return false; } });
  }
  return list;
}

// Refresh charts using current window.appointments (or local copy)
function refreshReports(){
  const filters = getReportFilters();
  let source = Array.isArray(window.appointments) && window.appointments.length>0 ? window.appointments : reportsAppointments;
  let filtered = applyFiltersToAppointments(source, filters);
  // ensure dates are valid ISO strings where possible
  filtered = filtered.map(f => ({ ...f }));
  // update charts
  updateCharts(filtered);
}

// Setup listeners on the filter controls
function setupReportFilters(){
  ['filterPriority','filterCounselor','rangeFrom','rangeTo'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('change', () => {
      // small debounce
      if(window._reportsFilterTimeout) clearTimeout(window._reportsFilterTimeout);
      window._reportsFilterTimeout = setTimeout(() => { refreshReports(); }, 180);
    });
  });
}

// Realtime via SSE for reports module — merge incoming appointments and refresh charts
function initReportsRealtime(){
  if(typeof EventSource === 'undefined') return;
  try{
    const es = new EventSource('/api/appointments/stream');
    es.addEventListener('appointment', (e) => {
      try{
        const appt = JSON.parse(e.data);
        // normalize and merge: avoid duplicates by ref
        const ref = appt.refNumber || appt.ref || '';
        if(ref){
          const idx = reportsAppointments.findIndex(a => (a.ref || a.refNumber) === ref);
          const norm = { ...appt };
          if(idx === -1) reportsAppointments.unshift(norm);
          else reportsAppointments[idx] = { ...reportsAppointments[idx], ...norm };
        }else{
          reportsAppointments.unshift({ ...appt });
        }
        // also sync global if possible
        try{ window.appointments = reportsAppointments; }catch(e){}
        refreshReports();
      }catch(err){ console.error('Failed to parse SSE appointment in reports', err); }
    });
    es.addEventListener('appointment:update', (e) => {
      try{
        const appt = JSON.parse(e.data);
        const ref = appt.refNumber || appt.ref || '';
        if(ref){
          const idx = reportsAppointments.findIndex(a => (a.ref || a.refNumber) === ref);
          if(idx !== -1) reportsAppointments[idx] = { ...reportsAppointments[idx], ...appt };
        }
        try{ window.appointments = reportsAppointments; }catch(e){}
        refreshReports();
      }catch(err){ console.error('Failed to parse SSE appointment:update in reports', err); }
    });
    es.onerror = (err) => { console.warn('Reports SSE error', err); es.close(); };
  }catch(err){ console.warn('Reports realtime init failed', err); }
}

// Watch for other modules updating window.appointments (admin_dashboard.js) and refresh charts
function startWindowAppointmentsWatcher(){
  if(reportsWatcherInterval) return;
  let lastLen = (window.appointments && window.appointments.length) || reportsAppointments.length || 0;
  reportsWatcherInterval = setInterval(() => {
    const cur = (window.appointments && window.appointments.length) || reportsAppointments.length || 0;
    if(cur !== lastLen){
      lastLen = cur;
      reportsAppointments = (window.appointments && window.appointments.slice()) || reportsAppointments;
      refreshReports();
    }
  }, 1000);
}

// Export functions for use in admin_dashboard.js
window.initReports = initReports;
window.initReportsOnView = initReportsOnView;

// Initialize when the document is ready
document.addEventListener('DOMContentLoaded', initReportsOnView);