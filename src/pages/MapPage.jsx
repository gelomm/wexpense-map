import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { useGroupExpenses } from '../hooks/useGroupExpenses';
import L from 'leaflet';
import 'leaflet.markercluster';
import toast from 'react-hot-toast';
import ExpenseForm from '../components/ExpenseForm';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const tagColors = {
  will_go_back: '#22c55e',
  good: '#f59e0b',
  one_time_only: '#6b7280',
  what_the_hell: '#ef4444',
};

const tagLabels = {
  will_go_back: 'Will go back',
  one_time_only: 'One time only',
  good: 'Good',
  what_the_hell: 'What the hell?',
};

const TAG_DOT_COLOR = {
  will_go_back: '#10b981',
  good: '#6366f1',
  one_time_only: '#a1a1aa',
  what_the_hell: '#f43f5e',
};

const createExpenseIcon = (photoUrl, tag, pulse = false) => {
  if (photoUrl) {
    const html = `
      <div style="width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid white;box-shadow:0 0 5px rgba(0,0,0,0.3);${pulse ? 'animation:pulse 1s infinite;' : ''}">
        <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;" />
      </div>`;
    return L.divIcon({
      className: 'custom-marker',
      html,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
    });
  }
  const color = tagColors[tag] || '#f59e0b';
  const html = `
    <div style="width:30px;height:30px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 0 5px rgba(0,0,0,0.3);${pulse ? 'animation:pulse 1s infinite;' : ''}">
    </div>`;
  return L.divIcon({
    className: 'colored-pin',
    html,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

function MapEventHandler({ onRightClick, onTap }) {
  useMapEvents({
    contextmenu: (e) => onRightClick(e.latlng),
    // Long-press for mobile: handled by touch events on the container
  });
  return null;
}

function MapController({ center, zoom, flyToLocation }) {
  const map = useMap();
  useEffect(() => { if (flyToLocation) map.flyTo(flyToLocation, 16); }, [flyToLocation, map]);
  useEffect(() => { map.setView(center, zoom); }, [center, zoom, map]);
  return null;
}

function MarkerClusterLayer({ expenses, onDragEnd, cleanMode, currency, tagLabels }) {
  const map = useMap();
  const clusterGroupRef = useRef(null);

  useEffect(() => {
    const mapExp = {};
    expenses.forEach(exp => { mapExp[exp.id] = exp; });
    window.__lightboxExpenses = mapExp;
    return () => { delete window.__lightboxExpenses; };
  }, [expenses]);

  const buildPhotosHtml = (photos, photo_url, expId) => {
    const allPhotos = photos && photos.length ? photos : photo_url ? [photo_url] : [];
    if (allPhotos.length === 0) return '';

    if (allPhotos.length === 1) {
      return `
        <div style="width:100%;height:120px;border-radius:8px;overflow:hidden;background:#f4f4f5;margin-bottom:10px;cursor:pointer;" onclick="window.__openLightbox(0,'${allPhotos[0]}','${expId}')">
          <img src="${allPhotos[0]}" style="width:100%;height:100%;object-fit:cover;" />
        </div>`;
    }

    let stackHtml = '<div style="position:relative;width:100%;height:120px;margin-bottom:10px;">';
    allPhotos.slice(0, 3).forEach((url, idx) => {
      const rotation = idx * 4 - 4;
      const translateX = idx * 2;
      stackHtml += `
        <div class="photo-stack-item"
             style="position:absolute;top:0;left:0;width:100%;height:100%;border-radius:8px;overflow:hidden;border:2px solid #fff;background:#f4f4f5;
                    transform:rotate(${rotation}deg) translateX(${translateX}px);
                    transition:transform 0.25s ease;cursor:pointer;z-index:${3 - idx};"
             onclick="event.stopPropagation();window.__openLightbox(${idx},'${url}','${expId}')">
          <img src="${url}" style="width:100%;height:100%;object-fit:cover;" />
        </div>`;
    });
    stackHtml += '</div>';
    return stackHtml;
  };

  useEffect(() => {
    if (clusterGroupRef.current) map.removeLayer(clusterGroupRef.current);
    const clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false,
    });
    clusterGroupRef.current = clusterGroup;

    expenses.forEach(exp => {
      if (!exp.latitude || !exp.longitude) return;
      const marker = L.marker([exp.latitude, exp.longitude], {
        icon: createExpenseIcon(exp.photo_url, exp.location_tag, cleanMode),
        draggable: !cleanMode,
        expense: exp,
      });
      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        onDragEnd(exp, newPos.lat, newPos.lng);
      });

      const photosHtml = buildPhotosHtml(exp.photos, exp.photo_url, exp.id);
      const shareUrl = `${window.location.origin}/map?lat=${exp.latitude}&lng=${exp.longitude}`;
      const tagDot = TAG_DOT_COLOR[exp.location_tag] || '#a1a1aa';
      const tagLabel = tagLabels[exp.location_tag] || exp.location_tag;
      const stars = '★'.repeat(exp.star_rating) + '<span style="color:#d4d4d8">' + '★'.repeat(5 - exp.star_rating) + '</span>';
      const dateStr = new Date(exp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const zigzagTop = `
        <svg width="100%" height="8" viewBox="0 0 220 8" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
          <polyline points="0,8 10,0 20,8 30,0 40,8 50,0 60,8 70,0 80,8 90,0 100,8 110,0 120,8 130,0 140,8 150,0 160,8 170,0 180,8 190,0 200,8 210,0 220,8" fill="none" stroke="#FDFBF6" stroke-width="8"/>
        </svg>`;
      const zigzagBot = `
        <svg width="100%" height="8" viewBox="0 0 220 8" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="display:block;transform:rotate(180deg);">
          <polyline points="0,8 10,0 20,8 30,0 40,8 50,0 60,8 70,0 80,8 90,0 100,8 110,0 120,8 130,0 140,8 150,0 160,8 170,0 180,8 190,0 200,8 210,0 220,8" fill="none" stroke="#FDFBF6" stroke-width="8"/>
        </svg>`;

      const popupContent = `
        <div style="width:230px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          ${zigzagTop}
          <div style="background:#FDFBF6;padding:14px 14px 0;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;margin-bottom:10px;border-bottom:1px dashed #d4d4d8;">
              <span style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#71717a;">🧾 Receipt</span>
              <span style="font-size:10px;color:#a1a1aa;">${dateStr}</span>
            </div>
            ${photosHtml}
            <h4 style="font-size:14px;font-weight:600;color:#18181b;margin:0 0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${exp.title || exp.caption || 'Expense'}</h4>
            <p style="font-size:11px;color:#a1a1aa;margin:0 0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${exp.short_location || exp.location_name || ''}</p>
            <div style="font-size:26px;font-weight:700;color:#18181b;text-align:center;margin:8px 0;letter-spacing:-0.5px;">${currency}${exp.amount}</div>
            <div style="border-top:1px dashed #d4d4d8;padding-top:10px;margin-top:10px;display:flex;flex-direction:column;gap:5px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:11px;color:#a1a1aa;">Rating</span>
                <span style="font-size:12px;color:#f59e0b;">${stars}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:11px;color:#a1a1aa;">Tag</span>
                <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:500;color:#3f3f46;">
                  <span style="width:6px;height:6px;border-radius:50%;background:${tagDot};display:inline-block;"></span>${tagLabel}
                </span>
              </div>
            </div>
            <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #d4d4d8;display:flex;justify-content:flex-end;">
              <button onclick="event.stopPropagation();navigator.clipboard.writeText('${shareUrl}');this.textContent='Copied!';setTimeout(()=>{this.textContent='Share link'},1400);"
                style="background:#18181b;color:#fff;border:none;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:500;font-family:inherit;">
                Share link
              </button>
            </div>
            <p style="font-family:'Courier New',monospace;font-size:9px;color:#d4d4d8;text-align:center;letter-spacing:0.18em;padding:10px 0 4px;">· · · LOGGED IN GASTOS · · ·</p>
          </div>
          ${zigzagBot}
        </div>`;

      marker.bindPopup(popupContent, { maxWidth: 250, className: 'gastos-receipt-popup' });
      clusterGroup.addLayer(marker);
    });

    clusterGroup.on('clusterclick', (e) => {
      const cluster = e.layer;
      const markers = cluster.getAllChildMarkers();
      const clusterExpenses = markers.map(m => m.options.expense).filter(Boolean);
      if (clusterExpenses.length === 0) return;
      const totalAmount = clusterExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const count = clusterExpenses.length;

      const summaryHtml = `
        <div style="width:200px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FDFBF6;padding:14px;border-radius:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;margin-bottom:10px;border-bottom:1px dashed #d4d4d8;">
            <span style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#71717a;">📋 Area summary</span>
          </div>
          <div style="text-align:center;margin:4px 0 8px;">
            <div style="font-size:28px;font-weight:700;color:#18181b;letter-spacing:-0.5px;">${currency}${totalAmount.toFixed(2)}</div>
            <div style="font-size:11px;color:#a1a1aa;margin-top:2px;">${count} expense${count !== 1 ? 's' : ''} in this area</div>
          </div>
          <p style="font-size:10px;color:#d4d4d8;text-align:center;border-top:1px dashed #d4d4d8;padding-top:8px;margin:0;">Zoom in to see each expense</p>
        </div>`;

      L.popup({ maxWidth: 220, className: 'gastos-cluster-popup' })
        .setLatLng(cluster.getLatLng())
        .setContent(summaryHtml)
        .openOn(map);
    });

    map.addLayer(clusterGroup);
    return () => { if (clusterGroupRef.current) map.removeLayer(clusterGroupRef.current); };
  }, [expenses, map, onDragEnd, cleanMode, tagLabels]);

  return null;
}

// --- Long-press handler component for adding expenses on mobile ---
function LongPressHandler({ onLongPress }) {
  const timerRef = useRef(null);
  const startLatLngRef = useRef(null);

  useMapEvents({
    touchstart: (e) => {
      if (e.originalEvent.touches.length !== 1) return;
      startLatLngRef.current = e.latlng;
      timerRef.current = setTimeout(() => {
        if (startLatLngRef.current) onLongPress(startLatLngRef.current);
      }, 600);
    },
    touchmove: () => {
      clearTimeout(timerRef.current);
      startLatLngRef.current = null;
    },
    touchend: () => {
      clearTimeout(timerRef.current);
      startLatLngRef.current = null;
    },
  });
  return null;
}

export default function MapPage() {
  const { profile } = useAuth();
  const displayName = profile?.full_name || 'User';
  const currency = profile?.currency || '₱';

  const expenses = useGroupExpenses();

  const [searchParams] = useSearchParams();
  const [center, setCenter] = useState([14.5995, 120.9842]);
  const [zoom, setZoom] = useState(12);
  const [loaded, setLoaded] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false); // default closed on mobile
  const [activeFilter, setActiveFilter] = useState('recent');
  const [tempMarker, setTempMarker] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [cleanMode, setCleanMode] = useState(false);
  const [miniDashboardOpen, setMiniDashboardOpen] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxExpense, setLightboxExpense] = useState(null);
  const [lightboxCreator, setLightboxCreator] = useState(null);

  // Swipe tracking for lightbox
  const touchStartX = useRef(null);

  const [autoFlyEnabled, setAutoFlyEnabled] = useState(false);

  // Detect mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const { openOverlay, closeOverlay, triggerRefresh } = useUI();
  const lightboxHandlerRef = useRef(null);

  const handleLightboxOpen = useCallback((index, url, expenseId) => {
    const exp = window.__lightboxExpenses?.[expenseId];
    if (!exp) return;
    supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', exp.user_id)
      .single()
      .then(({ data }) => { setLightboxCreator(data); });
    const photos = exp.photos?.length ? exp.photos : exp.photo_url ? [exp.photo_url] : [];
    setLightboxImages(photos);
    setLightboxIndex(index);
    setLightboxOpen(true);
    setLightboxExpense(exp);
    openOverlay();
  }, [openOverlay]);

  useEffect(() => { lightboxHandlerRef.current = handleLightboxOpen; }, [handleLightboxOpen]);

  useEffect(() => {
    window.__openLightbox = (index, url, expenseId) => {
      if (lightboxHandlerRef.current) lightboxHandlerRef.current(index, url, expenseId);
    };
    return () => { delete window.__openLightbox; };
  }, []);

  const closeLightbox = () => {
    setLightboxOpen(false);
    setLightboxExpense(null);
    setLightboxCreator(null);
    closeOverlay();
  };

  useEffect(() => {
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    if (latParam && lngParam) {
      setCenter([parseFloat(latParam), parseFloat(lngParam)]);
      setZoom(16);
      setLoaded(true);
      setAutoFlyEnabled(false);
    } else {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => { setCenter([pos.coords.latitude, pos.coords.longitude]); setLoaded(true); },
          () => { setLoaded(true); }
        );
      } else {
        setLoaded(true);
      }
      setAutoFlyEnabled(false);
    }
  }, [searchParams]);

  const filteredExpenses = useMemo(() => {
    let result = [...expenses];
    if (dateStart) result = result.filter(e => e.created_at >= dateStart);
    if (dateEnd) result = result.filter(e => e.created_at <= dateEnd + 'T23:59:59');
    if (cleanMode) {
      const highlyRated = result.filter(e => e.star_rating >= 4).sort((a, b) => b.star_rating - a.star_rating || b.amount - a.amount).slice(0, 5);
      const sortedSpending = result.sort((a, b) => b.amount - a.amount).slice(0, 5);
      return [...new Map([...highlyRated, ...sortedSpending].map(item => [item.id, item])).values()];
    }
    switch (activeFilter) {
      case 'recent': return result;
      case 'topRated': return result.filter(e => e.star_rating >= 4).sort((a, b) => b.star_rating - a.star_rating || b.amount - a.amount).slice(0, 5);
      case 'topSpending': return result.sort((a, b) => b.amount - a.amount).slice(0, 5);
      default: return result;
    }
  }, [expenses, dateStart, dateEnd, cleanMode, activeFilter]);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const thisMonth = expenses.filter(e => {
      const d = new Date(e.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const total = thisMonth.reduce((sum, e) => sum + e.amount, 0);
    const avgRating = thisMonth.length ? thisMonth.reduce((sum, e) => sum + e.star_rating, 0) / thisMonth.length : 0;
    return { total, count: thisMonth.length, avgRating: avgRating.toFixed(1) };
  }, [expenses]);

  const flyToLocation = useMemo(() => {
    if (!autoFlyEnabled) return null;
    if (filteredExpenses.length > 0 && filteredExpenses[0].latitude && filteredExpenses[0].longitude) {
      return [filteredExpenses[0].latitude, filteredExpenses[0].longitude];
    }
    return null;
  }, [filteredExpenses, autoFlyEnabled]);

  const panelFlyTo = selectedLocation || flyToLocation;

  const handleMarkerDragEnd = useCallback(async (expense, newLat, newLng) => {
    const { error } = await supabase.from('expenses').update({ latitude: newLat, longitude: newLng }).eq('id', expense.id);
    if (error) toast.error('Failed to update location');
    else toast.success('Location updated');
  }, []);

  const handleRightClick = (latlng) => setTempMarker({ lat: latlng.lat, lng: latlng.lng });
  const handleLongPress = (latlng) => setTempMarker({ lat: latlng.lat, lng: latlng.lng });
  const handleTempMarkerClick = () => { setEditExpense(null); setShowForm(true); };
  const handleFormClose = () => { setShowForm(false); setEditExpense(null); setTempMarker(null); triggerRefresh(); };
  const handlePanelClick = (exp) => {
    if (exp.latitude && exp.longitude) {
      setAutoFlyEnabled(true);
      setSelectedLocation([exp.latitude, exp.longitude]);
      // On mobile, close the panel after flying so the map is visible
      if (window.innerWidth < 768) setPanelOpen(false);
    }
  };
  const changeFilter = (filter) => { setAutoFlyEnabled(true); setActiveFilter(filter); };
  const toggleCleanMode = () => { setAutoFlyEnabled(true); setCleanMode(prev => !prev); };
  const changeDateRange = (type, value) => { setAutoFlyEnabled(true); if (type === 'start') setDateStart(value); else setDateEnd(value); };

  const nextPhoto = () => setLightboxIndex((prev) => (prev + 1) % lightboxImages.length);
  const prevPhoto = () => setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length);

  const handleLightboxTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleLightboxTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) { dx < 0 ? nextPhoto() : prevPhoto(); }
    touchStartX.current = null;
  };

  const filterLabels = { recent: 'Recent', topRated: 'Top rated', topSpending: 'Top spending' };

  if (!loaded) return (
    <div className="h-screen flex items-center justify-center bg-zinc-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-800 rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Loading map…</p>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Popup styles injected globally ── */}
      <style>{`
        .gastos-receipt-popup .leaflet-popup-content-wrapper,
        .gastos-cluster-popup .leaflet-popup-content-wrapper {
          padding: 0 !important;
          border-radius: 10px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.16), 0 1px 4px rgba(0,0,0,0.08) !important;
          overflow: hidden;
          background: #FDFBF6 !important;
          border: 0.5px solid rgba(0,0,0,0.08);
        }
        .gastos-receipt-popup .leaflet-popup-content,
        .gastos-cluster-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .gastos-receipt-popup .leaflet-popup-tip-container,
        .gastos-cluster-popup .leaflet-popup-tip-container {
          display: none;
        }
      `}</style>

      {/* ── Map: full viewport, offset by sidebar on desktop only ── */}
      <div className="map-container-outer">
        <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
          <MapController center={center} zoom={zoom} flyToLocation={panelFlyTo} />
          <MapEventHandler onRightClick={handleRightClick} />
          <LongPressHandler onLongPress={handleLongPress} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MarkerClusterLayer
            expenses={filteredExpenses}
            onDragEnd={handleMarkerDragEnd}
            cleanMode={cleanMode}
            currency={currency}
            tagLabels={tagLabels}
          />
          {tempMarker && (
            <Marker
              position={[tempMarker.lat, tempMarker.lng]}
              icon={createExpenseIcon(null, 'good')}
              eventHandlers={{ click: handleTempMarkerClick }}
              title="Click to add a new expense here"
            />
          )}
        </MapContainer>
      </div>

      {/* ── Floating UI layer ── */}
      <div className="map-ui-layer">

        {/* ── Mini Dashboard — upper left ── */}
        <div className="absolute top-3 left-3 z-[1001] pointer-events-auto">
          <button
            onClick={() => setMiniDashboardOpen(!miniDashboardOpen)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all shadow-sm border ${
              miniDashboardOpen
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white/90 backdrop-blur-sm text-zinc-700 border-zinc-200/80 hover:border-zinc-300 hover:bg-white'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Stats
            <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 transition-transform ${miniDashboardOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          {miniDashboardOpen && (
            <div className="mt-2 w-56 bg-white/95 backdrop-blur-sm rounded-xl border border-zinc-200/80 shadow-lg overflow-hidden">
              <div className="px-4 pt-3.5 pb-2">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">This month</p>
              </div>
              <div className="px-4 pb-3 border-b border-zinc-100">
                <p className="text-2xl font-semibold text-zinc-900 tabular-nums tracking-tight">
                  {currency}{monthlyStats.total.toFixed(2)}
                </p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-zinc-100">
                <div className="px-4 py-3">
                  <p className="text-[10px] text-zinc-400 mb-0.5">Expenses</p>
                  <p className="text-sm font-semibold text-zinc-900">{monthlyStats.count}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] text-zinc-400 mb-0.5">Avg rating</p>
                  <p className="text-sm font-semibold text-zinc-900">
                    <span className="text-amber-400">★</span> {monthlyStats.avgRating}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Mobile toolbar: top-right action pills ── */}
        <div className="md:hidden absolute top-3 right-3 z-[1001] pointer-events-auto flex gap-2">
          {/* Date filter toggle */}
          <button
            onClick={() => setShowDateFilter(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium shadow-sm border transition-all ${
              showDateFilter || dateStart || dateEnd
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white/90 backdrop-blur-sm text-zinc-700 border-zinc-200/80'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            {(dateStart || dateEnd) ? 'Filtered' : 'Date'}
          </button>
          {/* List toggle */}
          <button
            onClick={() => setPanelOpen(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium shadow-sm border transition-all ${
              panelOpen
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white/90 backdrop-blur-sm text-zinc-700 border-zinc-200/80'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
            List
          </button>
        </div>

        {/* ── Mobile date filter panel (slides down from top-right) ── */}
        {showDateFilter && (
          <div className="md:hidden absolute top-14 right-3 z-[1001] pointer-events-auto">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-zinc-200/80 shadow-lg p-3 w-64">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">Date range</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 w-8">From</span>
                  <input
                    type="date"
                    value={dateStart}
                    onChange={e => changeDateRange('start', e.target.value)}
                    className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-700 outline-none px-2 py-1.5"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 w-8">To</span>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={e => changeDateRange('end', e.target.value)}
                    className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-700 outline-none px-2 py-1.5"
                  />
                </div>
                {(dateStart || dateEnd) && (
                  <button
                    onClick={() => { setDateStart(''); setDateEnd(''); }}
                    className="w-full text-xs text-zinc-500 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Desktop date filter — bottom center ── */}
        <div className="hidden md:flex absolute bottom-6 left-1/2 -translate-x-1/2 z-[1001] pointer-events-auto">
          <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-xl border border-zinc-200/80 shadow-lg px-4 py-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            <input
              type="date"
              value={dateStart}
              onChange={e => changeDateRange('start', e.target.value)}
              className="bg-transparent border-none text-xs text-zinc-700 outline-none cursor-pointer w-28"
            />
            <span className="text-zinc-300 text-xs select-none">→</span>
            <input
              type="date"
              value={dateEnd}
              onChange={e => changeDateRange('end', e.target.value)}
              className="bg-transparent border-none text-xs text-zinc-700 outline-none cursor-pointer w-28"
            />
            {(dateStart || dateEnd) && (
              <button
                onClick={() => { setDateStart(''); setDateEnd(''); }}
                className="text-zinc-400 hover:text-zinc-600 transition-colors ml-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Expense list panel ── */}
        {panelOpen ? (
          <>
            {/* Desktop panel — right side */}
            <div className="hidden md:flex absolute top-0 right-0 bottom-0 z-[1001] flex-col pointer-events-auto" style={{ width: '304px' }}>
              <div className="m-3 mb-0 bg-white/95 backdrop-blur-sm rounded-t-xl border border-zinc-200/80 border-b-0 px-4 pt-4 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-zinc-900">Expenses</h2>
                  <button
                    onClick={() => setPanelOpen(false)}
                    className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md hover:bg-zinc-100 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                <div className="flex gap-1 bg-zinc-100 rounded-lg p-0.5">
                  {['recent', 'topRated', 'topSpending'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => changeFilter(filter)}
                      className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                        activeFilter === filter
                          ? 'bg-white text-zinc-900 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-700'
                      }`}
                    >
                      {filter === 'recent' ? 'Recent' : filter === 'topRated' ? '⭐ Top' : '💰 Most'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={toggleCleanMode}
                  className={`mt-2 w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                    cleanMode
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                    </svg>
                    Clean view
                  </span>
                  <span className={`w-7 h-4 rounded-full transition-all relative ${cleanMode ? 'bg-emerald-500' : 'bg-zinc-300'}`}>
                    <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${cleanMode ? 'left-3.5' : 'left-0.5'}`} />
                  </span>
                </button>
              </div>
              <div className="mx-3 flex-1 overflow-y-auto bg-white/95 backdrop-blur-sm border border-zinc-200/80 border-t-0 rounded-b-xl">
                <ExpenseListContent
                  filteredExpenses={filteredExpenses}
                  currency={currency}
                  onItemClick={handlePanelClick}
                />
              </div>
            </div>

            {/* Mobile panel — bottom sheet */}
            <MobileBottomSheet
              onClose={() => setPanelOpen(false)}
              activeFilter={activeFilter}
              changeFilter={changeFilter}
              cleanMode={cleanMode}
              toggleCleanMode={toggleCleanMode}
              filteredExpenses={filteredExpenses}
              currency={currency}
              onItemClick={handlePanelClick}
            />
          </>
        ) : (
          /* Desktop: show list toggle button when panel is closed */
          <button
            onClick={() => setPanelOpen(true)}
            className="hidden md:flex absolute top-4 right-4 z-[1002] bg-white/90 backdrop-blur-sm border border-zinc-200/80 shadow-sm rounded-lg p-2.5 pointer-events-auto hover:bg-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        )}
      </div>

      {showForm && (
        <ExpenseForm
          onClose={handleFormClose}
          expense={editExpense}
          initialCoordinates={tempMarker ? { lat: tempMarker.lat, lng: tempMarker.lng } : undefined}
        />
      )}

      {/* ── Lightbox ── */}
      {lightboxOpen && lightboxExpense && (
        <div
          className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center z-[2000] md:pl-6"
          onClick={closeLightbox}
          onTouchStart={handleLightboxTouchStart}
          onTouchEnd={handleLightboxTouchEnd}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 text-white/70 hover:text-white p-3 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>

          <div
            className="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden mx-4"
            style={{ width: 'min(85vw, 80vh)', maxWidth: '420px', aspectRatio: '1/1' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 p-3">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-100 flex-shrink-0">
                {lightboxCreator?.avatar_url ? (
                  <img src={lightboxCreator.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs font-semibold">
                    {(lightboxCreator?.full_name || 'U').charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-zinc-900 truncate">{lightboxCreator?.full_name || 'Someone'}</p>
                <p className="text-xs text-zinc-400 truncate">{lightboxExpense.short_location || lightboxExpense.location_name || 'Somewhere'}</p>
              </div>
            </div>
            <div className="flex-1 bg-zinc-100 relative">
              <img src={lightboxImages[lightboxIndex]} alt="" className="w-full h-full object-cover" />
              {/* Touch-friendly prev/next tap zones on desktop */}
              {lightboxImages.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                    className="hidden md:flex absolute left-0 top-0 bottom-0 w-12 items-center justify-center text-white/70 hover:text-white hover:bg-black/10 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                    className="hidden md:flex absolute right-0 top-0 bottom-0 w-12 items-center justify-center text-white/70 hover:text-white hover:bg-black/10 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                  {/* Dot indicators for mobile */}
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                    {lightboxImages.map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${i === lightboxIndex ? 'bg-white scale-125' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="p-3 text-left">
              <div className="flex items-center gap-1.5 text-amber-400 text-sm">
                <span>★</span>
                <span className="text-zinc-700 font-medium">{lightboxExpense.star_rating || 0}</span>
              </div>
              <p className="text-sm text-zinc-600 mt-1 line-clamp-2">{lightboxExpense.caption || 'No caption yet.'}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Snap points as % of viewport height (measured from bottom)
const SNAP_POINTS = [0.30, 0.55, 0.80]; // min, mid, max
const CLOSE_THRESHOLD = 0.18; // drag below this % → close

function MobileBottomSheet({ onClose, activeFilter, changeFilter, cleanMode, toggleCleanMode, filteredExpenses, currency, onItemClick }) {
  const [sheetHeight, setSheetHeight] = useState(SNAP_POINTS[1]); // open at mid
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(null);
  const dragStartHeight = useRef(null);
  const sheetRef = useRef(null);
  const listRef = useRef(null);

  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Snap to nearest snap point, or close if below threshold
  const snapToNearest = useCallback((candidateFraction) => {
    if (candidateFraction < CLOSE_THRESHOLD) {
      onClose();
      return;
    }
    const nearest = SNAP_POINTS.reduce((prev, curr) =>
      Math.abs(curr - candidateFraction) < Math.abs(prev - candidateFraction) ? curr : prev
    );
    setSheetHeight(nearest);
  }, [onClose]);

  // Touch handlers on the drag handle
  const handleTouchStart = (e) => {
    // Only drag if the list is scrolled to top (or touch started on handle)
    dragStartY.current = e.touches[0].clientY;
    dragStartHeight.current = sheetHeight;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (dragStartY.current === null) return;
    const dy = dragStartY.current - e.touches[0].clientY; // positive = dragging up
    const newFraction = Math.min(
      SNAP_POINTS[SNAP_POINTS.length - 1],   // cap at max
      Math.max(0.10, dragStartHeight.current + dy / vh)  // floor at 10% so it feels alive before closing
    );
    setSheetHeight(newFraction);
  };

  const handleTouchEnd = (e) => {
    if (dragStartY.current === null) return;
    const dy = dragStartY.current - e.changedTouches[0].clientY;
    const candidate = dragStartHeight.current + dy / vh;
    dragStartY.current = null;
    setIsDragging(false);
    snapToNearest(candidate);
  };

  const heightPx = Math.round(sheetHeight * vh);

  return (
    <div className="md:hidden absolute left-0 right-0 bottom-0 z-[1002] pointer-events-auto">
      {/* Dim backdrop — tap to close */}
      <div
        className="absolute left-0 right-0 bottom-0 bg-zinc-900/20 transition-opacity duration-300"
        style={{ height: '100vh', top: `-${100 - sheetHeight * 100}vh` }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          height: `${heightPx}px`,
          transition: isDragging ? 'none' : 'height 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* ── Drag handle zone ── */}
        <div
          className="flex-shrink-0 flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Visual handle bar */}
          <div
            className={`w-10 h-1 rounded-full transition-colors duration-150 ${isDragging ? 'bg-zinc-400' : 'bg-zinc-200'}`}
          />
          {/* Snap indicators */}
          <div className="flex gap-1.5 mt-2">
            {SNAP_POINTS.map((pt, i) => (
              <button
                key={pt}
                onClick={() => setSheetHeight(pt)}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                  sheetHeight === pt ? 'bg-zinc-500 scale-125' : 'bg-zinc-200 hover:bg-zinc-300'
                }`}
                aria-label={['Compact', 'Half', 'Tall'][i]}
              />
            ))}
          </div>
        </div>

        {/* Header (not draggable — only the handle zone above is) */}
        <div className="flex-shrink-0 px-4 pt-1 pb-3 border-b border-zinc-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-900">Expenses</h2>
            <button onClick={onClose} className="text-zinc-400 p-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div className="flex gap-1 bg-zinc-100 rounded-lg p-0.5 mb-2">
            {['recent', 'topRated', 'topSpending'].map((filter) => (
              <button
                key={filter}
                onClick={() => changeFilter(filter)}
                className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                  activeFilter === filter ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
                }`}
              >
                {filter === 'recent' ? 'Recent' : filter === 'topRated' ? '⭐ Top' : '💰 Most'}
              </button>
            ))}
          </div>
          <button
            onClick={toggleCleanMode}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
              cleanMode ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-50 text-zinc-500 border-zinc-200'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
              </svg>
              Clean view
            </span>
            <span className={`w-7 h-4 rounded-full transition-all relative ${cleanMode ? 'bg-emerald-500' : 'bg-zinc-300'}`}>
              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${cleanMode ? 'left-3.5' : 'left-0.5'}`} />
            </span>
          </button>
        </div>

        {/* Scrollable list */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          <ExpenseListContent
            filteredExpenses={filteredExpenses}
            currency={currency}
            onItemClick={onItemClick}
          />
        </div>
      </div>
    </div>
  );
}

// Extracted list content to avoid repetition
function ExpenseListContent({ filteredExpenses, currency, onItemClick }) {
  if (filteredExpenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
        </div>
        <p className="text-sm font-medium text-zinc-600">No expenses</p>
        <p className="text-xs text-zinc-400 mt-1">Try a different filter</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-100">
      {filteredExpenses.map((exp) => (
        <div
          key={exp.id}
          onClick={() => onItemClick(exp)}
          className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 active:bg-zinc-100 cursor-pointer transition-colors"
        >
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-zinc-100 flex-shrink-0">
            {exp.photo_url ? (
              <img src={exp.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-zinc-900 truncate">{exp.title || exp.caption || 'Expense'}</p>
              <span className="text-sm font-semibold text-zinc-900 flex-shrink-0 tabular-nums">{currency}{exp.amount}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: TAG_DOT_COLOR[exp.location_tag] || '#a1a1aa' }}
              />
              <p className="text-xs text-zinc-400 truncate">{exp.short_location || exp.location_name}</p>
              <span className="text-xs text-amber-400 flex-shrink-0">★ {exp.star_rating}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}