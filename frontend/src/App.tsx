import React, { useState, useEffect } from 'react';
import { DashboardLayout } from './layouts/DashboardLayout';
import { DashboardPage } from './pages/DashboardPage';
import { CameraViewPage } from './pages/CameraViewPage';
import { MapPage } from './pages/MapPage';
import { CamerasPage } from './pages/CamerasPage';
import { VehicleSearchPage } from './pages/VehicleSearchPage';
import { TrajectoryPage } from './pages/TrajectoryPage';
import { TrafficAnalyticsPage } from './pages/TrafficAnalyticsPage';
import { AlertsPage } from './pages/AlertsPage';
import { BlacklistPage } from './pages/BlacklistPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { SettingsPage } from './pages/SettingsPage';
import { InvestigationPage } from './pages/InvestigationPage';
import { api } from './lib/api';

const getTabFromPath = (pathname: string): string => {
  const clean = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!clean || clean === 'dashboard') return 'dashboard';
  if (clean === 'camera' || clean === 'live-anpr') return 'camera';
  if (clean === 'vehicles' || clean === 'search') return 'vehicles';
  if (clean === 'alerts') return 'alerts';
  if (clean === 'map') return 'map';
  if (clean === 'cameras') return 'cameras';
  if (clean === 'trajectory') return 'trajectory';
  if (clean === 'investigation' || clean === 'intelligence') return 'investigation';
  if (clean === 'analytics') return 'analytics';
  if (clean === 'blacklist') return 'blacklist';
  if (clean === 'system') return 'system';
  if (clean === 'settings') return 'settings';
  return 'dashboard';
};

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>(() => getTabFromPath(window.location.pathname));
  const [mode, setMode] = useState<'live' | 'demo'>('live');
  const [targetTrajectoryPlate, setTargetTrajectoryPlate] = useState<string>('DL 99 ZZ 0002');
  const [targetSearchPlate, setTargetSearchPlate] = useState<string>('');
  const [targetInvestigationPlate, setTargetInvestigationPlate] = useState<string>('DL01AB1234');
  const [activeAlertCount, setActiveAlertCount] = useState<number>(0);
  const [refreshNonce, setRefreshNonce] = useState<number>(0);

  // Sync with browser URL back/forward history
  useEffect(() => {
    const handlePopState = () => {
      setCurrentTab(getTabFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Poll alert count based on current mode
  useEffect(() => {
    const updateAlertCount = () => {
      api.getAlerts('ACTIVE', undefined, mode)
        .then(alerts => setActiveAlertCount(alerts.length))
        .catch(() => {});
    };
    updateAlertCount();
    const interval = setInterval(updateAlertCount, 8000);
    return () => clearInterval(interval);
  }, [mode, refreshNonce]);

  const handleNavigate = (tab: string, param?: string) => {
    if (tab === 'trajectory' && param) {
      setTargetTrajectoryPlate(param);
    }
    if ((tab === 'search' || tab === 'vehicles') && param) {
      setTargetSearchPlate(param);
    }
    if ((tab === 'investigation' || tab === 'intelligence') && param) {
      setTargetInvestigationPlate(param);
    }
    const resolvedTab = tab === 'search' ? 'vehicles' : (tab === 'live-anpr' ? 'camera' : tab);
    setCurrentTab(resolvedTab);

    // Sync browser URL
    const targetPath = resolvedTab === 'dashboard' ? '/dashboard' : `/${resolvedTab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  const handleToggleMode = (newMode: 'live' | 'demo') => {
    setMode(newMode);
    setRefreshNonce(prev => prev + 1);
  };

  const handleReloadData = () => {
    setRefreshNonce(prev => prev + 1);
  };

  return (
    <DashboardLayout
      currentTab={currentTab}
      onSelectTab={(tab) => handleNavigate(tab)}
      activeAlertCount={activeAlertCount}
      mode={mode}
      onToggleMode={handleToggleMode}
      onReloadData={handleReloadData}
    >
      {currentTab === 'dashboard' && (
        <DashboardPage 
          key={`dashboard-${mode}-${refreshNonce}`}
          mode={mode} 
          onNavigate={handleNavigate}
          onToggleMode={handleToggleMode}
          onReloadData={handleReloadData}
        />
      )}
      {(currentTab === 'camera' || currentTab === 'live-anpr') && (
        <CameraViewPage 
          key={`camera-${mode}-${refreshNonce}`}
          onNavigate={handleNavigate}
        />
      )}
      {currentTab === 'map' && (
        <MapPage 
          key={`map-${mode}-${refreshNonce}`}
          mode={mode} 
        />
      )}
      {currentTab === 'cameras' && <CamerasPage mode={mode} />}
      {currentTab === 'vehicles' && (
        <VehicleSearchPage 
          key={`vehicles-${mode}-${targetSearchPlate}-${refreshNonce}`}
          initialPlate={targetSearchPlate}
          mode={mode} 
          onNavigateTrajectory={(plate) => handleNavigate('trajectory', plate)} 
          onNavigateInvestigation={(plate) => handleNavigate('investigation', plate)}
        />
      )}
      {currentTab === 'trajectory' && (
        <TrajectoryPage 
          key={`trajectory-${mode}-${targetTrajectoryPlate}-${refreshNonce}`}
          initialPlate={targetTrajectoryPlate} 
          mode={mode}
          onNavigateInvestigation={(plate) => handleNavigate('investigation', plate)}
        />
      )}
      {currentTab === 'investigation' && (
        <InvestigationPage
          key={`investigation-${mode}-${targetInvestigationPlate}-${refreshNonce}`}
          initialPlate={targetInvestigationPlate}
          mode={mode}
          onNavigateTrajectory={(plate) => handleNavigate('trajectory', plate)}
          onNavigateVehicles={(plate) => handleNavigate('vehicles', plate)}
        />
      )}
      {currentTab === 'analytics' && (
        <TrafficAnalyticsPage 
          key={`analytics-${mode}-${refreshNonce}`}
          mode={mode} 
        />
      )}
      {currentTab === 'alerts' && (
        <AlertsPage 
          key={`alerts-${mode}-${refreshNonce}`}
          mode={mode} 
          onNavigateTrajectory={(plate) => handleNavigate('trajectory', plate)} 
        />
      )}
      {currentTab === 'blacklist' && (
        <BlacklistPage 
          key={`blacklist-${mode}-${refreshNonce}`}
          mode={mode} 
        />
      )}
      {currentTab === 'system' && <SystemHealthPage />}
      {currentTab === 'settings' && <SettingsPage />}
    </DashboardLayout>
  );
};

export default App;
