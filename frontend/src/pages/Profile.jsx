import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import API from "../services/api";

const Profile = () => {
  const { user, token } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState("general"); // "general" or "security"
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    dob: "",
    gender: "",
    phone: "",
  });

  const [securityData, setSecurityData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await API.get("/auth/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.data;
        setFormData({
          name: data.name || "",
          email: data.email || "",
          dob: data.dob ? data.dob.split("T")[0] : "",
          gender: data.gender || "",
          phone: data.phone || "",
        });
      } catch (err) {
        setMessage({ type: "error", text: "Failed to load profile" });
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchProfile();
  }, [token]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSecurityChange = (e) => {
    setSecurityData({ ...securityData, [e.target.name]: e.target.value });
  };

  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      await API.put(
        "/auth/profile",
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitSecurity = async (e) => {
    e.preventDefault();

    if (securityData.newPassword !== securityData.confirmPassword) {
      return setMessage({ type: "error", text: "New passwords do not match" });
    }

    if (securityData.newPassword.length < 6) {
      return setMessage({ type: "error", text: "Password must be at least 6 characters" });
    }

    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      await API.put(
        "/auth/change-password",
        {
          currentPassword: securityData.currentPassword,
          newPassword: securityData.newPassword,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: "success", text: "Password updated successfully!" });
      setSecurityData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to update password" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          style={styles.spinner}
        />
        <p>Syncing your financial identity...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={styles.card}
      >
        <div style={styles.header}>
          <div style={styles.profileInfo}>
            <div style={styles.avatar}>
              {formData.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 style={styles.title}>{formData.name}</h1>
              <p style={styles.emailText}>{formData.email}</p>
            </div>
          </div>

          <div style={styles.tabs}>
            <button
              onClick={() => { setActiveTab("general"); setMessage({ type: "", text: "" }); }}
              style={{ ...styles.tabLink, ...(activeTab === "general" ? styles.activeTab : {}) }}
            >
              General
            </button>
            <button
              onClick={() => { setActiveTab("security"); setMessage({ type: "", text: "" }); }}
              style={{ ...styles.tabLink, ...(activeTab === "security" ? styles.activeTab : {}) }}
            >
              Security
            </button>
          </div>
        </div>

        {message.text && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              ...styles.alert,
              backgroundColor: message.type === "success" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: message.type === "success" ? "#4ade80" : "#f87171",
              border: message.type === "success" ? "1px solid rgba(34, 197, 94, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)"
            }}
          >
            {message.type === "success" ? "✓ " : "✕ "} {message.text}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === "general" ? (
            <motion.form
              key="general"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleSubmitProfile}
              style={styles.form}
            >
              <div style={styles.inputGroup}>
                <label style={styles.label}>Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.row}>
                <div style={{ ...styles.inputGroup, flex: 1 }}>
                  <label style={styles.label}>Date of Birth</label>
                  <input
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleChange}
                    style={styles.input}
                  />
                </div>
                <div style={{ ...styles.inputGroup, flex: 1 }}>
                  <label style={styles.label}>Gender</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    style={styles.input}
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 234 567 890"
                  style={styles.input}
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.01, backgroundColor: "#3b82f6" }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={saving}
                style={styles.button}
              >
                {saving ? "Saving Changes..." : "Update Details"}
              </motion.button>
            </motion.form>
          ) : (
            <motion.form
              key="security"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleSubmitSecurity}
              style={styles.form}
            >
              <div style={styles.inputGroup}>
                <label style={styles.label}>Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={securityData.currentPassword}
                  onChange={handleSecurityChange}
                  placeholder="••••••••"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.divider}></div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  value={securityData.newPassword}
                  onChange={handleSecurityChange}
                  placeholder="••••••••"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={securityData.confirmPassword}
                  onChange={handleSecurityChange}
                  placeholder="••••••••"
                  style={styles.input}
                  required
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.01, boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)" }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={saving}
                style={{ ...styles.button, background: "linear-gradient(135deg, #2563eb, #1d4ed8)" }}
              >
                {saving ? "Updating Password..." : "Change Password"}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#080c14",
    padding: "20px",
    fontFamily: "'Outfit', sans-serif",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    background: "#080c14",
    color: "#94a3b8",
    gap: "20px"
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid rgba(59, 130, 246, 0.1)",
    borderTop: "3px solid #3b82f6",
    borderRadius: "50%",
  },
  card: {
    background: "rgba(15, 23, 42, 0.6)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    borderRadius: "32px",
    padding: "48px",
    maxWidth: "600px",
    width: "100%",
    boxShadow: "0 40px 100px -20px rgba(0, 0, 0, 0.8)",
  },
  header: {
    marginBottom: "40px",
  },
  profileInfo: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    marginBottom: "32px",
  },
  avatar: {
    width: "72px",
    height: "72px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, #60a5fa, #a78bfa)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "2rem",
    fontWeight: "bold",
    color: "white",
    boxShadow: "0 10px 20px -5px rgba(59, 130, 246, 0.5)",
  },
  title: {
    fontSize: "1.8rem",
    fontWeight: "700",
    color: "#f8fafc",
    margin: "0 0 4px 0",
  },
  emailText: {
    color: "#64748b",
    margin: 0,
    fontSize: "0.95rem",
  },
  tabs: {
    display: "flex",
    gap: "10px",
    background: "rgba(2, 6, 23, 0.4)",
    padding: "6px",
    borderRadius: "14px",
    width: "fit-content",
  },
  tabLink: {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    padding: "8px 24px",
    borderRadius: "10px",
    fontSize: "0.9rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  activeTab: {
    background: "rgba(255, 255, 255, 0.05)",
    color: "#f8fafc",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  row: {
    display: "flex",
    gap: "24px",
  },
  label: {
    color: "#94a3b8",
    fontSize: "0.85rem",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginLeft: "4px",
  },
  input: {
    background: "rgba(2, 6, 23, 0.4)",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    borderRadius: "16px",
    padding: "14px 18px",
    color: "#f8fafc",
    fontSize: "1rem",
    outline: "none",
    transition: "all 0.3s ease",
  },
  button: {
    marginTop: "12px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "16px",
    padding: "16px",
    fontSize: "1rem",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 10px 15px -3px rgba(37, 99, 235, 0.3)",
  },
  alert: {
    padding: "16px 20px",
    borderRadius: "16px",
    marginBottom: "32px",
    fontSize: "0.95rem",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  divider: {
    height: "1px",
    background: "rgba(255, 255, 255, 0.05)",
    margin: "8px 0",
  }
};

export default Profile;
