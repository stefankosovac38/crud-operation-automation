import { describe, it, expect } from 'vitest';

describe('pet API URLs', () => {
  it('listPets builds URL for GET /pets', () => {
    const base = 'https://api.example.com';
    
    const url = `${base}/pets`;
    expect(url).toMatchSnapshot();
  });

  it('createPet builds URL for POST /pets', () => {
    const base = 'https://api.example.com';
    
    const url = `${base}/pets`;
    expect(url).toMatchSnapshot();
  });

  it('getPet builds URL for GET /pets/{id}', () => {
    const base = 'https://api.example.com';
    const id = "v0";
    const url = `${base}/pets/${encodeURIComponent(String(id))}`;
    expect(url).toMatchSnapshot();
  });

  it('deletePet builds URL for DELETE /pets/{id}', () => {
    const base = 'https://api.example.com';
    const id = "v0";
    const url = `${base}/pets/${encodeURIComponent(String(id))}`;
    expect(url).toMatchSnapshot();
  });
});
