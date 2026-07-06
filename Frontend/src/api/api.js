import axios from 'axios';

// All requests go to /api which is proxied to http://localhost:5001 via vite.config.js
const api = axios.create({ baseURL: '/api' });

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- USER / AUTH ---
export const registerUser = (data) => api.post('/users/register', data);
export const loginUser = (data) => api.post('/users/login', data);
export const getProfile = () => api.get('/users/profile');
export const updateProfile = (data) => api.put('/users/profile', data);

// --- CO-PASSENGERS ---
export const getCoPassengers = () => api.get('/users/co-passengers');
export const addCoPassenger = (data) => api.post('/users/co-passengers', data);
export const updateCoPassenger = (id, data) => api.put(`/users/co-passengers/${id}`, data);
export const deleteCoPassenger = (id) => api.delete(`/users/co-passengers/${id}`);

// --- WALLET ---
export const getWallet = () => api.get('/users/wallet');
export const depositWallet = (amount) => api.post('/users/wallet/deposit', { amount });

// --- SEARCH ---
export const searchTrains = (params) => api.get('/search/trains', { params });
export const searchConnected = (params) => api.get('/search/connected-journeys', { params });
export const getSeatAvailability = (params) => api.get('/search/seat-availability', { params });

// --- PAYMENT / FARE ---
export const getFareEstimate = (params) => api.get('/payment/fare', { params });
export const createCheckoutSession = (data) => api.post('/payment/checkout-session', data);

// --- BOOKING ---
export const getMyBookings = () => api.get('/bookings');
export const createBooking = (data) => api.post('/bookings', data);
export const cancelBooking = (id) => api.post(`/bookings/${id}/cancel`);
export const getRefundPreview = (id) => api.get(`/bookings/${id}/refund-preview`);
export const downloadTicket = (id) => api.get(`/bookings/${id}/download`, { responseType: 'blob' });

// --- TRACKING ---
export const getTrainStatus = (runId) => api.get(`/tracking/${runId}`);
export const searchTrainStatus = (params) => api.get('/tracking/search', { params });

// --- NOTIFICATIONS ---
export const getNotifications = () => api.get('/notifications');
export const markNotificationRead = (id) => api.put(`/notifications/${id}/read`);

// --- ADMIN ---
export const getStations = () => api.get('/admin/stations');
export const createStation = (data) => api.post('/admin/stations', data);
export const updateStation = (id, data) => api.put(`/admin/stations/${id}`, data);
export const deleteStation = (id) => api.delete(`/admin/stations/${id}`);

export const getRoutes = () => api.get('/admin/routes');
export const createRoute = (data) => api.post('/admin/routes', data);
export const updateRoute = (id, data) => api.put(`/admin/routes/${id}`, data);
export const deleteRoute = (id) => api.delete(`/admin/routes/${id}`);

export const getTrains = () => api.get('/admin/trains');
export const createTrain = (data) => api.post('/admin/trains', data);
export const updateTrain = (id, data) => api.put(`/admin/trains/${id}`, data);
export const deleteTrain = (id) => api.delete(`/admin/trains/${id}`);

export const getSchedules = () => api.get('/admin/schedules');
export const createSchedule = (data) => api.post('/admin/schedules', data);
export const instantiateSchedule = (id) => api.post(`/admin/schedules/${id}/instantiate`);
export const deleteSchedule = (id) => api.delete(`/admin/schedules/${id}`);

export const getScheduledRuns = () => api.get('/admin/scheduled-runs');

// --- ANALYTICS ---
export const getSalesAnalytics = () => api.get('/admin/analytics/sales');
export const getOccupancyAnalytics = () => api.get('/admin/analytics/occupancy');
export const getDemographicsAnalytics = () => api.get('/admin/analytics/demographics');

export default api;
