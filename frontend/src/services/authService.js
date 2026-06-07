import API from "./api";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

export const authService = {
  // Register new user
  async register(username, email, password) {
    try {
      const response = await API.post("/auth/register", {
        username,
        email,
        password,
      });
      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: "Registration failed" };
    }
  },

  // Login user
  async login(email, password) {
    try {
      const response = await API.post("/auth/login", { email, password });
      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: "Login failed" };
    }
  },

  // Firebase login
  async firebaseLogin(idToken, firebaseUid, email, name) {
    try {
      const response = await API.post("/auth/firebase-login", {
        idToken,
        firebaseUid,
        email,
        name
      });
      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: "Firebase Login failed" };
    }
  },

  // Logout user
  async logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    try {
      await signOut(auth);
    } catch (err) {
      // Ignore firebase signout error if they weren't signed in through firebase
    }
    window.location.href = "/";
  },

  // Get current user
  getCurrentUser() {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!localStorage.getItem("token");
  },

  // Get auth token
  getToken() {
    return localStorage.getItem("token");
  },
};

export default authService;
