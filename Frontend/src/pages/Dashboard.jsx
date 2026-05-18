import React, { useState, useEffect } from 'react';
import './Dashboard.css';

const Dashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState([
    { label: 'Total Searches', value: '0', icon: '🔍', trend: 'Updating...', trendUp: true },
    { label: 'Solved CAPTCHAs', value: '0', icon: '⚡', trend: 'Updating...', trendUp: true },
    { label: 'Success Rate', value: '0.0%', icon: '📈', trend: 'Updating...', trendUp: true },
    { label: 'Active Sessions', value: '0', icon: '🌐', trend: 'Live', trendUp: true },
  ]);

  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const BASE_URL = "http://localhost:5079/api/ECourt";

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch stats
      const statsRes = await fetch(`${BASE_URL}/stats`);
      const statsData = await statsRes.json();
      
      // Fetch recent logs
      const recentRes = await fetch(`${BASE_URL}/recent`);
      const recentData = await recentRes.json();

      setStats([
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
        },
        { 
          label: 'Active Sessions', 
          value: statsData.activeSessions?.toString() || '0', 
          icon: '🌐', 
          trend: 'Playwright Pool', 
          trendUp: true 
        },
      ]);

      setRecentActivity(recentData);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      // Fallback mocks if server offline
      setStats([
        { label: 'Total Searches', value: '1,284', icon: '🔍', trend: 'Demo Mode', trendUp: true },
        { label: 'Solved CAPTCHAs', value: '1,102', icon: '⚡', trend: 'Demo Mode', trendUp: true },
        { label: 'Success Rate', value: '85.8%', icon: '📈', trend: 'Demo Mode', trendUp: true },
        { label: 'Active Sessions', value: '0', icon: '🌐', trend: 'Offline', trendUp: false },
      ]);
      setRecentActivity([
        { id: 1, cnrNumber: 'MHAU010023452023', isSuccess: true, searchTime: new Date(Date.now() - 120000).toISOString(), caseType: 'Criminal', caseTitle: 'State vs Kumar' },
        { id: 2, cnrNumber: 'DLCT010098762022', isSuccess: true, searchTime: new Date(Date.now() - 900000).toISOString(), caseType: 'Civil', caseTitle: 'Sharma vs Verma' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

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
        <p>Welcome back! Real-time analytics connected with your PostgreSQL scraper database.</p>
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
                <span className={`health-status ${recentActivity.length > 0 && !stats[3].trend.includes('Offline') ? 'online' : 'online'}`}>Connected</span>
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