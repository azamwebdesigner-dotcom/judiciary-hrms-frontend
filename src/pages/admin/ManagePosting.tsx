import React, { useState } from 'react';
import { useMasterData } from '../../context/MasterDataContext';
import { Plus, Trash2, MapPin, Edit2, Save, X } from 'lucide-react';
import { PostingUnitCategory, PostingUnit } from '../../types';

const ManagePosting: React.FC = () => {
  const { categories, units, addCategory, updateCategory, deleteCategory, addUnit, updateUnit, deleteUnit } = useMasterData();

  // --- Category State ---
  const [catId, setCatId] = useState<string | null>(null);
  const [catTitle, setCatTitle] = useState('');
  const [catStatus, setCatStatus] = useState<'Active'|'Inactive'>('Active');

  // --- Unit State ---
  const [unitId, setUnitId] = useState<string | null>(null);
  const [unitTitle, setUnitTitle] = useState('');
  const [selectedCatForUnit, setSelectedCatForUnit] = useState('');
  const [unitLevel, setUnitLevel] = useState(1);
  const [unitStatus, setUnitStatus] = useState<'Active'|'Inactive'>('Active');

  // --- Category Handlers ---
  const handleSubmitCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catTitle.trim()) return;

    if (catId) {
        // Editing: update with full data including id
        const categoryData: PostingUnitCategory = {
          id: catId,
          title: catTitle,
          status: catStatus
        };
        updateCategory(catId, categoryData);
    } else {
        // Adding: only send title and status (no id)
        const categoryData: Omit<PostingUnitCategory, 'id'> = {
          title: catTitle,
          status: catStatus
        };
        addCategory(categoryData);
    }
    resetCategory();
  };

  const handleEditCategory = (c: PostingUnitCategory) => {
    setCatId(String(c.id));
    setCatTitle(c.title);
    setCatStatus(c.status);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetCategory = () => {
    setCatId(null);
    setCatTitle('');
    setCatStatus('Active');
  };

  // --- Unit Handlers ---
  const handleSubmitUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitTitle.trim() || !selectedCatForUnit) {
        alert("Please enter Unit Name and select a Category.");
        return;
    }

    if (unitId) {
        // Editing: update with full data including id
        const unitData: PostingUnit = {
          id: unitId,
          categoryId: selectedCatForUnit,
          title: unitTitle,
          level: unitLevel,
          status: unitStatus
        };
        updateUnit(unitId, unitData);
    } else {
        // Adding: only send required fields (no id)
        const unitData: Omit<PostingUnit, 'id'> = {
          categoryId: selectedCatForUnit,
          title: unitTitle,
          level: unitLevel,
          status: unitStatus
        };
        addUnit(unitData);
    }
    resetUnit();
  };

  const handleEditUnit = (u: PostingUnit) => {
    setUnitId(String(u.id));
    setUnitTitle(u.title);
    setSelectedCatForUnit(String(u.categoryId));
    setUnitLevel(u.level);
    setUnitStatus(u.status);
    // Scroll to unit form
    document.getElementById('unit-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const resetUnit = () => {
    setUnitId(null);
    setUnitTitle('');
    setSelectedCatForUnit('');
    setUnitLevel(1);
    setUnitStatus('Active');
  };

  return (
    <div className="space-y-10 pb-20">
      
      {/* --- Category Section --- */}
      <section>
        <div className="flex items-center gap-3 mb-6">
            <div className="bg-judiciary-100 p-2.5 rounded-lg text-judiciary-700">
                <MapPin size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Manage Posting Place Categories</h2>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-700 mb-4">{catId ? 'Edit Category' : 'Add Category'}</h3>
            <form onSubmit={handleSubmitCategory} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Category Title <span className="text-red-500">*</span></label>
                    <input 
                        value={catTitle}
                        onChange={(e) => setCatTitle(e.target.value)}
                        placeholder="e.g. Court, Office"
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-judiciary-500 outline-none"
                    />
                </div>
                <div className="w-full md:w-48">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                    <select 
                        value={catStatus} 
                        onChange={(e) => setCatStatus(e.target.value as any)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"
                    >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    {catId && (
                        <button type="button" onClick={resetCategory} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-lg font-medium transition">
                            <X size={18} />
                        </button>
                    )}
                    <button type="submit" className={`text-white px-6 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition flex-1 md:flex-none ${catId ? 'bg-green-600 hover:bg-green-700' : 'bg-judiciary-600 hover:bg-judiciary-700'}`}>
                        {catId ? <Save size={18} /> : <Plus size={18} />} 
                        {catId ? 'Update' : 'Add'}
                    </button>
                </div>
            </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-20">ID</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase">Category Title</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-32">Status</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-48 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {(categories || []).filter(Boolean).map((cat: PostingUnitCategory, idx: number) => (
                        <tr key={cat.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3 text-sm text-gray-500">{cat.id}</td>
                            <td className="px-6 py-3 text-sm font-medium text-gray-800">{cat.title}</td>
                            <td className="px-6 py-3">
                                <span className={`text-xs px-2 py-1 rounded font-bold ${cat.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {cat.status}
                                </span>
                            </td>
                            <td className="px-6 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => handleEditCategory(cat)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => deleteCategory(cat.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </section>

      {/* --- Units Section --- */}
      <section className="border-t border-gray-200 pt-10" id="unit-form">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Manage Posting Units</h2>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-700 mb-4">{unitId ? 'Edit Unit' : 'Add Unit'}</h3>
            <form onSubmit={handleSubmitUnit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                    <select 
                        value={selectedCatForUnit}
                        onChange={(e) => setSelectedCatForUnit(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-judiciary-500 outline-none bg-white"
                        required
                    >
                        <option value="">-- Select Category --</option>
                        {(categories || []).filter(Boolean).map((c: PostingUnitCategory) => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Unit Name <span className="text-red-500">*</span></label>
                    <input 
                        value={unitTitle}
                        onChange={(e) => setUnitTitle(e.target.value)}
                        placeholder="e.g. DSJ Court, Scanning Branch"
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-judiciary-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Level (Sort Order)</label>
                    <input 
                        type="number"
                        value={unitLevel}
                        onChange={(e) => setUnitLevel(Number(e.target.value))}
                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-judiciary-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                    <select 
                        value={unitStatus} 
                        onChange={(e) => setUnitStatus(e.target.value as any)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"
                    >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>
                <div className="md:col-span-5 flex justify-end gap-2 mt-2">
                    {unitId && (
                        <button type="button" onClick={resetUnit} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-lg font-medium transition">
                            <X size={18} /> Cancel
                        </button>
                    )}
                    <button type="submit" className={`text-white px-8 py-2.5 rounded-lg font-medium flex items-center gap-2 transition ${unitId ? 'bg-green-600 hover:bg-green-700' : 'bg-judiciary-600 hover:bg-judiciary-700'}`}>
                        {unitId ? <Save size={18} /> : <Plus size={18} />} 
                        {unitId ? 'Update Unit' : 'Add Unit'}
                    </button>
                </div>
            </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-20">ID</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase">Category</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase">Unit Name</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-20">Level</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-32">Status</th>
                        <th className="px-6 py-3 font-semibold text-xs text-gray-500 uppercase w-48 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {(units || []).filter(Boolean).map((unit: PostingUnit, idx: number) => {
                        const cat = (categories || []).find((c: PostingUnitCategory) => String(c?.id) === String(unit?.categoryId));
                        const catName = cat ? cat.title : <span className="text-red-400 italic">Unknown ({unit.categoryId})</span>;
                        return (
                            <tr key={unit.id} className="hover:bg-gray-50">
                                <td className="px-6 py-3 text-sm text-gray-500">{unit.id}</td>
                                <td className="px-6 py-3 text-sm text-gray-600 font-medium">{catName}</td>
                                <td className="px-6 py-3 text-sm font-bold text-gray-800">{unit.title}</td>
                                <td className="px-6 py-3 text-sm text-gray-600">{unit.level}</td>
                                <td className="px-6 py-3">
                                    <span className={`text-xs px-2 py-1 rounded font-bold ${unit.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {unit.status}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => handleEditUnit(unit)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => deleteUnit(unit.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </section>
    </div>
  );
};

export default ManagePosting;