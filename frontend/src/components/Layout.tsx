import { Link, Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  function onLogout() {
    logout();
    queryClient.clear();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="brand-mark">T</span>
          TaskBoard
        </Link>
        <div className="header-right">
          <span className="avatar">{user?.displayName.charAt(0).toUpperCase()}</span>
          <span className="muted">{user?.displayName}</span>
          <button className="btn btn-ghost" onClick={onLogout}>Sign out</button>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
