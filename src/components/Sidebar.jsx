import React from 'react'
import { ClipboardList, BarChart3, Users, Settings } from 'lucide-react'

const NavItem = ({ icon:Icon, label, active=false, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition 
      ${active ? 'bg-brand-600 text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'}`}
  >
    <Icon size={18} />
    <span className="text-sm font-medium">{label}</span>
  </button>
)

export default function Sidebar({ current, setCurrent }) {
  return (
    <aside className="hidden md:flex md:flex-col gap-2 w-64 p-4">
      <div className="card">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-brand-600 text-white grid place-items-center font-bold">SR</div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-white">Task Tracker</div>
            <div className="text-xs text-slate-500"></div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <NavItem icon={ClipboardList} label="Задачи" active={current==='tasks'} onClick={()=>setCurrent('tasks')} />
          <NavItem icon={BarChart3} label="Отчётность" active={current==='reports'} onClick={()=>setCurrent('reports')} />
          <NavItem icon={Users} label="Команда" active={current==='team'} onClick={()=>setCurrent('team')} />
        </div>
      </div>
    {/*  <div className="mt-2 p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
        <div className="text-sm font-medium">Подсказка</div>
        <div className="text-xs mt-1">Фильтруйте задачи по статусу и исполнителю, чтобы быстро находить нужное.</div>
      </div>*/}
    </aside>
  )
}
