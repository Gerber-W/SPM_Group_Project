import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import BookSlot from "./pages/BookSlot";
import MyBookings from "./pages/MyBookings";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import { Page } from "./components/ui";

// Temporary pages until MyBookings and LecturerSlots are built
//   /my-bookings       -> MyBookings
//   /lecturer/slots    -> LecturerSlots
function Placeholder({ title }) {
  return <Page title={title} subtitle="This page is coming soon." />;
}

// Shows the header on every page after login
function Layout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  function logout() {
    localStorage.clear();
    navigate("/login", { replace: true });
  }

  if (!localStorage.getItem("token") || !user) return <Navigate to="/login" replace />;
  return <AppLayout user={user} onLogout={logout} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<Layout />}>
        {/* Student pages */}
        <Route
          path="/book"
          element={
            <ProtectedRoute role="student">
              <BookSlot />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-bookings"
          element={
            <ProtectedRoute role="student">
              <MyBookings />
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
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}