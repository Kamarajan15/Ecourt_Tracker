import React from 'react';
import './Topbar.css';

const Topbar = ({ theme, toggleTheme }) => {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <h2 className="page-title">Case Information Retrieval System</h2>
      </div>
      <div className="topbar-right">
        <div className="topbar-actions">
          <button 
            className="action-btn theme-toggle" 
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        
        <div className="profile-view">
          <div className="profile-info">
            <span className="profile-name">Admin Dashboard</span>
            <span className="profile-role">Supreme Access</span>
          </div>
          <div className="profile-avatar">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User Avatar" />
            <div className="status-indicator"></div>
          </div>
          <span className="dropdown-arrow">▼</span>
        </div>
      </div>
    </div>
  );
};

export default Topbar;
