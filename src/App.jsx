import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Home from './pages/Home'
import Reports from './pages/Reports'
import Team from './pages/Team'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { auth } from './services/auth'
import { tasksApi } from './services/githubRepoClient'

export default function App() {
  const [authState, setAuthState] = useState(auth.getState())
  const [current, setCurrent] = useState('tasks')
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    const unsub = auth.subscribe(setAuthState)
    return () => { if (typeof unsub === 'function') unsub() }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  if (!authState?.token) {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white">
      <Header theme={theme} setTheme={setTheme} />
      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6 px-4 py-6">
        <aside className="col-span-12 md:col-span-3">
          <Sidebar current={current} setCurrent={setCurrent} />
        </aside>
        <main className="col-span-12 md:col-span-9 space-y-6">
          {current === 'tasks' && <Home />}
          {current === 'reports' && <Reports />}
          {current === 'team' && <Team />}
          {current === 'settings' && <Settings />}
        </main>
      </div>
      <footer className="px-4 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Task Tracker
      </footer>
    </div>
  )
}
