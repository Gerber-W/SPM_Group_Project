import { Navigate } from "react-router-dom";

// Only lets a logged-in user with the right role see the page.
export default function ProtectedRoute({ role, children }) {
  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("role");

  if (!token) return <Navigate to="/login" replace />;
  if (role && role !== userRole) return <Navigate to="/login" replace />;
  return children;
}