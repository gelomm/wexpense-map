import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FaArrowLeft, FaUserCircle, FaMapMarkerAlt } from 'react-icons/fa';
import toast from 'react-hot-toast';
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

export default function MemberDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const currency = profile?.currency || '₱';

  const [member, setMember] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMember = useCallback(async () => {
    setLoading(true);

    const { data: row, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !row) {
      toast.error('Member not found');
      setLoading(false);
      return;
    }

    let linkedProfile = null;
    if (row.linked_user_id) {
      const { data: p } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', row.linked_user_id)
        .single();
      linkedProfile = p || null;
    }

    const userId = row.linked_user_id || row.user_id;
    let expenseData = [];
    if (userId) {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      expenseData = data || [];
    }

    setMember({
      ...row,
      displayName: linkedProfile?.full_name || row.name || 'Unknown',
      avatarUrl: linkedProfile?.avatar_url || null,
    });
    setExpenses(expenseData);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchMember(); }, [fetchMember]);

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
        <div className="h-8 w-32 bg-zinc-100 rounded-lg animate-pulse" />
        <div className="h-40 w-full bg-zinc-100 rounded-2xl animate-pulse" />
        <div className="h-64 w-full bg-zinc-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto text-center py-16">
        <p className="text-zinc-500">This member could not be found.</p>
        <button
          onClick={() => navigate('/members')}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 cursor-pointer"
        >
          <FaArrowLeft size={12} /> Back to WeFeed
        </button>
      </div>
    );
  }

  const contributionCount = expenses.length;
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  const now = new Date();
  const monthExpenses = expenses.filter(e => {
    const d = new Date(e.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const topMonthExpense = monthExpenses.length
    ? monthExpenses.reduce((max, e) => (e.amount > max.amount ? e : max), monthExpenses[0])
    : null;

  const recentExpenses = expenses.slice(0, 10);

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/members')}
        className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
      >
        <FaArrowLeft size={12} /> Back to WeFeed
      </button>

      {/* Profile header card */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center border border-zinc-200 flex-shrink-0">
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <FaUserCircle className="text-zinc-300" size={48} />
            )}
          </div>

          <div className="text-center sm:text-left flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <h1 className="text-xl font-semibold text-zinc-900">{member.displayName}</h1>
              <div className="flex justify-center sm:justify-start">
                <RankBadge count={contributionCount} size="md" />
              </div>
            </div>
            <p className="text-zinc-400 text-sm mt-0.5">
              {member.linked_user_id ? 'Joined' : 'Not joined yet'}
            </p>
          </div>

          <div className="bg-zinc-50 px-5 py-4 rounded-xl text-center sm:text-right flex-shrink-0">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Total expenses</p>
            <p className="text-2xl font-semibold text-zinc-900 mt-1 tabular-nums">
              {currency}{totalExpense.toFixed(2)}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {contributionCount} expense{contributionCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Rank progress */}
        <div className="mt-5 pt-5 border-t border-zinc-100">
          <RankBadge count={contributionCount} size="md" showProgress />
        </div>
      </div>

      {/* This month's biggest expense */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200">
        <h3 className="text-sm font-semibold text-zinc-900 mb-3">This month's biggest expense</h3>
        {topMonthExpense ? (
          <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl border border-zinc-200">
            <div className="min-w-0 mr-3">
              <p className="text-sm font-medium text-zinc-900 truncate">
                {topMonthExpense.title || topMonthExpense.caption || 'Expense'}
              </p>
              {(topMonthExpense.short_location || topMonthExpense.location_name) && (
                <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                  <FaMapMarkerAlt size={9} />
                  <span className="truncate">{topMonthExpense.short_location || topMonthExpense.location_name}</span>
                </p>
              )}
            </div>
            <span className="text-xl font-bold text-zinc-900 tabular-nums flex-shrink-0">
              {currency}{Number(topMonthExpense.amount).toFixed(2)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-zinc-400 text-center py-6">No expenses this month yet</p>
        )}
      </div>

      {/* Recent expenses */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200">
        <h3 className="text-sm font-semibold text-zinc-900 mb-3">Recent expenses</h3>
        {recentExpenses.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-6">No expenses yet</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {recentExpenses.map(exp => (
              <div key={exp.id} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0 mr-3 text-left">
                  <p className="text-sm text-zinc-900 font-medium truncate">
                    {exp.title || exp.caption || 'Expense'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {exp.short_location && (
                      <p className="text-xs text-zinc-400 truncate">{exp.short_location}</p>
                    )}
                    {exp.location_tag && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: `${TAG_COLORS[exp.location_tag]}1A`, color: TAG_COLORS[exp.location_tag] }}
                      >
                        {tagLabels[exp.location_tag] || exp.location_tag}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-semibold text-zinc-900 tabular-nums flex-shrink-0">
                  {currency}{Number(exp.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}