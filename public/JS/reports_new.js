/* ========== REPORTS MODULE - PROFESSIONAL DESIGN ========== */

console.log('[REPORTS] Module loaded');

// Register ChartJS plugin for data labels
if (typeof Chart !== 'undefined' && window.ChartDataLabels) {
  Chart.register(window.ChartDataLabels);
}

let monthlyBarChart = null;
let urgencyLineChart = null;
let collegeDonutChart = null;
let courseDonutChart = null;
let genderDonutChart = null;
let reportsAppointments = [];

// Course -> Department mapping (provided list)
const COURSE_TO_DEPT = {
  'bachelor of science in midwifery': 'CNAHS',
  'bachelor of science in nursing': 'CNAHS',

  'bachelor of science in accountancy': 'CBA',
  'bachelor of science in accounting -information systems': 'CBA',
  'bachelor of science in business -administration – financial management': 'CBA',
  'bachelor of science in business -administration – marketing management': 'CBA',
  'bachelor of science in entrepreneurship': 'CBA',
  'bachelor of science in internal auditing': 'CBA',
  'bachelor of science in management accounting': 'CBA',

  'bachelor of arts in english language studies': 'CLAMS',
  'bachelor of arts in political science': 'CLAMS',
  'bachelor of science in marine biology': 'CLAMS',

  'bachelor of culture and arts education': 'CTED',
  'bachelor of early childhood education': 'CTED',
  'bachelor of elementary education': 'CTED',
  'bachelor of physical education': 'CTED',
  'bachelor of secondary education – english': 'CTED',
  'bachelor of secondary education – filipino': 'CTED',
  'bachelor of secondary education – mathematics': 'CTED',
  'bachelor of secondary education – science': 'CTED',
  'bachelor of secondary education – social studies': 'CTED',

  'bachelor of science in criminology': 'CCJE',

  'bachelor of science in civil engineering major in structural engineering': 'COE',
  'bachelor of science in computer engineering': 'COE',
  'bachelor of science in electrical engineering': 'COE',
  'bachelor of science in electronics engineering': 'COE',

  'bachelor of science in marine engineering': 'SOM',
  'bachelor of science in marine transportation': 'SOM',

  'bachelor of science in hospitality management': 'CME',
  'bachelor of science in tourism management': 'CME',

  'bachelor of science in computer science': 'CCS',
  'bachelor of science in information systems': 'CCS',
  'bachelor of science in information technology': 'CCS'
};

function mapCourseToDept(course) {
  if (!course) return null;
  const s = String(course).toLowerCase().trim();
  // Exact/substring match against mapping keys
  for (const key of Object.keys(COURSE_TO_DEPT)) {
    if (s.includes(key) || key.includes(s) || s === key) return COURSE_TO_DEPT[key];
  }
  return null;
}

// Professional color palette
const URGENCY_COLORS = {
  'Crisis': { line: '#ef4444', fill: 'rgba(239, 68, 68, 0.08)', hover: 'rgba(239, 68, 68, 0.15)' },
  'High': { line: '#f97316', fill: 'rgba(249, 115, 22, 0.08)', hover: 'rgba(249, 115, 22, 0.15)' },
  'Medium': { line: '#eab308', fill: 'rgba(234, 179, 8, 0.08)', hover: 'rgba(234, 179, 8, 0.15)' },
  'Low': { line: '#10b981', fill: 'rgba(16, 185, 129, 0.08)', hover: 'rgba(16, 185, 129, 0.15)' }
};

// College/Course colors - vibrant professional palette inspired by modern dashboards
const DISTRIBUTION_COLORS = [
  '#ff6b6b', '#ffa94d', '#ffd43b', '#74c0fc',
  '#4dabf7', '#339af0', '#228be6', '#1971c2',
  '#1864ab', '#15aabf', '#12b886', '#2f9e44',
  '#51cf66', '#a9e34b', '#f06595', '#fd7e14'
];


// Get 12 months structure
function getMonths() {
  const year = new Date().getFullYear();
  return Array.from({ length: 12 }, (_, i) => ({
    month: i,
    label: new Date(year, i).toLocaleString('default', { month: 'short' }),
    total: 0,
    urgencies: { Crisis: 0, High: 0, Medium: 0, Low: 0 }
  }));
}

// Animate number
function animateNumber(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = target;
}

// Configure Chart.js globally
function setupChartDefaults() {
  Chart.defaults.font.family = "'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', sans-serif";
  Chart.defaults.font.weight = '500';
  Chart.defaults.color = '#64748b';

  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.95)';
  Chart.defaults.plugins.tooltip.titleColor = '#f1f5f9';
  Chart.defaults.plugins.tooltip.bodyColor = '#f1f5f9';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(100, 116, 139, 0.2)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.displayColors = true;
  Chart.defaults.plugins.tooltip.boxPadding = 6;
}

// Render college distribution chart
// Render department distribution chart (maps courses -> department)
function renderDepartmentChart(appointments) {
  console.log('[REPORTS] Rendering department chart');

  const deptMap = {};
  (appointments || []).forEach(apt => {
    // Prefer explicit department if provided
    let dept = apt.department || apt.college || apt.schoolName || null;
    // Try to map from course when available
    if (!dept && apt.course) dept = mapCourseToDept(apt.course);
    // If still null, try mapping from course anyway (course names may be present)
    if (!dept && apt.course) dept = mapCourseToDept(apt.course);
    dept = dept || 'Unknown';
    deptMap[dept] = (deptMap[dept] || 0) + 1;
  });

  const labels = Object.keys(deptMap);
  const data = Object.values(deptMap);
  const colors = labels.map((_, i) => DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]);

  const canvas = document.getElementById('departmentDonut');
  if (!canvas) {
    console.warn('[REPORTS] Department canvas not found');
    return;
  }

  // Destroy old chart
  if (collegeDonutChart) {
    collegeDonutChart.destroy();
    collegeDonutChart = null;
  }

  try {
    collegeDonutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        aspectRatio: 1,
        cutout: '65%',
        animation: { 
          duration: 750, 
          easing: 'easeInOutQuart'
        },
        plugins: {
          datalabels: { display: false },
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (context) => context[0].label,
              label: (context) => {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const value = context.parsed;
                const percentage = total ? ((value / total) * 100).toFixed(2) : '0.00';
                return `${value} appointments (${percentage}%)`;
              }
            },
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 11 },
            padding: 10,
            cornerRadius: 6,
            displayColors: true,
            boxPadding: 6
          }
        }
      }
    });

    // Render custom right-side legend
    try {
      const total = data.reduce((a, b) => a + b, 0) || 0;
      const legendEl = document.getElementById('departmentLegend');
      if (legendEl) {
        const pcts = [];
        if (total) {
          let sum = 0;
          for (let i = 0; i < labels.length; i++) {
            const v = data[i] || 0;
            const p = Number(((v / total) * 100).toFixed(2));
            pcts.push(p);
            sum += p;
          }
          const diff = Number((100 - sum).toFixed(2));
          if (pcts.length) pcts[pcts.length - 1] = Number((pcts[pcts.length - 1] + diff).toFixed(2));
        } else {
          for (let i = 0; i < labels.length; i++) pcts.push(0);
        }

        legendEl.innerHTML = labels.map((label, i) => {
          const value = data[i] || 0;
          const pct = pcts[i] != null ? pcts[i].toFixed(2) : '0.00';
          const color = colors[i] || '#ccc';
          return `
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="width:12px; height:12px; background:${color}; border-radius:3px; display:inline-block; box-shadow:0 0 0 1px rgba(0,0,0,0.04);"></span>
                <div style="color:#1e293b; font-weight:600; font-size:13px;">${label}</div>
              </div>
              <div style="color:#64748b; font-size:13px;">${pct}%</div>
            </div>`;
        }).join('');
      }
    } catch (e) {
      console.warn('[REPORTS] Department legend render failed', e);
    }

    console.log('[REPORTS] ✅ Department chart created');
    try { window.departmentChart = collegeDonutChart; } catch(e){}
  } catch (e) {
    console.error('[REPORTS] Department chart error:', e);
  }
}

// Render course distribution chart
function renderCourseChart(appointments) {
  console.log('[REPORTS] Rendering course chart');

  const courseMap = {};
  (appointments || []).forEach(apt => {
    const course = apt.course || apt.courseCode || 'Unknown';
    courseMap[course] = (courseMap[course] || 0) + 1;
  });

  const labels = Object.keys(courseMap).sort((a, b) => courseMap[b] - courseMap[a]).slice(0, 8);
  const data = labels.map(l => courseMap[l]);
  const colors = labels.map((_, i) => DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]);

  const canvas = document.getElementById('courseDonut');
  if (!canvas) {
    console.warn('[REPORTS] Course canvas not found');
    return;
  }

  // Destroy old chart
  if (courseDonutChart) {
    courseDonutChart.destroy();
    courseDonutChart = null;
  }

  try {
    courseDonutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        aspectRatio: 1,
        cutout: '65%',
        animation: { 
          duration: 750, 
          easing: 'easeInOutQuart'
        },
        plugins: {
          datalabels: {
            display: false
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (context) => context[0].label,
              label: (context) => {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const value = context.parsed;
                const percentage = total ? ((value / total) * 100).toFixed(2) : '0.00';
                return `${value} appointments (${percentage}%)`;
              }
            },
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 11 },
            padding: 10,
            cornerRadius: 6,
            displayColors: true,
            boxPadding: 6
          }
        }
      }
    });
    // Render custom right-side legend (label + percentage) to match reference design
    try {
      const total = data.reduce((a, b) => a + b, 0) || 0;
      const legendEl = document.getElementById('courseLegend');
      if (legendEl) {
        const pcts = [];
        if (total) {
          let sum = 0;
          for (let i = 0; i < labels.length; i++) {
            const v = data[i] || 0;
            const p = Number(((v / total) * 100).toFixed(2));
            pcts.push(p);
            sum += p;
          }
          const diff = Number((100 - sum).toFixed(2));
          if (pcts.length) pcts[pcts.length - 1] = Number((pcts[pcts.length - 1] + diff).toFixed(2));
        } else {
          for (let i = 0; i < labels.length; i++) pcts.push(0);
        }

        legendEl.innerHTML = labels.map((label, i) => {
          const value = data[i] || 0;
          const pct = pcts[i] != null ? pcts[i].toFixed(2) : '0.00';
          const color = colors[i] || '#ccc';
          return `
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="width:12px; height:12px; background:${color}; border-radius:3px; display:inline-block; box-shadow:0 0 0 1px rgba(0,0,0,0.04);"></span>
                <div style="color:#1e293b; font-weight:600; font-size:13px;">${label}</div>
              </div>
              <div style="color:#64748b; font-size:13px;">${pct}%</div>
            </div>`;
        }).join('');
      }
    } catch (e) {
      console.warn('[REPORTS] Course legend render failed', e);
    }
    console.log('[REPORTS] ✅ Course chart created');
    try { window.courseChart = courseDonutChart; } catch(e){}
  } catch (e) {
    console.error('[REPORTS] Course chart error:', e);
  }
}

// Render gender distribution chart (Male / Female / Other)
function renderGenderChart(appointments) {
  console.log('[REPORTS] Rendering gender chart');
    // Count unique students so a student with multiple appointments counts once
    const map = { Male: 0, Female: 0 };
    try {
      const seen = {};
      (appointments || []).forEach(a => {
        const key = String((a.studentid || a.studentId || a.schoolId || a.email || (a.fname && a.lname ? `${a.fname}|${a.lname}|${a.contact || ''}` : '')) || '').toLowerCase().trim();
        if (!key) return; // skip if no identifiable key
        if (seen[key]) return; // already counted
        seen[key] = true;

        const raw = a.sex ?? a.gender ?? (a.student && (a.student.sex ?? a.student.gender)) ?? '';
        const g = String(raw).trim().toLowerCase();
        if (!g) return; // ignore unknown/blank
        // Check female first because 'female' contains substring 'male'
        if (g === 'f' || g === 'female' || g.includes('female') || g === 'woman') map.Female++;
        else if (g === 'm' || g === 'male' || g === 'man') map.Male++;
        else return; // ignore other values
      });
    } catch (e) {
      console.warn('[REPORTS] Gender unique-count failed', e);
    }

  const labels = ['Male', 'Female'];
  const data = [map.Male, map.Female];
  const colors = ['#60a5fa', '#f472b6'];

  const canvas = document.getElementById('genderDonut');
  if (!canvas) { console.warn('[REPORTS] Gender canvas not found'); return; }

  if (genderDonutChart) { genderDonutChart.destroy(); genderDonutChart = null; }

  try {
    genderDonutChart = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#fff', borderWidth: 2 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a, b) => a + b, 0) || 0;
                const value = context.parsed;
                const pct = total ? ((value / total) * 100).toFixed(2) : '0.00';
                return `${value} students (${pct}%)`;
              }
            }
          }
        }
      }
    });

    // Render simple legend
    try {
      const total = data.reduce((a, b) => a + b, 0) || 0;
      const legendEl = document.getElementById('genderLegend');
      if (legendEl) {
        const pcts = [];
        if (total) {
          let sum = 0;
          for (let i = 0; i < labels.length; i++) {
            const v = data[i] || 0;
            const p = Number(((v / total) * 100).toFixed(2));
            pcts.push(p);
            sum += p;
          }
          const diff = Number((100 - sum).toFixed(2));
          if (pcts.length) pcts[pcts.length - 1] = Number((pcts[pcts.length - 1] + diff).toFixed(2));
        } else {
          for (let i = 0; i < labels.length; i++) pcts.push(0);
        }

        legendEl.innerHTML = labels.map((label, i) => {
          const value = data[i] || 0;
          const pct = pcts[i] != null ? pcts[i].toFixed(2) : '0.00';
          const color = colors[i] || '#ccc';
          return `
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="width:12px; height:12px; background:${color}; border-radius:3px; display:inline-block;"></span>
                <div style="color:#1e293b; font-weight:600; font-size:13px;">${label}</div>
              </div>
              <div style="color:#64748b; font-size:13px;">${pct}%</div>
            </div>`;
        }).join('');
      }
    } catch (e) { console.warn('[REPORTS] Gender legend render failed', e); }

    try { window.genderChart = genderDonutChart; } catch(e){}
    console.log('[REPORTS] ✅ Gender chart created');
  } catch (e) { console.error('[REPORTS] Gender chart error:', e); }
}

  // Clean department chart renderer (kept separate to avoid accidental merges)
  function renderDepartmentChartClean(appointments) {
    const deptMap = {};
    (appointments || []).forEach(apt => {
      let dept = apt.department || apt.college || apt.schoolName || null;
      if (!dept && apt.course) dept = mapCourseToDept(apt.course);
      dept = dept || 'Unknown';
      deptMap[dept] = (deptMap[dept] || 0) + 1;
    });

    const labels = Object.keys(deptMap);
    const data = Object.values(deptMap);
    const colors = labels.map((_, i) => DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]);

    const canvas = document.getElementById('departmentDonut');
    if (!canvas) return;
    if (collegeDonutChart) { collegeDonutChart.destroy(); collegeDonutChart = null; }

    try {
      collegeDonutChart = new Chart(canvas, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#fff', borderWidth: 2 }] },
        options: { responsive:true, maintainAspectRatio:false, cutout:'65%', plugins:{legend:{display:false}, datalabels:{display:false}} }
      });
      try { window.departmentChart = collegeDonutChart; } catch(e){}
    } catch (e) { console.warn('[REPORTS] renderDepartmentChartClean failed', e); }
  }

  // Clean course chart renderer
  function renderCourseChartClean(appointments) {
    const courseMap = {};
    (appointments || []).forEach(apt => {
      const course = apt.course || apt.courseCode || 'Unknown';
      courseMap[course] = (courseMap[course] || 0) + 1;
    });
    const sorted = Object.entries(courseMap).sort((a,b)=>b[1]-a[1]);
    const labels = sorted.slice(0,8).map(x=>x[0]);
    const data = sorted.slice(0,8).map(x=>x[1]);
    const colors = labels.map((_,i)=>DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]);

    const canvas = document.getElementById('courseDonut');
    if (!canvas) return;
    if (courseDonutChart) { courseDonutChart.destroy(); courseDonutChart = null; }

    try {
      courseDonutChart = new Chart(canvas, {
        type:'doughnut', data:{ labels, datasets:[{ data, backgroundColor:colors, borderColor:'#fff', borderWidth:2 }] },
        options: { responsive:true, maintainAspectRatio:false, cutout:'65%', plugins:{legend:{display:false}, datalabels:{display:false}} }
      });
      try { window.courseChart = courseDonutChart; } catch(e){}
    } catch (e) { console.warn('[REPORTS] renderCourseChartClean failed', e); }
  }

// Initialize reports
async function initReports() {
  console.log('[REPORTS] initReports called');

  // Wait for Chart.js
  if (typeof Chart === 'undefined') {
    console.warn('[REPORTS] Chart.js not loaded, waiting...');
    await new Promise(r => setTimeout(r, 500));
  }

  if (typeof Chart === 'undefined') {
    console.error('[REPORTS] Chart.js still not available');
    return;
  }

  console.log('[REPORTS] Chart.js ready');

  // Setup Chart defaults
  setupChartDefaults();

  // Get canvases
  const barEl = document.getElementById('monthlyBarChart');
  const lineEl = document.getElementById('urgencyLineChart');

  if (!barEl || !lineEl) {
    console.error('[REPORTS] Canvas not found');
    return;
  }

  console.log('[REPORTS] Canvases found');

  // Detect current user to scope reports for counselors
  let counselorFilter = null;
  try {
    const meRes = await fetch('/api/me', { credentials: 'include' });
    if (meRes && meRes.ok) {
      const me = await meRes.json().catch(() => null);
      if (me && me.user && String((me.user.role || '')).toLowerCase().includes('counselor')) {
        counselorFilter = me.user.username || null;
        console.log('[REPORTS] Running reports for counselor:', counselorFilter);
      }
    }
  } catch (e) {
    console.warn('[REPORTS] Could not determine current user:', e);
  }

  // Fetch data
  let months = getMonths();
  let appointments = [];
  
  try {
    console.log('[REPORTS] Fetching monthly data...');
    const year = new Date().getFullYear();
    const q = new URLSearchParams({ year: String(year) });
    if (counselorFilter) q.set('counselor', counselorFilter);
    const res = await fetch('/api/reports/monthly?' + q.toString(), { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.months) {
        months = data.months;
        console.log('[REPORTS] Got monthly data:', months);
      }
    }
  } catch (e) {
    console.warn('[REPORTS] Monthly data fetch failed:', e);
  }

  // Fetch appointments for distribution charts
  try {
    console.log('[REPORTS] Fetching appointments...');
    const res = await fetch('/api/appointments', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      appointments = data.appointments || [];
      reportsAppointments = appointments;
      console.log('[REPORTS] Got appointments:', appointments.length);
    }
  } catch (e) {
    console.warn('[REPORTS] Appointments fetch failed:', e);
  }

  // If some appointments lack sex/gender, try to enrich from students list
  try {
    const needEnrich = (appointments || []).some(a => !((a.sex || a.gender) || (a.student && (a.student.sex || a.student.gender))));
    if (needEnrich) {
      try {
        const studsRes = await fetch('/api/students', { credentials: 'include' });
        if (studsRes && studsRes.ok) {
          const studsData = await studsRes.json();
          const students = studsData.students || [];
          const byId = {};
          const byEmail = {};
          students.forEach(s => {
            if (s.schoolId) byId[String(s.schoolId).toLowerCase()] = s;
            if (s.email) byEmail[String(s.email).toLowerCase()] = s;
          });

          appointments.forEach(a => {
            const hasSex = !!((a.sex || a.gender) || (a.student && (a.student.sex || a.student.gender)));
            if (hasSex) return;
            const sid = String(a.studentid || a.studentId || a.schoolId || '').toLowerCase();
            const em = String(a.email || '').toLowerCase();
            let s = null;
            if (sid && byId[sid]) s = byId[sid];
            else if (em && byEmail[em]) s = byEmail[em];
            if (s && (s.sex || s.gender)) {
              a.sex = s.sex || s.gender;
            }
          });
          reportsAppointments = appointments;
          console.log('[REPORTS] Merged student sex data into appointments');
        }
      } catch (e) {
        console.warn('[REPORTS] Failed to fetch/merge students for gender enrichment', e);
      }
    }
  } catch (e) {
    console.warn('[REPORTS] Gender enrichment check failed', e);
  }

  const labels = months.map(m => m.label);
  const totals = months.map(m => m.total || 0);
  const maxTotal = Math.max(...totals, 1);

  // Update stats
  const thisMonth = months[new Date().getMonth()]?.total || 0;
  const avg = Math.round((totals.reduce((a, b) => a + b, 0) / 12) * 10) / 10;
  animateNumber('reportMonthCount', thisMonth);
  animateNumber('reportAvgSession', avg);

  // Destroy old charts
  if (monthlyBarChart) monthlyBarChart.destroy();
  if (urgencyLineChart) urgencyLineChart.destroy();

  console.log('[REPORTS] Creating bar chart');

  // Bar chart - Professional Modern Style
  try {
    monthlyBarChart = new Chart(barEl, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total Appointments',
          data: totals,
          backgroundColor: '#6366f1',
          borderColor: '#4f46e5',
          borderRadius: 8,
          borderSkipped: false,
          hoverBackgroundColor: '#4f46e5',
          barThickness: 'flex',
          maxBarThickness: 45,
          barPercentage: 0.75,
          categoryPercentage: 0.8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        animation: {
          duration: 700,
          easing: 'easeInOutQuart'
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.parsed.y} appointments`,
              afterLabel: (context) => {
                const percentage = ((context.parsed.y / maxTotal) * 100).toFixed(0);
                return ` ${percentage}% of peak`;
              }
            },
            backgroundColor: 'rgba(15, 23, 42, 0.96)',
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 11 },
            padding: 10,
            cornerRadius: 6,
            displayColors: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: '#94a3b8',
              font: { size: 10, weight: '500' },
              callback: (value) => Math.floor(value)
            },
            grid: {
              color: 'rgba(226, 232, 240, 0.4)',
              drawBorder: false,
              lineWidth: 0.8
            },
            max: Math.ceil(maxTotal * 1.15)
          },
          x: {
            ticks: {
              color: '#64748b',
              font: { size: 11, weight: '500' }
            },
            grid: { display: false, drawBorder: false }
          }
        }
      }
    });
    console.log('[REPORTS] ✅ Bar chart created');
    try { window.monthlyChart = monthlyBarChart; } catch(e){}
  } catch (e) {
    console.error('[REPORTS] Bar chart error:', e);
  }

  console.log('[REPORTS] Creating line chart');

  // Line chart - Professional Modern Style
  try {
    const datasets = Object.entries(URGENCY_COLORS).map(([name, colors]) => ({
      label: name,
      data: months.map(m => m.urgencies?.[name] || 0),
      borderColor: colors.line,
      backgroundColor: colors.fill,
      borderWidth: 2.8,
      fill: true,
      tension: 0.4,
      pointRadius: 3.5,
      pointBackgroundColor: colors.line,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2.5,
      pointHoverRadius: 5.5,
      pointHoverBackgroundColor: colors.line,
      pointHoverBorderWidth: 3
    }));

    urgencyLineChart = new Chart(lineEl, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        animation: {
          duration: 700,
          easing: 'easeInOutQuart'
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'center',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 14,
              color: '#64748b',
              font: { size: 11, weight: '600' },
              generateLabels: (chart) => {
                const data = chart.data;
                return data.datasets.map((dataset, i) => ({
                  text: dataset.label,
                  fillStyle: dataset.borderColor,
                  strokeStyle: dataset.borderColor,
                  lineWidth: 2.5,
                  hidden: false,
                  index: i
                }));
              }
            }
          },
          tooltip: {
            callbacks: {
              title: (context) => `${context[0].label}`,
              label: (context) => ` ${context.dataset.label}: ${context.parsed.y}`,
              afterLabel: () => ''
            },
            backgroundColor: 'rgba(15, 23, 42, 0.96)',
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 11 },
            padding: 10,
            cornerRadius: 6,
            displayColors: true,
            boxPadding: 5
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: '#94a3b8',
              font: { size: 10, weight: '500' },
              callback: (value) => Math.floor(value)
            },
            grid: {
              color: 'rgba(226, 232, 240, 0.4)',
              drawBorder: false,
              lineWidth: 0.8
            }
          },
          x: {
            ticks: {
              color: '#64748b',
              font: { size: 11, weight: '500' }
            },
            grid: { display: false, drawBorder: false }
          }
        }
      }
    });
    console.log('[REPORTS] ✅ Line chart created');
    try { window.urgencyChart = urgencyLineChart; } catch(e){}
  } catch (e) {
    console.error('[REPORTS] Line chart error:', e);
  }

  // Render distribution charts using clean renderers
  if (appointments.length > 0) {
    renderDepartmentChartClean(appointments);
    renderCourseChartClean(appointments);
    renderGenderChart(appointments);
  } else {
    console.warn('[REPORTS] No appointments for distribution charts');
  }

  console.log('[REPORTS] ✅ Done');
}

// Setup when Reports tab clicked
document.addEventListener('DOMContentLoaded', () => {
  console.log('[REPORTS] DOMContentLoaded');

  // Find Reports nav button
  const reportsBtn = document.querySelector('[data-view="reports"]');
  if (reportsBtn) {
    reportsBtn.addEventListener('click', () => {
      console.log('[REPORTS] Reports button clicked');
      setTimeout(initReports, 100);
    });
    console.log('[REPORTS] Reports button listener attached');
  }

  // If the reports canvases are embedded directly (e.g., counselor dashboard), auto-init
  try {
    const autoBar = document.getElementById('monthlyBarChart');
    const autoLine = document.getElementById('urgencyLineChart');
    if (autoBar && autoLine) {
      console.log('[REPORTS] Embedded canvases detected — auto-initializing reports');
      setTimeout(() => {
        try { initReports(); } catch (e) { console.error('[REPORTS] initReports failed on auto-init', e); }
      }, 120);
    }
  } catch (e) { console.warn('[REPORTS] auto-init detection failed', e); }
});

// Export
window.initReports = initReports;

// ===== Report export helpers =====
function buildReportContent() {
  const monthCount = document.getElementById('reportMonthCount')?.textContent || '0';
  const avgSession = document.getElementById('reportAvgSession')?.textContent || '0';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US');

  // Capture chart images if available (include department/course charts)
  let barChartImage = '';
  let lineChartImage = '';
  let genderChartImage = '';
  let departmentChartImage = '';
  let courseChartImage = '';
  try {
    if (window.monthlyChart && window.monthlyChart.canvas) barChartImage = window.monthlyChart.canvas.toDataURL('image/png');
    if (window.urgencyChart && window.urgencyChart.canvas) lineChartImage = window.urgencyChart.canvas.toDataURL('image/png');
    if (window.genderChart && window.genderChart.canvas) genderChartImage = window.genderChart.canvas.toDataURL('image/png');
    // department chart may be exposed as window.departmentChart or collegeDonutChart
    if (window.departmentChart && window.departmentChart.canvas) departmentChartImage = window.departmentChart.canvas.toDataURL('image/png');
    if (!departmentChartImage && typeof collegeDonutChart !== 'undefined' && collegeDonutChart && collegeDonutChart.canvas) departmentChartImage = collegeDonutChart.canvas.toDataURL('image/png');
    // course chart may be exposed as window.courseChart or courseDonutChart
    if (window.courseChart && window.courseChart.canvas) courseChartImage = window.courseChart.canvas.toDataURL('image/png');
    if (!courseChartImage && typeof courseDonutChart !== 'undefined' && courseDonutChart && courseDonutChart.canvas) courseChartImage = courseDonutChart.canvas.toDataURL('image/png');
  } catch (e) { console.warn('[REPORTS] capture charts failed', e); }

  const source = (reportsAppointments && reportsAppointments.length) ? reportsAppointments : [];
  const currentYear = new Date().getFullYear();
  const months = getMonths();

  // populate months
  (source || []).forEach(appt => {
    try {
      const date = new Date(appt.date);
      if (date.getFullYear() !== currentYear) return;
      const month = date.getMonth();
      months[month].total = (months[month].total || 0) + 1;
      const urgency = (appt.urgency || '').toString();
      if (urgency.includes('Crisis')) months[month].urgencies.Crisis++;
      else if (urgency.includes('High')) months[month].urgencies.High++;
      else if (urgency.includes('Medium')) months[month].urgencies.Medium++;
      else months[month].urgencies.Low++;
    } catch (e) { /* ignore malformed dates */ }
  });

  const totalAppointments = source.length;
  const crisisCount = source.filter(a => (a.urgency || '').includes('Crisis')).length;
  const highCount = source.filter(a => (a.urgency || '').includes('High')).length;
  const mediumCount = source.filter(a => (a.urgency || '').includes('Medium')).length;
  const lowCount = source.filter(a => !(a.urgency || '').includes('Crisis') && !(a.urgency || '').includes('High') && !(a.urgency || '').includes('Medium')).length;

  const urgencyCounts = [crisisCount, highCount, mediumCount, lowCount];
  const urgencyLabels = ['Crisis', 'High', 'Medium', 'Low'];
  const urgencyPcts = [];
  if (totalAppointments > 0) {
    let sum = 0;
    for (let i = 0; i < urgencyCounts.length; i++) {
      const v = urgencyCounts[i] || 0;
      const p = Number(((v / totalAppointments) * 100).toFixed(2));
      urgencyPcts.push(p);
      sum += p;
    }
    const diff = Number((100 - sum).toFixed(2));
    if (urgencyPcts.length) urgencyPcts[urgencyPcts.length - 1] = Number((urgencyPcts[urgencyPcts.length - 1] + diff).toFixed(2));
  } else {
    for (let i = 0; i < urgencyCounts.length; i++) urgencyPcts.push(0);
  }
  const crisisPercent = urgencyPcts[0];
  const highPercent = urgencyPcts[1];
  const mediumPercent = urgencyPcts[2];
  const lowPercent = urgencyPcts[3];

  // Gender counts (unique students — only Male and Female)
  const genderMap = { Male: 0, Female: 0 };
  try {
    const seen = {};
    (source || []).forEach(a => {
      const key = String((a.studentid || a.studentId || a.schoolId || a.email || (a.fname && a.lname ? `${a.fname}|${a.lname}|${a.contact || ''}` : '')) || '').toLowerCase().trim();
      if (!key) return;
      if (seen[key]) return;
      seen[key] = true;

      const raw = a.sex ?? a.gender ?? (a.student && (a.student.sex ?? a.student.gender)) ?? '';
      const g = String(raw).trim().toLowerCase();
      if (!g) return; // ignore unknown/blank
      if (g === 'f' || g === 'female' || g.includes('female') || g === 'woman') genderMap.Female++;
      else if (g === 'm' || g === 'male' || g === 'man') genderMap.Male++;
      else return; // ignore other values
    });
  } catch (e) { console.warn('[REPORTS] PDF gender unique-count failed', e); }

  const maleCount = genderMap.Male;
  const femaleCount = genderMap.Female;
  const genderTotal = (maleCount + femaleCount) || 0;
  let malePct = 0;
  let femalePct = 0;
  if (genderTotal > 0) {
    malePct = Number(((maleCount / genderTotal) * 100).toFixed(2));
    femalePct = Number((100 - malePct).toFixed(2));
  }

  // Department counts (map from course if department missing)
  const deptMap = {};
  try {
    (source || []).forEach(apt => {
      let dept = apt.department || apt.college || apt.schoolName || null;
      if (!dept && apt.course) dept = mapCourseToDept(apt.course);
      dept = dept || 'Unknown';
      deptMap[dept] = (deptMap[dept] || 0) + 1;
    });
  } catch (e) { console.warn('[REPORTS] dept count failed', e); }
  const deptLabels = Object.keys(deptMap);
  const deptData = deptLabels.map(l => deptMap[l]);
  const deptTotal = deptData.reduce((a,b)=>a+b,0) || 0;
  const deptPcts = [];
  if (deptTotal > 0) {
    let s = 0;
    for (let i=0;i<deptData.length;i++){ const v = deptData[i]||0; const p = Number(((v/deptTotal)*100).toFixed(2)); deptPcts.push(p); s+=p; }
    const dRem = Number((100 - s).toFixed(2)); if (deptPcts.length) deptPcts[deptPcts.length-1] = Number((deptPcts[deptPcts.length-1] + dRem).toFixed(2));
  } else { for (let i=0;i<deptData.length;i++) deptPcts.push(0); }

  const departmentStatsHtml = deptLabels.length ? (`<div class="stats-card"> <table class="stats-table" style="margin-top:8px;">
    <thead><tr><th>Department</th><th style="text-align:right">Count</th><th style="text-align:right">%</th></tr></thead>
    <tbody>${deptLabels.map((lab,i)=>`<tr><td>${lab}</td><td style="text-align:right">${deptData[i]}</td><td style="text-align:right">${(deptPcts[i]||0).toFixed(2)}%</td></tr>`).join('')}</tbody></table> </div>`) : '<div style="color:#94a3b8;">No department data</div>';

  // Course counts (top 8 by frequency)
  const courseMap = {};
  try {
    (source || []).forEach(apt => {
      const course = (apt.course || apt.courseCode || 'Unknown');
      courseMap[course] = (courseMap[course] || 0) + 1;
    });
  } catch (e) { console.warn('[REPORTS] course count failed', e); }
  const sortedCourses = Object.entries(courseMap).sort((a,b)=>b[1]-a[1]);
  const courseLabels = sortedCourses.slice(0,8).map(x=>x[0]);
  const courseData = sortedCourses.slice(0,8).map(x=>x[1]);
  const courseTotal = Object.values(courseMap).reduce((a,b)=>a+b,0) || 0;
  const coursePcts = [];
  if (courseTotal > 0) {
    let s2 = 0;
    for (let i=0;i<courseData.length;i++){ const v = courseData[i]||0; const p = Number(((v/courseTotal)*100).toFixed(2)); coursePcts.push(p); s2+=p; }
    const cRem = Number((100 - s2).toFixed(2)); if (coursePcts.length) coursePcts[coursePcts.length-1] = Number((coursePcts[coursePcts.length-1] + cRem).toFixed(2));
  } else { for (let i=0;i<courseData.length;i++) coursePcts.push(0); }

  let courseStatsHtml = '';
  if (courseLabels.length) {
    const half = Math.ceil(courseLabels.length / 2);
    const col1 = courseLabels.slice(0, half);
    const col2 = courseLabels.slice(half);
    const buildCol = (cols) => {
      return `<table class="stats-table" style="margin-top:8px; font-size:12px;">` +
        `<thead><tr><th>Course</th><th style="text-align:right">Count</th><th style="text-align:right">%</th></tr></thead>` +
        `<tbody>` + cols.map(lab => {
          const idx = courseLabels.indexOf(lab);
          const cnt = courseData[idx] || 0;
          const pct = (coursePcts[idx] || 0).toFixed(2);
          return `<tr><td style="word-break:break-word">${lab}</td><td style="text-align:right">${cnt}</td><td style="text-align:right">${pct}%</td></tr>`;
        }).join('') +
        `</tbody></table>`;
    };

    courseStatsHtml = `
      <div class="stats-card course-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; align-items:start;">
        <div>${buildCol(col1)}</div>
        <div>${buildCol(col2)}</div>
      </div>`;
  } else {
    courseStatsHtml = '<div style="color:#94a3b8;">No course data</div>';
  }

  // Build a strict, validated report layout per specifications
  // Helper: sanitize and dedupe stats
  const addStat = (list, label, value, opts = {}) => {
    if (label == null) return;
    const cleanLabel = String(label).trim();
    if (!cleanLabel) return;
    // prevent duplicates by label
    if (list.some(s => s.label === cleanLabel)) return;
    // normalize value
    let val = value;
    if (val === null || typeof val === 'undefined') return;
    if (typeof val === 'number' && !isFinite(val)) return;
    if (typeof val === 'string') val = val.trim();
    list.push(Object.assign({ label: cleanLabel, value: val }, opts));
  };

  const stats = [];
  // Primary stats (unique, validated)
  addStat(stats, 'Total Appointments', totalAppointments);
  addStat(stats, 'This Month', monthCount);
  addStat(stats, 'Avg Sessions / Month', avgSession);

  // Status counts (ensure unique labels)
  try {
    const statusMap = {};
    (source || []).forEach(a => {
      const s = (a.status || a.state || a.statusText || '').toString().trim();
      if (!s) return;
      const key = s.toLowerCase();
      statusMap[key] = statusMap[key] || { label: s, count: 0 };
      statusMap[key].count++;
    });
    // Add common statuses in preferred order if present
    ['completed','pending','cancelled','missed'].forEach(k => {
      if (statusMap[k]) addStat(stats, statusMap[k].label, statusMap[k].count);
    });
    // Add any remaining statuses
    Object.keys(statusMap).forEach(k => { if (!['completed','pending','cancelled','missed'].includes(k)) addStat(stats, statusMap[k].label, statusMap[k].count); });
  } catch (e) { console.warn('[REPORTS] status aggregation failed', e); }

  // Gender percentages (add once)
  if (genderTotal > 0) {
    addStat(stats, 'Male (%)', `${malePct.toFixed ? malePct.toFixed(2) : malePct}%`);
    addStat(stats, 'Female (%)', `${femalePct.toFixed ? femalePct.toFixed(2) : femalePct}%`);
  }

  // Ensure no undefined/null/duplicate entries are present
  const safeStats = stats.filter(s => s && s.label && (typeof s.value !== 'undefined' && s.value !== null));

  // Render summary grid (max 4 per row, responsive)
  const renderStatsGrid = (items) => {
    const cards = items.map(item => {
      return `
        <div class="stat-card" style="flex:1 1 calc(25% - 12px); min-width:160px; box-sizing:border-box; padding:14px; background:#fff; border:1px solid #e6eef8; border-radius:8px; display:flex; flex-direction:column; justify-content:center; gap:8px;">
          <div style="font-size:12px; color:#6b7280;">${item.label}</div>
          <div style="font-size:20px; font-weight:800; color:#0b1220; word-break:break-word;">${item.value}</div>
        </div>`;
    }).join('');
    return `<div class="stats-grid" style="display:flex; flex-wrap:wrap; gap:16px; align-items:stretch;">${cards}</div>`;
  };

  // Chart block renderer ensures charts are centered, bounded, and maintain aspect ratio
  // aspect should be a string like '16/9' or '4/3'
  // title, imgSrc, aspect, maxWidth, maxHeight
  const renderChartBlock = (title, imgSrc, aspect = '16/9', maxWidth = 500, maxHeight = 300) => {
    const containerStyle = 'page-break-inside:avoid; padding:16px; border:1px solid #e6eef8; border-radius:8px; background:#fff; box-shadow:0 4px 10px rgba(15,23,42,0.04);';
    const viewportStyle = `width:100%; max-width:${maxWidth}px; aspect-ratio:${aspect}; max-height:${maxHeight}px; display:flex; align-items:center; justify-content:center; overflow:hidden;`;
    const imgStyle = 'width:100%; height:100%; object-fit:contain;';

    if (!imgSrc) {
      return `
        <div style="margin-bottom:24px; ${containerStyle}">
          <h3 style="font-size:15px; margin:0 0 8px 0; text-align:center;">${title}</h3>
          <div style="display:flex; justify-content:center; padding:12px;">
            <div style="${viewportStyle}; border-radius:6px; border:1px dashed #eaf2fb; display:flex; align-items:center; justify-content:center;">
              <div style="color:#94a3b8; font-size:13px;">Chart not available</div>
            </div>
          </div>
        </div>`;
    }

    return `
      <div style="margin-bottom:24px; ${containerStyle}">
        <h3 style="font-size:15px; margin:0 0 8px 0; text-align:center;">${title}</h3>
        <div style="display:flex; justify-content:center; padding:12px;">
          <div style="${viewportStyle}">
            <img src="${imgSrc}" style="${imgStyle}; max-width:500px; max-height:300px;" />
          </div>
        </div>
      </div>`;
  };

  // Render charts section: if single chart center it; if multiple, use 2-column grid
  const renderChartsSection = (charts) => {
    const valid = (charts || []).filter(c => c && c.src);
    const entries = charts || [];
    if (!entries.length) return '';
    if (entries.length === 1) {
      const c = entries[0];
      return `<section style="margin-bottom:28px; display:flex; justify-content:center;">${renderChartBlock(c.title, c.src, c.aspect || '16/9', c.maxWidth || 500, c.maxHeight || 300)}</section>`;
    }
    // multiple charts: 2-column grid
    const items = entries.map(c => `<div style="display:flex; flex-direction:column;">${renderChartBlock(c.title, c.src, c.aspect || '16/9', c.maxWidth || 500, c.maxHeight || 300)}</div>`).join('');
    return `<section style="margin-bottom:28px;"><div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; align-items:start;">${items}</div></section>`;
  };

  // Table renderer for monthly summary with alternating rows
  const renderMonthsTable = (monthsArr) => {
    return `
      <div style="page-break-inside:avoid;">
        <h3 style="font-size:15px; margin:0 0 8px 0;">Monthly Data Summary</h3>
        <div style="overflow:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:8px; background:#f1f5f9; color:#0b1220;">Month</th>
                <th style="text-align:right; padding:8px; background:#f1f5f9; color:#0b1220;">Total</th>
                <th style="text-align:right; padding:8px; background:#f1f5f9; color:#0b1220;">Crisis</th>
                <th style="text-align:right; padding:8px; background:#f1f5f9; color:#0b1220;">High</th>
                <th style="text-align:right; padding:8px; background:#f1f5f9; color:#0b1220;">Medium</th>
                <th style="text-align:right; padding:8px; background:#f1f5f9; color:#0b1220;">Low</th>
              </tr>
            </thead>
            <tbody>
              ${monthsArr.map((m, idx) => {
                const bg = idx % 2 === 0 ? '#ffffff' : '#fbfdff';
                return `<tr style="background:${bg};">
                  <td style="padding:10px; border-bottom:1px solid #eef2f6;">${m.label}</td>
                  <td style="padding:10px; border-bottom:1px solid #eef2f6; text-align:right;">${m.total || 0}</td>
                  <td style="padding:10px; border-bottom:1px solid #eef2f6; text-align:right;">${m.urgencies.Crisis || 0}</td>
                  <td style="padding:10px; border-bottom:1px solid #eef2f6; text-align:right;">${m.urgencies.High || 0}</td>
                  <td style="padding:10px; border-bottom:1px solid #eef2f6; text-align:right;">${m.urgencies.Medium || 0}</td>
                  <td style="padding:10px; border-bottom:1px solid #eef2f6; text-align:right;">${m.urgencies.Low || 0}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  };

  const css = `
    <style>
      @media print { .stat-card { page-break-inside: avoid; break-inside: avoid; } .no-break { page-break-inside: avoid; break-inside: avoid; } }
    </style>`;

  const reportContent = `
    <div id="reportPDF" style="font-family: 'Inter', Arial, sans-serif; color:#0b1220; background:#ffffff; padding:24px;">
      <div style="max-width:900px; margin:0 auto;">
        ${css}
        <!-- Header -->
        <header style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
          <div style="width:48px; height:48px; display:flex; align-items:center; justify-content:center;">
            <!-- optional logo placeholder -->
            <img src="/images/GUIDANCE%20LOGO.png" alt="logo" style="width:40px; height:40px; object-fit:cover; border-radius:6px;" onerror="this.style.display='none'" />
          </div>
          <div style="flex:1;">
            <h1 style="margin:0; font-size:22px;">Appointments Report</h1>
            <div style="color:#6b7280; font-size:12px; margin-top:4px;">Generated: ${dateStr} ${timeStr}</div>
          </div>
        </header>
        <hr style="border:none; height:1px; background:#e6eef8; margin-bottom:24px;" />

        <!-- Summary Stats -->
        <section style="margin-bottom:28px;">
          ${renderStatsGrid(safeStats)}
        </section>

        <!-- Charts Section -->
        ${renderChartsSection([
          { title: 'Monthly Appointments Trend', src: barChartImage, aspect: '16/9' },
          { title: 'Urgency Trend Analysis', src: lineChartImage, aspect: '16/9' },
          { title: 'Appointments by Department', src: departmentChartImage, aspect: '1/1', maxWidth: 320, maxHeight: 240 },
          { title: 'Appointments by Course', src: courseChartImage, aspect: '1/1', maxWidth: 320, maxHeight: 240 },
          { title: 'Appointments by Gender', src: genderChartImage, aspect: '1/1', maxWidth: 320, maxHeight: 240 }
        ])}

        <!-- Department & Course Statistics (tables only, no duplicate charts) -->
        <section style="margin-bottom:28px; display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start;">
          <div style="page-break-inside:avoid;">
            <h3 style="font-size:15px; margin:0 0 8px 0; text-align:left;">Appointments by Department (Breakdown)</h3>
            <div style="background:#fff; border:1px solid #e6eef8; padding:12px; border-radius:8px;">${departmentStatsHtml}</div>
          </div>
          <div style="page-break-inside:avoid;">
            <h3 style="font-size:15px; margin:0 0 8px 0; text-align:left;">Appointments by Course (Top)</h3>
            <div style="background:#fff; border:1px solid #e6eef8; padding:12px; border-radius:8px;">${courseStatsHtml}</div>
          </div>
        </section>

        <!-- Table Section -->
        <section style="margin-bottom:28px;">
          ${renderMonthsTable(months)}
        </section>

      </div>
    </div>`;

  return { reportContent, dateStr };
}

// Print helper which builds the report and opens print dialog (popup or iframe fallback)
function openPrintWindow(reportHtml) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Appointments Report</title>
      <style>body{font-family:Inter, Arial, sans-serif; color:#111827; margin:0; padding:20px;} img{max-width:100%; height:auto;}</style>
      </head><body>${reportHtml}</body></html>`;

  // Open a new tab/window and write the printable HTML into it.
  // NOTE: some browsers treat the third arg inconsistently; avoid passing 'noopener' here
  // because it can result in an about:blank tab that cannot be written to in some contexts.
  const w = window.open('', '_blank');
  console.debug('print: opened popup window', !!w, w);
  if (w) {
    try {
      try { w.opener = null; } catch (_) {}
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.onload = () => { setTimeout(() => { try { w.focus(); w.print(); } catch (e) { console.warn('Print failed', e); } }, 300); };
      return;
    } catch (e) {
      console.warn('Popup print failed, falling back to iframe:', e);
      try { w.close(); } catch(_){ }
    }
  }

  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const idoc = iframe.contentWindow || iframe.contentDocument;
    const doc = idoc.document || idoc;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try { (iframe.contentWindow || iframe).focus(); (iframe.contentWindow || iframe).print(); } catch (e) { console.warn('Iframe print failed', e); alert('Printing failed — try Download PDF instead.'); }
      setTimeout(() => { try { iframe.remove(); } catch (_) {} }, 500);
    }, 500);
  } catch (e) {
    console.warn('Fallback iframe print failed', e);
    alert('Unable to print. Please use the Download PDF button or enable popups for this site.');
  }
}

// Download PDF helper: takes report HTML and date string for filename
function downloadReportPdfImpl(reportHtml, dateStr) {
  console.log('[REPORTS] downloadReportPdfImpl called');
  const element = document.createElement('div');
  element.style.maxWidth = '900px';
  element.style.margin = '0 auto';
  element.innerHTML = reportHtml;
  document.body.appendChild(element);
  console.log('[REPORTS] report HTML appended to DOM for PDF generation');

  // Try to clone visible legend DOMs into the printable report so html2pdf captures labels/percentages
  try {
    const insertLegendIntoReport = (sectionTitle, legendId) => {
      try {
        const liveLegend = document.getElementById(legendId);
        if (!liveLegend) return;
        const headers = element.querySelectorAll('h3');
        let target = null;
        headers.forEach(h => { if (h.textContent && h.textContent.trim().toLowerCase().includes(sectionTitle.toLowerCase())) target = h; });
        if (!target) return;
        let container = target.nextElementSibling || target.parentElement;
        const legendClone = document.createElement('div');
        legendClone.className = 'pdf-legend';
        legendClone.style.cssText = 'margin-top:8px; padding:6px; background:transparent;';
        legendClone.innerHTML = liveLegend.innerHTML;
        const img = container.querySelector && container.querySelector('img.chart-img');
        if (img && img.parentNode) img.parentNode.insertBefore(legendClone, img.nextSibling);
        else container.appendChild(legendClone);
      } catch (e) { /* non-fatal */ }
    };

    insertLegendIntoReport('Appointments by Department', 'departmentLegend');
    insertLegendIntoReport('Appointments by Course', 'courseLegend');
    insertLegendIntoReport('Appointments by Gender', 'genderLegend');
    console.log('[REPORTS] legend cloning attempted');
  } catch (e) { console.warn('Legend cloning failed', e); }

  const opt = {
    margin: 10,
    filename: `Appointments-Report-${dateStr.replace(/\s+/g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    // keep scale conservative to avoid excessive memory/CPU usage
    html2canvas: { scale: Math.min(1.5, window.devicePixelRatio || 1) },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
  };

  const run = () => {
    try {
      console.log('[REPORTS] Running html2pdf now');
      html2pdf().set(opt).from(element).save().then(()=>{
        console.log('[REPORTS] html2pdf save finished');
        setTimeout(() => { try { element.remove(); } catch(_){} }, 500);
      }).catch(err => {
        console.warn('[REPORTS] html2pdf save error', err);
        try { element.remove(); } catch(_){}
        alert('PDF generation failed. You can use the Print button and choose "Save as PDF".');
      });
    } catch (e) {
      console.warn('html2pdf failed', e);
      element.remove();
      alert('PDF generation failed. You can use the Print button and choose "Save as PDF".');
    }
  };

  if (typeof html2pdf === 'undefined') {
    const localUrl = '/JS/html2pdf.bundle.min.js';
    const cdnUrl = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    // Try to load local script first by inserting a <script> tag directly. Avoid doing HEAD requests to the server.
    const loadScript = (src, onload, onerror) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = onload;
      s.onerror = onerror;
      document.head.appendChild(s);
    };

    let triedCdn = false;
    loadScript(localUrl, () => { console.log('[REPORTS] html2pdf script loaded (local).'); run(); }, () => {
      console.warn('[REPORTS] html2pdf local load failed, falling back to CDN');
      if (triedCdn) { element.remove(); alert('Failed to load PDF library. Use Print instead.'); return; }
      triedCdn = true;
      loadScript(cdnUrl, () => { console.log('[REPORTS] html2pdf script loaded (cdn).'); run(); }, () => { console.error('[REPORTS] html2pdf CDN load failed'); element.remove(); alert('Failed to load PDF library. Use Print instead.'); });
    });
  } else run();
}

// Expose global wrappers that build the report then call helpers
window.printReport = function() {
  try {
    const { reportContent } = buildReportContent();
    openPrintWindow(reportContent);
  } catch (e) { console.error('printReport wrapper failed', e); alert('Print failed. See console for details.'); }
};

window.downloadReportPdf = function() {
  try {
    console.log('[REPORTS] downloadReportPdf wrapper called');
    const { reportContent, dateStr } = buildReportContent();
    console.log('[REPORTS] Built report content, invoking downloadReportPdf');
    downloadReportPdfImpl(reportContent, dateStr);
  } catch (e) { console.error('downloadReportPdf wrapper failed', e); alert('PDF download failed. See console for details.'); }
};

// Wire print button
document.addEventListener('DOMContentLoaded', () => {
  const printBtn = document.getElementById('printReportBtn');
  const downloadBtn = document.getElementById('downloadPdfBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => { if (window.printReport) window.printReport(); });
  }
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => { if (window.downloadReportPdf) window.downloadReportPdf(); });
  }
});
