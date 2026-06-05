const icons = {
  home: '<svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
  user: '<svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>',
  pulse: '<svg viewBox="0 0 24 24"><path d="M3 12h4l2-6 4 12 3-6h5"/></svg>',
  stethoscope: '<svg viewBox="0 0 24 24"><path d="M6 4v6a4 4 0 0 0 8 0V4"/><path d="M14 10v3a5 5 0 0 0 10 0v-1"/><circle cx="20" cy="10" r="2"/></svg>',
  repeat: '<svg viewBox="0 0 24 24"><path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>'
};

const state = {
  user: null,
  selectedCase: null,
  appointmentId: 'APT-1001',
  department: 'General Medicine',
  symptoms: ['Fever', 'Headache', 'Weakness'],
  duration: '1 Week',
  severity: 7,
  temperature: '101-102',
  priority: 'Medium'
};

const roleViews = {
  patient: new Set(['patient-dashboard', 'book-appointment', 'symptom-form', 'ai-summary', 'patient-reports', 'follow-up', 'profile']),
  doctor: new Set(['doctor-dashboard', 'patient-detail', 'doctor-notes', 'notifications'])
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function formObject(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const remaining = [...form.querySelectorAll('input[name="symptomsRemaining"]:checked')].map((input) => input.value);
  if (remaining.length) data.symptomsRemaining = remaining;
  return data;
}

document.querySelectorAll('[data-icon]').forEach((node) => {
  node.innerHTML = icons[node.dataset.icon] || '';
});

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function canOpenView(id) {
  if (id === 'role-home') return true;
  if (!state.user) return ['landing', 'patient-login', 'doctor-login', 'register'].includes(id);
  return roleViews[state.user.role].has(id);
}

function showView(id) {
  if (id === 'role-home') {
    id = state.user?.role === 'doctor' ? 'doctor-dashboard' : state.user?.role === 'patient' ? 'patient-dashboard' : 'landing';
  }
  if (!canOpenView(id)) {
    showToast('This screen belongs to the other portal.');
    id = state.user?.role === 'doctor' ? 'doctor-dashboard' : 'patient-dashboard';
  }
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === id));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setRole(user) {
  state.user = user;
  document.body.classList.remove('guest', 'role-patient', 'role-doctor');
  document.body.classList.add(`role-${user.role}`);
  document.querySelectorAll('.nav-item[data-role]').forEach((item) => {
    item.hidden = !item.dataset.role.split(' ').includes(user.role);
  });
  document.getElementById('portalStatus').textContent =
    user.role === 'doctor' ? `Doctor portal: ${user.department || 'OPD'}` : `Patient portal: ${user.name}`;
}

function collectSymptoms() {
  state.symptoms = [...document.querySelectorAll('#complaints input:checked')].map((input) => input.value);
  state.duration = document.getElementById('durationInput').value;
  state.severity = Number(document.getElementById('severityInput').value);
  state.temperature = document.getElementById('temperatureInput').value;
  state.priority = state.severity >= 8 ? 'High' : state.severity >= 5 ? 'Medium' : 'Low';
  if (state.symptoms.includes('Chest Pain')) state.department = 'Cardiology';
  if (state.symptoms.includes('Dizziness') || state.symptoms.includes('Headache')) state.department = 'Neurology';
  if (state.symptoms.includes('Fever') || state.symptoms.includes('Cough') || state.symptoms.includes('Weakness')) state.department = 'General Medicine';
}

function renderSummary() {
  collectSymptoms();
  document.getElementById('summaryList').innerHTML = `
    <div><span>Symptoms</span><strong>${state.symptoms.join(', ') || 'Not selected'}</strong></div>
    <div><span>Duration</span><strong>${state.duration}</strong></div>
    <div><span>Severity</span><strong>${state.severity}/10</strong></div>
    <div><span>Temperature</span><strong>${state.symptoms.includes('Fever') ? state.temperature : 'Not applicable'}</strong></div>
  `;
  document.getElementById('summaryDepartment').textContent = state.department;
  document.getElementById('summaryPriority').textContent = state.priority;
  document.getElementById('doctorSymptoms').textContent = state.symptoms.join(', ') || 'Not selected';
  document.getElementById('doctorDuration').textContent = state.duration;
  document.getElementById('doctorSeverity').textContent = `${state.severity}/10`;
}

async function loadPatientDashboard() {
  const data = await api(`/api/patient/dashboard?patientId=${encodeURIComponent(state.user?.id || 'USR-1001')}`);
  const appointment = data.upcomingAppointment;
  document.querySelector('#patient-dashboard h2').textContent = `Welcome ${data.patient.name.split(' ')[0]}`;
  document.querySelector('.wide-card dl').innerHTML = `
    <div><dt>Date</dt><dd>${appointment.dateLabel}</dd></div>
    <div><dt>Time</dt><dd>${appointment.time}</dd></div>
    <div><dt>Department</dt><dd>${appointment.department}</dd></div>
  `;
  document.getElementById('patientReportsList').innerHTML = data.reports.map((report) => `
    <article class="case-card">
      <div><h3>${report.name}</h3><p>${report.type}</p></div>
      <button class="secondary-action" type="button">Preview</button>
    </article>
  `).join('');
  document.querySelector('#profile h2').textContent = data.patient.name;
  document.getElementById('profileImage').src = data.patient.profileImage || 'assets/patient-avatar.svg';
  document.getElementById('profileSummary').textContent = `${data.patient.age || 'Age not added'} years · ${data.patient.gender || 'Gender not added'} · ${data.patient.bloodGroup || 'Blood group not added'}`;
  document.getElementById('profileBasic').innerHTML = `
    <div><dt>Full Name</dt><dd>${data.patient.name}</dd></div>
    <div><dt>Age</dt><dd>${data.patient.age || 'Not added'}</dd></div>
    <div><dt>Gender</dt><dd>${data.patient.gender || 'Not added'}</dd></div>
    <div><dt>Date of Birth</dt><dd>${data.patient.dob || 'Not added'}</dd></div>
    <div><dt>Height</dt><dd>${data.patient.height || 'Not added'}</dd></div>
    <div><dt>Weight</dt><dd>${data.patient.weight || 'Not added'}</dd></div>
  `;
  document.getElementById('profileMedical').innerHTML = `
    <div><dt>Blood Group</dt><dd>${data.patient.bloodGroup || 'Not added'}</dd></div>
    <div><dt>Known Diseases</dt><dd>${(data.patient.knownDiseases || []).join(', ') || 'None'}</dd></div>
    <div><dt>Allergies</dt><dd>${data.patient.allergies || 'None'}</dd></div>
    <div><dt>Saved Reports</dt><dd>${data.reports.length}</dd></div>
    <div><dt>Appointments</dt><dd>${data.appointments.length}</dd></div>
    <div><dt>Follow-ups</dt><dd>${data.followups.length}</dd></div>
  `;
  document.getElementById('profileContact').innerHTML = `
    <div><dt>Email</dt><dd>${data.patient.email}</dd></div>
    <div><dt>Mobile</dt><dd>${data.patient.mobile}</dd></div>
    <div><dt>Address</dt><dd>${data.patient.address || 'Not added'}</dd></div>
    <div><dt>Emergency Contact</dt><dd>${data.patient.emergencyContact || 'Not added'}</dd></div>
    <div><dt>Insurance ID</dt><dd>${data.patient.insuranceId || 'Not added'}</dd></div>
    <div><dt>Notifications</dt><dd>${data.notifications.length}</dd></div>
  `;
}

async function loadDoctorDashboard() {
  const data = await api(`/api/doctor/dashboard?doctorId=${encodeURIComponent(state.user?.doctorId || 'DOC-1001')}`);
  document.querySelector('.metric-row').innerHTML = `
    <div><span>Total Patients</span><strong>${data.metrics.totalPatients}</strong></div>
    <div><span>Pending Reviews</span><strong>${data.metrics.pendingReviews}</strong></div>
    <div><span>Follow-Ups</span><strong>${data.metrics.followUps}</strong></div>
  `;
  document.querySelector('#doctor-dashboard .case-list').innerHTML = data.appointments.map((caseItem) => `
    <article class="case-card">
      <div><h3>${caseItem.patientName}</h3><p>${caseItem.department} - ${caseItem.symptoms.join(', ') || 'Symptoms not submitted yet'}</p></div>
      <span class="severity-pill ${caseItem.severity >= 9 ? 'high' : caseItem.severity <= 5 ? 'low' : ''}">${caseItem.severity}/10</span>
      <time>${caseItem.time}</time>
      <button class="secondary-action" data-case-id="${caseItem.id}" type="button">Open Case</button>
    </article>
  `).join('');
  document.querySelector('#doctor-dashboard .case-list').dataset.cases = JSON.stringify(data.appointments);
}

function openCase(caseId) {
  const cases = JSON.parse(document.querySelector('#doctor-dashboard .case-list').dataset.cases || '[]');
  const caseItem = cases.find((item) => item.id === caseId) || cases[0];
  if (!caseItem) return;
  state.selectedCase = caseItem;
  state.appointmentId = caseItem.id;
  document.querySelector('#patient-detail h2').textContent = caseItem.patientName;
  document.querySelector('#patient-detail .info-list').innerHTML = `
    <div><dt>Age</dt><dd>${caseItem.age || '21'}</dd></div>
    <div><dt>Gender</dt><dd>${caseItem.gender || 'Male'}</dd></div>
    <div><dt>Blood Group</dt><dd>${caseItem.bloodGroup || 'O+'}</dd></div>
    <div><dt>Department</dt><dd>${caseItem.department}</dd></div>
  `;
  document.getElementById('doctorSymptoms').textContent = caseItem.symptoms.join(', ') || 'Not submitted';
  document.getElementById('doctorDuration').textContent = state.duration;
  document.getElementById('doctorSeverity').textContent = `${caseItem.severity}/10`;
  showView('patient-detail');
}

async function loadFollowupDashboard() {
  const data = await api('/api/dataset');
  document.querySelector('#notifications .case-list').innerHTML = data.followups.map((item) => `
    <article class="case-card">
      <div><h3>${item.patientName}</h3><p>Recovery: ${item.recovery}% - ${item.status} - ${(item.symptomsRemaining || []).join(', ') || 'No symptoms listed'}</p></div>
      <button class="secondary-action" data-view="patient-detail">Review</button>
    </article>
  `).join('');
}

document.addEventListener('click', (event) => {
  const caseButton = event.target.closest('[data-case-id]');
  if (caseButton) {
    openCase(caseButton.dataset.caseId);
    return;
  }
  const trigger = event.target.closest('[data-view]');
  if (!trigger) return;
  showView(trigger.dataset.view);
});

document.getElementById('logoutButton').addEventListener('click', () => {
  state.user = null;
  document.body.classList.remove('role-patient', 'role-doctor');
  document.body.classList.add('guest');
  document.querySelectorAll('.nav-item[data-role]').forEach((item) => {
    item.hidden = true;
  });
  showToast('Logged out.');
  showView('landing');
});

document.getElementById('patientLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const result = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'patient', mobile: form.get('mobile'), password: form.get('password') })
    });
    setRole(result.user);
    await loadPatientDashboard();
    showToast(`Welcome ${result.user.name}.`);
    showView('patient-dashboard');
  } catch {
    showToast('Patient login failed. Use 9876543210 / carebridge.');
  }
});

document.getElementById('doctorLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const result = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'doctor', doctorId: form.get('doctorId'), password: form.get('password') })
    });
    setRole(result.user);
    await loadDoctorDashboard();
    await loadFollowupDashboard();
    showToast(`Welcome Dr. ${result.user.name}.`);
    showView('doctor-dashboard');
  } catch {
    showToast('Doctor login failed. Use DOC-1001 / doctorcare.');
  }
});

document.getElementById('registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = formObject(event.currentTarget);
  if (payload.password !== payload.confirm) {
    showToast('Password and confirm password must match.');
    return;
  }
  try {
    const result = await api('/api/register', { method: 'POST', body: JSON.stringify(payload) });
    setRole(result.user);
    await loadPatientDashboard();
    showToast('Patient account created and saved.');
    showView('patient-dashboard');
  } catch {
    showToast('This demo account already exists. Login as patient.');
    showView('patient-login');
  }
});

document.getElementById('appointmentForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = { ...formObject(event.currentTarget), patientId: state.user?.id };
  state.department = payload.department;
  try {
    const result = await api('/api/appointments', { method: 'POST', body: JSON.stringify(payload) });
    state.appointmentId = result.appointment.id;
    await loadPatientDashboard();
    showToast('Appointment saved to backend.');
  } catch {
    showToast('Could not save appointment.');
  }
  showView('symptom-form');
});

document.getElementById('symptomForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  renderSummary();
  try {
    const reportNames = [
      ...[...document.querySelectorAll('#reportPdf, #reportImage')].flatMap((input) => [...input.files].map((file) => file.name))
    ];
    const result = await api('/api/symptoms/summary', {
      method: 'POST',
      body: JSON.stringify({ ...state, appointmentId: state.appointmentId, patientId: state.user?.id, reportNames })
    });
    state.department = result.summary.suggestedDepartment;
    state.priority = result.summary.priority;
    renderSummary();
    await loadPatientDashboard();
    showToast('Symptoms saved and summary created.');
  } catch {
    showToast('Could not save symptoms.');
  }
  showView('ai-summary');
});

document.getElementById('generateSummaryTop').addEventListener('click', () => {
  renderSummary();
  showView('ai-summary');
});

document.getElementById('severityInput').addEventListener('input', (event) => {
  document.getElementById('severityValue').textContent = `${event.target.value}/10`;
});

document.getElementById('recoveryInput').addEventListener('input', (event) => {
  document.getElementById('recoveryValue').textContent = `${event.target.value}%`;
});

document.getElementById('medicationStatus').addEventListener('change', (event) => {
  document.getElementById('medicineNameWrap').style.display = event.target.value === 'Yes' ? 'grid' : 'none';
});

document.getElementById('followUpNeeded').addEventListener('change', (event) => {
  document.getElementById('followDateWrap').style.display = event.target.value === 'Yes' ? 'grid' : 'none';
});

document.getElementById('notesForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/doctor/notes', {
      method: 'POST',
      body: JSON.stringify({ ...formObject(event.currentTarget), appointmentId: state.appointmentId })
    });
    await loadFollowupDashboard();
    showToast('Doctor notes saved and patient follow-up queued.');
    showView('notifications');
  } catch {
    showToast('Could not save doctor notes.');
  }
});

document.getElementById('followForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    ...formObject(event.currentTarget),
    recovery: document.getElementById('recoveryInput').value,
    patientName: state.user?.name || 'Prajakt Patil'
  };
  try {
    await api('/api/followups', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Follow-up saved and sent to doctor.');
    showView('patient-dashboard');
  } catch {
    showToast('Could not save follow-up.');
  }
});

document.querySelectorAll('#complaints input').forEach((input) => {
  input.addEventListener('change', () => {
    const hasFever = [...document.querySelectorAll('#complaints input:checked')].some((checked) => checked.value === 'Fever');
    document.getElementById('temperatureWrap').style.display = hasFever ? 'grid' : 'none';
  });
});

renderSummary();
