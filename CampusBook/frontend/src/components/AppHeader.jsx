import { Link, NavLink } from 'react-router-dom';
import Logo from './Logo.jsx';
import { initials } from '../utils/text.js';
import './AppHeader.css';

const LINKS = {
  student: [{ to: '/book', label: 'Book a slot' }, { to: '/my-bookings', label: 'My bookings' }],
  lecturer: [{ to: '/lecturer/slots', label: 'My slots' }],
};

export default function AppHeader({ user, onLogout }) {
  const links = LINKS[user.role] || [];
  const home = links[0]?.to || '/login';

  return (
    <header className="ah">
      <div className="ah-inner">
        <Link to={home} className="ah-brand" aria-label="CampusBook home">
          <Logo light />
        </Link>

        <nav className="ah-nav" aria-label="Main">
          {links.map(link => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => `ah-link ${isActive ? 'is-active' : ''}`}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ah-user">
          <span className="ah-avatar" aria-hidden="true">{initials(user.name)}</span>
          <span className="ah-user-text">
            <strong>{user.name}</strong>
            <span>{user.role === 'lecturer' ? 'Lecturer' : 'Student'}</span>
          </span>
          <button type="button" className="ah-logout" onClick={onLogout}>Log out</button>
        </div>
      </div>
    </header>
  );
}
