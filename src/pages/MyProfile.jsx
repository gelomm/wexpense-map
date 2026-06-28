import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  FaSignOutAlt,
  FaUserCircle,
  FaMapMarkerAlt,
  FaCamera,
  FaFileInvoiceDollar,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import ExpenseForm from '../components/ExpenseForm';
import RankBadge from '../components/RankBadge';

const TAG_COLORS = {
  will_go_back: '#10b981',
  good: '#6366f1',
  one_time_only: '#a1a1aa',
  what_the_hell: '#f43f5e',
};

const tagLabels = {
  will_go_back: 'Will go back',
  one_time_only: 'One time only',
  good: 'Good',
  what_the_hell: 'What the hell?',
};

export default function MyProfile() {
  const { session, profile } = useAuth();
  const currency = profile?.currency || '₱';
  const [expenses, setExpenses] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [flippedCardId, setFlippedCardId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
  }, [profile?.avatar_url]);

  useEffect(() => {
    if (session?.user) fetchExpenses();
  }, [session, showForm]);

  const fetchExpenses = async () => {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    setExpenses(data || []);
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const toastId = toast.loading('Uploading avatar...');
    try {
      const filePath = `${session.user.id}/avatar_${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      await supabase
        .from('profiles')
        .upsert(
          {
            id: session.user.id,
            avatar_url: publicUrl,
            full_name: profile?.full_name || '',
            currency: profile?.currency || '₱',
          },
          { onConflict: 'id' }
        );

      setAvatarUrl(publicUrl);
      toast.success('Avatar updated!', { id: toastId });
    } catch (error) {
      toast.error(error.message || 'Upload failed', { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleCardClick = (expense) => {
    setFlippedCardId(expense.id);
    setTimeout(() => {
      setEditExpense(expense);
      setShowForm(true);
      setFlippedCardId(null);
    }, 400);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditExpense(null);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const displayName = profile?.full_name || 'User';
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  // Contribution = lifetime count of expense posts, drives rank
  const contributionCount = expenses.length;

  return (
    <div className="space-y-6 p-8 pb-10 max-w-[1400px] mx-auto">
      {/* Profile card */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar with camera overlay */}
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-24 h-24 rounded-full object-cover border border-zinc-200"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 border border-zinc-200">
                <FaUserCircle size={48} />
              </div>
            )}
            <label className="absolute bottom-0 right-0 bg-zinc-900 text-white p-2 rounded-full cursor-pointer hover:bg-zinc-800 transition-colors">
              <FaCamera size={12} />
              <input
                type="file"
                accept="image/*"
                onChange={uploadAvatar}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>

          {/* User info */}
          <div className="text-center sm:text-left flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <h1 className="text-xl font-semibold text-zinc-900">{displayName}</h1>
              <div className="flex justify-center sm:justify-start">
                <RankBadge count={contributionCount} size="md" />
              </div>
            </div>
            <p className="text-zinc-400 text-sm mt-0.5">{session?.user?.email}</p>
            <button
              onClick={handleSignOut}
              className="mt-4 inline-flex items-center gap-2 bg-white border border-zinc-200 text-zinc-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              <FaSignOutAlt size={12} /> Sign Out
            </button>
          </div>

          {/* Lifetime total */}
          <div className="bg-zinc-50 px-5 py-4 rounded-xl text-center sm:text-right flex-shrink-0">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Lifetime spent</p>
            <p className="text-2xl font-semibold text-zinc-900 mt-1 tabular-nums">{currency}{totalSpent.toFixed(2)}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Rank progress nudge */}
        <div className="mt-5 pt-5 border-t border-zinc-100">
          <RankBadge count={contributionCount} size="md" showProgress />
        </div>
      </div>

      {/* Expenses section */}
      <div>
        <h3 className="text-base font-semibold text-zinc-900 mb-3 flex items-center gap-2">
          <FaFileInvoiceDollar className="text-zinc-400" size={14} /> My Expenses
        </h3>

        {expenses.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border border-zinc-200 text-center">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center mx-auto mb-4 text-zinc-400">
              <FaFileInvoiceDollar size={18} />
            </div>
            <h4 className="text-sm font-semibold text-zinc-900">No expenses yet</h4>
            <p className="text-sm text-zinc-400 mt-1">Start by adding one from the dashboard.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {expenses.map((exp) => (
              <div
                key={exp.id}
                className={`cursor-pointer bg-white border border-zinc-200 rounded-2xl overflow-hidden transition-all duration-150 hover:border-zinc-300 hover:shadow-sm ${
                  flippedCardId === exp.id ? 'scale-[0.97] opacity-70' : ''
                }`}
                onClick={() => handleCardClick(exp)}
              >
                <div className="w-full h-32 bg-zinc-100">
                  {exp.photo_url ? (
                    <img src={exp.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-3.5">
                  <h4 className="text-sm font-semibold text-zinc-900 truncate">{exp.title || exp.caption || 'Expense'}</h4>
                  <p className="text-lg font-semibold text-zinc-900 mt-1 tabular-nums">{currency}{exp.amount}</p>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-xs text-zinc-400 truncate max-w-[100px]">{exp.short_location || exp.location_name}</span>
                    <span className="text-xs text-amber-500">{'★'.repeat(exp.star_rating)}<span className="text-zinc-200">{'★'.repeat(5 - exp.star_rating)}</span></span>
                  </div>
                  <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-zinc-100">
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${TAG_COLORS[exp.location_tag]}1A`, color: TAG_COLORS[exp.location_tag] }}
                    >
                      {tagLabels[exp.location_tag] || exp.location_tag}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (exp.latitude && exp.longitude) navigate(`/map?lat=${exp.latitude}&lng=${exp.longitude}`);
                      }}
                      className="text-zinc-400 hover:text-zinc-700 transition-colors"
                      title="View on map"
                    >
                      <FaMapMarkerAlt size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <ExpenseForm onClose={handleCloseForm} expense={editExpense} />
      )}
    </div>
  );
}