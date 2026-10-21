
const cron = require('node-cron');
const pool = require('../db');
const mailer = require('../services/mailer');

const REMINDER_JOB_LOCK = 'campusbook_reminder_job';
const BATCH_SIZE = 25;

let scheduledTask = null;
let runInProgress = false;

async function processDueReminders() {
  // Prevent overlapping runs in this application process.
  if (runInProgress) return;

  runInProgress = true;

  let connection;
  let lockAcquired = false;

  try {
    connection = await pool.getConnection();

    // Prevent another server process from running this job simultaneously.
    const [[lock]] = await connection.query(
      'SELECT GET_LOCK(?, 0) AS acquired',
      [REMINDER_JOB_LOCK]
    );

    if (Number(lock.acquired) !== 1) return;

    lockAcquired = true;

    // Do not send reminders for cancelled bookings or past appointments.
    await connection.query(`
      UPDATE notifications n
      JOIN bookings b ON b.booking_id = n.booking_id
      JOIN consultation_slots s ON s.slot_id = b.slot_id
      SET n.status = 'failed'
      WHERE n.type = 'reminder'
        AND n.status = 'pending'
        AND (
          b.status <> 'confirmed'
          OR TIMESTAMP(s.slot_date, s.start_time) <= NOW()
        )
    `);

    // Find reminders that are due and still have valid bookings.
    const [reminders] = await connection.query(`
      SELECT
        n.notification_id AS notificationId,
        b.booking_id AS bookingId,
        student.full_name AS studentName,
        student.email AS studentEmail,
        lecturer.full_name AS lecturerName,
        lecturer.email AS lecturerEmail,
        DATE_FORMAT(s.slot_date, '%Y-%m-%d') AS slotDate,
        TIME_FORMAT(s.start_time, '%H:%i') AS startTime,
        TIME_FORMAT(s.end_time, '%H:%i') AS endTime,
        s.location
      FROM notifications n
      JOIN bookings b ON b.booking_id = n.booking_id
      JOIN consultation_slots s ON s.slot_id = b.slot_id
      JOIN users student ON student.user_id = b.student_id
      JOIN users lecturer ON lecturer.user_id = s.lecturer_id
      WHERE n.type = 'reminder'
        AND n.status = 'pending'
        AND n.send_at <= NOW()
        AND b.status = 'confirmed'
        AND TIMESTAMP(s.slot_date, s.start_time) > NOW()
      ORDER BY n.send_at ASC
      LIMIT ?
    `, [BATCH_SIZE]);

    for (const reminder of reminders) {
      try {
        const appointment =
          `${reminder.slotDate} from ${reminder.startTime} ` +
          `to ${reminder.endTime} at ${reminder.location}`;

        await Promise.all([
          mailer.sendMail(
            reminder.studentEmail,
            'Upcoming consultation reminder',
            `Hi ${reminder.studentName},\n\n` +
            `This is a reminder of your consultation with ` +
            `${reminder.lecturerName} on ${appointment}.\n\n` +
            'Please remember to attend your appointment.\n\nCampusBook'
          ),
          mailer.sendMail(
            reminder.lecturerEmail,
            'Upcoming consultation reminder',
            `Hi ${reminder.lecturerName},\n\n` +
            `${reminder.studentName} has a consultation booked with you ` +
            `on ${appointment}.\n\nCampusBook`
          )
        ]);

        await connection.query(`
          UPDATE notifications
          SET status = 'sent', sent_at = NOW()
          WHERE notification_id = ?
            AND status = 'pending'
        `, [reminder.notificationId]);

        console.log(
          `Reminder processed for booking ${reminder.bookingId}`
        );
      } catch (error) {
        await connection.query(`
          UPDATE notifications
          SET status = 'failed'
          WHERE notification_id = ?
            AND status = 'pending'
        `, [reminder.notificationId]);

        console.error(
          `Reminder failed for booking ${reminder.bookingId}:`,
          error.message
        );
      }
    }

    if (reminders.length > 0) {
      console.log(`Processed ${reminders.length} due reminder(s).`);
    }
  } finally {
    if (connection) {
      try {
        if (lockAcquired) {
          await connection.query(
            'SELECT RELEASE_LOCK(?)',
            [REMINDER_JOB_LOCK]
          );
        }
      } finally {
        connection.release();
      }
    }

    runInProgress = false;
  }
}

function startReminderJob() {
  if (scheduledTask) return scheduledTask;

  scheduledTask = cron.schedule(
    '* * * * *',
    () => {
      processDueReminders().catch(error => {
        console.error('CampusBook reminder job error:', error.message);
      });
    },
    { timezone: 'Africa/Johannesburg' }
  );

  console.log('CampusBook reminder job scheduled to run every minute.');

  return scheduledTask;
}

module.exports = {
  startReminderJob,
  processDueReminders
};
