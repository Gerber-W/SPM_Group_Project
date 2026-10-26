const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const mysql = require('./CampusBook/backend/node_modules/mysql2/promise');
const APP = 'http://localhost:5173'; const OUT = 'shots2'; require('fs').mkdirSync(OUT, { recursive: true });
const res = {};
(async () => {
  const db = await mysql.createConnection({ socketPath: '/tmp/mdb.sock', user: 'root', password: process.env.DB_PASSWORD, database: 'campusbook' });
  const b = await chromium.launch();
  for (const [name, w, h] of [['laptop', 1366, 768], ['phone', 375, 800]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    const reqs = []; p.on('response', r => { if (r.url().includes('/api/slots')) reqs.push(`${r.request().method()} ${r.url().replace('http://127.0.0.1:4100', '')} ${r.status()}`); });
    p.on('dialog', d => d.accept());
    await p.goto(APP + '/login'); await p.fill('#email', 'jabulile.mashibini@campusbook.test'); await p.fill('#password', 'CampusBook123');
    await p.click('form button[type=submit]'); await p.waitForURL('**/lecturer/slots'); await p.waitForTimeout(1200);
    const alert1 = (await p.locator('.cb-alert').allInnerTexts()).join(' | ');
    const rows1 = await p.locator('.ls-table tbody tr').count();
    const empty = await p.locator('text=No consultation slots').count();
    const ov = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    await p.screenshot({ path: `${OUT}/${name}_lecturer_load.png`, fullPage: true });
    const d = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    await p.fill('#ls-date', d); await p.fill('#ls-start', '14:00'); await p.fill('#ls-end', '14:30'); await p.fill('#ls-location', 'Room B12');
    await p.click('button:has-text("Publish slot")'); await p.waitForTimeout(1200);
    const alert2 = (await p.locator('.cb-alert').allInnerTexts()).join(' | ');
    const [[{ n }]] = await db.query("SELECT COUNT(*) n FROM consultation_slots WHERE lecturer_id=1 AND location='Room B12' AND start_time='14:00:00' AND slot_date=?", [d]);
    await p.screenshot({ path: `${OUT}/${name}_lecturer_publish.png`, fullPage: true });
    const rowsAfter = await p.locator('.ls-table tbody tr').count();
    await p.locator('.ls-table tbody tr', { hasText: d }).locator('button:has-text("Edit")').first().click(); await p.waitForTimeout(300);
    const formTitle = await p.locator('text=Edit a slot').count();
    await p.fill('#ls-location', 'Room C3'); await p.click('button:has-text("Save changes")'); await p.waitForTimeout(1200);
    const alertEdit = (await p.locator('.cb-alert').allInnerTexts()).join(' | ');
    const [[{ loc }]] = await db.query("SELECT location loc FROM consultation_slots WHERE lecturer_id=1 AND start_time='14:00:00' AND slot_date=?", [d]);
    await p.screenshot({ path: `${OUT}/${name}_lecturer_edit.png`, fullPage: true });
    let rowsRemoved = null, alert3 = '';
    if (rowsAfter > 0) { await p.locator('.ls-table tbody tr', { hasText: d }).locator('button:has-text("Remove")').first().click(); await p.waitForTimeout(1000); rowsRemoved = await p.locator('.ls-table tbody tr').count(); alert3 = (await p.locator('.cb-alert').allInnerTexts()).join(' | '); }
    res[name] = { formTitle, alertEdit, locationAfterEdit: loc, rowsAfter, rowsRemoved, alert3, alert1, rows1, empty, noSideways: ov, alert2, createdInDb: Number(n), reqs };
    console.log(name, JSON.stringify(res[name]));
  }
  require('fs').writeFileSync('lect_results.json', JSON.stringify(res, null, 1));
  await b.close(); await db.end();
})();
