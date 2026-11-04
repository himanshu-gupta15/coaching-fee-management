import { expect, test } from '@playwright/test';
import { apiToken, findStudentId, login, RAJESH, SUNITA } from './helpers';

test.describe('Parent portal', () => {
  test("parent logs in and sees their child's fee status", async ({ page }) => {
    await login(page, SUNITA);
    await expect(page.getByRole('heading', { name: /Welcome back, Sunita/ })).toBeVisible();
    await expect(page.getByText('Total outstanding')).toBeVisible();
    await expect(page.getByText(/is overdue/).first()).toBeVisible();
    await page.getByRole('link', { name: /Rohan Verma/ }).click();
    await expect(page.getByRole('heading', { name: 'Rohan Verma' })).toBeVisible();
    await expect(page.getByText('Overdue').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Payment history' }).click();
    await expect(page.getByRole('button', { name: /receipt/i }).first()).toBeVisible();
  });

  test("parent cannot access another parent's student", async ({ page, request }) => {
    const rohanId = await findStudentId(request, 'Rohan Verma'); // Sunita's child
    await login(page, RAJESH);
    await expect(page.getByText('Rohan Verma')).toHaveCount(0);

    await page.goto(`/parent/children/${rohanId}`);
    await expect(page.getByText('Student not found')).toBeVisible();
    await expect(page.getByText('NEET UG (Monthly)')).toHaveCount(0);

    // Direct API calls are also refused by the backend
    const token = await apiToken(request, RAJESH);
    const headers = { Authorization: `Bearer ${token}` };
    expect((await request.get(`/api/students/${rohanId}`, { headers })).status()).toBe(404);
    expect((await request.get(`/api/fees/records?student=${rohanId}`, { headers })).status()).toBe(404);
    expect((await request.get(`/api/payments?student=${rohanId}`, { headers })).status()).toBe(404);
    expect((await request.get('/api/students', { headers })).status()).toBe(403);
  });
});
