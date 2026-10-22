const mysql = require('./CampusBook/backend/node_modules/mysql2/promise');
const BASE = 'http://127.0.0.1:4100';
const results = [];
const rec = (id, name, expected, actual, pass, extra = {}) => { results.push({ id, name, expected, actual, status: pass ? 'Pass' : 'Fail', ...extra }); console.log(pass ? 'PASS' : 'FAIL', id, name, '=>', actual); };
async function call(method, path, token, body, raw) {
  const t0 = Date.now();
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json, ms: Date.now() - t0 };
}
const login = async (email, pw = 'CampusBook123') => (await call('POST', '/api/auth/login', null, { email, password: pw })).json;
const ymd = d => d.toISOString().slice(0, 10);
const day = n => ymd(new Date(Date.now() + n * 86400000));
(async () => {
  const db = await mysql.createConnection({ socketPath: '/tmp/mdb.sock', user: 'root', password: process.env.DB_PASSWORD, database: 'campusbook' });
  const L1 = await login('jabulile.mashibini@campusbook.test');
  const L2 = await login('lusukama.selemani@campusbook.test');
  const S1 = await login('willem.gerber@campusbook.test');
  const S2 = await login('oscar.khumalo@campusbook.test');
  const S3 = await login('thomas.duplessis@campusbook.test');

  // TC-01
  let a = await call('POST', '/api/auth/login', null, { email: 'willem.gerber@campusbook.test', password: 'CampusBook123' });
  let b = await call('POST', '/api/auth/login', null, { email: 'jabulile.mashibini@campusbook.test', password: 'CampusBook123' });
  let c = await call('POST', '/api/auth/login', null, { email: 'willem.gerber@campusbook.test', password: 'wrong' });
  let d = await call('POST', '/api/auth/login', null, { email: 'nobody@campusbook.test', password: 'CampusBook123' });
  rec('TC-01', 'Login with valid and invalid details', 'Valid logins return a token and role. Wrong password and unknown email both give the same general error',
    `student ${a.status} role ${a.json.user?.role}; lecturer ${b.status} role ${b.json.user?.role}; wrong password ${c.status} "${c.json.error}"; unknown email ${d.status} "${d.json.error}"`,
    a.status === 200 && a.json.token && a.json.user.role === 'student' && b.status === 200 && b.json.user.role === 'lecturer' && c.status === 401 && d.status === 401 && c.json.error === d.json.error);

  // TC-02
  a = await call('POST', '/api/slots', S1.token, { date: day(5), startTime: '10:00', endTime: '10:30', location: 'Room 1' });
  b = await call('POST', '/api/bookings', L1.token, { slotId: 1, reason: 'x' });
  c = await call('GET', '/api/bookings/mine', null);
  d = await call('GET', '/api/bookings/lecturer', S1.token);
  let e = await call('GET', '/api/slots/mine', S1.token);
  rec('TC-02', 'Role checks on the server', 'Wrong role gets 403 and no token gets 401 even when sent straight to the API',
    `student creates slot ${a.status}; lecturer books ${b.status}; no token ${c.status}; student reads lecturer bookings ${d.status}; student reads lecturer slots ${e.status}`,
    a.status === 403 && b.status === 403 && c.status === 401 && d.status === 403 && e.status === 403);

  // TC-03 manage slots
  const t1 = day(6);
  a = await call('POST', '/api/slots', L1.token, { date: t1, startTime: '08:00', endTime: '08:30', location: 'Room B12' });
  const sid = a.json?.id;
  b = await call('PUT', `/api/slots/${sid}`, L1.token, { date: t1, startTime: '08:00', endTime: '08:45', location: 'Teams' });
  c = await call('PUT', `/api/slots/${sid}`, L2.token, { date: t1, startTime: '08:00', endTime: '08:20', location: 'Hack' });
  d = await call('DELETE', `/api/slots/${sid}`, L2.token);
  e = await call('DELETE', `/api/slots/${sid}`, L1.token);
  let f = await call('GET', '/api/slots/mine', L1.token);
  rec('TC-03', 'Lecturer publishes edits and removes own slots', 'Own slot can be created edited and removed and another lecturer gets 404',
    `create ${a.status}; edit ${b.status} end ${b.json?.endTime} location ${b.json?.location}; other lecturer edit ${c.status}; other lecturer delete ${d.status}; owner delete ${e.status}; slot still listed after delete: ${f.json.some(s => s.id === sid)}`,
    a.status === 201 && b.status === 200 && b.json.endTime === '08:45' && c.status === 404 && d.status === 404 && e.status === 200 && !f.json.some(s => s.id === sid));

  // TC-04 view slots
  await db.query("INSERT INTO consultation_slots (lecturer_id, slot_date, start_time, end_time, location, status) VALUES (1, CURDATE() - INTERVAL 1 DAY, '09:00', '09:30', 'Past', 'open')");
  a = await call('GET', '/api/slots?lecturerId=1', S1.token);
  const all1 = (await db.query("SELECT COUNT(*) n FROM consultation_slots WHERE lecturer_id=1"))[0][0].n;
  rec('TC-04', 'Student views open future slots of one lecturer', 'Only future slots with status open are listed for the chosen lecturer',
    `${a.status} ${a.json.length} slots listed of ${all1} stored for the lecturer; all open: ${a.json.every(s => s.status === 'open')}; all lecturer 1: ${a.json.every(s => s.lecturerId === 1)}; past slot listed: ${a.json.some(s => s.location === 'Past')}`,
    a.status === 200 && a.json.every(s => s.status === 'open' && s.lecturerId === 1) && !a.json.some(s => s.location === 'Past'));
  const open1 = a.json;

  // TC-05 book
  const target = open1[0];
  a = await call('POST', '/api/bookings', S1.token, { slotId: target.id, reason: 'Help with my ERD' });
  const [[row]] = await db.query('SELECT student_id, slot_id, reason, status FROM bookings WHERE booking_id = ?', [a.json?.id]);
  const [[slotRow]] = await db.query('SELECT status FROM consultation_slots WHERE slot_id = ?', [target.id]);
  rec('TC-05', 'Student books an open slot with a reason', 'Booking saved with student slot and reason and the slot becomes booked',
    `${a.status}; saved student ${row?.student_id} slot ${row?.slot_id} reason "${row?.reason}" status ${row?.status}; slot status ${slotRow.status}; response has date ${a.json?.date} ${a.json?.start}`,
    a.status === 201 && row.student_id === S1.user.id && row.slot_id === target.id && row.reason === 'Help with my ERD' && slotRow.status === 'booked');
  const bk1 = a.json.id;

  // TC-06 change and cancel
  const spare = (await call('GET', '/api/slots?lecturerId=1', S1.token)).json;
  const other = spare[0];
  b = await call('PATCH', `/api/bookings/${bk1}/change`, S1.token, { newSlotId: other.id });
  const [[oldS]] = await db.query('SELECT status FROM consultation_slots WHERE slot_id = ?', [target.id]);
  const [[newS]] = await db.query('SELECT status FROM consultation_slots WHERE slot_id = ?', [other.id]);
  const newBk = b.json?.id;
  c = await call('PATCH', `/api/bookings/${newBk}/cancel`, S1.token);
  const [[afterC]] = await db.query('SELECT status FROM consultation_slots WHERE slot_id = ?', [other.id]);
  const [[bkS]] = await db.query('SELECT status FROM bookings WHERE booking_id = ?', [newBk]);
  d = await call('PATCH', `/api/bookings/${newBk}/cancel`, S1.token);
  rec('TC-06', 'Student changes and cancels own booking', 'Old slot opens again after a change and after a cancellation. Cancelling twice is rejected',
    `change ${b.status} (old slot ${oldS.status}, new slot ${newS.status}); cancel ${c.status} (slot ${afterC.status}, booking ${bkS.status}); second cancel ${d.status} "${d.json?.error}"`,
    b.status === 200 && oldS.status === 'open' && newS.status === 'booked' && c.status === 200 && afterC.status === 'open' && bkS.status === 'cancelled' && d.status === 404);

  // TC-07 concurrency
  const [ins] = await db.query("INSERT INTO consultation_slots (lecturer_id, slot_date, start_time, end_time, location) VALUES (2, CURDATE() + INTERVAL 7 DAY, '15:00', '15:30', 'Race')");
  const rs = await Promise.all([S1, S2, S3, S1, S2, S3, S1, S2].map((s, i) => call('POST', '/api/bookings', s.token, { slotId: ins.insertId, reason: 'Race ' + i })));
  const codes = rs.map(r => r.status);
  const [[{ n: confirmed }]] = await db.query("SELECT COUNT(*) n FROM bookings WHERE slot_id = ? AND status='confirmed'", [ins.insertId]);
  rec('TC-07', 'Two or more students book the same slot at the same moment', 'Exactly one confirmed booking and the others get the slot taken message',
    `8 simultaneous requests gave ${codes.filter(x => x === 201).length} created and ${codes.filter(x => x === 409).length} rejected with 409 "${rs.find(r => r.status === 409)?.json?.error}"; confirmed bookings in database ${confirmed}`,
    codes.filter(x => x === 201).length === 1 && codes.filter(x => x === 409).length === 7 && Number(confirmed) === 1);
  // DB level
  let dbErr = '';
  try { await db.query("INSERT INTO bookings (slot_id, student_id, reason) VALUES (?, 4, 'direct')", [ins.insertId]); } catch (er) { dbErr = er.code; }
  rec('TC-31', 'Database refuses a second confirmed booking for a slot', 'Insert straight into the database fails with a duplicate key error',
    `direct insert gave ${dbErr || 'no error'}`, dbErr === 'ER_DUP_ENTRY');

  // TC-09 history and TC-14 access
  const m1 = await call('GET', '/api/bookings/mine', S1.token);
  const m2 = await call('GET', '/api/bookings/mine', S2.token);
  const l1 = await call('GET', '/api/bookings/lecturer', L1.token);
  const l2 = await call('GET', '/api/bookings/lecturer', L2.token);
  const m1ids = m1.json.map(x => x.id), m2ids = m2.json.map(x => x.id);
  const raceWinnerStudent = (await db.query("SELECT student_id FROM bookings WHERE slot_id=? AND status='confirmed'", [ins.insertId]))[0][0].student_id;
  const l2Names = l2.json.map(x => x.studentName);
  const l1HasRace = l1.json.some(x => x.location === 'Race');
  rec('TC-09', 'Booking history for students and lecturers', 'Students see only their own bookings and lecturers see only bookings for their own slots',
    `student 1 sees ${m1.json.length} bookings, student 2 sees ${m2.json.length}; no shared ids: ${!m1ids.some(i => m2ids.includes(i))}; lecturer 2 sees ${l2.json.length} booking(s) and lecturer 1 sees ${l1.json.length} (race slot belongs to lecturer 2: shown to lecturer 1 = ${l1HasRace}); history includes cancelled: ${m1.json.some(x => x.status === 'cancelled')}`,
    m1.status === 200 && !m1ids.some(i => m2ids.includes(i)) && !l1HasRace && l2.json.some(x => x.location === 'Race') && m1.json.some(x => x.status === 'cancelled'));
  const victim = m1.json.find(x => x.status === 'confirmed' && !x.isPast) || null;
  const raceBk = (await db.query("SELECT booking_id, student_id FROM bookings WHERE slot_id=? AND status='confirmed'", [ins.insertId]))[0][0];
  const attacker = [S1, S2, S3].find(s => s.user.id !== raceBk.student_id);
  a = await call('PATCH', `/api/bookings/${raceBk.booking_id}/cancel`, attacker.token);
  b = await call('PATCH', `/api/bookings/${raceBk.booking_id}/change`, attacker.token, { newSlotId: open1[1]?.id || 1 });
  c = await call('PUT', `/api/slots/${ins.insertId}`, L1.token, { date: day(7), startTime: '15:00', endTime: '15:10', location: 'x' });
  d = await call('GET', '/api/bookings/lecturer', L1.token);
  const [[stillConf]] = await db.query("SELECT status FROM bookings WHERE booking_id=?", [raceBk.booking_id]);
  rec('TC-14', 'Users cannot reach another users records', 'Cancelling or changing another students booking and editing another lecturers slot is refused and nothing changes',
    `other student cancel ${a.status}; other student change ${b.status}; other lecturer edit ${c.status}; booking still ${stillConf.status}`,
    a.status === 404 && b.status === 404 && c.status === 404 && stillConf.status === 'confirmed');

  // TC-08 emails
  const fs = require('fs');
  const log = fs.readFileSync('/tmp/api4100.log', 'utf8');
  const conf = /Subject: Consultation booked/.test(log) && /To: willem\.gerber@campusbook\.test/.test(log) && /To: jabulile\.mashibini@campusbook\.test/.test(log);
  const [notes] = await db.query("SELECT n.type, n.status FROM notifications n JOIN bookings b ON b.booking_id=n.booking_id WHERE b.booking_id = ?", [bk1]);
  rec('TC-08a', 'Confirmation email after booking', 'A confirmation to the student and a notice to the lecturer with the slot details',
    `preview log shows student and lecturer emails with subject Consultation booked: ${conf}; notification rows for the booking: ${notes.map(n => n.type + ':' + n.status).join(', ')}`,
    conf && notes.some(n => n.type === 'confirmation' && n.status === 'sent'));
  // reminder job
  const [slot3] = await db.query("INSERT INTO consultation_slots (lecturer_id, slot_date, start_time, end_time, location) VALUES (1, CURDATE() + INTERVAL 8 DAY, '09:00', '09:30', 'Reminder room')");
  const bkR = await call('POST', '/api/bookings', S3.token, { slotId: slot3.insertId, reason: 'Reminder test' });
  const [[remBefore]] = await db.query("SELECT status, send_at FROM notifications WHERE booking_id=? AND type='reminder'", [bkR.json.id]);
  await db.query("UPDATE notifications SET send_at = NOW() - INTERVAL 1 MINUTE WHERE booking_id=? AND type='reminder'", [bkR.json.id]);
  process.env.DB_HOST = '127.0.0.1'; process.env.DB_USER = 'root'; 
  const origLog = console.log; let captured = [];
  console.log = (...x) => { captured.push(x.join(' ')); };
  const job = require('./CampusBook/backend/src/jobs/reminders');
  await job.processDueReminders();
  console.log = origLog;
  const [[remAfter]] = await db.query("SELECT status, sent_at FROM notifications WHERE booking_id=? AND type='reminder'", [bkR.json.id]);
  const remMail = captured.join('\n');
  rec('TC-08b', 'Reminder email before the meeting', 'A due reminder is sent to the student and lecturer and marked sent',
    `reminder row before: ${remBefore.status}; after running the reminder job: ${remAfter.status}; reminder text mentions student and lecturer: ${/Upcoming consultation reminder/.test(remMail) && /Thomas du Plessis/.test(remMail) && /Jabulile Mashibini/.test(remMail)}`,
    remBefore.status === 'pending' && remAfter.status === 'sent' && /Upcoming consultation reminder/.test(remMail));
  // reminder of a cancelled booking is not sent
  const [slot4] = await db.query("INSERT INTO consultation_slots (lecturer_id, slot_date, start_time, end_time, location) VALUES (1, CURDATE() + INTERVAL 8 DAY, '10:00', '10:30', 'Cancel reminder')");
  const bkC = await call('POST', '/api/bookings', S3.token, { slotId: slot4.insertId, reason: 'cancel soon' });
  await db.query("UPDATE notifications SET send_at = NOW() - INTERVAL 1 MINUTE WHERE booking_id=? AND type='reminder'", [bkC.json.id]);
  await call('PATCH', `/api/bookings/${bkC.json.id}/cancel`, S3.token);
  console.log = () => {}; await job.processDueReminders(); console.log = origLog;
  const [rem2] = await db.query("SELECT status FROM notifications WHERE booking_id=? AND type='reminder'", [bkC.json.id]);
  rec('TC-26', 'Reminder is not sent for a cancelled booking', 'Pending reminder is removed when the booking is cancelled',
    `reminder rows left for the cancelled booking: ${rem2.length}`, rem2.length === 0);

  // TC-10 usability from browser, TC-11 TC-12 TC-16 in browser tests file
  // TC-13 passwords
  const [hashes] = await db.query('SELECT password_hash FROM users');
  const allBcrypt = hashes.every(h => /^\$2[aby]\$\d\d\$/.test(h.password_hash) && h.password_hash.length === 60);
  const noPlain = hashes.every(h => h.password_hash !== 'CampusBook123');
  const src = fs.readFileSync('./CampusBook/backend/src/routes/auth.js', 'utf8');
  rec('TC-13', 'Passwords stored as bcrypt hashes', 'No plain text passwords. All stored values are 60 character bcrypt hashes and login uses bcrypt compare',
    `${hashes.length} users checked: all bcrypt format ${allBcrypt}; none equal to the plain password ${noPlain}; auth.js uses bcrypt.compare: ${/bcrypt\.compare/.test(src)}`,
    allBcrypt && noPlain && /bcrypt\.compare/.test(src));

  // TC-15 data minimisation
  const [cols] = await db.query("SELECT table_name t, GROUP_CONCAT(column_name ORDER BY ordinal_position) c FROM information_schema.columns WHERE table_schema='campusbook' GROUP BY table_name");
  const colText = cols.map(x => `${x.t}(${x.c})`).join('; ');
  const [[{ nreal: real }]] = await db.query("SELECT COUNT(*) nreal FROM users WHERE email NOT LIKE '%@campusbook.test'");
  const sensitive = /id_number|address|phone|birth|gender|race|religion|marks|grade/i.test(colText);
  rec('TC-15', 'Only the data needed is stored and it is made up', 'No sensitive columns and every test user uses the test email domain',
    `tables: ${colText}; users not on the test domain: ${real}; sensitive column names found: ${sensitive}`, !sensitive && Number(real) === 0);

  // extra edge cases
  a = await call('POST', '/api/bookings', S1.token, { slotId: 999999, reason: 'x' });
  const [pastIns] = await db.query("SELECT slot_id FROM consultation_slots WHERE location='Past'");
  b = await call('POST', '/api/bookings', S1.token, { slotId: pastIns[0].slot_id, reason: 'x' });
  c = await call('POST', '/api/bookings', S1.token, { slotId: raceBk ? ins.insertId : 1, reason: 'taken' });
  rec('TC-17', 'Booking a missing past or taken slot', 'Rejected with 409 and the message Sorry that slot is no longer available',
    `missing slot ${a.status} "${a.json?.error}"; past slot ${b.status}; booked slot ${c.status}`,
    a.status === 409 && b.status === 409 && c.status === 409);

  const v = [];
  a = await call('POST', '/api/slots', L1.token, { date: day(9), startTime: '11:00', endTime: '10:00', location: 'x' }); v.push(['end before start', a.status, a.json?.error]);
  a = await call('POST', '/api/slots', L1.token, { date: day(-1), startTime: '11:00', endTime: '12:00', location: 'x' }); v.push(['past date', a.status, a.json?.error]);
  a = await call('POST', '/api/slots', L1.token, { date: '2027-02-31', startTime: '11:00', endTime: '12:00', location: 'x' }); v.push(['31 February', a.status, a.json?.error]);
  a = await call('POST', '/api/slots', L1.token, { date: day(9), startTime: '25:00', endTime: '26:00', location: 'x' }); v.push(['invalid time', a.status, a.json?.error]);
  a = await call('POST', '/api/slots', L1.token, { date: day(9), startTime: '11:00', endTime: '12:00', location: '' }); v.push(['empty location', a.status, a.json?.error]);
  const base = await call('POST', '/api/slots', L1.token, { date: day(9), startTime: '13:00', endTime: '14:00', location: 'Base' });
  a = await call('POST', '/api/slots', L1.token, { date: day(9), startTime: '13:30', endTime: '14:30', location: 'Overlap' }); v.push(['overlap', a.status, a.json?.error]);
  rec('TC-18', 'Slot validation rules', 'Invalid slot data is refused with a message that says what to fix',
    v.map(x => `${x[0]}: ${x[1]} "${x[2]}"`).join('; '),
    v[0][1] === 400 && v[1][1] === 400 && v[2][1] === 400 && v[3][1] === 400 && v[4][1] === 400 && v[5][1] === 409);

  const target2 = base.json.id;
  const bb = await call('POST', '/api/bookings', S2.token, { slotId: target2, reason: 'Edit while booked' });
  a = await call('PUT', `/api/slots/${target2}`, L1.token, { date: day(9), startTime: '13:00', endTime: '13:45', location: 'Base' });
  b = await call('DELETE', `/api/slots/${target2}`, L1.token);
  rec('TC-19', 'A booked slot cannot be edited or removed', 'Edit and delete return 409 while a student holds the slot',
    `booking ${bb.status}; edit ${a.status} "${a.json?.error}"; delete ${b.status}`, bb.status === 201 && a.status === 409 && b.status === 409);

  // history kept and republish
  await call('PATCH', `/api/bookings/${bb.json.id}/cancel`, S2.token);
  a = await call('DELETE', `/api/slots/${target2}`, L1.token);
  const [[hist]] = await db.query('SELECT status FROM consultation_slots WHERE slot_id=?', [target2]);
  const [[bh]] = await db.query('SELECT COUNT(*) n FROM bookings WHERE slot_id=?', [target2]);
  b = await call('POST', '/api/slots', L1.token, { date: day(9), startTime: '13:00', endTime: '14:00', location: 'Back again' });
  rec('TC-20', 'Removing a slot with history keeps the history', 'Slot is marked cancelled and booking history stays. Publishing the same time again reopens it',
    `delete ${a.status}; slot status ${hist.status}; bookings kept ${bh.n}; republish ${b.status} same id ${b.json?.id === target2} status ${b.json?.status}`,
    a.status === 200 && hist.status === 'cancelled' && Number(bh.n) === 1 && b.status === 201 && b.json.id === target2 && b.json.status === 'open');

  a = await call('PATCH', '/api/bookings/abc/cancel', S1.token);
  b = await call('GET', '/api/slots?lecturerId=abc', S1.token);
  c = await call('PUT', '/api/slots/abc', L1.token, { date: day(9), startTime: '11:00', endTime: '12:00', location: 'x' });
  d = await call('POST', '/api/auth/login', null, null, '{bad json');
  e = await call('GET', '/api/nothing', S1.token);
  rec('TC-21', 'Bad ids bad JSON and unknown routes', 'Clear 400 or 404 messages and no server error',
    `bad booking id ${a.status} "${a.json?.error}"; bad lecturer id ${b.status} "${b.json?.error}"; bad slot id ${c.status}; invalid JSON ${d.status} "${d.json?.error}"; unknown route ${e.status}`,
    a.status === 400 && b.status === 400 && c.status === 400 && d.status === 400 && e.status === 404);

  const jwt = require('./CampusBook/backend/node_modules/jsonwebtoken');
  const forged = jwt.sign({ id: 3, name: 'x', email: 'x', role: 'lecturer' }, 'wrong-secret');
  const expired = jwt.sign({ id: 3, name: 'x', email: 'x', role: 'student' }, process.env.JWT_SECRET, { expiresIn: -10 });
  a = await call('GET', '/api/bookings/mine', forged);
  b = await call('GET', '/api/bookings/mine', expired);
  c = await call('GET', '/api/bookings/mine', 'garbage');
  rec('TC-22', 'Forged expired and garbage tokens', 'All refused with 401',
    `forged ${a.status}; expired ${b.status} "${b.json?.error}"; garbage ${c.status}`, a.status === 401 && b.status === 401 && c.status === 401);

  a = await call('POST', '/api/auth/login', null, { email: "' OR '1'='1", password: "' OR '1'='1" });
  b = await call('POST', '/api/auth/login', null, { email: "willem.gerber@campusbook.test' --", password: 'x' });
  const longSlot = open1[2] || open1[0];
  c = await call('POST', '/api/bookings', S3.token, { slotId: longSlot.id, reason: 'a'.repeat(256) });
  d = await call('POST', '/api/bookings', S3.token, { slotId: longSlot.id, reason: '   ' });
  e = await call('POST', '/api/bookings', S3.token, { reason: 'no slot' });
  rec('TC-16', 'Errors explain what to fix', 'Empty or invalid input gives a 400 with a plain message and nothing is saved',
    `SQL style login ${a.status} "${a.json?.error}" and ${b.status}; empty login ${(await call('POST','/api/auth/login',null,{})).json?.error}; reason too long ${c.status} "${c.json?.error}"; blank reason ${d.status} "${d.json?.error}"; no slot ${e.status} "${e.json?.error}"`,
    a.status === 400 && b.status === 400 && c.status === 400 && d.status === 400 && e.status === 400, { api: true });

  a = await call('GET', '/api/health');
  rec('TC-23', 'Health check', 'GET /api/health returns ok', `${a.status} ${JSON.stringify(a.json)}`, a.status === 200 && a.json.ok === true);

  // timings
  const times = [];
  for (let i = 0; i < 20; i++) { times.push((await call('GET', '/api/slots?lecturerId=1', S1.token)).ms); }
  const ts = [...times].sort((x, y) => x - y);
  rec('TC-24', 'API response time for the slot list', 'Under 500 ms for 20 repeated requests',
    `20 requests: median ${ts[10]} ms, slowest ${ts[19]} ms`, ts[19] < 500, { median: ts[10], max: ts[19] });

  fs.writeFileSync('api_results.json', JSON.stringify(results, null, 1));
  console.log('\nTOTAL', results.length, 'PASS', results.filter(r => r.status === 'Pass').length, 'FAIL', results.filter(r => r.status === 'Fail').length);
  await db.end(); process.exit(0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
