import { NavLink, useNavigate } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  if (!token) return null;

  const navStyle = {
    display: "flex",
    gap: "5px",
    padding: "12px 30px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
    alignItems: "center",
    position: "sticky",
    top: 0,
    zIndex: 1000,
    flexWrap: "wrap"
  };

  const linkStyle = {
    color: "white",
    textDecoration: "none",
    padding: "10px 16px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.3s ease",
    whiteSpace: "nowrap"
  };

  const activeLinkStyle = {
    ...linkStyle,
    background: "rgba(255, 255, 255, 0.2)"
  };

  const getNavStyle = ({ isActive }) => (isActive ? activeLinkStyle : linkStyle);
  const handleMouseEnter = (e) => {
    e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
  };
  const handleMouseLeave = (e) => {
    const isActive = e.currentTarget.getAttribute("aria-current") === "page";
    e.currentTarget.style.background = isActive ? "rgba(255, 255, 255, 0.2)" : "transparent";
  };

  return (
    <div style={navStyle}>
      <NavLink to="/dashboard" style={getNavStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>📊 Dashboard</NavLink>
      <NavLink to="/add" style={getNavStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>➕ Add Txn</NavLink>
      <NavLink to="/budget" style={getNavStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>💰 Budget</NavLink>
      <NavLink to="/monthly-budget" style={getNavStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>📋 Budget Rule</NavLink>
      <NavLink to="/prediction" style={getNavStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>⭐ Score</NavLink>
      <NavLink to="/recommendations" style={getNavStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>💡 Tips</NavLink>
      <NavLink to="/upload" style={getNavStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>📁 Upload</NavLink>
      <button 
        onClick={handleLogout} 
        style={{
          marginLeft: "auto",
          color: "white",
          background: "rgba(255, 255, 255, 0.2)",
          border: "none",
          cursor: "pointer",
          padding: "10px 16px",
          borderRadius: "8px",
          fontWeight: "500",
          fontSize: "14px",
          transition: "all 0.3s ease",
          whiteSpace: "nowrap"
        }}
        onMouseEnter={(e) => e.target.style.background = "rgba(255, 76, 76, 0.8)"}
        onMouseLeave={(e) => e.target.style.background = "rgba(255, 255, 255, 0.2)"}
      >
        🚪 Logout
      </button>
    </div>
  );
}

export default Navbar;
