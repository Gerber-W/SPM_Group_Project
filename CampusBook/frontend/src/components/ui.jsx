import { Link } from 'react-router-dom';
import { initials } from '../utils/text.js';
import '../styles/theme.css';

const classes = (...names) => names.filter(Boolean).join(' ');

function Headline({ text }) {
  const words = text.split(' ');
  const last = words.pop();
  return (
    <>
      {words.length > 0 && <span className="cb-hero-light">{words.join(' ')} </span>}
      <span className="cb-hero-strong">{last}</span>
    </>
  );
}

export function Page({ title, subtitle, eyebrow, actions, image, children }) {
  return (
    <section className="cb-page-wrap">
      <header className="cb-hero">
        <div className="cb-hero-inner">
          <img className="cb-hero-ribbon" src="/img/ribbon.webp" alt="" />
          <div className="cb-hero-text">
            <h1><Headline text={title} /></h1>
            {subtitle && <p>{subtitle}</p>}
            {actions && <div className="cb-actions">{actions}</div>}
          </div>
          {eyebrow && <span className="cb-tab">{eyebrow}</span>}
          {image && <img className="cb-hero-person" src={`/img/${image}.webp`} alt="" />}
        </div>
      </header>
      <div className="cb-page">{children}</div>
    </section>
  );
}

export function Section({ children }) {
  return <div className="cb-section">{children}</div>;
}

export function StepTitle({ number, done = false, children }) {
  return (
    <h2 className="cb-step-title">
      <span className={classes('cb-step-number', done && 'is-done')}>{done ? '✓' : number}</span>
      {children}
    </h2>
  );
}

export function Button({ variant = 'primary', size, block = false, className, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={classes('cb-btn', `cb-btn-${variant}`, size === 'small' && 'cb-btn-small', block && 'cb-btn-block', className)}
      {...props}
    />
  );
}

export function ButtonLink({ to, variant = 'primary', size, children }) {
  return (
    <Link to={to} className={classes('cb-btn', `cb-btn-${variant}`, size === 'small' && 'cb-btn-small')}>
      {children}
    </Link>
  );
}

export function Field({ id, label, hint, error, as: Control = 'input', ...props }) {
  return (
    <div className={classes('cb-field', error && 'has-error')}>
      <label htmlFor={id}>{label}</label>
      <Control id={id} aria-invalid={Boolean(error)} {...props} />
      {error ? <span className="cb-field-error">{error}</span> : hint && <span className="cb-field-hint">{hint}</span>}
    </div>
  );
}

export function Alert({ type = 'error', children }) {
  if (!children) return null;
  return <p className={`cb-alert cb-alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>{children}</p>;
}

export function Avatar({ name, size = 'medium', selected = false }) {
  return (
    <span className={classes('cb-avatar', `cb-avatar-${size}`, selected && 'is-selected')} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

const BADGE_TONES = {
  confirmed: 'success',
  open: 'success',
  booked: 'warning',
  pending: 'warning',
  cancelled: 'danger',
  completed: 'neutral',
};

export function Badge({ status, children }) {
  return <span className={`cb-badge cb-badge-${BADGE_TONES[status] || 'neutral'}`}>{children || status}</span>;
}

const ICONS = {
  calendar: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  place: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  note: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
};

export function Icon({ name }) {
  return (
    <svg className="cb-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DetailList({ items }) {
  return (
    <ul className="cb-details">
      {items.map(item => (
        <li key={item.icon}>
          <Icon name={item.icon} />
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="cb-empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}
