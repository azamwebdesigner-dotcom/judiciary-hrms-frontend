
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Scale, Lock, User, ArrowRight, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import AccountRecoveryModal from '../components/AccountRecoveryModal';

const Login: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showRecovery, setShowRecovery] = useState(false);
    const [recoveryMode, setRecoveryMode] = useState<'userid' | 'password'>('password');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const cleanUsername = username.trim();
        const cleanPassword = password.trim();

        if (cleanUsername === '' || cleanPassword === '') {
            setError('Please enter both username and password.');
            setIsLoading(false);
            return;
        }

        try {
            const result = await login(cleanUsername, cleanPassword);
            if (result.success) {
                navigate('/');
            } else {
                setError(result.message || 'Invalid username or password.');
            }
        } catch (err) {
            console.error(err);
            setError('Connection Failed. Ensure XAMPP is running.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="max-w-5xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">

                {/* Left Side - Judiciary Branding */}
                <div className="md:w-5/12 bg-judiciary-900 text-white p-12 flex flex-col justify-between relative overflow-hidden">
                    {/* Background decorative circles */}
                    <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-judiciary-800 opacity-50 blur-3xl"></div>
                    <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-judiciary-700 opacity-30 blur-3xl"></div>

                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className="bg-white/10 w-16 h-16 flex items-center justify-center rounded-2xl mb-8 backdrop-blur-md shadow-lg">
                                <Scale size={36} className="text-white" />
                            </div>
                            <h1 className="text-4xl font-extrabold mb-3 tracking-tight text-white">District Judiciary <span className="text-white">Punjab</span></h1>
                            <p className="text-white text-lg opacity-90 font-light">Human Resource Management System</p>
                        </div>
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 bg-judiciary-800/50 p-4 rounded-xl backdrop-blur-sm border border-judiciary-700/50">
                                <div className="bg-white/20 p-2 rounded-lg"><ShieldCheck size={20} /></div>
                                <div>
                                    <h4 className="font-bold text-sm text-white">Secure Access</h4>
                                    <p className="text-xs text-white opacity-80">Authorized personnel only.</p>
                                </div>
                            </div>
                            <p className="text-xs text-white opacity-70">
                                &copy; {new Date().getFullYear()} Directorate of IT, District Judiciary
                                <br /> This system is developed by Mohammad Azam <br />Junior Clerk From Multan.<br />+923326006034
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Side - Login Form */}
                <div className="md:w-7/12 p-12 lg:p-16 flex flex-col justify-center bg-white relative">
                    <div className="max-w-md mx-auto w-full">
                        <div className="mb-10">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                            <p className="text-gray-500">Please enter your credentials to access the portal.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl border border-red-100 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                        <span className="font-semibold">{error}</span>
                                    </div>
                                    {error.toLowerCase().includes('user not found') && (
                                        <p className="text-xs text-red-500 ml-8 mt-1">
                                            Ensure User "admin" exists in table "system_users" (verify in PHPMyAdmin).
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">Username</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-judiciary-600 transition-colors" size={20} />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-judiciary-500 focus:border-transparent outline-none transition-all font-medium text-gray-800 placeholder:text-gray-400"
                                        placeholder="e.g. admin"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-judiciary-600 transition-colors" size={20} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-judiciary-500 focus:border-transparent outline-none transition-all font-medium text-gray-800 placeholder:text-gray-400"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-judiciary-600 hover:bg-judiciary-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-judiciary-600/20 hover:shadow-xl hover:shadow-judiciary-600/30 transition-all active:scale-[0.99] flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <>Sign In <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" /></>}
                            </button>
                            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => { setRecoveryMode('userid'); setShowRecovery(true); }}
                                    className="text-sm font-medium text-gray-500 hover:text-judiciary-600 transition-colors"
                                >
                                    Forgot UserID?
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setRecoveryMode('password'); setShowRecovery(true); }}
                                    className="text-sm font-medium text-gray-500 hover:text-judiciary-600 transition-colors"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <AccountRecoveryModal
                isOpen={showRecovery}
                onClose={() => setShowRecovery(false)}
                mode={recoveryMode}
            />
        </div>
    );
};

export default Login;
