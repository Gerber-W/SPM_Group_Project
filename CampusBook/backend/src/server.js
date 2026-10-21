require('dotenv').config();
const express = require('express');
const cors = require('cors');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Copy .env.example to .env and fill it in');
  process.exit(1);
}

const app = express();
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(url => url.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '20kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

function mount(path, file) {
  const router = require(file);
  if (typeof router === 'function') app.use(path, router);
  else console.warn(`${file}.js is not finished yet, so ${path} is not available`);
}

mount('/api/auth', './routes/auth');
mount('/api/slots', './routes/slots');
mount('/api/bookings', './routes/bookings');

app.use('/api', (req, res) => res.status(404).json({ error: 'That API route does not exist' }));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body is not valid JSON' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong, please try again' });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => console.log(`CampusBook API running on http://localhost:${port}`));

  const { startReminderJob } = require('./jobs/reminders');
  if (typeof startReminderJob === 'function') startReminderJob();
}

module.exports = app;
