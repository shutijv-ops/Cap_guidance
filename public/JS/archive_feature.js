// Archive feature: add 'Archive Selected' button and handlers
(function(){
  // Ensure each row has a small archive icon (replaces checkbox + bulk action)
  function ensureRowArchiveIcons() {
    const table = document.querySelector('#appointmentsTable');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
      if (tr.querySelector('.row-archive-btn')) return;
      // If this row already has a Restore control (archived row), don't add an Archive button
      const hasRestoreButton = Array.from(tr.querySelectorAll('button')).some(b => (b.textContent||'').trim().toLowerCase() === 'restore' || b.classList.contains('restore-btn'));
      if (hasRestoreButton) return;
      // create a small archive button positioned in the row's actions area
      const btn = document.createElement('button');
      btn.className = 'row-archive-btn';
      btn.title = 'Archive appointment';
      btn.style.border = 'none';
      btn.style.background = 'transparent';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '14px';
      btn.style.marginLeft = '8px';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 7h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 11h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation(); ev.preventDefault();
        // attempt to extract ref from the row
        let ref = tr.getAttribute('data-ref') || tr.getAttribute('data-id') || tr.dataset.ref || tr.dataset.refnumber || tr.dataset.refNumber || '';
        if (!ref) {
          const apptId = tr.getAttribute('data-appt-id') || tr.dataset.apptId || tr.dataset.apptid || '';
          if (apptId) ref = apptId;
        }
        if (!ref) {
          const el = tr.querySelector('[data-ref],[data-id],[data-ref-number],[data-refnumber],[data-refNumber]');
          if (el) ref = el.getAttribute('data-ref') || el.getAttribute('data-id') || el.getAttribute('data-ref-number') || el.getAttribute('data-refnumber') || el.dataset.ref || el.dataset.refnumber || '';
        }
        if (!ref) {
          const btn2 = tr.querySelector('button.view-appt-btn, button.more-btn, button[data-ref], a[data-ref]');
          if (btn2) ref = btn2.getAttribute('data-ref') || btn2.getAttribute('data-id') || btn2.dataset.ref || btn2.dataset.refnumber || '';
        }
        if (!ref) {
          const txt = (tr.textContent || '').trim();
          const m = txt.match(/\bJR[0-9A-Z]{4,}\b/);
          if (m) ref = m[0];
        }
        if (!ref) { console.warn('Archive: could not determine ref for row', tr); return; }
        try {
          const r = await fetch(`/api/appointments/${encodeURIComponent(ref)}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: true }) });
          if (!r.ok) {
            const txt = await r.text().catch(()=>null);
            console.error('archive failed', r.status, txt);
            if (typeof showActionModal === 'function') showActionModal(`Archive failed: ${r.status} ${txt || ''}`);
            else alert(`Archive failed: ${r.status} ${txt || ''}`);
            return;
          }
          // Prefer to trigger the app's table refresh if available so all
          // related UI state (counts, pagination) stays consistent.
          try {
            if (typeof loadRemoteData === 'function' && typeof populateAppointmentsTable === 'function') {
              await loadRemoteData();
              try { populateAppointmentsTable(); } catch (e) { console.warn('populateAppointmentsTable failed', e); }
            } else {
              // fallback: remove this row and update archived pill
              tr.remove();
              const pill = document.querySelector('#tabArchived .pill'); if (pill) pill.textContent = Math.max(0, (parseInt(pill.textContent||'0',10) + 1));
            }
          } catch (e) {
            // if anything goes wrong, fallback to simple row removal
            console.warn('archive refresh failed, falling back to row removal', e);
            try { tr.remove(); } catch (er) { /* ignore */ }
          }
          // emit an event for other parts of the app to react to
          try { document.dispatchEvent(new CustomEvent('appointment:archived', { detail: { ref } })); } catch (e) { /* ignore */ }
        } catch (err) { console.error('archive failed', err); if (typeof showActionModal === 'function') showActionModal('Archive failed. See console for details.'); else alert('Archive failed. See console for details.'); }
      });

      // try to append into an actions cell if present
      const actions = tr.querySelector('td.actions, td.actions-cell, td.actions_col, td:last-child');
      if (actions) actions.appendChild(btn);
      else tr.appendChild(btn);
    });
  }

  

  function ensureButton() {
    const container = document.querySelector('.view[data-view="appointments"] .page-actions');
    if (!container) return;
    // Add archive icon button in the page-actions area (right corner)
    const tabs = document.getElementById('appointmentTabs');
    if (!document.getElementById('tabArchived')) {
      const archivedBtn = document.createElement('button');
      archivedBtn.id = 'tabArchived';
      archivedBtn.className = 'btn ghost archived-icon';
      archivedBtn.dataset.filter = 'archived';
      archivedBtn.setAttribute('aria-label', 'Archived');
      archivedBtn.title = 'Archived';
      // icon-only (archive box)
      archivedBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M3 7h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 11h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      // small badge/pill inside button
      const pill = document.createElement('span');
      pill.className = 'pill muted';
      pill.textContent = '0';
      pill.style.marginLeft = '6px';
      pill.style.fontSize = '0.75rem';
      archivedBtn.appendChild(pill);
      archivedBtn.style.pointerEvents = 'auto';
      archivedBtn.tabIndex = 0;
      // place in the right-side actions area if available, otherwise fallback to tabs
      const container = document.querySelector('.view[data-view="appointments"] .page-actions') || tabs;
      if (container) container.appendChild(archivedBtn);

      const openArchived = () => {
        // clear active state on tabs if present
        if (tabs) tabs.querySelectorAll('button.tab').forEach(b => b.classList.remove('active'));
        // Ensure there is a hidden tab button under #appointmentTabs so other code
        // that looks for '#appointmentTabs .tab.active' will see the archived tab.
        try {
          if (tabs) {
            let hiddenArchivedTab = tabs.querySelector('button.tab[data-filter="archived"]');
            if (!hiddenArchivedTab) {
              hiddenArchivedTab = document.createElement('button');
              hiddenArchivedTab.className = 'tab';
              hiddenArchivedTab.setAttribute('data-filter', 'archived');
              hiddenArchivedTab.style.display = 'none';
              tabs.appendChild(hiddenArchivedTab);
            }
            hiddenArchivedTab.classList.add('active');
          }
        } catch (e) { /* ignore DOM issues */ }
        // hide filter controls while viewing archives
        try { hideFiltersForArchived(); } catch (e) { /* ignore */ }
        // prefer existing app flow
        if (typeof populateAppointmentsTable === 'function') {
          try { populateAppointmentsTable('archived'); } catch (e) { console.warn('populateAppointmentsTable_failed', e); loadArchivedAppointments(); }
        } else {
          loadArchivedAppointments();
        }
      };

      archivedBtn.addEventListener('click', (e) => { e.preventDefault(); openArchived(); });
      archivedBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); archivedBtn.click(); } });
      // ensure per-row archive icons are present
      ensureRowArchiveIcons();
    }
  }

  // Attach when DOM is ready and when view toggles
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureButton);
  else ensureButton();
  // also observe DOM in case SPA injects the view later
  const obs = new MutationObserver(() => ensureButton());
  obs.observe(document.body, { childList: true, subtree: true });
  // Ensure checkboxes are present when table content changes
  const tableObserver = new MutationObserver(() => { ensureRowArchiveIcons(); });
  const tableEl = document.querySelector('#appointmentsTable');
  if (tableEl) tableObserver.observe(tableEl, { childList: true, subtree: true });

  // Client-side archived appointments renderer with pagination support
  const _archivedState = { docs: [], pageSize: (window.appointmentsPageSize || 10), currentPage: 1, totalPages: 1 };
  let _savedFilterBarHtml = null;

  function renderArchivedPage(page = 1) {
    const tbody = document.querySelector('#appointmentsTable tbody');
    if (!tbody) return;
    const pageSize = _archivedState.pageSize || (window.appointmentsPageSize || 10);
    const total = (_archivedState.docs || []).length || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    _archivedState.totalPages = totalPages;
    _archivedState.currentPage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (_archivedState.currentPage - 1) * pageSize;
    const pageSlice = (_archivedState.docs || []).slice(startIdx, startIdx + pageSize);
    tbody.innerHTML = '';
    pageSlice.forEach(appt => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-ref', appt.refNumber || appt.ref || appt._id || '');
      const studentTd = document.createElement('td'); studentTd.textContent = `${appt.fname || ''} ${appt.lname || ''}`.trim();
      const typeTd = document.createElement('td');
      typeTd.textContent = appt.course || '-';
      const dtTd = document.createElement('td'); dtTd.textContent = `${appt.date || ''} ${appt.time || ''}`.trim();
      const counselorTd = document.createElement('td'); counselorTd.textContent = appt.counselor || '';
      const priorityTd = document.createElement('td'); priorityTd.textContent = appt.urgency || '';
      const statusTd = document.createElement('td'); statusTd.textContent = appt.status || '';
      const actionsTd = document.createElement('td');
      const restoreBtn = document.createElement('button'); restoreBtn.className = 'btn ghost restore-btn'; restoreBtn.textContent = 'Restore';
      restoreBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if (!confirm('Restore this appointment?')) return;
        try {
          const r = await fetch(`/api/appointments/${encodeURIComponent(tr.getAttribute('data-ref'))}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: false }) });
          if (!r.ok) throw new Error('restore failed');
          _archivedState.docs = (_archivedState.docs || []).filter(d => (d.refNumber || d.ref || d._id || '') !== tr.getAttribute('data-ref'));
          renderArchivedPage(_archivedState.currentPage);
          const pill = document.querySelector('#tabArchived .pill'); if (pill) pill.textContent = Math.max(0, (_archivedState.docs||[]).length);
        } catch (err) { console.error('restore failed', err); alert('Restore failed'); }
      });
      actionsTd.appendChild(restoreBtn);
      // Make the row clickable to view appointment details (but ignore clicks on action buttons)
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', (ev) => {
        ev.stopPropagation(); ev.preventDefault();
        const tgt = ev.target;
        // ignore clicks on buttons/inputs/links inside the row
        if (tgt && (tgt.tagName === 'BUTTON' || tgt.closest && tgt.closest('button') || tgt.tagName === 'A' || tgt.closest && tgt.closest('a') || tgt.tagName === 'INPUT')) return;
        try {
          const wasArchivedActive = document.querySelector('#tabArchived') && document.querySelector('#tabArchived').classList.contains('active');
          if (typeof showAppointmentDetailsModal === 'function') {
            try { showAppointmentDetailsModal(appt); } catch (e) { /* ignore */ }
          } else if (typeof viewAppointmentDetails === 'function') {
            try { viewAppointmentDetails(tr.getAttribute('data-ref')); } catch (e) { /* ignore */ }
          }
          // Some detail modal handlers toggle views; restore archived view state after opening
          setTimeout(() => {
            try {
              if (wasArchivedActive) {
                const tabs = document.getElementById('appointmentTabs');
                if (tabs) {
                  tabs.querySelectorAll('button.tab').forEach(b => b.classList.remove('active'));
                  let hiddenArchivedTab = tabs.querySelector('button.tab[data-filter="archived"]');
                  if (!hiddenArchivedTab) {
                    hiddenArchivedTab = document.createElement('button');
                    hiddenArchivedTab.className = 'tab';
                    hiddenArchivedTab.setAttribute('data-filter', 'archived');
                    hiddenArchivedTab.style.display = 'none';
                    tabs.appendChild(hiddenArchivedTab);
                  }
                  hiddenArchivedTab.classList.add('active');
                }
                try { hideFiltersForArchived(); } catch (e) { /* ignore */ }
              }
            } catch (e) { /* ignore */ }
          }, 50);
        } catch (e) { /* ignore */ }
      });
      tr.appendChild(studentTd);
      tr.appendChild(typeTd);
      tr.appendChild(dtTd);
      tr.appendChild(counselorTd);
      tr.appendChild(priorityTd);
      tr.appendChild(statusTd);
      tr.appendChild(actionsTd);
      tbody.appendChild(tr);
    });
    ensureRowArchiveIcons();
    const pill = document.querySelector('#tabArchived .pill'); if (pill) pill.textContent = ( (_archivedState.docs || []).length || 0 );

    // Update pagination controls to reflect archived dataset
    const pageSize2 = _archivedState.pageSize || (window.appointmentsPageSize || 10);
    const computedTotalPages = Math.max(1, Math.ceil(((_archivedState.docs||[]).length||0) / pageSize2));
    if (typeof renderAppointmentsPagination === 'function') {
      try { renderAppointmentsPagination(computedTotalPages, _archivedState.currentPage); } catch (e) { /* ignore */ }
    } else if (typeof buildPagination === 'function') {
      try { buildPagination('#appointmentsPagination', (_archivedState.docs||[]).length||0, pageSize2, _archivedState.currentPage, (p) => { renderArchivedPage(p); }); } catch (e) { /* ignore */ }
    }
  }

  async function loadArchivedAppointments() {
    try {
      const res = await fetch('/api/appointments?archived=true', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch archived');
      const data = await res.json();
      const docs = data.appointments || data || [];
      _archivedState.docs = docs || [];
      _archivedState.pageSize = window.appointmentsPageSize || _archivedState.pageSize || 10;
      _archivedState.currentPage = 1;
      renderArchivedPage(1);
    } catch (e) { console.error('loadArchivedAppointments error', e); }
  }
  // Hide filter bar when viewing Archives and restore it when leaving
  function hideFiltersForArchived() {
    const fb = document.querySelector('.filter-bar');
    if (!fb) return;
    if (_savedFilterBarHtml === null) _savedFilterBarHtml = fb.innerHTML;
    fb.style.display = 'none';
  }
  function restoreFiltersAfterArchived() {
    const fb = document.querySelector('.filter-bar');
    if (!fb) return;
    fb.style.display = '';
    if (_savedFilterBarHtml !== null) {
      fb.innerHTML = _savedFilterBarHtml;
      _savedFilterBarHtml = null;
    }
    // re-populate filters using the app's functions if available
    try { if (typeof populateFilterCounselors === 'function') populateFilterCounselors(); } catch (e) { /* ignore */ }
  }
  // Global delegated handlers: catch clicks/keydowns on archive tab even if tabs are replaced
  document.addEventListener('click', (e) => {
    try {
      const tb = e.target.closest && (e.target.closest('#appointmentTabs .tab[data-filter="archived"]') || e.target.closest('#tabArchived') || e.target.closest('button[data-filter="archived"]'));
      if (!tb) return;
      // Prevent other tab handlers from running (capture/bubble)
      try { e.stopImmediatePropagation(); } catch (er) { /* ignore */ }
      e.preventDefault();
      const tabs = document.getElementById('appointmentTabs');
      if (tabs) {
        tabs.querySelectorAll('button.tab').forEach(b => b.classList.remove('active'));
      }
      tb.classList.add('active');
      try { hideFiltersForArchived(); } catch (err) { /* ignore */ }
      loadArchivedAppointments();
    } catch (err) { /* ignore delegation errors */ }
  }, true);

  document.addEventListener('keydown', (e) => {
    try {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const focused = document.activeElement;
      if (!focused) return;
      const tb = focused.closest && (focused.closest('#appointmentTabs .tab[data-filter="archived"]') || focused.closest('#tabArchived') || focused.closest('button[data-filter="archived"]'));
      if (!tb) return;
      try { e.stopImmediatePropagation(); } catch (er) { /* ignore */ }
      e.preventDefault();
      tb.click();
    } catch (err) { /* ignore */ }
  }, true);

  // Restore filters when user clicks any non-archived tab/filter control
  document.addEventListener('click', (e) => {
    try {
      const clicked = e.target.closest && e.target.closest('[data-filter]');
      if (!clicked) return;
      const f = clicked.getAttribute('data-filter') || clicked.dataset.filter || '';
      if (f && f.toLowerCase() !== 'archived') {
        try { restoreFiltersAfterArchived(); } catch (er) { /* ignore */ }
      }
    } catch (err) { /* ignore */ }
  }, true);

  // Ensure filters are visible when the active tab is not 'archived'. This
  // handles cases where the filters were hidden but the user navigated away
  // from the Archives view by actions that don't trigger our click handler.
  function ensureFiltersState() {
    try {
      const tabs = document.getElementById('appointmentTabs');
      if (!tabs) return;
      const active = tabs.querySelector('button.tab.active');
      const isArchived = active && ((active.getAttribute('data-filter') || active.dataset.filter || '').toLowerCase() === 'archived');
      if (isArchived) {
        try { hideFiltersForArchived(); } catch (e) { /* ignore */ }
      } else {
        try { restoreFiltersAfterArchived(); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  }

  // Watch for tab changes and keep filter visibility in sync
  try {
    const tabsEl = document.getElementById('appointmentTabs');
    if (tabsEl) {
      const mo = new MutationObserver(() => ensureFiltersState());
      mo.observe(tabsEl, { attributes: true, subtree: true, childList: true });
    }
  } catch (e) { /* ignore */ }

  // Initial sanity check on load
  try { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureFiltersState); else ensureFiltersState(); } catch (e) { /* ignore */ }

  // Realtime updates: subscribe to server-sent events for appointment changes
  if (typeof EventSource !== 'undefined') {
    try {
      const es = new EventSource('/api/appointments/stream');
      const handleApptEvent = (ev) => {
        if (!ev.data) return;
        let obj; try { obj = JSON.parse(ev.data); } catch(e){ return; }
        const appt = obj || {};
        // If appointment was archived, update pill and archived list
        const pill = document.querySelector('#tabArchived .pill');
        const archivedActive = document.querySelector('#tabArchived') && document.querySelector('#tabArchived').classList.contains('active');
        try {
          if (appt.archived === true) {
            if (pill) pill.textContent = String(Math.max(0, (parseInt(pill.textContent||'0',10) + 1)));
            if (typeof _archivedState !== 'undefined' && Array.isArray(_archivedState.docs)) {
              // add to archived docs and refresh if viewing archived
              _archivedState.docs.unshift(appt);
              if (archivedActive) renderArchivedPage(1);
            } else if (archivedActive) {
              loadArchivedAppointments();
            }
          } else if (appt.archived === false) {
            if (pill) pill.textContent = String(Math.max(0, (parseInt(pill.textContent||'0',10) - 1)));
            if (typeof _archivedState !== 'undefined' && Array.isArray(_archivedState.docs)) {
              _archivedState.docs = (_archivedState.docs || []).filter(d => (d.refNumber || d.ref || d._id || '') !== (appt.refNumber || appt.ref || appt._id || ''));
              if (archivedActive) renderArchivedPage(_archivedState.currentPage || 1);
            } else if (archivedActive) {
              loadArchivedAppointments();
            }
          }
        } catch (e) { /* ignore sse handler errors */ }
      };
      es.addEventListener('appointment:update', handleApptEvent);
      es.addEventListener('appointment', handleApptEvent);
      es.onerror = () => { /* EventSource will retry */ };
    } catch (err) { /* ignore SSE init errors */ }
  }
})();
