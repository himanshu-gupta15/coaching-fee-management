import crypto from 'crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app';
import { connectDB } from '../config/db';
import { seedDatabase } from '../seed/seed';
import { Student } from '../models';

export const app = createApp();
export const api = () => request(app);

/** Each test file gets its own database on the shared replica set. */
export async function setupDb(name: string) {
  const base = process.env.TEST_MONGO_URI!;
  const uri = base.replace(/\/(\?|$)/, `/${name}-${process.pid}$1`);
  await connectDB(uri);
  await seedDatabase({ log: false, rounds: 4 });
}

export async function teardownDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

export async function login(email: string, password: string): Promise<string> {
  const res = await api().post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.token;
}

export const loginAdmin = () => login('admin@brightpath.edu', 'Admin@123');
export const loginRajesh = () => login('rajesh.sharma@example.com', 'Parent@123');
export const loginSunita = () => login('sunita.verma@example.com', 'Parent@123');
export const loginAarav = () => login('aarav.sharma@student.example.com', 'Student@123');

export const studentByName = (fullName: string) => Student.findOne({ fullName });
export const key = () => crypto.randomUUID();
export const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
