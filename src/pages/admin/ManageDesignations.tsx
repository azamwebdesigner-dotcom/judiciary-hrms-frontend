import React, { useState } from 'react';
import { useMasterData } from '../../context/MasterDataContext';
import { Plus, Trash2, Briefcase, Edit2, Save, X } from 'lucide-react';
import { Designation } from '../../types';

const ManageDesignations: React.FC = () => {
  const { designations, addDesignation, updateDesignation, deleteDesignation } = useMasterData();
  
  const [desId, setDesId] = useState<string | null>(null);
  const [desTitle, setDesTitle] = useState('');
  const [desStatus, setDesStatus] = useState<'Active'|'Inactive'>('Active');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desTitle.trim()) return;

    if (desId) {
        // Editing: send full data including id
        const designationData: Designation = {
            id: desId,
            title: desTitle,
            status: desStatus,
            bpsRange: '1-22'
        };
        updateDesignation(desId, designationData);
    } else {
        // Adding: send only title and status (no id)
        const designationData: Omit<Designation, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> = {
            title: desTitle,
            status: desStatus,
            bpsRange: '1-22'
        };
        addDesignation(designationData);
    }
    resetForm();
  };

  const handleEdit = (d: Designation) => {
    setDesId(String(d.id));
    setDesTitle(d.title);
    setDesStatus(d.status);
  };

  const resetForm = () => {
    setDesId(null);
    setDesTitle('');
    setDesStatus('Active');
  };

  return (
    <div className="space-y-6 pb-20">
        <div className="flex items-center gap-3 mb-6">
            <div className="bg-judiciary-100 p-2.5 rounded-lg text-judiciary-700">
                <Briefcase size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Manage Designations</h2>
        </div>

        {/* Add/Edit Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-700 mb-4">{desId ? 'Edit Designation' : 'Add Designation'}</h3>
            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Designation Title <span className="text-red-500">*</span></label>
                    <input 
                        value={desTitle}
                        onChange={(e) => setDesTitle(e.target.value)}
                        placeholder="e.g. Civil Judge, Stenographer"
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-judiciary-500 outline-none"
                    />
                </div>
                <div className="w-full md:w-48">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                    <select 
                        value={desStatus} 
                        onChange={(e) => setDesStatus(e.target.value as any)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"
                    >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    {desId && (
                        <button type="button" onClick={resetForm} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-lg font-medium transition">
                            <X size={18} />
                        </button>
                    )}
                    <button type="submit" className={`text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition ${desId ? 'bg-green-600 hover:bg-green-700' : 'bg-judiciary-600 hover:bg-judiciary-700'}`}>
                        {desId ? <Save size={18} /> : <Plus size={18} />} 
                        {desId ? 'Update' : 'Add'}
                    </button>
                </div>
            </form>
        </div>

        {/* List Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-20">ID</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase">Designation</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-32">Status</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-48 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {designations.map((des: Designation, idx: number) => (
                        <tr key={des.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3 text-sm text-gray-500">{des.id}</td>
                            <td className="px-6 py-3 text-sm font-medium text-gray-800">{des.title}</td>
                            <td className="px-6 py-3">
                                <span className={`text-xs px-2 py-1 rounded font-bold ${des.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {des.status}
                                </span>
                            </td>
                            <td className="px-6 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => handleEdit(des)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => deleteDesignation(des.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default ManageDesignations;