import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserCheck, UserMinus, Clock, MapPin,
  Search, Filter, Download, ArrowUpRight, Award,
  CheckCircle2, AlertCircle, FileText, Briefcase, FilterX,
  Building2, Calendar, CheckCircle, PieChart as PieChartIcon
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LabelList, Label
} from 'recharts';
import api from '../services/api';
import HQTehsilFilter from '../components/HQTehsilFilter';
import CategorizedPostingChart from '../components/CategorizedPostingChart';
import EmployeeRankChart from '../components/EmployeeRankChart';
import ServiceQualityChart from '../components/ServiceQualityChart';
import ComplianceChart from '../components/ComplianceChart';
import DrillDownModal from '../components/DrillDownModal';

interface DashboardMetrics {
  disciplinary: any[];
  seniority: any[];
  compliance: any[];
  qualifications: any[];
  gender: any[];
  religion: any[];
  domicile: any[];
  designations: any[];
  courtsByCategory: any[];
  gpFund: any[];
  hqDistribution: any[];
  leavesToday: any[];
  inactiveStatus: any[];
}

const COLORS = [
  '#0f172a', // Slate 900
  '#dc2626', // Red 600
  '#2563eb', // Blue 600
  '#7c3aed', // Violet 600
  '#059669', // Emerald 600
  '#d97706', // Amber 600
  '#db2777', // Pink 600
  '#475569'  // Slate 600
];

const AdvancedDashboard: React.FC = () => {
  const [hqIds, setHqIds] = useState<string[]>([]);
  const [tehsilIds, setTehsilIds] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'active' | 'non-active'>('active');

  // Total employees for compliance percentages
  const [totalEmps, setTotalEmps] = useState(0);

  // Drilldown Modal State
  const [drillModalOpen, setDrillModalOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillEmployees, setDrillEmployees] = useState<any[]>([]);
  const [drillUnits, setDrillUnits] = useState<any[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  useEffect(() => {
    fetchMetrics();
    fetchTotalCount();
  }, [hqIds, tehsilIds]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const hqParam = hqIds.join(',');
      const tehsilParam = tehsilIds.join(',');
      const response = await api.getDashboardAdvancedMetrics(hqParam, tehsilParam);
      const data = (response as any)?.data || response;
      // Ensure all counts are numbers
      const sanitized: any = {};
      Object.keys(data).forEach(key => {
        sanitized[key] = data[key].map((item: any) => ({
          ...item,
          count: Number(item.count)
        }));
      });
      setMetrics(sanitized);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  const fetchTotalCount = async () => {
    try {
      const hqParam = hqIds.join(',');
      const tehsilParam = tehsilIds.join(',');
      const response = await api.getDashboardStats(hqParam, tehsilParam);
      const stats = (response as any)?.stats || response;
      setTotalEmps(stats.inService || 0);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleDrillDown = async (type: string, value: string, title: string, forcedActiveType?: string) => {
    try {
      console.log('=== handleDrillDown called ===', { type, value, title });
      setDrillTitle(title);
      setDrillModalOpen(true);
      setDrillLoading(true);
      setDrillEmployees([]);
      setDrillUnits([]);

      const hqParam = hqIds.length > 0 ? hqIds.join(',') : undefined;
      const tehsilParam = tehsilIds.length > 0 ? tehsilIds.join(',') : undefined;


      if (type === 'court_category') {
        console.log('Fetching units for category:', value);
        const response = await api.getDashboardDrilldown('units_by_category', value, hqParam, tehsilParam, forcedActiveType || activeType);
        console.log('Units API response:', response);
        const data = (response as any)?.data || response || [];
        console.log('Extracted units:', data);
        setDrillUnits(data);
      } else {
        console.log('Fetching employees for type:', type);
        const response = await api.getDashboardDrilldown(type, value, hqParam, tehsilParam, forcedActiveType || activeType);
        console.log('Employees API response:', response);
        const data = (response as any)?.data || response || [];
        console.log('Extracted employees:', data);
        setDrillEmployees(data);
      }
    } catch (err: any) {
      console.error('Drilldown error:', err);
    } finally {
      setDrillLoading(false);
    }
  };

  const handleUnitClick = async (unitTitle: string, unitId: string) => {
    try {
      console.log('=== handleUnitClick called ===', { unitTitle, unitId, hqIds, tehsilIds, activeType });
      setDrillLoading(true);
      setDrillTitle(`Personnel: ${unitTitle}`);
      setDrillUnits([]);
      const hqParam = hqIds.length > 0 ? hqIds.join(',') : undefined;
      const tehsilParam = tehsilIds.length > 0 ? tehsilIds.join(',') : undefined;
      console.log('Calling API with:', { unitTitle, hqParam, tehsilParam, activeType, unitId });
      // Use updated API to get employees for this specific unit ID/Title
      const result = await api.getDashboardPostingPlaceDetail(unitTitle, hqParam, tehsilParam, activeType, unitId);
      console.log('API Response:', result);
      const employees = result?.employees || (result as any)?.data?.employees || [];
      console.log('Extracted employees:', employees);
      setDrillEmployees(employees);
    } catch (err) {
      console.error('Unit drilldown error:', err);
    } finally {
      setDrillLoading(false);
    }
  };

  const handleExport = () => {
    // Construct export URL
    const baseUrl = 'http://localhost/judiciary_hrms/api';
    const params = new URLSearchParams();
    if (hqIds.length > 0) params.append('hqId', hqIds.join(','));
    if (tehsilIds.length > 0) params.append('tehsilId', tehsilIds.join(','));

    // Trigger download
    window.location.href = `${baseUrl}/export_dashboard_csv.php?${params.toString()}`;
  };

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
        <button
          onClick={fetchMetrics}
          className="ml-4 px-4 py-2 bg-judiciary-600 text-white rounded-lg hover:bg-judiciary-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      {/* Premium Glass Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <span className="bg-judiciary-600 text-white p-2 rounded-xl">
                <Users size={28} />
              </span>
              Advanced Analytics
            </h1>
            <p className="text-gray-500 mt-1 font-medium flex items-center gap-2">
              <Clock size={14} /> Production Workforce Oversight
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <HQTehsilFilter
              onHQsChange={setHqIds}
              onTehsilsChange={setTehsilIds}
              className="bg-gray-100/50 border-none shadow-none"
            />

            {(hqIds.length > 0 || tehsilIds.length > 0) && (
              <button
                onClick={() => { setHqIds([]); setTehsilIds([]); }}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all font-semibold shadow-sm border border-red-100 animate-in fade-in slide-in-from-right-4"
              >
                <FilterX size={18} /> Reset
              </button>
            )}

            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold shadow-sm hover:shadow-md active:scale-95"
            >
              <Download size={18} /> Export Results
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 pt-32 pb-8 space-y-8">
        {/* Top Level Wheels */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* HQ Distribution Wheel */}
          <div className="bg-white p-6 rounded-[28px] shadow-xl shadow-gray-200/50 border border-gray-100 hover:shadow-2xl hover:shadow-gray-200/80 transition-all duration-500 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center justify-between mb-4 relative z-10 min-h-[88px]">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Total Employees District Judiciary Punjab</h3>
                <p className="text-gray-500 font-medium">Distribution by Headquarters • Click slice to filter</p>
              </div>
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner group-hover:scale-110 transition-transform duration-500 h-fit">
                <Building2 size={28} />
              </div>
            </div>
            <div className="h-[250px] flex items-center justify-center relative z-10">
              {((metrics?.hqDistribution?.length ?? 0) > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics?.hqDistribution ?? []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="label"
                      onClick={(data) => {
                        if (data && data.hqId) {
                          setHqIds([data.hqId.toString()]);
                        }
                      }}
                      className="cursor-pointer focus:outline-none"
                    >
                      {metrics?.hqDistribution?.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          className="hover:opacity-80 transition-opacity"
                        />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          const { cx, cy } = viewBox as any;
                          const total = (metrics?.hqDistribution ?? []).reduce((sum, item) => sum + item.count, 0);
                          return (
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                              <tspan x={cx} y={cy - 12} className="text-4xl font-black fill-gray-900">{total}</tspan>
                              <tspan x={cx} y={cy + 22} className="text-xs fill-gray-400 uppercase tracking-[0.2em] font-black">Staff</tspan>
                            </text>
                          );
                        }}
                      />
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '20px',
                        border: 'none',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                        padding: '12px 16px'
                      }}
                      formatter={(value: number, name: string) => [`${value} Personnel`, <span className="font-bold">{name}</span>]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-gray-200">
                    <PieChartIcon className="text-gray-300" size={32} />
                  </div>
                  <p className="text-gray-400 font-bold">No HQ distribution data available</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              {metrics?.hqDistribution?.slice(0, 5).map((entry, index) => (
                <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-[10px] font-bold text-gray-600">{entry.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Leaves Today Wheel */}
          <div className="bg-white p-6 rounded-[28px] shadow-xl shadow-gray-200/50 border border-gray-100 hover:shadow-2xl hover:shadow-gray-200/80 transition-all duration-500 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center justify-between mb-4 relative z-10 min-h-[88px]">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Employees on Leave Today</h3>
                <p className="text-gray-500 font-medium">Currently away • {new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl shadow-inner group-hover:scale-110 transition-transform duration-500 h-fit">
                <Calendar size={28} />
              </div>
            </div>
            <div className="h-[250px] flex items-center justify-center relative z-10">
              {((metrics?.leavesToday?.length ?? 0) > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics?.leavesToday ?? []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="label"
                      onClick={(data) => {
                        if (data && data.label) {
                          handleDrillDown('leaves_today', data.label, `Employees on ${data.label} Today`);
                        }
                      }}
                      className="cursor-pointer focus:outline-none"
                    >
                      {metrics?.leavesToday?.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[(index + 3) % COLORS.length]}
                          className="hover:opacity-80 transition-opacity"
                        />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          const { cx, cy } = viewBox as any;
                          const total = (metrics?.leavesToday ?? []).reduce((sum, item) => sum + item.count, 0);
                          return (
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                              <tspan x={cx} y={cy - 12} className="text-4xl font-black fill-amber-600">{total}</tspan>
                              <tspan x={cx} y={cy + 22} className="text-xs fill-gray-400 uppercase tracking-[0.2em] font-black">On Leave</tspan>
                            </text>
                          );
                        }}
                      />
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '20px',
                        border: 'none',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                        padding: '12px 16px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12">
                  <div className="w-24 h-24 bg-green-50 rounded-[2rem] flex flex-col items-center justify-center mx-auto mb-6 shadow-sm border border-green-100 animate-pulse">
                    <CheckCircle className="text-green-500 mb-2" size={40} />
                  </div>
                  <h4 className="text-2xl font-black text-green-600 mb-2">Maximum Strength</h4>
                  <p className="text-gray-400 font-medium">Every staff member is present today</p>
                </div>
              )}
            </div>
            {((metrics?.leavesToday?.length ?? 0) > 0) && (
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                {metrics?.leavesToday?.map((entry, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleDrillDown('leaves_today', entry.label, `Employees on ${entry.label} Today`)}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[(index + 3) % COLORS.length] }} />
                    <span className="text-[10px] font-bold text-gray-600">{entry.label}: {entry.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inactive Employees Wheel */}
          <div className="bg-white p-6 rounded-[28px] shadow-xl shadow-gray-200/50 border border-gray-100 hover:shadow-2xl hover:shadow-gray-200/80 transition-all duration-500 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center justify-between mb-4 relative z-10 min-h-[88px]">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Inactive Personnel</h3>
                <p className="text-gray-500 font-medium">Retired, Resigned & Deceased</p>
              </div>
              <div className="p-4 bg-gray-100 text-gray-600 rounded-2xl shadow-inner group-hover:scale-110 transition-transform duration-500">
                <UserMinus size={28} />
              </div>
            </div>
            <div className="h-[250px] flex items-center justify-center relative z-10">
              {((metrics?.inactiveStatus?.length ?? 0) > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics?.inactiveStatus ?? []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="label"
                      onClick={(data) => {
                        if (data && data.label) {
                          handleDrillDown('status', data.label, `Employees Status: ${data.label}`, 'non-active');
                        }
                      }}
                      className="cursor-pointer focus:outline-none"
                    >
                      {metrics?.inactiveStatus?.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.label === 'Retired' ? '#f59e0b' : entry.label === 'Resigned' ? '#ef4444' : '#94a3b8'}
                          className="hover:opacity-80 transition-opacity"
                        />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          const { cx, cy } = viewBox as any;
                          const total = (metrics?.inactiveStatus ?? []).reduce((sum, item) => sum + item.count, 0);
                          return (
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                              <tspan x={cx} y={cy - 12} className="text-4xl font-black fill-gray-900">{total}</tspan>
                              <tspan x={cx} y={cy + 22} className="text-xs fill-gray-400 uppercase tracking-[0.2em] font-black">Total</tspan>
                            </text>
                          );
                        }}
                      />
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '20px',
                        border: 'none',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                        padding: '12px 16px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-gray-200">
                    <UserMinus className="text-gray-300" size={32} />
                  </div>
                  <p className="text-gray-400 font-bold">No inactive records found</p>
                </div>
              )}
            </div>
            {((metrics?.inactiveStatus?.length ?? 0) > 0) && (
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                {metrics?.inactiveStatus?.map((entry, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleDrillDown('status', entry.label, `Employees Status: ${entry.label}`, 'non-active')}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.label === 'Retired' ? '#f59e0b' : entry.label === 'Resigned' ? '#ef4444' : '#94a3b8' }} />
                    <span className="text-[10px] font-bold text-gray-600">{entry.label}: {entry.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <>
          {/* Consolidated Summary Analytics Card */}
          <div className="bg-white p-8 rounded-[32px] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-judiciary-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-20"></div>

            <div className="flex items-center justify-between mb-10 relative z-10">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Summary Analytics</h2>
                <p className="text-gray-500 font-medium">Multi-dimensional workforce & infrastructure overview</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-judiciary-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-judiciary-200">
                  {totalEmps} Active Personnel
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
              {/* 1. Designation Strength */}
              <div className="flex flex-col bg-gray-50/50 p-6 rounded-2xl border border-gray-100/50">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Briefcase size={14} className="text-red-500" /> Designation Strength
                </h3>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics?.designations || []}
                        cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                        paddingAngle={4} dataKey="count" nameKey="label"
                        onClick={(data) => handleDrillDown('designation', data.label || (data.payload && data.payload.label), `Designation: ${data.label || (data.payload && data.payload.label)}`)}
                        className="cursor-pointer focus:outline-none"
                      >
                        {(metrics?.designations || []).map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-1.5 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                  {(metrics?.designations || []).slice(0, 10).map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-[11px] font-bold p-1 rounded-lg hover:bg-white cursor-pointer transition-colors group"
                      onClick={() => handleDrillDown('designation', entry.label, `Designation: ${entry.label}`)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-gray-600 truncate max-w-[120px] group-hover:text-red-600">{entry.label}</span>
                      </div>
                      <span className="text-gray-900">{entry.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Court Infrastructure */}
              <div className="flex flex-col bg-gray-50/50 p-6 rounded-2xl border border-gray-100/50">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-indigo-500" /> Court Infrastructure
                </h3>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics?.courtsByCategory || []}
                        cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                        paddingAngle={4} dataKey="count" nameKey="label"
                        onClick={(data) => handleDrillDown('court_category', data.label || (data.payload && data.payload.label), `Category Explorer: ${data.label || (data.payload && data.payload.label)}`)}
                        className="cursor-pointer focus:outline-none"
                      >
                        {(metrics?.courtsByCategory || []).map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-1.5 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                  {(metrics?.courtsByCategory || []).map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-[11px] font-bold p-1 rounded-lg hover:bg-white cursor-pointer transition-colors group"
                      onClick={() => handleDrillDown('court_category', entry.label, `Category Explorer: ${entry.label}`)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[(index + 2) % COLORS.length] }} />
                        <span className="text-gray-600 truncate max-w-[120px] group-hover:text-indigo-600">{entry.label}</span>
                      </div>
                      <span className="text-gray-900 font-black">{entry.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Gender and Religion */}
              <div className="flex flex-col bg-gray-50/50 p-6 rounded-2xl border border-gray-100/50">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Users size={14} className="text-blue-500" /> Gender and Religion
                </h3>

                <div className="flex flex-col gap-6 h-full">
                  {/* Gender Section */}
                  <div className="flex flex-col">
                    <div className="h-[100px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={metrics?.gender || []}
                            cx="50%" cy="50%" innerRadius={30} outerRadius={45}
                            paddingAngle={2} dataKey="count" nameKey="label"
                            onClick={(data) => handleDrillDown('gender', data.label || (data.payload && data.payload.label), `Gender: ${data.label || (data.payload && data.payload.label)}`)}
                            className="cursor-pointer focus:outline-none"
                          >
                            {(metrics?.gender || []).map((_, index) => <Cell key={`cell-${index}`} fill={index === 0 ? '#1e40af' : '#db2777'} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-1">
                      <div className="flex items-center justify-center gap-4">
                        {(metrics?.gender || []).map((entry, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-1.5 text-[10px] font-black cursor-pointer hover:bg-white p-1 rounded transition-colors"
                            onClick={() => handleDrillDown('gender', entry.label, `Gender: ${entry.label}`)}
                          >
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: index === 0 ? '#1e40af' : '#db2777' }} />
                            <span className="text-gray-500">{entry.label}:</span>
                            <span className="text-gray-900">{entry.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 border-dashed"></div>

                  {/* Religion Section */}
                  <div className="flex flex-col">
                    <div className="h-[100px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={metrics?.religion || []}
                            cx="50%" cy="50%" innerRadius={30} outerRadius={45}
                            paddingAngle={2} dataKey="count" nameKey="label"
                            onClick={(data) => handleDrillDown('sect', data.label || (data.payload && data.payload.label), `Religion: ${data.label || (data.payload && data.payload.label)}`)}
                            className="cursor-pointer focus:outline-none"
                          >
                            {(metrics?.religion || []).map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-1 max-h-[70px] overflow-y-auto custom-scrollbar">
                      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
                        {(metrics?.religion || []).map((entry, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-1.5 text-[10px] font-black cursor-pointer hover:bg-white p-1 rounded transition-colors"
                            onClick={() => handleDrillDown('sect', entry.label, `Religion: ${entry.label}`)}
                          >
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[(index + 4) % COLORS.length] }} />
                            <span className="text-gray-500">{entry.label}:</span>
                            <span className="text-gray-900">{entry.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Section: Posting Hierarchies & Detailed Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Unified Hierarchy & Details Workspace */}
            <div className="lg:col-span-12 bg-white p-8 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Postings Hierarchy</h2>
                  <p className="text-gray-500 font-medium">Drill-down to specific courts and offices</p>
                </div>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full uppercase tracking-wider">Interactive Explorer</span>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 min-h-[650px]">
                {/* Hierarchy Explorer Column - Seamless Integration */}
                <div className="xl:col-span-8 overflow-visible">
                  <CategorizedPostingChart
                    hqId={hqIds.join(',')}
                    tehsilId={tehsilIds.join(',')}
                    activeType={activeType}
                    onActiveTypeChange={setActiveType}
                    onSelectPlace={(place: string) => setSelectedPlace(place)}
                  />
                </div>

                {/* Details Column - Clearly separated but unified */}
                <div className="xl:col-span-4 border-l border-gray-50 pl-8 overflow-y-auto">
                  {selectedPlace ? (
                    <EmployeeRankChart
                      postingPlaceTitle={selectedPlace}
                      hqId={hqIds.join(',')}
                      tehsilId={tehsilIds.join(',')}
                      activeType={activeType}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-50">
                      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                        <MapPin size={40} className="text-gray-300" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-400">Select a Posting Place</h3>
                      <p className="text-gray-400 max-w-[200px] mt-2 font-medium italic">Click on any chart segment in the explorer to view rank-wise details</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Demographic Context & Professional Patterns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 1. Domicile Analytics */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-lg">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <MapPin size={22} className="text-orange-500" /> Domicile Pattern Analysis
              </h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics?.domicile || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="label" fontSize={10} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} onClick={(data) => handleDrillDown('domicile', data.label || (data.payload && data.payload.label), `Domicile: ${data.label || (data.payload && data.payload.label)}`)} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Qualification Depth */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-lg">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Award size={22} className="text-emerald-500" /> Qualification Depth
              </h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics?.qualifications || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="label" width={100} fontSize={10} stroke="#6b7280" />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      fill="#166534"
                      radius={[0, 4, 4, 0]}
                      onClick={(data) => handleDrillDown('qualification', data.label || (data.payload && data.payload.label), `Qualification: ${data.label || (data.payload && data.payload.label)}`)}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Bottom Section: Service Quality & Compliance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Service Quality</h2>
                  <p className="text-gray-500 font-medium">Critical disciplinary & presence tracking</p>
                </div>
                <Briefcase className="text-judiciary-200" size={40} />
              </div>
              <ServiceQualityChart
                data={metrics?.disciplinary || []}
                onSliceClick={(label) => handleDrillDown('status', label, `Status: ${label}`)}
              />
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Administrative Compliance</h2>
                  <p className="text-gray-500 font-medium">Monitoring ACRs, Assets & Tax filings</p>
                </div>
                <CheckCircle2 className="text-judiciary-200" size={40} />
              </div>
              <ComplianceChart
                data={metrics?.compliance || []}
                totalEmployees={totalEmps}
                onBarClick={(label) => handleDrillDown('compliance', label, `Compliance: ${label}`)}
              />
            </div>

            {/* GP Fund Insights Card */}
            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 tracking-tight">GP Fund Metrics</h2>
                  <p className="text-gray-500 font-medium">Subscription & Advance participation</p>
                </div>
                <Users className="text-orange-200" size={40} />
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics?.gpFund || []}
                    layout="vertical"
                    margin={{ left: 100, right: 40, top: 10 }}
                    onClick={(state) => {
                      if (state && state.activeLabel) {
                        handleDrillDown('gp_fund', state.activeLabel, `GP Fund: ${state.activeLabel}`);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="label"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                      width={120}
                    />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#f97316"
                      radius={[0, 4, 4, 0]}
                      barSize={32}
                    >
                      <LabelList dataKey="count" position="right" style={{ fill: '#475569', fontSize: 13, fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      </div>

      {/* Drilldown Modal */}
      <DrillDownModal
        isOpen={drillModalOpen}
        onClose={() => setDrillModalOpen(false)}
        title={drillTitle}
        employees={drillEmployees}
        units={drillUnits}
        loading={drillLoading}
        onUnitClick={handleUnitClick}
      />
    </div>
  );
};

export default AdvancedDashboard;
