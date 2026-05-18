import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import './Layout.css';

const Layout = ({ children, theme, toggleTheme, activePage, onPageChange }) => {
  return (
    <div className="layout">
      <Sidebar activePage={activePage} onPageChange={onPageChange} />
      <div className="main-container">
        <Topbar theme={theme} toggleTheme={toggleTheme} />
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
