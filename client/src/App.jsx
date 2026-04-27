import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';

import Home       from './pages/Home';
import Welcome    from './pages/Welcome';
import SpaceNew   from './pages/SpaceNew';
import SpaceView  from './pages/SpaceView';
import ReaderView from './pages/ReaderView';
import Settings   from './pages/Settings';
import RecallView from './pages/RecallView';
import Search     from './pages/Search';
import Templates  from './pages/Templates';

export default function App() {
  const initDarkMode = useStore(s => s.initDarkMode);

  useEffect(() => {
    initDarkMode();
  }, [initDarkMode]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                              element={<Home />} />
        <Route path="/welcome"                       element={<Welcome />} />
        <Route path="/recall"                        element={<RecallView />} />
        <Route path="/search"                        element={<Search />} />
        <Route path="/templates"                     element={<Templates />} />
        <Route path="/spaces/new"                    element={<SpaceNew />} />
        <Route path="/spaces/:id"                    element={<SpaceView />} />
        <Route path="/spaces/:id/map"                element={<SpaceView initialTab="map" />} />
        <Route path="/spaces/:id/items/:itemId"      element={<ReaderView />} />
        <Route path="/settings"                      element={<Settings />} />
        <Route path="*"                              element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
