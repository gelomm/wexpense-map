import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUI } from '../contexts/UIContext';
import { FaPlus, FaTrash, FaUserCircle, FaEnvelopeOpen, FaClock, FaTimes } from 'react-icons/fa';
import toast from 'react-hot-toast';
import InviteModal from '../components/InviteModal';
import PostsFeed from '../components/PostsFeed';

export default function Members() {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const navigate = useNavigate();

  const { triggerRefresh } = useUI();

  const fetchMembers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: rawMembers, error } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to load members: ' + error.message);
      return;
    }
    if (!rawMembers?.length) {
      setMembers([]);
      return;
    }

    // Linked profiles
    const linkedIds = rawMembers.map(m => m.linked_user_id).filter(Boolean);
    let profilesById = {};
    if (linkedIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', linkedIds);
      if (profiles) {
        profilesById = Object.fromEntries(profiles.map(p => [p.id, p]));
      }
    }

    const enriched = await Promise.all(
      rawMembers.map(async (m) => {
        try {
          const userId = m.linked_user_id || m.user_id;
          if (userId) {
            const { data: expenseData } = await supabase
              .from('expenses')
              .select('amount, created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });

            const totalExpense = expenseData?.reduce((sum, e) => sum + e.amount, 0) || 0;
            const recentExpense = expenseData?.[0] || null;

            // Contribution = lifetime count of expense posts (drives rank), not a sum
            const contributionCount = expenseData?.length || 0;

            return {
              ...m,
              displayName: (profilesById[m.linked_user_id]?.full_name) || m.name || 'Unknown',
              avatarUrl: profilesById[m.linked_user_id]?.avatar_url || null,
              totalExpense,
              recentExpense,
              contributionCount,
            };
          }
        } catch (e) {
          console.warn('Enrich error for member', m.id, e);
        }
        return {
          ...m,
          displayName: m.name || 'Unknown',
          avatarUrl: null,
          totalExpense: 0,
          recentExpense: null,
          contributionCount: 0,
        };
      })
    );

    setMembers(enriched);
  }, []);

  const fetchInvitations = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('member_invitations')
      .select('*')
      .eq('inviter_id', user.id)
      .eq('status', 'pending');
    setInvitations(data || []);
  }, []);

  useEffect(() => {
    fetchMembers();
    fetchInvitations();
  }, [fetchMembers, fetchInvitations]);

  const revokeInvitation = async (id) => {
    await supabase.from('member_invitations').update({ status: 'expired' }).eq('id', id);
    fetchInvitations();
    toast.success('Invitation revoked');
  };

  const deleteMember = async (id) => {
    if (!confirm('Delete this member?')) return;
    await supabase.from('members').delete().eq('id', id);
    fetchMembers();
    triggerRefresh();
    toast.success('Member removed');
  };

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200 p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
            <FaClock className="text-zinc-400" size={14} /> Pending invitations
          </h2>
          <div className="divide-y divide-zinc-100">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                    <FaEnvelopeOpen className="text-zinc-400" size={12} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{inv.email}</p>
                    <p className="text-xs text-zinc-400">
                      Expires {new Date(inv.expires_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => revokeInvitation(inv.id)}
                  className="text-zinc-400 hover:text-rose-600 transition-colors"
                >
                  <FaTimes size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members strip + Add member */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-900">Members</h2>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 bg-zinc-900 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <FaPlus size={11} /> Add member
          </button>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center mx-auto mb-3 text-zinc-400">
              <FaUserCircle size={22} />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900">No members yet</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              Invite friends or add them manually to start posting expenses together.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {members.map((member) => (
              <div
                key={member.id}
                onClick={() => navigate(`/members/${member.id}`)}
                className="group relative flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-full border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-100 flex-shrink-0 flex items-center justify-center">
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <FaUserCircle className="text-zinc-300" size={20} />
                  )}
                </div>
                <span className="text-sm font-medium text-zinc-800 truncate max-w-[120px]">
                  {member.displayName}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMember(member.id); }}
                  className="text-zinc-300 hover:text-rose-500 transition-colors flex-shrink-0"
                  title="Remove member"
                >
                  <FaTrash size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WeFeed — default view */}
      <PostsFeed members={members} />

      {/* Invite / Add Modal */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onMemberAdded={() => {
            fetchMembers();
            fetchInvitations();
            triggerRefresh();
            setShowInviteModal(false);
          }}
        />
      )}
    </div>
  );
}