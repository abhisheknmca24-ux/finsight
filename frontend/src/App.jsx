import "./index.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import Sidebar from "./components/Sidebar";
import React, { useContext } from "react";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AddTransaction from "./pages/AddTransaction";
import Transactions from "./pages/Transactions";
import Budget from "./pages/Budget";
import MonthlyBudget from "./pages/MonthlyBudget";
import Prediction from "./pages/Prediction";
import CategoryPrediction from "./pages/CategoryPrediction";
import Recommendations from "./pages/Recommendations";
import Upload from "./pages/Upload";
import Profile from "./pages/Profile";

function ProtectedRoute({ children }) {
  const { token } = useContext(AuthContext);
  return token ? children : <Navigate to="/" replace />;
}

function AuthRoute({ children }) {
  const { token } = useContext(AuthContext);
  return token ? <Navigate to="/dashboard" replace /> : children;
}

/* Floating Action Button — visible on every authenticated page except /add */
function FAB() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useContext(AuthContext);

  if (!token || location.pathname === "/add") return null;

  return (
    <button
      className="fab"
      onClick={() => navigate("/add")}
      aria-label="Add expense"
      title="Quick add expense"
    >
      ＋
    </button>
  );
}

function CatchAll() {
  const { token } = useContext(AuthContext);
  return <Navigate to={token ? "/dashboard" : "/"} replace />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <div className="app-layout">
              {/* Fixed Sidebar — hidden on auth pages automatically (no token) */}
              <Sidebar />

              {/* Main content area */}
              <main className="app-content">
                <Routes>
                  {/* Auth routes — full page, no sidebar */}
                  <Route path="/" element={<AuthRoute><Login /></AuthRoute>} />
                  <Route path="/register" element={<AuthRoute><Register /></AuthRoute>} />

                  {/* Protected routes — inside sidebar layout */}
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
                  <Route path="/add" element={<ProtectedRoute><AddTransaction /></ProtectedRoute>} />
                  <Route path="/budget" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
                  <Route path="/monthly-budget" element={<ProtectedRoute><MonthlyBudget /></ProtectedRoute>} />
                  <Route path="/prediction" element={<ProtectedRoute><Prediction /></ProtectedRoute>} />
                  <Route path="/prediction/categories" element={<ProtectedRoute><CategoryPrediction /></ProtectedRoute>} />
                  <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
                  <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="*" element={<CatchAll />} />
                </Routes>
              </main>

              {/* FAB */}
              <FAB />
            </div>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;