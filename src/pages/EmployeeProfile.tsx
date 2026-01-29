import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Award, Briefcase, User, Printer, AlertCircle,
  Clock, Shield, FileText, Download, TrendingUp, Wallet, CheckCircle,
  FileStack, Plus, Eye, Scale, Loader2
} from 'lucide-react';
import { Employee, Designation, Tehsil, Headquarter, Unit, Qualification, EmploymentBlock } from '../types';
import { useMasterData } from '../context/MasterDataContext';
import { api } from '../services/api';

const PrintStyles: React.FC = () => (
  <style>{`
    @media print {
      .print-watermark { display: block !important; visibility: visible !important; }
      .print-watermark * { visibility: visible !important; }
      .print-footer { display: flex !important; visibility: visible !important; }
      .print-footer * { visibility: visible !important; }
      @page { size: A4; margin: 15mm; }
      .bg-white, .card { box-shadow: none !important; border: 1px solid #ddd !important; }
      p, h1, h2, h3, h4, span, div { color: black !important; }
      .grid-cols-1, .md\\:grid-cols-2, .lg\\:grid-cols-3 { display: block !important; }
      .grid > div { margin-bottom: 20px; page-break-inside: avoid; }
    }
  `}</style>
);

const EmployeeProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const { headquarters, tehsils, units, qualifications, designations } = useMasterData();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docEdits, setDocEdits] = useState<Record<string, { documentType?: string; description?: string; fileName?: string }>>({});
  const [photoObjectUrl, setPhotoObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [includePdfInPrint, setIncludePdfInPrint] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [reportAction, setReportAction] = useState<'print' | 'download'>('print');
  const [complianceData, setComplianceData] = useState<any>(null);

  useEffect(() => {
    if (id) {
      setLoading(true);
      api.getEmployeeById(id).then(data => {
        setEmployee(data);
        // console.log('[EmployeeProfile] Employee loaded:', data.id, 'photoUrl:', !!data.photoUrl, 'length:', data.photoUrl?.length || 0);
        // console.log('[EmployeeProfile] Employment history blocks:', data.employmentHistory?.length || 0);
        // const totalDisciplinary = data.employmentHistory?.reduce((sum, h) => sum + (h.disciplinaryActions?.length || 0), 0) || 0;
        // console.log('[EmployeeProfile] Total disciplinary actions:', totalDisciplinary);
        setLoading(false);
      });

      api.getEmployeeCompliance(id).then(response => {
        // Extract the actual data from the response object
        const complianceInfo = (response as any)?.data || response;
        console.log('[EmployeeProfile] Compliance data received:', complianceInfo);
        setComplianceData(complianceInfo);
      }).catch(err => console.error('Compliance fetch error:', err));
    }
  }, [id]);

  // For file path images, just use them directly; for old base64 URLs, convert to object URLs
  useEffect(() => {
    if (!employee || !employee.photoUrl) {
      if (photoObjectUrl) {
        URL.revokeObjectURL(photoObjectUrl);
        setPhotoObjectUrl(null);
      }
      return;
    }

    const src = employee.photoUrl;
    let cancelled = false;
    let createdObj: string | null = null;

    const convert = async () => {
      // If it's a file path (e.g., uploads/profiles/...), no conversion needed
      if (!src.startsWith('data:')) {
        if (photoObjectUrl) {
          URL.revokeObjectURL(photoObjectUrl);
          setPhotoObjectUrl(null);
        }
        return;
      }

      // Legacy: Convert data: URLs to object URLs
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error('Fetch failed: ' + res.status);
        const blob = await res.blob();
        if (cancelled) return;
        createdObj = URL.createObjectURL(blob);
        if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
        setPhotoObjectUrl(createdObj);
        return;
      } catch (errFetch) {
        // fallback to manual base64 decode (tolerant cleaning and padding)
        try {
          // Extract everything after the first comma (some data URLs might contain extra commas)
          const commaIndex = src.indexOf(',');
          const meta = commaIndex >= 0 ? src.slice(0, commaIndex) : '';
          let b64 = commaIndex >= 0 ? src.slice(commaIndex + 1) : '';

          // Try percent-decode if necessary
          if (b64.indexOf('%') !== -1) {
            try { b64 = decodeURIComponent(b64); } catch (e) { /* ignore */ }
          }

          // Remove whitespace/newlines and any characters not valid in base64 (be permissive)
          b64 = b64.replace(/\s+/g, '');
          b64 = b64.replace(/[^A-Za-z0-9-_+/=]/g, '');

          // Convert URL-safe base64 to standard base64
          b64 = b64.replace(/-/g, '+').replace(/_/g, '/');

          // Pad to multiple of 4
          while (b64.length % 4 !== 0) {
            b64 += '=';
            // safety: prevent infinite loop
            if (b64.length > 2000000) break;
          }

          const mimeMatch = meta.match(/data:(.*?);base64/) || meta.match(/data:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

          // atob can still throw if the string is badly malformed
          const binary = atob(b64);
          const len = binary.length;
          const u8 = new Uint8Array(len);
          for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
          const blob = new Blob([u8], { type: mime });

          if (cancelled) return;
          createdObj = URL.createObjectURL(blob);
          if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
          setPhotoObjectUrl(createdObj);
          return;
        } catch (errDecode) {
          console.error('[EmployeeProfile] Failed to convert data URL to object URL', errFetch, errDecode, 'metaLen=', (src && src.length) || 0);
          // give up - leave photoObjectUrl unchanged
        }
      }
    };

    convert();

    return () => {
      cancelled = true;
      if (createdObj) {
        URL.revokeObjectURL(createdObj);
      }
    };
  }, [employee?.photoUrl]);

  const viewMode = searchParams.get('mode') || 'all';
  const includePicture = searchParams.get('includePicture') !== 'false';

  const showPersonal = ['personal', 'complete', 'all', 'profile'].includes(viewMode);
  const showService = ['service', 'complete', 'all', 'profile'].includes(viewMode);
  const showFinancial = ['all', 'profile'].includes(viewMode);
  const showDocuments = ['all', 'profile'].includes(viewMode);

  const getDesignation = (id: string) => designations.find((d: Designation) => d.id === id)?.title || id;
  const getTehsil = (id: string) => tehsils.find((t: Tehsil) => t.id === id)?.title || id;
  const getHQ = (id: string) => headquarters.find((h: Headquarter) => h.id === id)?.title || id;
  const getUnit = (id: string) => units.find((u: Unit) => u.id === id)?.title || id;
  const getQualification = (id: string) => qualifications.find((q: Qualification) => q.id === id)?.degreeTitle || 'Unknown';

  // Format date to dd/mm/yyyy
  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '0000-00-00') return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Format file size (bytes) to human readable string
  const formatFileSize = (bytes?: number) => {
    if (bytes === null || bytes === undefined) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(1)} GB`;
  };

  const isPhotoUrlValid = (url?: string) => {
    if (!url) return false;
    try {
      return url.startsWith('data:') || url.startsWith('http') || url.startsWith('/');
    } catch (e) {
      return false;
    }
  };

  const calculateDetailedDuration = (startDate: string, endDate?: string) => {
    if (!startDate || startDate === '0000-00-00') return 'N/A';
    const start = new Date(startDate);
    // Use TODAY for end date if not provided or marked as current
    let end = new Date();
    if (endDate && endDate !== 'PRESENT_PLACEHOLDER') {
      const parsedEnd = new Date(endDate);
      if (!isNaN(parsedEnd.getTime())) end = parsedEnd;
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'Invalid Date';

    // Difference in milliseconds
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) return '0 Days';

    // Total days including both start and end
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate() + 1;

    if (days < 0) {
      months--;
      // Days in previous month
      const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years} Year${years > 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} Month${months > 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);

    return parts.length > 0 ? parts.join(', ') : '0 Days';
  };

  const calculateServiceDuration = (startDate: string) => {
    return calculateDetailedDuration(startDate);
  };

  const calculateTotalInServiceDuration = (history: EmploymentBlock[] = []) => {
    let totalDays = 0;
    history.forEach(block => {
      // Only sum up In-Service blocks
      if (block.status === 'In-Service') {
        const startStr = block.fromDate || block.statusDate || '';
        if (!startStr || startStr === '0000-00-00') return;

        const start = new Date(startStr);
        let end = new Date();
        if (!block.isCurrentlyWorking && block.toDate && block.toDate !== '0000-00-00') {
          end = new Date(block.toDate);
        }

        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          const diff = end.getTime() - start.getTime();
          if (diff >= 0) {
            totalDays += Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
          }
        }
      }
    });

    if (totalDays <= 0) return '0 Days';

    let years = Math.floor(totalDays / 365.25);
    let remainingDays = totalDays - (years * 365.25);
    let months = Math.floor(remainingDays / 30.4375);
    let days = Math.round(remainingDays - (months * 30.4375));

    if (days >= 30) { months++; days -= 30; }
    if (months >= 12) { years++; months -= 12; }

    const parts = [];
    if (years > 0) parts.push(`${years} Year${years > 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} Month${months > 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);

    return parts.length > 0 ? parts.join(', ') : '0 Days';
  };

  // Resolve photo URL stored in DB: may be a data: URL, an absolute URL, a root-relative path
  // or a backend-relative path like "uploads/profiles/..". Return a URL the browser can fetch.
  const resolvePhotoUrl = (url?: string) => {
    if (!url) return '';
    // If data URL, return as-is (handled elsewhere)
    if (url.startsWith('data:')) return url;
    // If absolute URL or root-relative path, return as-is
    if (url.startsWith('http') || url.startsWith('/')) return url;
    // Otherwise treat as backend-relative path; build full URL using REACT_APP_API_URL or default
    const apiIndex = process.env.REACT_APP_API_URL || 'http://localhost/judiciary_hrms/api/index.php';
    const backendBase = apiIndex.replace(/\/index\.php$/i, '').replace(/\/$/, '');
    return `${backendBase}/${url.replace(/^\//, '')}`;
  };

  const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost/judiciary_hrms/api/index.php')
    .replace(/\/index\.php$/i, '')
    .replace(/\/$/, '');

  const buildDocumentUrl = (doc: any) => {
    const docId = doc.id || doc.document_id;
    if (docId) return `${apiBase}/serve_document.php?id=${docId}`;
    const path = doc.filePath || doc.filepath || doc.path;
    return path ? `${apiBase}/${String(path).replace(/^\//, '')}` : '';
  };

  const getDocumentMeta = (doc: any) => {
    const name = doc.fileName || doc.file_name || 'Document';
    const type = doc.documentType || doc.document_type || doc.fileType || 'Unknown';
    const dateRaw = doc.uploadedAt || doc.uploaded_date || doc.uploadedDate;
    const date = dateRaw ? new Date(dateRaw).toLocaleDateString() : 'N/A';
    return { name, type, date };
  };

  const handlePrint = () => {
    if (!employee || !id) return;
    setReportAction('print');
    setShowPrintOptions(true);
  };

  const performPrint = () => {
    if (!employee || !id) return;

    // Fetch the report HTML from the backend
    api.generateReport(id, viewMode, includePdfInPrint).then(response => {
      if (response.success && response.data) {
        // Create a new window with the report HTML
        const printWindow = window.open('', 'PRINT_REPORT');
        if (printWindow) {
          // Backend already includes documents section when includePdfInPrint is true
          let htmlToPrint = response.data.html;

          printWindow.document.write(htmlToPrint);
          printWindow.document.close();

          // Wait for content to load then print
          setTimeout(() => {
            printWindow.print();
            setShowPrintOptions(false);
          }, 250);
        }
      }
    }).catch(error => {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
      setShowPrintOptions(false);
    });
  };

  const handleDownloadPDF = () => {
    if (!employee || !id) return;
    setReportAction('download');
    setShowPrintOptions(true);
  };

  const performDownload = () => {
    if (!employee || !id) return;

    try {
      // Fetch the report HTML from the backend (includes embedded PDFs if includePdfInPrint is true)
      api.generateReport(id, viewMode, includePdfInPrint).then(response => {
        if (response.success && response.data) {
          const filename = `${employee.fullName.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}`;

          // Create a new window with the report HTML
          const printWindow = window.open('', 'PRINT_REPORT');
          if (printWindow) {
            // Use the complete HTML returned from backend (backend now handles document embedding)
            let htmlToPrint = response.data.html;

            // Set document title for PDF filename
            const htmlWithTitle = htmlToPrint.replace(
              /<title>[^<]*<\/title>/,
              `<title>${filename}</title>`
            ).replace(/<title>/, `<title>${filename}</title>`);

            printWindow.document.write(htmlWithTitle);
            printWindow.document.close();

            // Trigger print dialog after content is fully loaded (use single approach, not multiple)
            let printTriggered = false;
            const triggerPrint = () => {
              if (!printTriggered && printWindow && !printWindow.closed) {
                printTriggered = true;
                printWindow.focus();
                setTimeout(() => {
                  printWindow.print();
                  setShowPrintOptions(false);
                }, 300);
              }
            };

            // Try to detect when content is ready
            printWindow.onload = triggerPrint;

            // Fallback timeout if onload doesn't fire
            setTimeout(triggerPrint, 2000);
          }
        }
      }).catch(error => {
        console.error('Error generating report:', error);
        alert('Failed to generate report. Please try again.');
        setShowPrintOptions(false);
      });
    } catch (error) {
      console.error('Error in PDF download:', error);
      alert('Failed to generate report. Please try again.');
      setShowPrintOptions(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-judiciary-600" size={48} />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Employee Not Found</h2>
        <button
          onClick={() => navigate('/employees')}
          className="px-6 py-2 bg-judiciary-600 text-white rounded-lg hover:bg-judiciary-700 transition"
        >
          Return to Directory
        </button>
      </div>
    );
  }

  const currentPosting = employee.employmentHistory?.[0];

  const getViewTitle = () => {
    switch (viewMode) {
      case 'personal': return 'Personal Information';
      case 'service': return 'Service Record';
      case 'financial': return 'Financial & ACRs';
      case 'documents': return 'Documents Repository';
      case 'all': return 'Complete Profile';
      default: return 'Profile View';
    }
  };

  return (
    <div id="profile-print-container" className="max-w-5xl mx-auto pb-12 relative w-full">
      <PrintStyles />

      {/* Print Watermark */}
      <div className="hidden print-watermark fixed inset-0 z-[-1] pointer-events-none">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -rotate-45 opacity-5 flex flex-col items-center justify-center">
          <Scale size={500} className="text-gray-900" />
          <h1 className="text-7xl font-black text-gray-900 mt-4 uppercase tracking-widest text-center border-8 border-gray-900 p-10">
            District Judiciary<br />Punjab
          </h1>
        </div>
      </div>

      {/* Print Footer */}
      <div className="hidden print-footer fixed bottom-0 left-0 right-0 justify-between items-center text-[10px] text-gray-600 border-t border-gray-400 pt-2 bg-white px-8 pb-4">
        <span className="font-semibold uppercase">HR Management System - Confidential Report</span>
        <span>Generated on: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</span>
        <span>Page <span className="pageNumber"></span></span>
      </div>

      {/* Print Header */}
      <div className="hidden print-only flex-row items-center gap-6 mb-8 border-b-2 border-black pb-6 pt-4 px-4">
        {includePicture && (
          <div className="w-28 h-28 border border-gray-300 overflow-hidden shrink-0">
            {isPhotoUrlValid(employee.photoUrl) ? (
              <img
                src={(employee.photoUrl && employee.photoUrl.startsWith('data:')) ? (photoObjectUrl || employee.photoUrl) : resolvePhotoUrl(employee.photoUrl)}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                <User size={40} />
              </div>
            )}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-black uppercase mb-1">{employee.fullName}</h1>
          <p className="text-lg text-black font-semibold">
            {getDesignation(currentPosting?.designationId || '')} ({currentPosting?.bps || 'N/A'})
          </p>
          <div className="flex flex-col gap-1 mt-2 text-sm text-black">
            <span><strong>CNIC:</strong> {employee.cnic}</span>
            <span><strong>Current Posting:</strong> {getUnit(currentPosting?.unitId || '')} - {currentPosting?.postingPlaceTitle || 'N/A'}, {getTehsil(currentPosting?.tehsilId || '')}</span>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold uppercase tracking-wide border-b border-black mb-1">{getViewTitle()}</h2>
          <p className="text-sm">District Judiciary Punjab</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mb-6 no-print">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-judiciary-600 transition-colors"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-600 uppercase tracking-wide">
          View Mode: {getViewTitle()}
        </div>
      </div>

      {/* Profile Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8 relative no-print">
        <div className="h-32 bg-gradient-to-r from-judiciary-800 to-judiciary-600"></div>
        <div className="px-8 pb-8">
          <div className="relative flex flex-col md:flex-row items-start md:items-end gap-6 -mt-12">
            {includePicture && (
              <div className="w-32 h-32 rounded-xl bg-white p-1 shadow-lg overflow-hidden flex-shrink-0">
                {isPhotoUrlValid(employee.photoUrl) ? (
                  <img
                    src={(employee.photoUrl && employee.photoUrl.startsWith('data:')) ? (photoObjectUrl || employee.photoUrl) : resolvePhotoUrl(employee.photoUrl)}
                    alt={employee.fullName}
                    className="w-full h-full object-cover rounded-lg bg-gray-100"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 rounded-lg">
                    <User size={48} />
                  </div>
                )}
              </div>
            )}
            <div className="flex-1 pt-2 md:pt-0">
              <h1 className="text-3xl font-bold text-gray-900">{employee.fullName}</h1>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Briefcase size={16} className="text-judiciary-600" />
                  {getDesignation(currentPosting?.designationId || '')} ({currentPosting?.bps || 'N/A'})
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={16} className="text-judiciary-600" />
                  {getTehsil(currentPosting?.tehsilId || '')}
                </span>
                <span className="flex items-center gap-1.5">
                  <Award size={16} className="text-judiciary-600" />
                  {employee.degreeTitle || (employee.qualificationId ? getQualification(employee.qualificationId) : 'Unknown')}
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-4 md:mt-0">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium shadow-sm transition-all active:scale-95"
              >
                <Printer size={18} /> Print Report
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium shadow-sm transition-all active:scale-95"
              >
                <Download size={18} /> Download PDF
              </button>
              <button
                onClick={() => navigate(`/edit-employee/${id}`)}
                className="px-4 py-2 bg-judiciary-600 text-white rounded-lg hover:bg-judiciary-700 shadow-sm font-medium"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Warning Section */}
      {complianceData && (complianceData.missingYearsACR?.length > 0 || complianceData.missingYearsAssets?.length > 0 || complianceData.missingYearsFBR?.length > 0) && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 rounded-r-xl shadow-sm no-print">
          <div className="flex items-start gap-3">
            <Shield size={24} className="text-red-600 mt-1" />
            <div>
              <h3 className="text-lg font-bold text-red-800">Administrative Compliance Alerts</h3>
              <p className="text-sm text-red-600 mb-3">This employee has missing mandatory filings based on their Service History and Appointment Date ({formatDate(employee.dateOfAppointment)}).</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {complianceData.missingYearsACR?.length > 0 && (
                  <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                    <p className="text-xs font-black text-red-500 uppercase mb-1">Missing ACRs</p>
                    <div className="flex flex-wrap gap-1">
                      {complianceData.missingYearsACR.map((y: any) => (
                        <span key={y} className="px-2 py-0.5 bg-red-50 text-red-700 text-[10px] font-bold rounded border border-red-200">{y}</span>
                      ))}
                    </div>
                  </div>
                )}

                {complianceData.missingYearsAssets?.length > 0 && (
                  <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                    <p className="text-xs font-black text-red-500 uppercase mb-1">Missing Assets (FY)</p>
                    <div className="flex flex-wrap gap-1">
                      {complianceData.missingYearsAssets.map((y: any) => (
                        <span key={y} className="px-2 py-0.5 bg-red-50 text-red-700 text-[10px] font-bold rounded border border-red-200">{y}</span>
                      ))}
                    </div>
                  </div>
                )}

                {complianceData.missingYearsFBR?.length > 0 && (
                  <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                    <p className="text-xs font-black text-red-500 uppercase mb-1">Missing FBR (Tax Year)</p>
                    <div className="flex flex-wrap gap-1">
                      {complianceData.missingYearsFBR.map((y: any) => (
                        <span key={y} className="px-2 py-0.5 bg-red-50 text-red-700 text-[10px] font-bold rounded border border-red-200">{y}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Personal Details */}
        {showPersonal && (
          <div className={`space-y-6 ${viewMode === 'personal' ? 'lg:col-span-3' : 'lg:col-span-1'}`}>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 break-inside-avoid">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                <User size={20} className="text-judiciary-600" /> Personal Details
              </h3>
              <div className={`grid gap-4 ${viewMode === 'personal' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">CNIC</label>
                  <p className="text-gray-800 font-medium font-mono">{employee.cnic}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Gender</label>
                  <p className="text-gray-800 font-medium capitalize">{employee.gender || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Father Name</label>
                  <p className="text-gray-800 font-medium">{employee.fatherName}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Date of Birth</label>
                  <p className="text-gray-800 font-medium">{formatDate(employee.dob)}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Date of Appointment</label>
                  <p className="text-gray-800 font-medium">{formatDate(employee.dateOfAppointment)}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total Service</label>
                  <div className="flex items-center gap-1.5 text-judiciary-700 font-bold">
                    <Clock size={14} />
                    <p>{calculateTotalInServiceDuration(employee.employmentHistory)}</p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Domicile</label>
                  <p className="text-gray-800 font-medium">{employee.domicile}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Religion</label>
                  <p className="text-gray-800 font-medium">{employee.religion}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Contact</label>
                  <p className="text-gray-800 font-medium">{employee.contactPrimary}</p>
                </div>
                <div className={viewMode === 'personal' ? 'md:col-span-2' : ''}>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Permanent Address</label>
                  <p className="text-gray-800 font-medium whitespace-pre-line">
                    {employee.addressPermanent}
                  </p>
                </div>
                {employee.addressTemporary && !employee.sameAsPermanent && (
                  <div className={viewMode === 'personal' ? 'md:col-span-2' : ''}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Temporary Address</label>
                    <p className="text-gray-800 font-medium whitespace-pre-line">
                      {employee.addressTemporary}
                    </p>
                  </div>
                )}
                {employee.sameAsPermanent && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Address Note</label>
                    <p className="text-gray-800 font-medium">Temporary address is same as permanent</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className={`${(showPersonal && viewMode !== 'personal') ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-6`}>
          {/* Financial Section */}
          {showFinancial && (
            <div className="space-y-6">
              {/* ACRs Record */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 break-inside-avoid">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2 border-b pb-2">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Shield size={20} className="text-purple-600" /> ACRs Record
                  </h3>
                </div>
                <div className="overflow-x-auto border rounded-lg border-gray-200">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-500 font-semibold border-b">
                      <tr>
                        <th className="p-2">Year</th>
                        <th className="p-2">Period</th>
                        <th className="p-2">Score</th>
                        <th className="p-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(employee.acrs || []).length > 0 ? (
                        (employee.acrs || [])
                          .sort((a, b) => b.year - a.year)
                          .map(acr => (
                            <tr key={acr.id} className="hover:bg-gray-50">
                              <td className="p-2 font-bold text-gray-800">{acr.year}</td>
                              <td className="p-2 text-gray-600">{acr.periodFrom} to {acr.periodTo}</td>
                              <td className="p-2">
                                <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-bold border border-green-100">
                                  {acr.score}
                                </span>
                              </td>
                              <td className="p-2 text-right text-gray-500">{acr.status}</td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-gray-400">
                            No ACRs uploaded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Assets & FBR */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 break-inside-avoid">
                {/* Assets Declaration */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                    <TrendingUp size={20} className="text-blue-600" /> Assets Declaration
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(employee.assets || []).length > 0 ? (
                      (employee.assets || []).map(asset => (
                        <div key={asset.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded border border-gray-100">
                          <span className="text-gray-700 font-medium">FY {asset.financialYear}</span>
                          <span className="text-green-600 text-xs font-bold flex items-center gap-1">
                            <CheckCircle size={10} /> Submitted
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-center text-gray-400 py-2">No assets declared.</p>
                    )}
                  </div>
                </div>

                {/* FBR Tax Status */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                    <FileText size={20} className="text-teal-600" /> FBR Tax Status
                  </h3>
                  {(employee.fbrRecords || []).length > 0 ? (
                    <div className="space-y-3">
                      {(employee.fbrRecords || []).map(record => (
                        <div key={record.id} className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Tax Year: {record.taxYear}</span>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${record.filerStatus === 'Active' || record.filerStatus === 'Filer' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                              {record.filerStatus}
                            </span>
                          </div>
                          {record.submissionDate && (
                            <p className="text-sm text-gray-600 mt-1">Submitted: {formatDate(record.submissionDate)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center mt-4">No FBR records available.</p>
                  )}
                </div>
              </div>

              {/* GP Fund History */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 break-inside-avoid">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                  <Wallet size={20} className="text-green-600" /> GP Fund History
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-center">
                    <p className="text-xs text-gray-500 uppercase font-bold">Total Availed</p>
                    <p className="text-lg font-bold text-gray-800">
                      {employee.gpFundSummary?.totalAvailed?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-center">
                    <p className="text-xs text-gray-500 uppercase font-bold">Times Availed</p>
                    <p className="text-lg font-bold text-gray-800">
                      {employee.gpFundSummary?.timesAvailed || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-100 text-center">
                    <p className="text-xs text-green-700 uppercase font-bold">Current Balance</p>
                    <p className="text-lg font-bold text-green-800">
                      {employee.gpFundSummary?.currentBalance?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-center">
                    <p className="text-xs text-gray-500 uppercase font-bold">Deduction</p>
                    <p className="text-lg font-bold text-gray-800">
                      {employee.gpFundSummary?.monthlyDeduction?.toLocaleString() || '0'}
                    </p>
                  </div>
                </div>

                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-100 text-gray-600 border-b">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Type</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(employee.gpFundHistory || []).map(gp => (
                      <tr key={gp.id}>
                        <td className="p-3 text-gray-600">{gp.date}</td>
                        <td className="p-3 font-medium text-gray-800">{gp.description}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold ${gp.type === 'Advance' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                            {gp.type}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold">{gp.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Service History */}
          {showService && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 break-inside-avoid">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                  <Briefcase size={20} className="text-judiciary-600" /> Service History
                </h3>
                <div className="relative pl-4 border-l-2 border-gray-200 space-y-8">
                  {(() => {
                    const rejoinableStatuses = ['Resigned', 'Terminated', 'OSD', 'Deputation', 'Suspended', 'Absent', 'Remove'];
                    const history = employee.employmentHistory || [];

                    // Categorize records
                    const current = history.filter(h => h.isCurrentlyWorking && h.status === 'In-Service');
                    const retired = history.filter(h => h.status === 'Retired' || h.status === 'Deceased');
                    const nonRejoined = history.filter(h =>
                      rejoinableStatuses.includes(h.status) &&
                      !h.isCurrentlyWorking &&
                      h.id === history.find(hh => rejoinableStatuses.includes(hh.status) && !hh.isCurrentlyWorking)?.id
                    );
                    const other = history.filter(h =>
                      (h.status === 'In-Service' && !h.isCurrentlyWorking) ||
                      (rejoinableStatuses.includes(h.status) && !nonRejoined.find(nr => nr.id === h.id))
                    );

                    // Reorder: current first, then retired/deceased, then non-rejoined, then others
                    const sortedHistory = [...current, ...retired, ...nonRejoined, ...other];

                    return sortedHistory.map((block, displayIdx) => {
                      const originalIdx = history.indexOf(block);
                      const isRejoinCase = rejoinableStatuses.includes(block.status) && !block.isCurrentlyWorking && block.statusDate;
                      const nextBlock = history[originalIdx + 1];
                      const isTerminal = block.status === 'Retired' || block.status === 'Deceased';

                      // Determine start and end dates for display
                      // Prefer statusDate (explicit change date) then fromDate then toDate
                      const valid = (s?: string) => s && s !== '0000-00-00';
                      const prefer = (b: EmploymentBlock): string => {
                        if (valid(b.statusDate)) return b.statusDate as string;
                        if (valid(b.fromDate)) return b.fromDate as string;
                        if (valid(b.toDate)) return b.toDate as string;
                        return '';
                      };

                      let startRaw = prefer(block) || '';
                      let endRaw = '';

                      // If currently working OR it's an exit status that hasn't been closed by a rejoin
                      const isExitStatus = rejoinableStatuses.includes(block.status);
                      if (block.isCurrentlyWorking || (isExitStatus && !valid(block.toDate) && !isTerminal)) {
                        endRaw = 'PRESENT_PLACEHOLDER';
                        // For exit statuses, we use statusDate as start for the "Since" duration
                        if (isExitStatus && valid(block.statusDate)) {
                          startRaw = block.statusDate!;
                        } else if (valid(block.fromDate)) {
                          startRaw = block.fromDate!;
                        }
                      } else {
                        // closed posting: prefer toDate as end, else statusDate, else nextBlock boundary
                        if (valid(block.toDate)) endRaw = String(block.toDate);
                        else if (valid(block.statusDate)) endRaw = String(block.statusDate);
                        else if (nextBlock && valid(nextBlock.fromDate)) {
                          try {
                            const d = new Date(nextBlock.fromDate);
                            d.setDate(d.getDate() - 1);
                            endRaw = d.toISOString().split('T')[0];
                          } catch (e) {
                            endRaw = '';
                          }
                        }
                      }

                      const startDisplay = startRaw ? formatDate(startRaw) : 'N/A';
                      const endDisplay = endRaw === 'PRESENT_PLACEHOLDER' ? 'Present' : (endRaw ? formatDate(endRaw) : 'N/A');

                      return (
                        <div key={block.id} className="relative break-inside-avoid">
                          <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-white ${displayIdx === 0 ? 'bg-judiciary-600 ring-4 ring-judiciary-50' : 'bg-gray-300'
                            }`}></div>
                          <div className={`rounded-lg p-5 border transition-colors ${isTerminal ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100 hover:border-judiciary-200'
                            }`}>
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-3">
                              <div>
                                <h4 className="text-base font-bold text-gray-900">{getDesignation(block.designationId)}</h4>
                                <p className="text-judiciary-700 font-medium text-sm">
                                  {getUnit(block.unitId)} - {block.postingPlaceTitle}
                                </p>
                                <p className="text-gray-500 text-xs mt-1">
                                  {getTehsil(block.tehsilId)}, {getHQ(block.hqId)}
                                </p>
                                {block.orderNumber && (
                                  <p className="text-xs text-blue-600 font-mono mt-1 bg-blue-50 w-fit px-1.5 rounded border border-blue-100">
                                    Order: {block.orderNumber}
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold mb-1 ${block.status === 'In-Service' && block.isCurrentlyWorking
                                  ? 'bg-green-100 text-green-700'
                                  : isTerminal ? 'bg-red-200 text-red-700' : 'bg-gray-200 text-gray-600'
                                  }`}>
                                  {block.status === 'In-Service' && block.isCurrentlyWorking ? 'Current Posting' : block.status}
                                </span>
                                <p className="text-[10px] text-gray-500 font-mono mt-0.5 whitespace-nowrap">
                                  {(() => {
                                    // Special handling for terminal statuses - show ONLY the status date
                                    if (block.status === 'Retired') return `Retired on ${formatDate(block.statusDate!)}`;
                                    if (block.status === 'Deceased') return `Deceased on ${formatDate(block.statusDate!)}`;

                                    // For non In-Service statuses with a statusDate, show 'Since' only if active
                                    if (block.status !== 'In-Service' && valid(block.statusDate)) {
                                      // If closed (no longer current and has an end date), show the range instead of "Since"
                                      if (!block.isCurrentlyWorking && endRaw && endRaw !== 'PRESENT_PLACEHOLDER') {
                                        return `${startDisplay} — ${endDisplay}`;
                                      }
                                      return `Since ${formatDate(block.statusDate!)}`;
                                    }
                                    // Otherwise show start — end
                                    return `${startDisplay} — ${endDisplay}`;
                                  })()}
                                </p>
                                <div className="flex items-center justify-end gap-1 text-[10px] text-judiciary-600 font-bold mt-1">
                                  <Clock size={10} />
                                  <span>{(() => {
                                    // For terminal statuses (Retired/Deceased), show duration from status date to TODAY
                                    if (isTerminal && valid(block.statusDate)) {
                                      return calculateDetailedDuration(block.statusDate!, undefined);
                                    }
                                    // For all other cases, use the calculated start and end
                                    return calculateDetailedDuration(startRaw, endRaw);
                                  })()}</span>
                                </div>
                              </div>
                            </div>

                            {/* Main Info Row */}
                            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200/60">
                              <div className="text-xs text-gray-600">
                                <span className="font-semibold">BPS:</span> {block.bps}
                              </div>
                              {block.status === 'Retired' && block.statusDate && (
                                <div className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded border border-blue-100">
                                  <span className="font-semibold">Retired on:</span> {formatDate(block.statusDate)}
                                </div>
                              )}
                              {block.status === 'Deceased' && block.statusDate && (
                                <div className="text-xs bg-gray-300 text-gray-800 px-2.5 py-1 rounded border border-gray-400">
                                  <span className="font-semibold">Deceased on:</span> {formatDate(block.statusDate)}
                                </div>
                              )}
                              {isRejoinCase && nextBlock && (
                                <div className="text-xs bg-orange-50 text-orange-700 px-2.5 py-1 rounded border border-orange-100">
                                  <span className="font-semibold">{block.status} from:</span> {startDisplay} to {endDisplay}
                                </div>
                              )}
                            </div>

                            {/* Leaves Section */}
                            {(block.leaves?.length ?? 0) > 0 && (
                              <div className="mt-4 pt-4 border-t border-gray-200/60">
                                <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Leave Record(s)</h5>
                                <div className="grid gap-2">
                                  {block.leaves?.map((leave, leaveIdx) => (
                                    <div key={`leave-${leaveIdx}`} className="bg-white p-3 rounded border border-yellow-100 text-xs">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1">
                                          <span className="font-semibold text-gray-800">{leave.type || 'Leave'}</span>
                                          <span className="text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full ml-2">
                                            {leave.days || 0} days
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-gray-600 mt-1">
                                        {formatDate(leave.startDate)} to {formatDate(leave.endDate)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Disciplinary Actions Section */}
                            <div className="mt-4 pt-4 border-t border-gray-200/60">
                              <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <Scale size={16} /> Disciplinary Record(s)
                              </h5>
                              {(block.disciplinaryActions?.length ?? 0) > 0 ? (
                                <div className="grid gap-2">
                                  {block.disciplinaryActions?.map((action, actionIdx) => (
                                    <div key={`action-${actionIdx}`} className="bg-white p-4 rounded-xl border border-red-100 shadow-sm text-xs relative overflow-hidden">
                                      <div className="absolute top-0 right-0 p-2">
                                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] ${action.inquiryStatus === 'Decided'
                                            ? 'bg-green-100 text-green-700 border border-green-200'
                                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                                          }`}>
                                          {action.inquiryStatus || (action.decision ? 'Decided' : 'Pending')}
                                        </span>
                                      </div>

                                      <div className="flex-1 mb-3">
                                        <span className="font-bold text-gray-900 text-sm block">Allegation: {action.allegation || 'N/A'}</span>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
                                        <div className="space-y-2">
                                          {action.complaintInquiry && (
                                            <div><span className="font-semibold text-gray-500 uppercase text-[10px] block">Complaint/Inquiry No:</span> {action.complaintInquiry}</div>
                                          )}
                                          {action.courtName && (
                                            <div><span className="font-semibold text-gray-500 uppercase text-[10px] block">Court Name:</span> {action.courtName}</div>
                                          )}
                                        </div>

                                        <div className="flex flex-wrap gap-2 items-start content-start">
                                          <div className="flex flex-col bg-gray-50 p-2 rounded border border-gray-100 min-w-[120px]">
                                            <span className="text-[9px] font-bold text-gray-400 uppercase">Inquiry Started</span>
                                            <span className="font-bold text-gray-800">{formatDate(action.actionDate)}</span>
                                          </div>

                                          {action.inquiryStatus === 'Decided' && action.decisionDate && (
                                            <div className="flex flex-col bg-green-50 p-2 rounded border border-green-100 min-w-[120px]">
                                              <span className="text-[9px] font-bold text-green-500 uppercase">Inquiry Decided</span>
                                              <span className="font-bold text-green-800">{formatDate(action.decisionDate)}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {(action.decision || action.remarks) && (
                                        <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                                          {action.decision && (
                                            <div className="bg-red-50/50 p-2.5 rounded-lg border border-red-50">
                                              <span className="font-bold text-red-700 uppercase text-[10px] block mb-1">Decision Details:</span>
                                              <p className="text-gray-800 leading-relaxed font-medium">{action.decision}</p>
                                            </div>
                                          )}
                                          {action.remarks && (
                                            <div><span className="font-bold text-gray-500 uppercase text-[10px] block">Additional Remarks:</span> <span className="text-gray-600">{action.remarks}</span></div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-4 text-gray-400 bg-green-50 rounded-lg border border-green-100">
                                  <CheckCircle size={24} className="mx-auto mb-2 text-green-600" />
                                  <p className="text-sm text-gray-600">No disciplinary records found</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Documents Repository */}
          {showDocuments && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 break-inside-avoid">
              <div className="flex justify-between items-center mb-6 border-b pb-2">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <FileStack size={20} className="text-orange-600" /> Documents Repository
                </h3>
                <button
                  onClick={() => navigate(`/documents/${id}`)}
                  className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold border border-orange-100 hover:bg-orange-100 flex items-center gap-1 transition no-print"
                >
                  <Plus size={14} /> Add New
                </button>
              </div>

              {/* Documents Preview Section */}
              {(!employee.documents || employee.documents.length === 0) ? (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <FileText size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No documents uploaded yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Document List and Previews */}
                  {(employee.documents || []).map((doc, idx) => {
                    const fileName = (doc as any).file_name || doc.fileName || '';
                    const fileType = (doc as any).document_type || doc.documentType || doc.fileType || '';
                    const isPDF = fileName.toLowerCase().endsWith('.pdf') || fileType.toLowerCase().includes('pdf');
                    const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName);
                    const serveUrl = buildDocumentUrl(doc);

                    return (
                      <div key={doc.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Document Header/Info */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="p-2 bg-orange-50 text-orange-600 rounded">
                              <FileText size={18} />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-gray-700">{doc.fileName}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {doc.documentType && <span className="inline-block mr-3 px-2 py-1 bg-gray-100 rounded">{doc.documentType}</span>}
                                <span className="inline-block">{new Date(doc.uploadedAt || '').toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 no-print">
                            {serveUrl && (
                              <a
                                href={serveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold border border-blue-100 hover:bg-blue-100 transition flex items-center gap-1"
                                title="Preview"
                              >
                                <Eye size={14} /> Preview
                              </a>
                            )}
                            <a
                              href={serveUrl}
                              download={doc.fileName}
                              className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-semibold border border-green-100 hover:bg-green-100 transition flex items-center gap-1"
                              title="Download"
                            >
                              <Download size={14} /> Download
                            </a>
                          </div>
                        </div>

                        {/* Document Preview */}
                        {isPDF && (
                          <div className="p-4 bg-gray-100 border-t">
                            <div className="text-xs text-gray-600 mb-2">PDF Preview:</div>
                            <iframe
                              src={serveUrl}
                              className="w-full border border-gray-300 rounded"
                              style={{ height: '500px' }}
                              title={`Preview of ${doc.fileName}`}
                            />
                            <div className="text-xs text-gray-500 mt-2 text-center">
                              <a href={serveUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-semibold">
                                📖 Open in Full Screen
                              </a>
                            </div>
                          </div>
                        )}

                        {isImage && (
                          <div className="p-4 bg-gray-100 border-t flex justify-center">
                            <img
                              src={serveUrl}
                              alt={doc.fileName}
                              className="max-w-full max-h-96 rounded border border-gray-300"
                            />
                          </div>
                        )}

                        {!isPDF && !isImage && (
                          <div className="p-4 bg-gray-50 border-t text-center">
                            <p className="text-sm text-gray-600 mb-2">
                              📄 {doc.fileType || 'Document'}
                            </p>
                            <a
                              href={serveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                            >
                              Open in New Tab
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Print Options Dialog */}
      {showPrintOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowPrintOptions(false)}>
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FileText size={20} className="text-judiciary-600" />
              Print Report Options
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Include attached PDFs</p>
                  <p className="text-xs text-gray-500">Adds documents to print/download output.</p>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={includePdfInPrint}
                    onChange={(e) => setIncludePdfInPrint(e.target.checked)}
                    className="w-4 h-4 text-judiciary-600 rounded"
                  />
                  Include PDFs
                </label>
              </div>

              {includePdfInPrint && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-800">Attached documents</p>
                  {(employee.documents || []).length === 0 ? (
                    <div className="text-xs text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-3">
                      No documents uploaded for this employee.
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {(employee.documents || []).map((doc: any, idx: number) => {
                        const meta = getDocumentMeta(doc);
                        const url = buildDocumentUrl(doc);
                        return (
                          <div key={doc.id || idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-gray-800">{meta.name}</div>
                                <div className="text-xs text-gray-600 mt-1 flex gap-3">
                                  <span className="px-2 py-0.5 bg-white border border-gray-200 rounded">{meta.type}</span>
                                  <span>{meta.date}</span>
                                </div>
                              </div>
                              {url && (
                                <div className="flex gap-2 no-print">
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded hover:bg-blue-100"
                                  >
                                    Preview
                                  </a>
                                  <a
                                    href={url}
                                    download={meta.name}
                                    className="px-2 py-1 text-xs font-semibold text-green-600 bg-green-50 border border-green-100 rounded hover:bg-green-100"
                                  >
                                    Download
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => (reportAction === 'download' ? performDownload() : performPrint())}
                  className="flex-1 px-4 py-2 bg-judiciary-600 text-white rounded-lg hover:bg-judiciary-700 font-medium transition"
                >
                  {reportAction === 'download' ? 'Download with current options' : 'Print with current options'}
                </button>
                <button
                  onClick={() => setShowPrintOptions(false)}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeProfile;