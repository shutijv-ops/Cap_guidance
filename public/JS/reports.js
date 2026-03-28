/* Reports & Analytics Module */
console.log('[REPORTS.JS] Script loaded');

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

// TEST FUNCTION: Force render charts with test data (for debugging)
async function testCharts() {
  console.log('=== TESTING CHARTS ===');
  
  // Wait for Chart.js
  try { await waitForChartJs(); } catch(e) { console.error('Chart.js not available', e); return; }
  
  // Create test months data
  const testMonths = getMonthlySlots(new Date().getFullYear());
  testMonths[1].total = 2; // Feb = 2
  testMonths[1].urgencies = { Crisis: 0, High: 1, Medium: 1, Low: 0 };
  
  console.log('Test data:', testMonths);
  
  // Get canvases
  const barCanvas = document.getElementById('monthlyBarChart');
  const lineCanvas = document.getElementById('urgencyLineChart');
  console.log('Canvases found:', { bar: !!barCanvas, line: !!lineCanvas });
  
  if (!barCanvas || !lineCanvas) {
    console.error('Canvases not found in DOM');
    return;
  }
  
  // Destroy existing charts
  if (monthlyBarChart) {
    monthlyBarChart.destroy();
    monthlyBarChart = null;
  }
  if (urgencyLineChart) {
    urgencyLineChart.destroy();
    urgencyLineChart = null;
  }
  
  // Set fixed dimensions
  barCanvas.setAttribute('width', '550');
  barCanvas.setAttribute('height', '250');
  lineCanvas.setAttribute('width', '550');
  lineCanvas.setAttribute('height', '250');
  
  console.log('Canvas dimensions set');
  
  // Create bar chart with test data
  try {
    const labels = testMonths.map(m => m.label);
    const totals = testMonths.map(m => m.total || 0);
    
    monthlyBarChart = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ 
          label: 'Total Appointments', 
          data: totals, 
          backgroundColor: '#4f46e5',
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { 
          x: { grid: { display: false } }, 
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } } 
        }
      }
    });
    console.log('✅ Bar chart created');
  } catch(e) {
    console.error('❌ Bar chart error:', e);
    return;
  }
  
  // Create line chart with test data
  try {
    const labels = testMonths.map(m => m.label);
    const urgencyDatasets = Object.entries(URGENCY_COLORS).map(([urgency, colors]) => ({
      label: urgency,
      data: testMonths.map(m => (m.urgencies && m.urgencies[urgency]) ? m.urgencies[urgency] : 0),
      borderColor: colors.line,
      backgroundColor: colors.fill,
      fill: true,
      tension: 0.4
    }));
    
    urgencyLineChart = new Chart(lineCanvas, {
      type: 'line',
      data: { labels, datasets: urgencyDatasets },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { position: 'top', align: 'center' } },
        scales: { 
          x: { grid: { display: false } }, 
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } } 
        }
      }
    });
    console.log('✅ Line chart created');
  } catch(e) {
    console.error('❌ Line chart error:', e);
    return;
  }
  
  console.log('=== TEST COMPLETE ===');
}

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

// Configure Chart.js defaults (called once)
async function configureChartDefaults() {
  try {
    await waitForChartJs();
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
  } catch (error) {
    console.warn('Failed to configure Chart.js defaults:', error);
  }
}

// Update charts using new server-based monthly data (called when filters change)
async function updateCharts(appointments) {
  console.log('updateCharts called with appointments:', appointments.length);
  // Use new approach: fetch from server with filters
  const filters = getReportFilters();
  const months = await fetchAggregatedReports(filters);
  await renderChartsFromMonths(months);
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
    console.log('Fetched aggregated reports:', data);
    
    // Also fetch actual appointments to populate reportsAppointments for printReport
    try {
      const apptRes = await fetch('/api/appointments');
      if(apptRes.ok){
        const apptData = await apptRes.json();
        reportsAppointments = Array.isArray(apptData) ? apptData : (apptData.appointments || []);
        window.appointments = reportsAppointments;
        console.log('Loaded appointments:', reportsAppointments.length);
      }
    } catch(e) {
      console.warn('Could not fetch appointments for reports', e);
    }
    
    // expect { year, months: [{month:0,label:'Jan',total:...,urgencies:{...}}, ...] }
    const months = data.months || [];
    console.log('Months data to return:', months);
    return months;
  }catch(err){
    console.warn('Aggregated reports fetch failed, falling back to client aggregation', err);
    // Fallback: prepare from available appointments
    const source = (window.appointments && window.appointments.length) ? window.appointments : reportsAppointments;
    return prepareReportData(source);
  }
}

// NEW: Render professional monthly and urgency charts
async function renderChartsFromMonths(months) {
  console.log('[CHARTS] Starting render');
  
  // Ensure Chart.js is loaded
  await waitForChartJs();
  console.log('[CHARTS] Chart.js ready');

  // Get canvases
  const barCanvas = document.getElementById('monthlyBarChart');
  const lineCanvas = document.getElementById('urgencyLineChart');
  
  console.log('[CHARTS] Looking for canvases:', { bar: !!barCanvas, line: !!lineCanvas });
  
  if (!barCanvas || !lineCanvas) {
    console.error('[CHARTS] ❌ Canvas not found');
    return;
  }

  // Fallback data
  if (!months || months.length === 0) {
    months = getMonthlySlots(new Date().getFullYear());
  }

  const labels = months.map(m => m.label);
  const totals = months.map(m => m.total || 0);

  // Update stats
  const monthCount = months[new Date().getMonth()]?.total || 0;
  const avgSessions = Math.round((totals.reduce((s, n) => s + n, 0) / 12) * 10) / 10;
  animateNumber('reportMonthCount', monthCount);
  animateNumber('reportAvgSession', avgSessions);

  // Destroy old charts
  if (window.monthlyBarChart) {
    window.monthlyBarChart.destroy();
    window.monthlyBarChart = null;
  }
  if (window.urgencyLineChart) {
    window.urgencyLineChart.destroy();
    window.urgencyLineChart = null;
  }

  console.log('[CHARTS] Creating bar chart with data:', totals);

  // Bar chart
  window.monthlyBarChart = new Chart(barCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Total Appointments',
        data: totals,
        backgroundColor: '#4f46e5',
        borderRadius: 8,
        hoverBackgroundColor: '#4338ca'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          padding: 12,
          cornerRadius: 8
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: '#e2e8f0' } }
      }
    }
  });
  console.log('[CHARTS] ✅ Bar chart created');

  // Line chart
  const urgencyDatasets = Object.entries(URGENCY_COLORS).map(([urgency, colors]) => ({
    label: urgency,
    data: months.map(m => m.urgencies?.[urgency] || 0),
    borderColor: colors.line,
    backgroundColor: colors.fill,
    borderWidth: 2,
    fill: true,
    tension: 0.35
  }));

  console.log('[CHARTS] Creating line chart');

  window.urgencyLineChart = new Chart(lineCanvas, {
    type: 'line',
    data: { labels, datasets: urgencyDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 14, usePointStyle: true, padding: 16 }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: '#e2e8f0' } }
      }
    }
  });
  console.log('[CHARTS] ✅ Line chart created');

  // Store globally
  monthlyBarChart = window.monthlyBarChart;
  urgencyLineChart = window.urgencyLineChart;

  console.log('[CHARTS] ✅ All done');
}
}

// Initialize and render reports with animations
async function initReports() {
  console.log('[INIT] Initializing reports...');

  // Configure Chart.js defaults (do once)
  await configureChartDefaults();

  // Ensure Reports view is visible
  const reportsView = document.getElementById('view-reports');
  if (!reportsView || reportsView.classList.contains('hidden')) {
    console.log('[INIT] Reports view is hidden, skipping render');
    return;
  }

  console.log('[INIT] Reports view is visible');

  // Add delay to ensure DOM is fully rendered and canvas has dimensions
  await new Promise(resolve => setTimeout(resolve, 300));

  // TEST: Render empty months immediately to test Chart.js
  console.log('[INIT] Testing Chart.js with empty data...');
  const testMonths = getMonthlySlots(new Date().getFullYear());
  try {
    await renderChartsFromMonths(testMonths);
    console.log('[INIT] ✅ Test render succeeded');
  } catch(err) {
    console.error('[INIT] ❌ Test render failed:', err);
  }

  // Then try to fetch real data
  try {
    console.log('[INIT] Fetching real data...');
    const initialFilters = getReportFilters();
    let months = await fetchAggregatedReports({ 
      year: new Date().getFullYear(), 
      from: initialFilters.from, 
      to: initialFilters.to, 
      counselor: initialFilters.counselor, 
      priority: initialFilters.priority 
    });
    
    if (months && months.length > 0) {
      console.log('[INIT] Got real data, re-rendering...');
      await renderChartsFromMonths(months);
    } else {
      console.log('[INIT] No real data, keeping test render');
    }
  } catch(err) {
    console.error('[INIT] Error fetching real data:', err);
  }

  // Wire filters and realtime after initial render
  try {
    setupReportFilters();
    initReportsRealtime();
    startWindowAppointmentsWatcher();
  } catch(err) {
    console.warn('[INIT] Error setting up report filters/realtime:', err);
  }

  console.log('[INIT] ✅ Complete');
}
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

// ========== PRINT REPORT FUNCTIONALITY ==========
function printReport() {
  // Get statistics
  const monthCount = document.getElementById('reportMonthCount')?.textContent || 0;
  const avgSession = document.getElementById('reportAvgSession')?.textContent || 0;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US');
  
  // Get chart images from Chart.js instances
  let barChartImage = '';
  let lineChartImage = '';
  
  try {
    // Access Chart.js chart instances if they exist
    if (window.monthlyChart && window.monthlyChart.canvas) {
      barChartImage = window.monthlyChart.canvas.toDataURL('image/png');
    }
    if (window.urgencyChart && window.urgencyChart.canvas) {
      lineChartImage = window.urgencyChart.canvas.toDataURL('image/png');
    }
  } catch (e) {
    console.warn('Could not capture charts:', e);
  }
  
  // Get appointment data - use reportsAppointments (populated by the reports module)
  const source = (reportsAppointments && reportsAppointments.length > 0) ? reportsAppointments : [];
  
  // Process the data to get monthly breakdown with current year
  const currentYear = new Date().getFullYear();
  const months = getMonthlySlots(currentYear);
  
  // Populate months with appointment data
  source.forEach(appt => {
    try {
      const date = new Date(appt.date);
      if (date.getFullYear() !== currentYear) return;
      
      const month = date.getMonth();
      months[month].total++;
      
      const urgency = (appt.urgency || '').toString();
      if (urgency.includes('Crisis')) months[month].urgencies.Crisis++;
      else if (urgency.includes('High')) months[month].urgencies.High++;
      else if (urgency.includes('Medium')) months[month].urgencies.Medium++;
      else months[month].urgencies.Low++;
    } catch(e) {
      console.warn('Error processing appointment:', appt, e);
    }
  });
  
  // Calculate totals for key metrics
  const totalAppointments = source.length;
  const crisisCount = source.filter(a => (a.urgency || '').includes('Crisis')).length;
  const highCount = source.filter(a => (a.urgency || '').includes('High')).length;
  const mediumCount = source.filter(a => (a.urgency || '').includes('Medium')).length;
  const lowCount = source.filter(a => !(a.urgency || '').includes('Crisis') && !(a.urgency || '').includes('High') && !(a.urgency || '').includes('Medium')).length;
  
  let crisisPercent = 0, highPercent = 0, mediumPercent = 0, lowPercent = 0;
  if (totalAppointments > 0) {
    // compute raw percentages
    const rawC = (crisisCount / totalAppointments) * 100;
    const rawH = (highCount / totalAppointments) * 100;
    const rawM = (mediumCount / totalAppointments) * 100;
    // round first three to 2 decimals for display
    const c = Number(rawC.toFixed(2));
    const h = Number(rawH.toFixed(2));
    const m = Number(rawM.toFixed(2));
    // compute low as the remaining to ensure displayed percentages sum to 100.00
    let l = 100 - (c + h + m);
    // clamp small floating errors
    if (l < 0 && l > -0.01) l = 0;
    if (l > 100) l = 100;
    // format to 2 decimals
    crisisPercent = c.toFixed(2);
    highPercent = h.toFixed(2);
    mediumPercent = m.toFixed(2);
    lowPercent = l.toFixed(2);
  }
  
  // Build HTML for PDF
  const reportContent = `
    <div id="reportPDF" style="font-family: 'Arial', sans-serif; color: #1f2937; line-height: 1.6; background: #fff; padding: 20px;">
      <div style="max-width: 900px; margin: 0 auto;">
        <!-- Header -->
        <div style="border-bottom: 3px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #0a2342; font-size: 2.5em; margin: 0 0 10px 0;">📊 Appointments Report</h1>
          <div style="display: flex; gap: 20px; font-size: 0.9em; color: #6b7280;">
            <div><strong>Generated:</strong> ${dateStr} ${timeStr}</div>
            <div><strong>System:</strong> JRMSU Guidance Office</div>
          </div>
        </div>

        <!-- Stats -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
          <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #4f46e5;">
            <div style="font-size: 0.9em; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">This Month</div>
            <div style="font-size: 2em; font-weight: 700; color: #0a2342;">${monthCount}</div>
          </div>
          <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #4f46e5;">
            <div style="font-size: 0.9em; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Avg. Sessions / Month</div>
            <div style="font-size: 2em; font-weight: 700; color: #0a2342;">${avgSession}</div>
          </div>
        </div>

        <!-- Monthly Chart -->
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h2 style="font-size: 1.5em; color: #0a2342; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin: 0 0 20px 0; font-weight: 700;">Monthly Appointments Trend</h2>
          <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 20px; text-align: center;">
            ${barChartImage ? `<img src="${barChartImage}" alt="Monthly Appointments Chart" style="max-width: 100%; height: auto; max-height: 300px;">` : '<p style="color: #6b7280;">Bar chart showing total appointments for each month over the past 12 months.</p>'}
          </div>
          <p style="font-size: 0.85em; color: #6b7280;">Bar chart showing total appointments for each month over the past 12 months.</p>
        </div>

        <!-- Urgency Chart -->
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h2 style="font-size: 1.5em; color: #0a2342; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin: 0 0 20px 0; font-weight: 700;">Urgency Trend Analysis</h2>
          <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 20px; text-align: center;">
            ${lineChartImage ? `<img src="${lineChartImage}" alt="Urgency Trend Chart" style="max-width: 100%; height: auto; max-height: 300px;">` : '<p style="color: #6b7280;">Line chart showing the trend of Crisis, High, Medium, and Low urgency appointments over the past 12 months.</p>'}
          </div>
          <p style="font-size: 0.85em; color: #6b7280;">Line chart showing the trend of Crisis, High, Medium, and Low urgency appointments over the past 12 months.</p>
        </div>

        <!-- Data Table -->
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h2 style="font-size: 1.5em; color: #0a2342; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin: 0 0 20px 0; font-weight: 700;">Monthly Data Summary</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9em; background: #fff;">
            <thead>
              <tr>
                <th style="background: #4f46e5; color: #fff; padding: 12px; text-align: left; font-weight: 600;">Month</th>
                <th style="background: #4f46e5; color: #fff; padding: 12px; text-align: left; font-weight: 600;">Total</th>
                <th style="background: #4f46e5; color: #fff; padding: 12px; text-align: left; font-weight: 600;">Crisis</th>
                <th style="background: #4f46e5; color: #fff; padding: 12px; text-align: left; font-weight: 600;">High</th>
                <th style="background: #4f46e5; color: #fff; padding: 12px; text-align: left; font-weight: 600;">Medium</th>
                <th style="background: #4f46e5; color: #fff; padding: 12px; text-align: left; font-weight: 600;">Low</th>
              </tr>
            </thead>
            <tbody>
              ${months.map((m, idx) => {
                const bgColor = idx % 2 === 0 ? '#fff' : '#f9fafb';
                return `<tr style="background: ${bgColor};">
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>${m.label}</strong></td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${m.total || 0}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${m.urgencies.Crisis || 0}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${m.urgencies.High || 0}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${m.urgencies.Medium || 0}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${m.urgencies.Low || 0}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Key Metrics -->
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h2 style="font-size: 1.5em; color: #0a2342; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin: 0 0 20px 0; font-weight: 700;">Key Metrics</h2>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #4f46e5;">
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="margin-bottom: 10px;"><strong>Total Appointments:</strong> ${totalAppointments}</li>
              <li style="margin-bottom: 10px;"><strong>Crisis Level:</strong> ${crisisCount} (${crisisPercent}%)</li>
              <li style="margin-bottom: 10px;"><strong>High Priority:</strong> ${highCount} (${highPercent}%)</li>
              <li style="margin-bottom: 10px;"><strong>Medium Priority:</strong> ${mediumCount} (${mediumPercent}%)</li>
              <li><strong>Low Priority:</strong> ${lowCount} (${lowPercent}%)</li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 0.85em;">
          <p style="margin: 0 0 8px 0;">This report was automatically generated by the JRMSU Guidance Office Management System</p>
          <p style="margin: 0;">For more information, contact the Guidance Office</p>
        </div>
      </div>
    </div>
  `;
  
  // Export to PDF using html2pdf library
  const element = document.createElement('div');
  element.innerHTML = reportContent;
  document.body.appendChild(element);
  
  const opt = {
    margin: 10,
    filename: `Appointments-Report-${dateStr.replace(/\s+/g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
  };
  
  // Load html2pdf library from CDN if not already loaded
  if (typeof html2pdf === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = function() {
      html2pdf().set(opt).from(element).save();
      setTimeout(() => element.remove(), 500);
    };
    document.head.appendChild(script);
  } else {
    html2pdf().set(opt).from(element).save();
    setTimeout(() => element.remove(), 500);
  }
}
  
  // Build HTML for PDF
  const reportContent = `
    <div id="reportPDF" style="font-family: 'Arial', sans-serif; color: #1f2937; line-height: 1.6; background: #fff; padding: 20px;">
      <div style="max-width: 900px; margin: 0 auto;">
        <!-- Header -->
        <div style="border-bottom: 3px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #0a2342; font-size: 2.5em; margin: 0 0 10px 0;">📊 Appointments Report</h1>
          <div style="display: flex; gap: 20px; font-size: 0.9em; color: #6b7280;">
            <div><strong>Generated:</strong> ${dateStr} ${timeStr}</div>
            <div><strong>System:</strong> JRMSU Guidance Office</div>
          </div>
        </div>

        <!-- Stats -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
          <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #4f46e5;">
            <div style="font-size: 0.9em; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">This Month</div>
            <div style="font-size: 2em; font-weight: 700; color: #0a2342;">${monthCount}</div>
          </div>
          <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #4f46e5;">
            <div style="font-size: 0.9em; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Avg. Sessions / Month</div>
            <div style="font-size: 2em; font-weight: 700; color: #0a2342;">${avgSession}</div>
          </div>
        </div>

        <!-- Monthly Chart -->
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h2 style="font-size: 1.5em; color: #0a2342; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin: 0 0 20px 0; font-weight: 700;">Monthly Appointments Trend</h2>
          <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 20px; text-align: center;">
            ${barChartImage ? `<img src="${barChartImage}" alt="Monthly Appointments Chart" style="max-width: 100%; height: auto; max-height: 300px;">` : '<p style="color: #6b7280;">Bar chart showing total appointments for each month over the past 12 months.</p>'}
          </div>
          <p style="font-size: 0.85em; color: #6b7280;">Bar chart showing total appointments for each month over the past 12 months.</p>
        </div>

        <!-- Urgency Chart -->
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h2 style="font-size: 1.5em; color: #0a2342; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin: 0 0 20px 0; font-weight: 700;">Urgency Trend Analysis</h2>
          <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 20px; text-align: center;">
            ${lineChartImage ? `<img src="${lineChartImage}" alt="Urgency Trend Chart" style="max-width: 100%; height: auto; max-height: 300px;">` : '<p style="color: #6b7280;">Line chart showing the trend of Crisis, High, Medium, and Low urgency appointments over the past 12 months.</p>'}
          </div>
          <p style="font-size: 0.85em; color: #6b7280;">Line chart showing the trend of Crisis, High, Medium, and Low urgency appointments over the past 12 months.</p>
        </div>

        <!-- Data Table -->
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h2 style="font-size: 1.5em; color: #0a2342; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin: 0 0 20px 0; font-weight: 700;">Monthly Data Summary</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9em; background: #fff;">
            <thead>
              <tr>
                <th style="background: #4f46e5; color: #fff; padding: 12px; text-align: left; font-weight: 600;">Month</th>
                <th style="background: #4f46e5; color: #fff; padding: 12px; text-align: left; font-weight: 600;">Total</th>
                <th style="background: #4f46e5; color: #fff; padding: 12px; text-align: left; font-weight: 600;">Crisis</th>
                <th style="background: #4f46e5; color: #fff; padding: 12px; text-align: left; font-weight: 600;">High</th>
                <th style="background: #4f46e5; color: #fff; padding: 12px; text-align: left; font-weight: 600;">Medium</th>
                <th style="background: #4f46e5; color: #fff; padding: 12px; text-align: left; font-weight: 600;">Low</th>
              </tr>
            </thead>
            <tbody>
              ${months.map((m, idx) => {
                const bgColor = idx % 2 === 0 ? '#fff' : '#f9fafb';
                return `<tr style="background: ${bgColor};">
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>${m.label}</strong></td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${m.total || 0}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${m.urgencies.Crisis || 0}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${m.urgencies.High || 0}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${m.urgencies.Medium || 0}</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${m.urgencies.Low || 0}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Key Metrics -->
        <div style="margin-bottom: 40px; page-break-inside: avoid;">
          <h2 style="font-size: 1.5em; color: #0a2342; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin: 0 0 20px 0; font-weight: 700;">Key Metrics</h2>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #4f46e5;">
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="margin-bottom: 10px;"><strong>Total Appointments:</strong> ${totalAppointments}</li>
              <li style="margin-bottom: 10px;"><strong>Crisis Level:</strong> ${crisisCount} (${crisisPercent}%)</li>
              <li style="margin-bottom: 10px;"><strong>High Priority:</strong> ${highCount} (${highPercent}%)</li>
              <li style="margin-bottom: 10px;"><strong>Medium Priority:</strong> ${mediumCount} (${mediumPercent}%)</li>
              <li><strong>Low Priority:</strong> ${lowCount} (${lowPercent}%)</li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 0.85em;">
          <p style="margin: 0 0 8px 0;">This report was automatically generated by the JRMSU Guidance Office Management System</p>
          <p style="margin: 0;">For more information, contact the Guidance Office</p>
        </div>
      </div>
    </div>
  `;
  
  // Export to PDF using html2pdf library
  const element = document.createElement('div');
  element.innerHTML = reportContent;
  document.body.appendChild(element);
  
  const opt = {
    margin: 10,
    filename: `Appointments-Report-${dateStr.replace(/\s+/g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
  };
  
  // Load html2pdf library from CDN if not already loaded
  if (typeof html2pdf === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = function() {
      html2pdf().set(opt).from(element).save();
      setTimeout(() => element.remove(), 500);
    };
    document.head.appendChild(script);
  } else {
    html2pdf().set(opt).from(element).save();
    setTimeout(() => element.remove(), 500);
  }
}

// Setup event listeners when document is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[REPORTS] DOMContentLoaded fired');
  
  // Setup print button listener
  const printBtn = document.getElementById('printReportBtn');
  if (printBtn) {
    printBtn.addEventListener('click', printReport);
    console.log('[REPORTS] Print button wired');
  } else {
    console.warn('[REPORTS] Print button not found');
  }
  
  // Setup test button listener
  const testBtn = document.getElementById('testChartsBtn');
  console.log('[REPORTS] Test button element:', testBtn);
  if (testBtn) {
    testBtn.addEventListener('click', testCharts);
    console.log('[REPORTS] Test button wired up');
  } else {
    console.warn('[REPORTS] Test button not found - making testCharts global');
    window.testCharts = testCharts; // Make it available on window
  }
  
  // Initialize reports view observer
  initReportsOnView();
});

// Also make testCharts globally available immediately
window.testCharts = testCharts;