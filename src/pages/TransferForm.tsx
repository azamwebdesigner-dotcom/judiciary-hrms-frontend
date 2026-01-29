import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMasterData } from '../context/MasterDataContext';
import { api } from '../services/api';
import { Employee, EmploymentBlock } from '../types';
import { BPS_GRADES } from '../constants';
import { ArrowLeft, MapPin, Calendar, Save, ArrowRight, Building2, Briefcase, FileSignature, AlertCircle, Loader2 } from 'lucide-react';

const TransferForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { headquarters, tehsils, designations, categories, units } = useMasterData();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [currentBlock, setCurrentBlock] = useState<EmploymentBlock | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [relievingDate, setRelievingDate] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [markAsCurrentPosting, setMarkAsCurrentPosting] = useState(true);
  const [newPosting, setNewPosting] = useState<Partial<EmploymentBlock>>({
    hqId: '', tehsilId: '', postingCategoryId: '', unitId: '',
    designationId: '', bps: '', fromDate: '', orderNumber: '', postingPlaceTitle: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [overlapPairs, setOverlapPairs] = useState<Array<{ a: number; b: number }>>([]);
  const [suggestion, setSuggestion] = useState<{ field: 'fromDate' | 'relievingDate'; date: string; reason: string } | null>(null);
  const [historyConflicts, setHistoryConflicts] = useState<Record<number, { relievingConflict?: boolean; joiningConflict?: boolean }>>({});

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      api.getEmployeeById(id).then((emp: Employee | null) => {
        if (emp) {
          setEmployee(emp);
          const active = emp.employmentHistory.find((b: EmploymentBlock) => b.isCurrentlyWorking && b.status === 'In-Service');
          if (active) {
            setCurrentBlock(active);
            // Pre-fill new posting with current values so selects show correct dependent options
            setNewPosting(prev => ({
              ...prev,
              designationId: active.designationId,
              bps: active.bps,
              hqId: active.hqId || '',
              tehsilId: active.tehsilId || '',
              postingCategoryId: active.postingCategoryId || '',
              unitId: active.unitId || '',
              postingPlaceTitle: active.postingPlaceTitle || ''
            }));
            // compute overlaps in existing history
            const pairs = findOverlappingPairs(emp.employmentHistory || []);
            setOverlapPairs(pairs);
          }
        } else {
          navigate('/employees');
        }
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
        navigate('/employees');
      });
    }
  }, [id, navigate]);

  // Find overlapping pairs among histories (1-based indices)
  const findOverlappingPairs = (histories: EmploymentBlock[]) => {
    const normalize = (d: any) => {
      if (!d) return null;
      const s = String(d).trim();
      if (!s || s === '0000-00-00') return null;
      return s;
    };
    const ranges = histories.map((h, idx) => {
      const exitStatuses = ['Retired', 'Deceased', 'Resigned', 'Terminated', 'Suspended', 'OSD', 'Deputation', 'Absent', 'Remove'];
      const isExit = exitStatuses.includes(h.status);
      let from: string | null = null;
      if (isExit) {
        from = normalize(h.statusDate) || normalize(h.fromDate);
      } else {
        from = normalize(h.fromDate) || normalize(h.statusDate);
      }
      return {
        start: from,
        end: normalize(h.toDate),
        index: idx + 1
      };
    });

    const pairs: Array<{ a: number; b: number }> = [];
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const aStart = ranges[i].start ?? '0000-01-01';
        const bStart = ranges[j].start ?? '0000-01-01';
        const aEnd = ranges[i].end ?? '9999-12-31';
        const bEnd = ranges[j].end ?? '9999-12-31';
        // consider touching boundaries as non-overlap (same as server)
        if ((aStart > bStart ? aStart : bStart) < (aEnd < bEnd ? aEnd : bEnd)) {
          pairs.push({ a: ranges[i].index, b: ranges[j].index });
        }
      }
    }
    return pairs;
  };

  const formatDisplayDate = (d?: string | null) => {
    if (!d) return 'Present';
    if (d === '0000-00-00') return 'Present';
    const s = String(d).trim();
    // If date is in YYYY-MM-DD format, avoid timezone shifts and format directly
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [, yyyy, mm, dd] = m;
      return `${dd}/${mm}/${yyyy}`;
    }
    try {
      const dt = new Date(s);
      if (isNaN(dt.getTime())) return s;
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch { return s; }
  };

  const getBlockByIndex = (histories: EmploymentBlock[] | undefined, idx: number) => {
    if (!histories) return null;
    return histories[idx - 1] || null;
  };

  const isDateConflictingWithBlock = (dateStr: string, block: EmploymentBlock, allowEqualityBoundary = true) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const exitStatuses = ['Retired', 'Deceased', 'Resigned', 'Terminated', 'Suspended', 'OSD', 'Deputation', 'Absent', 'Remove'];
    const isExit = exitStatuses.includes(block.status);
    let fromDateStr = isExit ? (block.statusDate || block.fromDate) : (block.fromDate || block.statusDate);

    const from = fromDateStr ? new Date(fromDateStr) : null;
    const to = block.toDate && block.toDate !== '0000-00-00' ? new Date(block.toDate) : null;
    if (!from) return false;
    if (!to) {
      return d >= from; // open-ended block: conflict if on/after start
    }
    if (allowEqualityBoundary) {
      // boundaries allowed (touching is OK) => conflict only if strictly inside
      return d > from && d < to;
    }
    return d >= from && d <= to;
  };

  const checkDateConflicts = (field: 'relievingDate' | 'fromDate', value: string): string | null => {
    if (!value || !employee) return null;
    const dateStr = value;
    for (const block of employee.employmentHistory) {
      if (block.id === currentBlock?.id) continue; // skip current block
      const conflict = isDateConflictingWithBlock(dateStr, block, true);
      if (conflict) {
        if (field === 'fromDate') return 'Joining Date overlaps with another employment record';
        return 'Relieving date overlaps with another employment record';
      }
    }
    return null;
  };

  const handleNewPostingChange = (field: keyof EmploymentBlock, value: string) => {
    if (field === 'fromDate') {
      const err = checkDateConflicts('fromDate', value);
      if (err) {
        setErrors(prev => ({ ...prev, fromDate: err }));
        if (employee) {
          const blk = employee.employmentHistory.find(b => b.id !== currentBlock?.id && isDateConflictingWithBlock(value, b, true));
          if (blk) {
            if (!blk.toDate || blk.toDate === '0000-00-00') {
              const suggested = new Date(blk.fromDate!); suggested.setDate(suggested.getDate() - 1);
              setSuggestion({ field: 'fromDate', date: suggested.toISOString().slice(0, 10), reason: `Existing active record starts on ${formatDisplayDate(blk.fromDate)}; pick earlier or close it.` });
            } else {
              setSuggestion({ field: 'fromDate', date: blk.toDate || '', reason: `Existing record ends on ${formatDisplayDate(blk.toDate)}; you may choose that date.` });
            }
          }
        }
      } else {
        setErrors(prev => { const n = { ...prev }; delete n.fromDate; return n; });
        setSuggestion(null);
      }

      if (employee) {
        const flags: Record<number, any> = {};
        employee.employmentHistory.forEach((b, i) => {
          if (b.id === currentBlock?.id) return;
          if (isDateConflictingWithBlock(value, b, true)) flags[i + 1] = { joiningConflict: true };
        });
        setHistoryConflicts(flags);
      }
    }

    setNewPosting(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'hqId') updated.tehsilId = '';
      if (field === 'postingCategoryId') updated.unitId = '';
      return updated;
    });
    if (errors[field]) {
      setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
    if (apiError) setApiError(null);
  };

  const handleRelievingDateChange = (value: string) => {
    const err = checkDateConflicts('relievingDate', value);
    if (err) {
      setErrors(prev => ({ ...prev, relievingDate: err }));
      if (employee) {
        const blk = employee.employmentHistory.find(b => b.id !== currentBlock?.id && isDateConflictingWithBlock(value, b, true));
        if (blk) {
          if (!blk.toDate || blk.toDate === '0000-00-00') {
            const suggested = new Date(blk.fromDate!); suggested.setDate(suggested.getDate() - 1);
            setSuggestion({ field: 'relievingDate', date: suggested.toISOString().slice(0, 10), reason: `Existing active record starts on ${formatDisplayDate(blk.fromDate)}; pick earlier relieving date.` });
          } else {
            const suggested = new Date(blk.fromDate!); suggested.setDate(suggested.getDate() - 1);
            setSuggestion({ field: 'relievingDate', date: suggested.toISOString().slice(0, 10), reason: `This record runs ${formatDisplayDate(blk.fromDate)} to ${formatDisplayDate(blk.toDate)}; choose earlier relieving date.` });
          }
        }
      }
    } else {
      setErrors(prev => { const n = { ...prev }; delete n.relievingDate; return n; });
      setSuggestion(null);
    }
    if (employee) {
      const flags: Record<number, any> = {};
      employee.employmentHistory.forEach((b, i) => {
        if (b.id === currentBlock?.id) return;
        if (isDateConflictingWithBlock(value, b, true)) flags[i + 1] = { relievingConflict: true };
      });
      setHistoryConflicts(prev => ({ ...prev, ...flags }));
    }

    setRelievingDate(value);
    if (apiError) setApiError(null);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate Step 1
    if (!relievingDate) newErrors.relievingDate = 'Relieving Date is required';

    // Validate relieving date: must be on or after fromDate of current posting
    if (relievingDate && currentBlock?.fromDate) {
      const relievDate = new Date(relievingDate);
      const fromDate = new Date(currentBlock.fromDate);
      if (relievDate < fromDate) {
        newErrors.relievingDate = 'Relieving date cannot be before the start of current posting';
      }
    }

    // Check for overlapping dates with other employment blocks
    if (relievingDate && employee) {
      const relievDate = new Date(relievingDate);
      for (const block of employee.employmentHistory) {
        if (block.id === currentBlock?.id) continue; // Skip current block
        const blockFromDate = block.fromDate ? new Date(block.fromDate) : null;
        const blockToDate = block.toDate && block.toDate !== '0000-00-00' ? new Date(block.toDate) : null;

        if (blockFromDate) {
          // If the existing block is open-ended, any relievingDate on/after its start overlaps
          if (!blockToDate) {
            if (relievDate >= blockFromDate) {
              newErrors.relievingDate = 'Relieving date overlaps with another employment record';
              break;
            }
          } else {
            // For bounded ranges, treat overlap as strictly inside the range (allow equality at boundaries)
            if (relievDate > blockFromDate && relievDate < blockToDate) {
              newErrors.relievingDate = 'Relieving date overlaps with another employment record';
              break;
            }
          }
        }
      }
    }

    // Validate Step 2
    if (!newPosting.hqId) newErrors.hqId = 'Required';
    if (!newPosting.tehsilId) newErrors.tehsilId = 'Required';
    if (!newPosting.postingCategoryId) newErrors.postingCategoryId = 'Required';
    if (!newPosting.unitId) newErrors.unitId = 'Required';
    if (!newPosting.postingPlaceTitle?.trim()) newErrors.postingPlaceTitle = 'Required';
    if (!newPosting.designationId) newErrors.designationId = 'Required';
    if (!newPosting.bps) newErrors.bps = 'Required';
    if (!newPosting.fromDate) newErrors.fromDate = 'Joining Date is required';
    if (!newPosting.orderNumber?.trim()) newErrors.orderNumber = 'Order Number is required';
    if (!orderDate) newErrors.orderDate = 'Order Date is required';

    // Validate joining date
    if (relievingDate && newPosting.fromDate) {
      const joiningDate = new Date(newPosting.fromDate);
      const relievDate = new Date(relievingDate);
      // Allow same-day relieve and join; joining must not be before relieving date
      if (joiningDate < relievDate) {
        newErrors.fromDate = 'Joining Date cannot be before Relieving Date';
      }
    }

    // Order date: required but allow it to be before relieving date (less strict)

    // Check for overlapping dates in new posting (only if marked as currently working)
    if (markAsCurrentPosting && newPosting.fromDate && employee) {
      const joiningDate = new Date(newPosting.fromDate);
      for (const block of employee.employmentHistory) {
        if (block.id === currentBlock?.id) continue;
        const blockFromDate = block.fromDate ? new Date(block.fromDate) : null;
        const blockToDate = block.toDate && block.toDate !== '0000-00-00' ? new Date(block.toDate) : null;

        if (blockFromDate) {
          // Open-ended existing block: joiningDate on/after its start is overlapping
          if (!blockToDate) {
            if (joiningDate >= blockFromDate) {
              newErrors.fromDate = 'Joining Date overlaps with another active employment record';
              break;
            }
          } else {
            // For bounded ranges, treat overlap as strictly inside (allow equality at boundaries)
            if (joiningDate > blockFromDate && joiningDate < blockToDate) {
              newErrors.fromDate = 'Joining Date overlaps with another employment record';
              break;
            }
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Client-side helpers to mirror server-side validation for employment history
  const normalizeDateClient = (d: any): string | null => {
    if (d === null || d === undefined) return null;
    const s = String(d).trim();
    if (s === '' || s === '0000-00-00') return null;
    return s;
  };

  const rangesOverlapClient = (aStart: string | null, aEnd: string | null, bStart: string | null, bEnd: string | null) => {
    const minDate = '0000-01-01';
    const maxDate = '9999-12-31';
    const Astart = aStart ?? minDate;
    const Bstart = bStart ?? minDate;
    const Aend = aEnd ?? maxDate;
    const Bend = bEnd ?? maxDate;
    // treat touching boundaries as non-overlap (align with server)
    return (Astart > Bstart ? Astart : Bstart) < (Aend < Bend ? Aend : Bend);
  };

  const validateEmploymentHistorySet = (histories: EmploymentBlock[] | undefined): { valid: boolean; message?: string } => {
    if (!histories || histories.length === 0) return { valid: true };
    const ranges: Array<{ start: string | null; end: string | null; index: number }> = [];
    for (let i = 0; i < histories.length; i++) {
      const h = histories[i];
      const status = h.status;
      const exitStatuses = ['Retired', 'Deceased', 'Resigned', 'Terminated', 'Suspended', 'OSD', 'Deputation', 'Absent', 'Remove'];
      const isExit = exitStatuses.includes(status);

      let from: string | null = null;
      if (isExit) {
        from = normalizeDateClient((h as any).statusDate) ||
          normalizeDateClient((h as any).status_date) ||
          normalizeDateClient(h.fromDate) ||
          normalizeDateClient((h as any).from_date) ||
          null;
      } else {
        from = normalizeDateClient(h.fromDate) ||
          normalizeDateClient((h as any).from_date) ||
          normalizeDateClient((h as any).statusDate) ||
          normalizeDateClient((h as any).status_date) ||
          null;
      }

      const to = normalizeDateClient(h.toDate ?? (h as any).to_date ?? null);
      if (from && to && from > to) {
        return { valid: false, message: `Employment history item #${i + 1} has fromDate after toDate` };
      }
      ranges.push({ start: from, end: to, index: i + 1 });
    }

    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        if (rangesOverlapClient(ranges[i].start, ranges[i].end, ranges[j].start, ranges[j].end)) {
          return { valid: false, message: `Employment history items #${ranges[i].index} and #${ranges[j].index} have overlapping date ranges` };
        }
      }
    }
    return { valid: true };
  };

  // Recompute overlap pairs whenever employee history changes
  useEffect(() => {
    if (employee?.employmentHistory) {
      setOverlapPairs(findOverlappingPairs(employee.employmentHistory));
    }
  }, [employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !currentBlock) return;

    if (validate()) {
      const updatedEmployee = JSON.parse(JSON.stringify(employee)) as Employee;
      const blockToClose = updatedEmployee.employmentHistory.find((b: EmploymentBlock) => b.id === currentBlock.id);
      if (blockToClose) {
        blockToClose.toDate = relievingDate;
        blockToClose.isCurrentlyWorking = false;
        // Do not set statusDate on the closed block here. Status date should represent
        // the effective date of the new/current posting (joining date) and
        // orderDate is already stored separately. Avoid duplicating orderDate
        // into statusDate to prevent two dates appearing in the UI.
      }

      const newBlock: EmploymentBlock = {
        id: crypto.randomUUID(),
        employeeId: employee.id,
        hqId: newPosting.hqId!,
        tehsilId: newPosting.tehsilId!,
        postingCategoryId: newPosting.postingCategoryId!,
        unitId: newPosting.unitId!,
        postingPlaceTitle: newPosting.postingPlaceTitle!,
        designationId: newPosting.designationId!,
        bps: newPosting.bps!,
        orderNumber: newPosting.orderNumber!,
        orderDate: orderDate || '',
        fromDate: newPosting.fromDate!,
        // toDate: depends on if marked as currently working
        toDate: markAsCurrentPosting ? '0000-00-00' : '',
        status: 'In-Service',
        isCurrentlyWorking: markAsCurrentPosting,
        // set statusDate to the joining date (the effective status change).
        // Do NOT use orderDate here to avoid showing orderDate as a status date.
        statusDate: newPosting.fromDate || '',
        leaves: [],
        disciplinaryActions: []
      };

      updatedEmployee.employmentHistory.unshift(newBlock);

      // Debug: log the employmentHistory payload to inspect any incorrect date ranges
      // This will appear in browser console when submitting a transfer. Remove after debugging.
      // eslint-disable-next-line no-console
      // console.log('DEBUG: employmentHistory payload', JSON.parse(JSON.stringify(updatedEmployee.employmentHistory)));

      setIsLoading(true);
      try {
        // Mirror server validation locally to catch existing overlaps before sending
        const check = validateEmploymentHistorySet(updatedEmployee.employmentHistory);
        if (!check.valid) {
          setApiError(check.message || 'Employment history validation failed');
          setIsLoading(false);
          return;
        }

        await api.updateEmployee(updatedEmployee);
        navigate('/employees');
      } catch (e: any) {
        const msg = e?.message || 'Transfer failed';
        setApiError(msg);
        setIsLoading(false);
      }
    }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-judiciary-600" size={48} /></div>;

  if (!employee || !currentBlock) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-xl text-center">
        <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-700">Transfer Not Allowed</h2>
        <p className="text-gray-600 mt-2">This employee does not have an active "In-Service" posting.</p>
        <button onClick={() => navigate('/employees')} className="mt-6 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Back to List</button>
      </div>
    );
  }

  const getHqTitle = (id: string) => headquarters.find(h => h.id === id)?.title;
  const getTehsilTitle = (id: string) => tehsils.find(t => t.id === id)?.title;
  const getDesTitle = (id: string) => designations.find(d => d.id === id)?.title;
  // Use string comparison to avoid type mismatches between master data ids and form values
  const availableTehsils = tehsils.filter(t => String(t.hqId) === String(newPosting.hqId) && t.status === 'Active');
  const availableUnits = units.filter(u => String(u.categoryId) === String(newPosting.postingCategoryId) && u.status === 'Active');

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {overlapPairs.length > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
          <strong>Warning:</strong> There are overlapping service records. Please fix the employee's employment history before proceeding.
          <div className="mt-2 text-sm">
            {overlapPairs.map((p, idx) => (
              <div key={idx}>Items #{p.a} and #{p.b} overlap</div>
            ))}
          </div>
        </div>
      )}
      {/* Detailed view of overlapping blocks to help admin choose correct dates */}
      {overlapPairs.length > 0 && employee?.employmentHistory && (
        <div className="mb-6 grid grid-cols-1 gap-4">
          {overlapPairs.map((p, idx) => {
            const A = getBlockByIndex(employee.employmentHistory, p.a);
            const B = getBlockByIndex(employee.employmentHistory, p.b);
            return (
              <div key={idx} className="p-4 rounded-lg border border-yellow-200 bg-yellow-50">
                <div className="text-sm font-semibold text-yellow-800 mb-2">Conflict: Items #{p.a} and #{p.b}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-white rounded border">
                    <div className="text-xs text-gray-500">Item #{p.a}</div>
                    <div className="font-semibold text-gray-800">{A?.postingPlaceTitle || '—'}</div>
                    <div className="text-sm text-gray-600">{getHqTitle(A?.hqId || '')}, {getTehsilTitle(A?.tehsilId || '')}</div>
                    <div className="text-xs text-gray-500 mt-2">{formatDisplayDate(A?.fromDate)} — {formatDisplayDate(A?.toDate)}</div>
                    <div className="text-xs text-gray-500">{getDesTitle(A?.designationId || '')} • {A?.bps}</div>
                  </div>
                  <div className="p-3 bg-white rounded border">
                    <div className="text-xs text-gray-500">Item #{p.b}</div>
                    <div className="font-semibold text-gray-800">{B?.postingPlaceTitle || '—'}</div>
                    <div className="text-sm text-gray-600">{getHqTitle(B?.hqId || '')}, {getTehsilTitle(B?.tehsilId || '')}</div>
                    <div className="text-xs text-gray-500 mt-2">{formatDisplayDate(B?.fromDate)} — {formatDisplayDate(B?.toDate)}</div>
                    <div className="text-xs text-gray-500">{getDesTitle(B?.designationId || '')} • {B?.bps}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Full service history - highlight conflicts with selected dates */}
      {employee?.employmentHistory && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Service History</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {employee.employmentHistory.map((b, i) => {
              const idx = i + 1;
              const conf = historyConflicts[idx] || {};
              const isCurrent = b.id === currentBlock?.id;
              const status_low = b.status?.toLowerCase() || 'in-service';
              const isExit = ['retired', 'deceased', 'resigned', 'terminated', 'suspended', 'osd', 'deputation', 'absent', 'remove'].includes(status_low);

              const start_raw = isExit ? (b.statusDate || b.fromDate) : (b.fromDate || b.statusDate);
              const end_raw = b.toDate && b.toDate !== '0000-00-00' ? b.toDate : null;

              return (
                <div key={b.id} className={`p-3 rounded-lg border transition-all ${isCurrent ? 'border-green-300 bg-green-50 shadow-sm' : conf.relievingConflict || conf.joiningConflict ? 'border-red-300 bg-red-50' : 'border-gray-100 bg-white shadow-sm'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-xs text-gray-500 font-medium">Item #{idx} {isCurrent && '(Current)'}</div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${status_low === 'in-service' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                      {b.status || 'Active'}
                    </span>
                  </div>
                  <div className="font-semibold text-gray-800 leading-tight">{b.postingPlaceTitle || '—'}</div>
                  <div className="text-sm text-gray-600 truncate">{getHqTitle(b.hqId || '')}, {getTehsilTitle(b.tehsilId || '')}</div>
                  <div className="text-xs text-gray-500 mt-2 font-medium flex items-center gap-1">
                    <span>{formatDisplayDate(start_raw)}</span>
                    <span className="text-gray-300">—</span>
                    <span>{formatDisplayDate(end_raw)}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{getDesTitle(b.designationId || '')} • {b.bps}</div>
                  {(conf.relievingConflict || conf.joiningConflict) && (
                    <div className="mt-2 text-[12px] text-red-700 font-medium bg-red-100/50 p-1 rounded">
                      Conflicts with selected date{conf.relievingConflict && ' (relieving)'}{conf.joiningConflict && ' (joining)'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/employees')} className="p-2 rounded-full hover:bg-gray-200 transition">
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Transfer Employee</h2>
          <p className="text-gray-500 text-sm mt-1">Record movement for <span className="font-semibold text-judiciary-700">{employee.fullName}</span></p>
        </div>
      </div>

      {apiError && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-red-100 text-red-700 p-1.5 rounded-lg"><MapPin size={18} /></div>
            <h3 className="font-bold text-gray-700 uppercase tracking-wide text-sm">Step 1: Relieve from Current Place</h3>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
            <div className="p-6 bg-red-50/30">
              <div className="mb-6 pb-6 border-b border-red-100">
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Current Location</label>
                <h4 className="text-lg font-bold text-gray-800">{getHqTitle(currentBlock.hqId)}, {getTehsilTitle(currentBlock.tehsilId)}</h4>
                <p className="text-gray-600 font-medium">{currentBlock.postingPlaceTitle}</p>
                <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 bg-white rounded border border-gray-200 text-xs text-gray-500">
                  <Briefcase size={12} /> {getDesTitle(currentBlock.designationId)} ({currentBlock.bps})
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Relieving Date <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="date"
                      value={relievingDate}
                      min={currentBlock?.fromDate || '1900-01-01'}
                      max="3099-12-31"
                      onKeyDown={(e) => { if (e.key !== 'Tab') e.preventDefault(); }}
                      onChange={(e) => handleRelievingDateChange(e.target.value)}
                      className={`w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-red-200 outline-none transition ${errors.relievingDate ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    />
                  </div>
                  {errors.relievingDate && <p className="text-xs text-red-600 mt-1">{errors.relievingDate}</p>}
                  {suggestion && suggestion.field === 'relievingDate' && (
                    <div className="mt-2 p-2 rounded border border-yellow-200 bg-yellow-50 text-yellow-800 text-sm flex items-center justify-between">
                      <div>
                        <div className="font-medium">Suggestion: {suggestion.reason}</div>
                        <div className="text-xs">Try: <strong>{formatDisplayDate(suggestion.date)}</strong></div>
                      </div>
                      <div>
                        <button type="button" onClick={() => { setRelievingDate(suggestion.date); setSuggestion(null); setErrors(prev => { const n = { ...prev }; delete n.relievingDate; return n; }); }} className="ml-4 px-3 py-1 bg-yellow-700 text-white rounded">Apply</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="bg-white p-2 rounded-full shadow-lg border border-gray-100 text-gray-400">
            <ArrowRight size={24} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-green-100 text-green-700 p-1.5 rounded-lg"><Building2 size={18} /></div>
            <h3 className="font-bold text-gray-700 uppercase tracking-wide text-sm">Step 2: Join at New Place</h3>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-green-200 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Joining Date <span className="text-red-500">*</span></label>
                  <input type="date" min={relievingDate || '1900-01-01'} max="3099-12-31" onKeyDown={(e) => { if (e.key !== 'Tab') e.preventDefault(); }} value={newPosting.fromDate || ''} onChange={(e) => handleNewPostingChange('fromDate', e.target.value)} className={`w-full p-2 border rounded-lg text-sm ${errors.fromDate ? 'border-red-500 bg-red-50' : 'border-gray-300'}`} />
                  {errors.fromDate && <p className="text-[10px] text-red-600 mt-0.5">{errors.fromDate}</p>}
                  {suggestion && suggestion.field === 'fromDate' && (
                    <div className="mt-2 p-2 rounded border border-yellow-200 bg-yellow-50 text-yellow-800 text-sm flex items-center justify-between">
                      <div>
                        <div className="font-medium">Suggestion: {suggestion.reason}</div>
                        <div className="text-xs">Try: <strong>{formatDisplayDate(suggestion.date)}</strong></div>
                      </div>
                      <div>
                        <button type="button" onClick={() => { setNewPosting(prev => ({ ...prev, fromDate: suggestion.date })); setSuggestion(null); setErrors(prev => { const n = { ...prev }; delete n.fromDate; return n; }); }} className="ml-4 px-3 py-1 bg-yellow-700 text-white rounded">Apply</button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Transfer Order No <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <FileSignature className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input placeholder="Order #" value={newPosting.orderNumber || ''} onChange={(e) => handleNewPostingChange('orderNumber', e.target.value)} className={`w-full pl-8 p-2 border rounded-lg text-sm ${errors.orderNumber ? 'border-red-500' : 'border-gray-300'}`} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Order Date <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="date"
                      value={orderDate}
                      min="1900-01-01"
                      max="3099-12-31"
                      onKeyDown={(e) => { if (e.key !== 'Tab') e.preventDefault(); }}
                      onChange={(e) => {
                        setOrderDate(e.target.value);
                        if (errors.orderDate) setErrors(prev => { const n = { ...prev }; delete n.orderDate; return n; });
                        if (apiError) setApiError(null);
                      }}
                      className={`w-full pl-10 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-200 outline-none transition ${errors.orderDate ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    />
                  </div>
                  {errors.orderDate && <p className="text-[10px] text-red-600 mt-0.5">{errors.orderDate}</p>}
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={markAsCurrentPosting}
                      onChange={(e) => setMarkAsCurrentPosting(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-xs font-semibold text-gray-700">Mark as Current Posting</span>
                  </label>
                </div>
              </div>
              <hr className="border-dashed border-gray-200 my-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="label-sm">Headquarter <span className="text-red-500">*</span></label>
                  <select className={`input-sm ${errors.hqId ? 'border-red-500' : ''}`} value={newPosting.hqId} onChange={(e) => handleNewPostingChange('hqId', e.target.value)}>
                    <option value="">Select HQ</option>
                    {headquarters.filter(h => h.status === 'Active').map(h => <option key={h.id} value={h.id}>{h.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-sm">Tehsil <span className="text-red-500">*</span></label>
                  <select className={`input-sm ${errors.tehsilId ? 'border-red-500' : ''}`} value={newPosting.tehsilId} onChange={(e) => handleNewPostingChange('tehsilId', e.target.value)} disabled={!newPosting.hqId}>
                    <option value="">Select Tehsil</option>
                    {availableTehsils.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-sm">Category <span className="text-red-500">*</span></label>
                  <select className={`input-sm ${errors.postingCategoryId ? 'border-red-500' : ''}`} value={newPosting.postingCategoryId} onChange={(e) => handleNewPostingChange('postingCategoryId', e.target.value)}>
                    <option value="">Select Category</option>
                    {categories.filter(c => c.status === 'Active').map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-sm">Unit <span className="text-red-500">*</span></label>
                  <select className={`input-sm ${errors.unitId ? 'border-red-500' : ''}`} value={newPosting.unitId} onChange={(e) => handleNewPostingChange('unitId', e.target.value)} disabled={!newPosting.postingCategoryId}>
                    <option value="">Select Unit</option>
                    {availableUnits.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label-sm">Specific Title / Seat <span className="text-red-500">*</span></label>
                  <input
                    list="postingPlaces"
                    className={`input-sm ${errors.postingPlaceTitle ? 'border-red-500' : ''}`}
                    placeholder="e.g. Civil Judge Court No. 2"
                    value={newPosting.postingPlaceTitle || ''}
                    onChange={(e) => handleNewPostingChange('postingPlaceTitle', e.target.value)}
                  />
                  <datalist id="postingPlaces">
                    <option value="Civil Judge Court No. 1" />
                    <option value="Civil Judge Court No. 2" />
                    <option value="Civil Judge Court No. 3" />
                    <option value="Criminal Judge Court No. 1" />
                    <option value="Criminal Judge Court No. 2" />
                    <option value="Criminal Judge Court No. 3" />
                    <option value="Judicial Magistrate Court No. 1" />
                    <option value="Judicial Magistrate Court No. 2" />
                    <option value="Reader" />
                    <option value="Naib Qazi" />
                  </datalist>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="col-span-2">
                  <label className="label-sm">Designation <span className="text-red-500">*</span></label>
                  <select className={`input-sm bg-white ${errors.designationId ? 'border-red-500' : ''}`} value={newPosting.designationId} onChange={(e) => handleNewPostingChange('designationId', e.target.value)}>
                    <option value="">Select Designation</option>
                    {designations.filter(d => d.status === 'Active').map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-sm">BPS <span className="text-red-500">*</span></label>
                  <select className={`input-sm bg-white ${errors.bps ? 'border-red-500' : ''}`} value={newPosting.bps} onChange={(e) => handleNewPostingChange('bps', e.target.value)}>
                    <option value="">Grade</option>
                    {BPS_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 flex justify-end pt-6 border-t border-gray-200">
          <button type="submit" disabled={isLoading || overlapPairs.length > 0} className="px-8 py-3 bg-judiciary-600 text-white rounded-xl shadow-lg hover:bg-judiciary-700 hover:shadow-xl transition flex items-center gap-3 font-semibold text-lg disabled:opacity-60 disabled:cursor-not-allowed">
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Update Service Record
          </button>
        </div>
      </form>
      <style>{`.label-sm { @apply block text-xs font-bold text-gray-500 uppercase mb-1; } .input-sm { @apply w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-green-500 outline-none transition disabled:bg-gray-100; }`}</style>
    </div>
  );
};

export default TransferForm;