/**
 * Axios interceptor
 * axios instance with an interceptor to handle 401 errors and refresh tokens automatically
 */
// /home/kunscz/devs/wagateway/frontend/src/utils/api.js
import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use((config) => {
  const authStore = useAuthStore();
  if (authStore.token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${authStore.token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const authStore = useAuthStore();

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshed = await authStore.refreshToken();
        if (refreshed) {
          originalRequest.headers.Authorization = `Bearer ${authStore.token}`;
          processQueue(null, authStore.token);
          isRefreshing = false;
          return api(originalRequest);
        } else {
          throw new Error('Refresh failed');
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        authStore.logout();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;