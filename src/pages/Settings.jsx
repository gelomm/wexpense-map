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

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-4">
      {/* Page header with receipt personality */}
      <div>
        <h1 className="text-3xl font-bold text-amber-900 flex items-center gap-2">
          <FaFileInvoiceDollar className="text-amber-600" />
          Settings
        </h1>
        <p className="text-amber-600 text-sm mt-1">Tweak your preferences, keep your receipt book in order.</p>
      </div>

      {/* Tab Navigation – now amber themed */}
      <div className="flex border-b border-amber-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-amber-500 hover:text-amber-700'
            }`}
          >
            <tab.icon className="text-base" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-amber-50/70 backdrop-blur-sm rounded-xl border border-dashed border-amber-300 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-amber-600">
            <FaUser /> Profile
          </h2>
          <form onSubmit={updateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-amber-800 mb-1">Full Name</label>
              <input
                type="text"
                className="w-full p-2 border border-amber-300 rounded-lg bg-white/80 text-amber-900 focus:ring-2 focus:ring-amber-500"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-amber-800 mb-1 flex items-center gap-1">
                <FaEnvelope className="text-amber-500" /> Email
              </label>
              <input
                type="email"
                className="w-full p-2 border border-amber-300 rounded-lg bg-white/80 text-amber-900 focus:ring-2 focus:ring-amber-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="New email (leave blank to keep current)"
              />
              <p className="text-xs text-amber-600 mt-1">Leave blank to keep current email.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-amber-800 mb-1 flex items-center gap-1">
                <FaLock className="text-amber-500" /> New Password
              </label>
              <input
                type="password"
                className="w-full p-2 border border-amber-300 rounded-lg bg-white/80 text-amber-900 focus:ring-2 focus:ring-amber-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (leave blank to keep current)"
              />
              <p className="text-xs text-amber-600 mt-1">Minimum 6 characters.</p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-amber-600 text-white px-5 py-2.5 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 cursor-pointer shadow"
            >
              {saving ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              ) : (
                <FaSave />
              )}
              Save Changes
            </button>
          </form>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="bg-amber-50/70 backdrop-blur-sm rounded-xl border border-dashed border-amber-300 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-amber-600">
            <FaShieldAlt /> Account Security
          </h2>
          <p className="text-sm text-amber-700">Manage your login credentials and account security.</p>
          <form onSubmit={updateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-amber-800 mb-1 flex items-center gap-1">
                <FaEnvelope className="text-amber-500" /> Change Email
              </label>
              <input
                type="email"
                className="w-full p-2 border border-amber-300 rounded-lg bg-white/80 text-amber-900 focus:ring-2 focus:ring-amber-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="New email address"
              />
              <p className="text-xs text-amber-600 mt-1">A confirmation email will be sent.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-amber-800 mb-1 flex items-center gap-1">
                <FaLock className="text-amber-500" /> Change Password
              </label>
              <input
                type="password"
                className="w-full p-2 border border-amber-300 rounded-lg bg-white/80 text-amber-900 focus:ring-2 focus:ring-amber-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
              />
              <p className="text-xs text-amber-600 mt-1">Minimum 6 characters.</p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-amber-600 text-white px-5 py-2.5 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 cursor-pointer shadow"
            >
              {saving ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              ) : (
                <FaSave />
              )}
              Update Account
            </button>
          </form>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <div className="bg-amber-50/70 backdrop-blur-sm rounded-xl border border-dashed border-amber-300 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-amber-600">
            <FaCog /> Preferences
          </h2>
          <p className="text-sm text-amber-700">Customize your experience.</p>
          <form onSubmit={updateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-amber-800 mb-1 flex items-center gap-1">
                <FaDollarSign className="text-amber-500" /> Currency Symbol
              </label>
              <input
                type="text"
                maxLength={3}
                className="w-24 p-2 border border-amber-300 rounded-lg bg-white/80 text-amber-900 focus:ring-2 focus:ring-amber-500"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="₱"
              />
              <p className="text-xs text-amber-600 mt-1">E.g., ₱, $, €</p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-amber-600 text-white px-5 py-2.5 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 cursor-pointer shadow"
            >
              {saving ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              ) : (
                <FaSave />
              )}
              Save Preference
            </button>
          </form>
        </div>
      )}

      {/* Danger Zone Tab */}
      {activeTab === 'danger' && (
        <div className="bg-amber-50/70 backdrop-blur-sm rounded-xl border border-dashed border-red-300 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-red-600">
            <FaTrashAlt /> Danger Zone
          </h2>
          <p className="text-sm text-amber-800">
            Once you delete your account, all data will be permanently removed. Please be certain.
          </p>
          <button
            onClick={deleteAccount}
            className="flex items-center gap-2 bg-red-500 text-white px-5 py-2.5 rounded-lg hover:bg-red-600 transition cursor-pointer shadow"
          >
            <FaTrashAlt /> Delete My Account
          </button>
        </div>
      )}
    </div>
  );
}