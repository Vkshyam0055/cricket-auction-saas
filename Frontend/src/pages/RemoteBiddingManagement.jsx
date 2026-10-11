import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { TournamentContext } from '../context/TournamentContext';
import { apiRequest } from '../utils/apiClient';

export default function RemoteBiddingManagement() {
  const { tournament } = useContext(TournamentContext);
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [editingTeam, setEditingTeam] = useState(null);
  const [editForm, setEditForm] = useState({ remoteAccessEnabled: false, remoteUsername: '', remotePassword: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tournament) return;
    const fetchTeams = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const res = await apiRequest({ method: 'get', path: `/api/teams/tournament/${tournament._id}`, headers });
        setTeams(res.data);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to fetch teams');
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, [tournament]);

  const handleEdit = (team) => {
    setEditingTeam(team._id);
    setEditForm({
      remoteAccessEnabled: team.remoteAccessEnabled || false,
      remoteUsername: team.remoteUsername || '',
      remotePassword: ''
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await apiRequest({
        method: 'put',
        path: `/api/teams/${editingTeam}/remote-access`,
        data: editForm,
        headers
      });
      setTeams(teams.map(t => t._id === editingTeam ? res.data.team : t));
      setEditingTeam(null);
    } catch (err) {
      alert(err.message || 'Failed to update remote access');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTeams = teams.filter(t => t.teamName.toLowerCase().includes(searchTerm.toLowerCase()));

  if (!tournament) {
    return <div className="p-8 text-center text-slate-500">Please select a tournament from the dashboard first.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black text-slate-900">Remote Bidding Management</h1>
          <button onClick={() => navigate('/dashboard')} className="text-indigo-600 font-bold hover:underline">
            Back to Dashboard
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">Teams in {tournament.name}</h2>
            <input 
              type="text"
              placeholder="Search teams..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none w-64"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500 font-medium">Loading teams...</div>
          ) : error ? (
            <div className="text-center py-12 text-red-500 font-medium border-2 border-dashed border-red-200 rounded-xl bg-red-50">{error}</div>
          ) : filteredTeams.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-medium border-2 border-dashed border-slate-200 rounded-xl">
              No teams found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTeams.map(team => (
                <div key={team._id} className="border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900">{team.teamName}</h3>
                    <div className="text-sm text-slate-500 mt-1">
                      Status: {team.remoteAccessEnabled ? <span className="text-green-600 font-bold">Enabled</span> : <span className="text-red-500 font-bold">Disabled</span>}
                      {team.remoteAccessEnabled && team.remoteUsername && (
                        <span className="ml-3">Username: <strong className="text-slate-700">{team.remoteUsername}</strong></span>
                      )}
                    </div>
                  </div>
                  
                  {editingTeam === team._id ? (
                    <form onSubmit={handleSave} className="w-full sm:w-auto bg-white p-4 rounded shadow-sm border border-indigo-100 flex flex-col gap-3">
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={editForm.remoteAccessEnabled}
                          onChange={e => setEditForm({...editForm, remoteAccessEnabled: e.target.checked})}
                          className="w-4 h-4 text-indigo-600"
                        />
                        Enable Remote Access
                      </label>
                      <input 
                        type="text" 
                        placeholder="Username" 
                        required={editForm.remoteAccessEnabled}
                        value={editForm.remoteUsername}
                        onChange={e => setEditForm({...editForm, remoteUsername: e.target.value})}
                        className="px-3 py-1.5 border border-slate-300 rounded text-sm w-full outline-none focus:border-indigo-500"
                      />
                      <input 
                        type="password" 
                        placeholder="New Password (leave blank to keep)" 
                        required={editForm.remoteAccessEnabled && !team.remotePasswordHash}
                        value={editForm.remotePassword}
                        onChange={e => setEditForm({...editForm, remotePassword: e.target.value})}
                        className="px-3 py-1.5 border border-slate-300 rounded text-sm w-full outline-none focus:border-indigo-500"
                      />
                      <div className="flex gap-2 justify-end mt-1">
                        <button type="button" onClick={() => setEditingTeam(null)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded">Cancel</button>
                        <button type="submit" disabled={submitting} className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded shadow-sm">Save</button>
                      </div>
                    </form>
                  ) : (
                    <button 
                      onClick={() => handleEdit(team)}
                      className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap"
                    >
                      Manage Access
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
