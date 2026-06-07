import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useContext } from "react";
import { useTheme } from "../context/ThemeContext";
import { AuthContext } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", icon: "📊", label: "Dashboard" },
  { to: "/transactions", icon: "🧾", label: "Transactions" },
  { to: "/add", icon: "➕", label: "Add Transaction" },
  { to: "/upload", icon: "📤", label: "Upload Statement" },
];

const NAV_ITEMS_2 = [
  { to: "/budget", icon: "💰", label: "Budget" },
  { to: "/monthly-budget", icon: "📋", label: "Budget Rule" },
];

const NAV_ITEMS_3 = [
  { to: "/prediction", icon: "⭐", label: "Health Score" },
  { to: "/recommendations", icon: "💡", label: "AI Tips" },
];

const NAV_ITEMS_4 = [
  { to: "/profile", icon: "👤", label: "Profile" },
];

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, logout } = useContext(AuthContext);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (!token) return null;

  const closeMobile = () => setMobileOpen(false);

  const renderLinks = (items) =>
    items.map(({ to, icon, label }) => (
      <NavLink
        key={to}
        to={to}
        className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        onClick={closeMobile}
      >
        <span className="nav-link-icon">{icon}</span>
        {label}
      </NavLink>
    ));

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/logo.png"
            alt="FinSight Logo"
            style={{
              width: "34px",
              height: "34px",
              objectFit: "contain",
              borderRadius: "10px",
              boxShadow: "0 2px 10px rgba(127,90,240,0.2)",
            }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span className="sidebar-logo-title">FinSight</span>
        </div>
        <div className="sidebar-logo-sub" style={{ marginLeft: "46px" }}>
          Financial Intelligence
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Overview</div>
        {renderLinks(NAV_ITEMS)}

        <div className="sidebar-section-label">Planning</div>
        {renderLinks(NAV_ITEMS_2)}

        <div className="sidebar-section-label">Insights</div>
        {renderLinks(NAV_ITEMS_3)}

        <div className="sidebar-section-label">Account</div>
        {renderLinks(NAV_ITEMS_4)}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button
          onClick={toggleTheme}
          className="btn btn-secondary btn-full mb-8"
          style={{ justifyContent: "flex-start", gap: "10px" }}
        >
          <span>{theme === "dark" ? "☀️" : "🌙"}</span>
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <button
          onClick={handleLogout}
          className="btn btn-danger btn-full"
          style={{ justifyContent: "flex-start", gap: "10px" }}
        >
          <span>🚪</span> Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="mobile-nav-btn"
        onClick={() => setMobileOpen((o) => !o)}
        id="mobile-toggle"
        aria-label="Toggle navigation"
      >
        {mobileOpen ? "✕" : "☰"}
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          onClick={closeMobile}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 999,
            animation: "fadeIn 0.2s ease",
          }}
        />
      )}

      {/* Sidebar */}
      <div className={`sidebar${mobileOpen ? " open" : ""}`}>
        {sidebarContent}
      </div>
    </>
  );
}

export default Sidebar;
