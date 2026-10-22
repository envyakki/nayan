import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, ShieldAlert, CheckCircle2, Navigation, 
  Clock, Filter, RefreshCw, XCircle, ChevronRight, Activity, AlertOctagon
} from 'lucide-react';
import { api } from '../lib/api';
import { Alert, AlertStatus, Severity } from '../types';

interface AlertsPageProps {
  onNavigateTrajectory: (plate: string) => void;
  mode?: 'live' | 'demo';
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ onNavigateTrajectory, mode = 'live' }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.getAlerts(
        statusFilter === 'ALL' ? undefined : statusFilter,
        severityFilter === 'ALL' ? undefined : severityFilter,
        mode
      );
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, severityFilter, mode]);

  const handleUpdateStatus = async (alertId: string, newStatus: AlertStatus) => {
    try {
      const updated = await api.updateAlertStatus(alertId, newStatus);
      setAlerts(prev => prev.map(a => a.id === alertId ? updated : a));
      setActionSuccess(`Alert transitioned to ${newStatus}. Status recorded in database.`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to update alert:', err);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div className="bg-[#0D1526] border border-[#1E293B] rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>INCIDENT COMMAND & SECURITY INTERCEPT QUEUE</span>
          </div>
          <h1 className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span>Threat Alerts & Watchlist Matches</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-500/40">
              {alerts.length} INCIDENTS
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated sensor notifications for blacklist hits, speed transitions, and optical offline telemetry.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-[#090E1A] border border-[#1E293B] p-1 rounded font-mono text-xs">
          {['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131F37]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Alert List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 rounded bg-[#0D1526] border border-[#1E293B] font-mono">
            Querying Security Incident Records...
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 rounded bg-[#0D1526] border border-[#1E293B] space-y-2 font-mono">
            <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="font-bold text-slate-300 text-sm">No {statusFilter.toLowerCase()} security alerts detected</div>
            <div className="text-slate-500">
              {mode === 'live' 
                ? 'Operating in pure Live Mode. Real alerts trigger when live optical scans intercept a blacklisted target.' 
                : 'All alerts resolved or none matching current filter.'}
            </div>
          </div>
        ) : (
          alerts.map(alert => {
            const isCritical = alert.severity === 'CRITICAL';
            const isHigh = alert.severity === 'HIGH';

            const severityBadge = isCritical
              ? 'bg-rose-950/80 text-rose-300 border-rose-500/60 font-bold'
              : isHigh
              ? 'bg-amber-950/80 text-amber-300 border-amber-500/60 font-bold'
              : 'bg-blue-950/80 text-blue-300 border-blue-500/60 font-medium';

            const borderAccent = isCritical
              ? 'border-l-4 border-l-rose-500 border-t border-r border-b border-[#1E293B]'
              : isHigh
              ? 'border-l-4 border-l-amber-500 border-t border-r border-b border-[#1E293B]'
              : 'border-l-4 border-l-blue-500 border-t border-r border-b border-[#1E293B]';

            return (
              <div
                key={alert.id}
                className={`p-4 rounded bg-[#0D1526] ${borderAccent} shadow-xs hover:bg-[#101A2E] transition-all space-y-2.5`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-mono border ${severityBadge}`}>
                      {alert.alert_type}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 bg-[#131F37] border border-[#1E293B] font-bold">
                      SEVERITY: {alert.severity}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-[#090E1A] border border-[#1E293B]">
                      STATUS: {alert.status}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(alert.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-xs font-medium text-slate-200 leading-relaxed font-sans">
                  {alert.description}
                </div>

                <div className="pt-2.5 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-4 font-mono text-xs">
                    {alert.plate_number && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 uppercase text-[10px]">Target Plate:</span>
                        <span className="text-slate-100 font-bold bg-[#090E1A] px-2 py-0.5 rounded border border-[#1E293B]">
                          {alert.plate_number}
                        </span>
                      </div>
                    )}
                    {alert.camera_code && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 uppercase text-[10px]">Sensor Node:</span>
                        <span className="text-blue-400 font-bold">{alert.camera_code}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 uppercase text-[10px]">Threat Index:</span>
                      <span className={`font-bold ${alert.risk_score > 80 ? 'text-rose-400' : 'text-amber-400'}`}>
                        {alert.risk_score}/100
                      </span>
                    </div>
                  </div>

                  {/* ACTION WORKFLOW BUTTONS */}
                  <div className="flex items-center space-x-2 font-mono">
                    {alert.plate_number && (
                      <button
                        onClick={() => onNavigateTrajectory(alert.plate_number!)}
                        className="px-2.5 py-1 rounded bg-[#131F37] hover:bg-[#1A2946] text-blue-400 border border-[#1E293B] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Navigation className="w-3 h-3 text-blue-400" />
                        <span>Trajectory</span>
                      </button>
                    )}

                    {alert.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleUpdateStatus(alert.id, 'ACKNOWLEDGED')}
                        className="px-2.5 py-1 rounded bg-[#131F37] hover:bg-[#1A2946] text-slate-200 text-xs font-bold flex items-center gap-1 border border-[#1E293B] transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3 text-amber-400" />
                        <span>Acknowledge</span>
                      </button>
                    )}

                    {alert.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleUpdateStatus(alert.id, 'RESOLVED')}
                        className="px-2.5 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Resolve</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AlertsPage;
