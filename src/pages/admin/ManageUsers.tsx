
import React, { useState, useEffect } from 'react';
import { User, Shield, Plus, Trash2, Lock, Save, X, UserCog, CheckCircle, Mail, CreditCard, Edit2 } from 'lucide-react';
import { api } from '../../services/api';

interface SystemUser {
    id: string;
    username: string;
    full_name: string;
    role: 'admin' | 'user';
    status: string;
    cnic?: string;
    email?: string;
}

const ManageUsers: React.FC = () => {
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        full_name: '',
        role: 'user',
        password: '',
        cnic: '',
        email: ''
    });
    const [cnicError, setCnicError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [usernameError, setUsernameError] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        const data = await api.getSystemUsers();
        if (data) {
            // Transform id from number to string
            const transformedData = data.map(user => ({
                ...user,
                id: user.id.toString() // Convert number to string
            }));
            setUsers(transformedData as SystemUser[]);
        }
    };

    const formatCnic = (value: string) => {
        // Remove non-digit characters
        const digits = value.replace(/\D/g, '');

        // Truncate to 13 digits
        const truncated = digits.slice(0, 13);

        // Format: XXXXX-XXXXXXX-X
        if (truncated.length > 12) {
            return `${truncated.slice(0, 5)}-${truncated.slice(5, 12)}-${truncated.slice(12)}`;
        } else if (truncated.length > 5) {
            return `${truncated.slice(0, 5)}-${truncated.slice(5)}`;
        } else {
            return truncated;
        }
    };

    const handleCnicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const formatted = formatCnic(value);
        setFormData(prev => ({ ...prev, cnic: formatted }));

        // Reset error on change, validation checks on blur
        setCnicError('');
    };

    const validateCnic = async () => {
        if (!formData.cnic) return true; // Optional field? Assuming mandatory based on context, but let's check

        if (formData.cnic.length !== 15) { // 13 digits + 2 dashes
            setCnicError('Invalid CNIC format. Required: 36302-1234567-8');
            return false;
        }

        setIsChecking(true);
        try {
            const check = await api.checkCnic(formData.cnic, undefined, 'system_user');
            if (check.exists) {
                setCnicError('CNIC already registered to another user.');
                setIsChecking(false);
                return false;
            }
        } catch (error) {
            console.error('Error checking CNIC:', error);
        }
        setIsChecking(false);
        return true;
    };

    const checkUniqueUsername = (username: string) => {
        const existing = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (existing) {
            setUsernameError('Username already taken.');
            return false;
        }
        setUsernameError('');
        return true;
    };

    const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\s+/g, '').toLowerCase(); // No spaces, lowercase
        setFormData(prev => ({ ...prev, username: value }));
        setUsernameError('');
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();

        // Basic Validations
        if (!formData.username || (!editingId && !formData.password) || !formData.full_name) {
            alert("Please fill all required fields");
            return;
        }

        // Validate Username uniqueness locally first (if changed)
        if (!editingId || users.find(u => u.id === editingId)?.username !== formData.username) {
            if (!checkUniqueUsername(formData.username)) {
                return;
            }
        }

        // Validate CNIC
        const isCnicValid = await validateCnic();
        if (!isCnicValid && formData.cnic) { // Only stop if CNIC is provided and invalid
            return;
        }

        // Validate Email
        if (formData.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                setEmailError('Invalid email format.');
                return;
            }
        }

        try {
            if (editingId) {
                // Update existing user
                await api.updateSystemUser({
                    id: editingId,
                    username: formData.username,
                    full_name: formData.full_name,
                    role: formData.role,
                    cnic: formData.cnic,
                    email: formData.email,
                    ...(formData.password ? { password: formData.password } : {})
                });
                setMessage('User updated successfully');
            } else {
                // Create new user
                const userData = {
                    username: formData.username,
                    full_name: formData.full_name,
                    password: formData.password,
                    role: formData.role,
                    status: 'active',
                    cnic: formData.cnic,
                    email: formData.email
                };
                await api.createSystemUser(userData);
                setMessage('User created successfully');
            }

            await loadUsers();
            setIsAdding(false);
            setEditingId(null);
            setFormData({ username: '', full_name: '', role: 'user', password: '', cnic: '', email: '' });
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('❌ Error saving user:', error);
            alert('Error saving user: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const handleEdit = (user: SystemUser) => {
        setEditingId(user.id);
        setFormData({
            username: user.username,
            full_name: user.full_name,
            role: user.role as 'admin' | 'user',
            password: '', // Don't pre-fill password
            cnic: user.cnic || '',
            email: user.email || ''
        });
        setIsAdding(true);
    };

    const handleCancel = () => {
        setIsAdding(false);
        setEditingId(null);
        setFormData({ username: '', full_name: '', role: 'user', password: '', cnic: '', email: '' });
        setCnicError('');
        setEmailError('');
        setUsernameError('');
    };

    // Keep old loadUsers logic structure
    // but we replaced handleAddUser above, so careful to not duplicate it.
    // The previous implementation of handleAddUser ended at line 69.
    // so we fully replaced it. Good.

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            try {
                await api.deleteSystemUser(id);
                await loadUsers();
            } catch (error) {
                console.error('Error deleting user:', error);
                alert('Error deleting user');
            }
        }
    };

    const handleResetPassword = async (user: SystemUser) => {
        const newPassword = prompt(`Enter new password for ${user.username}:`);
        if (newPassword) {
            if (newPassword.length < 6) {
                alert("Password must be at least 6 characters.");
                return;
            }

            try {
                await api.updateSystemUser({ ...user, password: newPassword });
                setMessage(`Password for ${user.username} reset successfully`);
                setTimeout(() => setMessage(''), 3000);
            } catch (error) {
                console.error('Error resetting password:', error);
                alert('Failed to reset password');
            }
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-judiciary-100 p-3 rounded-xl text-judiciary-700">
                        <UserCog size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">System Access Control</h2>
                        <p className="text-gray-500">Manage user accounts and role assignments.</p>
                    </div>
                </div>
                <button onClick={() => { handleCancel(); setIsAdding(true); }} className="px-5 py-2.5 bg-judiciary-600 text-white rounded-xl shadow-lg hover:bg-judiciary-700 transition flex items-center gap-2 font-medium">
                    <Plus size={18} /> Add New User
                </button>
            </div>

            {message && (
                <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 flex items-center gap-2 animate-in fade-in">
                    <CheckCircle size={20} /> {message}
                </div>
            )}

            {isAdding && (
                <div className="bg-white rounded-xl shadow-lg border border-judiciary-100 p-6 animate-in slide-in-from-top-4">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        {editingId ? <Edit2 size={18} /> : <User size={18} />}
                        {editingId ? 'Edit User Details' : 'New User Details'}
                    </h3>
                    <form onSubmit={handleSaveUser} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                            <input className="w-full p-2.5 border rounded-lg" placeholder="e.g. Ali Ahmed" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Username</label>
                            <input
                                className={`w-full p-2.5 border rounded-lg ${usernameError ? 'border-red-500' : ''}`}
                                placeholder="e.g. aliahmad"
                                value={formData.username}
                                onChange={handleUsernameChange}
                                onBlur={() => checkUniqueUsername(formData.username)}
                                required
                            />
                            {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                {editingId ? 'New Password (Optional)' : 'Password'}
                            </label>
                            <input type="password" className="w-full p-2.5 border rounded-lg" placeholder={editingId ? 'Leave blank to keep current' : '******'} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required={!editingId} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Role</label>
                            <select className="w-full p-2.5 border rounded-lg bg-white" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                <option value="user">Operator (User)</option>
                                <option value="admin">Administrator</option>
                            </select>
                            <p className="text-[10px] text-gray-400 mt-1">
                                {formData.role === 'admin' ? 'Can access System Setup & User Management.' : 'Limited to Data Entry & Reporting only.'}
                            </p>
                        </div>

                        {/* CNIC Field */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CNIC (Identity)</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <CreditCard className="text-gray-400" size={16} />
                                </div>
                                <input
                                    className={`w-full pl-10 p-2.5 border rounded-lg ${cnicError ? 'border-red-500 focus:ring-red-200' : 'border-gray-200'}`}
                                    placeholder="36302-1234567-8"
                                    value={formData.cnic}
                                    onChange={handleCnicChange}
                                    onBlur={validateCnic}
                                />
                            </div>
                            {cnicError && <p className="text-xs text-red-500 mt-1">{cnicError}</p>}
                            <p className="text-[10px] text-gray-400 mt-1">Used for account recovery.</p>
                        </div>

                        {/* Email Field */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="text-gray-400" size={16} />
                                </div>
                                <input
                                    type="email"
                                    className={`w-full pl-10 p-2.5 border rounded-lg ${emailError ? 'border-red-500 focus:ring-red-200' : 'border-gray-200'}`}
                                    placeholder="user@example.com"
                                    value={formData.email}
                                    onChange={e => {
                                        setFormData({ ...formData, email: e.target.value });
                                        setEmailError('');
                                    }}
                                />
                            </div>
                            {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
                            <p className="text-[10px] text-gray-400 mt-1">For notifications & recovery.</p>
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                            <button type="button" onClick={handleCancel} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-judiciary-600 text-white rounded-lg hover:bg-judiciary-700 flex items-center gap-2">
                                <Save size={18} /> {editingId ? 'Update Account' : 'Create Account'}
                            </button>
                        </div>
                    </form>
                </div >
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-gray-600 text-xs uppercase">User</th>
                            <th className="px-6 py-4 font-semibold text-gray-600 text-xs uppercase">Role</th>
                            <th className="px-6 py-4 font-semibold text-gray-600 text-xs uppercase">Status</th>
                            <th className="px-6 py-4 font-semibold text-gray-600 text-xs uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {users.filter(u => u.status === 'active').map(u => (
                            <tr key={u.id} className="hover:bg-gray-50/50">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold border border-gray-200">
                                            {u.full_name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{u.full_name}</p>
                                            <p className="text-xs text-gray-500">@{u.username}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {u.role === 'admin' ?
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200"><Shield size={12} /> Admin</span>
                                        :
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200"><User size={12} /> Operator</span>
                                    }
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                        {u.status === 'active' ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {u.username !== 'admin' && (
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleEdit(u)} className="p-2 text-judiciary-600 hover:bg-judiciary-50 rounded-lg transition" title="Edit User">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleResetPassword(u)} className="p-2 text-judiciary-600 hover:bg-judiciary-50 rounded-lg transition" title="Reset Password">
                                                <Lock size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(u.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete User">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div >
    );
};

export default ManageUsers;
