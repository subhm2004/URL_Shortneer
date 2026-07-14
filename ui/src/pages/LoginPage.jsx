import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import Footer from "../components/Footer";

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
    setServerError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");

    const nextErrors = { email: "", password: "" };
    if (!formData.email.trim()) nextErrors.email = "Email is required.";
    if (!formData.password) nextErrors.password = "Password is required.";
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setIsLoading(true);
    try {
      const response = await loginUser(formData);
      if (response.token) {
        login(response.token);
        navigate("/dashboard");
      } else {
        setServerError("Login successful, but no token provided.");
      }
    } catch (err) {
      setServerError(err.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="auth-wrap">
        <div className="auth-card" data-od-id="login-form">
          <p className="eyebrow">// sign_in</p>
          <h1>Welcome back!</h1>
          <p className="sub">Log in to access your dashboard</p>

          <form className="stack-tight" id="login-form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">email</label>
              <input
                id="email"
                name="email"
                type="email"
                className={`input ${errors.email ? "invalid" : ""}`}
                placeholder="you@example.com"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
              />
              <div className="field-error" id="email-error">{errors.email}</div>
            </div>

            <div className="field">
              <label htmlFor="password">password</label>
              <input
                id="password"
                name="password"
                type="password"
                className={`input ${errors.password ? "invalid" : ""}`}
                placeholder="••••••••"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
              />
              <div className="field-error" id="password-error">{errors.password}</div>
            </div>

            {serverError && (
              <div className="server-error" role="alert">{serverError}</div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              id="submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-sm" /> logging in…
                </>
              ) : (
                "login →"
              )}
            </button>
          </form>

          <p className="auth-foot">
            Don't have an account? <Link to="/register">register</Link>
          </p>
        </div>
      </div>
      <Footer meta="mono design system" />
    </>
  );
}
