import React, { useState, useEffect } from 'react';
import './FollowedCases.css';

const FollowedCases = ({ onNavigate, user }) => {
  const [followedCases, setFollowedCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const BASE_URL = 'http://localhost:5080/api/ECourt';

  const fetchFollowedCases = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${BASE_URL}/followed`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to retrieve followed cases.');
      }
      const data = await response.json();
      setFollowedCases(data);
    } catch (err) {
      console.error('Error fetching followed cases:', err);
      setError(err.message || 'Error loading followed cases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowedCases();
  }, [user]);

  const handleUnfollow = async (e, cnrNumber) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to stop following case ${cnrNumber}?`)) {
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/unfollow/${cnrNumber}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to unfollow case.');
      }

      setFollowedCases(prev => prev.filter(c => c.cnrNumber !== cnrNumber));
    } catch (err) {
      console.error('Error unfollowing case:', err);
      alert(err.message || 'Failed to unfollow case. Please try again.');
    }
  };

  const getStatusClass = (status) => {
    if (!status) return 'default';
    const lower = status.toLowerCase();
    if (lower.includes('pending') || lower.includes('hearing')) return 'pending';
    if (lower.includes('disposed') || lower.includes('decided')) return 'disposed';
    return 'default';
  };

  if (loading) {
    return (
      <div className="followed-loading">
        <span className="spinner" style={{ borderTopColor: 'var(--accent)', width: 24, height: 24 }}></span>
        <p>Loading your tracked cases...</p>
      </div>
    );
  }

  return (
    <div className="followed-cases-page">
      <div className="followed-header">
        <h1>Followed Case Records</h1>
        <p>Real-time tracked and followed case details tailored to your workspace profile.</p>
      </div>

      {error && <div className="error-message" style={{ margin: '12px 0' }}>⚠️ {error}</div>}

      {!error && followedCases.length === 0 ? (
        <div className="followed-empty">
          <div className="empty-star-icon">⭐</div>
          <h2>No Tracked Cases Yet</h2>
          <p>Start tracking court records by searching case CNR Numbers on the portal and clicking "Follow Case" to keep them here for quick access!</p>
          <button className="btn-start-search" onClick={() => onNavigate('', false)}>
            🔍 Start CNR Search
          </button>
        </div>
      ) : (
        <div className="followed-grid">
          {followedCases.map((c) => (
            <div key={c.id} className="followed-card" onClick={() => onNavigate(c.cnrNumber, true)}>
              <div className="followed-card-top">
                <span className="followed-cnr">{c.cnrNumber}</span>
                <span className={`followed-status ${getStatusClass(c.caseStatus)}`}>
                  {c.caseStatus || 'Active'}
                </span>
              </div>
              <h3 className="followed-title" title={c.caseTitle}>{c.caseTitle}</h3>
              <div className="followed-actions">
                <button className="btn-view-case" onClick={() => onNavigate(c.cnrNumber, true)}>
                  🔍 View Case
                </button>
                <button className="btn-unfollow" onClick={(e) => handleUnfollow(e, c.cnrNumber)} title="Unfollow this case">
                  🗑️ Unfollow
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FollowedCases;
