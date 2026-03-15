import axios from 'axios';
import { toast } from 'sonner';
import { useUserStore } from '../store/user.store';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const state = useUserStore.getState();
    const apiKey = state.user?.api_key;
    
    if (apiKey) {
      config.headers['x-api-key'] = apiKey;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        // Clear user store and redirect on critical unauthorization 
        // (Handled partially by next/router usually, but we clear state locally as standard)
        useUserStore.getState().clearUser();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      } else if (error.response.status === 402) {
        toast.error('Insufficient credits. Please upgrade your plan or top-up.');
      } else if (error.response.data?.error) {
        // Let the calling function handle specific API errors (400, 403, 404, etc.)
        // We do not auto-toast everything here to avoid spamming the user
      }
    }
    return Promise.reject(error);
  }
);

export default api;
