import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaDollarSign,
  FaTrashAlt,
  FaSave,
  FaUserCog,
  FaShieldAlt,
  FaCog,
  FaFileInvoiceDollar,
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const tabs = [
  { key: 'profile', label: 'Profile', icon: FaUserCog },
  { key: 'account', label: 'Account', icon: FaShieldAlt },
  { key: 'preferences', label: 'Preferences', icon: FaCog },
  { key: 'danger', label: 'Danger Zone', icon: FaTrashAlt },
];

export default function Settings() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('profile');
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState(profile?.currency || '₱');
  const [saving, setSaving] = useState(false);

  const updateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (fullName && fullName !== profile?.full_name) {
        await supabase
          .from('profiles')
          .upsert({ id: session.user.id, full_name: fullName }, { onConflict: 'id' });
      }
      if (currency && currency !== profile?.currency) {
        await supabase
          .from('profiles')
          .upsert({ id: session.user.id, currency }, { onConflict: 'id' });
      }
      if (email) {
        const { error } = await supabase.auth.updateUser({ email });
        if (error) throw error;
      }
      if (password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      }
      toast.success('Settings saved!');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (!confirm('Permanently delete your account? This cannot be undone.')) return;
    try {
      await supabase.from('expense_splits').delete().eq('expense_id', 'in', `(select id from expenses where user_id = '${session.user.id}')`);
      await supabase.from('expenses').delete().eq('user_id', session.user.id);
      await supabase.from('members').delete().eq('user_id', session.user.id);
      await supabase.from('profiles').delete().eq('id', session.user.id);
      await supabase.auth.signOut();
      navigate('/login');
      toast.success('Account deleted.');
    } catch {
      toast.error('Failed to delete account.');
    }
  };

  const spinner = (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
  );

  const inputClass = "w-full p-2.5 border border-zinc-200 rounded-xl bg-white text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all";
  const labelClass = "block text-sm font-medium text-zinc-700 mb-1.5 flex items-center gap-1.5";
  const hintClass = "text-xs text-zinc-400 mt-1.5";
  const saveButtonClass = "flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer";

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-4 p-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 flex items-center gap-2.5">
          <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center flex-shrink-0">
            <FaFileInvoiceDollar className="text-white" size={14} />
          </div>
          Settings
        </h1>
        <p className="text-sm text-zinc-400 mt-1.5 ml-[46px]">Manage your profile, account, and preferences.</p>
      </div>

      {/* Tab Navigation */}
      <div className="inline-flex bg-white border border-zinc-200 rounded-full p-1 overflow-x-auto max-w-full">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-zinc-900">
            <FaUser size={13} className="text-zinc-400" /> Profile
          </h2>
          <form onSubmit={updateProfile} className="space-y-4">
            <div>
              <label className={labelClass}>Full Name</label>
              <input
                type="text"
                className={inputClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className={labelClass}>
                <FaEnvelope className="text-zinc-400" size={12} /> Email
              </label>
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="New email (leave blank to keep current)"
              />
              <p className={hintClass}>Leave blank to keep current email.</p>
            </div>
            <div>
              <label className={labelClass}>
                <FaLock className="text-zinc-400" size={12} /> New Password
              </label>
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (leave blank to keep current)"
              />
              <p className={hintClass}>Minimum 6 characters.</p>
            </div>
            <button type="submit" disabled={saving} className={saveButtonClass}>
              {saving ? spinner : <FaSave size={13} />}
              Save Changes
            </button>
          </form>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-zinc-900">
            <FaShieldAlt size={13} className="text-zinc-400" /> Account Security
          </h2>
          <p className="text-sm text-zinc-400">Manage your login credentials and account security.</p>
          <form onSubmit={updateProfile} className="space-y-4">
            <div>
              <label className={labelClass}>
                <FaEnvelope className="text-zinc-400" size={12} /> Change Email
              </label>
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="New email address"
              />
              <p className={hintClass}>A confirmation email will be sent.</p>
            </div>
            <div>
              <label className={labelClass}>
                <FaLock className="text-zinc-400" size={12} /> Change Password
              </label>
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
              />
              <p className={hintClass}>Minimum 6 characters.</p>
            </div>
            <button type="submit" disabled={saving} className={saveButtonClass}>
              {saving ? spinner : <FaSave size={13} />}
              Update Account
            </button>
          </form>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-zinc-900">
            <FaCog size={13} className="text-zinc-400" /> Preferences
          </h2>
          <p className="text-sm text-zinc-400">Customize your experience.</p>
          <form onSubmit={updateProfile} className="space-y-4">
            <div>
              <label className={labelClass}>
                <FaDollarSign className="text-zinc-400" size={12} /> Currency Symbol
              </label>
              <input
                type="text"
                maxLength={3}
                className={`${inputClass} w-24`}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="₱"
              />
              <p className={hintClass}>E.g., ₱, $, €</p>
            </div>
            <button type="submit" disabled={saving} className={saveButtonClass}>
              {saving ? spinner : <FaSave size={13} />}
              Save Preference
            </button>
          </form>
        </div>
      )}

      {/* Danger Zone Tab */}
      {activeTab === 'danger' && (
        <div className="bg-white rounded-2xl border border-rose-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-rose-600">
            <FaTrashAlt size={13} /> Danger Zone
          </h2>
          <p className="text-sm text-zinc-500">
            Once you delete your account, all data will be permanently removed. Please be certain.
          </p>
          <button
            onClick={deleteAccount}
            className="flex items-center gap-2 bg-rose-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors cursor-pointer"
          >
            <FaTrashAlt size={13} /> Delete My Account
          </button>
        </div>
      )}
    </div>
  );
}