import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FaUserCircle, FaReply, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import toast from 'react-hot-toast';

export default function PostComments({ expenseId, currentUserProfile, onCountChange }) {
  const { session } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [expandedReplies, setExpandedReplies] = useState({});

  const fetchComments = useCallback(async () => {
    // 1. Fetch raw comments
    const { data, error } = await supabase
      .from('expense_comments')
      .select('id, content, created_at, user_id, parent_id')
      .eq('expense_id', expenseId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Comments fetch error:', error.message);
      setLoading(false);
      return;
    }

    const rows = data || [];

    // 2. Fetch profiles for all unique user_ids separately (avoids FK join issues)
    const userIds = [...new Set(rows.map(c => c.user_id))];
    let profileMap = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      (profiles || []).forEach(p => { profileMap[p.id] = p; });
    }

    // 3. Attach profile to each comment
    const enriched = rows.map(c => ({
      ...c,
      profile: profileMap[c.user_id] || null,
      replies: [],
    }));

    // 4. Nest replies under parents
    const byId = {};
    enriched.forEach(c => { byId[c.id] = c; });
    const topLevel = [];
    enriched.forEach(c => {
      if (c.parent_id && byId[c.parent_id]) {
        byId[c.parent_id].replies.push(c);
      } else if (!c.parent_id) {
        topLevel.push(c);
      }
    });

    setComments(topLevel);
    setLoading(false);

    // Notify parent of total count (top-level + all replies)
    if (onCountChange) onCountChange(enriched.length);
  }, [expenseId, onCountChange]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const submitComment = async (content, parentId = null) => {
    if (!session?.user) { toast.error('Sign in to comment'); return; }
    if (!content.trim()) return;

    setSubmitting(true);
    const { error } = await supabase.from('expense_comments').insert({
      expense_id: expenseId,
      user_id: session.user.id,
      content: content.trim(),
      parent_id: parentId || null,
    });

    if (error) {
      toast.error('Could not post comment');
    } else {
      if (parentId) {
        setReplyText('');
        setReplyingTo(null);
        setExpandedReplies(prev => ({ ...prev, [parentId]: true }));
      } else {
        setNewComment('');
      }
      // Re-fetch immediately so the new comment appears right away
      fetchComments();
    }
    setSubmitting(false);
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const CommentItem = ({ comment, isReply = false }) => (
    <div className={`flex gap-2.5 ${isReply ? 'mt-2 ml-8' : 'mt-3'}`}>
      <div className="w-7 h-7 rounded-full overflow-hidden bg-zinc-100 flex-shrink-0 flex items-center justify-center mt-0.5">
        {comment.profile?.avatar_url ? (
          <img src={comment.profile.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <FaUserCircle className="text-zinc-300" size={16} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-zinc-50 rounded-xl px-3 py-2">
          <p className="text-[11px] font-semibold text-zinc-700 mb-0.5">
            {comment.profile?.full_name || 'Member'}
          </p>
          <p className="text-sm text-zinc-800 leading-snug">{comment.content}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 ml-1">
          <span className="text-[10px] text-zinc-400">{formatTime(comment.created_at)}</span>
          {!isReply && (
            <button
              onClick={() => {
                setReplyingTo(comment.id === replyingTo?.id ? null : {
                  id: comment.id,
                  authorName: comment.profile?.full_name || 'Member',
                });
                setReplyText('');
              }}
              className="text-[10px] font-medium text-zinc-400 hover:text-zinc-700 flex items-center gap-1 transition-colors"
            >
              <FaReply size={9} /> Reply
            </button>
          )}
        </div>

        {/* Inline reply input */}
        {!isReply && replyingTo?.id === comment.id && (
          <div className="mt-2 flex gap-2 items-start">
            <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-100 flex-shrink-0 flex items-center justify-center mt-0.5">
              {currentUserProfile?.avatar_url ? (
                <img src={currentUserProfile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <FaUserCircle className="text-zinc-300" size={14} />
              )}
            </div>
            <div className="flex-1 flex gap-1.5">
              <input
                autoFocus
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(replyText, comment.id); }
                  if (e.key === 'Escape') { setReplyingTo(null); setReplyText(''); }
                }}
                placeholder={`Reply to ${replyingTo.authorName}…`}
                className="flex-1 text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-zinc-400 placeholder:text-zinc-400"
              />
              <button
                onClick={() => submitComment(replyText, comment.id)}
                disabled={!replyText.trim() || submitting}
                className="text-xs font-medium bg-zinc-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-zinc-700 transition-colors"
              >
                Post
              </button>
            </div>
          </div>
        )}

        {/* Replies */}
        {comment.replies?.length > 0 && (
          <div>
            <button
              onClick={() => setExpandedReplies(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
              className="mt-1.5 ml-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-600 flex items-center gap-1 transition-colors"
            >
              {expandedReplies[comment.id]
                ? <><FaChevronUp size={8} /> Hide {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}</>
                : <><FaChevronDown size={8} /> View {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}</>
              }
            </button>
            {expandedReplies[comment.id] && comment.replies.map(r => (
              <CommentItem key={r.id} comment={r} isReply />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="mt-3 pt-3 border-t border-zinc-100">
      {loading ? (
        <p className="text-xs text-zinc-400 py-2">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-zinc-400 py-1">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-0">
          {comments.map(c => <CommentItem key={c.id} comment={c} />)}
        </div>
      )}

      {/* New comment input */}
      <div className="flex gap-2 items-start mt-3">
        <div className="w-7 h-7 rounded-full overflow-hidden bg-zinc-100 flex-shrink-0 flex items-center justify-center mt-0.5">
          {currentUserProfile?.avatar_url ? (
            <img src={currentUserProfile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <FaUserCircle className="text-zinc-300" size={16} />
          )}
        </div>
        <div className="flex-1 flex gap-1.5">
          <input
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(newComment); }
            }}
            placeholder="Add a comment…"
            className="flex-1 text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-zinc-400 placeholder:text-zinc-400"
          />
          <button
            onClick={() => submitComment(newComment)}
            disabled={!newComment.trim() || submitting}
            className="text-xs font-medium bg-zinc-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-zinc-700 transition-colors"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}