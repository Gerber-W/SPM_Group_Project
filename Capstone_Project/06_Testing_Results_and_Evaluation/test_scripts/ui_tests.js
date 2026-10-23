const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const mysql = require('./CampusBook/backend/node_modules/mysql2/promise');
const fs = require('fs');
const OUT = 'shots'; fs.mkdirSync(OUT, { recursive: true });
const APP = 'http://localhost:5173';
const res = [];
const rec = (id, name, expected, actual, pass, extra = {}) => { res.push({ id, name, expected, actual, status: pass ? 'Pass' : 'Fail', ...extra }); console.log(pass ? 'PASS' : 'FAIL', id, name, '=>', actual); };
const overflow = p => p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: window.innerWidth }));
async function loginUI(p, email) {
  await p.goto(APP + '/login'); await p.fill('#email', email); await p.fill('#password', 'CampusBook123');
  await p.click('form button[type=submit]'); await p.waitForTimeout(700);
}
(async () => {
  const db = await mysql.createConnection({ socketPath: '/tmp/mdb.sock', user: 'root', password: process.env.DB_PASSWORD, database: 'campusbook' });
  const b = await chromium.launch();
  const consoleErrors = [];

  // ---- TC-12 layouts and TC-11 load times
  const sizes = [['phone', 375, 800], ['laptop', 1366, 768]];
  const lay = [], loads = [];
  for (const [name, w, h] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage();
    p.on('console', m => m.type() === 'error' && consoleErrors.push(name + ': ' + m.text()));
    const t0 = Date.now();
    await p.goto(APP + '/login', { waitUntil: 'load' }); const tLogin = Date.now() - t0;
    let o = await overflow(p); lay.push([name, 'login', o.sw <= o.cw]);
    await p.screenshot({ path: `${OUT}/${name}_login.png` });
    await p.fill('#email', 'willem.gerber@campusbook.test'); await p.fill('#password', 'CampusBook123');
    const t1 = Date.now(); await p.click('form button[type=submit]'); await p.waitForURL('**/book'); await p.waitForSelector('.bs-lecturer'); const tBook = Date.now() - t1;
    o = await overflow(p); lay.push([name, 'book', o.sw <= o.cw]);
    await p.screenshot({ path: `${OUT}/${name}_book.png`, fullPage: true });
    await p.locator('.bs-lecturer').first().click(); await p.waitForTimeout(600);
    o = await overflow(p); lay.push([name, 'book with calendar', o.sw <= o.cw]);
    await p.screenshot({ path: `${OUT}/${name}_book_calendar.png`, fullPage: true });
    const t2 = Date.now(); await p.click('text=My bookings'); await p.waitForURL('**/my-bookings'); await p.waitForSelector('h1'); await p.waitForTimeout(300); const tMy = Date.now() - t2;
    o = await overflow(p); lay.push([name, 'my bookings', o.sw <= o.cw]);
    await p.screenshot({ path: `${OUT}/${name}_mybookings.png`, fullPage: true });
    await p.evaluate(() => localStorage.clear());
    await loginUI(p, 'jabulile.mashibini@campusbook.test');
    const url = p.url(); o = await overflow(p); lay.push([name, 'lecturer slots (' + url.replace(APP, '') + ')', o.sw <= o.cw]);
    const lecturerText = (await p.locator('main, .cb-page, body').first().innerText()).slice(0, 120).replace(/\s+/g, ' ');
    await p.screenshot({ path: `${OUT}/${name}_lecturer.png`, fullPage: true });
    loads.push([name, tLogin, tBook, tMy, lecturerText]);
    await ctx.close();
  }
  rec('TC-12', 'Pages work at 375 and 1366 pixels wide', 'No sideways scrolling on any page at both widths',
    lay.map(x => `${x[0]} ${x[1]}: ${x[2] ? 'no sideways scroll' : 'SIDEWAYS SCROLL'}`).join('; '), lay.every(x => x[2]));
  const maxLoad = Math.max(...loads.flatMap(x => [x[1], x[2], x[3]]));
  rec('TC-11', 'Main pages load in under 3 seconds', 'Login book and my bookings each load in under 3000 ms on the team set up',
    loads.map(x => `${x[0]}: login ${x[1]} ms, book after login ${x[2]} ms, my bookings ${x[3]} ms`).join('; '), maxLoad < 3000, { maxLoad });

  // ---- Lecturer page state
  const lecturerText = loads[1][4];
  const lecturerPlaceholder = /coming soon/i.test(lecturerText);
  rec('TC-25', 'Lecturer slots page lets a lecturer publish edit and remove slots', 'The lecturer page shows the lecturer slots and a form to publish a slot',
    `After lecturer login the page at /lecturer/slots shows: "${lecturerText}"`, !lecturerPlaceholder);

  // ---- Route protection in UI
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } }); const p = await ctx.newPage();
    await p.goto(APP + '/book'); await p.waitForTimeout(500); const u1 = p.url();
    await loginUI(p, 'willem.gerber@campusbook.test');
    await p.goto(APP + '/lecturer/slots'); await p.waitForTimeout(600); const u2 = p.url();
    await p.evaluate(() => { localStorage.clear(); });
    await loginUI(p, 'jabulile.mashibini@campusbook.test');
    await p.goto(APP + '/book'); await p.waitForTimeout(600); const u3 = p.url();
    rec('TC-27', 'Pages are protected by login and role', 'Visitors go to login and each role is sent away from the other roles pages',
      `not logged in opening /book goes to ${u1.replace(APP, '')}; student opening /lecturer/slots goes to ${u2.replace(APP, '')}; lecturer opening /book goes to ${u3.replace(APP, '')}`,
      /\/login/.test(u1) && !/lecturer\/slots/.test(u2) && !/\/book$/.test(u3));
    await ctx.close();
  }

  // ---- TC-16 UI error handling and kept input
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } }); const p = await ctx.newPage();
    await p.goto(APP + '/login'); await p.fill('#email', 'willem.gerber@campusbook.test'); await p.fill('#password', 'wrongpass');
    await p.click('form button[type=submit]'); await p.waitForTimeout(700);
    const err1 = (await p.locator('[role=alert], .cb-alert, .login-error').first().innerText().catch(() => '')).trim();
    const kept = await p.inputValue('#email');
    await p.screenshot({ path: `${OUT}/laptop_login_error.png` });
    await p.fill('#email', ''); await p.fill('#password', ''); await p.click('form button[type=submit]'); await p.waitForTimeout(400);
    const err2 = (await p.locator('[role=alert], .cb-alert, .login-error').first().innerText().catch(() => '')).trim();
    // booking when slot gets taken
    await p.fill('#email', 'willem.gerber@campusbook.test'); await p.fill('#password', 'CampusBook123'); await p.click('form button[type=submit]');
    await p.waitForURL('**/book'); await p.waitForSelector('.bs-lecturer');
    await p.locator('.bs-lecturer').first().click(); await p.waitForTimeout(700);
    const chosen = await p.locator('.bs-time').first();
    await chosen.click(); await p.waitForTimeout(300);
    await p.fill('#bs-reason', 'My typed reason should stay');
    const [[taken]] = await db.query("SELECT slot_id FROM consultation_slots WHERE status='open' AND lecturer_id=1 AND TIMESTAMP(slot_date,start_time) > NOW() ORDER BY slot_date, start_time LIMIT 1");
    await db.query("UPDATE consultation_slots SET status='booked' WHERE slot_id = ?", [taken.slot_id]);
    await db.query("INSERT INTO bookings (slot_id, student_id, reason) VALUES (?, 4, 'taken by another student')", [taken.slot_id]);
    await p.locator('button:has-text("Confirm booking")').first().click().catch(async () => { await p.locator('.cb-btn-primary, button.cb-button').last().click(); });
    await p.waitForTimeout(900);
    const err3 = (await p.locator('.cb-alert').first().innerText().catch(() => '')).trim();
    const hidden = (await p.locator('#bs-reason').count()) === 0;
    await p.locator('.bs-time').first().click(); await p.waitForTimeout(300);
    const reasonKept = await p.inputValue('#bs-reason').catch(() => '(not shown)');
    await p.screenshot({ path: `${OUT}/laptop_book_taken.png`, fullPage: true });
    rec('TC-16b', 'Errors on screen explain what to fix and keep what was typed', 'Wrong login shows a general message and keeps the email. A taken slot shows a message and keeps the typed reason',
      `wrong password message "${err1}" and email kept "${kept}"; empty form message "${err2}"; slot taken message "${err3}" ; the reason box was hidden after the error: ${hidden}; after choosing another time the reason box still holds "${reasonKept}"`,
      /incorrect|wrong/i.test(err1) && kept === 'willem.gerber@campusbook.test' && /valid|enter|email|password/i.test(err2) && /no longer available/i.test(err3) && reasonKept === 'My typed reason should stay');
    await ctx.close();
  }

  // ---- Expired session
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } }); const p = await ctx.newPage();
    await loginUI(p, 'willem.gerber@campusbook.test');
    await p.evaluate(() => localStorage.setItem('token', 'expired.invalid.token'));
    await p.goto(APP + '/my-bookings'); await p.waitForTimeout(1200);
    const u = p.url(); const msg = (await p.locator('.cb-alert').first().innerText().catch(() => '')).trim();
    await p.screenshot({ path: `${OUT}/laptop_expired.png` });
    rec('TC-28', 'Expired or invalid session sends the user back to login', 'The user is sent to the login page with a clear message',
      `after the token became invalid the page stayed at ${u.replace(APP, '')} and showed "${msg}"`, /\/login/.test(u));
    await ctx.close();
  }

  // ---- change booking in UI
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } }); const p = await ctx.newPage();
    await loginUI(p, 'oscar.khumalo@campusbook.test');
    await p.goto(APP + '/my-bookings'); await p.waitForTimeout(900);
    const txt = (await p.locator('.mb-row').allInnerTexts()).join(' | ');
    const buttons = await p.locator('.mb-row button, .mb-row a').allInnerTexts();
    rec('TC-29', 'Change a booking from My bookings', 'My bookings offers a Change button next to Cancel (FR-06)',
      `buttons on the booking rows: ${JSON.stringify([...new Set(buttons)])}`, buttons.some(t => /change|reschedule/i.test(t)));
    await ctx.close();
  }

  // ---- scripted journey time TC-10 indicative
  {
    await db.query("UPDATE consultation_slots SET status='open' WHERE lecturer_id=2 AND status='cancelled'");
    const ctx = await b.newContext({ viewport: { width: 375, height: 800 } }); const p = await ctx.newPage();
    const t0 = Date.now();
    await loginUI(p, 'thomas.duplessis@campusbook.test'); await p.waitForSelector('.bs-lecturer');
    await p.locator('.bs-lecturer').nth(1).click(); await p.waitForTimeout(600);
    const first = p.locator('.bs-time').first(); await first.click();
    await p.fill('#bs-reason', 'Scripted journey'); await p.locator('button:has-text("Confirm booking")').first().click();
    await p.waitForSelector('text=You are booked'); const t = Date.now() - t0;
    await p.screenshot({ path: `${OUT}/phone_confirmed.png`, fullPage: true });
    rec('TC-10', 'A first time student books in under 2 minutes', 'Timed task with real students under 120 seconds',
      `Scripted run on a phone screen took ${(t / 1000).toFixed(1)} seconds from login to the confirmation. The timed task with real students is planned for Week 5 user testing`, true, { statusOverride: 'Not Run', scripted: t });
    await ctx.close();
  }
  fs.writeFileSync('ui_results.json', JSON.stringify({ res, consoleErrors }, null, 1));
  console.log('console errors', consoleErrors);
  await b.close(); await db.end();
})().catch(e => { console.error('ERR', e); process.exit(1); });
