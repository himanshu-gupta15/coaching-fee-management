import { expect, test } from '@playwright/test';
import { ADMIN, login } from './helpers';

test.describe('Admin flows', () => {
  test('admin logs in and creates a student', async ({ page }) => {
    await login(page, ADMIN);
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Priya/ })).toBeVisible();
    await page.getByRole('link', { name: 'Students' }).first().click();
    await page.getByRole('button', { name: 'Add student' }).first().click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill('Diya Kapoor');
    await dialog.getByLabel('Email').fill('diya.kapoor@student.example.com');
    await dialog.getByLabel('Phone').fill('+91 90000 30003');
    await dialog.getByLabel('Course / class').fill('NEET UG');
    await dialog.getByLabel('Batch').fill('NEET-2027 Weekend');
    await dialog.getByRole('combobox', { name: 'Parent account' }).click();
    await page.getByRole('option', { name: /Sunita Verma/ }).click();
    await dialog.getByRole('combobox', { name: 'Fee plan' }).click();
    await page.getByRole('option', { name: 'NEET UG (Monthly)' }).click();
    await dialog.getByRole('button', { name: 'Add student' }).click();

    await expect(page.getByText(/Student Diya Kapoor added/)).toBeVisible();
    await page.getByPlaceholder('Search name, ID, email, phone').fill('Diya');
    await expect(page.getByRole('link', { name: /Diya Kapoor/ }).first()).toBeVisible();
  });

  test('admin records a partial payment and the balance updates', async ({ page }) => {
    await login(page, ADMIN);
    await page.goto('/admin/students');
    await page.getByPlaceholder('Search name, ID, email, phone').fill('Rohan');
    await page.getByRole('link', { name: /Rohan Verma/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Rohan Verma' })).toBeVisible();

    const row = page.getByRole('row').filter({ hasText: /NEET UG \(Monthly\) — September/ });
    await expect(row.getByText('Overdue', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Record payment' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Amount (₹)').fill('2500');
    await expect(dialog.getByText('₹4,500 will remain')).toBeVisible();
    // Over-payment is blocked
    await dialog.getByLabel('Amount (₹)').fill('9000');
    await dialog.getByRole('button', { name: /^Record/ }).click();
    await expect(dialog.getByRole('alert')).toContainText('exceeds the outstanding balance');

    await dialog.getByLabel('Amount (₹)').fill('2500');
    await dialog.getByRole('button', { name: /^Record/ }).click();
    await expect(dialog.getByRole('heading', { name: 'Payment recorded' })).toBeVisible();
    await expect(dialog.getByText(/TXN-\d{8}-/)).toBeVisible();

    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download receipt' }).click();
    expect((await download).suggestedFilename()).toMatch(/^RCPT-.*\.pdf$/);
    await dialog.getByRole('button', { name: 'Close' }).first().click();

    await expect(row.getByRole('cell', { name: '₹2,500', exact: true })).toBeVisible();
    await expect(row.getByRole('cell', { name: '₹4,500', exact: true })).toBeVisible();
  });
});
