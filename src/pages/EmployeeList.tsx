import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  Eye,
  Edit,
  MapPin,
  CheckSquare,
  Square,
  Loader2,
  Scale,
  Briefcase,
  Users,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  FileSignature,
  CheckCircle,
} from 'lucide-react';
import { useMasterData } from '../context/MasterDataContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Employee, EmploymentBlock, EmploymentLeave } from '../types';
import canEmployeeRejoin from '../utils/canRejoin';
import filterEmployeesV2, { FilterOptions } from '../utils/employeeFilters_v2';
import SelectionActions from '../components/SelectionActions';
import ViewOptionsDialog from '../components/ViewOptionsDialog';
import MultiSelectDropdown from '../components/MultiSelectDropdown';

interface FilterState {
  status: string[];
  gender: string[];
  religion: string[];
  domicile: string[];
  dobStart: string;
  dobEnd: string;
  bps: string[];
  designationId: string[];
  qualificationId: string[];
  degreeTitle: string;
  hqId: string[];
  tehsilId: string[];
  postingCategoryId: string[];
  unitId: string[];
  postingPlaceTitle: string[];
  specificTitle: string;
  doaStart: string;
  doaEnd: string;
  leaveType: string[];
  leaveStart: string;
  leaveEnd: string;
  disciplinaryStart: string;
  disciplinaryEnd: string;
  hasInquiry: boolean;
}
const TERMINAL_STATUSES = ['Retired', 'Deceased'];
const REJOINABLE_STATUSES = ['Resigned', 'Terminated', 'OSD', 'Suspended', 'Deputation', 'Absent', 'Remove'];
const TRANSFERABLE_STATUSES = ['In-Service'];
const INITIAL_FILTERS: FilterState = {
  status: [], gender: [], religion: [], domicile: [], dobStart: '', dobEnd: '',
  bps: [], designationId: [], qualificationId: [], degreeTitle: '',
  hqId: [], tehsilId: [], postingCategoryId: [], unitId: [], postingPlaceTitle: [], specificTitle: '',
  doaStart: '', doaEnd: '', leaveType: [], leaveStart: '', leaveEnd: '', disciplinaryStart: '', disciplinaryEnd: '',
  hasInquiry: false
};


const EmployeeList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // --- View Mode Toggle ---
  const [staffCategory, setStaffCategory] = useState<'all' | 'judiciary' | 'staff'>('all');

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [employeeData, setEmployeeData] = useState<Employee[]>([]);

  // --- View Options Dialog ---
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedEmployeeForView, setSelectedEmployeeForView] = useState<{ id: string; name: string } | null>(null);

  // --- Transfer Dialog ---
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedEmployeeForTransfer, setSelectedEmployeeForTransfer] = useState<{ id: string; name: string; employee: Employee } | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);

  // --- Delete Confirmation Dialog ---
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [selectedEmployeeForDelete, setSelectedEmployeeForDelete] = useState<{ id: string; name: string } | null>(null);

  // --- Succession / Update Title Dialog ---
  const [successionDialogOpen, setSuccessionDialogOpen] = useState(false);
  const [selectedEmployeeForSuccession, setSelectedEmployeeForSuccession] = useState<{ id: string; name: string; employee: Employee } | null>(null);
  const [successionData, setSuccessionData] = useState({ relievingDate: '', joiningDate: '', newPostingPlaceTitle: '' });
  const [successionError, setSuccessionError] = useState<string | null>(null);

  // --- Success Message Dialog ---
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const { designations, units, headquarters, tehsils, categories, getActiveTehsilsByHQ } = useMasterData();

  // Get filtered Tehsils based on selected HQ - ONLY show matching Tehsils
  const displayTehsils = filters.hqId.length > 0
    ? tehsils.filter(t => filters.hqId.includes(String(t.hqId).trim()) && String(t.status || '').trim() === 'Active')
    : [];

  // Get filtered Units based on selected Category - ONLY show matching Units
  const displayUnits = filters.postingCategoryId.length > 0
    ? units.filter(u => filters.postingCategoryId.includes(String(u.categoryId).trim()) && String(u.status || '').trim() === 'Active')
    : [];

  // Extract dynamic values from employee data
  const uniqueGenders = Array.from(new Set(employeeData.map(e => e.gender).filter(Boolean))).sort();
  const uniqueDomiciles = Array.from(new Set(employeeData.map(e => e.domicile).filter(Boolean))).sort();
  const uniqueReligions = Array.from(new Set(employeeData.map(e => e.religion).filter(Boolean))).sort();
  const uniquePostingPlaces = Array.from(new Set(
    employeeData.flatMap(e => e.employmentHistory?.map(eh => eh.postingPlaceTitle) || []).filter(Boolean)
  )).sort();

  // Extract unique leave types from employee data
  const uniqueLeaveTypes = Array.from(new Set(
    employeeData.flatMap(e => e.employmentHistory?.flatMap(eh => eh.leaves?.map(l => l.type) || []) || []).filter(Boolean)
  )).sort();

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '0000-00-00') return '';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
  };

  // Handle HQ change - reset Tehsil if HQ changes
  const handleHQChange = (newHqIds: string[]) => {
    setFilters({ ...filters, hqId: newHqIds, tehsilId: [] });
  };

  const handleOpenViewDialog = (empId: string, empName: string) => {
    setSelectedEmployeeForView({ id: empId, name: empName });
    setViewDialogOpen(true);
  };

  const handleOpenTransferDialog = (emp: Employee) => {
    // Check if employee is In-Service
    const latestBlock = emp.employmentHistory?.[0];
    if (!latestBlock || latestBlock.status !== 'In-Service') {
      setTransferError('This employee cannot be transferred. Only employees with "In-Service" status can be transferred.');
      return;
    }
    setTransferError(null);
    setSelectedEmployeeForTransfer({ id: emp.id, name: emp.fullName, employee: emp });
    setTransferDialogOpen(true);
  };

  const handleTransferConfirm = () => {
    if (selectedEmployeeForTransfer) {
      setTransferDialogOpen(false);
      navigate(`/transfer/${selectedEmployeeForTransfer.id}`);
    }
  };

  const handleOpenSuccessionDialog = (emp: Employee) => {
    // Only for In-Service and NON-Judicial (Court Staff)
    const latestBlock = emp.employmentHistory?.[0];
    const isJudicial = isJudicialOfficer(latestBlock?.designationId || '');
    const isOffice = isOfficeCategory(latestBlock?.postingCategoryId || '');

    if (!latestBlock || latestBlock.status !== 'In-Service' || isJudicial || isOffice) {
      alert("This action is only available for active Court Staff (non-Office).");
      return;
    }

    setSelectedEmployeeForSuccession({ id: emp.id, name: emp.fullName, employee: emp });
    const today = new Date().toISOString().split('T')[0];
    setSuccessionData({
      relievingDate: today,
      joiningDate: today,
      newPostingPlaceTitle: latestBlock.postingPlaceTitle || ''
    });
    setSuccessionError(null);
    setSuccessionDialogOpen(true);
  };

  const handleSuccessionSubmit = async () => {
    if (!selectedEmployeeForSuccession) return;
    if (!successionData.relievingDate || !successionData.joiningDate || !successionData.newPostingPlaceTitle) {
      setSuccessionError("All fields are required.");
      return;
    }

    try {
      setIsLoading(true);
      const result = await api.updatePostingTitle({
        employeeId: selectedEmployeeForSuccession.id,
        relievingDate: successionData.relievingDate,
        joiningDate: successionData.joiningDate,
        newPostingPlaceTitle: successionData.newPostingPlaceTitle
      });

      if (result.success) {
        setSuccessionDialogOpen(false);
        setSuccessMessage("Posting title updated successfully.");
        setShowSuccessDialog(true);
        loadEmployees(); // Reload list
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setSuccessionError(result.message || "Failed to update.");
      }
    } catch (err: any) {
      setSuccessionError(err.message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getEmployees();
      setEmployeeData(data || []);
    } catch (error) {
      console.error("Error loading employees:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDeleteEmployee = (id: string, name: string) => {
    setSelectedEmployeeForDelete({ id, name });
    setDeleteConfirmDialogOpen(true);
  };

  const confirmDeleteEmployee = async () => {
    if (!selectedEmployeeForDelete) return;

    try {
      setDeleteConfirmDialogOpen(false);
      setIsLoading(true);
      const result = await api.deleteEmployee(selectedEmployeeForDelete.id, user?.role || '');
      if (result.success) {
        alert('Employee deleted successfully.');
        loadEmployees();
      } else {
        alert(`Error: ${result.message}`);
        setIsLoading(false);
      }
    } catch (err: any) {
      alert(`Failed to delete employee: ${err.message}`);
      setIsLoading(false);
    } finally {
      setSelectedEmployeeForDelete(null);
    }
  };

  useEffect(() => {
    // Auto-set filter from URL if present
    const type = searchParams.get('type');
    if (type === 'judges') setStaffCategory('judiciary');
    if (type === 'staff') setStaffCategory('staff');
  }, [searchParams]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Debug logging for categories
  useEffect(() => {
    // console.log('📦 Categories loaded:', categories);
    if (employeeData.length > 0) {
      // console.log('👤 First employee:', employeeData[0]);
      // console.log('📍 First employee posting category ID:', employeeData[0].employmentHistory?.[0]?.postingCategoryId);
      // console.log('📍 First employee statusDate:', employeeData[0].employmentHistory?.[0]?.statusDate);
      // console.log('📍 First employee status:', employeeData[0].employmentHistory?.[0]?.status);
      // console.log('📍 First employee leaves:', employeeData[0].employmentHistory?.[0]?.leaves);
    }
  }, [categories, employeeData]);

  const getEmploymentInfo = (employmentHistory: EmploymentBlock[] = [], employee: Employee) => {
    if (!employmentHistory || employmentHistory.length === 0) {
      return {
        doa: employee.dateOfAppointment || null,  // Get DOA from employee record
        currentStatus: 'Unknown',
        statusDate: null,
        isActive: false
      };
    }

    // Get DOA from employee record if available, otherwise find from employment history
    const doa = employee.dateOfAppointment ||
      employmentHistory.sort((a, b) =>
        new Date(a.fromDate).getTime() - new Date(b.fromDate).getTime()
      )[0]?.fromDate ||
      null;

    // Find current active employment (where toDate is in the future or not set)
    const currentEmployment = employmentHistory.find(emp =>
      emp.isCurrentlyWorking ||
      !emp.toDate ||
      emp.toDate === '0000-00-00' ||
      new Date(emp.toDate) > new Date()
    );

    // Find most relevant status. Prefer explicit statusDate, then toDate, then fromDate.
    const latestStatus = [...employmentHistory].sort((a, b) => {
      const getKey = (x: EmploymentBlock) => {
        const k = x.statusDate && x.statusDate !== '0000-00-00' ? x.statusDate : (x.toDate && x.toDate !== '0000-00-00' ? x.toDate : x.fromDate);
        return k || '';
      };
      const keyA = getKey(a) || '';
      const keyB = getKey(b) || '';
      if (keyA === keyB) return (b.id || '').localeCompare(a.id || '');
      return keyB.localeCompare(keyA);
    })[0];

    // Derive a user-facing status date: prefer statusDate, then toDate, then fromDate
    const derivedStatusDate = latestStatus?.statusDate && latestStatus.statusDate !== '0000-00-00'
      ? latestStatus.statusDate
      : latestStatus?.toDate && latestStatus.toDate !== '0000-00-00'
        ? latestStatus.toDate
        : latestStatus?.fromDate || null;

    return {
      doa,
      currentStatus: latestStatus?.status || 'Unknown',
      statusDate: derivedStatusDate,
      isActive: !!currentEmployment
    };
  };

  const calculateDuration = (startDateStr: string, endDateStr?: string | null, isWorking?: boolean, addAgo?: boolean) => {
    if (!startDateStr) return '-';
    const start = new Date(startDateStr);
    let end = new Date();
    if (!isWorking && endDateStr) end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();
    if (days < 0) { months--; const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0); days += prevMonth.getDate(); }
    if (months < 0) { years--; months += 12; }

    const parts = [];
    if (years > 0) parts.push(`${years} Yr${years > 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} Mo${months > 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);
    const duration = parts.length === 0 ? '0 Days' : parts.join(' ');
    return addAgo ? `${duration} ago` : duration;
  };

  const getServiceStatus = (emp: Employee, latest: EmploymentBlock) => {
    const now = new Date();

    // Check if employee is on leave
    const currentLeave = latest.leaves?.find((leave: EmploymentLeave) => {
      if (!leave.startDate || !leave.endDate) return false;
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      return start <= now && end >= now;
    });

    // Format the base status
    const status = latest.status || 'Unknown';
    const statusDate = latest.statusDate ? new Date(latest.statusDate) : null;

    // Format the date part. For In-Service prefer since fromDate; for others prefer statusDate, then toDate, then fromDate.
    let dateInfo = '';
    if (status === 'In-Service' && latest.isCurrentlyWorking) {
      dateInfo = `Since ${formatDate(latest.fromDate)}`;
    } else {
      const sd = latest.statusDate && latest.statusDate !== '0000-00-00' ? latest.statusDate : (latest.toDate && latest.toDate !== '0000-00-00' ? latest.toDate : latest.fromDate);
      if (sd) {
        // Use a verb that fits the status
        if (status === 'Retired') dateInfo = `Retired on ${formatDate(sd)}`;
        else if (status === 'Deceased') dateInfo = `Since ${formatDate(sd)}`;
        else dateInfo = `Since ${formatDate(sd)}`;
      }
    }

    // Format leave information if applicable - with type, dates, and days
    let leaveInfo = '';
    if (currentLeave) {
      const start = formatDate(currentLeave.startDate);
      const end = formatDate(currentLeave.endDate);
      const type = currentLeave.type || 'Leave';
      const days = currentLeave.days || 0;
      const daysStr = String(days).padStart(2, '0');
      leaveInfo = `${type}\n${start} to ${end}\n${daysStr} days Leave`;
    }

    return {
      status,
      dateInfo,
      leaveInfo,
      isOnLeave: !!currentLeave,
      leaveType: currentLeave?.type,
      leaveStartDate: currentLeave?.startDate,
      leaveEndDate: currentLeave?.endDate
    };
  };

  const isJudicialOfficer = (desId: string) => {
    const des = designations.find(d => d.id === String(desId));
    if (!des) return false;
    const title = des.title.toLowerCase();
    return title.includes('judge') || title.includes('justice') || title.includes('magistrate');
  };

  const isOfficeCategory = (catId: string) => {
    const cat = categories.find(c => String(c.id) === String(catId));
    return cat ? cat.title.toLowerCase().includes('office') : false;
  };



  const filtered = useMemo(() => {
    // Build FilterOptions from the current filter state
    const filterOpts: FilterOptions = {
      query: searchTerm || undefined,
      status: filters.status.length > 0 ? filters.status : undefined,
      hqId: filters.hqId.length > 0 ? filters.hqId : undefined,
      tehsilId: filters.tehsilId.length > 0 ? filters.tehsilId : undefined,
      designationId: filters.designationId.length > 0 ? filters.designationId : undefined,
      unitId: filters.unitId.length > 0 ? filters.unitId : undefined,
      bpsGrade: filters.bps.length > 0 ? filters.bps : undefined,
      categoryId: filters.postingCategoryId.length > 0 ? filters.postingCategoryId : undefined,
      postingPlace: filters.postingPlaceTitle.length > 0 ? filters.postingPlaceTitle : undefined,
      dobFrom: filters.dobStart || undefined,
      dobTo: filters.dobEnd || undefined,
      doaFrom: filters.doaStart || undefined,
      doaTo: filters.doaEnd || undefined,
      gender: filters.gender.length > 0 ? filters.gender : undefined,
      domicile: filters.domicile.length > 0 ? filters.domicile : undefined,
      sect: filters.religion.length > 0 ? filters.religion : undefined,
      leaveType: filters.leaveType.length > 0 ? filters.leaveType : undefined,
      leaveFromDate: filters.leaveStart || undefined,
      leaveToDate: filters.leaveEnd || undefined,
      disciplinaryFromDate: filters.disciplinaryStart || undefined,
      disciplinaryToDate: filters.disciplinaryEnd || undefined,
    };

    // Apply the filter utility
    let result = filterEmployeesV2(employeeData, filterOpts);

    // Apply category filter (Judiciary vs Staff)
    if (staffCategory === 'judiciary') {
      result = result.filter(emp => isJudicialOfficer(emp.employmentHistory[0]?.designationId || ''));
    } else if (staffCategory === 'staff') {
      result = result.filter(emp => !isJudicialOfficer(emp.employmentHistory[0]?.designationId || ''));
    }

    return result;
  }, [employeeData, searchTerm, filters, staffCategory, designations]);

  const handleSelectAll = () => {
    const allVisibleSelected = filtered.length > 0 && filtered.every(e => selectedIds.has(e.id));
    const newSet = new Set(selectedIds);
    if (allVisibleSelected) filtered.forEach(e => newSet.delete(e.id));
    else filtered.forEach(e => newSet.add(e.id));
    setSelectedIds(newSet);
  };

  const handleSelectRow = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const isAllSelected = filtered.length > 0 && filtered.every(e => selectedIds.has(e.id));
  const isSomeSelected = filtered.some(e => selectedIds.has(e.id));

  const selectedEmployees = useMemo(() => {
    if (!selectedIds || selectedIds.size === 0) return [] as Employee[];
    return employeeData.filter(e => selectedIds.has(e.id));
  }, [employeeData, selectedIds]);

  return (
    <div className="space-y-6">
      {/* --- View Options Dialog --- */}
      {selectedEmployeeForView && (
        <ViewOptionsDialog
          isOpen={viewDialogOpen}
          onClose={() => {
            setViewDialogOpen(false);
            setSelectedEmployeeForView(null);
          }}
          employeeId={selectedEmployeeForView.id}
          employeeName={selectedEmployeeForView.name}
        />
      )}

      {/* --- Top Toggle Bar --- */}
      <div className="flex justify-center mb-2">
        <div className="bg-gray-100 p-1 rounded-xl inline-flex shadow-inner">
          <button onClick={() => setStaffCategory('all')} className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${staffCategory === 'all' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            <Users size={16} /> All Employees
          </button>
          <button onClick={() => setStaffCategory('judiciary')} className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${staffCategory === 'judiciary' ? 'bg-white shadow text-judiciary-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <Scale size={16} /> Judicial Officers
          </button>
          <button onClick={() => setStaffCategory('staff')} className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${staffCategory === 'staff' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <Briefcase size={16} /> Court Staff
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            {staffCategory === 'judiciary' ? 'Judicial Officers' : staffCategory === 'staff' ? 'Court Staff' : 'Employee'} Directory
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage {staffCategory === 'judiciary' ? 'Judges' : 'Staff'} records and postings
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by Name or CNIC..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-judiciary-500 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border shadow-sm transition-all font-medium ${showFilters ? 'bg-judiciary-600 text-white' : 'bg-white text-gray-700'}`}
          >
            <Filter size={18} />
            <span className="hidden sm:inline">Filters</span>
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-judiciary-200 p-4 animate-in slide-in-from-top-2">

          {/* --- REQUIRED LOCATION FILTER --- */}
          <div className="mb-4 pb-4 border-b-2 border-judiciary-300">
            <h3 className="text-sm font-bold text-judiciary-700 uppercase mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-judiciary-600 text-white rounded-full text-xs font-bold">1</span>
              Location (Required)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MultiSelectDropdown
                label="HQ"
                options={headquarters.map(h => ({ id: h.id, title: h.title }))}
                selectedIds={filters.hqId}
                onChange={handleHQChange}
                placeholder="Select HQs"
              />
              <MultiSelectDropdown
                label={`Tehsil ${filters.hqId.length > 0 ? `(${displayTehsils.length})` : ''}`}
                options={displayTehsils.map(t => ({ id: t.id, title: t.title }))}
                selectedIds={filters.tehsilId}
                onChange={(ids) => setFilters({ ...filters, tehsilId: ids })}
                placeholder={filters.hqId.length > 0 ? "All Tehsils" : "Select HQ first"}
                disabled={filters.hqId.length === 0}
              />
            </div>
          </div>

          {/* --- POSITION & ROLE (4 COLUMNS) --- */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-600 text-white rounded-full text-xs font-bold">2</span>
              Position
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MultiSelectDropdown
                label="Category"
                options={categories.map(c => ({ id: c.id, title: c.title }))}
                selectedIds={filters.postingCategoryId}
                onChange={(ids) => setFilters({ ...filters, postingCategoryId: ids, unitId: [] })}
                placeholder="All Categories"
              />
              <MultiSelectDropdown
                label={`Unit ${filters.postingCategoryId.length > 0 ? `(${displayUnits.length})` : ''}`}
                options={displayUnits.map(u => ({ id: u.id, title: u.title }))}
                selectedIds={filters.unitId}
                onChange={(ids) => setFilters({ ...filters, unitId: ids })}
                placeholder={filters.postingCategoryId.length > 0 ? "All Units" : "Select Category first"}
                disabled={filters.postingCategoryId.length === 0}
              />
              <MultiSelectDropdown
                label="Designation"
                options={designations.map(d => ({ id: d.id, title: d.title }))}
                selectedIds={filters.designationId}
                onChange={(ids) => setFilters({ ...filters, designationId: ids })}
                placeholder="All Designations"
              />
              <MultiSelectDropdown
                label="BPS Grade"
                options={Array.from({ length: 22 }, (_, i) => `BPS-${i + 1}`).map(g => ({ id: g, title: g }))}
                selectedIds={filters.bps}
                onChange={(ids) => setFilters({ ...filters, bps: ids })}
                placeholder="All Grades"
              />
            </div>
          </div>

          {/* --- ADDITIONAL FILTERS (4 COLUMNS) --- */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-indigo-600 text-white rounded-full text-xs font-bold">3</span>
              Additional Filters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MultiSelectDropdown
                label="Posting Place"
                options={uniquePostingPlaces.map(p => ({ id: String(p), title: String(p) }))}
                selectedIds={filters.postingPlaceTitle}
                onChange={(ids) => setFilters({ ...filters, postingPlaceTitle: ids })}
                placeholder="All Postings"
              />
              <MultiSelectDropdown
                label="Status"
                options={['In-Service', 'Retired', 'Resigned', 'Deceased', 'Terminated', 'Suspended', 'OSD', 'Deputation', 'Absent', 'Remove'].map(s => ({ id: s, title: s }))}
                selectedIds={filters.status}
                onChange={(ids) => setFilters({ ...filters, status: ids })}
                placeholder="All Statuses"
              />
              <MultiSelectDropdown
                label="Gender"
                options={uniqueGenders.length > 0 ? uniqueGenders.map(g => ({ id: String(g), title: String(g) })) : [{ id: 'Male', title: 'Male' }, { id: 'Female', title: 'Female' }]}
                selectedIds={filters.gender}
                onChange={(ids) => setFilters({ ...filters, gender: ids })}
                placeholder="All Genders"
              />
            </div>
          </div>

          {/* --- PERSONAL INFO (4 COLUMNS) --- */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-green-600 text-white rounded-full text-xs font-bold">4</span>
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MultiSelectDropdown
                label="Religion"
                options={uniqueReligions.map(r => ({ id: String(r), title: String(r) }))}
                selectedIds={filters.religion}
                onChange={(ids) => setFilters({ ...filters, religion: ids })}
                placeholder="All Religions"
              />
              <MultiSelectDropdown
                label="Domicile"
                options={uniqueDomiciles.map(d => ({ id: String(d), title: String(d) }))}
                selectedIds={filters.domicile}
                onChange={(ids) => setFilters({ ...filters, domicile: ids })}
                placeholder="All Domiciles"
              />
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">DOB From</label>
                <input type="date" min="1900-01-01" max="3099-12-31" className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-judiciary-500 focus:border-transparent text-sm" value={filters.dobStart} onChange={(e) => setFilters({ ...filters, dobStart: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">DOB To</label>
                <input type="date" min="1900-01-01" max="3099-12-31" className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-judiciary-500 focus:border-transparent text-sm" value={filters.dobEnd} onChange={(e) => setFilters({ ...filters, dobEnd: e.target.value })} />
              </div>
            </div>
          </div>

          {/* --- DATE & RECORDS (4 COLUMNS) --- */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-yellow-600 text-white rounded-full text-xs font-bold">5</span>
              Appointment & Records
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">DOA From</label>
                <input type="date" min="1900-01-01" max="3099-12-31" className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-judiciary-500 focus:border-transparent text-sm" value={filters.doaStart} onChange={(e) => setFilters({ ...filters, doaStart: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">DOA To</label>
                <input type="date" min="1900-01-01" max="3099-12-31" className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-judiciary-500 focus:border-transparent text-sm" value={filters.doaEnd} onChange={(e) => setFilters({ ...filters, doaEnd: e.target.value })} />
              </div>
            </div>
          </div>

          {/* --- LEAVE RECORDS (DATE RANGE & TYPE) --- */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-purple-600 text-white rounded-full text-xs font-bold">6</span>
              Leave Records (Date Range)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MultiSelectDropdown
                label="Leave Type"
                options={uniqueLeaveTypes.map(lt => ({ id: String(lt), title: String(lt) }))}
                selectedIds={filters.leaveType}
                onChange={(ids) => setFilters({ ...filters, leaveType: ids })}
                placeholder="All Leave Types"
              />
              <div className="hidden lg:block"></div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Leave From Date</label>
                <input type="date" min="1900-01-01" max="3099-12-31" className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-judiciary-500 focus:border-transparent text-sm" value={filters.leaveStart} onChange={(e) => setFilters({ ...filters, leaveStart: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Leave To Date</label>
                <input type="date" min="1900-01-01" max="3099-12-31" className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-judiciary-500 focus:border-transparent text-sm" value={filters.leaveEnd} onChange={(e) => setFilters({ ...filters, leaveEnd: e.target.value })} />
              </div>
            </div>
          </div>

          {/* --- DISCIPLINARY RECORDS (DATE RANGE) --- */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-red-600 text-white rounded-full text-xs font-bold">7</span>
              Disciplinary Records (Date Range)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Action From Date</label>
                <input type="date" min="1900-01-01" max="3099-12-31" className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-judiciary-500 focus:border-transparent text-sm" value={filters.disciplinaryStart} onChange={(e) => setFilters({ ...filters, disciplinaryStart: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Action To Date</label>
                <input type="date" min="1900-01-01" max="3099-12-31" className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-judiciary-500 focus:border-transparent text-sm" value={filters.disciplinaryEnd} onChange={(e) => setFilters({ ...filters, disciplinaryEnd: e.target.value })} />
              </div>
            </div>
          </div>

          {/* --- FILTER SUMMARY & ACTIONS --- */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="text-sm flex-1">
              {filters.hqId.length > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-judiciary-700 font-bold">
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-green-500 text-white rounded-full text-xs">✓</span>
                    HQs: {filters.hqId.length === 1 ? headquarters.find(h => h.id === filters.hqId[0])?.title : `${filters.hqId.length} HQs selected`}
                  </div>
                  {filters.tehsilId.length > 0 && (
                    <div className="text-xs text-gray-600 ml-7">
                      Tehsils: {filters.tehsilId.length === 1 ? displayTehsils.find(t => t.id === filters.tehsilId[0])?.title : `${filters.tehsilId.length} Tehsils selected`}
                    </div>
                  )}
                  <div className="text-xs text-gray-600 mt-2">
                    🔍 Showing employees matching all selected criteria
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600 font-semibold">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white rounded-full text-xs">!</span>
                  Please select a Headquarters to enable filtering
                </div>
              )}
            </div>
            <button
              onClick={() => setFilters({ ...INITIAL_FILTERS })}
              className="px-6 py-2.5 bg-red-50 text-red-600 font-semibold rounded-lg hover:bg-red-100 transition-all duration-200 text-sm whitespace-nowrap border border-red-200 hover:border-red-300"
            >
              ✕ Clear All Filters
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <SelectionActions selectedEmployees={selectedEmployees} onClear={() => setSelectedIds(new Set())} />
        {isLoading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-judiciary-600" />
            <p className="text-gray-500 font-medium">Loading Database...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-4 py-4 w-10 text-center">
                    <button onClick={handleSelectAll} className="text-gray-300 hover:text-white">
                      {isAllSelected ? <CheckSquare size={18} /> : isSomeSelected ? <div className="w-4 h-4 bg-gray-400 rounded-sm" /> : <Square size={18} />}
                    </button>
                  </th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Employee Info</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Designation</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Posting Location</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Service Status</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((emp) => {
                  const latest = emp.employmentHistory?.[0];
                  if (!latest) return null;

                  // Add this line to get the employment info
                  const { doa, currentStatus, statusDate, isActive } = getEmploymentInfo(emp.employmentHistory || [], emp);
                  const desTitle = designations.find(d => String(d.id) === String(latest.designationId))?.title || 'Unknown Designation';
                  const unitTitle = units.find(u => String(u.id) === String(latest.unitId))?.title || 'Unknown Unit';
                  const durationStr = calculateDuration(latest.fromDate, latest.toDate || latest.statusDate, latest.isCurrentlyWorking);
                  const isSelected = selectedIds.has(emp.id);

                  return (
                    <tr key={emp.id} className={`transition ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-4 text-center">
                        <button onClick={() => handleSelectRow(emp.id)} className={isSelected ? 'text-judiciary-600' : 'text-gray-300'}>
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-judiciary-100 flex items-center justify-center text-judiciary-800 font-bold border border-judiciary-200">
                            {emp.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{emp.fullName}</p>
                            {emp.fatherName && <p className="text-xs text-gray-600">S/O {emp.fatherName}</p>}
                            <p className="text-xs text-gray-500 font-mono mt-1">{emp.cnic}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-gray-800">
                            {desTitle}
                            {latest.bps && <span className="ml-1 text-xs text-gray-500 font-normal">({latest.bps})</span>}
                          </div>
                          <div className="text-xs text-gray-500">
                            DOA: {doa ? formatDate(doa) : 'N/A'}
                          </div>
                          {!isActive && statusDate && (
                            <div className="text-xs text-red-500">
                              {currentStatus} on {formatDate(statusDate)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-800 font-medium flex items-center gap-1">
                            <MapPin size={12} className="text-gray-400" /> {unitTitle}
                          </span>
                          <span className="text-xs text-judiciary-600 mt-0.5 pl-4">{latest.postingPlaceTitle}</span>
                          <span className="text-[10px] text-gray-400 pl-4">
                            {(() => {
                              if (!latest.postingCategoryId || latest.postingCategoryId === '0') {
                                return 'N/A';
                              }
                              const category = categories.find(c => String(c.id) === String(latest.postingCategoryId));
                              return category?.title || `Category ID: ${latest.postingCategoryId}`;
                            })()}
                          </span>
                          <span className="text-[10px] text-gray-400 pl-4">{tehsils.find(t => t.id === String(latest.tehsilId))?.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const serviceStatus = getServiceStatus(emp, latest);
                          const isOnLeave = serviceStatus.isOnLeave;
                          const status = serviceStatus.status;

                          // Determine badge colors based on status (GREEN only for In-Service, regardless of leave)
                          let badgeClasses = '';
                          let dotColor = '';

                          if (status === 'In-Service') {
                            badgeClasses = 'bg-green-50 text-green-700 border-green-100';
                            dotColor = 'bg-green-500';
                          } else if (status === 'Retired') {
                            badgeClasses = 'bg-blue-50 text-blue-700 border-blue-100';
                            dotColor = 'bg-blue-500';
                          } else if (status === 'Deceased') {
                            badgeClasses = 'bg-gray-50 text-gray-700 border-gray-100';
                            dotColor = 'bg-gray-500';
                          } else {
                            badgeClasses = 'bg-red-50 text-red-700 border-red-100';
                            dotColor = 'bg-red-500';
                          }

                          return (
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${badgeClasses}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                                {status}
                              </span>
                              <div className="text-xs text-gray-500 mt-1">
                                {serviceStatus.dateInfo}
                              </div>
                              {isOnLeave && serviceStatus.leaveInfo && (
                                <div className="text-xs text-orange-600 font-semibold mt-1 px-2 py-1 rounded bg-orange-50 border border-orange-100 whitespace-pre-line">
                                  {serviceStatus.leaveInfo}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-700">
                        {(() => {
                          const status = latest.status || 'Unknown';
                          const isActive = status === 'In-Service' && latest.isCurrentlyWorking;

                          if (isActive) {
                            // For active employees, calculate from fromDate to today
                            return calculateDuration(latest.fromDate, null, true);
                          } else if (latest.statusDate) {
                            // For inactive employees, calculate from statusDate to today with "ago"
                            return calculateDuration(latest.statusDate, null, false, true);
                          } else if (latest.toDate) {
                            // Fallback to toDate if no statusDate
                            return calculateDuration(latest.fromDate, latest.toDate, false, true);
                          } else {
                            return calculateDuration(latest.fromDate, latest.toDate, latest.isCurrentlyWorking);
                          }
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="grid grid-cols-4 gap-3">
                          {/* Row 1: View Details, Transfer, Rejoin */}
                          <button
                            onClick={() => handleOpenViewDialog(emp.id, emp.fullName)}
                            className="p-1 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleOpenTransferDialog(emp)}
                            className="p-1 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition text-lg"
                            title="Transfer Employee"
                          >
                            ⇄
                          </button>
                          {(() => {
                            const latest = emp.employmentHistory?.[0];
                            if (latest && latest.status === 'In-Service' && !isJudicialOfficer(latest.designationId) && !isOfficeCategory(latest.postingCategoryId)) {
                              return (
                                <button
                                  onClick={() => handleOpenSuccessionDialog(emp)}
                                  className="p-1 rounded-lg text-purple-600 hover:text-purple-800 hover:bg-purple-50 transition"
                                  title="Update Posting Title / Head Change"
                                >
                                  <FileSignature size={16} />
                                </button>
                              );
                            }
                            return null;
                          })()}
                          {canEmployeeRejoin(emp) && (
                            <button
                              onClick={() => navigate(`/edit-employee/${emp.id}?action=rejoin`)}
                              className="p-1 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition"
                              title="Rejoin Employee"
                            >
                              ↻
                            </button>
                          )}
                          {!canEmployeeRejoin(emp) && (
                            <div></div>
                          )}

                          {/* Row 2: Edit, Add, Delete */}
                          <button
                            onClick={() => navigate(`/edit-employee/${emp.id}`)}
                            className="p-1 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition"
                            title="Edit Employee"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => navigate(`/documents/${emp.id}`)}
                            className="p-1 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition text-lg"
                            title="Add Documents"
                          >
                            ➕
                          </button>
                          {user?.role === 'admin' && (
                            <button
                              onClick={() => handleDeleteEmployee(emp.id, emp.fullName)}
                              className="p-1 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition text-lg"
                              title="Delete Employee"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">No records found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transfer Dialog */}
      <Transition appear show={transferDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setTransferDialogOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <MapPin size={20} className="text-judiciary-600" />
                    Transfer Employee
                  </Dialog.Title>

                  {transferError ? (
                    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                      <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
                      <p className="text-red-700 text-sm">{transferError}</p>
                    </div>
                  ) : selectedEmployeeForTransfer ? (
                    <div className="mt-6 space-y-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">Recent Service History</h3>
                        {(() => {
                          const latestBlock = selectedEmployeeForTransfer.employee.employmentHistory?.[0];
                          if (!latestBlock) return <p className="text-gray-600 text-sm">No service history found</p>;

                          const hqTitle = headquarters.find(h => h.id === latestBlock.hqId)?.title || latestBlock.hqId;
                          const tehsilTitle = tehsils.find(t => t.id === latestBlock.tehsilId)?.title || latestBlock.tehsilId;
                          const designationTitle = designations.find(d => d.id === latestBlock.designationId)?.title || latestBlock.designationId;
                          const unitTitle = units.find(u => u.id === latestBlock.unitId)?.title || latestBlock.unitId;
                          const categoryTitle = categories.find(c => c.id === latestBlock.postingCategoryId)?.title || latestBlock.postingCategoryId;

                          return (
                            <div className="space-y-3 text-sm">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-gray-500 text-xs uppercase font-semibold">Designation</p>
                                  <p className="text-gray-900 font-medium">{designationTitle}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 text-xs uppercase font-semibold">BPS Grade</p>
                                  <p className="text-gray-900 font-medium">{latestBlock.bps}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 text-xs uppercase font-semibold">Headquarters</p>
                                  <p className="text-gray-900 font-medium">{hqTitle}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 text-xs uppercase font-semibold">Tehsil</p>
                                  <p className="text-gray-900 font-medium">{tehsilTitle}</p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-gray-500 text-xs uppercase font-semibold">Posting Place</p>
                                  <p className="text-gray-900 font-medium">{latestBlock.postingPlaceTitle}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 text-xs uppercase font-semibold">Category</p>
                                  <p className="text-gray-900 font-medium">{categoryTitle}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 text-xs uppercase font-semibold">Unit</p>
                                  <p className="text-gray-900 font-medium">{unitTitle}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 text-xs uppercase font-semibold">From Date</p>
                                  <p className="text-gray-900 font-medium">{formatDate(latestBlock.fromDate)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 text-xs uppercase font-semibold">Status</p>
                                  <p className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100 mt-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    {latestBlock.status}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <p className="text-sm text-gray-600">
                        <span className="font-semibold text-gray-900">{selectedEmployeeForTransfer.name}</span> is currently <span className="font-semibold text-green-600">In-Service</span>. You can proceed with the transfer.
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-8 flex justify-end gap-3">
                    <button
                      onClick={() => setTransferDialogOpen(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                    >
                      Cancel
                    </button>
                    {!transferError && selectedEmployeeForTransfer && (
                      <button
                        onClick={handleTransferConfirm}
                        className="px-4 py-2 bg-judiciary-600 text-white rounded-lg hover:bg-judiciary-700 transition font-medium flex items-center gap-2"
                      >
                        <MapPin size={16} />
                        Proceed to Transfer
                      </button>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* View Options Dialog */}
      <ViewOptionsDialog
        isOpen={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        employeeId={selectedEmployeeForView?.id || ''}
        employeeName={selectedEmployeeForView?.name || ''}
      />

      {/* Delete Confirmation Modal */}
      <Transition show={deleteConfirmDialogOpen} as={Fragment}>
        <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={() => setDeleteConfirmDialogOpen(false)}>
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm" />
            </Transition.Child>

            {/* This element is to trick the browser into centering the modal contents. */}
            <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>

            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>

                <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-gray-900 text-center">
                  Confirm Deletion
                </Dialog.Title>

                <div className="mt-4">
                  <p className="text-sm text-gray-500 text-center">
                    Are you sure you want to delete <span className="font-bold text-gray-900">{selectedEmployeeForDelete?.name}</span> and all their records from the database?
                  </p>
                  <p className="mt-2 text-xs text-red-500 text-center font-medium bg-red-50 p-2 rounded-lg py-3 border border-red-100">
                    Warning: This action will permanently remove all service history, ACRs, assets, and legal documents. This cannot be undone.
                  </p>
                </div>

                <div className="mt-6 flex gap-3 justify-center">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-lg hover:bg-gray-200 focus:outline-none transition-colors w-1/2"
                    onClick={() => setDeleteConfirmDialogOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none transition-colors w-1/2"
                    onClick={confirmDeleteEmployee}
                  >
                    Yes, Delete
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>


      {/* Succession / Update Title Dialog */}
      <Transition appear show={successionDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setSuccessionDialogOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <FileSignature size={20} className="text-purple-600" />
                    Update Posting Title (Succession)
                  </Dialog.Title>

                  {successionError && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                      {successionError}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm mb-4">
                      {selectedEmployeeForSuccession && selectedEmployeeForSuccession.employee.employmentHistory?.[0] ? (
                        <>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="col-span-2 border-b pb-2 mb-2">
                              <p className="font-semibold text-gray-700">Updating Title for:</p>
                              <p className="text-gray-900 text-sm font-bold">{selectedEmployeeForSuccession.name}</p>
                            </div>

                            <div>
                              <p className="text-gray-500 font-semibold uppercase text-[10px]">Current Posting Place</p>
                              <p className="text-gray-800 font-medium">{selectedEmployeeForSuccession.employee.employmentHistory[0].postingPlaceTitle}</p>
                            </div>

                            <div>
                              <p className="text-gray-500 font-semibold uppercase text-[10px]">Designation</p>
                              <p className="text-gray-800 font-medium">
                                {designations.find(d => String(d.id) === String(selectedEmployeeForSuccession.employee.employmentHistory![0].designationId))?.title}
                              </p>
                            </div>

                            <div>
                              <p className="text-gray-500 font-semibold uppercase text-[10px]">Posting Date</p>
                              <p className="text-gray-800 font-medium">
                                {new Date(selectedEmployeeForSuccession.employee.employmentHistory[0].fromDate).toLocaleDateString('en-GB')}
                              </p>
                            </div>

                            <div>
                              <p className="text-gray-500 font-semibold uppercase text-[10px]">Status</p>
                              <p className="text-green-600 font-bold text-[10px] bg-green-50 px-1.5 py-0.5 rounded inline-block border border-green-100">
                                {selectedEmployeeForSuccession.employee.employmentHistory[0].status}
                              </p>
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-2 italic border-t pt-2">
                            Note: This will close the current "In-Service" record shown above and create a new continuity record with the new title.
                          </p>
                        </>
                      ) : (
                        <p className="text-gray-500">Loading current details...</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Relieving Date (Old Title)</label>
                      <input
                        type="date"
                        value={successionData.relievingDate}
                        onChange={(e) => setSuccessionData({ ...successionData, relievingDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date (New Title)</label>
                      <input
                        type="date"
                        value={successionData.joiningDate}
                        onChange={(e) => setSuccessionData({ ...successionData, joiningDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Posting Place Title</label>
                      <input
                        type="text"
                        value={successionData.newPostingPlaceTitle}
                        onChange={(e) => setSuccessionData({ ...successionData, newPostingPlaceTitle: e.target.value })}
                        placeholder="e.g. Court of Mr. Judge XYZ"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end gap-3">
                    <button
                      onClick={() => setSuccessionDialogOpen(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSuccessionSubmit}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium flex items-center gap-2"
                    >
                      <CheckSquare size={16} />
                      Update Title
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>


      {/* Success Dialog */}
      <Transition appear show={showSuccessDialog} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowSuccessDialog(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-xl bg-white p-6 text-center align-middle shadow-xl transition-all">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} />
                  </div>
                  <Dialog.Title as="h3" className="text-xl font-bold text-gray-900 mb-2">
                    Success!
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-gray-500">
                      {successMessage}
                    </p>
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-lg border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 transition-colors"
                      onClick={() => setShowSuccessDialog(false)}
                    >
                      OK, Got it
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

    </div>
  );
};

export default EmployeeList;