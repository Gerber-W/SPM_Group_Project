const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { isDate, isTime, isText, isId, validateBody } = require('../middleware/validate');

const router = express.Router();
router.use(requireAuth);

// Every slot is sent to the front end in this shape: { id, date, startTime, endTime, location, status }
// DATE_FORMAT and TIME_FORMAT keep dates as plain text so time zones cannot shift them
const SLOT_FIELDS = `
  s.slot_id AS id,
  s.lecturer_id AS lecturerId,
  DATE_FORMAT(s.slot_date, '%Y-%m-%d') AS date,
  TIME_FORMAT(s.start_time, '%H:%i') AS startTime,
  TIME_FORMAT(s.end_time, '%H:%i') AS endTime,
  s.location,
  s.status`;

// isDate in validate.js accepts 2026-02-31, so check that the day really exists
const isRealDate = value =>
  isDate(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

const slotRules = validateBody({
  date: [isRealDate, 'Enter a valid date (YYYY-MM-DD)'],
  startTime: [isTime, 'Enter a valid start time (HH:MM)'],
  endTime: [isTime, 'Enter a valid end time (HH:MM)'],
  location: [value => isText(value, 100), 'Enter a location (up to 100 characters)'],
});

function httpError(status, message) {
  const err = new Error(message);
  err.status = status; // server.js turns this into { error: message }
  return err;
}

function cleanSlot(body) {
  return {
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    location: body.location.trim(),
  };
}

async function getSlot(db, id) {
  const [[slot]] = await db.query(`SELECT ${SLOT_FIELDS} FROM consultation_slots s WHERE s.slot_id = ?`, [id]);
  return slot;
}

// FR-03: the time must be valid, in the future, and not overlap the lecturer's other slots
async function checkSlotTime(db, lecturerId, slot, ignoreId = 0) {
  if (slot.endTime <= slot.startTime) throw httpError(400, 'The end time must be after the start time');

  const [[{ isFuture }]] = await db.query('SELECT TIMESTAMP(?, ?) > NOW() AS isFuture', [slot.date, slot.startTime]);
  if (!isFuture) throw httpError(400, 'Choose a time in the future');

  const [overlap] = await db.query(
    `SELECT slot_id FROM consultation_slots
     WHERE lecturer_id = ? AND slot_date = ? AND status <> 'cancelled' AND slot_id <> ?
       AND start_time < ? AND end_time > ?
     LIMIT 1`,
    [lecturerId, slot.date, ignoreId, slot.endTime, slot.startTime]
  );
  if (overlap.length) throw httpError(409, 'This overlaps another one of your slots');
}

// Edit or remove: only the owner, only future slots, never a booked slot.
// The slot row is locked, the same way the booking route locks it, so a student
// cannot book it while the lecturer is changing it.
async function withOwnSlot(req, res, next, action) {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'That slot id is not valid' });
  const slotId = Number(req.params.id);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[slot]] = await conn.query(
      `SELECT slot_id, lecturer_id, status, TIMESTAMP(slot_date, start_time) > NOW() AS isFuture
       FROM consultation_slots WHERE slot_id = ? FOR UPDATE`,
      [slotId]
    );

    // Another lecturer's slot looks the same as a slot that does not exist (TC-03)
    if (!slot || slot.lecturer_id !== req.user.id || slot.status === 'cancelled') {
      throw httpError(404, 'Slot not found');
    }

    const [active] = await conn.query('SELECT booking_id FROM bookings WHERE active_slot_id = ?', [slotId]);
    if (active.length || slot.status === 'booked') {
      throw httpError(409, 'A booked slot cannot be changed or removed. Ask the student to cancel first');
    }
    if (!slot.isFuture) throw httpError(400, 'Past slots cannot be changed');

    const result = await action(conn, slot);
    await conn.commit();
    res.json(result);
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

/* ---------- Student routes ---------- */

// Lecturer cards: name, department, room and number of open future slots
router.get('/lecturers', requireRole('student'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.user_id AS id, u.full_name AS name, lp.department, lp.office,
              COUNT(s.slot_id) AS openSlots
       FROM users u
       JOIN lecturer_profiles lp ON lp.lecturer_id = u.user_id
       LEFT JOIN consultation_slots s
         ON s.lecturer_id = u.user_id AND s.status = 'open'
        AND TIMESTAMP(s.slot_date, s.start_time) > NOW()
       WHERE u.role = 'lecturer'
       GROUP BY u.user_id, u.full_name, lp.department, lp.office
       ORDER BY u.full_name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// FR-04: open future slots of one lecturer. Example: GET /api/slots?lecturerId=1
router.get('/', requireRole('student'), async (req, res, next) => {
  try {
    if (!isId(req.query.lecturerId)) return res.status(400).json({ error: 'Choose a lecturer' });

    const [rows] = await pool.query(
      `SELECT ${SLOT_FIELDS}
       FROM consultation_slots s
       WHERE s.lecturer_id = ? AND s.status = 'open'
         AND TIMESTAMP(s.slot_date, s.start_time) > NOW()
       ORDER BY s.slot_date, s.start_time`,
      [Number(req.query.lecturerId)]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/* ---------- Lecturer routes ---------- */

// The lecturer's own upcoming slots, with the student and reason on booked ones
router.get('/mine', requireRole('lecturer'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${SLOT_FIELDS}, st.full_name AS studentName, b.reason
       FROM consultation_slots s
       LEFT JOIN bookings b ON b.active_slot_id = s.slot_id
       LEFT JOIN users st ON st.user_id = b.student_id
       WHERE s.lecturer_id = ? AND s.status <> 'cancelled' AND s.slot_date >= CURDATE()
       ORDER BY s.slot_date, s.start_time`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Publish a slot. Body: { date, startTime, endTime, location }
router.post('/', requireRole('lecturer'), slotRules, async (req, res, next) => {
  try {
    const slot = cleanSlot(req.body);
    await checkSlotTime(pool, req.user.id, slot);

    let id;
    try {
      const [result] = await pool.query(
        `INSERT INTO consultation_slots (lecturer_id, slot_date, start_time, end_time, location)
         VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, slot.date, slot.startTime, slot.endTime, slot.location]
      );
      id = result.insertId;
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;

      // The lecturer removed a slot with this start time earlier (it is kept as 'cancelled'
      // because it has booking history), so bring that slot back
      const [[old]] = await pool.query(
        'SELECT slot_id FROM consultation_slots WHERE lecturer_id = ? AND slot_date = ? AND start_time = ?',
        [req.user.id, slot.date, slot.startTime]
      );
      const [update] = await pool.query(
        `UPDATE consultation_slots SET status = 'open', end_time = ?, location = ?
         WHERE slot_id = ? AND status = 'cancelled'`,
        [slot.endTime, slot.location, old.slot_id]
      );
      if (!update.affectedRows) throw httpError(409, 'You already have a slot at that time');
      id = old.slot_id;
    }

    res.status(201).json(await getSlot(pool, id));
  } catch (err) {
    next(err);
  }
});

// Edit a slot (same body as publishing)
router.put('/:id', requireRole('lecturer'), slotRules, (req, res, next) =>
  withOwnSlot(req, res, next, async (conn, current) => {
    const slot = cleanSlot(req.body);
    await checkSlotTime(conn, req.user.id, slot, current.slot_id);

    try {
      await conn.query(
        `UPDATE consultation_slots SET slot_date = ?, start_time = ?, end_time = ?, location = ?
         WHERE slot_id = ?`,
        [slot.date, slot.startTime, slot.endTime, slot.location, current.slot_id]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw httpError(409, 'You already have a slot at that time');
      throw err;
    }
    return getSlot(conn, current.slot_id);
  })
);

// Remove a slot. A slot that never had a booking is deleted; one with booking history
// is marked 'cancelled' so the history stays intact
router.delete('/:id', requireRole('lecturer'), (req, res, next) =>
  withOwnSlot(req, res, next, async (conn, slot) => {
    const [[{ total }]] = await conn.query('SELECT COUNT(*) AS total FROM bookings WHERE slot_id = ?', [slot.slot_id]);

    if (Number(total) === 0) {
      await conn.query('DELETE FROM consultation_slots WHERE slot_id = ?', [slot.slot_id]);
    } else {
      await conn.query("UPDATE consultation_slots SET status = 'cancelled' WHERE slot_id = ?", [slot.slot_id]);
    }
    return { message: 'Slot removed' };
  })
);

module.exports = router;