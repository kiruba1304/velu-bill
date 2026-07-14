import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogIn, Key, User as UserIcon, AlertCircle, Loader2 } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { login, loading, error: authError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      await login(username.trim(), password);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-12 font-sans sm:px-6 lg:px-8">
      {/* Decorative floating blur objects */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary-500/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />

      <div className="relative w-full max-w-md">
        {/* Glassmorphic Panel */}
        <div className="rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="text-center">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-primary-500 to-indigo-600 text-white shadow-lg shadow-primary-500/20">
              <LogIn className="h-8 w-8" />
            </div>
            
            <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Welcome Back
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Enter your credentials to access the POS Suite
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {/* Error Message alert */}
            {(error || authError) && (
              <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                <p>{error || authError}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Username Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                    <UserIcon className="h-5 w-5" />
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-3.5 pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-primary-500 focus:bg-white/10 focus:ring-2 focus:ring-primary-500/20"
                    placeholder="Enter your username"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                    <Key className="h-5 w-5" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-3.5 pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-primary-500 focus:bg-white/10 focus:ring-2 focus:ring-primary-500/20"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-primary-500 to-indigo-600 py-3.5 px-4 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 transition-all duration-200 hover:from-primary-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <>
                  Sign In
                  <LogIn className="ml-2 h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Info Box / Seeding helper */}
          <div className="mt-8 rounded-2xl border border-white/5 bg-white/5 p-4 text-center">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Default Test Credentials
            </h4>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-400">
              <div>
                <p className="font-semibold text-primary-200">Super Admin</p>
                <p>superadmin</p>
                <p>superadmin123</p>
              </div>
              <div className="border-x border-white/10">
                <p className="font-semibold text-primary-200">Admin</p>
                <p>admin</p>
                <p>admin123</p>
              </div>
              <div>
                <p className="font-semibold text-primary-200">Employee</p>
                <p>employee</p>
                <p>employee123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
