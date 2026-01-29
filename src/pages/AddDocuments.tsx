import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Employee } from '../types';
import { ArrowLeft, X, FileText, CheckCircle, AlertCircle, Save, Upload, Loader2, FileJson, DollarSign, BarChart3, AlertTriangle } from 'lucide-react';

interface FileUploadItem {
  id: string;
  file: File;
  status: 'valid' | 'invalid';
  error?: string;
  relativePath?: string;
}

type DocumentCategory = 'pdf' | 'acr' | 'assets' | 'gpfund' | 'fbr' | null;

// ============================================
// SOFT-CODED ACR POLICY CONFIGURATION
// ============================================
// Government policy can be easily changed here without modifying core logic
const ACR_POLICY = {
  MIN_DURATION_MONTHS: 3,  // Minimum ACR period duration in months
  MAX_ACRS_PER_YEAR: 1,    // Maximum ACR records allowed per calendar year
  MIN_ACRS_REQUIRED: 4,    // Minimum number of ACRs required (for future validation)
  MUST_SAME_CALENDAR_YEAR: true,  // ACR period must start and end in same calendar year
  POLICY_NAME: 'Annual Confidential Report (ACR) Policy 2025',
  POLICY_VERSION: '1.0'
};

const AddDocuments: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileUploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docCategory, setDocCategory] = useState<DocumentCategory>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputSingleRef = React.useRef<HTMLInputElement>(null);
  const fileInputMultipleRef = React.useRef<HTMLInputElement>(null);

  // Form data states
  const [acrForm, setAcrForm] = useState({ year: '', periodFrom: '', periodTo: '', score: '', status: '', remarks: '', title: '' });
  const [assetsForm, setAssetsForm] = useState({ financialYear: '', submissionDate: '', status: 'Pending' });
  const [gpfundForm, setGpfundForm] = useState({ type: 'Advance', amount: '', date: '', description: '', isRefundable: true, monthlyInstallment: '', remainingAmount: '' });
  const [fbrForm, setFbrForm] = useState({ taxYear: '', filerStatus: '', submissionDate: '' });

  // ACR validation state
  const [acrValidation, setAcrValidation] = useState<{
    durationValid: boolean;
    durationError?: string;
    yearValid: boolean;
    yearError?: string;
    overlapValid: boolean;
    overlapError?: string;
    doaValid?: boolean;
    doaError?: string;
  }>({ durationValid: true, yearValid: true, overlapValid: true });

  // Assets validation state
  const [assetsValidation, setAssetsValidation] = useState<{ valid: boolean; error?: string }>({ valid: true });
  const [gpfundValidation, setGpfundValidation] = useState<{ valid: boolean; error?: string }>({ valid: true });
  const [fbrValidation, setFbrValidation] = useState<{ valid: boolean; error?: string }>({ valid: true });

  useEffect(() => {
    if (id) {
      setLoading(true);
      api.getEmployeeById(id)
        .then(emp => {
          if (emp) {
            setEmployee(emp);
            setError(null);
          } else {
            setError('Employee not found');
            setTimeout(() => navigate('/employees'), 2000);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('[AddDocuments] Error loading employee:', err);
          setError('Failed to load employee: ' + (err instanceof Error ? err.message : 'Unknown error'));
          setLoading(false);
        });
    } else {
      setError('No employee ID provided');
    }
  }, [id, navigate]);

  useEffect(() => {
    // console.log('[AddDocuments] docCategory changed to:', docCategory);
  }, [docCategory]);

  // Build financial year options like "2017-2018" (start from DOA year to current year)
  const getFinancialYearOptions = () => {
    const options: string[] = [];
    const currentYear = new Date().getFullYear();
    let startYear = currentYear - 5; // default start
    if (employee && employee.dateOfAppointment) {
      try {
        startYear = new Date(employee.dateOfAppointment).getFullYear();
      } catch (e) {
        startYear = currentYear - 5;
      }
    }
    // generate ranges from startYear up to currentYear (each option is "YYYY-YYYY+1")
    for (let y = startYear; y <= currentYear; y++) {
      options.push(`${y}-${y + 1}`);
    }
    return options.reverse();
  };

  const validateFileName = (name: string): { isValid: boolean, error?: string } => {
    if (!name.toLowerCase().endsWith('.pdf')) return { isValid: false, error: 'Only .pdf files are allowed' };
    const nameWithoutExt = name.slice(0, -4);
    if (nameWithoutExt.length < 3) return { isValid: false, error: 'Filename is too short (min 3 chars)' };
    if (!/[a-zA-Z]/.test(nameWithoutExt)) return { isValid: false, error: 'Filename must be descriptive' };
    return { isValid: true };
  };

  // ============================================
  // ACR PERIOD VALIDATION FUNCTIONS
  // ============================================

  /**
   * Calculate months between two dates
   */
  const getMonthsDifference = (from: string, to: string): number => {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const months = (toDate.getFullYear() - fromDate.getFullYear()) * 12 + (toDate.getMonth() - fromDate.getMonth());
    return months;
  };

  /**
   * Validate ACR period duration (must be >= 3 months)
   */
  const validateAcrDuration = (periodFrom: string, periodTo: string): { valid: boolean, error?: string } => {
    if (!periodFrom || !periodTo) return { valid: true }; // Skip if not both filled

    const months = getMonthsDifference(periodFrom, periodTo);
    if (months < ACR_POLICY.MIN_DURATION_MONTHS) {
      const minEndDate = new Date(periodFrom);
      minEndDate.setMonth(minEndDate.getMonth() + ACR_POLICY.MIN_DURATION_MONTHS);
      const minEndStr = minEndDate.toISOString().split('T')[0];
      return {
        valid: false,
        error: `ACR period must be at least ${ACR_POLICY.MIN_DURATION_MONTHS} months. Period from ${periodFrom} must end on or after ${minEndStr}.`
      };
    }
    return { valid: true };
  };

  /**
   * Validate ACR period stays within same calendar year
   */
  const validateAcrSameYear = (periodFrom: string, periodTo: string): { valid: boolean, error?: string } => {
    if (!periodFrom || !periodTo || !ACR_POLICY.MUST_SAME_CALENDAR_YEAR) return { valid: true };

    const fromYear = new Date(periodFrom).getFullYear();
    const toYear = new Date(periodTo).getFullYear();

    if (fromYear !== toYear) {
      return {
        valid: false,
        error: `ACR period must be within the same calendar year (${fromYear}). Period From: ${periodFrom} (${fromYear}) and Period To: ${periodTo} (${toYear}) span different years.`
      };
    }
    return { valid: true };
  };

  const validateAcrDoa = (periodFrom: string, periodTo: string): { valid: boolean, error?: string } => {
    if (!employee?.dateOfAppointment || (!periodFrom && !periodTo)) return { valid: true };
    const doa = new Date(employee.dateOfAppointment);
    if (periodFrom) {
      const from = new Date(periodFrom);
      if (from < doa) return { valid: false, error: `Period From cannot be before Date of Appointment (${employee.dateOfAppointment})` };
    }
    if (periodTo) {
      const to = new Date(periodTo);
      if (to < doa) return { valid: false, error: `Period To cannot be before Date of Appointment (${employee.dateOfAppointment})` };
    }
    return { valid: true };
  };

  /**
   * Check for overlapping ACR periods in database
   */
  const validateAcrOverlap = async (periodFrom: string, periodTo: string): Promise<{ valid: boolean, error?: string }> => {
    if (!periodFrom || !periodTo || !employee) return { valid: true };

    try {
      const result = await api.checkAcrOverlap(employee.id, periodFrom, periodTo);
      if (!result.canAdd) {
        return {
          valid: false,
          error: `Cannot add ACR: ${result.message} Already have: ${result.existingCount} ACR(s) for this period. Max allowed per year: ${ACR_POLICY.MAX_ACRS_PER_YEAR}`
        };
      }
      return { valid: true };
    } catch (err) {
      console.error('Overlap check error:', err);
      return { valid: true }; // Don't block on API error
    }
  };

  /**
   * Validate all ACR period constraints when dates change
   */
  const validateAcrPeriod = async (periodFrom: string, periodTo: string) => {
    const durationCheck = validateAcrDuration(periodFrom, periodTo);
    const yearCheck = validateAcrSameYear(periodFrom, periodTo);
    const doaCheck = validateAcrDoa(periodFrom, periodTo);
    const overlapCheck = await validateAcrOverlap(periodFrom, periodTo);

    setAcrValidation({
      durationValid: durationCheck.valid,
      durationError: durationCheck.error,
      yearValid: yearCheck.valid,
      yearError: yearCheck.error,
      overlapValid: overlapCheck.valid,
      overlapError: overlapCheck.error,
      doaValid: doaCheck.valid,
      doaError: doaCheck.error
    });
  };

  // Assets validation: submission date must be >= DOA
  const validateAssetsDate = (submissionDate: string) => {
    if (!submissionDate || !employee?.dateOfAppointment) return { valid: true };
    const doa = new Date(employee.dateOfAppointment);
    const sub = new Date(submissionDate);
    if (sub < doa) {
      return { valid: false, error: `Submission date cannot be before Date of Appointment (${employee.dateOfAppointment})` };
    }
    return { valid: true };
  };

  const validateDateNotBeforeDoa = (dateStr: string) => {
    if (!dateStr || !employee?.dateOfAppointment) return { valid: true };
    const doa = new Date(employee.dateOfAppointment);
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { valid: true };
    if (d < doa) return { valid: false, error: `Date cannot be before Date of Appointment (${employee.dateOfAppointment})` };
    return { valid: true };
  };

  // Calculate remaining amount based on amount, monthly installment and start date
  const calculateRemainingAmount = (amountVal: string | number, monthlyVal: string | number, startDateStr: string) => {
    const amount = amountVal === undefined || amountVal === '' ? NaN : parseFloat(String(amountVal));
    const monthly = monthlyVal === undefined || monthlyVal === '' ? NaN : parseFloat(String(monthlyVal));
    if (isNaN(amount) || isNaN(monthly) || !startDateStr) return '';

    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return '';

    const today = new Date();
    let months = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
    // if today's day is before the start day, don't count the current month as completed
    if (today.getDate() < start.getDate()) months -= 1;
    if (months < 0) months = 0;

    const paid = monthly * months;
    let remaining = amount - paid;
    if (remaining < 0) remaining = 0;
    return remaining.toFixed(2);
  };

  // Auto-update remainingAmount when amount, monthlyInstallment or date change
  React.useEffect(() => {
    const amt = gpfundForm.amount;
    const monthly = gpfundForm.monthlyInstallment;
    const date = gpfundForm.date;
    const calc = calculateRemainingAmount(amt, monthly, date);
    if (calc !== '') {
      setGpfundForm(prev => ({ ...prev, remainingAmount: calc }));
    }
    // if inputs are incomplete, leave remainingAmount as entered (do not overwrite with empty)
  }, [gpfundForm.amount, gpfundForm.monthlyInstallment, gpfundForm.date]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newItems: FileUploadItem[] = Array.from(files).map(file => {
      const validation = validateFileName(file.name);
      const rel = (file as any).webkitRelativePath || '';
      return {
        id: crypto.randomUUID(),
        file,
        status: validation.isValid ? 'valid' : 'invalid',
        error: validation.error,
        relativePath: rel
      };
    });
    setSelectedFiles(prev => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (itemId: string) => {
    setSelectedFiles(prev => prev.filter(item => item.id !== itemId));
    // Reset file inputs so the same file can be selected again
    if (fileInputSingleRef.current) fileInputSingleRef.current.value = '';
    if (fileInputMultipleRef.current) fileInputMultipleRef.current.value = '';
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const toBase64 = (file: File) => new Promise<string | ArrayBuffer | null>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  // Validate form fields based on category
  const isFormValid = () => {
    if (docCategory === 'pdf') return true;
    if (docCategory === 'acr') {
      const { year, periodFrom, periodTo } = acrForm;
      // Must have required fields AND pass all ACR validations
      const hasRequired = year && periodFrom && periodTo;
      const passesValidation = acrValidation.durationValid && acrValidation.yearValid && acrValidation.overlapValid && (acrValidation.doaValid !== false);
      return hasRequired && passesValidation;
    }
    if (docCategory === 'assets') {
      const { financialYear, submissionDate } = assetsForm;
      return financialYear && submissionDate && assetsValidation.valid;
    }
    if (docCategory === 'gpfund') {
      const { type, amount, date } = gpfundForm;
      // If type is Advance, check if there's an existing active advance (remainingAmount > 0)
      if (type === 'Advance' && employee?.gpFundHistory && employee.gpFundHistory.length > 0) {
        const existingAdvances = employee.gpFundHistory.filter((gp: any) => gp.type === 'Advance' && gp.remainingAmount > 0);
        if (existingAdvances.length > 0) {
          return false; // Block new advance if one is still being paid
        }
      }
      return type && amount && date && gpfundValidation.valid;
    }
    if (docCategory === 'fbr') {
      const { taxYear, filerStatus, submissionDate } = fbrForm;
      return taxYear && filerStatus && submissionDate && fbrValidation.valid;
    }
    return false;
  };

  const handleUpload = async () => {
    if (!employee) return;

    if (!isFormValid()) {
      if (docCategory === 'gpfund' && gpfundForm.type === 'Advance' && employee?.gpFundHistory) {
        const existingAdvances = employee.gpFundHistory.filter((gp: any) => gp.type === 'Advance' && gp.remainingAmount > 0);
        if (existingAdvances.length > 0) {
          const remaining = existingAdvances[0].remainingAmount.toFixed(2);
          setError(`Cannot take new GP Fund Advance. Existing advance has remaining balance of ${remaining} PKR. Please clear it first.`);
          return;
        }
      }
      setError('Please fill all required fields');
      return;
    }

    const validFiles = selectedFiles.filter(f => f.status === 'valid');
    if (validFiles.length === 0) {
      setError('Please attach at least one document');
      return;
    }

    setUploading(true);
    try {
      const payload: any = {
        employeeId: employee.id,
        documentType: docCategory,
        documents: [],
        formData: {}
      };

      // Add form data based on category
      if (docCategory === 'acr') {
        payload.formData = acrForm;
      } else if (docCategory === 'assets') {
        payload.formData = assetsForm;
      } else if (docCategory === 'gpfund') {
        // convert numeric string fields to numbers where applicable
        const gp = {
          ...gpfundForm,
          amount: gpfundForm.amount ? parseFloat(String(gpfundForm.amount)) : undefined,
          monthlyInstallment: gpfundForm.monthlyInstallment ? parseFloat(String(gpfundForm.monthlyInstallment)) : undefined,
          remainingAmount: gpfundForm.remainingAmount ? parseFloat(String(gpfundForm.remainingAmount)) : undefined,
        };
        payload.formData = gp;
      } else if (docCategory === 'fbr') {
        payload.formData = fbrForm;
      }

      // Add documents
      for (const item of validFiles) {
        const base64 = await toBase64(item.file);
        if (typeof base64 === 'string') {
          payload.documents.push({
            fileName: item.file.name,
            fileType: 'application/pdf',
            fileSize: item.file.size,
            description: `${docCategory} upload`,
            url: base64,
            relativePath: item.relativePath || ''
          });
        }
      }

      if (payload.documents.length > 0) {
        await api.uploadDocuments(employee.id, payload.documents, {
          documentType: docCategory,
          formData: payload.formData
        });
        setUploadSuccess(true);
        setSelectedFiles([]);
        setTimeout(() => {
          navigate('/employees');
        }, 1500);
      }
    } catch (err) {
      console.error("Upload failed", err);
      setError("Failed to upload documents: " + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin text-judiciary-600 mx-auto mb-4" size={48} />
          <p className="text-gray-600">Loading employee information...</p>
        </div>
      </div>
    );
  }

  if (error && !uploadSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="text-red-600 mx-auto mb-4" size={48} />
          <p className="text-red-600 font-medium">{error}</p>
          <p className="text-gray-500 text-sm mt-2">Redirecting to employees list...</p>
        </div>
      </div>
    );
  }

  if (uploadSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <CheckCircle className="text-green-600 mx-auto mb-4" size={48} />
          <p className="text-green-600 font-medium text-lg">Documents uploaded successfully!</p>
          <p className="text-gray-500 text-sm mt-2">Redirecting to employee list...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="text-amber-600 mx-auto mb-4" size={48} />
          <p className="text-amber-600 font-medium">Employee data not available</p>
          <button onClick={() => navigate('/employees')} className="mt-4 px-4 py-2 bg-judiciary-600 text-white rounded-lg">
            Back to Employees
          </button>
        </div>
      </div>
    );
  }

  // Category Selection Modal
  if (!docCategory) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Select Document Type</h2>
            <button onClick={() => navigate('/employees')} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>

          <p className="text-gray-600 mb-8">What type of document would you like to upload for <span className="font-semibold">{employee.fullName}</span>?</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button type="button" onClick={() => setDocCategory('pdf')} className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 active:bg-blue-100 transition text-left group">
              <FileText className="text-blue-600 mb-3 group-hover:scale-110 transition" size={32} />
              <h3 className="font-bold text-gray-800 mb-1">PDF Documents</h3>
              <p className="text-sm text-gray-500">General documents only</p>
            </button>

            <button type="button" onClick={() => setDocCategory('acr')} className="p-6 border-2 border-gray-200 rounded-lg hover:border-green-600 hover:bg-green-50 active:bg-green-100 transition text-left group">
              <BarChart3 className="text-green-600 mb-3 group-hover:scale-110 transition" size={32} />
              <h3 className="font-bold text-gray-800 mb-1">ACR Records</h3>
              <p className="text-sm text-gray-500">Annual Confidential Reports</p>
            </button>

            <button type="button" onClick={() => setDocCategory('assets')} className="p-6 border-2 border-gray-200 rounded-lg hover:border-orange-600 hover:bg-orange-50 active:bg-orange-100 transition text-left group">
              <FileJson className="text-orange-600 mb-3 group-hover:scale-110 transition" size={32} />
              <h3 className="font-bold text-gray-800 mb-1">Assets Declaration</h3>
              <p className="text-sm text-gray-500">Asset and property records</p>
            </button>

            <button type="button" onClick={() => setDocCategory('gpfund')} className="p-6 border-2 border-gray-200 rounded-lg hover:border-purple-600 hover:bg-purple-50 active:bg-purple-100 transition text-left group">
              <DollarSign className="text-purple-600 mb-3 group-hover:scale-110 transition" size={32} />
              <h3 className="font-bold text-gray-800 mb-1">GP Fund Details</h3>
              <p className="text-sm text-gray-500">General Provident Fund records</p>
            </button>

            <button type="button" onClick={() => setDocCategory('fbr')} className="p-6 border-2 border-gray-200 rounded-lg hover:border-red-600 hover:bg-red-50 active:bg-red-100 transition text-left group">
              <BarChart3 className="text-red-600 mb-3 group-hover:scale-110 transition" size={32} />
              <h3 className="font-bold text-gray-800 mb-1">FBR Tax Record</h3>
              <p className="text-sm text-gray-500">Federal Board of Revenue records</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const validCount = selectedFiles.filter(f => f.status === 'valid').length;
  const invalidCount = selectedFiles.filter(f => f.status === 'invalid').length;
  const categoryTitle = {
    pdf: 'PDF Documents',
    acr: 'ACR Records',
    assets: 'Assets Declaration',
    gpfund: 'GP Fund Details',
    fbr: 'FBR Tax Record'
  }[docCategory] || '';

  return (
    <div className="max-w-5xl mx-auto pb-20 p-4">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setDocCategory(null)} className="p-2 rounded-full hover:bg-gray-200 transition">
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Add {categoryTitle}</h2>
          <p className="text-gray-500 text-sm mt-1">Upload records for <span className="font-semibold text-judiciary-700">{employee.fullName}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">

          {/* Category-Specific Form Fields */}
          {docCategory === 'acr' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
              <h3 className="text-lg font-bold text-gray-800">ACR Details *</h3>
              <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded">Dates cannot be before employee's Date of Appointment ({employee?.dateOfAppointment})</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
                  <input type="number" value={acrForm.year} onChange={(e) => setAcrForm({ ...acrForm, year: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" placeholder="e.g., 2023" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period From *</label>
                  <input type="date" value={acrForm.periodFrom} onChange={(e) => {
                    const newVal = e.target.value;
                    setAcrForm({ ...acrForm, periodFrom: newVal });
                    validateAcrPeriod(newVal, acrForm.periodTo);
                  }} min={employee?.dateOfAppointment} onKeyDown={(e) => e.preventDefault()} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period To *</label>
                  <input type="date" value={acrForm.periodTo} onChange={(e) => {
                    const newVal = e.target.value;
                    setAcrForm({ ...acrForm, periodTo: newVal });
                    validateAcrPeriod(acrForm.periodFrom, newVal);
                  }} min={employee?.dateOfAppointment} onKeyDown={(e) => e.preventDefault()} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Score (Optional)</label>
                  <select value={acrForm.score} onChange={(e) => setAcrForm({ ...acrForm, score: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent">
                    <option value="">Select...</option>
                    <option>Outstanding</option>
                    <option>Very Good</option>
                    <option>Good</option>
                    <option>Average</option>
                  </select>
                </div>
              </div>

              {/* ACR Period Validation Errors */}
              {(acrForm.periodFrom && acrForm.periodTo) && (
                <div className="space-y-2">
                  {!acrValidation.durationValid && (
                    <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-600">Duration Error</p>
                        <p className="text-xs text-red-600">{acrValidation.durationError}</p>
                      </div>
                    </div>
                  )}
                  {!acrValidation.yearValid && (
                    <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-600">Year Error</p>
                        <p className="text-xs text-red-600">{acrValidation.yearError}</p>
                      </div>
                    </div>
                  )}
                  {!acrValidation.overlapValid && (
                    <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-600">Overlap Error</p>
                        <p className="text-xs text-red-600">{acrValidation.overlapError}</p>
                      </div>
                    </div>
                  )}
                  {acrValidation.durationValid && acrValidation.yearValid && acrValidation.overlapValid && (
                    <div className="flex gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-green-600">✓ ACR period validation passed</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status (Optional)</label>
                  <select value={acrForm.status} onChange={(e) => setAcrForm({ ...acrForm, status: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent">
                    <option value="">Select...</option>
                    <option>Pending</option>
                    <option>Adverse Remarks</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title (Optional)</label>
                  <input type="text" value={acrForm.title} onChange={(e) => setAcrForm({ ...acrForm, title: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" placeholder="ACR Title" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (Optional)</label>
                <textarea value={acrForm.remarks} onChange={(e) => setAcrForm({ ...acrForm, remarks: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" rows={2} placeholder="Additional remarks..." />
              </div>
            </div>
          )}

          {docCategory === 'assets' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
              <h3 className="text-lg font-bold text-gray-800">Assets Declaration *</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Financial Year *</label>
                  <select value={assetsForm.financialYear} onChange={(e) => setAssetsForm({ ...assetsForm, financialYear: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" required>
                    <option value="">Select year...</option>
                    {getFinancialYearOptions().map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Submission Date *</label>
                  <input type="date" value={assetsForm.submissionDate} onChange={(e) => {
                    const val = e.target.value;
                    setAssetsForm({ ...assetsForm, submissionDate: val });
                    const chk = validateDateNotBeforeDoa(val);
                    setAssetsValidation(chk);
                  }} min={employee?.dateOfAppointment} onKeyDown={(e) => e.preventDefault()} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select value={assetsForm.status} onChange={(e) => setAssetsForm({ ...assetsForm, status: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" required>
                    <option value="Pending">Pending</option>
                    <option value="Submitted">Submitted</option>
                  </select>
                </div>
                <div>
                  {(!assetsValidation.valid) && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-semibold text-red-600">{assetsValidation.error}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {docCategory === 'gpfund' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
              <h3 className="text-lg font-bold text-gray-800">GP Fund Details *</h3>

              {/* Warning if active advance exists */}
              {(() => {
                const activeAdvances = (employee?.gpFundHistory || []).filter((gp: any) => gp.type === 'Advance' && gp.remainingAmount > 0);
                if (activeAdvances.length > 0) {
                  return (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm font-semibold text-orange-700">⚠ Active GP Fund Advance</p>
                      <p className="text-xs text-orange-600 mt-1">
                        You have an existing advance with remaining balance of <strong>{activeAdvances[0].remainingAmount.toFixed(2)} PKR</strong>.
                        You cannot take another advance until this is fully paid.
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select value={gpfundForm.type} onChange={(e) => setGpfundForm({ ...gpfundForm, type: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" required>
                    <option>Advance</option>
                    <option>Refund</option>
                    <option>Subscription</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (PKR) *</label>
                  <input type="number" step="0.01" value={gpfundForm.amount} onChange={(e) => setGpfundForm({ ...gpfundForm, amount: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" placeholder="Amount" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input type="date" value={gpfundForm.date} onChange={(e) => {
                  const val = e.target.value;
                  setGpfundForm({ ...gpfundForm, date: val });
                  const chk = validateDateNotBeforeDoa(val);
                  setGpfundValidation(chk);
                }} onKeyDown={(e) => e.preventDefault()} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" required />
                {(!gpfundValidation.valid) && (
                  <div className="p-2 text-sm text-red-600">{gpfundValidation.error}</div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <input id="isRefundable" type="checkbox" checked={!!gpfundForm.isRefundable} onChange={(e) => setGpfundForm({ ...gpfundForm, isRefundable: e.target.checked })} className="h-4 w-4 text-judiciary-600 border-gray-300 rounded" />
                  <label htmlFor="isRefundable" className="text-sm font-medium text-gray-700">Is Refundable</label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Installment (PKR)</label>
                  <input type="number" step="0.01" value={gpfundForm.monthlyInstallment} onChange={(e) => setGpfundForm({ ...gpfundForm, monthlyInstallment: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" placeholder="0.00" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remaining Amount (PKR)</label>
                <input type="number" step="0.01" value={gpfundForm.remainingAmount} onChange={(e) => setGpfundForm({ ...gpfundForm, remainingAmount: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" placeholder="0.00" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={gpfundForm.description} onChange={(e) => setGpfundForm({ ...gpfundForm, description: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" rows={2} placeholder="Optional description..." />
              </div>
            </div>
          )}

          {docCategory === 'fbr' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
              <h3 className="text-lg font-bold text-gray-800">FBR Tax Record *</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Year *</label>
                  <input type="text" value={fbrForm.taxYear} onChange={(e) => setFbrForm({ ...fbrForm, taxYear: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" placeholder="e.g., 2023" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filer Status *</label>
                  <select value={fbrForm.filerStatus} onChange={(e) => setFbrForm({ ...fbrForm, filerStatus: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" required>
                    <option value="">Select...</option>
                    <option>Active</option>
                    <option>Inactive</option>
                    <option>Exempted</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Submission Date *</label>
                <input type="date" value={fbrForm.submissionDate} onChange={(e) => {
                  const val = e.target.value;
                  setFbrForm({ ...fbrForm, submissionDate: val });
                  const chk = validateDateNotBeforeDoa(val);
                  setFbrValidation(chk);
                }} onKeyDown={(e) => e.preventDefault()} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-judiciary-500 focus:border-transparent" required />
                {(!fbrValidation.valid) && (
                  <div className="p-2 text-sm text-red-600">{fbrValidation.error}</div>
                )}
              </div>
            </div>
          )}

          {/* File Upload Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Attach Documents *</h3>
            <div
              className={`border-3 border-dashed rounded-2xl p-10 text-center transition-all ${isDragOver ? 'border-judiciary-500 bg-judiciary-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload size={32} className="text-judiciary-600 mx-auto mb-3" />
              <h4 className="text-lg font-bold text-gray-800 mb-2">Drag & Drop files here</h4>
              <p className="text-gray-500 text-sm mb-6">or click to browse your computer</p>

              <input type="file" ref={fileInputSingleRef} id="fileElem-single" accept=".pdf" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              <input type="file" ref={fileInputMultipleRef} id="fileElem-multiple" accept=".pdf" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

              <label htmlFor="fileElem-single" className="cursor-pointer px-4 py-2 bg-judiciary-600 text-white rounded-lg font-semibold hover:bg-judiciary-700 transition inline-block mr-2">
                Single File
              </label>
              <label htmlFor="fileElem-multiple" className="cursor-pointer px-4 py-2 bg-judiciary-600 text-white rounded-lg font-semibold hover:bg-judiciary-700 transition inline-block">
                Multiple Files
              </label>

              <p className="text-xs text-gray-400 mt-4">Supported: PDF only • At least one file required</p>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-4">
                <div className="bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 flex justify-between items-center mb-3">
                  <span className="font-bold text-gray-700">Selected Files ({selectedFiles.length})</span>
                  {invalidCount > 0 && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">{invalidCount} Invalid</span>}
                </div>
                <div className="space-y-2">
                  {selectedFiles.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText size={20} className={item.status === 'valid' ? 'text-orange-600' : 'text-gray-300'} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${item.status === 'valid' ? 'text-gray-800' : 'text-gray-400'}`}>{item.file.name}</p>
                          <p className="text-xs text-gray-400">{formatSize(item.file.size)}</p>
                        </div>
                      </div>
                      <button onClick={() => removeFile(item.id)} className="p-1 text-gray-400 hover:text-red-600 transition">
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Summary */}
        <div>
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sticky top-24">
            <h4 className="font-bold text-gray-800 mb-4">Submission Status</h4>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Form Fields</span>
                <span className={isFormValid() ? 'font-bold text-green-600' : 'font-bold text-red-600'}>{isFormValid() ? '✓ Complete' : '✗ Incomplete'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Documents</span>
                <span className={validCount > 0 ? 'font-bold text-green-600' : 'font-bold text-red-600'}>{validCount > 0 ? `✓ ${validCount} file(s)` : '✗ Required'}</span>
              </div>
            </div>
            <button
              onClick={handleUpload}
              disabled={!isFormValid() || validCount === 0 || uploading}
              className="w-full py-3 bg-judiciary-600 text-white rounded-xl font-bold hover:bg-judiciary-700 shadow-md hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              {uploading ? 'Uploading...' : 'Submit & Upload'}
            </button>
            <p className="text-xs text-gray-500 text-center mt-3">Both form and documents required</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddDocuments;
