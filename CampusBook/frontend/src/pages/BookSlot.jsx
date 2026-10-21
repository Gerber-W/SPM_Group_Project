import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { errorMessage } from '../utils/errors.js';
import { Alert, Avatar, Button, ButtonLink, DetailList, Field, Page, Section, StepTitle } from '../components/ui.jsx';
import './BookSlot.css';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const parseDate = value => new Date(`${value}T00:00:00`);
const toKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const formatDay = value => parseDate(value).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' });
const formatMonth = date => date.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });

function daysOfMonth(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const blanks = (first.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1));
  return [...Array(blanks).fill(null), ...days];
}

function groupByDate(slots) {
  return slots.reduce((groups, slot) => ({ ...groups, [slot.date]: [...(groups[slot.date] || []), slot] }), {});
}

const bookingDetails = (lecturerName, item) => [
  { icon: 'person', text: lecturerName },
  { icon: 'calendar', text: formatDay(item.date) },
  { icon: 'clock', text: `${item.start} to ${item.end}` },
  { icon: 'place', text: item.location },
];

export default function BookSlot() {
  const [lecturers, setLecturers] = useState([]);
  const [lecturer, setLecturer] = useState(null);
  const [slots, setSlots] = useState([]);
  const [month, setMonth] = useState(() => new Date());
  const [day, setDay] = useState(null);
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null);

  const slotsByDate = useMemo(() => groupByDate(slots), [slots]);
  const today = toKey(new Date());
  const isCurrentMonth = month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth();

  useEffect(() => {
    api.get('/api/slots/lecturers')
      .then(res => setLecturers(res.data))
      .catch(err => setError(errorMessage(err)));
  }, []);

  async function loadSlots(selected) {
    const { data } = await api.get('/api/slots', { params: { lecturerId: selected.id } });
    setSlots(data);
    return data;
  }

  function chooseLecturer(selected) {
    setLecturer(selected);
    setSlot(null);
    setBooking(null);
    setError('');
    loadSlots(selected)
      .then(list => {
        const firstDay = list[0]?.date || null;
        setDay(firstDay);
        if (firstDay) setMonth(parseDate(firstDay));
      })
      .catch(err => setError(errorMessage(err)));
  }

  function chooseDay(key) {
    setDay(key);
    setSlot(null);
  }

  function changeMonth(step) {
    setMonth(current => new Date(current.getFullYear(), current.getMonth() + step, 1));
  }

  async function confirmBooking() {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/api/bookings', { slotId: slot.id, reason: reason.trim() });
      setBooking(data);
      setReason('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSlot(null);
      setSaving(false);
      loadSlots(lecturer).catch(() => {});
    }
  }

  if (booking) {
    return (
      <Page title="You are booked" subtitle={`A confirmation email is on its way to you and ${booking.lecturerName}`}>
        <Section>
          <DetailList items={bookingDetails(booking.lecturerName, booking)} />
          <div className="cb-actions">
            <Button onClick={() => setBooking(null)}>Book another consultation</Button>
            <ButtonLink to="/my-bookings" variant="outline">View my bookings</ButtonLink>
          </div>
        </Section>
      </Page>
    );
  }

  return (
    <Page title="Book a consultation" subtitle="Choose a lecturer, pick a time that suits you and tell them what you need help with">
      <Section>
        <Alert>{error}</Alert>
        <StepTitle number={1} done={Boolean(lecturer)}>Choose a lecturer</StepTitle>
        <div className="bs-lecturers">
          {lecturers.map(item => (
            <button
              key={item.id}
              type="button"
              className={`bs-lecturer ${lecturer?.id === item.id ? 'is-selected' : ''}`}
              aria-pressed={lecturer?.id === item.id}
              onClick={() => chooseLecturer(item)}
            >
              <Avatar name={item.name} size="large" selected={lecturer?.id === item.id} />
              <span className="bs-lecturer-name">{item.name}</span>
              <span className="bs-lecturer-detail">{item.department}</span>
              {item.office && <span className="bs-lecturer-detail">{item.office}</span>}
            </button>
          ))}
        </div>
      </Section>

      {lecturer && (
        <Section>
          <StepTitle number={2} done={Boolean(slot)}>Pick a day and time</StepTitle>
          {!slots.length ? (
            <p className="cb-muted">{lecturer.name} has no open times right now. Try another lecturer or check again later</p>
          ) : (
            <div className="bs-when">
              <div className="bs-calendar">
                <div className="bs-calendar-header">
                  <strong>{formatMonth(month)}</strong>
                  <div>
                    <button type="button" aria-label="Previous month" disabled={isCurrentMonth} onClick={() => changeMonth(-1)}>‹</button>
                    <button type="button" aria-label="Next month" onClick={() => changeMonth(1)}>›</button>
                  </div>
                </div>
                <div className="bs-calendar-grid">
                  {WEEKDAYS.map(name => <span key={name} className="bs-weekday">{name}</span>)}
                  {daysOfMonth(month).map((date, index) => {
                    if (!date) return <span key={`blank-${index}`} />;
                    const key = toKey(date);
                    const open = Boolean(slotsByDate[key]);
                    const names = ['bs-day', open && 'is-open', key === day && 'is-selected', key === today && 'is-today'];
                    return (
                      <button key={key} type="button" disabled={!open} className={names.filter(Boolean).join(' ')} onClick={() => chooseDay(key)}>
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
                <div className="bs-legend">
                  <span><i className="bs-dot is-open" />Available</span>
                  <span><i className="bs-dot is-selected" />Selected</span>
                  <span className="cb-muted">South African time</span>
                </div>
              </div>

              <div>
                <h3 className="bs-day-title">{day ? formatDay(day) : 'Choose a day'}</h3>
                {day && !slotsByDate[day] && <p className="cb-muted">No more open times on this day</p>}
                <div className="bs-time-grid">
                  {(slotsByDate[day] || []).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className={`bs-time ${slot?.id === item.id ? 'is-selected' : ''}`}
                      aria-pressed={slot?.id === item.id}
                      onClick={() => setSlot(item)}
                    >
                      {item.start} to {item.end}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Section>
      )}

      {slot && (
        <Section>
          <StepTitle number={3}>Confirm your booking</StepTitle>
          <DetailList items={bookingDetails(lecturer.name, slot)} />
          <Field
            id="bs-reason"
            as="textarea"
            label="What do you need help with?"
            rows={3}
            maxLength={255}
            value={reason}
            placeholder="For example feedback on my ERD before the assignment is due"
            onChange={event => setReason(event.target.value)}
          />
          <div className="bs-confirm">
            <Button disabled={!reason.trim() || saving} onClick={confirmBooking}>
              {saving ? 'Booking' : 'Confirm booking'}
            </Button>
          </div>
        </Section>
      )}
    </Page>
  );
}
