import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { FaPlus, FaTrash, FaUserCircle, FaEnvelopeOpen, FaClock, FaTimes, FaNewspaper, FaUsers } from 'react-icons/fa';
import toast from 'react-hot-toast';
import MemberDetail from '../components/MemberDetail';
import InviteModal from '../components/InviteModal';
import PostsFeed from '../components/PostsFeed';

export default function Members() {
  const { profile } = useAuth();
  const currency = profile?.currency || '₱';
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'posts'

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

    // YTD date range
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();

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

            // YTD contributions
            const ytdTotal = expenseData
              ?.filter(e => e.created_at >= yearStart)
              .reduce((sum, e) => sum + e.amount, 0) || 0;

            return {
              ...m,
              displayName: (profilesById[m.linked_user_id]?.full_name) || m.name || 'Unknown',
              avatarUrl: profilesById[m.linked_user_id]?.avatar_url || null,
              totalExpense,
              recentExpense,
              ytdTotal,
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
          ytdTotal: 0,
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Members</h1>
          <p className="text-sm text-zinc-500 mt-0.5">People you split expenses with</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <FaPlus size={12} /> Add member
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-200">
        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
            activeTab === 'members'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-700'
          }`}
        >
          <FaUsers size={13} /> Members
        </button>
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
            activeTab === 'posts'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-700'
          }`}
        >
          <FaNewspaper size={13} /> Posts
        </button>
      </div>

      {/* ── Members Tab ── */}
      {activeTab === 'members' && (
        <>
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

          {/* Member Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {members.map((member) => (
              <div
                key={member.id}
                onClick={() => setSelectedMember(member)}
                className="cursor-pointer bg-white rounded-2xl border border-zinc-200 p-5 hover:border-zinc-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-zinc-100 flex-shrink-0 flex items-center justify-center">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FaUserCircle className="text-zinc-300" size={28} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-zinc-900 truncate text-sm">{member.displayName}</h3>
                    <p className="text-xs text-zinc-400">
                      {member.linked_user_id ? 'Joined' : 'Not joined yet'}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteMember(member.id); }}
                    className="text-zinc-400 hover:text-rose-500 transition-colors flex-shrink-0"
                  >
                    <FaTrash size={14} />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-zinc-500">Total</span>
                    <span className="text-sm font-semibold text-zinc-900 tabular-nums">
                      {currency}{(member.totalExpense || 0).toFixed(2)}
                    </span>
                  </div>
                  {/* YTD contribution */}
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-zinc-400">
                      YTD <span className="text-[10px] text-zinc-300">contributions</span>
                    </span>
                    <span className="text-xs font-medium text-zinc-500 tabular-nums">
                      {currency}{(member.ytdTotal || 0).toFixed(2)}
                    </span>
                  </div>
                  {member.recentExpense && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-zinc-400">Recent</span>
                      <span className="text-xs text-zinc-600 tabular-nums">
                        {currency}{member.recentExpense.amount}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Empty state */}
            {members.length === 0 && invitations.length === 0 && (
              <div className="col-span-full bg-white rounded-2xl border border-zinc-200 p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center mx-auto mb-4 text-zinc-400">
                  <FaUserCircle size={24} />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900">No members yet</h3>
                <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
                  Invite friends or add them manually to start splitting expenses.
                </p>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="mt-4 inline-flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <FaPlus size={12} /> Add your first member
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Posts Tab ── */}
      {activeTab === 'posts' && (
        <PostsFeed members={members} />
      )}

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

      {/* Member Detail Modal */}
      {selectedMember && (
        <MemberDetail
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}