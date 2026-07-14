import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import Footer from "../components/Footer";

export default function RegisterPage() {
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({ name: "", email: "", password: "" });
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
    setServerError("");
  }

  function validate() {
    const next = { name: "", email: "", password: "" };
    if (!formData.name.trim()) next.name = "Name is required.";
    if (!formData.email.trim()) {
      next.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      next.email = "Email address is invalid.";
    }
    if (!formData.password) {
      next.password = "Password is required.";
    } else if (formData.password.length < 6) {
      next.password = "Password must be at least 6 characters.";
    }
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");

    const next = validate();
    setErrors(next);
    if (next.name || next.email || next.password) return;

    setIsLoading(true);
    try {
      const response = await registerUser(formData);
      if (response.token) {
        login(response.token);
        navigate("/dashboard");
      }
    } catch (err) {
      setServerError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="auth-wrap">
        <div className="auth-card register" data-od-id="register-form">
          <p className="eyebrow">// create_account</p>
          <h1>Create Your Account</h1>
          <p className="sub">Join Us</p>

          <form className="stack-tight" id="register-form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="name">name</label>
              <input
                id="name"
                name="name"
                type="text"
                className={`input ${errors.name ? "invalid" : ""}`}
                placeholder="your name"
                autoComplete="name"
                value={formData.name}
                onChange={handleChange}
              />
              <div className="field-error" id="name-error">{errors.name}</div>
            </div>

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
                placeholder="choose a strong password"
                autoComplete="new-password"
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
                  <span className="spinner-sm" /> creating account…
                </>
              ) : (
                "register →"
              )}
            </button>
          </form>

          <p className="auth-foot">
            Already have an account? <Link to="/login">login</Link>
          </p>
        </div>
      </div>
      <Footer meta="free url shortener with analytics" />
    </>
  );
}
