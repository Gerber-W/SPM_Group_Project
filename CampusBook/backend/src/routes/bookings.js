
const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { isId, isText, validateBody } = require('../middleware/validate');
const mailer = require('../services/mailer');

const router = express.Router();
router.use(requireAuth);

const REMINDER_MINUTES = Number(
  process.env.REMINDER_MINUTES_BEFORE || 60
);

const SLOT_TAKEN = 'Sorry, that slot is no longer available';

const httpError = (status, message) =>
  Object.assign(new Error(message), { status });

const BOOKING_COLUMNS = `
  b.booking_id AS id,
  b.status,
  b.reason,
  s.slot_id AS slotId,
  s.slot_date AS date,
  TIME_FORMAT(s.start_time, '%H:%i') AS start,
  TIME_FORMAT(s.end_time, '%H:%i') AS end,
  s.location,
  TIMESTAMP(s.slot_date, s.start_time) < NOW() AS isPast
`;

async function withTransaction(work) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const result = await work(conn);

    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Returns true only when the mailer reports that an email
// was accepted by the configured SMTP server.
async function sendEmail(to, subject, text) {
  try {
    const result = await mailer.sendMail(to, subject, text);
    return result?.sent === true;
  } catch (err) {
    console.error(`Email to ${to} failed: ${err.message}`);
    return false;
  }
}

// Send messages to both the student and the lecturer.
// The operation succeeds only when both emails succeed.
async function emailBoth(
  user,
  slot,
  subject,
  studentMessage,
  lecturerMessage
) {
  const results = await Promise.all([
    sendEmail(user.email, subject, studentMessage),
    sendEmail(slot.lecturerEmail, subject, lecturerMessage),
  ]);

  return results.every(Boolean);
}

// Record the outcome of the booking confirmation emails.
async function markConfirmationSent(bookingId, emailsSent) {
  const status = emailsSent ? 'sent' : 'failed';

  await pool.query(
    `UPDATE notifications
        SET status = ?,
            sent_at = CASE
              WHEN ? = 'sent' THEN NOW()
              ELSE NULL
            END
      WHERE booking_id = ?
        AND type = 'confirmation'`,
    [status, status, bookingId]
  );
}

const describe = slot =>
  `${slot.date} at ${slot.start} in ${slot.location}`;

const toPublicBooking = (id, slot) => ({
  id,
  date: slot.date,
  start: slot.start,
  end: slot.end,
  location: slot.location,
  lecturerName: slot.lecturerName,
});

async function lockSlot(conn, slotId) {
  const [[slot]] = await conn.query(
    `SELECT
        s.slot_id AS id,
        s.slot_date AS date,
        TIME_FORMAT(s.start_time, '%H:%i') AS start,
        TIME_FORMAT(s.end_time, '%H:%i') AS end,
        s.location,
        s.status,
        TIMESTAMP(s.slot_date, s.start_time) > NOW() AS isFuture,
        u.full_name AS lecturerName,
        u.email AS lecturerEmail
     FROM consultation_slots s
     JOIN users u ON u.user_id = s.lecturer_id
     WHERE s.slot_id = ?
     FOR UPDATE`,
    [slotId]
  );

  return slot;
}

async function bookSlot(conn, slotId, studentId, reason) {
  const slot = await lockSlot(conn, slotId);

  if (
    !slot ||
    slot.status !== 'open' ||
    !slot.isFuture
  ) {
    throw httpError(409, SLOT_TAKEN);
  }

  const [result] = await conn
    .query(
      `INSERT INTO bookings (slot_id, student_id, reason)
       VALUES (?, ?, ?)`,
      [slotId, studentId, reason]
    )
    .catch(err => {
      throw err.code === 'ER_DUP_ENTRY'
        ? httpError(409, SLOT_TAKEN)
        : err;
    });

  await conn.query(
    "UPDATE consultation_slots SET status = 'booked' WHERE slot_id = ?",
    [slotId]
  );

  await conn.query(
    `INSERT INTO notifications (booking_id, type, send_at)
     VALUES
       (?, 'confirmation', NOW()),
       (?, 'reminder', TIMESTAMP(?, ?) - INTERVAL ? MINUTE)`,
    [
      result.insertId,
      result.insertId,
      slot.date,
      slot.start,
      REMINDER_MINUTES,
    ]
  );

  return {
    bookingId: result.insertId,
    slot,
  };
}

async function cancelBooking(conn, bookingId, studentId) {
  const [[booking]] = await conn.query(
    `SELECT
        b.booking_id,
        b.slot_id,
        b.reason
     FROM bookings b
     JOIN consultation_slots s ON s.slot_id = b.slot_id
     WHERE b.booking_id = ?
       AND b.student_id = ?
       AND b.status = 'confirmed'
       AND TIMESTAMP(s.slot_date, s.start_time) > NOW()
     FOR UPDATE`,
    [bookingId, studentId]
  );

  if (!booking) {
    throw httpError(404, 'Upcoming booking not found');
  }

  await conn.query(
    "UPDATE bookings SET status = 'cancelled' WHERE booking_id = ?",
    [bookingId]
  );

  await conn.query(
    "UPDATE consultation_slots SET status = 'open' WHERE slot_id = ?",
    [booking.slot_id]
  );

  // Remove pending notifications for the cancelled booking.
  await conn.query(
    "DELETE FROM notifications WHERE booking_id = ? AND status = 'pending'",
    [bookingId]
  );

  return {
    ...booking,
    slot: await lockSlot(conn, booking.slot_id),
  };
}

const toBookingList = rows =>
  rows.map(row => ({
    ...row,
    isPast: Boolean(row.isPast),
  }));

function checkBookingId(req, res, next) {
  if (isId(req.params.id)) return next();

  res.status(400).json({ error: 'Invalid booking' });
}

router.get(
  '/mine',
  requireRole('student'),
  async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        `SELECT ${BOOKING_COLUMNS},
                u.full_name AS lecturerName
         FROM bookings b
         JOIN consultation_slots s ON s.slot_id = b.slot_id
         JOIN users u ON u.user_id = s.lecturer_id
         WHERE b.student_id = ?
         ORDER BY s.slot_date DESC, s.start_time DESC`,
        [req.user.id]
      );

      res.json(toBookingList(rows));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/lecturer',
  requireRole('lecturer'),
  async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        `SELECT ${BOOKING_COLUMNS},
                u.full_name AS studentName,
                u.student_number AS studentNumber
         FROM bookings b
         JOIN consultation_slots s ON s.slot_id = b.slot_id
         JOIN users u ON u.user_id = b.student_id
         WHERE s.lecturer_id = ?
         ORDER BY s.slot_date DESC, s.start_time DESC`,
        [req.user.id]
      );

      res.json(toBookingList(rows));
    } catch (err) {
      next(err);
    }
  }
);

const bookingRules = validateBody({
  slotId: [isId, 'Choose a slot'],
  reason: [
    value => isText(value, 255),
    'Give a short reason for the visit (up to 255 characters)',
  ],
});

router.post(
  '/',
  requireRole('student'),
  bookingRules,
  async (req, res, next) => {
    try {
      const reason = req.body.reason.trim();

      const { bookingId, slot } = await withTransaction(
        conn =>
          bookSlot(
            conn,
            req.body.slotId,
            req.user.id,
            reason
          )
      );

      const emailsSent = await emailBoth(
        req.user,
        slot,
        'Consultation booked',
        `Your consultation with ${slot.lecturerName} is booked for ${describe(slot)}`,
        `${req.user.name} booked your slot on ${describe(slot)}. Reason: ${reason}`
      );

      await markConfirmationSent(bookingId, emailsSent);

      res.status(201).json(toPublicBooking(bookingId, slot));
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id/cancel',
  requireRole('student'),
  checkBookingId,
  async (req, res, next) => {
    try {
      const { slot } = await withTransaction(
        conn =>
          cancelBooking(
            conn,
            req.params.id,
            req.user.id
          )
      );

      await emailBoth(
        req.user,
        slot,
        'Consultation cancelled',
        `Your consultation with ${slot.lecturerName} on ${describe(slot)} is cancelled`,
        `${req.user.name} cancelled the consultation on ${describe(slot)}. The slot is open again`
      );

      res.json({ cancelled: true });
    } catch (err) {
      next(err);
    }
  }
);

const changeRules = validateBody({
  newSlotId: [isId, 'Choose the new slot'],
});

router.patch(
  '/:id/change',
  requireRole('student'),
  checkBookingId,
  changeRules,
  async (req, res, next) => {
    try {
      const { bookingId, slot } = await withTransaction(
        async conn => {
          const old = await cancelBooking(
            conn,
            req.params.id,
            req.user.id
          );

          if (old.slot_id === Number(req.body.newSlotId)) {
            throw httpError(
              400,
              'That is already your booked slot'
            );
          }

          return bookSlot(
            conn,
            req.body.newSlotId,
            req.user.id,
            old.reason
          );
        }
      );

      const emailsSent = await emailBoth(
        req.user,
        slot,
        'Consultation changed',
        `Your consultation with ${slot.lecturerName} has moved to ${describe(slot)}`,
        `${req.user.name} moved their consultation to your slot on ${describe(slot)}`
      );

      await markConfirmationSent(bookingId, emailsSent);

      res.json(toPublicBooking(bookingId, slot));
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
