import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FaTimes, FaUserCircle } from 'react-icons/fa';

export default function MemberDetail({ member, onClose }) {
  const { profile } = useAuth();
  const currency = profile?.currency || '₱';
  const [expenses, setExpenses] = useState([]);
  const [highestExpense, setHighestExpense] = useState(null);

  useEffect(() => {
    const userId = member.linked_user_id || member.user_id;
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setExpenses(data || []);
        if (data?.length) {
          const max = data.reduce((max, e) => (e.amount > max.amount ? e : max), data[0]);
          setHighestExpense(max);
        }
      });
  }, [member]);

  return (
    <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
      <div className="bg-white w-full max-w-lg max-h-[80vh] overflow-auto rounded-2xl shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 pt-5 pb-3 z-10 border-b border-zinc-100">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center">
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FaUserCircle className="text-zinc-300" size={24} />
                )}
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-900">{member.displayName}</h2>
                <p className="text-xs text-zinc-400">
                  {member.linked_user_id ? 'Joined' : 'Not joined yet'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-2 rounded-lg hover:bg-zinc-50 transition-colors">
              <FaTimes size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Highest Expense */}
          {highestExpense && (
            <div className="mb-5 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Highest expense</p>
              <p className="text-2xl font-semibold text-zinc-900 mt-1 tabular-nums">
                {currency}{highestExpense.amount}
              </p>
              <p className="text-sm text-zinc-600 mt-1">
                {highestExpense.title || highestExpense.caption || 'Expense'}
              </p>
            </div>
          )}

          {/* Recent Expenses */}
          <h3 className="text-sm font-semibold text-zinc-900 mb-3">Recent expenses</h3>
          {expenses.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-6">No expenses yet</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {expenses.slice(0, 10).map(exp => (
                <div key={exp.id} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm text-zinc-900 font-medium truncate">
                      {exp.title || exp.caption || 'Expense'}
                    </p>
                    {exp.short_location && (
                      <p className="text-xs text-zinc-400 truncate">{exp.short_location}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-zinc-900 tabular-nums flex-shrink-0">
                    {currency}{exp.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}