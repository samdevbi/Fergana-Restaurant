import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3003', // Make sure this matches your backend port
    withCredentials: true, // Critical: sends cookies with requests
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
