import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { readStore, removeStore, writeStore } from '../utils/storage.js';
import { DEFAULT_SETTINGS } from '../utils/format.js';

const SettingsContext = createContext(null);
const STORAGE_KEY = 'settings';

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...(readStore(STORAGE_KEY) || {}),
  }));

  useEffect(() => {
    writeStore(STORAGE_KEY, settings);
  }, [settings]);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(
    () => ({ settings, updateSettings, setSettings }),
    [settings, updateSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}

export { SettingsContext, readStore, removeStore };
