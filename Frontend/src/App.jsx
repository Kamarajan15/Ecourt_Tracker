import React, { useState, useEffect } from 'react'
import './App.css'
import CnrNumber from './pages/CnrNumber'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'

function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
  const [activePage, setActivePage] = useState('dashboard')
  const [prefilledCnr, setPrefilledCnr] = useState('')
  const [forceSearchOnLoad, setForceSearchOnLoad] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  const handleNavigateToSearch = (cnr = '', autoSearch = false) => {
    setPrefilledCnr(cnr)
    setForceSearchOnLoad(autoSearch)
    setActivePage('search')
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
    >
      {activePage === 'dashboard' ? (
        <Dashboard onNavigate={handleNavigateToSearch} />
      ) : (
        <CnrNumber 
          prefilledCnr={prefilledCnr} 
          clearPrefill={() => setPrefilledCnr('')}
          forceSearchOnLoad={forceSearchOnLoad}
          clearForceSearch={() => setForceSearchOnLoad(false)}
        />
      )}
    </Layout>
  )
}

export default App
