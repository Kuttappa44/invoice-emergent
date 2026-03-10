import { useState, useCallback } from "react";
import axios from "axios";

const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (method, endpoint, data = null, config = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api({
        method,
        url: endpoint,
        data,
        ...config,
      });
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || "An error occurred";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback((endpoint, config) => request("GET", endpoint, null, config), [request]);
  const post = useCallback((endpoint, data, config) => request("POST", endpoint, data, config), [request]);
  const put = useCallback((endpoint, data, config) => request("PUT", endpoint, data, config), [request]);
  const del = useCallback((endpoint, config) => request("DELETE", endpoint, null, config), [request]);

  return { get, post, put, del, loading, error, setError };
}

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get("/dashboard/stats"),
  getRecentRuns: (limit = 10) => api.get(`/dashboard/recent-runs?limit=${limit}`),
};

// Configurations API
export const configurationsApi = {
  list: () => api.get("/configurations"),
  get: (id) => api.get(`/configurations/${id}`),
  create: (data) => api.post("/configurations", data),
  update: (id, data) => api.put(`/configurations/${id}`, data),
  delete: (id) => api.delete(`/configurations/${id}`),
  testEmail: (id) => api.post(`/configurations/${id}/test-email`),
  fetchEmails: (id, params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.post(`/configurations/${id}/fetch-emails${queryParams ? `?${queryParams}` : ""}`);
  },
  getMatchingSource: (id) => api.get(`/configurations/${id}/matching-source`),
  uploadMatchingSource: (id, data) => api.post(`/configurations/${id}/matching-source`, { data }),
};

// Templates API
export const templatesApi = {
  list: () => api.get("/templates"),
  get: (id) => api.get(`/templates/${id}`),
  create: (data) => api.post("/templates", data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
  analyze: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/templates/analyze", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// Workflows API
export const workflowsApi = {
  list: (limit = 50) => api.get(`/workflows?limit=${limit}`),
  get: (id) => api.get(`/workflows/${id}`),
  create: (data) => api.post("/workflows", data),
  start: (id) => api.post(`/workflows/${id}/start`),
};

// Documents API
export const documentsApi = {
  list: (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/documents${queryParams ? `?${queryParams}` : ""}`);
  },
  get: (id) => api.get(`/documents/${id}`),
  upload: (file, templateId, workflowRunId) => {
    const formData = new FormData();
    formData.append("file", file);
    if (templateId) formData.append("template_id", templateId);
    if (workflowRunId) formData.append("workflow_run_id", workflowRunId);
    return api.post("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  reextract: (id, templateId = null) => {
    const params = templateId ? `?template_id=${templateId}` : "";
    return api.post(`/documents/${id}/reextract${params}`);
  },
  match: (id, configId) => api.post(`/documents/${id}/match?config_id=${configId}`),
  review: (id, action, updatedFields = null) => {
    const params = new URLSearchParams({ action });
    return api.put(`/documents/${id}/review?${params}`, updatedFields);
  },
  download: (id) => api.get(`/documents/${id}/download`, { responseType: "blob" }),
  export: (workflowRunId, format = "csv") => {
    const params = new URLSearchParams({ format });
    if (workflowRunId) params.append("workflow_run_id", workflowRunId);
    return api.get(`/export/documents?${params}`, { responseType: "blob" });
  },
};
