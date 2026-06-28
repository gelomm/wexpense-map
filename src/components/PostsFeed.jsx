import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FaUserCircle, FaMapMarkerAlt, FaStar, FaComment, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import PostComments from './PostComments';

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

function ExpensePostCard({ expense, poster, currency, currentUserProfile }) {
  const [openComments, setOpenComments] = useState(false);
  const [commentCount, setCommentCount] = useState(null);
  const photos = expense.photos?.length ? expense.photos : expense.photo_url ? [expense.photo_url] : [];
  const [photoIdx, setPhotoIdx] = useState(0);

  // count is kept in sync via onCountChange from PostComments

  const dateStr = new Date(expense.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="w-full max-w-lg mx-auto bg-[#FDFBF6] rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">

      {/* Instagram-style header: avatar + name + date */}
      <div className="flex text-left items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-100 flex-shrink-0 flex items-center justify-center ring-2 ring-zinc-200">
          {poster?.avatarUrl ? (
            <img src={poster.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <FaUserCircle className="text-zinc-300" size={20} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 truncate">{poster?.displayName || 'Member'}</p>
          {(expense.short_location || expense.location_name) && (
            <p className="text-[11px] text-zinc-400 flex items-center gap-1">
              <FaMapMarkerAlt size={9} />
              <span className="truncate">{expense.short_location || expense.location_name}</span>
            </p>
          )}
        </div>
        <span className="text-[10px] text-zinc-400 flex-shrink-0">{dateStr}</span>
      </div>

      {/* Photo — full width, square-ish like Instagram */}
      <div className="relative w-full bg-zinc-100" style={{ aspectRatio: '4/3' }}>
        {photos.length > 0 ? (
          <>
            <img src={photos[photoIdx]} alt="" className="w-full h-full object-cover" />
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setPhotoIdx(i => Math.max(0, i - 1))}
                  disabled={photoIdx === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 text-white rounded-full flex items-center justify-center disabled:opacity-20 hover:bg-black/60 transition-colors"
                >
                  <FaChevronLeft size={11} />
                </button>
                <button
                  onClick={() => setPhotoIdx(i => Math.min(photos.length - 1, i + 1))}
                  disabled={photoIdx === photos.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 text-white rounded-full flex items-center justify-center disabled:opacity-20 hover:bg-black/60 transition-colors"
                >
                  <FaChevronRight size={11} />
                </button>
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {photos.map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === photoIdx ? 'bg-white' : 'bg-white/40'}`} />
                  ))}
                </div>
                <span className="absolute top-2.5 right-3 text-[10px] font-medium text-white bg-black/40 rounded-full px-2 py-0.5">
                  {photoIdx + 1}/{photos.length}
                </span>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Receipt body — dashed separator aesthetic */}
      <div className="px-4 pt-3 pb-4 space-y-2.5">

        {/* Title + amount on same line */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm text-left font-semibold text-zinc-900 truncate flex-1">
            {expense.title || expense.caption || 'Expense'}
          </h4>
          <span className="text-lg font-bold text-zinc-900 tabular-nums flex-shrink-0 tracking-tight">
            {currency}{Number(expense.amount).toFixed(2)}
          </span>
        </div>

        {/* Rating + tag */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <FaStar key={i} size={11} className={i < expense.star_rating ? 'text-amber-400' : 'text-zinc-200'} />
            ))}
          </span>
          {expense.location_tag && (
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: `${TAG_COLORS[expense.location_tag]}1A`, color: TAG_COLORS[expense.location_tag] }}
            >
              {tagLabels[expense.location_tag] || expense.location_tag}
            </span>
          )}
        </div>

        {/* Caption if present */}
        {expense.caption && expense.title && (
          <p className="text-sm text-left text-zinc-500 leading-snug">{expense.caption}</p>
        )}

        {/* Dashed divider */}
        <div className="border-t border-dashed border-zinc-200" />

        {/* Comments toggle */}
        <button
          onClick={() => setOpenComments(v => !v)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <FaComment size={11} />
          {commentCount !== null
            ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}`
            : 'Comments'}
        </button>

        {openComments && (
          <PostComments
            expenseId={expense.id}
            currentUserProfile={currentUserProfile}
            onCountChange={(n) => setCommentCount(n)}
          />
        )}
      </div>
    </div>
  );
}

export default function PostsFeed({ members }) {
  const { profile, session } = useAuth();
  const currency = profile?.currency || '₱';

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('recent');
  const [postedByFilter, setPostedByFilter] = useState('all');

  const membersByUserId = {};
  members.forEach(m => {
    const uid = m.linked_user_id || m.user_id;
    if (uid) membersByUserId[uid] = m;
  });

  const currentUserProfile = {
    avatar_url: profile?.avatar_url,
    full_name: profile?.full_name,
  };

  const fetchExpenses = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);

    const allUserIds = [session.user.id];
    members.forEach(m => { if (m.linked_user_id) allUserIds.push(m.linked_user_id); });
    const uniqueIds = [...new Set(allUserIds)];

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .in('user_id', uniqueIds)
      .order('created_at', { ascending: sortOrder === 'old' });

    if (!error) setExpenses(data || []);
    setLoading(false);
  }, [session, members, sortOrder]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const getPoster = (expense) => {
    if (expense.user_id === session?.user?.id) {
      return {
        displayName: profile?.full_name || 'You',
        avatarUrl: profile?.avatar_url || null,
        userId: session.user.id,
      };
    }
    const m = membersByUserId[expense.user_id];
    return m || { displayName: 'Member', avatarUrl: null, userId: expense.user_id };
  };

  const posterOptions = [
    { value: 'all', label: 'All members' },
    { value: session?.user?.id, label: profile?.full_name || 'Me' },
    ...members
      .filter(m => m.linked_user_id)
      .map(m => ({ value: m.linked_user_id, label: m.displayName })),
  ];

  const filtered = expenses.filter(e => {
    if (postedByFilter === 'all') return true;
    return e.user_id === postedByFilter;
  });

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center bg-white border border-zinc-200 rounded-lg overflow-hidden">
          {[{ v: 'recent', l: 'Recent' }, { v: 'old', l: 'Oldest' }].map(opt => (
            <button
              key={opt.v}
              onClick={() => setSortOrder(opt.v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                sortOrder === opt.v
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {opt.l}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-medium">Posted by</span>
          <select
            value={postedByFilter}
            onChange={e => setPostedByFilter(e.target.value)}
            className="text-xs bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-700 focus:outline-none focus:border-zinc-400 cursor-pointer"
          >
            {posterOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <span className="ml-auto text-xs text-zinc-400">
          {filtered.length} post{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Vertical feed */}
      {loading ? (
        <div className="space-y-4 max-w-lg mx-auto">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-full h-80 bg-zinc-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center">
          <FaComment className="text-zinc-200 mx-auto mb-3" size={32} />
          <h3 className="text-sm font-semibold text-zinc-700">No posts yet</h3>
          <p className="text-xs text-zinc-400 mt-1">Expenses logged by members will appear here.</p>
        </div>
      ) : (
        <div className="space-y-5 max-w-lg mx-auto pb-8">
          {filtered.map(exp => (
            <ExpensePostCard
              key={exp.id}
              expense={exp}
              poster={getPoster(exp)}
              currency={currency}
              currentUserProfile={currentUserProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
}