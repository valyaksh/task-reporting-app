
import React, { useState } from 'react'
import { auth } from '../services/auth'

export default function Login() {
  const provider = 'github'
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await auth.login({ provider, token })
      // page will re-render via auth subscription in App
    } catch (e) {
      setError(e.message || 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-900 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Вход</h1>
        <div>
        </div>
        <div>
          <label className="text-xs text-slate-500">Персональный токен GitHub</label>
          <input className="input mt-1 w-full" type="password" placeholder="вставьте токен"
            value={token} onChange={e=>setToken(e.target.value)} />
          <p className="text-xs text-slate-500 mt-1">
            Токен хранится только в локальном хранилище вашего браузера.
          </p>
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <button className="btn btn-primary w-full" type="submit" disabled={loading}>
          {loading ? 'Проверяем…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
