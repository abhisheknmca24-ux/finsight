import { useState } from "react";
import API from "../services/api";
import { useNavigate, Link } from "react-router-dom";

function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e?.preventDefault();
    setError("");
    if (!form.name || !form.email || !form.password) {
      setError("All fields are required.");
      return;
    }
    try {
      setLoading(true);
      const res = await API.post("/auth/register", form);
      localStorage.setItem("token", res.data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "14px", marginBottom: "24px" }}>
          <img
            src="/logo.png"
            alt="FinSight Logo"
            style={{
              width: "44px",
              height: "44px",
              objectFit: "contain",
              borderRadius: "12px",
              boxShadow: "0 4px 16px rgba(127,90,240,0.2)",
            }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div className="auth-logo">FinSight</div>
        </div>

        <h1 className="auth-title" style={{ textAlign: "center" }}>Create an account</h1>
        <p className="auth-sub" style={{ textAlign: "center" }}>
          Start tracking your finances intelligently — it&apos;s free.
        </p>

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input
              className="form-input"
              type="text"
              placeholder="your name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Min 6 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(244,63,94,0.1)",
              border: "1px solid rgba(244,63,94,0.3)",
              borderRadius: "var(--r-md)",
              padding: "12px 14px",
              color: "var(--expense)",
              fontSize: "13px",
              marginBottom: "16px",
              animation: "fadeInUp 0.2s ease",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Creating account…
              </>
            ) : (
              "Create account →"
            )}
          </button>
        </form>

        <div className="divider" />

        <p style={{ textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <Link to="/" style={{ color: "var(--text-link)", fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;