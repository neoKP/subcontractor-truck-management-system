
export enum UserRole {
  BOOKING_OFFICER = 'BOOKING_OFFICER',
  DISPATCHER = 'DISPATCHER',
  ACCOUNTANT = 'ACCOUNTANT',
  ADMIN = 'ADMIN'
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.BOOKING_OFFICER]: 'เจ้าหน้าที่ Booking (Booking Officer)',
  [UserRole.DISPATCHER]: 'เจ้าหน้าที่จัดรถ (Dispatcher)',
  [UserRole.ACCOUNTANT]: 'เจ้าหน้าที่บัญชี (Accountant)',
  [UserRole.ADMIN]: 'ผู้ดูแลระบบ (Admin)'
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
  LOCKED = 'Locked (Final)'
}

export const ACCOUNTING_STATUS_LABELS: Record<AccountingStatus, string> = {
  [AccountingStatus.PENDING_REVIEW]: 'รอตรวจสอบ (Pending Review)',
  [AccountingStatus.APPROVED]: 'อนุมัติแล้ว (Approved)',
  [AccountingStatus.REJECTED]: 'ไม่อนุมัติ/แก้ไข (Rejected)',
  [AccountingStatus.LOCKED]: 'ปิดงานถาวร (Locked)'
};

export interface ExtraChargeDetail {
  id: string;
  type: string;
  amount: number;
  reason: string;
  attachmentUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface Job {
  id: string;
  dateOfService: string;
  origin: string;
  destination: string;
  truckType: string;
  productDetail: string;
  weightVolume: string;
  remark?: string;
  referenceNo?: string;
  status: JobStatus;

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

  // Accounting fields
  accountingStatus?: AccountingStatus;
  accountingRemark?: string;
  extraCharges?: ExtraChargeDetail[];
  isBaseCostLocked?: boolean;
  billingDate?: string;
  billingDocNo?: string;
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
}
