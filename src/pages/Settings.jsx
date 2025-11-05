import React, { useState } from 'react'

export default function Settings() {
  const [email, setEmail] = useState('user@company.com')
  const [notify, setNotify] = useState(true)

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="font-semibold text-slate-900 dark:text-white">Настройки</div>
        <div className="grid md:grid-cols-2 gap-4 mt-3">
          <div>
            <label className="text-xs text-slate-500">E-mail</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} className="w-full mt-1 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-800/60 px-3 py-2 focus:ring-brand-400 focus:outline-none" />
          </div>
          <div className="flex items-end gap-3">
            <label className="text-xs text-slate-500">Уведомления</label>
            <div className="flex items-center gap-2">
              <input id="notify" type="checkbox" checked={notify} onChange={e=>setNotify(e.target.checked)} className="rounded border-slate-300 text-brand-600 focus:ring-brand-400" />
              <label htmlFor="notify" className="text-sm">Получать уведомления о задачах</label>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <button className="btn btn-primary">Сохранить</button>
        </div>
      </div>
      <div className="card">
        <div className="font-semibold text-slate-900 dark:text-white">Экспорт / Импорт</div>
        <div className="text-sm text-slate-500 mt-2">Здесь может быть импорт из Excel/CSV и интеграции.</div>
        <div className="mt-3 flex gap-2">
          <button className="btn btn-ghost">Импорт</button>
          <button className="btn btn-primary">Экспорт</button>
        </div>
      </div>
    </div>
  )
}
