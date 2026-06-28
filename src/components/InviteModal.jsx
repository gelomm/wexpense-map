import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FaTimes } from 'react-icons/fa';

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function InviteModal({ onClose, onMemberAdded }) {
  const { profile } = useAuth();
  const [mode, setMode] = useState('invite');

  // ───── Invite fields ─────
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [tempPassword, setTempPassword] = useState(null);

  // ───── Manual fields ─────
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [linkedUserId, setLinkedUserId] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  const debouncedName = useDebounce(manualName, 400);

  // Search profiles when manualName changes
  useEffect(() => {
    if (!debouncedName.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const searchUsers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .ilike('full_name', `%${debouncedName}%`)
        .limit(5);

      if (!error) {
        setSearchResults(data || []);
        setShowDropdown(true);
      } else {
        console.error('Search error:', error);
      }
    };
    searchUsers();
  }, [debouncedName]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ───── Invite by email ─────
  const sendInvitation = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const token = crypto.randomUUID();

      const { error: dbError } = await supabase.from('member_invitations').insert({
        inviter_id: user.id,
        email: inviteEmail,
        token,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      if (dbError) throw dbError;

      const baseUrl = window.location.origin;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteEmail,
          inviterName: profile?.full_name || 'Someone',
          householdName: 'Gastos',
          token,
          baseUrl,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send invite');

      setTempPassword(result.temporaryPassword);
      toast.success(`Invitation sent to ${inviteEmail}!`);
      onMemberAdded();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Could not send invitation.');
    } finally {
      setSending(false);
    }
  };

  // ───── Add manually ─────
  const addManually = async (e) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (linkedUserId) {
        const { data: existing } = await supabase
          .from('members')
          .select('id')
          .eq('user_id', user.id)
          .eq('linked_user_id', linkedUserId)
          .single();
        if (existing) {
          toast.error('This person is already in your members list.');
          setSending(false);
          return;
        }
      }

      const { error } = await supabase.from('members').insert({
        user_id: user.id,
        name: manualName.trim(),
        email: manualEmail.trim() || null,
        linked_user_id: linkedUserId || null,
      });
      if (error) throw error;

      toast.success(`${manualName} added to your members.`);
      onMemberAdded();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Could not add member.');
    } finally {
      setSending(false);
    }
  };

  const selectProfile = (profile) => {
    setManualName(profile.full_name || '');
    setLinkedUserId(profile.id);
    setSearchResults([]);
    setShowDropdown(false);
  };

  return (
    <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl">
        <div className="px-6 pt-5 pb-3 flex justify-between items-center border-b border-zinc-100">
          <h2 className="text-base font-semibold text-zinc-900">
            {mode === 'invite' ? 'Invite member' : 'Add member'}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-2 rounded-lg hover:bg-zinc-50 transition-colors">
            <FaTimes size={16} />
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Mode Toggle */}
          <div className="inline-flex bg-zinc-100 rounded-lg p-1 mb-5">
            <button
              onClick={() => { setMode('invite'); setTempPassword(null); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'invite'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Send invite
            </button>
            <button
              onClick={() => { setMode('manual'); setTempPassword(null); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'manual'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Add manually
            </button>
          </div>

          {/* ─── Invite form ─── */}
          {mode === 'invite' && (
            <form onSubmit={sendInvitation}>
              <input
                type="email"
                placeholder="Email address"
                className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg bg-white text-zinc-900 placeholder-zinc-400 text-sm outline-none focus:border-zinc-900 transition-colors mb-4"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={sending} className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition-colors disabled:opacity-50">
                  {sending ? 'Sending…' : 'Send invite'}
                </button>
              </div>

              {tempPassword && (
                <div className="mt-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                  <p className="text-sm font-medium text-zinc-900">Temporary password</p>
                  <p className="font-mono text-xl font-bold text-zinc-800 mt-1">{tempPassword}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Share this with {inviteEmail}. They can log in and should change it afterwards.
                  </p>
                </div>
              )}
            </form>
          )}

          {/* ─── Manual form ─── */}
          {mode === 'manual' && (
            <form onSubmit={addManually}>
              <div className="relative mb-3" ref={searchRef}>
                <input
                  type="text"
                  placeholder="Full name"
                  className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg bg-white text-zinc-900 placeholder-zinc-400 text-sm outline-none focus:border-zinc-900 transition-colors"
                  value={manualName}
                  onChange={(e) => {
                    setManualName(e.target.value);
                    setLinkedUserId(null);
                  }}
                  required
                  autoComplete="off"
                />
                {showDropdown && searchResults.length > 0 && (
                  <div
                    ref={dropdownRef}
                    className="absolute z-10 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                  >
                    {searchResults.map((prof) => (
                      <button
                        key={prof.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-center gap-2"
                        onClick={() => selectProfile(prof)}
                      >
                        <span className="text-zinc-900">{prof.full_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="email"
                placeholder="Email (optional)"
                className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg bg-white text-zinc-900 placeholder-zinc-400 text-sm outline-none focus:border-zinc-900 transition-colors mb-4"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={sending} className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition-colors disabled:opacity-50">
                  {sending ? 'Adding…' : 'Add member'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}