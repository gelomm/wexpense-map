import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentLocation, extractShortAddress } from '../utils/geolocation';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash, FaMapMarkerAlt, FaTimes, FaSave } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';

function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const METRO_MANILA_BBOX = '120.9,14.3,121.2,14.8';

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    const data = await res.json();
    return {
      address: data.display_name || 'Unknown location',
      shortAddress: extractShortAddress(data.address || {}),
    };
  } catch {
    return { address: 'Unknown location', shortAddress: 'Unknown' };
  }
}

const TAG_OPTIONS = [
  { value: 'will_go_back', label: 'Will go back', color: '#10b981' },
  { value: 'good', label: 'Good', color: '#6366f1' },
  { value: 'one_time_only', label: 'One time only', color: '#a1a1aa' },
  { value: 'what_the_hell', label: 'What the hell?', color: '#f43f5e' },
];

export default function ExpenseForm({ onClose, expense = null, initialCoordinates = null }) {
  const isEdit = !!expense;
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(!isEdit);
  const [title, setTitle] = useState(expense?.title || '');
  const [caption, setCaption] = useState(expense?.caption || '');
  const [amount, setAmount] = useState(expense?.amount?.toString() || '');
  const [starRating, setStarRating] = useState(expense?.star_rating || 3);
  const [location, setLocation] = useState({
    lat: expense?.latitude || null,
    lng: expense?.longitude || null,
    address: expense?.location_name || '',
    shortAddress: expense?.short_location || '',
  });
  const [locationTag, setLocationTag] = useState(expense?.location_tag || 'good');
  const [members, setMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [splitAmounts, setSplitAmounts] = useState({});
  const [isLocating, setIsLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 600);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFullAddress, setShowFullAddress] = useState(false);
  const autoLocateAttempted = useRef(false);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  // Photo state
  const [newFiles, setNewFiles] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState(
    expense?.photos && expense.photos.length
      ? expense.photos
      : expense?.photo_url
      ? [expense.photo_url]
      : []
  );
  const maxPhotos = 3;

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showLightboxControls, setShowLightboxControls] = useState(false);
  const [showPrev, setShowPrev] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const allPhotos = [
    ...existingPhotos,
    ...newFiles.map((file) => URL.createObjectURL(file)),
  ];

  const { openOverlay, closeOverlay } = useUI();
  const { profile } = useAuth();
  const displayName = profile?.full_name || 'User';

  // Trigger overlay when this form is mounted
  useEffect(() => {
    openOverlay();
    return () => closeOverlay();
  }, [openOverlay, closeOverlay]);

  // Load members and splits on mount
  useEffect(() => {
    fetchMembers();
    if (isEdit && expense) {
      loadExistingSplits();
    }
  }, []);

  // Location initialisation
  useEffect(() => {
    if (!isEdit && initialCoordinates && !autoLocateAttempted.current) {
      autoLocateAttempted.current = true;
      setLocation({
        lat: initialCoordinates.lat,
        lng: initialCoordinates.lng,
        address: '',
        shortAddress: '',
      });
      reverseGeocode(initialCoordinates.lat, initialCoordinates.lng).then(
        ({ address, shortAddress }) => {
          setLocation((prev) => ({ ...prev, address, shortAddress }));
          setSearchQuery(address);
        }
      );
      return;
    }
    if (isEdit) return;
    if (!autoLocateAttempted.current && location.lat === null && location.lng === null) {
      autoLocateAttempted.current = true;
      handleAutoLocate();
    }
  }, [isEdit, initialCoordinates, location.lat, location.lng]);

  // Forward geocode search
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const fetchSuggestions = async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debouncedSearch)}&limit=5&addressdetails=1&countrycodes=PH&viewbox=${METRO_MANILA_BBOX}&bounded=1`
        );
        const data = await res.json();
        setSearchResults(data || []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Search error', err);
        setSearchResults([]);
        setShowDropdown(false);
      } finally {
        setSearching(false);
      }
    };
    fetchSuggestions();
  }, [debouncedSearch]);

  // Click outside dropdown
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

  const handleSelectSuggestion = (suggestion) => {
    const addr = suggestion.address || {};
    const short = extractShortAddress(addr);
    setLocation({
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
      address: suggestion.display_name,
      shortAddress: short || suggestion.display_name.split(',')[0],
    });
    setSearchQuery(suggestion.display_name);
    setShowDropdown(false);
  };

  const fetchMembers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('members').select('*').eq('user_id', user.id);
    setMembers(data || []);
  };

  const loadExistingSplits = async () => {
    const { data } = await supabase
      .from('expense_splits')
      .select('*')
      .eq('expense_id', expense.id);
    if (data && data.length > 0) {
      setSelectedMembers(data.map((s) => s.member_id));
      const splitsObj = {};
      data.forEach((s) => {
        splitsObj[s.member_id] = s.amount.toString();
      });
      setSplitAmounts(splitsObj);
    }
  };

  const toggleMember = (memberId) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleEqualSplit = () => {
    if (selectedMembers.length > 0 && amount) {
      const perPerson = (parseFloat(amount) / selectedMembers.length).toFixed(2);
      const newSplits = {};
      selectedMembers.forEach((id) => {
        newSplits[id] = perPerson;
      });
      setSplitAmounts(newSplits);
    }
  };

  const handleAutoLocate = async () => {
    try {
      setIsLocating(true);
      const loc = await getCurrentLocation();
      setLocation(loc);
      setSearchQuery(loc.address);
    } catch (err) {
      toast.error('Location access denied. You can search or enter manually.');
    } finally {
      setIsLocating(false);
    }
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    if (newFiles.length + existingPhotos.length + files.length > maxPhotos) {
      toast.error(`You can only upload up to ${maxPhotos} photos.`);
      return;
    }
    setNewFiles((prev) => [...prev, ...files]);
  };

  const removeNewPhoto = (index) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = (index) => {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async () => {
    if (newFiles.length === 0) return existingPhotos;
    const { data: { user } } = await supabase.auth.getUser();
    const uploadedUrls = [];
    for (const file of newFiles) {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('expense-photos')
        .upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from('expense-photos')
        .getPublicUrl(filePath);
      uploadedUrls.push(urlData.publicUrl);
    }
    return [...existingPhotos, ...uploadedUrls];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEditing) {
      setIsEditing(true);
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const allPhotoUrls = await uploadPhotos();

      const expenseData = {
        user_id: user.id,
        title,
        amount: parseFloat(amount),
        caption,
        photo_url: allPhotoUrls.length > 0 ? allPhotoUrls[0] : null,
        photos: allPhotoUrls,
        star_rating: starRating,
        latitude: location.lat,
        longitude: location.lng,
        location_name: location.address,
        short_location: location.shortAddress,
        location_tag: locationTag,
      };

      let savedExpense;
      if (isEdit) {
        const { data, error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', expense.id)
          .select()
          .single();
        if (error) throw error;
        savedExpense = data;
        await supabase.from('expense_splits').delete().eq('expense_id', expense.id);
      } else {
        const { data, error } = await supabase
          .from('expenses')
          .insert(expenseData)
          .select()
          .single();
        if (error) throw error;
        savedExpense = data;
      }

      if (selectedMembers.length > 0) {
        const splits = selectedMembers.map((memberId) => ({
          expense_id: savedExpense.id,
          member_id: memberId,
          amount: parseFloat(splitAmounts[memberId]) || 0,
        }));
        await supabase.from('expense_splits').insert(splits);
      }

      toast.success(isEdit ? 'Expense updated!' : 'Expense logged!');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this expense?')) return;
    try {
      await supabase.from('expenses').delete().eq('id', expense.id);
      toast.success('Expense deleted');
      onClose();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleViewOnMap = () => {
    if (expense?.latitude && expense?.longitude) {
      navigate(`/map?lat=${expense.latitude}&lng=${expense.longitude}`);
      onClose();
    }
  };

  const openLightbox = (index = 0) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
    setShowLightboxControls(false);
    setShowPrev(false);
    setShowNext(false);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const nextPhoto = () => setLightboxIndex((prev) => (prev + 1) % allPhotos.length);
  const prevPhoto = () =>
    setLightboxIndex((prev) => (prev - 1 + allPhotos.length) % allPhotos.length);

  const inputClass =
    'w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg bg-white text-zinc-900 placeholder-zinc-400 text-sm outline-none transition-colors focus:border-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500';

  const PAPER = '#FDFBF6';
  const zigzagStyle = {
    height: '10px',
    backgroundImage: `linear-gradient(-45deg, ${PAPER} 6px, transparent 0), linear-gradient(45deg, ${PAPER} 6px, transparent 0)`,
    backgroundSize: '12px 12px, 12px 12px',
    backgroundPosition: '0 0, 0 0',
    backgroundRepeat: 'repeat-x, repeat-x',
  };

  return (
    <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center z-[1050] p-4">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Torn top edge */}
        <div style={zigzagStyle} className="flex-shrink-0" />

        <div className="overflow-auto shadow-xl" style={{ backgroundColor: PAPER }}>
          {/* Modal Header */}
          <div className="px-6 pt-5 pb-3 sticky top-0 z-10" style={{ backgroundColor: PAPER }}>
            <div className="flex justify-between items-center">
              <h2 className="font-mono text-xs font-semibold text-zinc-900 uppercase tracking-[0.2em]">
                🧾 {isEdit ? 'Expense Receipt' : 'New Receipt'}
              </h2>
              <div className="flex gap-1">
                {isEdit && (
                  <>
                    <button onClick={handleViewOnMap} className="text-zinc-400 hover:text-zinc-700 hover:bg-zinc-900/5 p-2 rounded-lg transition-colors" title="View on map">
                      <FaMapMarkerAlt size={14} />
                    </button>
                    <button onClick={handleDelete} className="text-zinc-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors" title="Delete expense">
                      <FaTrash size={14} />
                    </button>
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="text-zinc-400 hover:text-zinc-700 hover:bg-zinc-900/5 p-2 rounded-lg transition-colors"
                      title={isEditing ? 'View mode' : 'Edit'}
                    >
                      {isEditing ? <FaTimes size={14} /> : <FaEdit size={14} />}
                    </button>
                  </>
                )}
                <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 hover:bg-zinc-900/5 p-2 rounded-lg transition-colors" title="Close">
                  <FaTimes size={14} />
                </button>
              </div>
            </div>
            <div className="border-t border-dashed border-zinc-300 mt-3" />
          </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Title</label>
              <input
                type="text"
                placeholder="What did you spend on?"
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={!isEditing}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wide">Amount</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                className={`${inputClass} font-mono text-base`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={!isEditing}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Notes</label>
              <textarea
                placeholder="Add a caption or notes"
                className={inputClass}
                rows={2}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={!isEditing}
              />
            </div>

            {/* Star Rating */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Rating</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => isEditing && setStarRating(star)}
                    className={`text-xl leading-none ${isEditing ? 'cursor-pointer' : 'cursor-default'} ${
                      star <= starRating ? 'text-amber-400' : 'text-zinc-200'
                    }`}
                    disabled={!isEditing}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Photos Section */}
            <div className="border-t border-dashed border-zinc-300 pt-4">
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Photos (max {maxPhotos})</label>

              {isEditing && (
                <div className="space-y-2">
                  {(existingPhotos.length > 0 || newFiles.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                      {existingPhotos.map((url, idx) => (
                        <div key={`existing-${idx}`} className="relative w-16 h-16 rounded-lg border border-zinc-200 overflow-hidden group">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeExistingPhoto(idx)}
                            className="absolute top-0.5 right-0.5 bg-zinc-900/80 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {newFiles.map((file, idx) => (
                        <div key={`new-${idx}`} className="relative w-16 h-16 rounded-lg border border-zinc-200 overflow-hidden group">
                          <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeNewPhoto(idx)}
                            className="absolute top-0.5 right-0.5 bg-zinc-900/80 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {existingPhotos.length + newFiles.length < maxPhotos && (
                    <label className="flex items-center justify-center w-full h-16 border border-dashed border-zinc-300 rounded-lg text-xs font-medium text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 cursor-pointer transition-colors">
                      + Add photo
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}

              {!isEditing && existingPhotos.length > 0 && (
                <div className="flex justify-center">
                  {existingPhotos.length === 1 ? (
                    <div
                      className="cursor-pointer w-28 h-28 rounded-xl border border-zinc-200 overflow-hidden hover:scale-[1.02] transition-transform"
                      onClick={() => openLightbox(0)}
                    >
                      <img src={existingPhotos[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="relative w-28 h-28 group">
                      {existingPhotos.slice(0, 3).map((url, idx) => (
                        <div
                          key={idx}
                          className="absolute top-0 left-0 w-full h-full rounded-xl border border-zinc-200 overflow-hidden cursor-pointer transition-all duration-300 ease-out"
                          style={{
                            transform: `rotate(${idx * 4 - 4}deg) translateX(${idx * 2}px)`,
                            zIndex: 3 - idx,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = `rotate(${idx * 6 - 6}deg) translateX(${idx * 8}px) scale(1.05)`;
                            e.currentTarget.style.zIndex = 5;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = `rotate(${idx * 4 - 4}deg) translateX(${idx * 2}px)`;
                            e.currentTarget.style.zIndex = 3 - idx;
                          }}
                          onClick={() => openLightbox(idx)}
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!isEditing && existingPhotos.length === 0 && (
                <p className="text-sm text-zinc-400">No photo</p>
              )}
            </div>

            {/* Location */}
            <div className="border-t border-dashed border-zinc-300 pt-4">
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Location</label>

              {!isEditing && (
                <div className="text-sm text-zinc-700 space-y-1">
                  <p>
                    <span className="font-medium text-zinc-900">{location.shortAddress || location.address || '—'}</span>
                  </p>
                  {!showFullAddress && (
                    <button
                      type="button"
                      onClick={() => setShowFullAddress(true)}
                      className="text-zinc-400 underline text-xs hover:text-zinc-700"
                    >
                      Show full address
                    </button>
                  )}
                  {showFullAddress && (
                    <p className="text-zinc-400 text-xs">{location.address || 'No full address provided'}</p>
                  )}
                </div>
              )}

              {isEditing && (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 relative" ref={searchRef}>
                      <input
                        type="text"
                        placeholder="Search address..."
                        className={inputClass}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                      />
                      {searching && (
                        <span className="absolute right-3 top-2.5 text-xs text-zinc-400">Searching…</span>
                      )}
                      {showDropdown && searchResults.length > 0 && (
                        <div
                          ref={dropdownRef}
                          className="absolute z-10 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                        >
                          {searchResults.map((result) => (
                            <button
                              key={result.place_id}
                              type="button"
                              className="block w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 border-b border-zinc-100 last:border-b-0"
                              onClick={() => handleSelectSuggestion(result)}
                            >
                              <div className="font-medium truncate text-zinc-900">
                                {result.address?.road || result.address?.building || result.display_name.split(',')[0]}
                              </div>
                              <div className="text-xs text-zinc-400 truncate">{result.display_name}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoLocate}
                      disabled={isLocating}
                      className="bg-zinc-100 text-zinc-700 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap hover:bg-zinc-200 transition-colors"
                    >
                      {isLocating ? 'Locating…' : '📍 Me'}
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Full address"
                    className={inputClass}
                    value={location.address}
                    onChange={(e) => setLocation({ ...location, address: e.target.value })}
                  />
                </>
              )}
            </div>

            {/* Location Tag */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Tag</label>
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map((tag) => (
                  <button
                    type="button"
                    key={tag.value}
                    onClick={() => isEditing && setLocationTag(tag.value)}
                    disabled={!isEditing}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      locationTag === tag.value
                        ? 'border-transparent text-white'
                        : 'border-zinc-200 text-zinc-500 bg-white hover:border-zinc-300'
                    } ${!isEditing ? 'cursor-default' : 'cursor-pointer'}`}
                    style={locationTag === tag.value ? { backgroundColor: tag.color } : {}}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-dashed border-zinc-300 pt-4 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-900/5 transition-colors"
            >
              Cancel
            </button>
            {isEdit && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors flex items-center gap-2"
              >
                <FaEdit size={12} /> Edit
              </button>
            )}
            {(isEditing || !isEdit) && (
              <button
                type="submit"
                disabled={saving}
                className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                ) : (
                  <FaSave size={12} />
                )}
                {isEdit ? 'Save changes' : 'Log expense'}
              </button>
            )}
          </div>

          <p className="font-mono text-[10px] text-zinc-400 text-center tracking-widest mt-5">
            ··· LOGGED IN GASTOS ···
          </p>
        </form>
        </div>

        {/* Torn bottom edge */}
        <div style={zigzagStyle} className="flex-shrink-0 rotate-180" />
      </div>

      {/* Lightbox for expense form photos */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center z-[2000]"
          onClick={closeLightbox}
          onMouseMove={() => setShowLightboxControls(true)}
          onMouseLeave={() => setShowLightboxControls(false)}
        >
          <div
            className={`absolute top-6 right-6 z-10 transition-opacity duration-300 ${
              showLightboxControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <button
              onClick={closeLightbox}
              className="text-white/70 hover:text-white p-2 transition-colors"
            >
              <FaTimes size={20} />
            </button>
          </div>

          <div
            className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{ width: 'min(70vw, 70vh)', aspectRatio: '1/1' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 p-4">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-100 flex-shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs font-semibold">
                    {displayName?.charAt(0) || 'U'}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-zinc-900 truncate">
                  {profile?.full_name || 'User'}
                </p>
                <p className="text-xs text-zinc-400 truncate">
                  {expense?.short_location || expense?.location_name || 'Somewhere'}
                </p>
              </div>
            </div>

            <div className="flex-1 bg-zinc-100">
              <img
                src={allPhotos[lightboxIndex]}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-4 text-left">
              <div className="flex items-center gap-1.5 text-amber-400 text-sm">
                <span>★</span>
                <span className="text-zinc-700 font-medium">{expense?.star_rating || 0}</span>
              </div>
              <p className="text-sm text-zinc-600 mt-1 line-clamp-2">
                {expense?.caption || 'No caption yet.'}
              </p>
            </div>
          </div>

          {allPhotos.length > 1 && (
            <>
              <div
                className="absolute left-0 top-0 bottom-0 w-24 flex items-center justify-start pl-4 cursor-pointer"
                onMouseEnter={() => setShowPrev(true)}
                onMouseLeave={() => setShowPrev(false)}
              >
                <div className={`transition-opacity duration-300 ${showPrev ? 'opacity-100' : 'opacity-0'}`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                    className="text-white/70 hover:text-white p-2 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </div>
              </div>
              <div
                className="absolute right-0 top-0 bottom-0 w-24 flex items-center justify-end pr-4 cursor-pointer"
                onMouseEnter={() => setShowNext(true)}
                onMouseLeave={() => setShowNext(false)}
              >
                <div className={`transition-opacity duration-300 ${showNext ? 'opacity-100' : 'opacity-0'}`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                    className="text-white/70 hover:text-white p-2 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}