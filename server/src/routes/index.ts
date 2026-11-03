import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import * as auth from '../controllers/auth.controller';
import * as users from '../controllers/user.controller';
import * as students from '../controllers/student.controller';
import * as parents from '../controllers/parent.controller';
import * as fees from '../controllers/fee.controller';
import * as payments from '../controllers/payment.controller';
import * as notifications from '../controllers/notification.controller';
import * as announcements from '../controllers/announcement.controller';
import * as reports from '../controllers/report.controller';
import { idParams } from '../validators/common';
import { loginSchema, forgotSchema, resetSchema, changePasswordSchema } from '../validators/auth.validators';
import { studentListQuery, createStudentSchema, updateStudentSchema, studentAccountSchema } from '../validators/student.validators';
import { parentListQuery, createParentSchema, updateParentSchema, linkStudentSchema, linkParams } from '../validators/parent.validators';
import { structureSchema, structureUpdateSchema, feeListQuery, generateSchema, customFeeSchema, updateFeeSchema, cancelFeeSchema } from '../validators/fee.validators';
import { recordPaymentSchema, paymentListQuery } from '../validators/payment.validators';
import { announcementSchema, announcementUpdateSchema, notificationListQuery, rangeQuery, exportQuery, auditQuery, userListQuery } from '../validators/misc.validators';

const admin = authorize('admin');
const anyRole = authorize('admin', 'parent', 'student');

// ---- /api/auth
const authRouter = Router();
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), auth.login);
authRouter.post('/forgot-password', authLimiter, validate({ body: forgotSchema }), auth.forgotPassword);
authRouter.post('/reset-password', authLimiter, validate({ body: resetSchema }), auth.resetPassword);
authRouter.get('/me', authenticate, auth.me);
authRouter.post('/logout', authenticate, auth.logout);
authRouter.post('/change-password', authenticate, authLimiter, validate({ body: changePasswordSchema }), auth.changePassword);

// ---- /api/users (admin)
const userRouter = Router();
userRouter.use(authenticate, admin);
userRouter.get('/', validate({ query: userListQuery }), users.listUsers);
userRouter.patch('/:id/status', validate({ params: idParams }), users.setUserStatus);
userRouter.post('/:id/reset-link', validate({ params: idParams }), users.issueResetLink);

// ---- /api/students
const studentRouter = Router();
studentRouter.use(authenticate);
studentRouter.get('/me', authorize('student'), students.myStudentProfile);
studentRouter.get('/filters', admin, students.studentFilters);
studentRouter.get('/', admin, validate({ query: studentListQuery }), students.listStudents);
studentRouter.post('/', admin, validate({ body: createStudentSchema }), students.createStudent);
studentRouter.get('/:id', anyRole, validate({ params: idParams }), students.getStudent); // ownership checked in controller
studentRouter.patch('/:id', admin, validate({ params: idParams, body: updateStudentSchema }), students.updateStudent);
studentRouter.delete('/:id', admin, validate({ params: idParams }), students.deleteStudent);
studentRouter.post('/:id/account', admin, validate({ params: idParams, body: studentAccountSchema }), students.createStudentAccount);

// ---- /api/parents
const parentRouter = Router();
parentRouter.use(authenticate);
parentRouter.get('/me/dashboard', authorize('parent'), parents.parentDashboard);
parentRouter.get('/', admin, validate({ query: parentListQuery }), parents.listParents);
parentRouter.post('/', admin, validate({ body: createParentSchema }), parents.createParent);
parentRouter.get('/:id', admin, validate({ params: idParams }), parents.getParent);
parentRouter.patch('/:id', admin, validate({ params: idParams, body: updateParentSchema }), parents.updateParent);
parentRouter.post('/:id/students', admin, validate({ params: idParams, body: linkStudentSchema }), parents.linkStudent);
parentRouter.delete('/:id/students/:studentId', admin, validate({ params: linkParams }), parents.unlinkStudent);

// ---- /api/fees
const feeRouter = Router();
feeRouter.use(authenticate);
feeRouter.get('/structures', admin, fees.listStructures);
feeRouter.post('/structures', admin, validate({ body: structureSchema }), fees.createStructure);
feeRouter.patch('/structures/:id', admin, validate({ params: idParams, body: structureUpdateSchema }), fees.updateStructure);
feeRouter.delete('/structures/:id', admin, validate({ params: idParams }), fees.deleteStructure);
feeRouter.post('/generate', admin, validate({ body: generateSchema }), fees.generate);
feeRouter.get('/records', anyRole, validate({ query: feeListQuery }), fees.listFeeRecords); // scoped in controller
feeRouter.post('/records', admin, validate({ body: customFeeSchema }), fees.createCustomFee);
feeRouter.get('/records/:id', anyRole, validate({ params: idParams }), fees.getFeeRecord);
feeRouter.patch('/records/:id', admin, validate({ params: idParams, body: updateFeeSchema }), fees.updateFeeRecord);
feeRouter.post('/records/:id/cancel', admin, validate({ params: idParams, body: cancelFeeSchema }), fees.cancelFeeRecord);

// ---- /api/payments
const paymentRouter = Router();
paymentRouter.use(authenticate);
paymentRouter.get('/', anyRole, validate({ query: paymentListQuery }), payments.listPayments);
paymentRouter.post('/', admin, validate({ body: recordPaymentSchema }), payments.createPayment);
paymentRouter.get('/:id', anyRole, validate({ params: idParams }), payments.getPayment);
paymentRouter.get('/:id/receipt', anyRole, validate({ params: idParams }), payments.downloadReceipt);

// ---- /api/notifications
const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.get('/', validate({ query: notificationListQuery }), notifications.listNotifications);
notificationRouter.patch('/read-all', notifications.markAllRead);
notificationRouter.patch('/:id/read', validate({ params: idParams }), notifications.markRead);
notificationRouter.post('/reminders/run', admin, notifications.triggerReminders);

// ---- /api/announcements
const announcementRouter = Router();
announcementRouter.use(authenticate);
announcementRouter.get('/', announcements.listAnnouncements);
announcementRouter.post('/', admin, validate({ body: announcementSchema }), announcements.createAnnouncement);
announcementRouter.patch('/:id', admin, validate({ params: idParams, body: announcementUpdateSchema }), announcements.updateAnnouncement);
announcementRouter.delete('/:id', admin, validate({ params: idParams }), announcements.deleteAnnouncement);

// ---- /api/reports (admin)
const reportRouter = Router();
reportRouter.use(authenticate, admin);
reportRouter.get('/dashboard', reports.dashboard);
reportRouter.get('/collections', validate({ query: rangeQuery }), reports.collections);
reportRouter.get('/pending', validate({ query: rangeQuery }), reports.pendingReport);
reportRouter.get('/overdue', validate({ query: rangeQuery }), reports.overdueReport);
reportRouter.get('/export', validate({ query: exportQuery }), reports.exportCsv);
reportRouter.get('/audit-logs', validate({ query: auditQuery }), reports.auditLogs);

export const apiRouter = Router();
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/students', studentRouter);
apiRouter.use('/parents', parentRouter);
apiRouter.use('/fees', feeRouter);
apiRouter.use('/payments', paymentRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/announcements', announcementRouter);
apiRouter.use('/reports', reportRouter);
