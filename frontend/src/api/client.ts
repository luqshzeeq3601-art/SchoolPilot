const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const API_PREFIX = BASE_URL ? `${BASE_URL}/api/v1` : '/api/v1';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'hod' | 'teacher';
  department: string;
  is_active: boolean;
}

export interface UserItem extends UserProfile {
  created_at: string;
}

export interface CreateUserPayload {
  email: string;
  full_name: string;
  password: string;
  role: 'admin' | 'hod' | 'teacher';
  department: string;
  is_active?: boolean;
}

export interface UpdateUserPayload {
  full_name?: string;
  role?: 'admin' | 'hod' | 'teacher';
  department?: string;
}

export interface Citation {
  source_id: number;
  document_name: string;
  page_number: number;
  section_title?: string;
  exact_quote: string;
}

export interface LeaveFields {
  leave_type?: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
  covering_teacher?: string;
}

export interface ExtractionValidationError {
  field: string;
  code: string;
  message: string;
}

export interface ExtractionValidationResult {
  status: 'valid' | 'needs_clarification' | 'invalid';
  missing_fields: string[];
  errors: ExtractionValidationError[];
}

export interface ChatResponse {
  query: string;
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  citations: Citation[];
  relevant_policies: string[];
  intent: 'info_query' | 'leave_request';
  detected_leave_fields?: LeaveFields;
  extraction_validation?: ExtractionValidationResult;
  orchestration_mode: 'n8n_primary' | 'direct_api_fallback' | 'direct_api' | 'direct_api_with_attachment';
}

export interface LeaveRecord {
  id: string;
  teacher_id: string;
  teacher_name?: string;
  teacher_email?: string;
  teacher_department?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  covering_teacher?: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_by?: string;
  reviewer_name?: string;
  reviewed_at?: string;
  review_notes?: string;
}

export interface LeaveSummary {
  annual_used: number;
  annual_total: number;
  medical_used: number;
  medical_total: number;
  emergency_used: number;
  emergency_total: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
}

export interface DocumentItem {
  id: string;
  filename: string;
  file_hash: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
  chunk_count: number;
}

export interface AuditLogItem {
  id: string;
  user_email?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details: Record<string, any>;
  ip_address?: string;
  timestamp: string;
}

export interface SystemStatus {
  overall: 'operational' | 'degraded';
  backend: { status: string; version: string };
  database: { status: 'up' | 'down'; latency_ms: number | null; detail: string; error?: string };
  ollama: {
    status: 'up' | 'down';
    base_url: string;
    latency_ms: number | null;
    llm_model?: string;
    embedding_model?: string;
    models?: string[];
    error?: string;
  };
  n8n: {
    status: 'up' | 'down';
    webhook_base: string;
    latency_ms: number | null;
    workflows: { name: string; url: string }[];
    error?: string;
  };
  stats: {
    documents: number | null;
    vector_chunks: number;
    leaves_total: number;
    leaves_pending: number;
  };
}

export function getAuthToken(): string | null {
  return localStorage.getItem('schoolpilot_token') || localStorage.getItem('schoolops_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('schoolpilot_token', token);
  localStorage.setItem('schoolops_token', token);
}

export function clearAuthToken(): void {
  localStorage.removeItem('schoolpilot_token');
  localStorage.removeItem('schoolops_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(`${API_PREFIX}${endpoint}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });

    if (response.status === 401) {
      if (endpoint !== '/auth/login') {
        clearAuthToken();
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
      }
    }

    if (!response.ok) {
      let errMessage = 'An unexpected error occurred';
      try {
        const errorData = await response.json();
        errMessage = errorData.detail || errMessage;
      } catch {
        errMessage = `Server error (${response.status})`;
      }
      throw new Error(errMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out while waiting for assistant response. Please check local AI service.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    request<{ access_token: string; user_id: string; email: string; full_name: string; role: string; department: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(credentials) }
    ),
  getMe: () => request<UserProfile>('/auth/me'),

  // Staff lookup
  getStaff: () => request<UserProfile[]>('/users/staff'),

  // Chat / RAG
  sendQuery: (query: string, useN8n: boolean = true) =>
    request<ChatResponse>('/chat/query', {
      method: 'POST',
      body: JSON.stringify({ query, use_n8n: useN8n }),
    }),
  sendQueryWithFile: async (query: string, file: File): Promise<ChatResponse> => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('query', query);
    formData.append('use_n8n', 'false');
    formData.append('file', file);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    try {
      const res = await fetch(`${API_PREFIX}/chat/query-with-file`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
        signal: controller.signal,
      });
      if (res.status === 401) {
        clearAuthToken();
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
      }
      if (!res.ok) {
        let msg = 'Failed to process file question';
        try {
          const err = await res.json();
          msg = (err as any).detail || msg;
        } catch {
          msg = `Server error (${res.status})`;
        }
        throw new Error(msg);
      }
      return (await res.json()) as ChatResponse;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out while reading attachment. Try a smaller file.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  // Leave
  submitLeave: (data: {
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string;
    covering_teacher?: string;
  }) =>
    request<LeaveRecord>('/leave/request', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getLeaves: (status?: string) =>
    request<LeaveRecord[]>(`/leave/${status ? `?status_filter=${status}` : ''}`),
  getLeaveSummary: () => request<LeaveSummary>('/leave/summary'),
  getLeave: (id: string) => request<LeaveRecord>(`/leave/${id}`),
  updateLeave: (
    id: string,
    data: {
      leave_type?: string;
      start_date?: string;
      end_date?: string;
      reason?: string;
      covering_teacher?: string;
    }
  ) =>
    request<LeaveRecord>(`/leave/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteLeave: (id: string) =>
    request<{ status: string; message: string }>(`/leave/${id}`, {
      method: 'DELETE',
    }),
  approveLeave: (id: string, notes?: string) =>
    request<LeaveRecord>(`/leave/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    }),
  rejectLeave: (id: string, notes: string) =>
    request<LeaveRecord>(`/leave/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    }),

  // Documents
  getDocuments: () => request<DocumentItem[]>('/documents/'),
  deleteDocument: (id: string) =>
    request<void>(`/documents/${id}`, { method: 'DELETE' }),
  uploadDocument: async (file: File) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_PREFIX}/documents/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  // Audit Logs
  getAuditLogs: (limit: number = 50) =>
    request<AuditLogItem[]>(`/audit/logs?limit=${limit}`),

  // System status (admin)
  getSystemStatus: () => request<SystemStatus>('/system/status'),

  // User Management (Admin)
  getUsers: (params?: { search?: string; role?: string; department?: string; is_active?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.role) query.append('role', params.role);
    if (params?.department) query.append('department', params.department);
    if (params?.is_active !== undefined) query.append('is_active', String(params.is_active));
    const qs = query.toString();
    return request<UserItem[]>(`/users${qs ? `?${qs}` : ''}`);
  },
  getUser: (id: string) => request<UserItem>(`/users/${id}`),
  createUser: (data: CreateUserPayload) =>
    request<UserItem>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUser: (id: string, data: UpdateUserPayload) =>
    request<UserItem>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  toggleUserStatus: (id: string, is_active: boolean) =>
    request<UserItem>(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    }),
  resetUserPassword: (id: string, new_password: string) =>
    request<{ message: string }>(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password }),
    }),
};
