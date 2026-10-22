
import { useEffect, useState } from 'react';
import api from '../api';
import { errorMessage } from '../utils/errors.js';
import {
  Page,
  Section,
  StepTitle,
  Field,
  Button,
  Alert,
  Badge,
  EmptyState
} from '../components/ui.jsx';
import './LecturerSlots.css';

const today = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
};

export default function LecturerSlots() {
  const [slots, setSlots] = useState([]);
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadSlots() {
    try {
      const { data } = await api.get('/api/slots/my');
      setSlots(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSlots();
  }, []);

  function clearForm() {
    setDate('');
    setStart('');
    setEnd('');
    setLocation('');
  }

  async function publishSlot(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!date || !start || !end || !location.trim()) {
      setError('Please complete all fields.');
      return;
    }

    if (end <= start) {
      setError('End time must be after start time.');
      return;
    }

    if (new Date(`${date}T${start}`) <= new Date()) {
      setError('Please choose a future date and time.');
      return;
    }

    const overlaps = slots.some(slot =>
      slot.date === date &&
      start < slot.end &&
      end > slot.start
    );

    if (overlaps) {
      setError('This time overlaps an existing slot.');
      return;
    }

    setSaving(true);

    try {
      await api.post('/api/slots', {
        date,
        start,
        end,
        location: location.trim()
      });

      setSuccess('Consultation slot published successfully.');
      clearForm();
      await loadSlots();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeSlot(id) {
    if (!window.confirm('Remove this consultation slot?')) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await api.delete(`/api/slots/${id}`);
      setSuccess('Consultation slot removed.');
      await loadSlots();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Page
      title="My consultation slots"
      subtitle="Publish your available times and manage student consultations"
    >
      <Section>
        <StepTitle number={1}>Publish a slot</StepTitle>

        <Alert>{error}</Alert>
        <Alert type="success">{success}</Alert>

        <form onSubmit={publishSlot}>
          <div className="ls-form-grid">
            <Field
              id="ls-date"
              label="Date"
              type="date"
              min={today()}
              value={date}
              onChange={event => setDate(event.target.value)}
              required
            />

            <Field
              id="ls-start"
              label="Start"
              type="time"
              value={start}
              onChange={event => setStart(event.target.value)}
              required
            />

            <Field
              id="ls-end"
              label="End"
              type="time"
              hint="End must be after start"
              value={end}
              onChange={event => setEnd(event.target.value)}
              required
            />

            <Field
              id="ls-location"
              label="Location"
              type="text"
              placeholder="Room B12 or Teams"
              hint="Room or Teams"
              value={location}
              onChange={event => setLocation(event.target.value)}
              maxLength={100}
              required
            />
          </div>

          <div className="cb-actions ls-actions">
            <Button type="submit" disabled={saving}>
              {saving ? 'Publishing...' : 'Publish slot'}
            </Button>

            <Button
              variant="outline"
              onClick={clearForm}
            >
              Clear
            </Button>
          </div>
        </form>
      </Section>

      <Section>
        <StepTitle number={2}>My published slots</StepTitle>

        <p className="cb-muted">
          View your available and booked consultation times.
        </p>

        {loading ? (
          <p className="cb-muted">Loading slots...</p>
        ) : slots.length === 0 ? (
          <EmptyState title="No consultation slots">
            <p>
              Publish your first consultation slot above.
            </p>
          </EmptyState>
        ) : (
          <div className="ls-table-wrapper">
            <table className="ls-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Student</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {slots.map(slot => {
                  const booked =
                    slot.status === 'booked' ||
                    Boolean(slot.booking);

                  return (
                    <tr key={slot.id}>
                      <td>{slot.date}</td>
                      <td>
                        {slot.start} to {slot.end}
                      </td>
                      <td>{slot.location}</td>
                      <td>
                        <Badge status={booked ? 'booked' : 'open'}>
                          {booked ? 'Booked' : 'Available'}
                        </Badge>
                      </td>
                      <td>
                        {slot.booking?.studentName ||
                          slot.studentName ||
                          '—'}
                      </td>
                      <td>
                        {!booked ? (
                          <Button
                            variant="outline"
                            size="small"
                            onClick={() => removeSlot(slot.id)}
                          >
                            Remove
                          </Button>
                        ) : (
                          <span className="cb-muted">
                            Booked
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </Page>
  );
}
