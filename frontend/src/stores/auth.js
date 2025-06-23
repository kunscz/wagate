// /home/kunscz/devs/wagateway/frontend/src/stores/auth.js
import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../utils/api'; // Use axios instance with interceptor
import router from '@/router';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || null);
  const user = ref(JSON.parse(localStorage.getItem('user')) || null);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      token.value = response.data.token;
      user.value = { email }; // Adjust if backend returns more user data
      localStorage.setItem('token', token.value);
      localStorage.setItem('user', JSON.stringify(user.value));
      router.push('/');
      return true;
    } catch (err) {
      console.error('Login error:', err);
      throw err.response?.data?.error || 'Login failed';
    }
  };

  const refreshToken = async () => {
    try {
      const response = await api.post('/auth/refresh');
      token.value = response.data.token;
      user.value = user.value || { email: JSON.parse(atob(response.data.token.split('.')[1])).email };
      localStorage.setItem('token', token.value);
      localStorage.setItem('user', JSON.stringify(user.value));
      return true;
    } catch (err) {
      console.error('Refresh token error:', err);
      logout();
      return false;
    }
  };

  const logout = () => {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return { token, user, login, refreshToken, logout };
});