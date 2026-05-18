import React, { useState } from 'react';
import './Topbar.css';

const Topbar = ({ theme, toggleTheme, user, onLogout }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fallback if user details are loading
  const username = user?.username || 'Guest';
  const role = user?.role || 'User';

  const handleToggleDropdown = () => {
    setDropdownOpen(prev => !prev);
  };

  const handleDropdownClick = (e) => {
    e.stopPropagation();
  };

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
        
        <div 
          className="profile-view" 
          onClick={handleToggleDropdown}
          onMouseLeave={() => setDropdownOpen(false)}
        >
          <div className="profile-info">
            <span className="profile-name">{username}</span>
            <span className="profile-role">{role === 'Admin' ? 'Administrator' : 'Standard User'}</span>
          </div>
          <div className="profile-avatar">
            <img 
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${username}&backgroundColor=aa3bff`} 
              alt="User Avatar" 
            />
            <div className="status-indicator"></div>
          </div>
          <span className="dropdown-arrow">▼</span>

          {dropdownOpen && (
            <div className="profile-dropdown" onClick={handleDropdownClick}>
              <div className="dropdown-item user-details">
                <strong>{username}</strong>
                <span>{role === 'Admin' ? 'Admin Access' : 'Standard Access'}</span>
              </div>
              <hr className="dropdown-divider" />
              <button className="dropdown-item logout-btn" onClick={onLogout}>
                🚪 Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Topbar;
