import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, TrendingUp, Wallet, FileText,
  CheckCircle, AlertCircle, Trash2, Plus, Download, Clock, Target,
  Eye, ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import { Employee } from '../types';
import { financialRecordsService, ACRStatus, AssetsStatus, FBRStatus, GPFundData } from '../services/financialRecordsService';

type Tab = 'ACR' | 'Assets' | 'GPFund' | 'FBR';

// Progress Circle Component
interface ProgressCircleProps {
  percentage: number;
  missing: number;
  total: number;
  label: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

const ProgressCircle: React.FC<ProgressCircleProps> = ({ percentage, missing, total, label, color }) => {
  const colors = {
    blue: 'from-blue-400 to-blue-600',
    green: 'from-green-400 to-green-600',
    purple: 'from-purple-400 to-purple-600',
    orange: 'from-orange-400 to-orange-600',
  };

  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-36 h-36 mb-4">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke={color === 'blue' ? '#3b82f6' : color === 'green' ? '#22c55e' : color === 'purple' ? '#a855f7' : '#f97316'}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-bold text-gray-800">{Math.round(percentage)}%</p>
          <p className="text-xs text-gray-500 text-center mt-1">{total} total</p>
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-700 text-center">{label}</h3>
      {missing > 0 && (
        <p className="text-sm text-red-600 font-medium mt-2 flex items-center gap-1">
          <AlertCircle size={14} /> {missing} Missing
        </p>
      )}
      {missing === 0 && (
        <p className="text-sm text-green-600 font-medium mt-2 flex items-center gap-1">
          <CheckCircle size={14} /> Complete
        </p>
      )}
    </div>
  );
};

const FinancialRecords: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('ACR');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Status states
  const [acrStatus, setAcrStatus] = useState<ACRStatus | null>(null);
  const [assetsStatus, setAssetsStatus] = useState<AssetsStatus | null>(null);
  const [fbrStatus, setFbrStatus] = useState<FBRStatus | null>(null);
  const [gpFundData, setGpFundData] = useState<GPFundData | null>(null);

  // Modal states
  const [showACRModal, setShowACRModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showFBRModal, setShowFBRModal] = useState(false);
  const [showGPFundModal, setShowGPFundModal] = useState(false);

  // Form states
  const [acrForm, setAcrForm] = useState({
    year: new Date().getFullYear(),
    period_from: '',
    period_to: '',
    score: 'Very Good',
    status: 'Draft',
    title: '',
    remarks: '',
    document: null as File | null
  });

  const [assetForm, setAssetForm] = useState({
    financial_year: new Date().getFullYear().toString() + '-' + (new Date().getFullYear() + 1).toString(),
    submission_date: new Date().toISOString().split('T')[0],
    status: 'Draft',
    remarks: '',
    document: null as File | null
  });

  const [fbrForm, setFbrForm] = useState({
    tax_year: new Date().getFullYear(),
    filer_status: 'Inactive',
    submission_date: new Date().toISOString().split('T')[0],
    tax_paid: 0,
    remarks: '',
    document: null as File | null
  });

  const [gpFundForm, setGpFundForm] = useState({
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    monthly_installment: 0,
    remaining_amount: 0,
    description: 'GP Fund Advance',
    reference_number: '',
    remarks: ''
  });

  useEffect(() => {
    if (!id) return;
    loadEmployee();
  }, [id]);

  const loadEmployee = async () => {
    try {
      const emp = await api.getEmployeeById(id!);
      setEmployee(emp);
      loadAllStatuses();
    } catch (err) {
      notify('error', 'Failed to load employee');
      navigate('/employees');
    }
  };

  const loadAllStatuses = async () => {
    if (!id) return;
    try {
      const [acr, assets, fbr, gpFund] = await Promise.all([
        financialRecordsService.getACRCompletionStatus(id),
        financialRecordsService.getAssetsCompletionStatus(id),
        financialRecordsService.getFBRCompletionStatus(id),
        financialRecordsService.getGPFundRecords(id),
      ]);
      setAcrStatus(acr);
      setAssetsStatus(assets);
      setFbrStatus(fbr);
      setGpFundData(gpFund);
    } catch (err) {
      console.error('Error loading statuses:', err);
    }
  };

  const notify = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateACR = async () => {
    if (!id || !acrForm.period_from || !acrForm.period_to) {
      notify('error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await financialRecordsService.createACR(id, {
        year: acrForm.year,
        periodFrom: acrForm.period_from,
        periodTo: acrForm.period_to,
        score: acrForm.score,
        status: acrForm.status,
        title: acrForm.title,
        remarks: acrForm.remarks,
        document: acrForm.document,
      });
      notify('success', 'ACR created successfully');
      setShowACRModal(false);
      setAcrForm({ ...acrForm, period_from: '', period_to: '' });
      loadAllStatuses();
    } catch (err) {
      notify('error', 'Failed to create ACR');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAsset = async () => {
    if (!id || !assetForm.financial_year) {
      notify('error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await financialRecordsService.createAsset(id, {
        financialYear: assetForm.financial_year,
        submissionDate: assetForm.submission_date,
        status: assetForm.status,
        remarks: assetForm.remarks,
        document: assetForm.document,
      });
      notify('success', 'Asset declaration created successfully');
      setShowAssetModal(false);
      loadAllStatuses();
    } catch (err) {
      notify('error', 'Failed to create asset declaration');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFBR = async () => {
    if (!id) {
      notify('error', 'Employee ID missing');
      return;
    }

    setLoading(true);
    try {
      await financialRecordsService.createFBRRecord(id, {
        taxYear: fbrForm.tax_year,
        filerStatus: fbrForm.filer_status,
        submissionDate: fbrForm.submission_date,
        taxPaid: fbrForm.tax_paid,
        remarks: fbrForm.remarks,
        document: fbrForm.document,
      });
      notify('success', 'FBR tax record created successfully');
      setShowFBRModal(false);
      loadAllStatuses();
    } catch (err) {
      notify('error', 'Failed to create FBR record');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGPFund = async () => {
    if (!id || gpFundForm.amount <= 0) {
      notify('error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await financialRecordsService.createGPFundAdvance(id, {
        amount: gpFundForm.amount,
        date: gpFundForm.date,
        monthlyInstallment: gpFundForm.monthly_installment,
        remainingAmount: gpFundForm.remaining_amount || gpFundForm.amount,
        description: gpFundForm.description,
        referenceNumber: gpFundForm.reference_number,
        remarks: gpFundForm.remarks,
      });
      notify('success', 'GP Fund advance recorded successfully');
      setShowGPFundModal(false);
      setGpFundForm({ ...gpFundForm, amount: 0 });
      loadAllStatuses();
    } catch (err) {
      notify('error', 'Failed to create GP Fund record');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteACR = async (recordId: string) => {
    if (!window.confirm('Delete this ACR record?')) return;

    try {
      await financialRecordsService.deleteACR(recordId);
      notify('success', 'ACR deleted');
      loadAllStatuses();
    } catch (err) {
      notify('error', 'Failed to delete ACR');
    }
  };

  const handleDeleteAsset = async (recordId: string) => {
    if (!window.confirm('Delete this asset declaration?')) return;

    try {
      await financialRecordsService.deleteAsset(recordId);
      notify('success', 'Asset declaration deleted');
      loadAllStatuses();
    } catch (err) {
      notify('error', 'Failed to delete asset');
    }
  };

  const handleDeleteFBR = async (recordId: string) => {
    if (!window.confirm('Delete this FBR record?')) return;

    try {
      await financialRecordsService.deleteFBRRecord(recordId);
      notify('success', 'FBR record deleted');
      loadAllStatuses();
    } catch (err) {
      notify('error', 'Failed to delete FBR record');
    }
  };

  const handleDeleteGPFund = async (recordId: string) => {
    if (!window.confirm('Delete this GP Fund record?')) return;

    try {
      await financialRecordsService.deleteGPFundRecord(recordId);
      notify('success', 'GP Fund record deleted');
      loadAllStatuses();
    } catch (err) {
      notify('error', 'Failed to delete GP Fund record');
    }
  };

  if (!employee) {
    return (
      <div className="max-w-6xl mx-auto pb-20 pt-10">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 pt-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(`/employee/${id}`)} className="p-2 rounded-full hover:bg-gray-200">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-4xl font-bold">Financial & Service Records</h1>
          <p className="text-gray-600 mt-1">
            {employee.fullName} • DOA: {new Date(employee.dateOfAppointment).toLocaleDateString('en-PK')}
          </p>
        </div>
      </div>

      {/* Notification */}
      {message && (
        <div className={`fixed top-6 right-6 px-6 py-3 rounded-xl shadow-xl text-white ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          } z-50`}>
          {message.text}
        </div>
      )}

      {/* Progress Circles Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
        {acrStatus && (
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <ProgressCircle
              percentage={acrStatus.completionPercentage}
              missing={acrStatus.missingACRs}
              total={acrStatus.expectedACRs}
              label="ACRs Record"
              color="blue"
            />
          </div>
        )}
        {assetsStatus && (
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <ProgressCircle
              percentage={assetsStatus.completionPercentage}
              missing={assetsStatus.missingDeclarations}
              total={assetsStatus.expectedDeclarations}
              label="Assets Declaration"
              color="green"
            />
          </div>
        )}
        {fbrStatus && (
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <ProgressCircle
              percentage={fbrStatus.completionPercentage}
              missing={fbrStatus.missingRecords}
              total={fbrStatus.expectedRecords}
              label="FBR Tax Status"
              color="purple"
            />
          </div>
        )}
        {gpFundData && (
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <ProgressCircle
              percentage={gpFundData.summary.total_availed > 0 ? 100 : 0}
              missing={0}
              total={gpFundData.summary.times_availed}
              label="GP Fund History"
              color="orange"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          {(['ACR', 'Assets', 'FBR', 'GPFund'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full px-4 py-3 rounded-lg text-left font-medium transition ${activeTab === tab
                ? 'bg-judiciary-600 text-white shadow-lg'
                : 'bg-white border border-gray-200 hover:border-judiciary-600'
                }`}
            >
              {tab === 'ACR' && <Shield size={18} className="inline mr-2" />}
              {tab === 'Assets' && <FileText size={18} className="inline mr-2" />}
              {tab === 'FBR' && <TrendingUp size={18} className="inline mr-2" />}
              {tab === 'GPFund' && <Wallet size={18} className="inline mr-2" />}
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-4">
          {/* ACR Tab */}
          {activeTab === 'ACR' && acrStatus && (
            <div className="bg-white rounded-xl border p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold">Annual Confidential Reports (ACRs)</h2>
                  <p className="text-sm text-gray-600 mt-2">
                    Minimum duration: 3 months at same posting place • 1 ACR required per year
                  </p>
                  {acrStatus.meetsMinimumDuration && (
                    <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle size={14} /> Currently at same posting for {acrStatus.monthsAtCurrentPosting} months
                    </p>
                  )}
                  {!acrStatus.meetsMinimumDuration && (
                    <p className="text-sm text-orange-600 mt-1 flex items-center gap-1">
                      <AlertCircle size={14} /> Less than 3 months at current posting
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowACRModal(true)}
                  className="bg-judiciary-600 text-white px-4 py-2 rounded-lg hover:bg-judiciary-700 flex items-center gap-2"
                >
                  <Plus size={18} /> Add ACR
                </button>
              </div>

              <div className="space-y-2">
                {acrStatus.submittedACRs > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Year</th>
                          <th className="px-4 py-2 text-left">Period</th>
                          <th className="px-4 py-2 text-left">Score</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Would show list from backend */}
                        <tr className="border-t">
                          <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                            Loading ACR records...
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <AlertCircle size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 font-medium">No ACRs submitted yet</p>
                    <p className="text-sm text-gray-500 mt-1">{acrStatus.missingACRs} required</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assets Declaration Tab */}
          {activeTab === 'Assets' && assetsStatus && (
            <div className="bg-white rounded-xl border p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold">Assets Declaration</h2>
                  <p className="text-sm text-gray-600 mt-2">1 declaration required per financial year (July-June)</p>
                </div>
                <button
                  onClick={() => setShowAssetModal(true)}
                  className="bg-judiciary-600 text-white px-4 py-2 rounded-lg hover:bg-judiciary-700 flex items-center gap-2"
                >
                  <Plus size={18} /> Add Declaration
                </button>
              </div>

              <div className="space-y-2">
                {assetsStatus.submittedDeclarations > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-green-600 font-medium">
                      {assetsStatus.submittedDeclarations} of {assetsStatus.expectedDeclarations} submitted
                    </p>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <AlertCircle size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 font-medium">No asset declarations submitted</p>
                    <p className="text-sm text-gray-500 mt-1">{assetsStatus.missingDeclarations} required</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FBR Tax Status Tab */}
          {activeTab === 'FBR' && fbrStatus && (
            <div className="bg-white rounded-xl border p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold">FBR Tax Status</h2>
                  <p className="text-sm text-gray-600 mt-2">1 tax filing required per calendar year</p>
                </div>
                <button
                  onClick={() => setShowFBRModal(true)}
                  className="bg-judiciary-600 text-white px-4 py-2 rounded-lg hover:bg-judiciary-700 flex items-center gap-2"
                >
                  <Plus size={18} /> Add Record
                </button>
              </div>

              <div className="space-y-2">
                {fbrStatus.submittedRecords > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-green-600 font-medium">
                      {fbrStatus.submittedRecords} of {fbrStatus.expectedRecords} filed
                    </p>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <AlertCircle size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 font-medium">No FBR records submitted</p>
                    <p className="text-sm text-gray-500 mt-1">{fbrStatus.missingRecords} required</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* GP Fund History Tab */}
          {activeTab === 'GPFund' && gpFundData && (
            <div className="bg-white rounded-xl border p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold">GP Fund History</h2>
                  <p className="text-sm text-gray-600 mt-2">Track all GP Fund advances and recoveries</p>
                </div>
                <button
                  onClick={() => setShowGPFundModal(true)}
                  className="bg-judiciary-600 text-white px-4 py-2 rounded-lg hover:bg-judiciary-700 flex items-center gap-2"
                >
                  <Plus size={18} /> Add Record
                </button>
              </div>

              {/* GP Fund Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 font-bold">TOTAL AVAILED</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">
                    {new Intl.NumberFormat('en-PK').format(gpFundData.summary.total_availed)}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-xs text-green-600 font-bold">TIMES AVAILED</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">{gpFundData.summary.times_availed}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <p className="text-xs text-orange-600 font-bold">CURRENT BALANCE</p>
                  <p className="text-2xl font-bold text-orange-700 mt-1">
                    {new Intl.NumberFormat('en-PK').format(gpFundData.summary.current_balance)}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-600 font-bold">MONTHLY DEDUCTION</p>
                  <p className="text-2xl font-bold text-purple-700 mt-1">
                    {new Intl.NumberFormat('en-PK').format(gpFundData.summary.monthly_deduction)}
                  </p>
                </div>
              </div>

              {/* GP Fund Records */}
              {gpFundData.records.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-left">Description</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gpFundData.records.map((record) => (
                        <tr key={record.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3">{new Date(record.date).toLocaleDateString('en-PK')}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${record.type === 'Advance' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                              }`}>
                              {record.type}
                            </span>
                          </td>
                          <td className="px-4 py-3">{record.description}</td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {new Intl.NumberFormat('en-PK').format(record.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDeleteGPFund(record.id)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Wallet size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600 font-medium">No GP Fund records</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ACR Modal */}
      {showACRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">Add ACR Record</h2>
              <button onClick={() => setShowACRModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form className="p-6 space-y-4">
              <input type="hidden" name="employee_id" value={id} />
              <div>
                <label className="block text-sm font-medium mb-1">Year</label>
                <input
                  type="number"
                  value={acrForm.year}
                  onChange={(e) => setAcrForm({ ...acrForm, year: parseInt(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Period From *</label>
                <input
                  type="date"
                  min="1900-01-01"
                  max="3099-12-31"
                  value={acrForm.period_from}
                  onChange={(e) => setAcrForm({ ...acrForm, period_from: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Period To *</label>
                <input
                  type="date"
                  min="1900-01-01"
                  max="3099-12-31"
                  value={acrForm.period_to}
                  onChange={(e) => setAcrForm({ ...acrForm, period_to: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Score</label>
                <select
                  value={acrForm.score}
                  onChange={(e) => setAcrForm({ ...acrForm, score: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option>Outstanding</option>
                  <option>Very Good</option>
                  <option>Good</option>
                  <option>Average</option>
                  <option>Below Average</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Document</label>
                <input
                  type="file"
                  onChange={(e) => setAcrForm({ ...acrForm, document: e.target.files?.[0] || null })}
                  className="w-full border rounded-lg px-3 py-2"
                  accept=".pdf,.doc,.docx,.jpg,.png"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateACR}
                disabled={loading}
                className="w-full bg-judiciary-600 text-white py-2 rounded-lg hover:bg-judiciary-700 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Asset Declaration Modal */}
      {showAssetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">Add Asset Declaration</h2>
              <button onClick={() => setShowAssetModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Financial Year *</label>
                <input
                  type="text"
                  value={assetForm.financial_year}
                  onChange={(e) => setAssetForm({ ...assetForm, financial_year: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="2024-2025"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Submission Date</label>
                <input
                  type="date"
                  min="1900-01-01"
                  max="3099-12-31"
                  value={assetForm.submission_date}
                  onChange={(e) => setAssetForm({ ...assetForm, submission_date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={assetForm.status}
                  onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option>Draft</option>
                  <option>Submitted</option>
                  <option>Verified</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Document</label>
                <input
                  type="file"
                  onChange={(e) => setAssetForm({ ...assetForm, document: e.target.files?.[0] || null })}
                  className="w-full border rounded-lg px-3 py-2"
                  accept=".pdf,.doc,.docx,.jpg,.png"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateAsset}
                disabled={loading}
                className="w-full bg-judiciary-600 text-white py-2 rounded-lg hover:bg-judiciary-700 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FBR Tax Status Modal */}
      {showFBRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">Add FBR Tax Record</h2>
              <button onClick={() => setShowFBRModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tax Year</label>
                <input
                  type="number"
                  value={fbrForm.tax_year}
                  onChange={(e) => setFbrForm({ ...fbrForm, tax_year: parseInt(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Filer Status</label>
                <select
                  value={fbrForm.filer_status}
                  onChange={(e) => setFbrForm({ ...fbrForm, filer_status: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option>Filer</option>
                  <option>Non-Filer</option>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Submission Date</label>
                <input
                  type="date"
                  min="1900-01-01"
                  max="3099-12-31"
                  value={fbrForm.submission_date}
                  onChange={(e) => setFbrForm({ ...fbrForm, submission_date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tax Paid</label>
                <input
                  type="number"
                  value={fbrForm.tax_paid}
                  onChange={(e) => setFbrForm({ ...fbrForm, tax_paid: parseFloat(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Document</label>
                <input
                  type="file"
                  onChange={(e) => setFbrForm({ ...fbrForm, document: e.target.files?.[0] || null })}
                  className="w-full border rounded-lg px-3 py-2"
                  accept=".pdf,.doc,.docx,.jpg,.png"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateFBR}
                disabled={loading}
                className="w-full bg-judiciary-600 text-white py-2 rounded-lg hover:bg-judiciary-700 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* GP Fund Modal */}
      {showGPFundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">Add GP Fund Record</h2>
              <button onClick={() => setShowGPFundModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Amount *</label>
                <input
                  type="number"
                  value={gpFundForm.amount}
                  onChange={(e) => setGpFundForm({ ...gpFundForm, amount: parseFloat(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  min="1900-01-01"
                  max="3099-12-31"
                  value={gpFundForm.date}
                  onChange={(e) => setGpFundForm({ ...gpFundForm, date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Monthly Installment</label>
                <input
                  type="number"
                  value={gpFundForm.monthly_installment}
                  onChange={(e) => setGpFundForm({ ...gpFundForm, monthly_installment: parseFloat(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Remaining Amount</label>
                <input
                  type="number"
                  value={gpFundForm.remaining_amount}
                  onChange={(e) => setGpFundForm({ ...gpFundForm, remaining_amount: parseFloat(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reference Number</label>
                <input
                  type="text"
                  value={gpFundForm.reference_number}
                  onChange={(e) => setGpFundForm({ ...gpFundForm, reference_number: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateGPFund}
                disabled={loading}
                className="w-full bg-judiciary-600 text-white py-2 rounded-lg hover:bg-judiciary-700 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialRecords;
