import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

api.interceptors.response.use((response) => {
    return response;
}, (error) => {
    if (error.response?.status === 401) {
        console.warn('Unauthorized API call');
    }
    return Promise.reject(error);
});

export const bootstrapClient = async () => {
    try {
        const response = await api.get('/client/bootstrap');
        return response.data;
    } catch (error) {
        console.error('Failed to bootstrap client:', error);
        throw error;
    }
};

export const deleteInventory = async (id: string, reason: string) => {
    return api.delete(`/pharmacy/inventory/${id}`, { data: { reason } });
};

export const simulateSale = async (data: { items: any[], totalAmount: number, paymentMethod: string }) => {
    return api.post('/pharmacy/simulate/sale', data);
};

export const getNotifications = async () => {
    const response = await api.get('/notifications');
    return response.data;
};

export const markNotificationRead = async (id: string) => {
    return api.post(`/notifications/${id}/read`);
};

export default api;
