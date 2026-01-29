import React, { useState } from 'react';
import { useMasterData } from '../../context/MasterDataContext';
import { Plus, Trash2, MapPin, Edit2, Save, X, AlertTriangle, Power, PowerOff } from 'lucide-react';
import { Headquarter, Tehsil } from '../../types';

const ManageLocations: React.FC = () => {
  const { 
    allHeadquarters, 
    allTehsils, 
    addHeadquarter, 
    updateHeadquarter, 
    deleteHeadquarter, 
    toggleHeadquarterStatus,
    addTehsil, 
    updateTehsil, 
    deleteTehsil,
    toggleTehsilStatus,
    getTehsilsByHQ 
  } = useMasterData();

  // --- HQ State ---
  const [hqId, setHqId] = useState<string | null>(null);
  const [hqTitle, setHqTitle] = useState('');
  const [hqStatus, setHqStatus] = useState<'Active'|'Inactive'>('Active');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hqToDelete, setHqToDelete] = useState<string | null>(null);

  // --- Tehsil State ---
  const [tehsilId, setTehsilId] = useState<string | null>(null);
  const [tehsilTitle, setTehsilTitle] = useState('');
  const [selectedHqForTehsil, setSelectedHqForTehsil] = useState('');
  const [tehsilStatus, setTehsilStatus] = useState<'Active'|'Inactive'>('Active');

  // --- HQ Handlers ---
  const handleSubmitHQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hqTitle.trim()) {
        alert("Please enter a Headquarter Title");
        return;
    }

    try {
        if (hqId) {
            await updateHeadquarter({ id: hqId, title: hqTitle, status: hqStatus });
        } else {
            await addHeadquarter({ id: '0', title: hqTitle, status: hqStatus });
        }
        resetHQ();
    } catch (e) {
        console.error("HQ Save Error", e);
    }
  };

  const handleEditHQ = (hq: Headquarter) => {
    setHqId(String(hq.id));
    setHqTitle(hq.title);
    setHqStatus(hq.status);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleHQStatus = async (id: string, currentStatus: 'Active' | 'Inactive') => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    const confirmMessage = newStatus === 'Inactive' 
      ? 'Inactivating this headquarters will also inactivate all its tehsils. Continue?'
      : 'Activate this headquarters?';
    
    if (window.confirm(confirmMessage)) {
      try {
        await toggleHeadquarterStatus(id, newStatus);
      } catch (error) {
        console.error('Failed to toggle status:', error);
      }
    }
  };

  const handleDeleteHQ = async (id: string) => {
    setHqToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteHQ = async () => {
    if (!hqToDelete) return;
    
    try {
      const success = await deleteHeadquarter(hqToDelete);
      if (success) {
        alert('Headquarters and all its tehsils have been marked as inactive.');
      }
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setShowDeleteConfirm(false);
      setHqToDelete(null);
    }
  };

  const resetHQ = () => {
    setHqId(null);
    setHqTitle('');
    setHqStatus('Active');
  };

  // --- Tehsil Handlers ---
  const handleSubmitTehsil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tehsilTitle.trim() || !selectedHqForTehsil) {
        alert("Please enter Tehsil Name and select a Headquarter.");
        return;
    }

    try {
        if (tehsilId) {
            await updateTehsil({ id: tehsilId, hqId: selectedHqForTehsil, title: tehsilTitle, status: tehsilStatus });
        } else {
            await addTehsil({ id: '0', hqId: selectedHqForTehsil, title: tehsilTitle, status: tehsilStatus });
        }
        resetTehsil();
    } catch (e) {
        console.error("Tehsil Save Error", e);
    }
  };

  const handleEditTehsil = (t: Tehsil) => {
    setTehsilId(String(t.id));
    setTehsilTitle(t.title);
    setSelectedHqForTehsil(String(t.hqId)); 
    setTehsilStatus(t.status);
    document.getElementById('tehsil-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleToggleTehsilStatus = async (id: string, currentStatus: 'Active' | 'Inactive') => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    const confirmMessage = newStatus === 'Active' 
      ? 'Activate this tehsil?'
      : 'Inactivate this tehsil?';
    
    if (window.confirm(confirmMessage)) {
      try {
        await toggleTehsilStatus(id, newStatus);
      } catch (error) {
        console.error('Failed to toggle status:', error);
      }
    }
  };

  const resetTehsil = () => {
    setTehsilId(null);
    setTehsilTitle('');
    setSelectedHqForTehsil('');
    setTehsilStatus('Active');
  };

  // Filter active HQs for tehsil creation
  const activeHeadquarters = allHeadquarters.filter((hq: Headquarter) => hq.status === 'Active');

  return (
    <div className="space-y-10 pb-20">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl max-w-md w-full">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold">Delete Headquarters</h3>
            </div>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete this headquarters? This action will:
            </p>
            <ul className="mb-6 text-sm text-gray-600 space-y-1">
              <li>• Mark headquarters as inactive</li>
              <li>• Mark all associated tehsils as inactive</li>
              <li>• <strong>Employee data will be preserved</strong></li>
              <li>• Headquarters and tehsils will not appear in new registrations</li>
            </ul>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setHqToDelete(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteHQ}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Headquarter Section --- */}
      <section>
        <div className="flex items-center gap-3 mb-6">
            <div className="bg-judiciary-100 p-2.5 rounded-lg text-judiciary-700">
                <MapPin size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Manage Headquarters</h2>
              <p className="text-sm text-gray-500">Active headquarters will appear in employee registration</p>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-700">{hqId ? 'Edit Headquarter' : 'Add Headquarter'}</h3>
                {hqId && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Editing ID: {hqId}</span>}
            </div>
            <form onSubmit={handleSubmitHQ} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <label className="block text-sm font-bold text-gray-700 mb-1">HQ Title <span className="text-red-500">*</span></label>
                    <input 
                        value={hqTitle}
                        onChange={(e) => setHqTitle(e.target.value)}
                        placeholder="e.g. District Headquarter (Multan)"
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-judiciary-500 outline-none"
                    />
                </div>
                <div className="w-full md:w-48">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                    <select 
                        value={hqStatus} 
                        onChange={(e) => setHqStatus(e.target.value as any)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"
                        disabled={!!hqId}
                    >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    {hqId && (
                        <button type="button" onClick={resetHQ} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-lg font-medium transition">
                            <X size={18} />
                        </button>
                    )}
                    <button type="submit" className={`text-white px-6 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition flex-1 md:flex-none ${hqId ? 'bg-green-600 hover:bg-green-700' : 'bg-judiciary-600 hover:bg-judiciary-700'}`}>
                        {hqId ? <Save size={18} /> : <Plus size={18} />} 
                        {hqId ? 'Update' : 'Add'}
                    </button>
                </div>
            </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-20">ID</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase">HQ Title</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase">Tehsils</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-64 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {allHeadquarters.map((hq: Headquarter) => {
                      const hqTehsils = getTehsilsByHQ(hq.id);
                      const activeTehsils = hqTehsils.filter(t => t.status === 'Active');
                      
                      return (
                        <tr key={hq.id} className={`hover:bg-gray-50 ${hq.status === 'Inactive' ? 'bg-gray-50' : ''}`}>
                            <td className="px-6 py-3 text-sm text-gray-500">{hq.id}</td>
                            <td className="px-6 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-medium ${hq.status === 'Inactive' ? 'text-gray-500' : 'text-gray-800'}`}>
                                    {hq.title}
                                  </span>
                                  {hq.status === 'Inactive' && (
                                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                                      Hidden
                                    </span>
                                  )}
                                </div>
                            </td>
                            <td className="px-6 py-3">
                                <span className={`text-xs px-2 py-1 rounded font-bold ${hq.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {hq.status}
                                </span>
                            </td>
                            <td className="px-6 py-3 text-sm">
                                <div className="text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <span>Total: {hqTehsils.length}</span>
                                        <span className="text-green-600">Active: {activeTehsils.length}</span>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button 
                                      onClick={() => handleToggleHQStatus(hq.id, hq.status)}
                                      className={`p-2 rounded-lg transition ${hq.status === 'Active' ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                                      title={hq.status === 'Active' ? 'Inactivate HQ' : 'Activate HQ'}
                                    >
                                        {hq.status === 'Active' ? <PowerOff size={16} /> : <Power size={16} />}
                                    </button>
                                    <button 
                                      onClick={() => handleEditHQ(hq)} 
                                      className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition"
                                      title="Edit"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteHQ(hq.id)} 
                                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                                      title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                      );
                    })}
                    {allHeadquarters.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-gray-400">No Headquarters Found. Add one above.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </section>

      {/* --- Tehsil Section --- */}
      <section className="border-t border-gray-200 pt-10" id="tehsil-form">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Manage Tehsils</h2>
            <p className="text-sm text-gray-500">Only active tehsils under active headquarters will appear in employee registration</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-700">{tehsilId ? 'Edit Tehsil' : 'Add Tehsil'}</h3>
                {tehsilId && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Editing ID: {tehsilId}</span>}
            </div>
            <form onSubmit={handleSubmitTehsil} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Headquarter <span className="text-red-500">*</span></label>
                    <select 
                        value={selectedHqForTehsil}
                        onChange={(e) => setSelectedHqForTehsil(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-judiciary-500 outline-none bg-white"
                        required
                    >
                        <option value="">-- Select Headquarter --</option>
                        {activeHeadquarters.map((hq: Headquarter) => (
                            <option key={hq.id} value={hq.id}>{hq.title}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Tehsil Title <span className="text-red-500">*</span></label>
                    <input 
                        value={tehsilTitle}
                        onChange={(e) => setTehsilTitle(e.target.value)}
                        placeholder="e.g. Shujabad"
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-judiciary-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                    <select 
                        value={tehsilStatus} 
                        onChange={(e) => setTehsilStatus(e.target.value as any)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"
                        disabled={!!tehsilId}
                    >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    {tehsilId && (
                        <button type="button" onClick={resetTehsil} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-lg font-medium transition">
                            <X size={18} />
                        </button>
                    )}
                    <button type="submit" className={`text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 flex-1 justify-center transition ${tehsilId ? 'bg-green-600 hover:bg-green-700' : 'bg-judiciary-600 hover:bg-judiciary-700'}`}>
                        {tehsilId ? <Save size={18} /> : <Plus size={18} />} 
                        {tehsilId ? 'Update' : 'Add'}
                    </button>
                </div>
            </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-20">ID</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase">Headquarter</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase">Tehsil Title</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-32">Status</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-64 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {allTehsils.map((tehsil: Tehsil) => {
                        const hq = allHeadquarters.find((h: Headquarter) => String(h.id) === String(tehsil.hqId));
                        const hqName = hq ? (
                          <div className="flex items-center gap-1">
                            <span className={hq.status === 'Inactive' ? 'text-gray-400' : ''}>
                              {hq.title}
                            </span>
                            {hq.status === 'Inactive' && (
                              <span className="text-xs text-gray-400">(Inactive)</span>
                            )}
                          </div>
                        ) : <span className="text-red-400 italic">Unknown</span>;
                        
                        return (
                            <tr key={tehsil.id} className={`hover:bg-gray-50 ${
                              tehsil.status === 'Inactive' || hq?.status === 'Inactive' ? 'bg-gray-50' : ''
                            }`}>
                                <td className="px-6 py-3 text-sm text-gray-500">{tehsil.id}</td>
                                <td className="px-6 py-3 text-sm font-medium">{hqName}</td>
                                <td className="px-6 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-bold ${tehsil.status === 'Inactive' ? 'text-gray-500' : 'text-gray-800'}`}>
                                      {tehsil.title}
                                    </span>
                                    {(tehsil.status === 'Inactive' || hq?.status === 'Inactive') && (
                                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                                        Hidden
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-3">
                                    <span className={`text-xs px-2 py-1 rounded font-bold ${tehsil.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {tehsil.status}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                          onClick={() => handleToggleTehsilStatus(tehsil.id, tehsil.status)}
                                          className={`p-2 rounded-lg transition ${tehsil.status === 'Active' ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                                          title={tehsil.status === 'Active' ? 'Inactivate' : 'Activate'}
                                          disabled={hq?.status === 'Inactive' && tehsil.status === 'Active'}
                                        >
                                            {tehsil.status === 'Active' ? <PowerOff size={16} /> : <Power size={16} />}
                                        </button>
                                        <button 
                                          onClick={() => handleEditTehsil(tehsil)} 
                                          className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition"
                                          title="Edit"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                          onClick={() => deleteTehsil(tehsil.id)} 
                                          className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                                          title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {allTehsils.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-gray-400">No Tehsils Found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </section>
    </div>
  );
};

export default ManageLocations;