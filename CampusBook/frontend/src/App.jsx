import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

// Temporary pages.
//   /book              -> BookSlot
//   /my-bookings       -> MyBookings
//   /lecturer/slots    -> LecturerSlots
function Placeholder({ title }) {
  const navigate = useNavigate();
  function logout() {
    localStorage.clear();
    navigate("/login");
  }
  return (
    <main className="cb-page">
      <h1>{title}</h1>
      <p className="cb-muted">This page is coming soon.</p>
      <button className="cb-btn cb-btn-outline" onClick={logout}>
        Log out
      </button>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Student pages */}
      <Route
        path="/book"
        element={
          <ProtectedRoute role="student">
            <Placeholder title="Book a consultation" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-bookings"
        element={
          <ProtectedRoute role="student">
            <Placeholder title="My bookings" />
          </ProtectedRoute>
        }
      />

      {/* Lecturer pages */}
      <Route
        path="/lecturer/slots"
        element={
          <ProtectedRoute role="lecturer">
            <Placeholder title="My consultation slots" />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}