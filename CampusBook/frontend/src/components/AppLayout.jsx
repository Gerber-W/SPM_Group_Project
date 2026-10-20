import { Outlet } from 'react-router-dom';
import AppHeader from './AppHeader.jsx';
import '../styles/theme.css';

export default function AppLayout({ user, onLogout }) {
  return (
    <>
      <AppHeader user={user} onLogout={onLogout} />
      <main>
        <Outlet />
      </main>
    </>
  );
}
