import React from 'react'
import { Moon, Sun, Search, Bell, LogOut } from 'lucide-react'
import { auth } from '../services/auth'

export default function Header({ theme, setTheme }) {
  return (
    <header className="sticky top-0 z-20 backdrop-blur bg-white/70 dark:bg-slate-900/60 border-b border-white/40 dark:border-white/10">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="md:hidden flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-brand-600 text-white grid place-items-center font-bold">SR</div>
          <div className="font-semibold text-slate-900 dark:text-white">Reports & Tasks</div>
        </div>
        <div className="flex-1 max-w-xl relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input placeholder="Поиск по задачам и отчётам..." className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-white/40 dark:border-white/10 text-sm focus:ring-brand-400 focus:outline-none" />
        </div>
        <button onClick={()=>auth.logout()} className="ml-auto inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
          <LogOut size={16}/> Выход
        </button>
      </div>
    </header>
  )
}
