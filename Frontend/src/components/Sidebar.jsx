import React from 'react';
import './Sidebar.css';

const Sidebar = ({ activePage, onPageChange }) => {
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">🏛️</span>
        <span className="logo-text">eCourt Portal</span>
      </div>
      <nav className="sidebar-nav">
        <div
          className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onPageChange('dashboard')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Dashboard</span>
        </div>
        <div
          className={`nav-item ${activePage === 'search' ? 'active' : ''}`}
          onClick={() => onPageChange('search')}
        >
          <span className="nav-icon">🔍</span>
          <span className="nav-label">CNR Search</span>
        </div>

        {/* <div className="nav-section">MANAGEMENT</div>
        <div className="nav-item">
          <span className="nav-icon">🕒</span>
          <span className="nav-label">Search History</span>
        </div>
        <div className="nav-item">
          <span className="nav-icon">📁</span>
          <span className="nav-label">Saved Cases</span>
        </div>
        
        <div className="nav-section">SYSTEM</div>
        <div className="nav-item">
          <span className="nav-icon">⚙️</span>
          <span className="nav-label">Settings</span>
        </div>
        <div className="nav-item">
          <span className="nav-icon">❓</span>
          <span className="nav-label">Help Center</span>
        </div> */}
      </nav>

      {/* <div className="sidebar-footer">
      </div> */}
    </div>
  );
};

export default Sidebar;
