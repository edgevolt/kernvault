import { useEffect, Component } from 'react';
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

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: '#f87171', fontFamily: 'monospace', background: '#09090b', minHeight: '100vh' }}>
          <h2 style={{ color: '#fb923c', marginBottom: 8 }}>⚠ React render error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error?.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#71717a', marginTop: 16 }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}



export default function App() {
  const initDarkMode = useStore(s => s.initDarkMode);

  useEffect(() => {
    initDarkMode();
  }, [initDarkMode]);

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
