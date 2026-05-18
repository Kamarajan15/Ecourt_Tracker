import React, { useState, useEffect } from 'react'
import './App.css'
import CnrNumber from './pages/CnrNumber'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import FollowedCases from './pages/FollowedCases'

function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
  const [activePage, setActivePage] = useState('dashboard')
  const [prefilledCnr, setPrefilledCnr] = useState('')
  const [forceSearchOnLoad, setForceSearchOnLoad] = useState(false)
  const [user, setUser] = useState(() => {
    const cachedUser = localStorage.getItem('user');
    return cachedUser ? JSON.parse(cachedUser) : null;
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  const handleNavigateToSearch = (cnr = '', autoSearch = false, targetPage = 'search') => {
    if (targetPage === 'followed') {
      setActivePage('followed');
    } else {
      setPrefilledCnr(cnr)
      setForceSearchOnLoad(autoSearch)
      setActivePage('search')
    }
  }

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  // If user is not authenticated, show the Login/Register Page
  if (!user) {
    return (
      <Login 
        theme={theme} 
        toggleTheme={toggleTheme} 
        onLoginSuccess={handleLoginSuccess} 
      />
    );
  }

  return (
    <Layout 
      theme={theme} 
      toggleTheme={toggleTheme}
      activePage={activePage}
      onPageChange={(page) => {
        if (page === 'search') {
          // If clicked from sidebar nav directly, clear prefill
          setPrefilledCnr('');
          setForceSearchOnLoad(false);
        }
        setActivePage(page);
      }}
      user={user}
      onLogout={handleLogout}
    >
      {activePage === 'dashboard' ? (
        <Dashboard onNavigate={handleNavigateToSearch} user={user} />
      ) : activePage === 'search' ? (
        <CnrNumber 
          prefilledCnr={prefilledCnr} 
          clearPrefill={() => setPrefilledCnr('')}
          forceSearchOnLoad={forceSearchOnLoad}
          clearForceSearch={() => setForceSearchOnLoad(false)}
          user={user}
        />
      ) : (
        <FollowedCases onNavigate={handleNavigateToSearch} user={user} />
      )}
    </Layout>
  )
}

export default App
