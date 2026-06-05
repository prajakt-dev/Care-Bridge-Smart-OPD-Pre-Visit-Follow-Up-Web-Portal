const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const root = __dirname;
const dataDir = path.join(root, 'data');
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

function listFromText(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readJson(fileName) {
  const file = await fs.readFile(path.join(dataDir, fileName), 'utf8');
  return JSON.parse(file);
}

async function writeJson(fileName, value) {
  await fs.writeFile(path.join(dataDir, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function summarizeSymptoms(payload) {
  const symptoms = payload.symptoms || [];
  const severity = Number(payload.severity || 1);
  let suggestedDepartment = payload.department || 'General Medicine';

  if (symptoms.includes('Chest Pain')) suggestedDepartment = 'Cardiology';
  if (symptoms.includes('Dizziness') || symptoms.includes('Headache')) suggestedDepartment = 'Neurology';
  if (symptoms.includes('Fever') || symptoms.includes('Cough') || symptoms.includes('Weakness')) suggestedDepartment = 'General Medicine';

  return {
    symptoms,
    duration: payload.duration || 'Not specified',
    severity,
    suggestedDepartment,
    priority: severity >= 8 ? 'High' : severity >= 5 ? 'Medium' : 'Low',
    warning: 'Not a diagnosis. Doctor review required.'
  };
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/api/register') {
    const body = await readBody(req);
    const users = await readJson('users.json');
    if (users.some((user) => user.mobile === body.mobile || user.email === body.email)) {
      return sendJson(res, 409, { error: 'User already exists' });
    }
    const user = {
      id: `USR-${Date.now()}`,
      role: 'patient',
      name: body.name,
      mobile: body.mobile,
      email: body.email,
      password: body.password,
      profileImage: body.profileImage || 'assets/patient-avatar.svg',
      age: body.age || '',
      gender: body.gender || '',
      dob: body.dob || '',
      bloodGroup: body.bloodGroup || '',
      height: body.height || '',
      weight: body.weight || '',
      address: body.address || '',
      emergencyContact: body.emergencyContact || '',
      insuranceId: body.insuranceId || '',
      allergies: body.allergies || 'None',
      knownDiseases: listFromText(body.knownDiseases)
    };
    users.push(user);
    await writeJson('users.json', users);
    const { password, ...safeUser } = user;
    return sendJson(res, 201, { user: safeUser });
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    const body = await readBody(req);
    const users = await readJson('users.json');
    const user = users.find((item) => {
      if (body.role !== item.role || body.password !== item.password) return false;
      return item.mobile === body.mobile || item.doctorId === body.doctorId;
    });
    if (!user) return sendJson(res, 401, { error: 'Invalid credentials' });
    const { password, ...safeUser } = user;
    return sendJson(res, 200, { user: safeUser });
  }

  if (req.method === 'GET' && url.pathname === '/api/patient/dashboard') {
    const users = await readJson('users.json');
    const appointments = await readJson('appointments.json');
    const patientId = url.searchParams.get('patientId') || 'USR-1001';
    const patient = users.find((user) => user.id === patientId && user.role === 'patient') || users.find((user) => user.role === 'patient');
    const patientAppointments = appointments.filter((item) => !item.patientId || item.patientId === patient.id || item.patientName === patient.name);
    const reports = await readJson('reports.json');
    return sendJson(res, 200, {
      patient,
      upcomingAppointment: patientAppointments[0] || appointments[0],
      appointments: patientAppointments,
      reports: reports.filter((report) => !report.patientId || report.patientId === patient.id),
      symptoms: await readJson('symptoms.json'),
      followups: await readJson('followups.json'),
      notifications: (await readJson('notifications.json')).filter((item) => item.role === 'patient')
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/doctor/dashboard') {
    const users = await readJson('users.json');
    const appointments = await readJson('appointments.json');
    const followups = await readJson('followups.json');
    const doctorId = url.searchParams.get('doctorId') || 'DOC-1001';
    const doctor = users.find((user) => user.doctorId === doctorId) || users.find((user) => user.role === 'doctor');
    const doctorAppointments = appointments.filter((item) => item.department === doctor.department || item.department === 'General Medicine');
    return sendJson(res, 200, {
      doctor,
      metrics: {
        totalPatients: doctorAppointments.length,
        pendingReviews: doctorAppointments.filter((item) => item.status === 'pending-review').length,
        followUps: followups.length
      },
      appointments: doctorAppointments,
      notifications: (await readJson('notifications.json')).filter((item) => item.role === 'doctor')
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/appointments') {
    const body = await readBody(req);
    const appointments = await readJson('appointments.json');
    const appointment = {
      id: `APT-${Date.now()}`,
      patientId: body.patientId || 'USR-1001',
      patientName: body.name || 'New Patient',
      age: body.age,
      gender: body.gender,
      bloodGroup: body.blood,
      height: body.height,
      weight: body.weight,
      department: body.department || 'General Medicine',
      date: body.date,
      dateLabel: body.date || 'Selected date',
      time: body.slot || '09:00',
      symptoms: [],
      severity: 1,
      status: 'draft'
    };
    appointments.unshift(appointment);
    await writeJson('appointments.json', appointments);
    return sendJson(res, 201, { appointment });
  }

  if (req.method === 'POST' && url.pathname === '/api/symptoms/summary') {
    const body = await readBody(req);
    const summary = summarizeSymptoms(body);
    const symptoms = await readJson('symptoms.json');
    symptoms.unshift({
      id: `SYM-${Date.now()}`,
      appointmentId: body.appointmentId,
      patientId: body.patientId,
      ...summary,
      createdAt: new Date().toISOString()
    });
    await writeJson('symptoms.json', symptoms);
    if (Array.isArray(body.reportNames) && body.reportNames.length) {
      const reports = await readJson('reports.json');
      body.reportNames.forEach((name) => {
        reports.unshift({
          id: `REP-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          patientId: body.patientId || 'USR-1001',
          name,
          type: name.toLowerCase().endsWith('.pdf') ? 'PDF Report' : 'Image Report',
          appointmentId: body.appointmentId,
          uploadedAt: new Date().toISOString()
        });
      });
      await writeJson('reports.json', reports);
    }
    return sendJson(res, 201, { summary });
  }

  if (req.method === 'POST' && url.pathname === '/api/doctor/notes') {
    const body = await readBody(req);
    const notes = await readJson('doctor_notes.json');
    const note = {
      id: `NOTE-${Date.now()}`,
      appointmentId: body.appointmentId || 'APT-1001',
      diagnosis: body.diagnosis,
      treatmentNotes: body.treatmentNotes,
      medicine: body.medicine,
      instructions: body.instructions,
      followUpNeeded: body.followUpNeeded === 'Yes' || body.followUpNeeded === true,
      followUpAfter: body.followUpAfter || 'After 7 Days',
      createdAt: new Date().toISOString()
    };
    notes.unshift(note);
    await writeJson('doctor_notes.json', notes);
    if (note.followUpNeeded) {
      const notifications = await readJson('notifications.json');
      notifications.unshift({
        id: `NOT-${Date.now()}`,
        role: 'patient',
        message: `Doctor scheduled a follow-up: ${note.followUpAfter}.`,
        status: 'unread'
      });
      await writeJson('notifications.json', notifications);
    }
    return sendJson(res, 201, { note });
  }

  if (req.method === 'POST' && url.pathname === '/api/followups') {
    const body = await readBody(req);
    const followups = await readJson('followups.json');
    const recovery = Number(body.recovery || 0);
    const followup = {
      id: `FUP-${Date.now()}`,
      patientName: body.patientName || 'Prajakt Patil',
      recovery,
      status: recovery >= 70 ? 'Improving' : recovery >= 40 ? 'Needs Review' : 'Worse',
      feeling: body.feeling,
      symptomsRemaining: body.symptomsRemaining || [],
      medicineCompleted: body.medicineCompleted === 'Yes' || body.medicineCompleted === true,
      comments: body.comments || '',
      createdAt: new Date().toISOString()
    };
    followups.unshift(followup);
    await writeJson('followups.json', followups);
    const notifications = await readJson('notifications.json');
    notifications.unshift({
      id: `NOT-${Date.now()}`,
      role: 'doctor',
      message: `${followup.patientName} submitted a follow-up response: ${followup.status}.`,
      status: 'unread'
    });
    await writeJson('notifications.json', notifications);
    return sendJson(res, 201, { followup });
  }

  if (req.method === 'GET' && url.pathname === '/api/dataset') {
    return sendJson(res, 200, {
      users: await readJson('users.json'),
      appointments: await readJson('appointments.json'),
      symptoms: await readJson('symptoms.json'),
      reports: await readJson('reports.json'),
      doctor_notes: await readJson('doctor_notes.json'),
      followups: await readJson('followups.json'),
      notifications: await readJson('notifications.json')
    });
  }

  return sendJson(res, 404, { error: 'API route not found' });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(root, safePath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) return await handleApi(req, res);
    return await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Care Bridge running at http://localhost:${port}`);
});
