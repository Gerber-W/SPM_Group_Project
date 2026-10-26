import axios from "axios";

// Set VITE_API_URL in a .env file. Falls back to localhost:5000.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
});

// Send the saved login token with every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const loggedIn = Boolean(localStorage.getItem("token"));
    if (error.response?.status === 401 && loggedIn) {
      localStorage.clear();
      sessionStorage.setItem("notice", "Your session has ended. Please log in again.");
      window.location.replace("/login");
    }
    return Promise.reject(error);
  }
);

export default api;