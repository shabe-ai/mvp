"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

interface Team {
  _id: string;
  name: string;
  ownerId: string;
  members: string[];
  createdAt: number;
  updatedAt: number;
}

interface TeamStats {
  contacts: number;
  accounts: number;
  activities: number;
  deals: number;
  totalRecords: number;
}

export default function TeamManagement() {
  const { user } = useUser();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadTeams();
  }, [user]);

  useEffect(() => {
    if (selectedTeam) {
      loadTeamStats(selectedTeam._id);
    }
  }, [selectedTeam]);

  const loadTeams = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/teams');
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setTeams(data);
        if (data.length > 0 && !selectedTeam) {
          setSelectedTeam(data[0]);
        }
      }
    } catch (err) {
      setError("Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  const loadTeamStats = async (teamId: string) => {
    if (!user) return;

    try {
      const res = await fetch(`/api/teams/stats?teamId=${teamId}`);
      const data = await res.json();

      if (data.error) {
        console.error('Failed to load team stats:', data.error);
      } else {
        setTeamStats(data);
      }
    } catch (err) {
      console.error('Error loading team stats:', err);
    }
  };

  const createTeam = async () => {
    if (!user || !newTeamName.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName.trim() }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setTeams(prev => [...prev, data]);
        setSelectedTeam(data);
        setNewTeamName('');
        setShowCreateForm(false);
      }
    } catch (err) {
      setError("Failed to create team");
    } finally {
      setLoading(false);
    }
  };

  const updateTeam = async (teamId: string, name: string) => {
    if (!user || !name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/teams', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, name: name.trim() }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setTeams(prev => prev.map(team => 
          team._id === teamId ? { ...team, name: name.trim() } : team
        ));
        if (selectedTeam?._id === teamId) {
          setSelectedTeam(prev => prev ? { ...prev, name: name.trim() } : null);
        }
        setEditingTeam(null);
      }
    } catch (err) {
      setError("Failed to update team");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Team List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-slate-900">Your Teams</h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md"
          >
            {showCreateForm ? "Cancel" : "Create Team"}
          </button>
        </div>

        {showCreateForm && (
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Enter team name..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && createTeam()}
              />
              <button
                onClick={createTeam}
                disabled={loading || !newTeamName.trim()}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {teams.map((team) => (
            <div
              key={team._id}
              className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                selectedTeam?._id === team._id
                  ? "bg-amber-50 border-amber-200 shadow-sm"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
              onClick={() => setSelectedTeam(team)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-slate-500 to-slate-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">{team.name}</h4>
                    <p className="text-sm text-slate-600">
                      {team.members.length} member{team.members.length !== 1 ? 's' : ''} • Created {formatDate(team.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {team.ownerId === user?.id && (
                    <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                      Owner
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTeam(team);
                    }}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Details */}
      {selectedTeam && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-slate-900">Team Details</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-500">Last updated: {formatDate(selectedTeam.updatedAt)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Team Info */}
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-medium text-slate-900 mb-3">Team Information</h4>
                {editingTeam?._id === selectedTeam._id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editingTeam.name}
                      onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={() => updateTeam(editingTeam._id, editingTeam.name)}
                        disabled={loading}
                        className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-3 py-1 rounded text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingTeam(null)}
                        className="px-3 py-1 text-slate-600 hover:text-slate-800 text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-slate-900 font-medium">{selectedTeam.name}</p>
                    <p className="text-sm text-slate-600">Team ID: {selectedTeam._id}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-lg font-medium text-slate-900 mb-3">Members</h4>
                <div className="space-y-2">
                  {selectedTeam.members.map((memberId) => (
                    <div key={memberId} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <span className="text-sm text-slate-700">{memberId}</span>
                      {memberId === selectedTeam.ownerId && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                          Owner
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Team Statistics */}
            <div>
              <h4 className="text-lg font-medium text-slate-900 mb-3">Statistics</h4>
              {teamStats ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-900">{teamStats.contacts}</p>
                        <p className="text-sm text-blue-700">Contacts</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-900">{teamStats.accounts}</p>
                        <p className="text-sm text-green-700">Accounts</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-purple-900">{teamStats.activities}</p>
                        <p className="text-sm text-purple-700">Activities</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-900">{teamStats.deals}</p>
                        <p className="text-sm text-orange-700">Deals</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-slate-500 text-center">Loading statistics...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 