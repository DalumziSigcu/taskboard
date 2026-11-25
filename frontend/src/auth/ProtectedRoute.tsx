import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Loading...</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
