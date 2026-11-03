import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const ADMIN = { email: 'admin@brightpath.edu', password: 'Admin@123' };
export const RAJESH = { email: 'rajesh.sharma@example.com', password: 'Parent@123' }; // Aarav + Ananya
export const SUNITA = { email: 'sunita.verma@example.com', password: 'Parent@123' }; // Rohan

export async function login(page: Page, who: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password', { exact: true }).fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function apiToken(request: APIRequestContext, who: { email: string; password: string }) {
  const res = await request.post('/api/auth/login', { data: who });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data.token as string;
}

export async function findStudentId(request: APIRequestContext, name: string) {
  const token = await apiToken(request, ADMIN);
  const res = await request.get(`/api/students?search=${encodeURIComponent(name)}`, { headers: { Authorization: `Bearer ${token}` } });
  return (await res.json()).data[0]._id as string;
}
