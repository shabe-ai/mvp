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

  useEffect(() => {
    if (user) {
      loadTeams();
    }
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
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamStats = async (teamId: string) => {
    try {
      const response = await fetch(`/api/teams/stats?teamId=${teamId}`);
      const data = await response.json();
      if (data.success) {
        setTeamStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading team stats:', error);
    }
  };

  const updateTeamName = async (teamId: string, newName: string) => {
    try {
      const response = await fetch('/api/teams', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, name: newName })
      });
      
      if (response.ok) {
        await loadTeams();
        setEditingTeam(null);
      }
    } catch (error) {
      console.error('Error updating team name:', error);
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/teams?teamId=${teamId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setTeams(prev => prev.filter(team => team._id !== teamId));
        if (selectedTeam?._id === teamId) {
          setSelectedTeam(teams.find(team => team._id !== teamId) || null);
        }
      }
    } catch (err) {
      setError("Failed to delete team");
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
      <div className="bg-white rounded-xl shadow-sm border border-[#d9d2c7] p-6">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-black">Your Teams</h3>
        </div>

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
                  ? "bg-[#f3e89a]/10 border-[#f3e89a] shadow-sm"
                  : "bg-[#d9d2c7]/10 border-[#d9d2c7] hover:bg-[#d9d2c7]/20"
              }`}
              onClick={() => setSelectedTeam(team)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-[#f3e89a] to-[#efe076] rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-black">{team.name}</h4>
                    <p className="text-sm text-[#d9d2c7]">
                      {team.members.length} member{team.members.length !== 1 ? 's' : ''} • Created {formatDate(team.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {team.ownerId === user?.id && (
                    <span className="px-2 py-1 bg-[#f3e89a] text-black text-xs font-medium rounded-full">
                      Owner
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTeam(team);
                    }}
                    className="text-[#d9d2c7] hover:text-black transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                    </svg>
                  </button>
                  {team.ownerId === user?.id && teams.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete "${team.name}"? This action cannot be undone.`)) {
                          deleteTeam(team._id);
                        }
                      }}
                      className="text-red-400 hover:text-red-600 transition-colors"
                      title="Delete team"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Details */}
      {selectedTeam && (
        <div className="bg-white rounded-xl shadow-sm border border-[#d9d2c7] p-6">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-black">Team Details</h3>
            <span className="text-sm text-[#d9d2c7]">Last updated: {formatDate(selectedTeam.updatedAt)}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Team Info */}
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-medium text-black mb-3">Team Information</h4>
                {editingTeam?._id === selectedTeam._id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editingTeam.name}
                      onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                      className="w-full px-3 py-2 border border-[#d9d2c7] rounded-lg focus:ring-2 focus:ring-[#f3e89a] focus:border-transparent"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={() => updateTeamName(editingTeam._id, editingTeam.name)}
                        disabled={loading}
                        className="bg-[#f3e89a] hover:bg-[#efe076] text-black px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingTeam(null)}
                        className="px-3 py-1 text-[#d9d2c7] hover:text-black text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-black font-medium">{selectedTeam.name}</p>
                    <p className="text-sm text-[#d9d2c7]">Team ID: {selectedTeam._id}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-lg font-medium text-black mb-3">Members</h4>
                <div className="space-y-2">
                  {selectedTeam.members.map((memberId) => (
                                          <div key={memberId} className="flex items-center justify-between p-2 bg-[#d9d2c7]/10 rounded">
                        <span className="text-sm text-black">{memberId}</span>
                        {memberId === selectedTeam.ownerId && (
                          <span className="px-2 py-1 bg-[#f3e89a] text-black text-xs font-medium rounded-full">
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
              <h4 className="text-lg font-medium text-black mb-3">Statistics</h4>
              {teamStats ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[#f3e89a]/10 rounded-lg border border-[#f3e89a]/20">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-[#f3e89a] rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-black">{teamStats.contacts}</p>
                        <p className="text-sm text-[#d9d2c7]">Contacts</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-[#f3e89a]/10 rounded-lg border border-[#f3e89a]/20">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-[#f3e89a] rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-black">{teamStats.accounts}</p>
                        <p className="text-sm text-[#d9d2c7]">Accounts</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-[#f3e89a]/10 rounded-lg border border-[#f3e89a]/20">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-[#f3e89a] rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-black">{teamStats.activities}</p>
                        <p className="text-sm text-[#d9d2c7]">Activities</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-[#f3e89a]/10 rounded-lg border border-[#f3e89a]/20">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-[#f3e89a] rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-black">{teamStats.deals}</p>
                        <p className="text-sm text-[#d9d2c7]">Deals</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#d9d2c7]/10 rounded-lg border border-[#d9d2c7]">
                  <p className="text-[#d9d2c7] text-center">Loading statistics...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 