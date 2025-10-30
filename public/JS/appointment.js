/* appointment.js
   Handles: step navigation, calendar rendering, time-slot selection,
   skipping schedule for 'Crisis', confirmation, and submission.
*/

(() => {
  // Elements
  const steps = Array.from(document.querySelectorAll('.step'));
  const stepItems = Array.from(document.querySelectorAll('.step-item'));
  const totalSteps = 5;
  let currentStep = 1;

  // Step controls
  const toStep2Btn = document.getElementById('toStep2');
  const toStep3Btn = document.getElementById('toStep3');
  const toStep4Btn = document.getElementById('toStep4');
  const submitBtn = document.getElementById('submitBtn');

  const backTo1 = document.getElementById('backTo1');
  const backTo2 = document.getElementById('backTo2');
  const backTo3 = document.getElementById('backTo3');

  // Inputs
  const urgencyRadios = document.getElementsByName('urgency');
  const reasonInput = document.getElementById('reason');
  const charCount = document.getElementById('charCount');

  const studentid = document.getElementById('studentid');
  const fname = document.getElementById('fname');
  const mname = document.getElementById('mname');
  const lname = document.getElementById('lname');
  const suffix = document.getElementById('suffix');
  const course = document.getElementById('course');
  const year = document.getElementById('year');
  const contact = document.getElementById('contact');
  const email = document.getElementById('email');

  // Calendar and slots
  const calendarGrid = document.getElementById('calendarGrid');
  const monthLabel = document.getElementById('monthLabel');
  const prevMonth = document.getElementById('prevMonth');
  const nextMonth = document.getElementById('nextMonth');

  const morningSlots = document.getElementById('morningSlots');
  const afternoonSlots = document.getElementById('afternoonSlots');

  // Confirmation elements
  const confName = document.getElementById('confName');
  const confID = document.getElementById('confID');
  const confCourse = document.getElementById('confCourse');
  const confYear = document.getElementById('confYear');
  const confContact = document.getElementById('confContact');
  const confEmail = document.getElementById('confEmail');
  const confUrgency = document.getElementById('confUrgency');
  const confDate = document.getElementById('confDate');
  const confTime = document.getElementById('confTime');
  const confReason = document.getElementById('confReason');
  const agree = document.getElementById('agree');

  const refNumberEl = document.getElementById('refNumber');
  const expectedTimeEl = document.getElementById('expectedTime');
  const submittedSummary = document.getElementById('submittedSummary');
  const goHome = document.getElementById('goHome');

  // Footer year
  // footerYear id renamed to avoid conflict with the form 'year' select input
  const footerYearEl = document.getElementById('footerYear');
  if(footerYearEl) footerYearEl.textContent = new Date().getFullYear();

  // State
  let selectedUrgency = null;
  let selectedDate = null; // Date object
  let selectedTime = null; // time string
  let calendarDate = new Date(); // month being viewed
  let bookedSlotsByDate = {}; // demo store: yyyy-mm-dd => [times]

  // Time slot definitions
  const morningTimes = ['9:00 AM','10:00 AM','11:00 AM'];
  const afternoonTimes = ['2:00 PM','3:00 PM','4:00 PM'];

  /* ------------------- Utilities ------------------- */
  const pad = n => (n < 10 ? '0'+n : n);
  const toKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const formatDateLong = d => d.toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' });

  /* ------------------- Step navigation ------------------- */
  function showStep(n){
    steps.forEach((s, idx) => s.classList.toggle('active', idx === n-1));
    stepItems.forEach(si => si.classList.toggle('active', Number(si.dataset.step) <= n));
    currentStep = n;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if(n === 4) fillConfirmation();
  }

  function getSelectedUrgency(){
    for(const r of urgencyRadios) if(r.checked) return r.value;
    return null;
  }

  // Char counting
  reasonInput.addEventListener('input', () => {
    charCount.textContent = `${reasonInput.value.length} / ${reasonInput.maxLength}`;
  });

  // Step1 -> Step2
  toStep2Btn.addEventListener('click', () => {
    const urg = getSelectedUrgency();
    if(!urg){ alert('Please choose an urgency level.'); return; }
    if(!reasonInput.value.trim()){ alert('Please describe your concern.'); return; }
    selectedUrgency = urg;
    showStep(2);
  });

  backTo1 && backTo1.addEventListener('click', ()=> showStep(1));

  // Step2 -> Step3 or skip if Crisis
  toStep3Btn.addEventListener('click', () => {
    // basic validation
    if(!studentid.value.trim() || !fname.value.trim() || !lname.value.trim() || !course.value || !year.value || !contact.value.trim() || !email.value.trim()){
      alert('Please complete required fields in Step 2.');
      return;
    }
    selectedUrgency = selectedUrgency || getSelectedUrgency();
    if(selectedUrgency === 'Crisis'){
      // skip schedule and go to confirmation
      showStep(4);
      fillConfirmation();
    } else {
      showStep(3);
      renderCalendar();
      renderTimeSlots();
    }
  });

  backTo2 && backTo2.addEventListener('click', ()=> showStep(2));

  // Step3 navigation
  backTo3 && backTo3.addEventListener('click', ()=> {
    // If crisis was selected earlier, going back should go to step2
    showStep(2);
  });

  toStep4Btn.addEventListener('click', () => {
    if(selectedUrgency !== 'Crisis' && (!selectedDate || !selectedTime)){
      alert('Please choose a date and time slot.');
      return;
    }
    showStep(4);
    fillConfirmation();
  });

  // Submit
  submitBtn.addEventListener('click', async () => {
    if(!agree.checked){ alert('Please agree to terms and conditions.'); return; }
    if(selectedUrgency !== 'Crisis' && (!selectedDate || !selectedTime)){ alert('Please select schedule.'); return; }

    // prepare payload
    const payload = {
      studentid: studentid.value.trim(),
      fname: fname.value.trim(),
      mname: mname.value.trim(),
      lname: lname.value.trim(),
      suffix: suffix.value.trim(),
      course: course.value,
      year: year.value,
      contact: contact.value.trim(),
      email: email.value.trim(),
      urgency: selectedUrgency || getSelectedUrgency(),
      reason: reasonInput.value.trim(),
      date: selectedDate ? toKey(selectedDate) : null,
      time: selectedTime || null
    };

    try{
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if(res.status === 409){
        const err = await res.json();
        alert('Selected time slot is already booked. Please choose another slot.');
        console.warn('Duplicate slot:', err);
        return;
      }
      if(!res.ok) throw new Error('Failed to submit appointment');
      const data = await res.json();

      const ref = data.refNumber || ('JR' + Date.now().toString(36).toUpperCase().slice(-8));
      refNumberEl.textContent = ref;

      if(payload.urgency === 'Crisis'){
        expectedTimeEl.textContent = 'Marked as CRISIS. A counselor will contact you as soon as possible.';
      } else {
        expectedTimeEl.textContent = `Appointment scheduled on ${formatDateLong(selectedDate)} at ${selectedTime}. Please arrive 10 minutes early.`;
        // mark locally so UI updates immediately
        markSlotBooked(selectedDate, selectedTime);
      }

      submittedSummary.innerHTML = `<strong>${fname.value} ${mname.value ? mname.value + ' ' : ''}${lname.value}</strong><br>${course.value} • ${year.value}`;
      showStep(5);
    }catch(err){
      alert('There was an error submitting your appointment. Please try again later.');
      console.error(err);
    }
  });

  goHome && goHome.addEventListener('click', ()=> {
    window.location.href = 'landing.html';
  });

  /* ------------------- Confirmation fill ------------------- */
  function fillConfirmation(){
    const full = `${fname.value} ${mname.value ? mname.value + ' ' : ''}${lname.value}${suffix.value ? ', ' + suffix.value : ''}`.trim();
    confName.textContent = full;
    confID.textContent = studentid.value || '';
    confCourse.textContent = course.value || '';
    confYear.textContent = year.value || '';
    confContact.textContent = contact.value || '';
    confEmail.textContent = email.value || '';
    confUrgency.textContent = selectedUrgency || getSelectedUrgency() || '';
    confDate.textContent = selectedDate ? formatDateLong(selectedDate) : (selectedUrgency === 'Crisis' ? 'N/A' : '');
    confTime.textContent = selectedTime || (selectedUrgency === 'Crisis' ? 'N/A' : '');
    confReason.textContent = reasonInput.value || '';
  }

  /* ------------------- Calendar rendering ------------------- */
  function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
  function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }

  function renderCalendar(){
    calendarGrid.innerHTML = '';
    const first = startOfMonth(calendarDate);
    const last = endOfMonth(calendarDate);
    monthLabel.textContent = calendarDate.toLocaleString(undefined, { month:'long', year:'numeric' });
    const startDay = first.getDay();
    const days = last.getDate();
    // blanks
    for(let i=0;i<startDay;i++){ const blank = document.createElement('div'); calendarGrid.appendChild(blank); }
    const today = new Date();
    for(let d=1; d<=days; d++){
      const dt = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), d);
      const btn = document.createElement('button');
      btn.className = 'day';
      btn.textContent = d;
      if(dt < new Date(today.getFullYear(), today.getMonth(), today.getDate())){
        btn.classList.add('disabled');
        btn.disabled = true;
      } else {
        btn.addEventListener('click', ()=> {
          selectedDate = dt;
          Array.from(calendarGrid.querySelectorAll('.day')).forEach(x => x.classList.remove('selected'));
          btn.classList.add('selected');
          renderTimeSlots();
        });
      }
      if(dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth() && dt.getDate() === today.getDate()){
        btn.classList.add('today');
      }
      if(selectedDate && dt.getFullYear() === selectedDate.getFullYear() && dt.getMonth() === selectedDate.getMonth() && dt.getDate() === selectedDate.getDate()){
        btn.classList.add('selected');
      }
      calendarGrid.appendChild(btn);
    }
  }
// Percentage = (currentStep - 1) / (totalSteps - 1) * 100
const total = 5;
function setProgress(current){
  const pct = ((current - 1) / (total - 1)) * 100;
  document.querySelector('.stepper').style.setProperty('--progress', pct + '%');
}
// call setProgress(1..5) when showing a step

  prevMonth.addEventListener('click', ()=> {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth()-1, 1);
    renderCalendar();
  });
  nextMonth.addEventListener('click', ()=> {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth()+1, 1);
    renderCalendar();
  });

  // Example (call this after you change the visible step)
// current is 1..5 (total steps = 5)
function setProgress(current){
  const percent = ((current - 1) / (5 - 1)) * 100;
  document.querySelector('.stepper').style.setProperty('--progress', percent + '%');
}


  /* ------------------- Time slot rendering ------------------- */
  async function fetchBookedSlotsFor(dateObj){
    const key = toKey(dateObj);
    try{
      const res = await fetch(`/api/bookedSlots?date=${encodeURIComponent(key)}`);
      if(!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      // expect { booked: ['9:00 AM', ...] }
      return data.booked || [];
    }catch(err){
      // fallback to demo store
      return bookedSlotsByDate[key] || [];
    }
  }

  async function renderTimeSlots(){
    morningSlots.innerHTML = '';
    afternoonSlots.innerHTML = '';

    // default to today if none selected
    const t = new Date();
    if(!selectedDate) {
      selectedDate = new Date(t.getFullYear(), t.getMonth(), t.getDate());
      // highlight today's button if present
      Array.from(calendarGrid.querySelectorAll('.day')).forEach(b => {
        if(Number(b.textContent) === selectedDate.getDate()) b.classList.add('selected'); else b.classList.remove('selected');
      });
    }

  const key = toKey(selectedDate);
  const booked = await fetchBookedSlotsFor(selectedDate);

    const makeSlot = (time, container) => {
      const el = document.createElement('div');
      el.className = 'time-slot';
      el.textContent = time;
      if(booked.includes(time)){
        el.classList.add('booked');
      } else {
        el.addEventListener('click', ()=> {
          Array.from(container.querySelectorAll('.time-slot')).forEach(x => x.classList.remove('selected'));
          el.classList.add('selected');
          selectedTime = time;
        });
        if(selectedTime === time) el.classList.add('selected');
      }
      return el;
    };

    morningTimes.forEach(t => morningSlots.appendChild(makeSlot(t, morningSlots)));
    afternoonTimes.forEach(t => afternoonSlots.appendChild(makeSlot(t, afternoonSlots)));
  }

  /* ------------------- Demo booked slots seeding ------------------- */
  function seedDemo(){
    const base = new Date();
    for(let i=0;i<12;i++){
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const key = toKey(d);
      const arr = [];
      if(d.getDate() % 2 === 0) arr.push(morningTimes[1], afternoonTimes[2]);
      if(d.getDate() % 3 === 0) arr.push(morningTimes[3]);
      bookedSlotsByDate[key] = Array.from(new Set(arr));
    }
  }

  function markSlotBooked(dateObj, timeStr){
    const key = toKey(dateObj);
    if(!bookedSlotsByDate[key]) bookedSlotsByDate[key] = [];
    if(!bookedSlotsByDate[key].includes(timeStr)) bookedSlotsByDate[key].push(timeStr);
  }

  // initialize
  seedDemo();
  renderCalendar();
  renderTimeSlots();

  // when returning from step4 to step3 ensure selected are visible
  backTo3 && backTo3.addEventListener('click', ()=> {
    if(selectedUrgency === 'Crisis'){ showStep(2); return; }
    showStep(3);
    renderCalendar();
    renderTimeSlots();
  });

  // keep selectedUrgency synced when changed
  Array.from(urgencyRadios).forEach(r => r.addEventListener('change', ()=> {
    selectedUrgency = getSelectedUr();
  }));

  // utility get selected urgency
  function getSelectedUr(){ for(const r of urgencyRadios) if(r.checked) return r.value; return null; }

})();
