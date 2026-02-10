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

    div.innerHTML = `
      <div class="modal-content" style="width:100%; max-width:420px; background:#fff; border-radius:10px; padding:1rem; box-shadow:0 20px 60px rgba(0,0,0,0.18); box-sizing:border-box;">
        <div class="modal-header">
          <h3 id="actionResultTitle">Message</h3>
          <button class="close-modal" id="actionResultCloseBtn">&times;</button>
        </div>
        <div class="modal-body">
          <div id="actionResultMessage" style="font-size:1rem; color:#0f172a; line-height:1.4;"></div>
        </div>
        <div class="modal-footer">
          <button id="actionResultOkBtn" class="btn" style="background:#0a2342; color:#fff; border:none; padding:0.6rem 1rem; border-radius:8px;">OK</button>
        </div>
      </div>`;

    document.body.appendChild(div);
    return div;
  }

  function showActionModal(message, options){
    const modal = createModalIfNeeded();
    const titleEl = modal.querySelector('#actionResultTitle');
    const msgEl = modal.querySelector('#actionResultMessage');
    const okBtn = modal.querySelector('#actionResultOkBtn');
    const closeBtn = modal.querySelector('#actionResultCloseBtn');

    titleEl.textContent = (options && options.title) || ((options && options.type === 'error') ? 'Error' : 'Notice');
    if (typeof message === 'string') msgEl.textContent = message; else msgEl.textContent = JSON.stringify(message);

    function cleanup(){
      modal.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      closeBtn.removeEventListener('click', onClose);
    }
    function onOk(){ if (options && typeof options.onOk === 'function') { try{ options.onOk(); }catch(e){ console.error(e);} } cleanup(); }
    function onClose(){ cleanup(); }

    okBtn.addEventListener('click', onOk);
    closeBtn.addEventListener('click', onClose);
    modal.style.display = 'flex';
  }

  // Expose globally
  window.showActionModal = showActionModal;

  // Override default alert to use modal (non-blocking). If code relies on blocking behavior, consider replacing calls manually.
  window.alert = function(msg){ try{ showActionModal(String(msg)); }catch(e){ console.error('alert replacement failed', e); }};
})();
