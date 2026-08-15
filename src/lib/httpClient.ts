import type { User } from 'common/models/user';

export type PublicUser = Omit<User, 'passwordHash'>;

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: PublicUser;
  error?: string;
}

export class HttpClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else if (globalThis.window !== undefined) {
      // Use window location hostname with port 8210 or relative path
      const { protocol, hostname } = globalThis.window.location;
      this.baseUrl = `${protocol}//${hostname}:8210`;
    } else {
      this.baseUrl = 'http://localhost:8210';
    }
    this.token = this.loadToken();
  }

  public setToken(token: string | null): void {
    this.token = token;
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem('wordgrid_token', token);
      } else {
        localStorage.removeItem('wordgrid_token');
      }
    }
  }

  public getToken(): string | null {
    if (!this.token) {
      this.token = this.loadToken();
    }
    return this.token;
  }

  private loadToken(): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('wordgrid_token');
    }
    return null;
  }

  public saveStoredUser(user: PublicUser | null): void {
    if (typeof localStorage !== 'undefined') {
      if (user) {
        localStorage.setItem('wordgrid_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('wordgrid_user');
      }
    }
  }

  public getStoredUser(): PublicUser | null {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('wordgrid_user');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  public async fetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Attempt request to baseUrl, with fallback to relative path if cross-origin fails
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const primaryUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${cleanEndpoint}`;

    let response: Response;
    try {
      response = await fetch(primaryUrl, {
        ...options,
        headers,
      });
    } catch {
      // Fall back to relative URL (useful if Vite proxy is serving relative path)
      response = await fetch(cleanEndpoint, {
        ...options,
        headers,
      });
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok && data.error) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data as T;
  }

  public async login(username: string, password: string): Promise<AuthResponse> {
    const res = await this.fetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.token) {
      this.setToken(res.token);
    }
    if (res.user) {
      this.saveStoredUser(res.user);
    }
    return res;
  }

  public async register(username: string, password: string): Promise<AuthResponse> {
    const res = await this.fetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.token) {
      this.setToken(res.token);
    }
    if (res.user) {
      this.saveStoredUser(res.user);
    }
    return res;
  }

  public async getMe(): Promise<AuthResponse> {
    if (!this.getToken()) {
      return { success: false, error: 'No token' };
    }
    try {
      const res = await this.fetch<AuthResponse>('/auth/me', {
        method: 'GET',
      });
      if (res.user) {
        this.saveStoredUser(res.user);
      }
      return res;
    } catch (err: any) {
      this.logout();
      return { success: false, error: err.message };
    }
  }

  public logout(): void {
    this.setToken(null);
    this.saveStoredUser(null);
  }
}

export const httpClient = new HttpClient();
