import { useState, useEffect, useCallback, useRef } from 'react';
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

  useEffect(() => {
    supabase
      .from('expense_comments')
      .select('id', { count: 'exact', head: true })
      .eq('expense_id', expense.id)
      .then(({ count }) => setCommentCount(count ?? 0));
  }, [expense.id, openComments]);

  const dateStr = new Date(expense.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    /* Receipt / torn-paper aesthetic to match existing map popups */
    <div className="flex-shrink-0 w-72 bg-[#FDFBF6] rounded-2xl overflow-hidden border border-zinc-200 shadow-sm flex flex-col">

      {/* Zigzag top tear */}
      <svg width="100%" height="8" viewBox="0 0 288 8" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" className="block flex-shrink-0">
        <polyline points="0,8 10,0 20,8 30,0 40,8 50,0 60,8 70,0 80,8 90,0 100,8 110,0 120,8 130,0 140,8 150,0 160,8 170,0 180,8 190,0 200,8 210,0 220,8 230,0 240,8 250,0 260,8 270,0 280,8 288,4" fill="none" stroke="white" strokeWidth="8" />
      </svg>

      {/* Photo */}
      <div className="relative w-full h-48 bg-zinc-100 flex-shrink-0">
        {photos.length > 0 ? (
          <>
            <img
              src={photos[photoIdx]}
              alt=""
              className="w-full h-full object-cover"
            />
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setPhotoIdx(i => Math.max(0, i - 1))}
                  disabled={photoIdx === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/40 text-white rounded-full flex items-center justify-center disabled:opacity-20 hover:bg-black/60 transition-colors"
                >
                  <FaChevronLeft size={10} />
                </button>
                <button
                  onClick={() => setPhotoIdx(i => Math.min(photos.length - 1, i + 1))}
                  disabled={photoIdx === photos.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/40 text-white rounded-full flex items-center justify-center disabled:opacity-20 hover:bg-black/60 transition-colors"
                >
                  <FaChevronRight size={10} />
                </button>
                {/* Dot indicators */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {photos.map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === photoIdx ? 'bg-white' : 'bg-white/40'}`} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Receipt body */}
      <div className="px-4 pt-3 pb-4 flex flex-col gap-2.5 flex-1">

        {/* Header dashed separator */}
        <div className="flex items-center justify-between pb-2 border-b border-dashed border-zinc-300">
          <span className="text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">🧾 Receipt</span>
          <span className="text-[10px] text-zinc-400">{dateStr}</span>
        </div>

        {/* Poster */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full overflow-hidden bg-zinc-100 flex-shrink-0 flex items-center justify-center">
            {poster?.avatarUrl ? (
              <img src={poster.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <FaUserCircle className="text-zinc-300" size={16} />
            )}
          </div>
          <span className="text-xs font-semibold text-zinc-700">{poster?.displayName || 'Member'}</span>
        </div>

        {/* Title + amount */}
        <div>
          <h4 className="text-sm font-semibold text-zinc-900 truncate">
            {expense.title || expense.caption || 'Expense'}
          </h4>
          {(expense.short_location || expense.location_name) && (
            <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
              <FaMapMarkerAlt size={9} />
              <span className="truncate">{expense.short_location || expense.location_name}</span>
            </p>
          )}
        </div>

        {/* Amount — big receipt style */}
        <div className="text-2xl font-bold text-zinc-900 tabular-nums text-center my-0.5 tracking-tight">
          {currency}{Number(expense.amount).toFixed(2)}
        </div>

        {/* Rating + tag row */}
        <div className="flex items-center justify-between border-t border-dashed border-zinc-300 pt-2">
          <span className="text-xs text-amber-400 flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <FaStar key={i} size={10} className={i < expense.star_rating ? 'text-amber-400' : 'text-zinc-200'} />
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

        {/* Monospace footer */}
        <p className="font-mono text-[9px] text-zinc-300 text-center tracking-widest">· · · LOGGED IN GASTOS · · ·</p>

        {/* Comments toggle */}
        <button
          onClick={() => setOpenComments(v => !v)}
          className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-800 transition-colors mt-0.5 w-fit"
        >
          <FaComment size={11} />
          {commentCount !== null
            ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}`
            : 'Comments'}
        </button>

        {/* Comments section */}
        {openComments && (
          <PostComments
            expenseId={expense.id}
            currentUserProfile={currentUserProfile}
          />
        )}
      </div>

      {/* Zigzag bottom tear */}
      <svg width="100%" height="8" viewBox="0 0 288 8" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" className="block flex-shrink-0" style={{ transform: 'rotate(180deg)' }}>
        <polyline points="0,8 10,0 20,8 30,0 40,8 50,0 60,8 70,0 80,8 90,0 100,8 110,0 120,8 130,0 140,8 150,0 160,8 170,0 180,8 190,0 200,8 210,0 220,8 230,0 240,8 250,0 260,8 270,0 280,8 288,4" fill="none" stroke="white" strokeWidth="8" />
      </svg>
    </div>
  );
}

export default function PostsFeed({ members }) {
  const { profile, session } = useAuth();
  const currency = profile?.currency || '₱';

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('recent'); // 'recent' | 'old'
  const [postedByFilter, setPostedByFilter] = useState('all');

  const scrollRef = useRef(null);

  // Build a quick lookup: user_id -> member info
  const membersByUserId = {};
  members.forEach(m => {
    const uid = m.linked_user_id || m.user_id;
    if (uid) membersByUserId[uid] = m;
  });

  // Also include the current user themselves
  const currentUserProfile = {
    avatar_url: profile?.avatar_url,
    full_name: profile?.full_name,
  };

  const fetchExpenses = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);

    // Gather all relevant user IDs: current user + linked members
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

  // Poster info resolver
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

  // Poster filter options
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

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 300, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Sort */}
        <div className="flex items-center bg-white border border-zinc-200 rounded-lg overflow-hidden text-sm">
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

        {/* Posted by */}
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

      {/* Feed */}
      {loading ? (
        <div className="flex gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-72 h-96 bg-zinc-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center">
          <FaComment className="text-zinc-200 mx-auto mb-3" size={32} />
          <h3 className="text-sm font-semibold text-zinc-700">No posts yet</h3>
          <p className="text-xs text-zinc-400 mt-1">Expenses logged by members will appear here.</p>
        </div>
      ) : (
        <div className="relative group">
          {/* Left arrow */}
          <button
            onClick={() => scroll(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 bg-white border border-zinc-200 rounded-full shadow-sm flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:shadow-md transition-all opacity-0 group-hover:opacity-100"
          >
            <FaChevronLeft size={12} />
          </button>

          {/* Scroll track */}
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto pb-4"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {filtered.map(exp => (
              <div key={exp.id} style={{ scrollSnapAlign: 'start' }}>
                <ExpensePostCard
                  expense={exp}
                  poster={getPoster(exp)}
                  currency={currency}
                  currentUserProfile={currentUserProfile}
                />
              </div>
            ))}
          </div>

          {/* Right arrow */}
          <button
            onClick={() => scroll(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 bg-white border border-zinc-200 rounded-full shadow-sm flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:shadow-md transition-all opacity-0 group-hover:opacity-100"
          >
            <FaChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}