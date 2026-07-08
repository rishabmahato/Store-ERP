import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BASE}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Attach bearer token as fallback (some browsers block third-party cookies).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("le_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
