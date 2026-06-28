import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { FaEnvelope, FaLock, FaArrowRight, FaWallet } from 'react-icons/fa';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      const redirectTo = searchParams.get('redirect');
      navigate(redirectTo || '/');
    }
  };

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
            <h1 className="text-2xl font-semibold text-zinc-900">Welcome back</h1>
            <p className="text-sm text-zinc-400 mt-1">Log in to pick up your tab</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5">
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
                autoComplete="current-password"
                className="w-full pl-10 pr-4 py-3 border border-zinc-200 rounded-xl bg-white text-zinc-900 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Logging in…' : (
                <>
                  Log in <FaArrowRight size={11} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-zinc-500">
          No account yet?{' '}
          <Link to="/register" className="text-zinc-900 font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}