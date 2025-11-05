import React, {useCallback, useEffect, useMemo, useState} from 'react'
import useJsonData from '../hooks/useJsonData'
import {reportsApi, teamApi} from '../services/githubRepoClient'
import {motion} from 'framer-motion'

function prevMonthRangeUTC() {
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = now.getUTCMonth() // 0..11 (текущий)
    const prevY = m === 0 ? y - 1 : y
    const prevM = m === 0 ? 11 : m - 1
    const start = new Date(Date.UTC(prevY, prevM, 1))
    const end = new Date(Date.UTC(prevY, prevM + 1, 0))
    const fmt = (d) =>
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    return {start: fmt(start), end: fmt(end)}
}

export default function Reports() {
    const {data: indexData, setData: setIndexData, pushToRepo} = useJsonData('reports/index.json', {autoPull: true})
    const items = useMemo(() => (indexData?.items || []), [indexData])

    const [teamMembers, setTeamMembers] = useState([])
    const [busy, setBusy] = useState(false)
    const [isModalOpen, setModalOpen] = useState(false)

    const [ownerIdSelect, setOwnerIdSelect] = useState('')
    const [ownerFree, setOwnerFree] = useState('')

    const [dateStart, setDateStart] = useState('') // YYYY-MM-DD
    const [dateEnd, setDateEnd] = useState('')     // YYYY-MM-DD
    const [error, setError] = useState('')

    useEffect(() => {
        teamApi.list().then(list => setTeamMembers(Array.isArray(list) ? list : []))
            .catch(() => setTeamMembers([]))
    }, [])

    const openModal = useCallback(() => {
        setError('')
        const r = prevMonthRangeUTC()
        setDateStart(r.start)
        setDateEnd(r.end)
        setOwnerIdSelect('')
        setOwnerFree('')
        setModalOpen(true)
    }, [])

    const closeModal = () => setModalOpen(false)

    const resolveOwnerId = () => {
        if (teamMembers.length > 0) {
            return ownerIdSelect || '—'
        } else {
            const found = ownerFree
                ? teamMembers.find(m => String(m.name).toLowerCase() === String(ownerFree).toLowerCase())
                : null
            return found ? String(found.id) : (ownerFree?.trim() ? ownerFree.trim() : '—')
        }
    }

    const createReport = async () => {
        try {
            setError('')

            if (!dateStart || !dateEnd) {
                setError('Выберите период дат.');
                return
            }
            if (new Date(dateStart) > new Date(dateEnd)) {
                setError('Дата начала позже даты окончания.');
                return
            }

            const ownerId = resolveOwnerId()

            setBusy(true)
            const {summary} = await reportsApi.generateByRange({
                startDate: dateStart,
                endDate: dateEnd,
                ownerId
            })

            const next = {schema: 'v2', items: [summary, ...items.filter(i => i.id !== summary.id)]}
            setIndexData(next)
            await pushToRepo()

            closeModal()
        } catch (e) {
            setError(e?.message || String(e))
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="card">
                <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900 dark:text-white">Отчёты</div>
                    <div className="flex gap-2">
                        <button disabled={busy} onClick={openModal} className="btn btn-primary">
                            {busy ? 'Генерация...' : 'Новый отчёт'}
                        </button>
                    </div>
                </div>
            </div>

            {/* список отчётов */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((r, i) => (
                    <motion.div key={r.id} initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}}
                                transition={{delay: i * 0.05}} className="card">
                        <div className="text-sm text-slate-500">{r.id}</div>
                        <div className="mt-1 font-semibold text-slate-900 dark:text-white">{r.title}</div>
                        <div className="text-xs text-slate-500 mt-1">Создан: {r.createdAt}</div>
                        <div className="text-xs text-slate-500">Владелец: {r.ownerId || '—'}</div>
                        <div className="text-xs text-slate-500 mt-1">
                            Итоги: задач {r.totals?.tasks ?? 0}, выполнено {r.totals?.done ?? 0},
                            просрочено {r.totals?.overdue ?? 0}
                        </div>
                    </motion.div>
                ))}
                {items.length === 0 && (
                    <div className="text-sm text-slate-500">Нет отчётов. Нажмите «Новый отчёт».</div>
                )}
            </div>

            {/* модальное окно */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-xl">
                        <div className="text-lg font-semibold">Создание отчёта</div>
                        <div className="mt-4 space-y-3">

                            <label className="block">
                                <div className="text-xs text-slate-500 mb-1">Кто сгенерировал</div>

                                {teamMembers.length > 0 ? (
                                    <select
                                        className="input w-full"
                                        value={ownerIdSelect}
                                        onChange={e => setOwnerIdSelect(e.target.value)}
                                    >
                                        <option value="">—</option>
                                        {teamMembers.map(m => (
                                            <option key={String(m.id)} value={String(m.id)}>
                                                {m.name}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        className="input w-full"
                                        placeholder="имя/ид, оставьте пустым — будет «—»"
                                        value={ownerFree}
                                        onChange={e => setOwnerFree(e.target.value)}
                                    />
                                )}
                            </label>

                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <div className="text-xs text-slate-500 mb-1">Дата начала</div>
                                    <input
                                        type="date"
                                        className="input w-full"
                                        value={dateStart}
                                        onChange={e => setDateStart(e.target.value)}
                                    />
                                </label>
                                <label className="block">
                                    <div className="text-xs text-slate-500 mb-1">Дата окончания</div>
                                    <input
                                        type="date"
                                        className="input w-full"
                                        value={dateEnd}
                                        onChange={e => setDateEnd(e.target.value)}
                                    />
                                </label>
                            </div>

                            {error && <div className="text-xs text-red-600">{error}</div>}
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                            <button className="btn btn-ghost" onClick={closeModal} disabled={busy}>Отмена</button>
                            <button className="btn btn-primary" onClick={createReport} disabled={busy}>
                                {busy ? 'Генерация...' : 'Сгенерировать'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}