import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './api-base-url.token';

@Injectable({ providedIn: 'root' })
export class PetApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * List pets
   * GET /pets
   */
  listPets(options?: { headers?: Record<string, string> }) {
    const url = `${this.baseUrl}/pets`;
    return this.http.get<unknown>(url, { headers: options?.headers });
  }

  /**
   * Create pet
   * POST /pets
   */
  createPet(body: unknown, options?: { headers?: Record<string, string> }) {
    const url = `${this.baseUrl}/pets`;
    return this.http.post<unknown>(url, body, { headers: options?.headers });
  }

  /**
   * Get pet
   * GET /pets/{id}
   */
  getPet(id: string | number, options?: { headers?: Record<string, string> }) {
    const url = `${this.baseUrl}/pets/${encodeURIComponent(String(id))}`;
    return this.http.get<unknown>(url, { headers: options?.headers });
  }

  /**
   * Delete pet
   * DELETE /pets/{id}
   */
  deletePet(id: string | number, options?: { headers?: Record<string, string> }) {
    const url = `${this.baseUrl}/pets/${encodeURIComponent(String(id))}`;
    return this.http.delete<unknown>(url, { headers: options?.headers });
  }
}
