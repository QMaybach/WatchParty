import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') + '/rooms'; 

export const createRoom = async (title: string, token: string) => {
  const response = await axios.post(
    API_URL, 
    { title }, 
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};
export const getRoomById = async (id: string, token: string) => {
  if (!id || id === 'undefined' || id === '[id]') throw new Error('Invalid ID: ' + id);
  try {
    const response = await axios.get(`${API_URL}/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (err) {
    console.error("Ошибка в getRoomById:", err);
    throw err;
  }
};
export const updateRoomVideo = async (id: string, videoUrl: string, token: string) => {
  try {
    const response = await axios.patch(
      `${API_URL}/${id}/video`,
      { videoUrl }, // <-- КЛЮЧ ДОЛЖЕН БЫТЬ videoUrl
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (err) {
    console.error("Ошибка в updateRoomVideo:", err);
    throw err;
  }
};
export const getRooms = async () => {
  const response = await axios.get(API_URL);
  return response.data;
};