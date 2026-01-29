import React from 'react';

/* ================= AUTH ================= */
export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  avatar?: string;
  lastLogin?: string;
  status?: 'active' | 'inactive' | 'suspended';
}

/* ================= MASTER DATA ================= */
export type Status = 'Active' | 'Inactive';

export interface Headquarter {
  id: string;
  title: string;
  status: Status;
  code?: string;
  region?: string;
}

export interface Tehsil {
  id: string;
  hqId: string;
  title: string;
  status: Status;
  code?: string;
  population?: number;
  employeeCount?: number;
}

export interface Designation {
  id: string;
  title: string;
  bpsRange: string;
  status: Status;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface Category {
  id: string;
  title: string;
  status: Status;
  description?: string;
  code?: string;
}

export type PostingUnitCategory = Category;

export interface Unit {
  id: string;
  categoryId: string;
  title: string;
  level: number;
  status: Status;
  parentId?: string;
  address?: string;
  contactNumber?: string;
}

export type PostingUnit = Unit & {
  category?: Category;
};

export interface Qualification {
  id: string;
  degreeTitle: string;
  level: number;
  status: Status;
  abbreviation?: string;
  durationYears?: number;
}

/* ================= EMPLOYMENT ================= */
export type LeaveType =
  | 'Casual Leave'
  | 'Earned Leave'
  | 'Medical Leave'
  | 'Maternity Leave'
  | 'Paternity Leave'
  | 'Ex-Pakistan Leave'
  | 'Study Leave'
  | 'Hajj Leave'
  | 'Itaqaf Leave'
  | 'Special Casual Leave';

export interface EmploymentLeave {
  id: string;
  employmentHistoryId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DisciplinaryAction {
  id: string;
  employeeId: string;
  complaintInquiry: string;
  allegation: string;
  inquiryStatus?: 'Pending' | 'Decided';
  courtName?: string | null;
  hearingDate?: string | null;
  decisionDate?: string | null;
  decision: string;
  actionDate: string;
  remarks?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type EmploymentStatus =
  | 'In-Service'
  | 'Retired'
  | 'Resigned'
  | 'Deceased'
  | 'Terminated'
  | 'Suspended'
  | 'OSD'
  | 'Deputation'
  | 'Absent'
  | 'Remove';

export interface EmploymentBlock {
  id: string;
  employeeId: string;

  hqId: string;
  tehsilId: string;
  postingCategoryId: string;
  unitId: string;

  postingPlaceTitle: string;
  designationId: string;
  bps: string;

  status: EmploymentStatus;
  statusDate?: string;
  statusRemarks?: string;
  orderNumber?: string;
  orderDate?: string;

  fromDate: string;
  toDate?: string;
  isCurrentlyWorking: boolean;

  leaves: EmploymentLeave[];
  disciplinaryActions: DisciplinaryAction[];
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/* ================= SERVICE / FINANCIAL ================= */
export type ACRScore = 'Outstanding' | 'Very Good' | 'Good' | 'Average' | 'Below Average';
export type ACRStatus = 'Draft' | 'Countersigned' | 'Pending' | 'Adverse Remarks' | 'Appealed';

export interface ACR {
  id: string;
  employeeId: string;
  year: number;
  periodFrom: string;
  periodTo: string;
  score: ACRScore;
  status: ACRStatus;
  remarks?: string;
  title?: string;
  countersignedBy?: string;
  countersignedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssetDeclaration {
  id: string;
  employeeId: string;
  financialYear: string;
  submissionDate: string;
  status: 'Draft' | 'Submitted' | 'Verified' | 'Rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type GPFundRecordType = 'Advance' | 'Refund' | 'Subscription' | 'Interest' | 'Recovery';

export interface GPFundRecord {
  id: string;
  employeeId: string;
  type: GPFundRecordType;
  amount: number;
  date: string;
  description: string;
  isRefundable: boolean;
  monthlyInstallment: number;
  remainingAmount: number;
  referenceNumber?: string;
  status: 'Pending' | 'Processed' | 'Rejected';
  processedBy?: string;
  processedAt?: string;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GPFundSummary {
  totalAvailed: number;
  timesAvailed: number;
  currentBalance: number;
  monthlyDeduction: number;
  lastUpdated?: string;
}

export interface FBRRecord {
  id: string;
  employeeId: string;
  taxYear: number;
  filerStatus: 'Filer' | 'Non-Filer' | 'Active' | 'Inactive';
  submissionDate?: string;
  taxPaid?: number;
  taxDocumentUrl?: string;
  remarks?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type DocumentType =
  | 'CNIC'
  | 'Appointment'
  | 'Qualification'
  | 'Experience'
  | 'Leave'
  | 'Disciplinary'
  | 'Other'
  | 'GPFund'
  | 'ACR'
  | 'Assets'
  | 'FBR';

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  documentType: DocumentType;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  description?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  validFrom?: string;
  validTo?: string;
  status: 'Active' | 'Expired' | 'Rejected';
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  url?: string; // For frontend use only
}

/* ================= EMPLOYEE ================= */
export type Gender = 'Male' | 'Female' | 'Other';

export interface Address {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  district: string;
  province: string;
  postalCode?: string;
  country?: string;
  isPermanent: boolean;
}

export interface ContactInfo {
  primaryPhone: string;
  secondaryPhone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  email?: string;
}

export interface Employee {
  id: string;
  cnic: string;
  fullName: string;
  fatherName: string;
  dob: string;
  dateOfAppointment: string;
  gender: Gender;
  martialStatus?: string;

  religion?: string;
  domicile?: string;
  // These properties don't exist in the database - remove them
  // contactInfo: ContactInfo;
  // permanentAddress: Omit<Address, 'isPermanent'>;
  // temporaryAddress?: Omit<Address, 'isPermanent'>;
  // sameAsPermanent: boolean;

  // Add these properties that actually exist in the database:
  contactPrimary: string;
  contactSecondary?: string;
  addressPermanent: string; // Changed from object to string (text in DB)
  addressTemporary?: string; // Changed from object to string (text in DB)
  sameAsPermanent: boolean; // tinyint in DB

  qualificationId?: string;
  degreeTitle?: string;
  photoUrl?: string;
  employmentHistory: EmploymentBlock[];

  acrs?: ACR[];
  assets?: AssetDeclaration[];
  gpFundRecords?: GPFundRecord[];
  gpFundHistory?: GPFundRecord[];
  gpFundSummary?: GPFundSummary;
  fbrRecords?: FBRRecord[];
  documents?: EmployeeDocument[];
  disciplinaryActions?: DisciplinaryAction[];

  status: 'Active' | 'Inactive' | 'Suspended' | 'Retired';
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/* ================= GENERIC ================= */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  statusCode?: number;
  timestamp?: string;
  path?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface DashboardStats {
  stats: {
    totalEmployees: number;
    inService: number;
    retired: number;
    separated: number;
    retiringSoon: number;
    judicialOfficers: number;
    courtStaff: number;
    avgAge: number;
    maleCount: number;
    femaleCount: number;
    otherGenderCount: number;
    bps1_16: number;
    bps17_22: number;
  };
  retirementThreshold: number;
}

export interface TrendData {
  year: string;
  count: number;
}

/* ================= UTILITY TYPES ================= */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Nullable<T> = T | null;
export type Dictionary<T> = Record<string, T>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/* ================= FORM TYPES ================= */
export interface FormField<T = any> {
  value: T;
  error?: string;
  touched: boolean;
  isValid: boolean;
}

export interface FormState {
  [key: string]: FormField<any>;
  // Add specific form field types as needed
}

/* ================= API TYPES ================= */
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data?: any;
  timeout?: number;
  withCredentials?: boolean;
  responseType?: 'json' | 'blob' | 'arraybuffer' | 'text';
}

export interface ApiError extends Error {
  code?: string | number;
  status?: number;
  response?: any;
  config?: any;
  isApiError: boolean;
}

/* ================= AUTH TYPES ================= */
export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/* ================= TABLE TYPES ================= */
export interface TableColumn<T> {
  key: keyof T | string;
  header: string | React.ReactNode;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  rowKey?: keyof T | ((row: T) => string | number);
  className?: string;
  emptyState?: React.ReactNode;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

/* ================= FILTER TYPES ================= */
export interface FilterOption {
  value: string | number;
  label: string;
  count?: number;
}

export interface FilterGroup {
  id: string;
  label: string;
  type: 'checkbox' | 'radio' | 'select' | 'date' | 'text';
  options?: FilterOption[];
  value: any;
  onChange: (value: any) => void;
  placeholder?: string;
}

/* ================= NOTIFICATION TYPES ================= */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  showCloseButton?: boolean;
  createdAt: number;
}