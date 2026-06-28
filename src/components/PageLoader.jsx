import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function PageLoader() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 1000);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <div className="flex items-end gap-1.5 h-6">
        <span className="w-1.5 bg-zinc-900 rounded-full loader-bar" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 bg-zinc-900 rounded-full loader-bar" style={{ animationDelay: '120ms' }} />
        <span className="w-1.5 bg-zinc-900 rounded-full loader-bar" style={{ animationDelay: '240ms' }} />
        <span className="w-1.5 bg-zinc-900 rounded-full loader-bar" style={{ animationDelay: '360ms' }} />
      </div>

      <style>{`
        @keyframes loaderWave {
          0%, 100% {
            height: 6px;
            opacity: 0.35;
          }
          50% {
            height: 24px;
            opacity: 1;
          }
        }
        .loader-bar {
          height: 6px;
          animation: loaderWave 1.1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}