import { useEffect, useState } from 'react';
import api from '../api';
import { errorMessage } from '../utils/errors.js';
import { Alert, Avatar, Badge, Button, ButtonLink, EmptyState, Page, Section } from '../components/ui.jsx';
import './MyBookings.css';

const formatDay = value => new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const isUpcoming = booking => booking.status === 'confirmed' && !booking.isPast;

function BookingRow({ booking, children }) {
  return (
    <li className="mb-row">
      <Avatar name={booking.lecturerName} />
      <div className="mb-who">
        <strong>{booking.lecturerName}</strong>
        <span className="cb-muted">{booking.reason}</span>
      </div>
      <div className="mb-when">
        <strong>{formatDay(booking.date)}</strong>
        <span>{booking.start} to {booking.end}</span>
        <span className="cb-muted">{booking.location}</span>
      </div>
      <div className="mb-end">{children}</div>
    </li>
  );
}

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  async function load() {
    try {
      const { data } = await api.get('/api/bookings/mine');
      setBookings(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function cancel(id) {
    setCancellingId(id);
    setError('');
    setNotice('');
    try {
      await api.patch(`/api/bookings/${id}/cancel`);
      setNotice('Your booking is cancelled and the lecturer has been told');
      setConfirmId(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCancellingId(null);
    }
  }

  const upcoming = bookings.filter(isUpcoming).reverse();
  const history = bookings.filter(booking => !isUpcoming(booking));

  return (
    <Page
      title="My bookings"
      subtitle="Your upcoming consultations and your booking history"
      actions={<ButtonLink to="/book">Book a consultation</ButtonLink>}
    >
      <Section>
        <Alert>{error}</Alert>
        <Alert type="success">{notice}</Alert>
        <h2 className="mb-title">Upcoming</h2>
        {loading ? (
          <p className="cb-muted">Loading your bookings</p>
        ) : !upcoming.length ? (
          <EmptyState title="No upcoming bookings">Book a time with a lecturer and it will show here</EmptyState>
        ) : (
          <ul className="mb-list">
            {upcoming.map(booking => (
              <BookingRow key={booking.id} booking={booking}>
                {confirmId === booking.id ? (
                  <>
                    <Button variant="ghost" size="small" onClick={() => setConfirmId(null)}>Keep it</Button>
                    <Button size="small" disabled={cancellingId === booking.id} onClick={() => cancel(booking.id)}>
                      {cancellingId === booking.id ? 'Cancelling' : 'Yes, cancel'}
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="small" onClick={() => setConfirmId(booking.id)}>Cancel booking</Button>
                )}
              </BookingRow>
            ))}
          </ul>
        )}
      </Section>

      <Section>
        <h2 className="mb-title">History</h2>
        {loading ? null : !history.length ? (
          <EmptyState title="No past bookings yet" />
        ) : (
          <ul className="mb-list">
            {history.map(booking => (
              <BookingRow key={booking.id} booking={booking}>
                {booking.status === 'cancelled' ? <Badge status="cancelled">Cancelled</Badge> : <Badge status="completed">Completed</Badge>}
              </BookingRow>
            ))}
          </ul>
        )}
      </Section>
    </Page>
  );
}
