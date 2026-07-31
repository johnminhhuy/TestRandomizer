import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const previewGenerator = async (generator, seed) => {
  const { data } = await api.post("/preview", { generator, seed });
  return data;
};

export const runStress = async (payload) => {
  const { data } = await api.post("/run", payload);
  return data;
};
