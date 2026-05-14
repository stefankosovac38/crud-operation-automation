import { InjectionToken } from '@angular/core';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => {
    const w = typeof window !== 'undefined' ? (window as unknown as { __API_BASE_URL__?: string }) : undefined;
    return w?.__API_BASE_URL__ ?? '/api';
  },
});
