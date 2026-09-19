export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  issues?: { path: string; message: string }[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class ApiClientError extends Error {
  status: number;
  issues?: { path: string; message: string }[];

  constructor(
    message: string,
    status: number,
    issues?: { path: string; message: string }[]
  ) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw new ApiClientError(
      body?.error ?? `Request failed (${response.status})`,
      response.status,
      body?.issues
    );
  }

  return body as ApiResponse<T>;
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, data: unknown) =>
    request<T>(url, { method: "POST", body: JSON.stringify(data) }),
  patch: <T>(url: string, data: unknown) =>
    request<T>(url, { method: "PATCH", body: JSON.stringify(data) }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};
