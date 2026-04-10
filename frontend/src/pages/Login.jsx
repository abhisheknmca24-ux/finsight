import { useState, useEffect } from "react";
import API from "../services/api";
import { useNavigate, Link } from "react-router-dom";
import { auth, signInWithGoogle, isNativePlatform } from "../firebase";
import { getRedirectResult } from "firebase/auth";

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="google-icon" xmlns="http://www.w3.org/2000/svg">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Handle redirect result when returning from Google Sign-In (Android/Capacitor)
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          setLoading(true);
          const user = result.user;
          const res = await API.post("/auth/firebase-login", {
            email: user.email,
            name: user.displayName,
            firebaseUid: user.uid,
          });
          localStorage.setItem("token", res.data.token);
          localStorage.setItem("user", JSON.stringify(res.data.user));
          navigate("/dashboard");
        }
      } catch (err) {
        setError(err?.response?.data?.message || err.message || "Google Login failed.");
      } finally {
        setLoading(false);
      }
    };

    if (isNativePlatform()) {
      handleRedirectResult();
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError("");
    if (!form.email || !form.password) {
      setError("Please enter email and password.");
      return;
    }
    try {
      setLoading(true);
      const res = await API.post("/auth/login", form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError("");
      setLoading(true);
      const result = await signInWithGoogle();

      // On native platforms, signInWithGoogle triggers redirect — result is null
      // The redirect result is handled in the useEffect above
      if (!result) return;

      // On web, we get the result directly from popup
      const user = result.user;
      const res = await API.post("/auth/firebase-login", {
        email: user.email,
        name: user.displayName,
        firebaseUid: user.uid,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Google Login failed.");
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

        <h1 className="auth-title" style={{ textAlign: "center" }}>Welcome back</h1>
        <p className="auth-sub" style={{ textAlign: "center" }}>
          Sign in to continue managing your finances.
        </p>

        {/* Social Auth */}
        <div className="social-auth">
          <button
            onClick={handleGoogleLogin}
            className="btn btn-google"
            disabled={loading}
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <div className="divider">Or continue with</div>

        <form onSubmit={handleLogin}>
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
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
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
                Working…
              </>
            ) : (
              "Sign in →"
            )}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: "13px", color: "var(--text-muted)", marginTop: "24px" }}>
          Don&apos;t have an account?{" "}
          <Link to="/register" style={{ color: "var(--text-link)", fontWeight: 600 }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;