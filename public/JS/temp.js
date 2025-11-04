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
    const tdStatus = document.createElement('td'); tdStatus.appendChild(createStatus(r.status || 'Pending', r.date)); tr.appendChild(tdStatus);

    const tdAction = document.createElement('td'); tdAction.className = 'actions';
    
    // Only show approve and reschedule buttons for pending appointments that haven't passed their date
    const status = (r.status || '').toString().toLowerCase();
    const today = new Date().toISOString().slice(0,10);
    
    // Create view button - always visible
    const viewBtn = document.createElement('button'); viewBtn.className='action-btn'; viewBtn.innerHTML='👁️'; viewBtn.title='View Details';
    viewBtn.addEventListener('click', () => viewAppointmentDetails(tr.dataset.ref));
    
    // Only add approve and reschedule buttons if not approved/rescheduled and not past due date
    if (status !== 'approved' && status !== 'rescheduled/approved' && r.date >= today) {
      const approveBtn = document.createElement('button'); 
      approveBtn.className='action-btn'; 
      approveBtn.innerHTML='✔️'; 
      approveBtn.title='Approve';
      approveBtn.addEventListener('click', () => handleAdminActionApprove(tr.dataset.ref, tr));
      
      const rescheduleBtn = document.createElement('button'); 
      rescheduleBtn.className='action-btn'; 
      rescheduleBtn.innerHTML='📅'; 
      rescheduleBtn.title='Reschedule';
      rescheduleBtn.addEventListener('click', () => handleAdminActionDeny(tr.dataset.ref, tr));
      
      tdAction.appendChild(approveBtn);
      tdAction.appendChild(rescheduleBtn);
    }
    
    tdAction.appendChild(viewBtn);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  });
}