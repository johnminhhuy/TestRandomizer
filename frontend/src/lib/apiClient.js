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

export const startRun = async (payload) => {
  const { data } = await api.post("/run/start", payload);
  return data;
};

export const getRunStatus = async (jobId) => {
  const { data } = await api.get(`/run/status/${jobId}`);
  return data;
};

export const cancelRun = async (jobId) => {
  const { data } = await api.post(`/run/cancel/${jobId}`);
  return data;
};

export const aiStatus = async () => {
  const { data } = await api.get("/ai/status");
  return data;
};

export const aiSetConfig = async (payload) => {
  const { data } = await api.post("/ai/config", payload);
  return data;
};

export const aiGenerateSolution = async (problem, language) => {
  const { data } = await api.post("/ai/generate-solution", { problem, language });
  return data;
};

export const aiGenerateGenerator = async (problem) => {
  const { data } = await api.post("/ai/generate-generator", { problem });
  return data;
};

export const aiExplain = async (payload) => {
  const { data } = await api.post("/ai/explain", payload);
  return data;
};
