
export enum UserRole {
  BOOKING_OFFICER = 'BOOKING_OFFICER',
  DISPATCHER = 'DISPATCHER',
  ACCOUNTANT = 'ACCOUNTANT',
  ADMIN = 'ADMIN',
  FIELD_OFFICER = 'FIELD_OFFICER'
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.BOOKING_OFFICER]: 'เจ้าหน้าที่ Booking (Booking Officer)',
  [UserRole.DISPATCHER]: 'เจ้าหน้าที่จัดรถ (Dispatcher)',
  [UserRole.ACCOUNTANT]: 'เจ้าหน้าที่บัญชี (Accountant)',
  [UserRole.ADMIN]: 'ผู้ดูแลระบบ (Admin)',
  [UserRole.FIELD_OFFICER]: 'เจ้าหน้าที่หน้างาน (Field Officer)'
};

export enum JobStatus {
  NEW_REQUEST = 'New Request',
  PENDING_PRICING = 'Pending Pricing', // New status
  ASSIGNED = 'Assigned',
  COMPLETED = 'Completed',
  BILLED = 'Billed',
  CANCELLED = 'Cancelled'
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  [JobStatus.NEW_REQUEST]: 'รอรถ (New Request)',
  [JobStatus.PENDING_PRICING]: 'รอตรวจสอบราคา (Pending Pricing)',
  [JobStatus.ASSIGNED]: 'ดำเนินการ (In Progress)',
  [JobStatus.COMPLETED]: 'เสร็จสิ้น (Completed)',
  [JobStatus.BILLED]: 'วางบิลแล้ว (Billed)',
  [JobStatus.CANCELLED]: 'ยกเลิก (Cancelled)'
};

export enum AccountingStatus {
  PENDING_REVIEW = 'Pending Review',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  LOCKED = 'Locked (Final)',
  PAID = 'Paid'
}

export const ACCOUNTING_STATUS_LABELS: Record<AccountingStatus, string> = {
  [AccountingStatus.PENDING_REVIEW]: 'รอตรวจสอบ (Pending Review)',
  [AccountingStatus.APPROVED]: 'อนุมัติแล้ว (Approved)',
  [AccountingStatus.REJECTED]: 'ไม่อนุมัติ/แก้ไข (Rejected)',
  [AccountingStatus.LOCKED]: 'ปิดงานถาวร (Locked)',
  [AccountingStatus.PAID]: 'จ่ายเงินแล้ว (Paid)'
};

export interface ExtraChargeDetail {
  id: string;
  type: string;
  amount: number;
  reason: string;
  attachmentUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface DropDetail {
  location: string;
  status: 'PENDING' | 'COMPLETED';
  podUrl?: string; // Specific POD for this drop
  completedAt?: string;
}

export interface Job {
  id: string;
  createdAt?: string; // Timestamp of job creation
  dateOfService: string;
  origin: string;
  destination: string;
  truckType: string;
  productDetail: string;
  weightVolume: string;
  remark?: string;
  referenceNo?: string;
  drops?: DropDetail[]; // Upgraded from string[]
  status: JobStatus;

  // Requester information
  requestedBy?: string; // User ID of the booking officer
  requestedByName?: string; // Name of the booking officer

  // Dispatcher assigned fields
  subcontractor?: string;
  driverName?: string;
  driverPhone?: string;
  licensePlate?: string;
  cost?: number; // Cost paid to subcontractor
  sellingPrice?: number; // Revenue billed to customer (selling price)

  // Completion fields
  actualArrivalTime?: string;
  mileage?: string;
  podImageUrls?: string[];
  extraCharge?: number; // Legacy, but keeping for compatibility

  // Review fields (for Job Completion flow)
  reviewedAt?: string;
  reviewedBy?: string;

  // Accounting fields
  accountingStatus?: AccountingStatus;
  accountingRemark?: string;
  extraCharges?: ExtraChargeDetail[];
  isBaseCostLocked?: boolean;
  billingDate?: string;
  billingDocNo?: string;
  paymentDate?: string;
  paymentSlipUrl?: string;
}

export interface AuditLog {
  id: string;
  jobId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  timestamp: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface MasterData {
  locations: string[];
  truckTypes: string[];
  subcontractors: string[];
  reasons: string[];
}

export interface PriceMatrix {
  origin: string;
  destination: string;
  subcontractor: string;
  truckType: string;
  basePrice: number; // Cost paid to sub
  sellingBasePrice: number; // Revenue billed to customer
  dropOffFee?: number;
  paymentType?: 'CASH' | 'CREDIT'; // Payment type for subcontractor
  creditDays?: number; // Credit days: 0, 7, 15, 30, 45, 60, or custom
}

// Invoice Status for Subcontractor Payment
export enum InvoiceStatus {
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE'
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  [InvoiceStatus.PENDING]: 'รอจ่าย (Pending)',
  [InvoiceStatus.PARTIALLY_PAID]: 'จ่ายบางส่วน (Partial)',
  [InvoiceStatus.PAID]: 'จ่ายแล้ว (Paid)',
  [InvoiceStatus.OVERDUE]: 'เกินกำหนด (Overdue)'
};

// Deduction types for invoice
export interface InvoiceDeduction {
  id: string;
  type: 'DAMAGE' | 'WITHHOLDING_TAX' | 'OTHER'; // ค่าเสียหาย, ภาษี ณ ที่จ่าย, อื่นๆ
  description: string;
  amount: number;
  attachmentUrl?: string;
}

// Batch Invoice for Subcontractor
export interface SubcontractorInvoice {
  id: string;
  invoiceNo: string; // e.g., INV-2026-0001
  subcontractor: string;
  periodStart: string; // Start date of billing period
  periodEnd: string; // End date of billing period
  jobIds: string[]; // List of job IDs included
  totalAmount: number; // Sum of all job costs
  deductions: InvoiceDeduction[];
  netAmount: number; // totalAmount - deductions
  dueDate: string; // Payment due date
  status: InvoiceStatus;
  createdAt: string;
  createdBy: string;
  paidDate?: string;
  paidAmount?: number;
  paymentRef?: string;
  paymentSlipUrl?: string;
  remarks?: string;
}
