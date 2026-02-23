// Shared UI modal helper. Registers showActionModal globally and overrides window.alert
(function(){
  if (window.showActionModal) return; // don't overwrite if defined elsewhere

  function createModalIfNeeded(){
    if (document.getElementById('actionResultModal')) return document.getElementById('actionResultModal');
    const div = document.createElement('div');
    div.id = 'actionResultModal';
    div.className = 'modal';
    div.style.display = 'none';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.position = 'fixed';
    div.style.top = '0'; div.style.left = '0'; div.style.width = '100%'; div.style.height = '100%';
    div.style.background = 'rgba(0,0,0,0.45)';
    div.style.zIndex = '3000';
    div.style.padding = '24px';
    div.style.boxSizing = 'border-box';

    // Generated modal intentionally omits the close (X) button — OK is sufficient for action notices.
    div.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="actionResultTitle">Message</h3>
        </div>
        <div class="modal-body">
          <div id="actionResultMessage" class="action-result-message"></div>
        </div>
        <div class="modal-footer">
          <button id="actionResultOkBtn" class="btn primary">OK</button>
        </div>
      </div>`;

    // Mark this modal as dynamically generated so styles can be scoped without
    // affecting any hard-coded modal markup that may exist in admin pages.
    div.dataset.generated = 'true';
    div.classList.add('generated-action-modal');
    document.body.appendChild(div);
    return div;
  }

  function showActionModal(message, options){
    const modal = createModalIfNeeded();
    const titleEl = modal.querySelector('#actionResultTitle');
    const msgEl = modal.querySelector('#actionResultMessage');
    const okBtn = modal.querySelector('#actionResultOkBtn');
    const closeBtn = modal.querySelector('#actionResultCloseBtn'); // may be null for generated modal

    titleEl.textContent = (options && options.title) || ((options && options.type === 'error') ? 'Error' : 'Notice');
    if (typeof message === 'string') msgEl.textContent = message; else msgEl.textContent = JSON.stringify(message);

    // Apply a login-specific error modifier so only the login/action modal gets the alternate styling
    const contentEl = modal.querySelector('.modal-content');
    // Only apply the alternate styling for modals that were dynamically created
    // by this script (e.g., the login/action modal). Do not modify pre-existing
    // admin modal markup to avoid changing the admin alert design.
    if (contentEl && modal.dataset.generated === 'true') {
      if (options && options.type === 'error') contentEl.classList.add('action-modal-error'); else contentEl.classList.remove('action-modal-error');
    }

    // If this modal was dynamically generated, ensure its OK button is styled
    if (modal.dataset.generated === 'true') {
      try{
        okBtn.style.padding = '8px 14px';
        okBtn.style.borderRadius = '8px';
        okBtn.style.minWidth = '84px';
        okBtn.style.fontWeight = '700';
        okBtn.style.border = 'none';
        okBtn.style.cursor = 'pointer';
        okBtn.style.background = '#0a2342';
        okBtn.style.color = '#fff';
        okBtn.style.boxShadow = '0 8px 20px rgba(10,34,66,0.08)';
      }catch(e){/* ignore styling failures */}
    }

    // Keyboard handler for accessibility (Escape closes, Enter confirms)
    let keyHandler = null;
    if (modal.dataset.generated === 'true') {
      keyHandler = function(e){
        if (e.key === 'Escape') { onClose(); }
        else if (e.key === 'Enter') { onOk(); }
      };
      document.addEventListener('keydown', keyHandler);
    }

    function cleanup(){
      modal.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      if (closeBtn) closeBtn.removeEventListener('click', onClose);
      if (keyHandler) document.removeEventListener('keydown', keyHandler);
    }
    function onOk(){ if (options && typeof options.onOk === 'function') { try{ options.onOk(); }catch(e){ console.error(e);} } cleanup(); }
    function onClose(){ cleanup(); }

    okBtn.addEventListener('click', onOk);
    if (closeBtn) closeBtn.addEventListener('click', onClose);
    modal.style.display = 'flex';
  }

  // Expose globally
  window.showActionModal = showActionModal;

  // Override default alert to use modal (non-blocking). If code relies on blocking behavior, consider replacing calls manually.
  window.alert = function(msg){ try{ showActionModal(String(msg)); }catch(e){ console.error('alert replacement failed', e); }};
})();
