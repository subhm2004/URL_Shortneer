/** Mirrors the backend's response envelope: { success, message?, data?, ...meta } */
export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  count?: number;
  token?: string;
}

export interface ShortUrl {
  id: string;
  urlCode: string;
  longUrl: string;
  shortUrl: string;
  clickCount: number;
  userId: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  /** Google's profile picture, when they signed in that way. */
  avatarUrl: string | null;
  hasGoogle: boolean;
  createdAt: string;
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface DayCount {
  date: string;
  count: number;
}

export interface Overview {
  totalLinks: number;
  totalClicks: number;
  topLinks: ShortUrl[];
}
