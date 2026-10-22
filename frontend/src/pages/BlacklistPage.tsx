import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Plus, Trash2, Zap, AlertTriangle, 
  CheckCircle2, Clock, Sparkles, X, ShieldCheck
} from 'lucide-react';
import { api } from '../lib/api';
import { BlacklistRecord, Severity } from '../types';

interface BlacklistPageProps {
  mode?: 'live' | 'demo';
}

export const BlacklistPage: React.FC<BlacklistPageProps> = ({ mode = 'live' }) => {
  const [blacklist, setBlacklist] = useState<BlacklistRecord[]>([]);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newPlate, setNewPlate] = useState<string>('');
  const [newReason, setNewReason] = useState<string>('');
  const [newSeverity, setNewSeverity] = useState<Severity>('HIGH');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchBlacklist = async () => {
    try {
      const data = await api.getBlacklist(mode);
      setBlacklist(data);
    } catch (err) {
      console.error('Failed to load blacklist:', err);
    }
  };

  useEffect(() => {
    fetchBlacklist();
  }, [mode]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlate.trim() || !newReason.trim()) {
      setErrorMsg('Please enter both vehicle plate number and reason.');
      return;
    }
    setErrorMsg(null);
    try {
      const added = await api.addBlacklist(newPlate.trim().toUpperCase(), newReason.trim(), newSeverity, mode);
      setBlacklist(prev => [added, ...prev]);
      setShowAddModal(false);
      setNewPlate('');
      setNewReason('');
      setActionSuccess(`Vehicle ${added.plate_number} added to active surveillance blacklist.`);
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: any) {
      setErrorMsg(`Failed to add plate: ${err.message}`);
    }
  };

  const handleDelete = async (plate: string) => {
    try {
      await api.removeBlacklist(plate);
      setBlacklist(prev => prev.filter(b => b.plate_number !== plate));
      setActionSuccess(`Vehicle ${plate} removed from active blacklist.`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to delete from blacklist:', err);
    }
  };

  const handleSimulateHit = async (plate: string) => {
    try {
      const alert = await api.simulateBlacklistHit(plate);
      setActionSuccess(`CRITICAL ALERT GENERATED: Blacklist hit for ${plate} detected at camera ${alert.camera_code || 'C-001'}.`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      console.error('Failed to simulate hit:', err);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div className="bg-[#0D1526] border border-[#1E293B] rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>INTERCEPT WATCHLIST DIRECTORY</span>
          </div>
          <h1 className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span>Security Watchlist & Intercept Targets</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-500/40">
              {blacklist.length} TARGETS
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Plates registered here trigger instantaneous <span className="font-bold text-rose-400">CRITICAL ALERTS</span> upon camera sighting.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs shadow-xs transition-colors cursor-pointer border border-rose-400/40"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>ADD TARGET TO WATCHLIST</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Watchlist Table */}
      <div className="bg-[#0D1526] border border-[#1E293B] rounded overflow-hidden shadow-xs">
        <div className="p-3 border-b border-[#1E293B] bg-[#0A0F1D] flex items-center justify-between">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
            Active Targets in Watchlist Database
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            DATA SOURCE: {mode.toUpperCase()}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-[#1E293B] bg-[#0A0F1D] text-slate-400 text-[10px] font-bold uppercase">
                <th className="py-2.5 px-3">Plate Number</th>
                <th className="py-2.5 px-3">Watchlist Reason</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Active Status</th>
                <th className="py-2.5 px-3">Enrolled At</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60 text-slate-300">
              {blacklist.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No blacklisted plates registered for current mode.
                  </td>
                </tr>
              ) : (
                blacklist.map(rec => (
                  <tr key={rec.id} className="hover:bg-[#131F37]/50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-100">
                      <span className="bg-[#090E1A] px-2 py-0.5 rounded border border-[#1E293B] text-rose-300">
                        {rec.plate_number}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-200">
                      {rec.reason}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        rec.severity === 'CRITICAL' 
                          ? 'bg-rose-950/80 text-rose-300 border-rose-500/40' 
                          : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                      }`}>
                        {rec.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> ACTIVE
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {new Date(rec.added_at || rec.created_at || Date.now()).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      <button
                        onClick={() => handleSimulateHit(rec.plate_number)}
                        className="px-2 py-1 rounded bg-[#131F37] hover:bg-[#1A2946] text-amber-400 border border-[#1E293B] text-xs font-bold transition-colors cursor-pointer"
                        title="Simulate camera observation hit"
                      >
                        Simulate Hit
                      </button>
                      <button
                        onClick={() => handleDelete(rec.plate_number)}
                        className="p-1 rounded hover:bg-rose-950/80 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Remove from watchlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD TARGET MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0D1526] rounded border border-[#1E293B] max-w-md w-full p-5 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Register Target Plate</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded bg-rose-950/90 border border-rose-500/50 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-400 text-[10px] uppercase mb-1">Vehicle License Plate</label>
                <input
                  type="text"
                  value={newPlate}
                  onChange={e => setNewPlate(e.target.value.toUpperCase())}
                  placeholder="e.g. DL 99 ZZ 0002"
                  className="w-full px-2.5 py-1.5 rounded bg-[#090E1A] border border-[#1E293B] text-slate-200 uppercase focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase mb-1">Reason for Security Watchlist</label>
                <input
                  type="text"
                  value={newReason}
                  onChange={e => setNewReason(e.target.value)}
                  placeholder="e.g. Suspected involvement in robbery"
                  className="w-full px-2.5 py-1.5 rounded bg-[#090E1A] border border-[#1E293B] text-slate-200 font-sans focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase mb-1">Alert Severity Level</label>
                <select
                  value={newSeverity}
                  onChange={e => setNewSeverity(e.target.value as Severity)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#090E1A] border border-[#1E293B] text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="CRITICAL">CRITICAL (Immediate Intercept)</option>
                  <option value="HIGH">HIGH (High Priority)</option>
                  <option value="MEDIUM">MEDIUM (Standard Monitor)</option>
                  <option value="LOW">LOW (Log Only)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded bg-[#131F37] hover:bg-[#1A2946] text-slate-300 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer border border-rose-400/40"
                >
                  Add to Watchlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlacklistPage;
