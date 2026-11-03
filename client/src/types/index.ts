export type Role = 'admin' | 'parent' | 'student';
export type FeeStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'online_manual';
export type Frequency = 'monthly' | 'quarterly' | 'one_time';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  studentProfile?: { _id: string; studentId: string; fullName: string } | null;
}

export interface FeeStructure {
  _id: string;
  name: string;
  course: string;
  frequency: Frequency;
  amount: number;
  dueDay: number;
  description?: string;
  isActive: boolean;
  studentCount?: number;
}

export interface StudentFees { totalFees: number; totalPaid: number; outstanding: number; overdue: number }

export interface Student {
  _id: string;
  studentId: string;
  fullName: string;
  email: string;
  phone?: string;
  course: string;
  batch: string;
  admissionDate: string;
  parent?: Pick<User, '_id' | 'name' | 'email' | 'phone'> | null;
  user?: { _id: string; email: string; isActive: boolean; lastLoginAt?: string } | null;
  feePlan?: Pick<FeeStructure, '_id' | 'name' | 'amount' | 'frequency' | 'dueDay'> | null;
  status: 'active' | 'inactive';
  fees?: StudentFees;
  feeStatus?: 'overdue' | 'outstanding' | 'clear';
  createdAt: string;
}

export interface FeeRecord {
  _id: string;
  student: string | Pick<Student, '_id' | 'fullName' | 'studentId' | 'course' | 'batch'>;
  feeStructure?: string | null;
  title: string;
  periodKey: string;
  amount: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
  status: Exclude<FeeStatus, 'overdue'>;
  effectiveStatus: FeeStatus;
  daysOverdue: number;
  paidAt?: string | null;
  notes?: string;
  cancelledReason?: string;
  createdAt: string;
}

export interface Payment {
  _id: string;
  transactionId: string;
  receiptNumber: string;
  feeRecord: string | { _id: string; title: string; amount?: number };
  student: string | Pick<Student, '_id' | 'fullName' | 'studentId' | 'course' | 'batch'>;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  paidAt: string;
  recordedBy?: string | { _id: string; name: string };
  notes?: string;
  manualEntry: boolean;
  balanceAfter: number;
  createdAt: string;
}

export interface FeeSummary {
  totalFees: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  overdueCount: number;
  pendingCount: number;
  nextDue: { _id: string; title: string; dueDate: string; balance: number } | null;
}

export interface Notification {
  _id: string;
  type: 'fee_due' | 'fee_overdue' | 'payment_success' | 'announcement' | 'system';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface Announcement {
  _id: string;
  title: string;
  body: string;
  audience: 'all' | 'parents' | 'students';
  pinned: boolean;
  createdBy?: { _id: string; name: string } | string;
  createdAt: string;
}

export interface PageMeta { page: number; limit: number; total: number; totalPages: number; [k: string]: unknown }
export interface ApiEnvelope<T> { success: true; data: T; meta?: PageMeta }

export interface MonthlyPoint { month: string; label: string; collected: number; billed: number; count: number; cash: number; bank: number; online: number }
