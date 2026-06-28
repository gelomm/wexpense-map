import { createContext, useContext, useState } from 'react';

const UIContext = createContext();

export function UIProvider({ children }) {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);   // ← new

  const openOverlay = () => setIsOverlayOpen(true);
  const closeOverlay = () => setIsOverlayOpen(false);
  const triggerRefresh = () => setRefreshKey(k => k + 1);   // ← new

  return (
    <UIContext.Provider value={{ isOverlayOpen, openOverlay, closeOverlay, refreshKey, triggerRefresh }}>
      {children}
    </UIContext.Provider>
  );
}

export const useUI = () => useContext(UIContext);