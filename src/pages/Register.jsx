import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { FaUser, FaEnvelope, FaLock, FaArrowRight, FaWallet } from 'react-icons/fa';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [strength, setStrength] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Simple password strength meter (0–3)
  const calcStrength = (pwd) => {
    let score = 0;
    if (pwd.length > 5) score++;
    if (pwd.length > 8) score++;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    return score;
  };

  const handlePasswordChange = (e) => {
    const pwd = e.target.value;
    setPassword(pwd);
    setStrength(calcStrength(pwd));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Auto-create profile
      if (data.user) {
        await supabase.from('profiles').insert({ id: data.user.id, full_name: fullName });
      }
      navigate('/');
    }
  };

  const strengthLabel = ['Weak', 'Fair', 'Good', 'Strong'];
  const strengthColor = ['bg-rose-400', 'bg-amber-400', 'bg-indigo-400', 'bg-emerald-500'];

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-md">
        {/* Brand mark */}
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center">
            <FaWallet className="text-white" size={14} />
          </div>
          <span className="text-lg font-semibold text-zinc-900 tracking-tight">Gastos</span>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm">
          {/* Header */}
          <div className="mb-7">
            <h1 className="text-2xl font-semibold text-zinc-900">Start your tab</h1>
            <p className="text-sm text-zinc-400 mt-1">Create an account to begin tracking</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-3.5">
            {/* Full Name */}
            <div className="relative">
              <FaUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-300" size={14} />
              <input
                type="text"
                placeholder="Full name"
                autoComplete="name"
                className="w-full pl-10 pr-4 py-3 border border-zinc-200 rounded-xl bg-white text-zinc-900 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            {/* Email */}
            <div className="relative">
              <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-300" size={14} />
              <input
                type="email"
                placeholder="Email"
                autoComplete="email"
                className="w-full pl-10 pr-4 py-3 border border-zinc-200 rounded-xl bg-white text-zinc-900 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div className="relative">
              <FaLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-300" size={14} />
              <input
                type="password"
                placeholder="Password"
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-3 border border-zinc-200 rounded-xl bg-white text-zinc-900 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all"
                value={password}
                onChange={handlePasswordChange}
                required
              />
            </div>

            {/* Password strength indicator */}
            {password && (
              <div className="space-y-1.5 pt-1">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i <= strength ? strengthColor[strength] : 'bg-zinc-100'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-zinc-400">{strengthLabel[strength]} password</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Creating account…' : (
                <>
                  Sign up <FaArrowRight size={11} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link to="/login" className="text-zinc-900 font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}