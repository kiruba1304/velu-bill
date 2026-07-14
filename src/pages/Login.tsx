import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogIn, User as UserIcon, AlertCircle, Loader2, Eye, EyeOff, Lock } from 'lucide-react';
import loginBg from '../../assets/Login page image.png';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { login, loading, error: authError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      await login(username.trim(), password, rememberMe);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-screen w-full relative flex font-sans overflow-hidden bg-slate-950">
      {/* Background Image Overlay for Mobile ONLY */}
      <div className="absolute inset-0 md:hidden z-0">
        <img 
          src={loginBg} 
          alt="Showroom Mobile Background" 
          className="h-full w-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-slate-950/80" />
      </div>

      {/* Split Layout Container */}
      <div className="relative flex w-full min-h-screen z-10">
        {/* Left Section (70% width): Contains the image directly so it is not hidden */}
        <div className="hidden md:block md:w-[70%] relative h-full bg-slate-950">
          <img 
            src={loginBg} 
            alt="Showroom Background" 
            className="h-full w-full object-cover opacity-100"
          />
        </div>

        {/* Right Section (30% width / Mobile full width): Translucent Login Panel */}
        <div className="w-full md:w-[30%] bg-white border-l border-slate-200 flex flex-col justify-between p-6 sm:p-8 md:p-10 transition-all duration-300 z-10 text-slate-800">
          <div />

          <div className="w-full max-w-sm mx-auto space-y-5">
            {/* Sri Amman Branding Headers */}
            <div className="text-center">
              <h1 className="font-serif text-3xl font-black text-slate-950 tracking-wide mt-1">
                Sri Amman
              </h1>
              <p className="font-sans text-xs font-bold text-red-600 uppercase tracking-widest mt-0.5">
                Automobiles And Autoworks
              </p>
              <p className="font-sans text-[10px] font-bold text-sky-800 tracking-wider mt-0.5">
                Showroom • Service • Trust
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <h2 className="text-sm font-bold text-slate-950">Login to Your Account</h2>
              <p className="text-xs text-slate-500 mt-0.5">Enter your credentials to continue</p>
            </div>

            {/* Form */}
            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Error Message alert */}
              {(error || authError) && (
                <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <p>{error || authError}</p>
                </div>
              )}

              <div className="space-y-3">
                {/* Username Input */}
                <div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <UserIcon className="h-4.5 w-4.5" />
                    </span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-xs text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 focus:border-blue-600 focus:bg-white focus:ring-1 focus:ring-blue-600/20"
                      placeholder="Username / Email"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Lock className="h-4.5 w-4.5" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-xs text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 focus:border-blue-600 focus:bg-white focus:ring-1 focus:ring-blue-600/20"
                      placeholder="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Remember Me links */}
              <div className="flex items-center text-[11px] text-slate-600">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium hover:text-slate-800">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 h-3.5 w-3.5"
                  />
                  Remember me
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center rounded-xl bg-blue-600 py-3 px-4 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Login
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="text-center pt-8 text-[10px] text-slate-400 font-medium leading-relaxed">
            © 2025 Sri Amman Automobiles And Autoworks.<br />All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
