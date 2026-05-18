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
        <div
          className={`nav-item ${activePage === 'followed' ? 'active' : ''}`}
          onClick={() => onPageChange('followed')}
        >
          <span className="nav-icon">⭐</span>
          <span className="nav-label">Followed Cases</span>
        </div>
      </nav>
    </div>
  );
};

export default Sidebar;
