import { useState } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import React, { useRef, useEffect } from 'react';
import {
  Plus, Save, ArrowLeft, User, Briefcase, MapPin,
  GraduationCap, Phone, Loader2, Camera, Trash2,
  AlertTriangle, Coffee, Calendar, FileText,
  Home, BookOpen, Shield, Award
} from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Employee, EmploymentBlock, EmploymentLeave, DisciplinaryAction, LeaveType, Designation } from '../types';
import { BPS_GRADES, STATUS_OPTIONS, DOMICILES, RELIGION_OPTIONS, GENDER_OPTIONS, MARITAL_STATUS_OPTIONS, LEAVE_TYPES } from '../constants';
import { useMasterData } from '../context/MasterDataContext';
import { api } from '../services/api';
import ComboBox from '../components/ComboBox';

// Default empty arrays for master data
const defaultMasterData = {
  headquarters: [],
  tehsils: [],
  designations: [],
  categories: [],
  units: [],
  qualifications: []
};

// Extended initial employee data
const initialEmployee: Employee = {
  id: '',
  cnic: '',
  fullName: '',
  fatherName: '',
  dob: '',
  dateOfAppointment: '',
  gender: 'Male',
  martialStatus: 'Married',
  religion: 'Muslim',
  domicile: 'Multan',
  contactPrimary: '',
  contactSecondary: '',
  addressPermanent: '',
  addressTemporary: '',
  sameAsPermanent: false,
  qualificationId: '',
  degreeTitle: '',
  photoUrl: '',
  employmentHistory: [
    {
      id: '',
      employeeId: '',
      postingPlaceTitle: '',
      hqId: '',
      tehsilId: '',
      postingCategoryId: '',
      unitId: '',
      designationId: '',
      bps: '',
      status: 'In-Service',
      statusDate: '',
      fromDate: '',
      toDate: '',
      statusRemarks: '',
      orderNumber: '',
      isCurrentlyWorking: true,
      leaves: [],
      disciplinaryActions: []
    }
  ],
  acrs: [],
  assets: [],
  gpFundHistory: [],
  fbrRecords: [],
  documents: [],
  gpFundSummary: {
    totalAvailed: 0,
    timesAvailed: 0,
    currentBalance: 0,
    monthlyDeduction: 0
  }
  ,
  status: 'Active'
};

interface ServiceDisciplinaryAction {
  id: string;
  complaint: string;
  allegation: string;
  inquiryStatus?: 'Pending' | 'Decided';
  courtName?: string;
  hearingDate?: string;
  decisionDate?: string;
  decision: string;
  actionDate: string;
  remarks?: string;
  employmentHistoryId?: string;
}

interface ServiceLeaveRecord {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  remarks?: string;
  employmentHistoryId?: string;
}

interface EmployeeFormProps {
  onSuccess?: () => void;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ onSuccess }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const masterData = useMasterData();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use master data with fallback to empty arrays
  const {
    headquarters = [],
    tehsils = [],
    designations = [],
    categories = [],
    units = [],
    qualifications = []
  } = masterData || defaultMasterData;

  const [formData, setFormData] = useState<Employee>(() => {
    const initialData: Employee = {
      ...initialEmployee,
      id: id || ''
    };
    return initialData;
  });

  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [rejoinPreview, setRejoinPreview] = useState<null | {
    prevIndex: number;
    prevBlockId: string;
    prevStatus: string;
    prevStatusDate?: string;
    rejoinDate: string;
    absentDays: number;
    orderNumber?: string;
    orderDate?: string;
    postingPlaceTitle?: string;
    hqId?: string;
    tehsilId?: string;
    postingCategoryId?: string;
    unitId?: string;
    designationId?: string;
    bps?: string;
  }>(null);
  const [showRejoinConfirm, setShowRejoinConfirm] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [successOverlayText, setSuccessOverlayText] = useState('');
  const [serviceDisciplinaryActions, setServiceDisciplinaryActions] = useState<ServiceDisciplinaryAction[][]>([[]]);
  const [serviceLeaves, setServiceLeaves] = useState<ServiceLeaveRecord[][]>([[]]);
  const [postingPlaceOptions, setPostingPlaceOptions] = useState<string[]>([]);
  const [minAppointmentAge, setMinAppointmentAge] = useState<number>(18);
  const [currentEmploymentIndex, setCurrentEmploymentIndex] = useState<number>(0);

  type FieldErrors = {
    [key: string]: string | undefined;
  };

  // Use active headquarters only
  const activeHeadquarters = headquarters?.filter(h => h.status === 'Active') || [];

  // Filter tehsils based on selected HQ and status for the current employment block
  const currentEmployment = formData.employmentHistory[currentEmploymentIndex];
  const activeTehsilsForSelectedHQ = tehsils?.filter(t =>
    t.hqId === currentEmployment?.hqId &&
    t.status === 'Active'
  ) || [];

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isCheckingCnic, setIsCheckingCnic] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load posting place options for the combo-box
  useEffect(() => {
    let mounted = true;
    api.getPostingPlaces()
      .then(list => {
        if (mounted && Array.isArray(list)) setPostingPlaceOptions(list || []);
      })
      .catch(err => {
        console.warn('Failed to load posting place options', err);
      });
    return () => { mounted = false; };
  }, []);

  // Helper function to format date for input fields (Internal YYYY-MM-DD)
  const formatDateForInput = (dateString: string): string => {
    if (!dateString) return '';
    // If already in internal format yyyy-mm-dd
    // Verify it is a valid date (e.g. not 2023-02-30)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [yStr, mStr, dStr] = dateString.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = parseInt(dStr, 10);
      if (isValidDate(d, m, y)) return dateString;
      return '';
    }

    // If in display format dd/mm/yyyy
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
      const parts = dateString.split('/');
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);

      if (!isValidDate(d, m, y)) return '';

      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    // Try native Date or other strings
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if (!isValidDate(day, month, year)) return '';

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // Helper to format Internal date to Display date (DD/MM/YYYY)
  const formatToDisplayDate = (dateString: string): string => {
    if (!dateString) return '';
    // If it's a partial typed string or already formatted as dd/mm/yyyy, return it as is
    if (dateString.includes('/') || /^\d{1,8}$/.test(dateString)) {
      // but wait, if it's 8 digits long without /, we should mask it
      if (/^\d{8}$/.test(dateString)) return applyDateMask(dateString);
      return dateString;
    }
    const internal = formatDateForInput(dateString);
    if (!internal) return dateString; // return raw if we can't parse
    const [y, m, d] = internal.split('-');
    return `${d}/${m}/${y}`;
  };

  // Helper to check if a date (d, m, y) is valid
  // Enforces: d: 1-31 (respecting month length), m: 1-12, y: 1900-3099
  const isValidDate = (d: number, m: number, y: number): boolean => {
    if (y < 1900 || y > 3099) return false;
    if (m < 1 || m > 12) return false;

    const daysInMonth = new Date(y, m, 0).getDate();
    if (d < 1 || d > daysInMonth) return false;

    return true;
  };

  // Helper to parse Display date (DD/MM/YYYY) to Internal date (YYYY-MM-DD)
  const parseDisplayDate = (display: string): string => {
    const cleaned = display.replace(/\D/g, '');
    if (cleaned.length !== 8) return '';
    const d = parseInt(cleaned.slice(0, 2), 10);
    const m = parseInt(cleaned.slice(2, 4), 10);
    const y = parseInt(cleaned.slice(4, 8), 10);

    if (!isValidDate(d, m, y)) return '';

    // Return standard ISO format
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  // Masking function for manual entry - improved to support strict validation feedback
  const applyDateMask = (val: string): string => {
    // Basic cleaning: keep only digits
    const digits = val.replace(/\D/g, '').slice(0, 8);

    // If empty or user is clearing, allow it
    if (!val || digits.length === 0) return '';

    // If length <= 2, format as DD
    if (digits.length <= 2) {
      // Immediate basic day check (cannot exceed 31)
      const d = parseInt(digits, 10);
      if (digits.length === 2 && (d < 1 || d > 31)) {
        // Could return truncated or let it be strict? 
        // For now, let's allow typing but validation will catch it.
        // Actually, let's clamp it or stop typing if possible? 
        // Prompt says "strictly fix", so we can prevent typing invalid day start
        // But typing "3" is valid (could be 30, 31). Typing "32" is invalid.
        if (d > 31) return digits.slice(0, 1);
      }
      return digits;
    }

    // 2. If length <= 4, format as DD/MM
    if (digits.length <= 4) {
      const day = digits.slice(0, 2);
      const month = digits.slice(2);

      // Basic day check
      if (parseInt(day, 10) > 31) return day.slice(0, 1);

      // Basic month check
      if (month.length === 2) {
        const m = parseInt(month, 10);
        if (m < 1 || m > 12) return `${day}/${month.slice(0, 1)}`;
      }

      return `${day}/${month}`;
    }

    // 3. Otherwise format as DD/MM/YYYY
    const day = digits.slice(0, 2);
    const month = digits.slice(2, 4);
    const year = digits.slice(4);

    return `${day}/${month}/${year}`;
  };

  // Parse date string (using formatDateForInput to normalize) and return timestamp or null
  const parseDateTs = (dateString?: string): number | null => {
    if (!dateString) return null;
    const normalized = formatDateForInput(dateString);
    if (!normalized) return null;
    const t = new Date(normalized).getTime();
    return isNaN(t) ? null : t;
  };

  // Compare two date strings. Returns -1 if a<b, 0 if equal, 1 if a>b, null if either invalid
  const compareDates = (a?: string, b?: string): number | null => {
    const ta = parseDateTs(a);
    const tb = parseDateTs(b);
    if (ta === null || tb === null) return null;
    if (ta < tb) return -1;
    if (ta > tb) return 1;
    return 0;
  };

  // Handle manual typing in dd/mm/yyyy text field
  const handleManualDateChange = (val: string, currentVal: string, setter: (newVal: string) => void) => {
    const masked = applyDateMask(val);
    if (masked.length === 10) {
      const parsed = parseDisplayDate(masked);
      if (parsed) {
        setter(parsed);
        return;
      }
    }
    // If not a full valid date, we can't update the internal YYYY-MM-DD state yet
    // unless we allow partial dates in state (which we don't want to break other logic).
    // So for manual entry, we'll keep the masked value in a temporary "input value"
    // or just let the user finish typing.
  };

  // Load Data
  useEffect(() => {
    const fetchEmployee = async () => {
      if (id) {
        try {
          setDataLoading(true);
          const emp = await api.getEmployeeById(id);
          if (emp) {
            // Sort employment history by date (Ascending) to ensure chronological order
            // This fixes the validation error where DOA record must be first (index 0)
            if (emp.employmentHistory && Array.isArray(emp.employmentHistory)) {
              emp.employmentHistory.sort((a, b) => {
                const dateA = a.fromDate || a.statusDate || '9999-99-99';
                const dateB = b.fromDate || b.statusDate || '9999-99-99';
                return dateA.localeCompare(dateB);
              });
            }
            setFormData(emp);
            setIsEditMode(true);

            // Initialize service disciplinary actions and leaves
            if (emp.employmentHistory) {
              const initialDisciplinaryActions = emp.employmentHistory.map(service =>
                service.disciplinaryActions?.map(da => ({
                  id: (da.id || Date.now() + Math.random()).toString(),
                  complaint: da.complaintInquiry || '',
                  allegation: da.allegation || '',
                  inquiryStatus: da.inquiryStatus || 'Pending',
                  courtName: da.courtName || '',
                  hearingDate: da.hearingDate || '',
                  decisionDate: da.decisionDate || '',
                  decision: da.decision || '',
                  remarks: da.remarks || '',
                  actionDate: da.actionDate || '',
                  employmentHistoryId: service.id
                })) || []
              );

              const initialLeaves = emp.employmentHistory.map((service, serviceIndex) =>
                service.leaves?.map((leave: ServiceLeaveRecord) => {
                  // Clamp leave dates to service period on initial load
                  const serviceFrom = formatDateForInput(service.fromDate || '');
                  const serviceTo = formatDateForInput(service.toDate || '');

                  let clampedStart = formatDateForInput(leave.startDate);
                  let clampedEnd = formatDateForInput(leave.endDate);

                  // Clamp start date to be within service period
                  const cmpStartServiceFrom = compareDates(clampedStart, serviceFrom);
                  if (cmpStartServiceFrom !== null && cmpStartServiceFrom < 0) {
                    clampedStart = serviceFrom;
                  }
                  const cmpStartServiceTo = compareDates(clampedStart, serviceTo);
                  if (cmpStartServiceTo !== null && cmpStartServiceTo > 0) {
                    clampedStart = serviceTo;
                  }

                  // Clamp end date to be within service period and after start date
                  const cmpEndServiceFrom = compareDates(clampedEnd, serviceFrom);
                  if (cmpEndServiceFrom !== null && cmpEndServiceFrom < 0) {
                    clampedEnd = serviceFrom;
                  }
                  const cmpEndServiceTo = compareDates(clampedEnd, serviceTo);
                  if (cmpEndServiceTo !== null && cmpEndServiceTo > 0) {
                    clampedEnd = serviceTo;
                  }
                  const cmpEndStart = compareDates(clampedEnd, clampedStart);
                  if (cmpEndStart !== null && cmpEndStart < 0) {
                    clampedEnd = clampedStart;
                  }

                  return {
                    ...leave,
                    employmentHistoryId: service.id,
                    startDate: clampedStart,
                    endDate: clampedEnd
                  };
                }) || []
              );

              setServiceDisciplinaryActions(initialDisciplinaryActions);
              setServiceLeaves(initialLeaves);

              // Check for leave overlaps in loaded data and set errors
              const overlapErrors: Record<string, string> = {};
              initialLeaves.forEach((serviceLeaves, serviceIdx) => {
                if (serviceLeaves && serviceLeaves.length > 0) {
                  for (let i = 0; i < serviceLeaves.length; i++) {
                    for (let j = i + 1; j < serviceLeaves.length; j++) {
                      const leaveA = serviceLeaves[i];
                      const leaveB = serviceLeaves[j];
                      if (leaveA.startDate && leaveA.endDate && leaveB.startDate && leaveB.endDate) {
                        // Check overlap: if leaveB.endDate >= leaveA.startDate AND leaveB.startDate <= leaveA.endDate
                        const cmpBE = compareDates(leaveB.endDate, leaveA.startDate);
                        const cmpBS = compareDates(leaveB.startDate, leaveA.endDate);
                        if (cmpBE !== null && cmpBS !== null && cmpBE >= 0 && cmpBS <= 0) {
                          overlapErrors[`leave_overlap_${serviceIdx}_${j}`] = `This leave overlaps with Leave ${i + 1}. Leaves cannot overlap.`;
                        }
                      }
                    }
                  }
                }
              });
              if (Object.keys(overlapErrors).length > 0) {
                setFieldErrors(prev => ({ ...prev, ...overlapErrors }));
              }
            }
            // If URL includes ?action=rejoin prepare a rejoin preview
            try {
              const action = searchParams.get('action');
              if (action === 'rejoin') {
                // Lazy import of REJOINABLE_STATUSES to avoid circulars
                const mod = await import('../utils/canRejoin');
                const REJOINABLE: string[] = (mod.REJOINABLE_STATUSES || []).map((s: string) => s.toString());

                // Find most recent rejoinable block (by statusDate > toDate > fromDate)
                const blocks = emp.employmentHistory || [];
                const sorted = [...blocks].sort((a, b) => {
                  const getT = (blk: any) => new Date(blk.statusDate || blk.toDate || blk.fromDate || 0).getTime() || 0;
                  return getT(b) - getT(a);
                });
                const prevIndex = blocks.findIndex(b => REJOINABLE.map(r => r.toLowerCase()).includes((b.status || '').toString().toLowerCase()));
                if (prevIndex >= 0) {
                  const prev = blocks[prevIndex];
                  const today = formatDateForInput(new Date().toISOString());
                  const prevStatusDate = formatDateForInput(prev.statusDate || prev.fromDate || '');

                  // Absent duration ends one day before rejoining
                  const rejoinTs = new Date(today).getTime();
                  const dayBeforeRejoin = formatDateForInput(new Date(rejoinTs - 86400000).toISOString());
                  const daysAbsent = prevStatusDate ? calculateDaysDifference(prevStatusDate, dayBeforeRejoin) : 0;

                  setRejoinPreview({
                    prevIndex,
                    prevBlockId: prev.id || '',
                    prevStatus: prev.status,
                    prevStatusDate,
                    rejoinDate: today,
                    absentDays: daysAbsent,
                    orderNumber: '',
                    orderDate: '',
                    postingPlaceTitle: prev.postingPlaceTitle || '',
                    hqId: prev.hqId || '0',
                    tehsilId: prev.tehsilId || '0',
                    postingCategoryId: prev.postingCategoryId || '0',
                    unitId: prev.unitId || '0',
                    designationId: prev.designationId || '0',
                    bps: prev.bps || ''
                  });
                } else {
                  toast.info('No previous rejoinable service record found for this employee');
                }
              }
            } catch (err) {
              console.warn('prepare rejoin failed', err);
            }
          } else {
            toast.error("Employee not found!");
            navigate('/employees');
          }
        } catch (err) {
          console.error(err);
          toast.error("Failed to load employee data");
        } finally {
          setDataLoading(false);
        }
      } else {
        setDataLoading(false);
      }
    };

    fetchEmployee();
  }, [id, navigate]);

  // ================= VALIDATION / FORMAT HELPERS =================
  const countDigits = (val: string) => val.replace(/\D/g, '').length;

  const formatPakCnic = (raw: string): string => {
    // Strictly numeric for CNIC as requested
    const cleaned = raw.replace(/\D/g, '');

    // Pattern: 5-7-1
    if (cleaned.length <= 5) return cleaned;
    if (cleaned.length <= 12) return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 12)}-${cleaned.slice(12, 13)}`;
  };

  const formatPakMobile = (raw: string): string => {
    // Keep legacy behavior for Pakistani mobiles (03xx-xxxxxxx)
    const digitsOnly = raw.replace(/[^+0-9]/g, '');

    // International numbers starting with + (limit to 15 digits after +)
    if (digitsOnly.startsWith('+')) {
      const plus = '+';
      const rest = digitsOnly.slice(1).slice(0, 15);
      // simple grouping: country code (1-3) then groups of up to 3
      return plus + rest;
    }

    const digits = digitsOnly.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  };

  const validatePhoneValue = (value: string, required: boolean): string => {
    if (!value) return required ? 'Mobile number is required' : '';
    // International with + and digits
    if (value.startsWith('+')) {
      const rest = value.replace(/[^0-9+]/g, '');
      const digits = rest.replace(/\D/g, '');
      if (digits.length < 6 || digits.length > 15) return 'International number must be 6-15 digits';
      return '';
    }
    // Pakistani local format 11 digits starting with 03
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 11) return 'Mobile number must be 11 digits (03xx-xxxxxxx)';
    if (!digits.startsWith('03')) return 'Must start with 03 for Pakistani mobile numbers';
    return '';
  };

  const validateNames = (value: string): string => {
    const cleaned = value.trim();
    if (!cleaned) return 'This field is required';
    if (!/^[A-Za-z\s]+$/.test(cleaned)) {
      return 'Only alphabetic characters and spaces are allowed';
    }
    return '';
  };

  const validateDegreeTitle = (value: string): string => {
    if (!value) return '';
    if (!/^[A-Za-z0-9\s.,()\-&#/!@?+=[\]]+$/.test(value.trim())) {
      return 'Incorrect format or characters detected';
    }
    return '';
  };

  const validatePakMobileValue = (value: string, required: boolean): string => {
    const digitsLen = countDigits(value);
    if (!digitsLen) {
      return required ? 'Mobile number is required' : '';
    }
    if (digitsLen !== 11) {
      return 'Mobile number must be 11 digits (03xx-xxxxxxx)';
    }
    const digits = value.replace(/\D/g, '');
    if (!digits.startsWith('03')) {
      return 'Must start with 03 for Pakistani mobile numbers';
    }
    return '';
  };

  const getDobPlusAge = (dob: string, years: number): string | null => {
    if (!dob || !years) return null;
    const internalDob = formatDateForInput(dob);
    if (!internalDob) return null;
    const base = new Date(internalDob);
    if (isNaN(base.getTime())) return null;
    base.setFullYear(base.getFullYear() + years);
    const y = base.getFullYear();
    const m = `${base.getMonth() + 1}`.padStart(2, '0');
    const d = `${base.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // ================= STATUS CONFIGURATION =================
  const getStatusConfig = (status: string) => {
    const exitStatuses = ['Retired', 'Deceased', 'Resigned', 'Terminated', 'Suspended', 'OSD', 'Deputation', 'Absent', 'Remove'];
    const isExit = exitStatuses.includes(status);

    let dateLabel = 'Status Date';
    if (status === 'Retired') dateLabel = 'Retirement Date';
    else if (status === 'Deceased') dateLabel = 'Date of Death';
    else if (status === 'Resigned') dateLabel = 'Resignation Date';
    else if (status === 'Terminated') dateLabel = 'Termination Date';
    else if (status === 'Suspended') dateLabel = 'Suspension Date';
    else if (status === 'OSD') dateLabel = 'OSD Start Date';
    else if (status === 'Deputation') dateLabel = 'Deputation Start Date';
    else if (status === 'Absent') dateLabel = 'Absence Start Date';
    else if (status === 'Remove') dateLabel = 'Removal Date';

    return { isExit, dateLabel };
  };

  // ================= PERSONAL INFO HANDLERS =================
  const handlePersonalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;

    let newValue: string | boolean = type === 'checkbox' ? checked : value;

    // Handle CNIC formatting
    if (name === 'cnic' && typeof newValue === 'string') {
      const formatted = formatPakCnic(newValue);
      newValue = formatted;
      // Validate: base on digits only (ignore formatting dashes)
      const digitsOnly = formatted.replace(/\D/g, '');
      let msg: string | undefined;
      if (!digitsOnly) msg = 'CNIC is required';
      else if (digitsOnly.length < 5) msg = 'CNIC is too short';
      else if (digitsOnly.length > 13) msg = 'CNIC is too long';
      // If digitsOnly length is between 5 and 13 we allow partial input (no 'must be numeric' error)
      setFieldErrors(prev => ({ ...prev, cnic: msg || undefined, cnicDuplicate: undefined }));
    }

    // Handle names
    if ((name === 'fullName' || name === 'fatherName') && typeof newValue === 'string') {
      newValue = newValue.replace(/[^A-Za-z\s]/g, '');
      const msg = validateNames(newValue as string);
      setFieldErrors(prev => {
        const newErrs = { ...prev, [name]: msg || undefined };
        return newErrs;
      });
    }

    // Handle degree title
    // Handle degree title - allow Alphanumeric and common special characters
    if (name === 'degreeTitle' && typeof newValue === 'string') {
      newValue = newValue.replace(/[^A-Za-z0-9\s.,()\-&#/!@?+=[\]]/g, '');
      const msg = validateDegreeTitle(newValue as string);
      setFieldErrors(prev => ({ ...prev, degreeTitle: msg || undefined }));
    }

    // Handle phone numbers
    if ((name === 'contactPrimary' || name === 'contactSecondary') && typeof newValue === 'string') {
      newValue = formatPakMobile(newValue);
      const msg = validatePhoneValue(newValue as string, name === 'contactPrimary');
      setFieldErrors(prev => ({ ...prev, [name]: msg || undefined }));
    }

    // Handle date validations
    if (name === 'dob' && typeof newValue === 'string') {
      let msg: string | undefined;
      const internalDob = formatDateForInput(newValue);
      if (!newValue) msg = 'Date of Birth is required';
      else if (!internalDob) msg = 'Invalid Date Format';

      setFieldErrors(prev => ({ ...prev, dob: msg || undefined }));

      // Also re-validate DOA if DOB changes
      if (formData.dateOfAppointment) {
        const minDate = getDobPlusAge(newValue, minAppointmentAge);
        const cmp = compareDates(formatDateForInput(formData.dateOfAppointment), minDate || '');
        let doaMsg: string | undefined;
        if (minDate && cmp !== null && cmp < 0) {
          doaMsg = `DOA must be at least ${minAppointmentAge} years after DOB`;
        }
        setFieldErrors(prev => ({ ...prev, dateOfAppointment: doaMsg }));
      }
    }

    if (name === 'dateOfAppointment' && typeof newValue === 'string') {
      const minDate = getDobPlusAge(formData.dob, minAppointmentAge);
      let msg: string | undefined;
      const cmp = compareDates(newValue, minDate || '');

      if (!newValue) {
        msg = 'Date of Appointment is required';
      } else if (minDate && cmp !== null && cmp < 0) {
        msg = `DOA must be at least ${minAppointmentAge} years after DOB`;
      }
      setFieldErrors(prev => ({ ...prev, dateOfAppointment: msg }));
    }

    // Update form data based on field name
    setFormData(prev => {
      // For sameAsPermanent checkbox
      if (name === 'sameAsPermanent') {
        return {
          ...prev,
          sameAsPermanent: checked,
          addressTemporary: checked ? prev.addressPermanent : prev.addressTemporary
        };
      }

      // For permanent address - update temporary if sameAsPermanent is checked
      if (name === 'addressPermanent') {
        return {
          ...prev,
          addressPermanent: value as string,
          ...(prev.sameAsPermanent ? { addressTemporary: value as string } : {})
        };
      }

      // For all other fields - use computed newValue (formatted) instead of raw `value`
      return {
        ...prev,
        [name]: type === 'checkbox' ? checked : newValue
      };
    });
  };

  // ================= SERVICE HISTORY HANDLERS =================
  const handleServiceChange = (serviceIndex: number, field: keyof EmploymentBlock, value: string | boolean) => {
    setFormData(prev => {
      const blocks = [...prev.employmentHistory];
      const prevBlock = blocks[serviceIndex];

      let updates: Partial<EmploymentBlock> = { [field]: value };

      // Logic when Status Changes
      if (field === 'status') {
        const newStatus = value as string;
        const { isExit } = getStatusConfig(newStatus);

        if (isExit) {
          // Clear In-Service fields to prevent invalid data
          updates.fromDate = '';
          updates.toDate = '';
          updates.isCurrentlyWorking = false;
        } else {
          // Clear Status Date if going back to In-Service
          updates.statusDate = '';
        }
      }

      // Handle dependencies
      if (field === 'hqId') updates.tehsilId = '';
      if (field === 'postingCategoryId') updates.unitId = '';
      if (field === 'isCurrentlyWorking' && value === true) {
        updates.toDate = '';
        // Ensure no other blocks are marked as current
        for (let i = 0; i < blocks.length; i++) {
          if (i !== serviceIndex && blocks[i].isCurrentlyWorking) {
            blocks[i] = { ...blocks[i], isCurrentlyWorking: false };
          }
        }
      }
      // Immediate validation: if changing fromDate ensure it is not before DOA or previous block's toDate
      if (field === 'fromDate' && typeof value === 'string') {
        let errorMsg: string | undefined;

        // First check: fromDate must be >= DOA (applies to all services)
        const doa = formatDateForInput(formData.dateOfAppointment || '');
        const cmpDoa = compareDates(value as string, doa);
        if (doa && cmpDoa !== null && cmpDoa < 0) {
          errorMsg = `From Date must be on/after Date of Appointment (${doa})`;
        }

        // Second check: if not first service, must be >= previous block toDate
        if (!errorMsg && serviceIndex > 0) {
          const previous = blocks[serviceIndex - 1];
          const prevTo = previous.toDate || '';
          const cmpPrev = compareDates(value as string, prevTo);
          if (prevTo && cmpPrev !== null && cmpPrev < 0) {
            errorMsg = `From Date must be on/after previous block To Date (${prevTo})`;
          }
        }

        setFieldErrors(fe => {
          const copy = { ...fe };
          if (errorMsg) {
            copy[`fromDate_${serviceIndex}`] = errorMsg;
          } else {
            delete copy[`fromDate_${serviceIndex}`];
          }
          return copy;
        });
      }

      // Immediate validation: if changing statusDate (for exit-like statuses)
      if (field === 'statusDate' && typeof value === 'string') {
        let errorMsg: string | undefined;
        const doa = formatDateForInput(formData.dateOfAppointment || '');
        const cmpDoa = compareDates(value as string, doa);
        if (doa && cmpDoa !== null && cmpDoa < 0) {
          errorMsg = `Status Date must be on/after Date of Appointment (${doa})`;
        }
        // Check against previous block toDate if exists
        if (!errorMsg && serviceIndex > 0) {
          const previous = blocks[serviceIndex - 1];
          const prevTo = previous.toDate || '';
          const cmpPrev = compareDates(value as string, prevTo);
          if (prevTo && cmpPrev !== null && cmpPrev < 0) {
            errorMsg = `Status Date must be on/after previous block To Date (${prevTo})`;
          }
        }

        setFieldErrors(fe => {
          const copy = { ...fe };
          if (errorMsg) {
            copy[`statusDate_${serviceIndex}`] = errorMsg;
          } else {
            delete copy[`statusDate_${serviceIndex}`];
          }
          return copy;
        });
      }

      // Check for service block overlap with other blocks when toDate changes
      if (field === 'toDate' && typeof value === 'string') {
        const currentBlock = { ...prevBlock, toDate: value };
        let overlapError: string | undefined;

        // Check overlap with other blocks
        for (let i = 0; i < blocks.length; i++) {
          if (i === serviceIndex) continue; // Skip self
          const otherBlock = blocks[i];

          // Use fromDate or statusDate for start of range, prioritizing statusDate for exit statuses
          const currentExit = getStatusConfig(currentBlock.status).isExit;
          const otherExit = getStatusConfig(otherBlock.status).isExit;

          const currentFrom = currentExit ? (currentBlock.statusDate || currentBlock.fromDate || '') : (currentBlock.fromDate || currentBlock.statusDate || '');
          const otherFrom = otherExit ? (otherBlock.statusDate || otherBlock.fromDate || '') : (otherBlock.fromDate || otherBlock.statusDate || '');

          const currentTo = value; // This is the new toDate being set
          const otherTo = otherBlock.toDate || '';

          // Overlap if ranges truly intersect. 
          // Treat empty toDate as infinity (very far future date)
          const cmp1 = !currentTo ? 1 : compareDates(currentTo, otherFrom);
          const cmp2 = !otherTo ? -1 : compareDates(currentFrom, otherTo);

          if (currentFrom && otherFrom && cmp1 !== null && cmp2 !== null && cmp1 > 0 && cmp2 < 0) {
            overlapError = `Service block ${i + 1} (${otherFrom} to ${otherTo || 'Current'}) overlaps with this block (${currentFrom} to ${currentTo || 'Current'})`;
            break;
          }
        }

        setFieldErrors(fe => {
          const copy = { ...fe };
          if (overlapError) {
            copy[`service_overlap_${serviceIndex}`] = overlapError;
          } else {
            delete copy[`service_overlap_${serviceIndex}`];
          }
          return copy;
        });
      }

      // Check if toDate is empty and isCurrentlyWorking is false
      if ((field === 'toDate' || field === 'isCurrentlyWorking') && typeof value !== 'object') {
        const newBlock = { ...prevBlock, ...updates };
        let incompleteError: string | undefined;

        // Only show error if BOTH toDate is empty AND isCurrentlyWorking is false
        const toDateValue = field === 'toDate' ? (value as string) : newBlock.toDate;
        const isCurrently = field === 'isCurrentlyWorking' ? (value as boolean) : newBlock.isCurrentlyWorking;

        if (newBlock.status === 'In-Service' && !toDateValue && !isCurrently) {
          incompleteError = 'To Date is required or mark as Current Posting';
        }

        setFieldErrors(fe => {
          const copy = { ...fe };
          if (incompleteError) {
            copy[`service_incomplete_${serviceIndex}`] = incompleteError;
          } else {
            delete copy[`service_incomplete_${serviceIndex}`];
          }
          return copy;
        });
      }

      // Clear postingPlaceTitle validation error when field is changed
      if (field === 'postingPlaceTitle') {
        setFieldErrors(fe => {
          const copy = { ...fe };
          delete copy[`postingPlaceTitle_${serviceIndex}`];
          return copy;
        });
      }

      blocks[serviceIndex] = { ...prevBlock, ...updates };
      return { ...prev, employmentHistory: blocks };
    });
  };

  const addServiceBlock = () => {
    const DISALLOWED_ADD_SERVICE_STATUSES = ['Retired', 'Resigned', 'Terminate', 'OSD', 'Deputation', 'Suspended', 'Deceased', 'Absent', 'Remove'];
    if (DISALLOWED_ADD_SERVICE_STATUSES.includes(formData.status)) {
      toast.error('Cannot add a service record when employee status is set to ' + formData.status);
      return;
    }

    // Check if the latest service block is incomplete (no toDate and not currently working)
    const latestService = formData.employmentHistory[formData.employmentHistory.length - 1];
    if (latestService && !latestService.toDate && !latestService.isCurrentlyWorking) {
      setFieldErrors(prev => ({
        ...prev,
        [`service_incomplete_${formData.employmentHistory.length - 1}`]: 'To Date is required or mark as Current Posting before adding another service block'
      }));
      toast.error('Please complete the current service block (fill To Date or mark as Current Posting) before adding another');
      return;
    }

    // Prevent adding if there's a current posting
    if (formData.employmentHistory.some(b => b.isCurrentlyWorking)) {
      toast.error('Cannot add another service while an active/current posting exists');
      return;
    }

    // Clear the incomplete service error if it exists
    setFieldErrors(prev => {
      const copy = { ...prev };
      delete copy[`service_incomplete_${formData.employmentHistory.length - 1}`];
      return copy;
    });

    // Default the new block's fromDate to the previous block's toDate when available
    setFormData(prev => {
      const last = prev.employmentHistory[prev.employmentHistory.length - 1];
      const defaultFrom = last?.toDate ? formatDateForInput(last.toDate) : '';
      return {
        ...prev,
        employmentHistory: [
          ...prev.employmentHistory,
          {
            id: '',
            employeeId: '',
            postingPlaceTitle: '',
            hqId: '',
            tehsilId: '',
            postingCategoryId: '',
            unitId: '',
            designationId: '',
            bps: '',
            status: 'In-Service',
            statusDate: '',
            fromDate: defaultFrom,
            toDate: '',
            statusRemarks: '',
            orderNumber: '',
            isCurrentlyWorking: false,
            leaves: [],
            disciplinaryActions: []
          }
        ]
      };
    });
    // Add empty arrays for new service
    setServiceDisciplinaryActions(prev => [...prev, []]);
    setServiceLeaves(prev => [...prev, []]);
  };

  const removeServiceBlock = (index: number) => {
    if (formData.employmentHistory.length > 1) {
      setFormData(prev => ({
        ...prev,
        employmentHistory: prev.employmentHistory.filter((_, i) => i !== index)
      }));
      // Remove corresponding arrays
      setServiceDisciplinaryActions(prev => prev.filter((_, i) => i !== index));
      setServiceLeaves(prev => prev.filter((_, i) => i !== index));
    }
  };

  // ================= DISCIPLINARY ACTION HANDLERS =================
  const addDisciplinaryAction = (serviceIndex: number) => {
    const service = formData.employmentHistory[serviceIndex];
    if (service?.status !== 'In-Service') {
      toast.error('Disciplinary actions can only be added for services with status In-Service');
      return;
    }

    setServiceDisciplinaryActions(prev => {
      const newActions = [...prev];
      if (!newActions[serviceIndex]) {
        newActions[serviceIndex] = [];
      }
      newActions[serviceIndex] = [
        ...newActions[serviceIndex],
        {
          id: Date.now().toString(),
          complaint: '',
          allegation: '',
          inquiryStatus: 'Pending',
          courtName: '',
          hearingDate: '',
          decisionDate: '',
          decision: '',
          remarks: '',
          actionDate: formatDateForInput(new Date().toISOString())
        }
      ];
      return newActions;
    });
  };

  const updateDisciplinaryAction = (serviceIndex: number, actionIndex: number, field: keyof ServiceDisciplinaryAction, value: string) => {
    setServiceDisciplinaryActions(prev => {
      const newActions = [...prev];
      const actions = [...(newActions[serviceIndex] || [])];
      actions[actionIndex] = {
        ...actions[actionIndex],
        [field]: value
      };
      newActions[serviceIndex] = actions;
      return newActions;
    });
  };

  const removeDisciplinaryAction = (serviceIndex: number, actionIndex: number) => {
    setServiceDisciplinaryActions(prev => {
      const newActions = [...prev];
      const actions = [...(newActions[serviceIndex] || [])];
      actions.splice(actionIndex, 1);
      newActions[serviceIndex] = actions;
      return newActions;
    });
  };

  // ================= LEAVES HANDLERS =================
  const addLeave = (serviceIndex: number) => {
    const service = formData.employmentHistory[serviceIndex];
    if (service?.status !== 'In-Service') {
      toast.error('Leaves can only be added for services with status In-Service');
      return;
    }

    setServiceLeaves(prev => {
      const newLeaves = [...prev];
      if (!newLeaves[serviceIndex]) {
        newLeaves[serviceIndex] = [];
      }

      // Default start/end to within service block period
      const defaultStart = service.fromDate ? formatDateForInput(service.fromDate) : formatDateForInput(new Date().toISOString());
      const defaultEnd = service.toDate ? formatDateForInput(service.toDate) : formatDateForInput(new Date().toISOString());

      newLeaves[serviceIndex] = [
        ...newLeaves[serviceIndex],
        {
          id: Date.now().toString(),
          type: LEAVE_TYPES[0] || 'Casual',
          startDate: defaultStart,
          endDate: defaultEnd,
          days: 0,
          remarks: ''
        }
      ];
      return newLeaves;
    });
  };

  const calculateDaysDifference = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0;
    // Normalize dates to YYYY-MM-DD before parsing
    const normalizedStart = formatDateForInput(startDate);
    const normalizedEnd = formatDateForInput(endDate);

    if (!normalizedStart || !normalizedEnd) return 0;

    const start = new Date(normalizedStart);
    const end = new Date(normalizedEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const updateLeave = (serviceIndex: number, leaveIndex: number, field: keyof ServiceLeaveRecord, value: string | number) => {
    setServiceLeaves(prev => {
      const newLeaves = [...prev];
      const leaves = [...(newLeaves[serviceIndex] || [])];

      // clamp dates within service period when setting start/end
      const service = formData.employmentHistory[serviceIndex];
      const svcStart = service.fromDate || '';
      const svcEnd = service.toDate || '';

      let newVal: any = value;
      // Removed auto-clamping logic to allow free typing/backspacing
      // Validation will be handled by field errors instead

      leaves[leaveIndex] = { ...leaves[leaveIndex], [field]: newVal };

      // Calculate days if dates are updated
      if ((field === 'startDate' || field === 'endDate') && leaves[leaveIndex].startDate && leaves[leaveIndex].endDate) {
        const diffDays = calculateDaysDifference(leaves[leaveIndex].startDate, leaves[leaveIndex].endDate);
        leaves[leaveIndex].days = diffDays;
      }

      // Check for overlaps in real-time and set error
      const currentLeave = leaves[leaveIndex];
      let overlapError: string | undefined;

      if (currentLeave.startDate && currentLeave.endDate) {
        for (let i = 0; i < leaves.length; i++) {
          if (i === leaveIndex) continue; // Skip self
          const otherLeave = leaves[i];
          if (otherLeave.startDate && otherLeave.endDate) {
            // Check if current leave overlaps with other leave
            // Overlap = if otherLeave.endDate >= currentLeave.startDate AND otherLeave.startDate <= currentLeave.endDate
            if (otherLeave.endDate >= currentLeave.startDate && otherLeave.startDate <= currentLeave.endDate) {
              overlapError = `This leave (${currentLeave.startDate} to ${currentLeave.endDate}) overlaps with Leave ${i + 1} (${otherLeave.startDate} to ${otherLeave.endDate}). Leaves cannot overlap.`;
              break;
            }
          }
        }
      }

      // Set or clear overlap error for this leave
      setFieldErrors(prev => {
        const updated = { ...prev };

        // Handle Overlap Error
        if (overlapError) {
          updated[`leave_overlap_${serviceIndex}_${leaveIndex}`] = overlapError;
        } else {
          delete updated[`leave_overlap_${serviceIndex}_${leaveIndex}`];
        }

        // Handle Bounds Error (Start Date < Service Start OR End Date > Service End)
        // We use compareDates (assuming it is available in scope as used elsewhere)
        const lf = leaves[leaveIndex];
        let boundsError: string | undefined;

        if (lf.startDate && svcStart) {
          const cmp = compareDates(lf.startDate, svcStart);
          if (cmp !== null && cmp < 0) {
            boundsError = 'Leave start cannot be before service start';
          }
        }
        if (!boundsError && lf.endDate && svcEnd) {
          const cmp = compareDates(lf.endDate, svcEnd);
          if (cmp !== null && cmp > 0) {
            boundsError = 'Leave end cannot be after service end';
          }
        }

        // Re-use the same error key or a new one? 
        // Using `leave_${serviceIndex}_${leaveIndex}` which is checked in validateBeforeSubmit
        if (boundsError) {
          updated[`leave_${serviceIndex}_${leaveIndex}`] = boundsError;
        } else {
          delete updated[`leave_${serviceIndex}_${leaveIndex}`];
        }

        return updated;
      });

      newLeaves[serviceIndex] = leaves;
      return newLeaves;
    });
  };

  const removeLeave = (serviceIndex: number, leaveIndex: number) => {
    setServiceLeaves(prev => {
      const newLeaves = [...prev];
      const leaves = [...(newLeaves[serviceIndex] || [])];
      leaves.splice(leaveIndex, 1);
      newLeaves[serviceIndex] = leaves;
      return newLeaves;
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validate file size (max 2MB)
      const maxSize = 2 * 1024 * 1024; // 2MB in bytes
      if (file.size > maxSize) {
        toast.error('Image size must be less than 2MB');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }

      // Upload the photo and store the file path instead of base64
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const photoDataUrl = reader.result as string;
            const { photoPath } = await api.uploadPhoto(photoDataUrl);
            setFormData(prev => ({ ...prev, photoUrl: photoPath }));
            toast.success('Photo uploaded successfully');
          } catch (err) {
            toast.error('Failed to upload photo: ' + (err instanceof Error ? err.message : 'Unknown error'));
          }
        };
        reader.readAsDataURL(file);
      } catch (err) {
        toast.error('Error processing photo: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    }
  };

  // ================= VALIDATION =================
  const validateTimeline = (history: EmploymentBlock[]) => {
    // Sort by date (either fromDate or statusDate)
    const sorted = [...history].sort((a, b) => {
      const dateA = a.fromDate || a.statusDate || '9999-99-99';
      const dateB = b.fromDate || b.statusDate || '9999-99-99';
      return dateA.localeCompare(dateB);
    });

    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];

      // Overlap check: Only relevant if both records are 'In-Service' ranges
      if (curr.status === 'In-Service' && next.status === 'In-Service') {
        const startA = curr.fromDate;
        const endA = curr.toDate || '';
        const startB = next.fromDate;

        if (startA && endA && startB) {
          const cmp = compareDates(startB, endA);
          if (cmp !== null && cmp < 0) {
            return `Overlap detected: Service starting ${formatToDisplayDate(startB)} overlaps with service ending ${formatToDisplayDate(endA)}`;
          }
        }
      }
    }
    return null;
  };

  // ================= SUBMIT HANDLERS =================
  const validateBeforeSubmit = (): boolean => {
    const errors: Record<string, string | undefined> = {};

    // Check if there are any existing field errors from real-time validation
    const existingErrors = Object.keys(fieldErrors).filter(key => fieldErrors[key]);
    if (existingErrors.length > 0) {
      // console.log('validateBeforeSubmit: blocking due to existing fieldErrors', { fieldErrors, existingErrors });
      const msgs = existingErrors.map(k => `${k}: ${fieldErrors[k]}`).slice(0, 4);
      toast.error(`Fix validation errors: ${msgs.join(' ; ')}`);
      return false;
    }

    // Basic required fields
    if (!formData.cnic) errors.cnic = 'CNIC is required';
    if (!formData.fullName) errors.fullName = 'Full name is required';
    if (!formData.fatherName) errors.fatherName = 'Father name is required';
    if (!formData.gender) errors.gender = 'Gender is required';
    if (!formData.religion) errors.religion = 'Religion is required';
    if (!formData.domicile) errors.domicile = 'Domicile is required';
    if (!formData.degreeTitle) errors.degreeTitle = 'Degree title is required';
    if (!formData.addressPermanent) errors.addressPermanent = 'Permanent address is required';

    // Posting place validation and duplicates
    const titles = new Set<string>();
    let doaEqualsCount = 0;
    let doaEqualsIndex = -1;
    for (let i = 0; i < formData.employmentHistory.length; i++) {
      const svc = formData.employmentHistory[i];

      // Skip validation for empty/new service blocks (only has default values)
      const isEmptyServiceBlock = !svc.postingPlaceTitle?.trim() && !svc.fromDate && !svc.toDate && !svc.designationId && !svc.hqId;

      if (isEmptyServiceBlock) {
        continue; // Skip validation for empty blocks
      }

      // Check if service block is complete (toDate or isCurrentlyWorking required for In-Service)
      if (svc.status === 'In-Service' && !svc.toDate && !svc.isCurrentlyWorking) {
        errors[`service_incomplete_${i}`] = 'To Date is required or mark as Current Posting';
      }

      if (!svc.postingPlaceTitle || !svc.postingPlaceTitle.trim()) {
        errors[`postingPlaceTitle_${i}`] = 'Posting Place Title is required';
      } else {
        const trimmedTitle = svc.postingPlaceTitle.trim();
        // Allow free text for posting place title (user requested). Only enforce duplicate titles across service blocks.
        // Allow duplicate posting place titles across service blocks per user request.
      }

      // Timeline checks
      if (svc.status === 'In-Service') {
        if (!svc.fromDate) {
          errors[`fromDate_${i}`] = 'From Date is required';
        } else {
          // fromDate must be >= dateOfAppointment
          const doa = formatDateForInput(formData.dateOfAppointment || '');
          const cmpDoa = compareDates(svc.fromDate, doa);
          if (doa && cmpDoa !== null && cmpDoa < 0) {
            errors[`fromDate_${i}`] = `From Date must be on/after Date of Appointment (${doa})`;
          }
          if (doa && svc.fromDate === doa) {
            doaEqualsCount++;
            if (doaEqualsIndex === -1) doaEqualsIndex = i;
          }
        }
      } else {
        // Non In-Service statuses should use statusDate (e.g., Absent, Retired, Deputation etc.)
        if (!svc.statusDate) {
          errors[`statusDate_${i}`] = `${getStatusConfig(svc.status).dateLabel || 'Status Date'} is required`;
        } else {
          const doa = formatDateForInput(formData.dateOfAppointment || '');
          const cmpDoa = compareDates(svc.statusDate, doa);
          if (doa && cmpDoa !== null && cmpDoa < 0) {
            errors[`statusDate_${i}`] = `${getStatusConfig(svc.status).dateLabel || 'Status Date'} must be on/after Date of Appointment (${doa})`;
          }
        }
      }

      // If previous block exists, enforce sequential
      if (i > 0) {
        const prev = formData.employmentHistory[i - 1];
        // previous block should normally have a toDate (unless it is currently working)
        // Determine the current block's effective boundary date (fromDate for In-Service, statusDate otherwise)
        const currentBoundary = svc.status === 'In-Service' ? svc.fromDate : (svc.statusDate || svc.fromDate || '');
        const EXIT_STATUSES = ['Retired', 'Resigned', 'Terminate', 'OSD', 'Deputation', 'Suspended', 'Deceased', 'Absent', 'Remove'];
        const isExitLike = EXIT_STATUSES.includes(svc.status);

        if (!prev.toDate) {
          if (isExitLike && currentBoundary) {
            // Auto-fill previous block's toDate with current block's boundary date to allow saving.
            const updated = { ...formData } as typeof formData;
            const prevIndex = i - 1;
            if (updated.employmentHistory && updated.employmentHistory[prevIndex]) {
              updated.employmentHistory = [...updated.employmentHistory];
              updated.employmentHistory[prevIndex] = { ...updated.employmentHistory[prevIndex], toDate: currentBoundary };
              setFormData(updated);
              prev.toDate = currentBoundary;
              // Notify the user that previous To Date was auto-filled
              toast.info(`Previous service To Date auto-filled as ${formatToDisplayDate(currentBoundary)}`, {
                position: 'top-right',
                autoClose: 4000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
              });
            }
          } else {
            errors[`fromDate_${i}`] = 'Previous service block is missing To Date';
          }
        } else {
          const prevTo = formatDateForInput(prev.toDate);
          // When current boundary exists, ensure it is not before prev.toDate
          const cmpPrev = compareDates(currentBoundary, prevTo);
          if (currentBoundary && cmpPrev !== null && cmpPrev < 0) {
            errors[`fromDate_${i}`] = `From Date must be on/after previous block To Date (${formatToDisplayDate(prevTo)})`;
          }
        }
      }

      // Check service block overlap with other blocks
      const svcExit = getStatusConfig(svc.status).isExit;
      const svcFrom = svcExit ? (svc.statusDate || svc.fromDate || '') : (svc.fromDate || svc.statusDate || '');

      if (svcFrom) {
        for (let j = 0; j < formData.employmentHistory.length; j++) {
          if (i === j) continue;
          const other = formData.employmentHistory[j];
          const otherExit = getStatusConfig(other.status).isExit;
          const otherFrom = otherExit ? (other.statusDate || other.fromDate || '') : (other.fromDate || other.statusDate || '');

          if (otherFrom) {
            const svcTo = svc.toDate || '';
            const otherTo = other.toDate || '';

            // Overlap if ranges truly intersect. 
            // Treat empty toDate as infinity
            const cmpA = !svcTo ? 1 : compareDates(svcTo, otherFrom);
            const cmpB = !otherTo ? -1 : compareDates(svcFrom, otherTo);

            if (cmpA !== null && cmpB !== null && cmpA > 0 && cmpB < 0) {
              errors[`service_overlap_${i}`] = `Service block ${j + 1} (${otherFrom} to ${otherTo || 'Current'}) overlaps with this block`;
            }
          }
        }
      }

      // Leaves within service
      const leaves = serviceLeaves[i] || [];
      // normalize service period
      const svcStart = svc.fromDate || '';
      const svcEnd = svc.toDate || '';
      for (let li = 0; li < leaves.length; li++) {
        const lf = leaves[li];
        if (!lf.startDate || !lf.endDate) {
          errors[`leave_${i}_${li}`] = 'Leave start and end dates are required';
          continue;
        }
        const cmpSE = compareDates(lf.startDate, lf.endDate);
        if (cmpSE !== null && cmpSE > 0) {
          errors[`leave_${i}_${li}`] = 'Leave start must be before or equal to end';
        }
        if (svcStart) {
          const cmpLS = compareDates(lf.startDate, svcStart);
          if (cmpLS !== null && cmpLS < 0) {
            errors[`leave_${i}_${li}`] = 'Leave start is before service start';
          }
        }
        if (svcEnd) {
          const cmpLE = compareDates(lf.endDate, svcEnd);
          if (cmpLE !== null && cmpLE > 0) {
            errors[`leave_${i}_${li}`] = 'Leave end is after service end';
          }
        }
      }
      // Check leaves overlap within this service
      const sortedLeaves = [...leaves].filter(l => l.startDate && l.endDate).sort((a, b) => a.startDate.localeCompare(b.startDate));
      for (let k = 0; k < sortedLeaves.length - 1; k++) {
        const a = sortedLeaves[k];
        const b = sortedLeaves[k + 1];
        // Overlap check: if leave A ends on date X, leave B must start on date X+1 or later
        // Overlap occurs if leaveB.startDate <= leaveA.endDate
        const cmpBA = compareDates(b.startDate, a.endDate);
        if (cmpBA !== null && cmpBA <= 0) {
          errors[`leave_overlap_${i}`] = `Leave periods overlap: Leave ${k + 1} ends ${a.endDate} but Leave ${k + 2} starts ${b.startDate}. Next leave must start after previous leave ends.`;
        }
      }
    }

    if (doaEqualsCount > 1) {
      errors['fromDate_doajoin'] = 'From Date equal to Date of Appointment can appear only once in employment history';
    }
    if (doaEqualsCount === 1 && doaEqualsIndex > 0) {
      errors['fromDate_doaposition'] = 'From Date equal to Date of Appointment must be the first service record';
    }

    setFieldErrors(prev => ({ ...prev, ...errors }));
    if (Object.keys(errors).length > 0) {
      // console.log('validateBeforeSubmit: found errors object', errors);
      const msgs = Object.keys(errors).map(k => `${k}: ${errors[k]}`).slice(0, 6);
      toast.error(`Please fix validation errors: ${msgs.join(' ; ')}`);
      return false;
    }
    return true;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!validateBeforeSubmit()) return;
    setShowConfirm(true);
  };
  const confirmSubmit = async () => {
    setIsSubmitting(true);
    setShowConfirm(false);

    try {
      // Map service data to match the expected types
      const employmentHistory = formData.employmentHistory.map((service, index) => {
        // trim postingPlaceTitle before sending
        const postingPlaceTitle = service.postingPlaceTitle ? service.postingPlaceTitle.trim() : '';
        // Map disciplinary actions - remove employmentHistoryId since it's not in the interface
        const disciplinaryActions: DisciplinaryAction[] = (serviceDisciplinaryActions[index] || []).map(da => ({
          id: da.id && da.id !== '' ? da.id : '',
          employeeId: formData.id,
          complaintInquiry: da.complaint,
          allegation: da.allegation,
          inquiryStatus: da.inquiryStatus || 'Pending',
          courtName: da.courtName && da.courtName.trim() !== '' ? da.courtName : null,
          hearingDate: da.hearingDate && da.hearingDate.trim() !== '' ? formatDateForInput(da.hearingDate) : null,
          decisionDate: da.decisionDate && da.decisionDate.trim() !== '' ? formatDateForInput(da.decisionDate) : null,
          decision: da.decision || '',
          actionDate: formatDateForInput(da.actionDate || ''),
          remarks: da.remarks || ''
        }));

        // Map leaves - use LeaveType from types
        const leaves: EmploymentLeave[] = (serviceLeaves[index] || []).map(leave => ({
          id: leave.id && leave.id !== '' ? leave.id : '',
          employmentHistoryId: service.id || '',
          type: LEAVE_TYPES.includes(leave.type) ? leave.type as LeaveType : (LEAVE_TYPES[0] as LeaveType) || 'Casual Leave',
          startDate: formatDateForInput(leave.startDate || ''),
          endDate: formatDateForInput(leave.endDate || ''),
          days: leave.days || calculateDaysDifference(leave.startDate, leave.endDate),
          remarks: leave.remarks || ''
        }));

        return {
          ...service,
          postingPlaceTitle,
          statusDate: formatDateForInput(service.statusDate || ''),
          fromDate: formatDateForInput(service.fromDate || ''),
          toDate: formatDateForInput(service.toDate || ''),
          disciplinaryActions,
          leaves
        };
      });

      const employeeData: Employee = {
        ...formData,
        dob: formatDateForInput(formData.dob),
        dateOfAppointment: formatDateForInput(formData.dateOfAppointment),
        employmentHistory
      };

      if (isEditMode) {
        await api.updateEmployee(employeeData);
        toast.success("Record Updated Successfully", {
          position: "top-center",
          autoClose: 2000,
          style: { background: '#16a34a', color: '#ffffff', fontSize: '24px' }
        });
        setSuccessOverlayText('Record Updated Successfully');
        setShowSuccessOverlay(true);

        // Redirect to employee list after successful update
        setTimeout(() => {
          setShowSuccessOverlay(false);
          navigate('/employees');
        }, 2000);
      } else {
        await api.createEmployee(employeeData);
        toast.success("New Employee Registered Successfully", {
          position: "top-center",
          autoClose: 3000,
          style: { background: '#16a34a', color: '#ffffff', fontSize: '24px' }
        });
        setSuccessOverlayText('New Employee Registered Successfully');
        setShowSuccessOverlay(true);
        setTimeout(() => setShowSuccessOverlay(false), 3000);

        // Reset form after successful submission if it's a new employee
        if (!isEditMode) {
          setFormData(initialEmployee);
          setServiceDisciplinaryActions([[]]);
          setServiceLeaves([[]]);
        }
      }
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "An error occurred while saving the record", {
        position: "top-center",
        autoClose: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  // Confirmation Modal Component
  const ConfirmationModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full">
        <h3 className="text-lg font-bold mb-4">Please confirm</h3>
        <p className="mb-6">Please read carefully before submitting:</p>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <p>Are you sure you want to {isEditMode ? 'update' : 'create'} this employee record?</p>
          <p className="text-sm text-gray-600 mt-2">Please verify all information is correct before proceeding.</p>
        </div>
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => setShowConfirm(false)}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmSubmit}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Yes, Confirm'}
          </button>
        </div>
      </div>
    </div>
  );

  // ================= LOADING STATE =================
  if (dataLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[80vh]">
        <Loader2 className="animate-spin text-judiciary-600 mb-4" size={64} />
        <p className="text-gray-500 font-medium">Loading Employee Form...</p>
      </div>
    );
  }

  // Safe access to designations with fallback
  const currentDesignation = designations?.find((d: Designation) => String(d.id) === String(formData.employmentHistory[0]?.designationId));

  return (
    <div className="max-w-7xl mx-auto pb-16 px-4">
      {/* Header - Simplified */}
      <div className="flex items-center gap-3 mb-6 pt-4">
        <button
          type="button"
          onClick={() => navigate('/employees')}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{isEditMode ? 'Edit Employee Record' : 'New Employee Registration'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isEditMode ? 'Update existing employee information' : 'Create new employee record'}
          </p>
        </div>
      </div>
      {/* Rejoin Preview Banner (appears when ?action=rejoin) */}
      {rejoinPreview && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md mb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-yellow-800">Rejoin Preview</p>
              <p className="text-sm text-yellow-700 mt-1">Detected previous status <strong className="uppercase">{rejoinPreview.prevStatus}</strong> (started {rejoinPreview.prevStatusDate || 'N/A'}).</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-[12px] text-yellow-800">Rejoin Date</label>
                  <div className="relative group">
                    <div className="absolute left-2 top-1.5 text-yellow-600 z-10 pointer-events-none">
                      <Calendar size={12} />
                    </div>
                    <input
                      type="text"
                      value={formatToDisplayDate(rejoinPreview.rejoinDate)}
                      onChange={(e) => {
                        const val = e.target.value;
                        const masked = applyDateMask(val);
                        setRejoinPreview(prev => {
                          if (!prev) return prev;
                          const prevStatusDate = prev.prevStatusDate || '';
                          // For rejoin date calculation, only update absent days if we have a valid full date
                          let absent = prev.absentDays;
                          const parsed = parseDisplayDate(masked);
                          if (parsed) {
                            const rejoinTs = new Date(parsed).getTime();
                            const dayBeforeRejoin = formatDateForInput(new Date(rejoinTs - 86400000).toISOString());
                            absent = prevStatusDate ? calculateDaysDifference(prevStatusDate, dayBeforeRejoin) : 0;
                          }
                          return { ...prev, rejoinDate: masked, absentDays: absent };
                        });
                      }}
                      placeholder="dd/mm/yyyy"
                      className="pl-7 pr-3 py-1 rounded border border-yellow-200 text-sm bg-white"
                    />
                  </div>
                </div>
                <div className="text-xs text-yellow-700">Duration of absence: <strong>{rejoinPreview.absentDays} day{rejoinPreview.absentDays !== 1 ? 's' : ''}</strong></div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-[12px] text-yellow-800">Order Number (optional)</label>
                  <input type="text" value={rejoinPreview.orderNumber || ''} onChange={(e) => setRejoinPreview(prev => prev ? ({ ...prev, orderNumber: e.target.value }) : prev)} className="w-full mt-1 px-2 py-1 rounded border border-yellow-200 text-sm" />
                </div>
                <div>
                  <label className="text-[12px] text-yellow-800">Order Date (optional)</label>
                  <div className="relative group">
                    <div className="absolute left-2 top-1.5 text-yellow-600 z-10 pointer-events-none">
                      <Calendar size={12} />
                    </div>
                    <input
                      type="text"
                      value={formatToDisplayDate(rejoinPreview.orderDate || '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        const masked = applyDateMask(val);
                        setRejoinPreview(prev => prev ? ({ ...prev, orderDate: masked }) : prev);
                      }}
                      placeholder="dd/mm/yyyy"
                      className="w-full pl-7 pr-3 py-1 rounded border border-yellow-200 text-sm bg-white"
                    />
                  </div>

                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => {
                // Cancel preview
                setRejoinPreview(null);
                // Remove action param from URL without reloading
                try { const sp = new URLSearchParams(window.location.search); sp.delete('action'); window.history.replaceState({}, '', `${window.location.pathname}?${sp.toString()}`); } catch (e) { }
              }} className="px-3 py-2 bg-white border rounded text-sm text-gray-700">Dismiss</button>
              <button type="button" onClick={() => {
                if (!rejoinPreview) return;
                setShowRejoinConfirm(true);
              }} className="px-3 py-2 bg-yellow-600 text-white rounded text-sm">Apply Rejoin</button>
            </div>
          </div>
        </div>
      )}

      {rejoinPreview && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <h3 className="font-semibold text-gray-800 mb-3">Rejoin Summary (preview)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 border rounded bg-gray-50">
              <div className="text-sm font-bold text-gray-700 mb-1">Previous Record (will be closed)</div>
              <div className="text-xs text-gray-600">Status: <strong>{rejoinPreview.prevStatus}</strong></div>
              <div className="text-xs text-gray-600">Posting: <strong>{formData.employmentHistory?.[rejoinPreview.prevIndex]?.postingPlaceTitle || '—'}</strong></div>
              <div className="text-xs text-gray-600">From: <strong>{formatDateForInput(formData.employmentHistory?.[rejoinPreview.prevIndex]?.fromDate || '') || '—'}</strong></div>
              <div className="text-xs text-gray-600">To (current): <strong className={`${formData.employmentHistory?.[rejoinPreview.prevIndex]?.toDate ? 'line-through text-gray-400' : ''}`}>{formatDateForInput(formData.employmentHistory?.[rejoinPreview.prevIndex]?.toDate || '—')}</strong></div>
              <div className="text-xs text-gray-600">To (will be): <strong>{formatDateForInput(new Date(new Date(rejoinPreview.rejoinDate).getTime() - 86400000).toISOString())}</strong></div>
            </div>

            <div className="p-3 border rounded bg-white">
              <div className="text-sm font-bold text-gray-700 mb-1">New In-Service (will be added)</div>
              <div className="text-xs text-gray-600">Status: <strong>In-Service</strong></div>
              <div className="text-xs text-gray-600">From: <strong>{rejoinPreview.rejoinDate}</strong></div>
              <div className="text-xs text-gray-600">Posting (suggested): <strong>{formData.employmentHistory?.[rejoinPreview.prevIndex]?.postingPlaceTitle || '—'}</strong></div>
              <div className="text-xs text-gray-600">Order #: <strong>{rejoinPreview.orderNumber || '—'}</strong></div>
              <div className="text-xs text-gray-600">Order Date: <strong>{rejoinPreview.orderDate || '—'}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* Rejoin Confirm Modal */}
      {showRejoinConfirm && rejoinPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 my-8">
            <h3 className="text-xl font-bold mb-4 text-judiciary-800 border-b pb-2">Confirm Employee Rejoin</h3>
            <p className="text-sm text-gray-700 mb-4">
              You are rejoining <strong>{formData.fullName}</strong>. This will close the "<strong>{rejoinPreview.prevStatus}</strong>" period and start a new <strong>In-Service</strong> record.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="col-span-1 md:col-span-2 bg-blue-50 p-3 rounded border border-blue-100 mb-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700 font-medium">Rejoin Date:</span>
                  <input
                    type="date"
                    value={rejoinPreview.rejoinDate}
                    onChange={(e) => setRejoinPreview({ ...rejoinPreview, rejoinDate: e.target.value })}
                    className="border border-blue-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">HQ</label>
                <select
                  value={rejoinPreview.hqId}
                  onChange={(e) => setRejoinPreview({ ...rejoinPreview, hqId: e.target.value, tehsilId: '0' })}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="0">Select HQ</option>
                  {headquarters.filter(h => h.status === 'Active').map(h => <option key={h.id} value={h.id}>{h.title}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tehsil</label>
                <select
                  value={rejoinPreview.tehsilId}
                  onChange={(e) => setRejoinPreview({ ...rejoinPreview, tehsilId: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  disabled={!rejoinPreview.hqId || rejoinPreview.hqId === '0'}
                >
                  <option value="0">Select Tehsil</option>
                  {tehsils.filter(t => t.hqId === rejoinPreview.hqId && t.status === 'Active').map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                <select
                  value={rejoinPreview.postingCategoryId}
                  onChange={(e) => setRejoinPreview({ ...rejoinPreview, postingCategoryId: e.target.value, unitId: '0' })}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="0">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Unit</label>
                <select
                  value={rejoinPreview.unitId}
                  onChange={(e) => setRejoinPreview({ ...rejoinPreview, unitId: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  disabled={!rejoinPreview.postingCategoryId || rejoinPreview.postingCategoryId === '0'}
                >
                  <option value="0">Select Unit</option>
                  {units.filter(u => u.categoryId === rejoinPreview.postingCategoryId && u.status === 'Active').map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
                </select>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Posting Place Title</label>
                <input
                  type="text"
                  value={rejoinPreview.postingPlaceTitle}
                  onChange={(e) => setRejoinPreview({ ...rejoinPreview, postingPlaceTitle: e.target.value })}
                  placeholder="e.g. Court of Civil Judge Class-1"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Designation</label>
                <select
                  value={rejoinPreview.designationId}
                  onChange={(e) => setRejoinPreview({ ...rejoinPreview, designationId: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="0">Select Designation</option>
                  {designations.filter(d => d.status === 'Active').map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">BPS</label>
                <select
                  value={rejoinPreview.bps}
                  onChange={(e) => setRejoinPreview({ ...rejoinPreview, bps: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">Select BPS</option>
                  {Array.from({ length: 22 }, (_, i) => `BPS-${i + 1}`).map(bps => <option key={bps} value={bps}>{bps}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Order #</label>
                <input
                  type="text"
                  value={rejoinPreview.orderNumber}
                  onChange={(e) => setRejoinPreview({ ...rejoinPreview, orderNumber: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Order Date</label>
                <input
                  type="date"
                  value={rejoinPreview.orderDate}
                  onChange={(e) => setRejoinPreview({ ...rejoinPreview, orderDate: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => setShowRejoinConfirm(false)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!rejoinPreview) return;
                  const preview = rejoinPreview;
                  const empId = id || formData.id;
                  setIsLoading(true);
                  try {
                    await api.rehireEmployee(empId, {
                      previousStatus: preview.prevStatus || null,
                      previousStatusDate: preview.prevStatusDate || null,
                      previousToDate: preview.rejoinDate || null,
                      orderNumber: preview.orderNumber || null,
                      orderDate: preview.orderDate || null,
                      postingPlaceTitle: preview.postingPlaceTitle || null,
                      hqId: preview.hqId || '0',
                      tehsilId: preview.tehsilId || '0',
                      postingCategoryId: preview.postingCategoryId || '0',
                      unitId: preview.unitId || '0',
                      designationId: preview.designationId || '0',
                      bps: preview.bps || null
                    });

                    setShowRejoinConfirm(false);
                    const updated = await api.getEmployeeById(empId);
                    if (updated) {
                      setFormData(updated);
                      // Update disciplinary and leaves state if needed
                      // (omitted for brevity, or kept as in your current code)
                      toast.success('Employee rejoined successfully');
                    }
                  } catch (err: any) {
                    toast.error(err?.message || 'Failed to save rejoin');
                  } finally {
                    setIsLoading(false);
                    setRejoinPreview(null);
                  }
                }}
                className="px-6 py-2 bg-judiciary-600 text-white rounded-lg hover:bg-judiciary-700 shadow-md font-bold"
              >
                Confirm & Rejoin
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ================= PERSONAL INFORMATION ================= */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <User size={18} className="text-gray-600" />
              <h2 className="font-semibold text-gray-800">Basic Information</h2>
            </div>
          </div>

          <div className="p-5">
            {/* Inline Layout: Photo + Personal Details Side by Side */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Photo Section - Now inline with form */}
              <div className="lg:w-1/4">
                <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 flex flex-col items-center h-full">
                  <div className="relative group cursor-pointer mb-4 w-full" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-32 h-32 mx-auto rounded-lg bg-gray-100 overflow-hidden border-4 border-white shadow-sm">
                      {formData.photoUrl ? (
                        <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                          <User size={40} strokeWidth={1} />
                          <span className="text-xs mt-2">Upload Photo</span>
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="text-white" size={20} />
                    </div>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                  <h4 className="font-semibold text-gray-800 text-center mb-1 text-sm">{formData.fullName || 'Employee Name'}</h4>
                  <p className="text-xs text-gray-500 text-center mb-4">
                    {currentDesignation?.title || formData.employmentHistory[0]?.designationId || 'No designation'}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-200 transition text-xs font-medium flex items-center justify-center gap-2"
                  >
                    <Camera size={12} />
                    {formData.photoUrl ? 'Change Photo' : 'Upload Photo'}
                  </button>

                  {/* Additional fields in the photo column to use empty space */}
                  <div className="w-full mt-6 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Gender</label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handlePersonalChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                      >
                        {GENDER_OPTIONS?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>) || <option value="">Loading...</option>}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Marital Status</label>
                      <select
                        name="martialStatus"
                        value={formData.martialStatus}
                        onChange={handlePersonalChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                      >
                        <option value="">Select Status</option>
                        {MARITAL_STATUS_OPTIONS?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>) || <option value="">Loading...</option>}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Religion</label>
                      <select
                        name="religion"
                        value={formData.religion}
                        onChange={handlePersonalChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                      >
                        <option value="">Select Religion</option>
                        {RELIGION_OPTIONS?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>) || <option value="">Loading...</option>}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Domicile District</label>
                      <select
                        name="domicile"
                        value={formData.domicile}
                        onChange={handlePersonalChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                      >
                        <option value="">Select Domicile</option>
                        {DOMICILES?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>) || <option value="">Loading...</option>}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Info Fields - Now 3/4 width */}
              <div className="lg:w-3/4 space-y-2">
                {/* Section 1: Personal Details - 3 columns per row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      CNIC (With Dashes) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="cnic"
                      value={formData.cnic}
                      onChange={handlePersonalChange}
                      onBlur={async () => {
                        if (!formData.cnic || fieldErrors.cnic) return;
                        try {
                          setIsCheckingCnic(true);
                          const res = await api.checkCnic(formData.cnic, isEditMode ? formData.id : undefined);
                          if (res.exists) {
                            setFieldErrors(prev => ({
                              ...prev,
                              cnicDuplicate: 'Cnic already exist'
                            }));
                          } else {
                            setFieldErrors(prev => ({ ...prev, cnicDuplicate: undefined }));
                          }
                        } catch {
                          // ignore soft validation failures
                        } finally {
                          setIsCheckingCnic(false);
                        }
                      }}
                      placeholder="36302-1234567-1"
                      required
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition ${fieldErrors.cnic || fieldErrors.cnicDuplicate ? 'border-red-500' : 'border-gray-300'
                        }`}
                    />
                    <div className="min-h-4 mt-0.5">
                      {(fieldErrors.cnic || fieldErrors.cnicDuplicate) && (
                        <p className="text-xs text-red-600">
                          {fieldErrors.cnic || fieldErrors.cnicDuplicate}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handlePersonalChange}
                      placeholder="e.g. Muhammad Ali"
                      required
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition ${fieldErrors.fullName ? 'border-red-500' : 'border-gray-300'
                        }`}
                    />
                    <div className="min-h-4 mt-0.5">
                      {fieldErrors.fullName && (
                        <p className="text-xs text-red-600">{fieldErrors.fullName}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Father Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="fatherName"
                      value={formData.fatherName}
                      onChange={handlePersonalChange}
                      required
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition ${fieldErrors.fatherName ? 'border-red-500' : 'border-gray-300'
                        }`}
                    />
                    <div className="min-h-4 mt-0.5">
                      {fieldErrors.fatherName && (
                        <p className="text-xs text-red-600">{fieldErrors.fatherName}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Date of Birth <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute left-3 top-2.5 text-gray-400 z-10 pointer-events-none">
                        <Calendar size={16} />
                      </div>
                      <input
                        type="text"
                        value={formatToDisplayDate(formData.dob)}
                        onChange={(e) => {
                          const val = e.target.value;
                          const masked = applyDateMask(val);
                          handlePersonalChange({ target: { name: 'dob', value: masked } } as any);
                        }}
                        placeholder="dd/mm/yyyy"
                        className={`w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition ${fieldErrors.dob ? 'border-red-500' : 'border-gray-300'}`}
                      />
                    </div>
                    <div className="min-h-4 mt-0.5">
                      {fieldErrors.dob && (
                        <p className="text-xs text-red-600">{fieldErrors.dob}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-700">
                        Date of First Appointment <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <span>Min Age (years):</span>
                        <input
                          type="number"
                          value={minAppointmentAge}
                          onChange={(e) => {
                            const v = parseInt(e.target.value || '0', 10);
                            const safe = isNaN(v) || v <= 0 ? 18 : v;
                            setMinAppointmentAge(safe);
                            if (formData.dateOfAppointment) {
                              const minDate = getDobPlusAge(formatDateForInput(formData.dob), safe);
                              let msg: string | undefined;
                              const doaVal = formatDateForInput(formData.dateOfAppointment);
                              if (minDate && doaVal < minDate) {
                                msg = `DOA must be at least ${safe} years after DOB`;
                              }
                              setFieldErrors(prev => ({ ...prev, dateOfAppointment: msg }));
                            }
                          }}
                          className="w-10 border border-gray-300 rounded px-1 py-0.5 text-[10px]"
                          min={1}
                        />
                      </div>
                    </div>
                    <div className="relative group">
                      <div className="absolute left-3 top-2.5 text-gray-400 z-10 pointer-events-none">
                        <Calendar size={16} />
                      </div>
                      <input
                        type="text"
                        value={formatToDisplayDate(formData.dateOfAppointment)}
                        onChange={(e) => {
                          const val = e.target.value;
                          const masked = applyDateMask(val);
                          handlePersonalChange({ target: { name: 'dateOfAppointment', value: masked } } as any);
                        }}
                        placeholder="dd/mm/yyyy"
                        className={`w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition ${fieldErrors.dateOfAppointment ? 'border-red-500' : 'border-gray-300'}`}
                      />
                    </div>
                    <div className="min-h-4 mt-0.5">
                      {fieldErrors.dateOfAppointment && (
                        <p className="text-xs text-red-600">{fieldErrors.dateOfAppointment}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Highest Qualification Level <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="qualificationId"
                      value={formData.qualificationId}
                      onChange={handlePersonalChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                    >
                      <option value="">Select Qualification Level</option>
                      {qualifications?.map((q: any) => <option key={q.id} value={q.id}>{q.degreeTitle}</option>) || <option value="">Loading...</option>}
                    </select>
                    <div className="min-h-4 mt-0.5"></div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Degree Title / Major Subject</label>
                    <input
                      name="degreeTitle"
                      value={formData.degreeTitle}
                      onChange={handlePersonalChange}
                      placeholder="e.g. BS Computer Science"
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition ${fieldErrors.degreeTitle ? 'border-red-500' : 'border-gray-300'
                        }`}
                    />
                    <div className="min-h-4 mt-0.5">
                      {fieldErrors.degreeTitle && (
                        <p className="text-xs text-red-600">{fieldErrors.degreeTitle}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 2: Contact & Address */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Primary Contact (Mobile) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone size={14} className="absolute left-3 top-2.5 text-gray-400" />
                        <input
                          name="contactPrimary"
                          value={formData.contactPrimary}
                          onChange={handlePersonalChange}
                          className={`w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition ${fieldErrors['contactPrimary'] ? 'border-red-500' : 'border-gray-300'
                            }`}
                          placeholder="0300-1234567"
                          required
                        />
                      </div>
                      <div className="min-h-4 mt-0.5">
                        {fieldErrors['contactPrimary'] && (
                          <p className="text-xs text-red-600">{fieldErrors['contactPrimary']}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Secondary Contact</label>
                      <div className="relative">
                        <Phone size={14} className="absolute left-3 top-2.5 text-gray-400" />
                        <input
                          name="contactSecondary"
                          value={formData.contactSecondary || ''}
                          onChange={handlePersonalChange}
                          className={`w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition ${fieldErrors['contactSecondary'] ? 'border-red-500' : 'border-gray-300'
                            }`}
                          placeholder="0321-7654321"
                        />
                      </div>
                      <div className="min-h-4 mt-0.5">
                        {fieldErrors['contactSecondary'] && (
                          <p className="text-xs text-red-600">{fieldErrors['contactSecondary']}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Permanent Address */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Permanent Address</label>
                  <textarea
                    name="addressPermanent"
                    value={formData.addressPermanent || ''}
                    onChange={handlePersonalChange}
                    rows={3}
                    placeholder="House #, Street, Area, City"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                  />
                </div>

                {/* Temporary Address */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-gray-700">Temporary Address</label>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="sameAsPermanent"
                        name="sameAsPermanent"
                        checked={formData.sameAsPermanent}
                        onChange={handlePersonalChange}
                        className="w-3.5 h-3.5 accent-judiciary-600 mr-2"
                      />
                      <label htmlFor="sameAsPermanent" className="text-xs text-gray-600">
                        Same as Permanent Address
                      </label>
                    </div>
                  </div>
                  <textarea
                    name="addressTemporary"
                    value={formData.sameAsPermanent
                      ? (formData.addressPermanent || '')
                      : (formData.addressTemporary || '')}
                    onChange={handlePersonalChange}
                    rows={3}
                    placeholder={formData.sameAsPermanent
                      ? "Same as permanent address"
                      : "House #, Street, Area, City"}
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition ${formData.sameAsPermanent ? 'bg-gray-50' : ''
                      }`}
                    disabled={formData.sameAsPermanent}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= SERVICE HISTORY ================= */}
        {formData.employmentHistory.map((service, serviceIndex) => {
          const { isExit, dateLabel } = getStatusConfig(service.status);

          return (
            <div key={serviceIndex} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Briefcase size={18} className="text-orange-600" />
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      Service History #{serviceIndex + 1}
                      {service.isCurrentlyWorking && (
                        <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          Current Posting
                        </span>
                      )}
                    </h3>
                  </div>
                </div>
                {formData.employmentHistory.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeServiceBlock(serviceIndex)}
                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 transition text-xs font-medium flex items-center gap-1.5"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>

              <div className="p-5 space-y-6">
                {/* Section 1: Posting Details */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wider">Posting Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Posting Place Title (Combo-box with suggestions) */}
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Posting Place Title <span className="text-red-500">*</span>
                      </label>
                      <ComboBox
                        id={`posting-${serviceIndex}`}
                        options={postingPlaceOptions}
                        value={service.postingPlaceTitle || ''}
                        onChange={(val: string) => handleServiceChange(serviceIndex, 'postingPlaceTitle', val)}
                        placeholder="e.g., District Court Multan"
                        className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition`}
                        error={!!fieldErrors[`postingPlaceTitle_${serviceIndex}`]}
                      />
                      <div className="min-h-4 mt-0.5">
                        {fieldErrors[`postingPlaceTitle_${serviceIndex}`] && (
                          <p className="text-xs text-red-600">{fieldErrors[`postingPlaceTitle_${serviceIndex}`]}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Headquarter <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={service.hqId}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleServiceChange(serviceIndex, 'hqId', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                      >
                        <option value="">Select Headquarter</option>
                        {headquarters?.map((h: any) => (
                          <option key={h.id} value={h.id}>{h.title}</option>
                        )) || <option value="">Loading...</option>}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Tehsil</label>
                      <select
                        value={service.tehsilId}
                        disabled={!service.hqId}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleServiceChange(serviceIndex, 'tehsilId', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">Select Tehsil</option>
                        {tehsils
                          ?.filter((t: any) => String(t.hqId) === String(service.hqId))
                          ?.map((t: any) => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                          )) || <option value="">Select HQ first</option>}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Category</label>
                      <select
                        value={service.postingCategoryId}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleServiceChange(serviceIndex, 'postingCategoryId', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                      >
                        <option value="">Select Category</option>
                        {categories?.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        )) || <option value="">Loading...</option>}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Unit / Court</label>
                      <select
                        value={service.unitId}
                        disabled={!service.postingCategoryId}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleServiceChange(serviceIndex, 'unitId', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">Select Unit/Court</option>
                        {units
                          ?.filter((u: any) => String(u.categoryId) === String(service.postingCategoryId))
                          ?.map((u: any) => (
                            <option key={u.id} value={u.id}>{u.title}</option>
                          )) || <option value="">Select category first</option>}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Designation <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={service.designationId}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleServiceChange(serviceIndex, 'designationId', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                      >
                        <option value="">Select Designation</option>
                        {designations?.map((d: any) => (
                          <option key={d.id} value={d.id}>{d.title}</option>
                        )) || <option value="">Loading...</option>}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">BPS Grade</label>
                      <select
                        value={service.bps}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleServiceChange(serviceIndex, 'bps', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                      >
                        <option value="">Select BPS</option>
                        {BPS_GRADES?.map((b: string) => (
                          <option key={b} value={b}>{b}</option>
                        )) || <option value="">Loading...</option>}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 2: Service Timeline */}
                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wider">Service Timeline</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
                      <select
                        value={service.status}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleServiceChange(serviceIndex, 'status', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                      >
                        <option value="">Select Status</option>
                        {STATUS_OPTIONS?.map((status: string) => (
                          <option key={status} value={status}>{status}</option>
                        )) || <option value="">Loading...</option>}
                      </select>
                    </div>

                    {/* CONDITIONAL RENDERING BASED ON STATUS */}
                    {isExit ? (
                      <div className="lg:col-span-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                          {dateLabel} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative group">
                          <div className="absolute left-3 top-2.5 text-gray-400 z-10 pointer-events-none">
                            <Calendar size={14} />
                          </div>
                          <input
                            type="text"
                            value={formatToDisplayDate(service.statusDate || '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              const masked = applyDateMask(val);
                              handleServiceChange(serviceIndex, 'statusDate', masked);
                            }}
                            placeholder="dd/mm/yyyy"
                            className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">From Date <span className="text-red-500">*</span></label>
                          <div className="relative group">
                            <div className="absolute left-3 top-2.5 text-gray-400 z-10 pointer-events-none">
                              <Calendar size={14} />
                            </div>
                            <input
                              type="text"
                              value={formatToDisplayDate(service.fromDate)}
                              onChange={(e) => {
                                const val = e.target.value;
                                const masked = applyDateMask(val);
                                handleServiceChange(serviceIndex, 'fromDate', masked);
                              }}
                              placeholder="dd/mm/yyyy"
                              className={`w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition ${fieldErrors[`fromDate_${serviceIndex}`] ? 'border-red-500' : 'border-gray-300'}`}
                            />
                          </div>
                          <div className="min-h-4 mt-0.5">
                            {fieldErrors[`fromDate_${serviceIndex}`] && (
                              <p className="text-xs text-red-600">{fieldErrors[`fromDate_${serviceIndex}`]}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">To Date</label>
                          <div className="relative group">
                            <div className="absolute left-3 top-2.5 text-gray-400 z-10 pointer-events-none">
                              <Calendar size={14} />
                            </div>
                            <input
                              type="text"
                              value={formatToDisplayDate(service.toDate || '')}
                              onChange={(e) => {
                                const val = e.target.value;
                                const masked = applyDateMask(val);
                                handleServiceChange(serviceIndex, 'toDate', masked);
                              }}
                              placeholder="dd/mm/yyyy"
                              disabled={service.isCurrentlyWorking}
                              className={`w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition ${service.isCurrentlyWorking ? 'bg-gray-50 text-gray-400' : ''}`}
                            />
                          </div>
                        </div>

                        <div className="flex items-center pt-6">
                          <input
                            type="checkbox"
                            id={`current-${serviceIndex}`}
                            checked={service.isCurrentlyWorking}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleServiceChange(serviceIndex, 'isCurrentlyWorking', e.target.checked)}
                            className="w-3.5 h-3.5 accent-judiciary-600 mr-2 cursor-pointer"
                          />
                          <label htmlFor={`current-${serviceIndex}`} className="text-xs font-medium text-gray-700 cursor-pointer">
                            Mark as Current Posting
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Section 3: Remarks */}
                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Remarks</label>
                  <textarea
                    value={service.statusRemarks || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleServiceChange(serviceIndex, 'statusRemarks', e.target.value)}
                    rows={2}
                    placeholder="Any additional remarks about this posting (e.g., special duties, achievements, etc.)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                  />
                </div>

                {/* ================= DISCIPLINARY ACTIONS FOR THIS SERVICE ================= */}
                {serviceDisciplinaryActions[serviceIndex]?.length > 0 && (
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Shield size={14} className="text-red-600" />
                        Disciplinary Actions
                      </h4>
                      <span className="text-xs text-gray-500">
                        {serviceDisciplinaryActions[serviceIndex]?.length || 0} action(s)
                      </span>
                    </div>

                    {serviceDisciplinaryActions[serviceIndex]?.map((action, actionIndex) => (
                      <div key={action.id} className="bg-red-50 rounded-lg border border-red-100 p-4 mb-3 last:mb-0">
                        <div className="flex justify-between items-center mb-3">
                          <h5 className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                            <FileText size={12} />
                            Action #{actionIndex + 1}
                          </h5>
                          <button
                            type="button"
                            onClick={() => removeDisciplinaryAction(serviceIndex, actionIndex)}
                            className="px-2 py-1 bg-red-100 text-red-600 rounded border border-red-200 hover:bg-red-200 transition text-xs font-medium flex items-center gap-1"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Complaint/Inquiry No.</label>
                            <input
                              type="text"
                              value={action.complaint || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateDisciplinaryAction(serviceIndex, actionIndex, 'complaint', e.target.value)}
                              placeholder="e.g., INQ-2023-001"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Allegation</label>
                            <input
                              type="text"
                              value={action.allegation || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateDisciplinaryAction(serviceIndex, actionIndex, 'allegation', e.target.value)}
                              placeholder="Describe the allegation"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Inquiry Status</label>
                            <div className="flex items-center gap-2">
                              <select
                                value={action.inquiryStatus || 'Pending'}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateDisciplinaryAction(serviceIndex, actionIndex, 'inquiryStatus', e.target.value)}
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                              >
                                <option value="Pending">Pending</option>
                                <option value="Decided">Decided</option>
                              </select>
                              <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm">
                                <input
                                  type="checkbox"
                                  id={`pending-chk-${serviceIndex}-${actionIndex}`}
                                  checked={action.inquiryStatus === 'Pending'}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    updateDisciplinaryAction(serviceIndex, actionIndex, 'inquiryStatus', e.target.checked ? 'Pending' : 'Decided');
                                  }}
                                  className="w-4 h-4 accent-judiciary-600 rounded cursor-pointer"
                                />
                                <label
                                  htmlFor={`pending-chk-${serviceIndex}-${actionIndex}`}
                                  className="text-[10px] font-bold text-gray-700 uppercase cursor-pointer select-none"
                                >
                                  Pending?
                                </label>
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Court Name</label>
                            <input
                              type="text"
                              value={action.courtName || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateDisciplinaryAction(serviceIndex, actionIndex, 'courtName', e.target.value)}
                              placeholder="Enter Court Name"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                            />
                          </div>

                          {action.inquiryStatus === 'Decided' ? (
                            <>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Inquiry Decided Date (Optional)</label>
                                <div className="relative group">
                                  <div className="absolute left-3 top-2 text-gray-400 z-10 pointer-events-none">
                                    <Calendar size={14} />
                                  </div>
                                  <input
                                    type="text"
                                    value={formatToDisplayDate(action.decisionDate || '')}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const masked = applyDateMask(val);
                                      updateDisciplinaryAction(serviceIndex, actionIndex, 'decisionDate', masked);
                                    }}
                                    placeholder="dd/mm/yyyy"
                                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Decision Details</label>
                                <input
                                  type="text"
                                  value={action.decision || ''}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateDisciplinaryAction(serviceIndex, actionIndex, 'decision', e.target.value)}
                                  placeholder="Decision details"
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                                />
                              </div>
                            </>
                          ) : null}

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Inquiry Start Date (Required)</label>
                            <div className="relative group">
                              <div className="absolute left-3 top-2 text-gray-400 z-10 pointer-events-none">
                                <Calendar size={14} />
                              </div>
                              <input
                                type="text"
                                value={formatToDisplayDate(action.actionDate || '')}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const masked = applyDateMask(val);
                                  updateDisciplinaryAction(serviceIndex, actionIndex, 'actionDate', masked);
                                }}
                                placeholder="dd/mm/yyyy"
                                className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                          <textarea
                            value={action.remarks || ''}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateDisciplinaryAction(serviceIndex, actionIndex, 'remarks', e.target.value)}
                            rows={2}
                            placeholder="Additional remarks..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ================= LEAVES FOR THIS SERVICE ================= */}
                {serviceLeaves[serviceIndex]?.length > 0 && (
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Award size={14} className="text-green-600" />
                        Leave Records
                      </h4>
                      <span className="text-xs text-gray-500">
                        {serviceLeaves[serviceIndex]?.length || 0} leave(s)
                      </span>
                    </div>

                    {serviceLeaves[serviceIndex]?.map((leave, leaveIndex) => (
                      <div key={leave.id} className="bg-green-50 rounded-lg border border-green-100 p-4 mb-3 last:mb-0">
                        <div className="flex justify-between items-center mb-3">
                          <h5 className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                            <Coffee size={12} />
                            Leave #{leaveIndex + 1}
                            {leave.days > 0 && <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">{leave.days} days</span>}
                          </h5>
                          <button
                            type="button"
                            onClick={() => removeLeave(serviceIndex, leaveIndex)}
                            className="px-2 py-1 bg-red-100 text-red-600 rounded border border-red-200 hover:bg-red-200 transition text-xs font-medium flex items-center gap-1"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Leave Type</label>
                            <select
                              value={leave.type}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateLeave(serviceIndex, leaveIndex, 'type', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                            >
                              <option value="">Select Leave Type</option>
                              {LEAVE_TYPES?.map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              )) || <option value="">Loading...</option>}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                            <div className="relative group">
                              <div className="absolute left-3 top-2.5 text-gray-400 z-10 pointer-events-none">
                                <Calendar size={14} />
                              </div>
                              <input
                                type="text"
                                value={formatToDisplayDate(leave.startDate)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const masked = applyDateMask(val);
                                  updateLeave(serviceIndex, leaveIndex, 'startDate', masked);
                                }}
                                placeholder="dd/mm/yyyy"
                                className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                            <div className="relative group">
                              <div className="absolute left-3 top-2.5 text-gray-400 z-10 pointer-events-none">
                                <Calendar size={14} />
                              </div>
                              <input
                                type="text"
                                value={formatToDisplayDate(leave.endDate)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const masked = applyDateMask(val);
                                  updateLeave(serviceIndex, leaveIndex, 'endDate', masked);
                                }}
                                placeholder="dd/mm/yyyy"
                                className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Days</label>
                            <input
                              type="number"
                              value={leave.days || 0}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLeave(serviceIndex, leaveIndex, 'days', parseInt(e.target.value) || 0)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                              min="0"
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                          <textarea
                            value={leave.remarks || ''}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateLeave(serviceIndex, leaveIndex, 'remarks', e.target.value)}
                            rows={2}
                            placeholder="Additional remarks about this leave..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-judiciary-500 transition"
                          />
                        </div>
                        {(fieldErrors[`leave_overlap_${serviceIndex}_${leaveIndex}`] || fieldErrors[`leave_${serviceIndex}_${leaveIndex}`]) && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
                            {fieldErrors[`leave_overlap_${serviceIndex}_${leaveIndex}`] && (
                              <p className="text-xs text-red-700 font-semibold">{fieldErrors[`leave_overlap_${serviceIndex}_${leaveIndex}`]}</p>
                            )}
                            {fieldErrors[`leave_${serviceIndex}_${leaveIndex}`] && (
                              <p className="text-xs text-red-700 font-semibold">{fieldErrors[`leave_${serviceIndex}_${leaveIndex}`]}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Buttons for This Service */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => addDisciplinaryAction(serviceIndex)}
                    disabled={service.status !== 'In-Service'}
                    className={`px-3 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition text-xs font-medium flex items-center gap-1.5 ${service.status !== 'In-Service' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <AlertTriangle size={12} />
                    Add Disciplinary Action
                  </button>

                  <button
                    type="button"
                    onClick={() => addLeave(serviceIndex)}
                    disabled={service.status !== 'In-Service'}
                    className={`px-3 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition text-xs font-medium flex items-center gap-1.5 ${service.status !== 'In-Service' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Coffee size={12} />
                    Add Leave Record
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Service Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={addServiceBlock}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-200 transition font-medium flex items-center gap-2 text-sm"
          >
            <Plus size={16} /> Add Another Service History
          </button>
        </div>

        {/* Summary and Submit Section - Simplified */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mt-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Save size={20} className="text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">Ready to {isEditMode ? 'Update' : 'Save'} Record</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p>✓ All required fields marked with <span className="text-red-500">*</span></p>
              <p>✓ At least one Service History is mandatory</p>
              <p>✓ Disciplinary and Leaves are optional per service</p>
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => navigate('/employees')}
              className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || isSubmitting}
              className="px-8 py-2.5 bg-judiciary-600 text-white rounded-lg hover:bg-judiciary-700 transition font-medium flex items-center gap-2 text-sm min-w-[160px] justify-center"
            >
              {isLoading || isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              {isEditMode ? 'Update Record' : 'Save Record'}
            </button>
          </div>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirm && <ConfirmationModal />}

      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
};

export default EmployeeForm;