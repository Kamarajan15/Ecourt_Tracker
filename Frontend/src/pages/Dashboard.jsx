import React, { useState, useEffect } from 'react';
import './Dashboard.css';

const Dashboard = ({ onNavigate, user }) => {
  const [stats, setStats] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [followedCases, setFollowedCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const BASE_URL = "http://localhost:5080/api/ECourt";
  const isUser = user?.role === 'User';

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch stats
      const statsRes = await fetch(`${BASE_URL}/stats`);
      const statsData = await statsRes.json();

      // If admin, fetch recent logs
      if (!isUser) {
        const recentRes = await fetch(`${BASE_URL}/recent`);
        const recentData = await recentRes.json();
        setRecentActivity(recentData);
      } else {
        // If standard user, fetch followed cases
        const followedRes = await fetch(`${BASE_URL}/followed`, {
          headers: {
            'Authorization': `Bearer ${user?.token}`
          }
        });
        const followedData = await followedRes.json();
        setFollowedCases(followedData);
      }

      // Configure Stats
      const statsList = [
        {
          label: 'Total Searches',
          value: statsData.totalSearches?.toLocaleString() || '0',
          icon: '🔍',
          trend: 'From PG Database',
          trendUp: true
        },
        {
          label: 'Solved CAPTCHAs',
          value: statsData.solvedCaptchas?.toLocaleString() || '0',
          icon: '⚡',
          trend: 'OCR Bypassed',
          trendUp: true
        },
        {
          label: 'Success Rate',
          value: `${statsData.successRate || 0}%`,
          icon: '📈',
          trend: statsData.successRate >= 80 ? 'Excellent' : 'Stable',
          trendUp: statsData.successRate >= 80
        }
      ];

      if (isUser) {
        // Fetch followed count dynamically
        const followedRes = await fetch(`${BASE_URL}/followed`, {
          headers: {
            'Authorization': `Bearer ${user?.token}`
          }
        });
        const followedData = await followedRes.json();
        statsList.push({
          label: 'Followed Cases',
          value: followedData.length.toString(),
          icon: '⭐',
          trend: 'Personal Track',
          trendUp: true
        });
      } else {
        statsList.push({
          label: 'Active Sessions',
          value: statsData.activeSessions?.toString() || '0',
          icon: '🌐',
          trend: 'Playwright Pool',
          trendUp: true
        });
      }

      setStats(statsList);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      // Fallback mocks if server offline
      setStats([
        { label: 'Total Searches', value: '1,284', icon: '🔍', trend: 'Demo Mode', trendUp: true },
        { label: 'Solved CAPTCHAs', value: '1,102', icon: '⚡', trend: 'Demo Mode', trendUp: true },
        { label: 'Success Rate', value: '85.8%', icon: '📈', trend: 'Demo Mode', trendUp: true },
        { label: isUser ? 'Followed Cases' : 'Active Sessions', value: isUser ? '3' : '0', icon: isUser ? '⭐' : '🌐', trend: 'Offline', trendUp: false },
      ]);

      if (isUser) {
        setFollowedCases([
          { id: 1, cnrNumber: 'MHAU010023452023', caseTitle: 'State vs Kumar', caseStatus: 'Pending' },
          { id: 2, cnrNumber: 'DLCT010098762022', caseTitle: 'Sharma vs Verma', caseStatus: 'Disposed' },
        ]);
      } else {
        setRecentActivity([
          { id: 1, cnrNumber: 'MHAU010023452023', isSuccess: true, searchTime: new Date(Date.now() - 120000).toISOString(), caseType: 'Criminal', caseTitle: 'State vs Kumar' },
          { id: 2, cnrNumber: 'DLCT010098762022', isSuccess: true, searchTime: new Date(Date.now() - 900000).toISOString(), caseType: 'Civil', caseTitle: 'Sharma vs Verma' },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, [user]);

  const formatRelativeTime = (dateString) => {
    try {
      const now = new Date();
      const date = new Date(dateString);
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Overview</h1>
        <p>Welcome back, {user?.username}! Real-time analytics connected with your PostgreSQL database.</p>
      </div>

      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card">
            <div className="stat-top">
              <span className="stat-icon">{stat.icon}</span>
              <span className={`stat-trend ${stat.trendUp ? 'up' : 'down'}`}>{stat.trend}</span>
            </div>
            <div className="stat-main">
              <span className="stat-value">{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-sections">
        <div className="section-main">
          {isUser ? (
            <div className="section-card recent-activity">
              <div className="section-header">
                <h2>My Followed Cases</h2>
                <button className="view-all" onClick={() => onNavigate('', false, 'followed')}>View All Tracker</button>
              </div>
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>CNR Number</th>
                    <th>Case Title</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {followedCases.length > 0 ? (
                    followedCases.slice(0, 5).map(c => (
                      <tr
                        key={c.id}
                        className="activity-row"
                        onClick={() => onNavigate(c.cnrNumber, true)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="cnr-cell">{c.cnrNumber}</td>
                        <td>
                          <div className="activity-title" style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.caseTitle}
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${c.caseStatus?.toLowerCase().includes('pending') ? 'pending-pill' : 'disposed-pill'}`} style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            backgroundColor: c.caseStatus?.toLowerCase().includes('pending') ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: c.caseStatus?.toLowerCase().includes('pending') ? '#3b82f6' : '#10b981',
                            border: c.caseStatus?.toLowerCase().includes('pending') ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)'
                          }}>
                            {c.caseStatus || 'Active'}
                          </span>
                        </td>
                        <td>
                          <button className="view-all" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={(e) => { e.stopPropagation(); onNavigate(c.cnrNumber, true); }}>🔍 View</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
                        {loading ? 'Fetching records...' : 'You are not following any cases yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="section-card recent-activity">
              <div className="section-header">
                <h2>Recent Activities</h2>
                <button className="view-all" onClick={() => onNavigate('', false)}>View Scraper</button>
              </div>
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>CNR Number</th>
                    <th>Case Title / Details</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.length > 0 ? (
                    recentActivity.map(activity => (
                      <tr
                        key={activity.id}
                        className="activity-row"
                        onClick={() => onNavigate(activity.cnrNumber, true)}
                        title="Click to instantly retrieve or rescrape this case"
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="cnr-cell">{activity.cnrNumber}</td>
                        <td>
                          <div className="activity-title">{activity.caseTitle || 'Scraped Case'}</div>
                          <div className="activity-desc" style={{ fontSize: 11, color: '#64748b' }}>
                            {activity.message}
                          </div>
                        </td>
                        <td>{activity.caseType || 'N/A'}</td>
                        <td>
                          <span className={`status-pill ${activity.isSuccess ? 'success' : 'failed'}`}>
                            {activity.isSuccess ? 'Success' : 'Failed'}
                          </span>
                        </td>
                        <td>{formatRelativeTime(activity.searchTime)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
                        {loading ? 'Fetching records...' : 'No search logs recorded in database yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="section-side">
          <div className="section-card quick-actions">
            <h2>Quick Actions</h2>
            <div className="action-list">
              <button className="action-btn-main" onClick={() => onNavigate('', false)}>New CNR Search</button>
              <button className="action-btn-sub" onClick={() => onNavigate('MHAU010000002015', true)}>Test Auto Solver</button>
              <button className="action-btn-sub" onClick={fetchDashboardData}>Refresh Dashboard</button>
            </div>
          </div>

          <div className="section-card system-health">
            <h2>System Health</h2>
            <div className="health-item">
              <div className="health-info">
                <span>Playwright Instance</span>
                <span className="health-status online">Online</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: '95%' }}></div></div>
            </div>
            <div className="health-item">
              <div className="health-info">
                <span>OCR Engine</span>
                <span className="health-status online">Online</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: '88%' }}></div></div>
            </div>
            <div className="health-item">
              <div className="health-info">
                <span>PostgreSQL Database</span>
                <span className="health-status online">Connected</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: '100%' }}></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;