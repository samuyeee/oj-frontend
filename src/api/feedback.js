import axios from "axios";

const BASE_URL = "http://localhost:8121"; // 确认端口号是否正确

export const generateFeedback = (data) => {
  return axios.post(`${BASE_URL}/api/feedback/generate`, data);
};
