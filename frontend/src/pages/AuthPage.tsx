import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useAuth } from "../auth/useAuth";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isRegister) await register(email.trim(), displayName.trim(), password);
      else await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p className="muted">
          {isRegister ? "Start organising work in minutes." : "Sign in to your boards."}
        </p>

        {isRegister && (
          <label className="field">
            <span>Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={100}
              autoComplete="name"
            />
          </label>
        )}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isRegister ? 8 : undefined}
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
        </label>

        {error && <div className="error" role="alert">{error}</div>}

        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
        </button>

        <p className="muted switch">
          {isRegister ? (
            <>Already have an account? <Link to="/login">Sign in</Link></>
          ) : (
            <>New here? <Link to="/register">Create an account</Link></>
          )}
        </p>
      </form>
    </div>
  );
}
