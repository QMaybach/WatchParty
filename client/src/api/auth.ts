import axios from 'axios';

// ПРОВЕРЬ ТУТ: Должно быть 5000!
const API_URL = 'http://localhost:5000/api/auth'; 

export const loginUser = async (email: string, password: string) => {
  const response = await axios.post(`${API_URL}/login`, { email, password });
  return response.data;
};

export const registerUser = async (username: string, email: string, password: string) => {
  const response = await axios.post(`${API_URL}/register`, { username, email, password });
  return response.data;
};