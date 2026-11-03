import { Types } from 'mongoose';
import type { UserDoc } from '../models/User';
import { Student, type StudentDoc } from '../models/Student';
import { AppError } from '../utils/AppError';

/**
 * Returns the student ids the user may see, or null for "all" (admin).
 * Parents: only students linked to them. Students: only their own profile.
 */
export async function accessibleStudentIds(user: UserDoc): Promise<Types.ObjectId[] | null> {
  if (user.role === 'admin') return null;
  const filter = user.role === 'parent' ? { parent: user._id } : { user: user._id };
  const students = await Student.find({ ...filter, deletedAt: null }).select('_id').lean();
  return students.map((s) => s._id);
}

/**
 * Loads a student the user is allowed to access. Returns 404 (not 403) for
 * students the user cannot see so record existence is not leaked (IDOR safe).
 */
export async function getAccessibleStudent(user: UserDoc, studentId: string): Promise<StudentDoc> {
  if (!Types.ObjectId.isValid(studentId)) throw AppError.notFound('Student not found');
  const student = await Student.findOne({ _id: studentId, deletedAt: null });
  if (!student) throw AppError.notFound('Student not found');
  if (user.role === 'admin') return student;
  if (user.role === 'parent' && student.parent?.equals(user._id)) return student;
  if (user.role === 'student' && student.user?.equals(user._id)) return student;
  throw AppError.notFound('Student not found');
}

export async function assertStudentAccess(user: UserDoc, studentId: Types.ObjectId | string) {
  await getAccessibleStudent(user, String(studentId));
}
