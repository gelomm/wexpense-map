import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  FaHome,
  FaMapMarkedAlt,
  FaUsers,
  FaUser,
  FaCog,
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import PageLoader from './PageLoader';

const mainNavItems = [
  { to: '/', icon: FaHome, label: 'My Tab' },
  { to: '/map', icon: FaMapMarkedAlt, label: 'Map' },
  { to: '/members', icon: FaUsers, label: 'Members' },
  { to: '/profile', icon: FaUser, label: 'Profile' },
];

const headerMessages = {
  '/': "Here's how your spending looks this month. ₍₍⚞(˶ˆᗜˆ˵)⚟⁾⁾",
  '/map': 'Explore your expenses by location. 𐔌՞ ܸ.ˬ.ܸ՞𐦯˚˖𓍢ִ໋❀',
  '/members': 'Manage the people you split with. ദ്ദി(˵ •̀ ᴗ - ˵ ) ✧',
  '/profile': 'Your personal expense profile.｡°(°¯᷄◠¯᷅°)°｡',
  '/settings': null,
};

// Cute ghost mascot — soft blob body, dot eyes that track the cursor, gentle head tilt
function GhostMascot() {
  const ref = useRef(null);
  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState(0);

  useEffect(() => {
    let frame = null;

    function handleMove(e) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const angle = Math.atan2(dy, dx);
        const dist = Math.min(Math.hypot(dx, dy) / 60, 1);

        setPupil({
          x: Math.cos(angle) * 1.6 * dist,
          y: Math.sin(angle) * 1.6 * dist,
        });
        setTilt(Math.max(-1, Math.min(1, dx / 400)) * 7);
      });
    }

    window.addEventListener('mousemove', handleMove);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <svg
      ref={ref}
      width="52"
      height="52"
      viewBox="0 0 60 60"
      className="ghost-mascot"
      style={{ transform: `rotate(${tilt}deg)`, transition: 'transform 0.18s ease-out' }}
    >
      {/* soft ground shadow */}
      <ellipse cx="30" cy="50" rx="13" ry="2.5" fill="#18181b" opacity="0.07" />

      {/* ear nubs */}
      <ellipse cx="20" cy="9" rx="3.5" ry="6" fill="#ffffff" stroke="#e4e4e7" strokeWidth="1" />
      <ellipse cx="38" cy="9" rx="3.5" ry="6" fill="#ffffff" stroke="#e4e4e7" strokeWidth="1" />

      {/* body: rounded dome top, scalloped ghost bottom */}
      <path
        d="M12,32
           A18,20 0 1 1 48,32
           L48,42
           A6,6 0 0 1 36,42
           A6,6 0 0 1 24,42
           A6,6 0 0 1 12,42
           Z"
        fill="#ffffff"
        stroke="#e4e4e7"
        strokeWidth="1.5"
      />

      {/* stub arms */}
      <ellipse cx="9" cy="36" rx="3.5" ry="4.5" fill="#ffffff" stroke="#e4e4e7" strokeWidth="1" />
      <ellipse cx="51" cy="36" rx="3.5" ry="4.5" fill="#ffffff" stroke="#e4e4e7" strokeWidth="1" />

      {/* blush */}
      <ellipse cx="17" cy="33" rx="2.6" ry="1.8" fill="#fbcfe8" opacity="0.85" />
      <ellipse cx="43" cy="33" rx="2.6" ry="1.8" fill="#fbcfe8" opacity="0.85" />

      {/* eyes: sclera + pupil that tracks cursor */}
      <circle cx="22" cy="28" r="4.2" fill="#ffffff" />
      <circle cx="38" cy="28" r="4.2" fill="#ffffff" />
      <circle
        cx={22 + pupil.x}
        cy={28 + pupil.y}
        r="2.3"
        fill="#18181b"
        className="ghost-pupil"
      />
      <circle
        cx={38 + pupil.x}
        cy={28 + pupil.y}
        r="2.3"
        fill="#18181b"
        className="ghost-pupil"
      />
      {/* tiny eye highlights */}
      <circle cx={20.6 + pupil.x * 0.6} cy={26.6 + pupil.y * 0.6} r="0.7" fill="#ffffff" />
      <circle cx={36.6 + pupil.x * 0.6} cy={26.6 + pupil.y * 0.6} r="0.7" fill="#ffffff" />

      {/* mouth */}
      <path d="M27,35.5 Q30,38 33,35.5" stroke="#18181b" strokeWidth="1.6" strokeLinecap="round" fill="none" />

      <style>{`
        .ghost-mascot {
          animation: ghostFloat 3.2s ease-in-out infinite;
        }
        @keyframes ghostFloat {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -4px; }
        }
        .ghost-pupil {
          transition: cx 0.12s ease-out, cy 0.12s ease-out;
        }
      `}</style>
    </svg>
  );
}

export default function Layout() {
  const location = useLocation();
  const currentPath = location.pathname;
  const isSettings = currentPath === '/settings';
  const headerMessage = headerMessages[currentPath] || '';

  const { profile } = useAuth();
  const displayName = profile?.full_name || 'buddy';
  const { isOverlayOpen } = useUI();

  return (
    <div className="flex h-screen absolute inset-0 z-[1001] flex-row">
      {/* Dynamic blurred shapes */}
      <div className="animated-shapes">
        <div className="shape shape-1" />
        <div className="shape shape-2" />
        <div className="shape shape-3" />
        <div className="shape shape-4" />
      </div>

      {/* Left Sidebar */}
      <aside
        className={`w-24 bg-white/70 backdrop-blur-md border-r border-zinc-200 flex flex-col items-center py-6 z-20 shadow-sm transition-opacity duration-300 ${
          isOverlayOpen ? 'opacity-0 pointer-events-none' : ''
        }`}
      >
        <div className="text-zinc-900 font-bold text-lg mb-8">
          <FaHome size={24} />
        </div>
        <nav className="flex flex-col items-center gap-6 flex-1">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-zinc-900 bg-zinc-100 shadow-sm scale-105'
                    : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50'
                }`
              }
            >
              <item.icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-zinc-900 bg-zinc-100 shadow-sm scale-105'
                  : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50'
              }`
            }
          >
            <FaCog size={20} />
            <span className="text-[10px] font-medium">Settings</span>
          </NavLink>
        </div>
      </aside>

      {/* Right side: header + content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Fixed header – fades when overlay is open */}
        {!isSettings && (
          <header
            className={`relative px-2 py-0 z-[1001] transition-opacity duration-300 ${
              isOverlayOpen ? 'opacity-0 pointer-events-none' : ''
            }`}
          >
            {/* Color tint gradient */}
            <div className="absolute top-0 left-0 right-0 bottom-[-32px] bg-gradient-to-b from-white/95 via-white/60 to-transparent pointer-events-none" />

            {/* Progressive blur layers */}
            <div className="absolute top-0 left-0 right-0 bottom-[-32px] pointer-events-none">
              <div
                className="absolute inset-0 backdrop-blur-[2px]"
                style={{
                  maskImage: 'linear-gradient(to bottom, black 0%, black 22%, transparent 38%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 22%, transparent 38%)',
                }}
              />
              <div
                className="absolute inset-0 backdrop-blur-[5px]"
                style={{
                  maskImage: 'linear-gradient(to bottom, black 0%, black 35%, transparent 55%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 35%, transparent 55%)',
                }}
              />
              <div
                className="absolute inset-0 backdrop-blur-[9px]"
                style={{
                  maskImage: 'linear-gradient(to bottom, black 0%, black 48%, transparent 72%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 48%, transparent 72%)',
                }}
              />
              <div
                className="absolute inset-0 backdrop-blur-md"
                style={{
                  maskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)',
                }}
              />
            </div>

            {/* Actual header content */}
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                {/* Welcome text – left */}
                <div>
                  <h1 className="text-xl font-bold text-zinc-900" style={{ fontFamily: "'Caveat', cursive" }}>
                    Welcome back,{' '}
                    <span className="text-indigo-600">{displayName}</span>
                    {' '}⋆˚꩜｡‧₊˚♪ 𝄞₊˚⊹
                  </h1>
                </div>

                {/* Speech bubble with mascot peeking from its bottom-left – right */}
                {headerMessage && (
                  <div className="relative flex-shrink-0 pr-6 pb-9 pt-1">
                    <div className="relative">
                      <div className="bg-white/80 backdrop-blur-sm border border-zinc-200 rounded-2xl rounded-bl-md px-4 py-1.5 shadow-sm max-w-[220px] sm:max-w-xs">
                        <p className="text-zinc-600 text-xs">{headerMessage}</p>
                      </div>
                      {/* tail pointing down toward the mascot */}
                      <div className="absolute -bottom-1.5 left-5 w-3 h-3 bg-white/80 border-b border-r border-zinc-200 rotate-45 -z-10" />
                    </div>

                    {/* mascot peeking out from the bottom-left corner of the bubble */}
                    <div className="absolute bottom-0 left-0">
                      <GhostMascot />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Scrollable content */}
        <main className="flex-1 relative overflow-y-auto z-10">
          <PageLoader />
          <Outlet />
        </main>
      </div>
    </div>
  );
}