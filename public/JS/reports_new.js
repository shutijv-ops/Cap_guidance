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
let reportsAppointments = [];

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
function renderCollegeChart(appointments) {
  console.log('[REPORTS] Rendering college chart');

  const collegeMap = {};
  (appointments || []).forEach(apt => {
    const college = apt.college || apt.schoolName || 'Unknown';
    collegeMap[college] = (collegeMap[college] || 0) + 1;
  });

  const labels = Object.keys(collegeMap);
  const data = Object.values(collegeMap);
  const colors = labels.map((_, i) => DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]);

  const canvas = document.getElementById('collegeDonut');
  if (!canvas) {
    console.warn('[REPORTS] College canvas not found');
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
                const percentage = ((value / total) * 100).toFixed(1);
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
      const legendEl = document.getElementById('collegeLegend');
      if (legendEl) {
        legendEl.innerHTML = labels.map((label, i) => {
          const value = data[i] || 0;
          const pct = total ? Math.round((value / total) * 100) : 0;
          const color = colors[i] || '#ccc';
          return `\n            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">\n              <div style="display:flex; align-items:center; gap:8px;">\n                <span style="width:12px; height:12px; background:${color}; border-radius:3px; display:inline-block; box-shadow:0 0 0 1px rgba(0,0,0,0.04);"></span>\n                <div style="color:#1e293b; font-weight:600; font-size:13px;">${label}</div>\n              </div>\n              <div style="color:#64748b; font-size:13px;">${pct}%</div>\n            </div>`;
        }).join('');
      }
    } catch (e) {
      console.warn('[REPORTS] College legend render failed', e);
    }
    console.log('[REPORTS] ✅ College chart created');
    try { window.collegeChart = collegeDonutChart; } catch(e){}
  } catch (e) {
    console.error('[REPORTS] College chart error:', e);
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
                const percentage = ((value / total) * 100).toFixed(1);
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
        legendEl.innerHTML = labels.map((label, i) => {
          const value = data[i] || 0;
          const pct = total ? Math.round((value / total) * 100) : 0;
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

  // Fetch data
  let months = getMonths();
  let appointments = [];
  
  try {
    console.log('[REPORTS] Fetching monthly data...');
    const res = await fetch('/api/reports/monthly?year=' + new Date().getFullYear());
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
    const res = await fetch('/api/appointments');
    if (res.ok) {
      const data = await res.json();
      appointments = data.appointments || [];
      reportsAppointments = appointments;
      console.log('[REPORTS] Got appointments:', appointments.length);
    }
  } catch (e) {
    console.warn('[REPORTS] Appointments fetch failed:', e);
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
        maintainAspectRatio: true,
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
        maintainAspectRatio: true,
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

  // Render distribution charts
  if (appointments.length > 0) {
    renderCollegeChart(appointments);
    renderCourseChart(appointments);
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
});

// Export
window.initReports = initReports;

// ===== PDF Export (print report) =====
async function printReport() {
  const monthCount = document.getElementById('reportMonthCount')?.textContent || '0';
  const avgSession = document.getElementById('reportAvgSession')?.textContent || '0';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US');

  // Capture chart images if available
  let barChartImage = '';
  let lineChartImage = '';
  try {
    if (window.monthlyChart && window.monthlyChart.canvas) barChartImage = window.monthlyChart.canvas.toDataURL('image/png');
    if (window.urgencyChart && window.urgencyChart.canvas) lineChartImage = window.urgencyChart.canvas.toDataURL('image/png');
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

  const crisisPercent = totalAppointments > 0 ? ((crisisCount / totalAppointments) * 100).toFixed(1) : 0;
  const highPercent = totalAppointments > 0 ? ((highCount / totalAppointments) * 100).toFixed(1) : 0;
  const mediumPercent = totalAppointments > 0 ? ((mediumCount / totalAppointments) * 100).toFixed(1) : 0;
  const lowPercent = totalAppointments > 0 ? ((lowCount / totalAppointments) * 100).toFixed(1) : 0;

  // Build report HTML (kept compact but styled)
  const reportContent = `
    <div id="reportPDF" style="font-family: 'Inter', Arial, sans-serif; color: #111827; background:#fff; padding:20px;">
      <div style="max-width:900px; margin:0 auto;">
        <div style="border-bottom:3px solid #6366f1; padding-bottom:20px; margin-bottom:20px;">
          <h1 style="margin:0; font-size:24px; color:#0b1220;">Appointments Report</h1>
          <div style="color:#6b7280; font-size:13px; margin-top:6px;">Generated: ${dateStr} ${timeStr}</div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
          <div style="background:#f8fafc; padding:12px; border-radius:8px;">
            <div style="font-size:12px; color:#6b7280;">This Month</div>
            <div style="font-size:20px; font-weight:700;">${monthCount}</div>
          </div>
          <div style="background:#f8fafc; padding:12px; border-radius:8px;">
            <div style="font-size:12px; color:#6b7280;">Avg. Sessions / Month</div>
            <div style="font-size:20px; font-weight:700;">${avgSession}</div>
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <h2 style="font-size:16px; margin:0 0 8px 0;">Monthly Appointments Trend</h2>
          <div style="background:#fff; border:1px solid #e6eef8; padding:12px; border-radius:8px; text-align:center;">
            ${barChartImage ? `<img src="${barChartImage}" style="max-width:100%; height:auto; max-height:300px;"/>` : '<div style="color:#6b7280;">Bar chart not available</div>'}
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <h2 style="font-size:16px; margin:0 0 8px 0;">Urgency Trend Analysis</h2>
          <div style="background:#fff; border:1px solid #e6eef8; padding:12px; border-radius:8px; text-align:center;">
            ${lineChartImage ? `<img src="${lineChartImage}" style="max-width:100%; height:auto; max-height:300px;"/>` : '<div style="color:#6b7280;">Line chart not available</div>'}
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <h2 style="font-size:16px; margin:0 0 8px 0;">Monthly Data Summary</h2>
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr>
                <th style="text-align:left; padding:8px; background:#6366f1; color:#fff;">Month</th>
                <th style="text-align:left; padding:8px; background:#6366f1; color:#fff;">Total</th>
                <th style="text-align:left; padding:8px; background:#6366f1; color:#fff;">Crisis</th>
                <th style="text-align:left; padding:8px; background:#6366f1; color:#fff;">High</th>
                <th style="text-align:left; padding:8px; background:#6366f1; color:#fff;">Medium</th>
                <th style="text-align:left; padding:8px; background:#6366f1; color:#fff;">Low</th>
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

        <div style="margin-bottom:20px;">
          <h2 style="font-size:16px; margin:0 0 8px 0;">Key Metrics</h2>
          <div style="background:#f9fafb; padding:12px; border-radius:8px;">
            <div style="font-size:13px;">Total Appointments: <strong>${totalAppointments}</strong></div>
            <div style="font-size:13px;">Crisis: <strong>${crisisCount}</strong> (${crisisPercent}%)</div>
            <div style="font-size:13px;">High: <strong>${highCount}</strong> (${highPercent}%)</div>
            <div style="font-size:13px;">Medium: <strong>${mediumCount}</strong> (${mediumPercent}%)</div>
            <div style="font-size:13px;">Low: <strong>${lowCount}</strong> (${lowPercent}%)</div>
          </div>
        </div>

      </div>
    </div>
  `;

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

  if (typeof html2pdf === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = function() { html2pdf().set(opt).from(element).save(); setTimeout(() => element.remove(), 500); };
    document.head.appendChild(script);
  } else {
    html2pdf().set(opt).from(element).save();
    setTimeout(() => element.remove(), 500);
  }
}

// Wire print button
document.addEventListener('DOMContentLoaded', () => {
  const printBtn = document.getElementById('printReportBtn');
  if (printBtn) {
    printBtn.addEventListener('click', printReport);
  }
});
