import React, { useState } from 'react';
import { useMasterData } from '../../context/MasterDataContext';
import { Plus, Trash2, GraduationCap, Edit2, Save, X } from 'lucide-react';
import { Qualification } from '../../types';

const ManageQualifications: React.FC = () => {
  const { qualifications, addQualification, updateQualification, deleteQualification } = useMasterData();
  
  const [qId, setQId] = useState<string | null>(null);
  const [degreeTitle, setDegreeTitle] = useState('');
  const [level, setLevel] = useState(1);
  const [status, setStatus] = useState<'Active'|'Inactive'>('Active');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!degreeTitle.trim()) return;

    if (qId) {
        // Editing: send full data including id
        const qualificationData: Qualification = {
          id: qId,
          degreeTitle: degreeTitle,
          level: level,
          status: status
        };
        updateQualification(qId, qualificationData);
    } else {
        // Adding: send only required fields (no id)
        const qualificationData: Omit<Qualification, 'id'> = {
          degreeTitle: degreeTitle,
          level: level,
          status: status
        };
        addQualification(qualificationData);
    }
    resetForm();
  };

  const handleEdit = (q: Qualification) => {
    setQId(String(q.id));
    setDegreeTitle(q.degreeTitle);
    setLevel(q.level);
    setStatus(q.status);
  };

  const resetForm = () => {
    setQId(null);
    setDegreeTitle('');
    setLevel(1);
    setStatus('Active');
  };

  return (
    <div className="space-y-6 pb-20">
        <div className="flex items-center gap-3 mb-6">
            <div className="bg-judiciary-100 p-2.5 rounded-lg text-judiciary-700">
                <GraduationCap size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Qualification Management</h2>
        </div>

        {/* Add/Edit Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-700 mb-4">{qId ? 'Edit Qualification' : 'Add Qualification'}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Degree Title <span className="text-red-500">*</span></label>
                    <input 
                        value={degreeTitle}
                        onChange={(e) => setDegreeTitle(e.target.value)}
                        placeholder="e.g. Matriculation, LLB"
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-judiciary-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Level (Sort Order)</label>
                    <input 
                        type="number"
                        value={level}
                        onChange={(e) => setLevel(Number(e.target.value))}
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-judiciary-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                    <select 
                        value={status} 
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"
                    >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>
                <div className="md:col-span-4 flex justify-end gap-2 mt-2">
                    {qId && (
                        <button type="button" onClick={resetForm} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-lg font-medium transition">
                            <X size={18} /> Cancel
                        </button>
                    )}
                    <button type="submit" className={`text-white px-8 py-2.5 rounded-lg font-medium flex items-center gap-2 transition ${qId ? 'bg-green-600 hover:bg-green-700' : 'bg-judiciary-600 hover:bg-judiciary-700'}`}>
                        {qId ? <Save size={18} /> : <Plus size={18} />} 
                        {qId ? 'Update' : 'Add'}
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
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase">Degree Level</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-20">Level</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-32">Status</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-48 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {qualifications.sort((a: Qualification, b: Qualification) => a.level - b.level).map((q: Qualification, idx: number) => (
                        <tr key={q.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3 text-sm text-gray-500">{q.id}</td>
                            <td className="px-6 py-3 text-sm font-medium text-gray-800">{q.degreeTitle}</td>
                            <td className="px-6 py-3 text-sm text-gray-600">{q.level}</td>
                            <td className="px-6 py-3">
                                <span className={`text-xs px-2 py-1 rounded font-bold ${q.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {q.status}
                                </span>
                            </td>
                            <td className="px-6 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => handleEdit(q)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => deleteQualification(q.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition">
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

export default ManageQualifications;