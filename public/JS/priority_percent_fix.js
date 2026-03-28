// Recompute priority distribution legend with two-decimal percentages
(function(){
  function renderPriorityLegend() {
    const legendEl = document.getElementById('chartLegend');
    if (!legendEl) return false;

    const source = (window.appointments && Array.isArray(window.appointments)) ? window.appointments : (window.reportsAppointments && Array.isArray(window.reportsAppointments) ? window.reportsAppointments : []);
    const counts = { Crisis: 0, High: 0, Medium: 0, Low: 0 };
    source.forEach(a => {
      const u = (a.urgency || a.priority || 'Low').toString();
      if (u.includes('Crisis')) counts.Crisis++;
      else if (u.includes('High')) counts.High++;
      else if (u.includes('Medium')) counts.Medium++;
      else counts.Low++;
    });

    const labels = ['Crisis', 'High', 'Medium', 'Low'];
    const data = labels.map(l => counts[l] || 0);
    const total = data.reduce((s, v) => s + v, 0) || 0;

    // compute two-decimal percentages and assign remainder to last
    const pcts = [];
    if (total) {
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const p = Number(((data[i] / total) * 100).toFixed(2));
        pcts.push(p);
        sum += p;
      }
      const diff = Number((100 - sum).toFixed(2));
      pcts[pcts.length - 1] = Number((pcts[pcts.length - 1] + diff).toFixed(2));
    } else {
      for (let i = 0; i < data.length; i++) pcts.push(0);
    }

    // palette similar to other charts
    const colors = ['#ef4444', '#f97316', '#eab308', '#10b981'];

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

    return true;
  }

  // Try to render several times until appointments are available, then stop
  let attempts = 0;
  const interval = setInterval(() => {
    attempts += 1;
    const done = renderPriorityLegend();
    if (done || attempts > 12) clearInterval(interval);
  }, 500);

  // Also expose a manual trigger
  window.rebuildPriorityLegend = renderPriorityLegend;
})();
