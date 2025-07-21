import axios from "axios";
import { auth } from "./firebase";

const axiosInstance = axios.create({
  baseURL: '/api', // Proxy will handle this during dev
});

axiosInstance.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken(true); // Force-refresh token
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Inject distributor_id from sessionStorage for super_admin
  const distributorId = sessionStorage.getItem('selectedDistributorId');
  if (distributorId) {
    if (!config.params) config.params = {};
    config.params.distributor_id = distributorId;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

axiosInstance.interceptors.request.use(req => {
  if (typeof window !== 'undefined' && (window as any).__debuglog) {
    (window as any).__debuglog(`➡️ ${req.method?.toUpperCase()} ${req.url}`);
    
    // Log request payload for POST/PUT requests
    if ((req.method === 'POST' || req.method === 'PUT') && req.data) {
      (window as any).__debuglog(`📤 Request Payload: ${JSON.stringify(req.data, null, 2)}`);
    }
  }
  return req;
});

axiosInstance.interceptors.response.use(
  res => {
    (window as any).__debuglog?.(`✅ ${res.status} ${res.config.url}`);
    return res;
  },
  err => {
    const status = err.response?.status || 'ERR';
    const url = err.config?.url;
    const message = err.message;
    const errorData = err.response?.data;
    
    (window as any).__debuglog?.(
      `❌ ${status} ${url} - ${message}`
    );
    
    // Log detailed error information
    if (errorData) {
      (window as any).__debuglog?.(`📋 Error Details: ${JSON.stringify(errorData, null, 2)}`);
    }
    
    return Promise.reject(err);
  }
);

// Add response interceptor to handle token expiry (401)
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const user = auth.currentUser;
        if (user) {
          const newToken = await user.getIdToken(true);
          sessionStorage.setItem('authToken', newToken);
          axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance; 