import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {motion, AnimatePresence} from 'framer-motion'
import {clsx} from 'clsx'
import {tasksApi, teamApi} from '../services/githubRepoClient'
import AnalyticsBlock from './AnalyticsBlock'

const toUiStatus = (s) =>
    s === 'in_progress' ? 'в работе'
        : s === 'done' ? 'выполнено'
            : s === 'todo' ? 'запланировано'
                : 'запланировано'

/** ===================== Модалка поверх контента ===================== */
function Modal({open, onClose, children}) {
    useEffect(() => {
        if (!open) return
        const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
        document.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [open, onClose])

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-50"
                    initial={{opacity: 0}}
                    animate={{opacity: 1}}
                    exit={{opacity: 0}}
                >
                    {/* фон-затемнение */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    {/* панель */}
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        className="absolute inset-0 flex items-center justify-center p-4"
                        initial={{opacity: 0, scale: 0.98, y: 10}}
                        animate={{opacity: 1, scale: 1, y: 0}}
                        exit={{opacity: 0, scale: 0.98, y: 10}}
                        transition={{duration: 0.18}}
                    >
                        <div
                            className="w-full max-w-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {children}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

/** ===================== Карточка задачи ===================== */
const Card = React.memo(function Card({t, onEdit}) {
    return (
        <motion.div
            layout="position"
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -10}}
            transition={{duration: 0.18}}
            className="card"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-slate-900 dark:text-white">{t.title}</div>
                <span
                    className={clsx(
                        'badge',
                        t.uiStatus === 'выполнено' && 'badge-green',
                        t.uiStatus === 'в работе' && 'badge-blue',
                        t.uiStatus === 'запланировано' && 'badge-gray'
                    )}
                >
          {t.uiStatus}
        </span>
            </div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Исполнитель: {t.assigneeName ?? '—'}
            </div>
            {t.due && <div className="mt-1 text-xs text-slate-500">Срок: {t.due}</div>}
            <div className="mt-3 flex gap-2">
                <button className="btn btn-ghost text-xs">Подробнее</button>
                <button onClick={() => onEdit(t)} className="btn btn-primary text-xs">Изменить</button>
            </div>
        </motion.div>
    )
})

/** ===================== Редактор (контент модалки) ===================== */
const TaskEditor = React.memo(function TaskEditor({
                                                      draft, setDraft, teamMembers, isNew, onCancel, onSave,
                                                  }) {
    return (
        <div className="card">
            <div className="flex items-start justify-between">
                <div className="font-semibold text-slate-900 dark:text-white">
                    {isNew ? 'Новая задача' : 'Редактирование задачи'}
                </div>
                <button className="btn btn-ghost" onClick={onCancel}>Закрыть</button>
            </div>

            <div className="grid gap-3 mt-3">
                <div>
                    <label className="text-xs text-slate-500">Название *</label>
                    <input
                        value={draft.title}
                        onChange={e => setDraft(d => ({...d, title: e.target.value}))}
                        className="mt-1 w-full rounded-xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 dark:caret-white"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-slate-500">Исполнитель</label>
                        {teamMembers?.length ? (
                            <select
                                value={draft.assigneeId || ''}
                                onChange={e => {
                                    const id = e.target.value || undefined
                                    const member = teamMembers.find(m => String(m.id) === id)
                                    setDraft(d => ({...d, assigneeId: id, assigneeName: member?.name || ''}))
                                }}
                                className="mt-1 w-full rounded-xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 px-3 py-2 text-slate-900 dark:text-white dark:caret-white"
                            >
                                <option value="">—</option>
                                {teamMembers.map(m => (<option key={m.id} value={String(m.id)}>{m.name}</option>))}
                            </select>
                        ) : (
                            <input
                                value={draft.assigneeName || ''}
                                onChange={e => setDraft(d => ({...d, assigneeName: e.target.value}))}
                                className="mt-1 w-full rounded-xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 dark:caret-white"
                            />
                        )}
                    </div>

                    <div>
                        <label className="text-xs text-slate-500">Статус</label>
                        <select
                            value={draft.status}
                            onChange={e => setDraft(d => ({...d, status: e.target.value}))}
                            className="mt-1 w-full rounded-xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 px-3 py-2 text-slate-900 dark:text-white dark:caret-white"
                        >
                            <option>запланировано</option>
                            <option>в работе</option>
                            <option>выполнено</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-slate-500">Приоритет</label>
                        <select
                            value={draft.priority}
                            onChange={e => setDraft(d => ({...d, priority: e.target.value}))}
                            className="mt-1 w-full rounded-xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 px-3 py-2 text-slate-900 dark:text-white dark:caret-white"
                        >
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500">Срок</label>
                        <input
                            type="date"
                            value={draft.due || ''}
                            onChange={e => setDraft(d => ({...d, due: e.target.value}))}
                            className="mt-1 w-full rounded-xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 dark:caret-white"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs text-slate-500">Описание</label>
                    <textarea
                        rows={4}
                        value={draft.description}
                        onChange={e => setDraft(d => ({...d, description: e.target.value}))}
                        className="mt-1 w-full rounded-xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 dark:caret-white"
                    />
                </div>

                <div className="mt-2 flex justify-end gap-2">
                    <button className="btn btn-ghost" onClick={onCancel}>Отмена</button>
                    <button className="btn btn-primary" onClick={onSave}>{isNew ? 'Создать' : 'Сохранить'}</button>
                </div>
            </div>
        </div>
    )
})

/** ===================== Доска ===================== */
export default function TaskBoard() {
    const [q, setQ] = useState('')
    const [owner, setOwner] = useState('Все')
    const [teamMembers, setTeamMembers] = useState([])

    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [editorOpen, setEditorOpen] = useState(false)
    const [draft, setDraft] = useState({
        id: '',
        title: '',
        assigneeName: '',
        assigneeId: undefined,
        status: 'запланировано',
        priority: 'medium',
        due: '',
        description: '',
        __existing: false,
    })
    const isNew = !draft.__existing

    const openNew = useCallback(() => {
        setDraft({
            id: '',
            title: '',
            assigneeName: '',
            assigneeId: undefined,
            status: 'запланировано',
            priority: 'medium',
            due: '',
            description: '',
            __existing: false,
        })
        setEditorOpen(true)
    }, [])

    const openEdit = useCallback((task) => {
        setDraft({
            id: task.id,
            title: task.title ?? '',
            assigneeName: task.assigneeName ?? '',
            assigneeId: task.assigneeId,
            status: task.uiStatus ?? toUiStatus(task.status),
            priority: task.priority ?? 'medium',
            due: task.due ?? '',
            description: task.description ?? '',
            __existing: true,
        })
        setEditorOpen(true)
    }, [])

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [raw, teamRaw] = await Promise.all([
                tasksApi.list(),
                teamApi.list().catch(() => []),
            ])
            const rawTasks = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : [])
            const team = Array.isArray(teamRaw) ? teamRaw : []
            setTeamMembers(team)

            const membersById = new Map(team.map(m => [String(m.id), m.name]))
            const view = rawTasks.map(t => {
                const aId = t.assigneeId != null ? String(t.assigneeId) : undefined
                return {
                    ...t,
                    assigneeId: aId,
                    assigneeName: aId ? membersById.get(aId) : (t.assignee ?? undefined),
                    uiStatus: toUiStatus(t.status),
                }
            })
            setTasks(view)
        } catch (e) {
            setError(e?.message || String(e))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const toViewItem = useCallback((t) => {
        const membersById = new Map(teamMembers.map(m => [String(m.id), m.name]))
        const aId = t.assigneeId != null ? String(t.assigneeId) : undefined
        return {
            ...t,
            assigneeId: aId,
            assigneeName: aId ? membersById.get(aId) : (t.assignee ?? undefined),
            uiStatus: toUiStatus(t.status),
        }
    }, [teamMembers])

    const owners = useMemo(
        () => ['Все', ...Array.from(new Set(tasks.map(t => t.assigneeName).filter(Boolean)))],
        [tasks]
    )

    useEffect(() => {
        if (!owners.includes(owner)) setOwner('Все')
    }, [owners.join('|')])

    const filtered = useMemo(
        () => tasks.filter(t =>
            (owner === 'Все' || t.assigneeName === owner) &&
            (
                (t.title || '').toLowerCase().includes(q.toLowerCase()) ||
                (t.assigneeName ?? '').toLowerCase().includes(q.toLowerCase())
            )
        ),
        [tasks, owner, q]
    )

    const columns = useMemo(() => {
        const by = {
            'запланировано': [],
            'в работе': [],
            'выполнено': [],
        }
        for (const t of filtered) {
            const k = t.uiStatus || 'запланировано'
            if (by[k]) by[k].push(t)
            else by['запланировано'].push(t)
        }
        return by
    }, [filtered])

    const saveDraft = useCallback(async () => {
        if (!draft.title.trim()) {
            alert('Укажите название задачи')
            return
        }
        let assigneeId = draft.assigneeId
        if (!assigneeId && draft.assigneeName && teamMembers?.length) {
            const found = teamMembers.find(m => (m.name || '').toLowerCase() === draft.assigneeName.toLowerCase())
            if (found) assigneeId = String(found.id)
        }

        const payload = {
            title: draft.title.trim(),
            assigneeId,
            assignee: !assigneeId ? (draft.assigneeName || undefined) : undefined,
            status:
                draft.status === 'в работе' ? 'in_progress'
                    : draft.status === 'выполнено' ? 'done'
                        : 'todo',
            priority: draft.priority,
            due: draft.due || undefined,
            description: draft.description || undefined,
        }

        try {
            if (draft.__existing) {
                const updated = await tasksApi.update(draft.id, payload)
                setTasks(prev => prev.map(x => x.id === draft.id ? toViewItem(updated) : x))
            } else {
                const created = await tasksApi.create(payload)
                setTasks(prev => [toViewItem(created), ...prev])
            }
            window.dispatchEvent(new CustomEvent('tasks:changed'))
            setEditorOpen(false)
        } catch (e) {
            alert('Не удалось сохранить: ' + (e?.message || e))
        }
    }, [draft, teamMembers, toViewItem])

    if (loading) {
        return (
            <div className="card">
                <div className="animate-pulse text-slate-500">Загружаю задачи из GitHub…</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="card">
                <div className="text-red-600 dark:text-red-400 mb-2">Ошибка загрузки: {error}</div>
                <button onClick={load} className="btn btn-primary">Повторить</button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Панель фильтров */}
            <div className="card">
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                    <div className="flex-1">
                        <label className="text-xs text-slate-500">Поиск</label>
                        <input
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder="Название задачи, исполнитель..."
                            className="w-full mt-1 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-800/60 px-3 py-2 focus:ring-brand-400 focus:outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 dark:caret-white"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500">Исполнитель</label>
                        <select
                            value={owner}
                            onChange={e => setOwner(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 px-3 py-2 text-slate-900 dark:text-white dark:caret-white"
                        >
                            {owners.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                    <button onClick={openNew} className="btn btn-primary">Добавить задачу</button>
                </div>
            </div>

            {/* Доска: три колонки */}
            <div className="grid gap-4 md:grid-cols-3">
                {[
                    {key: 'запланировано', title: 'Запланировано'},
                    {key: 'в работе', title: 'В работе'},
                    {key: 'выполнено', title: 'Выполнено'},
                ].map(col => (
                    <div key={col.key} className="space-y-3">
                        <div className="sticky top-0 z-10 bg-transparent">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{col.title}</h3>
                        </div>
                        <AnimatePresence initial={false}>
                            {columns[col.key].length === 0 ? (
                                <motion.div
                                    layout
                                    className="card"
                                    initial={{opacity: 0}}
                                    animate={{opacity: 0.6}}
                                    exit={{opacity: 0}}
                                >
                                    <div className="text-sm text-slate-500">Пусто</div>
                                </motion.div>
                            ) : (
                                columns[col.key].map(t => (
                                    <Card key={t.id} t={t} onEdit={openEdit}/>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>

            {/* Аналитика по задачам */}
            <AnalyticsBlock tasks={tasks} />

            {/* Модалка с редактором */}
            <Modal open={editorOpen} onClose={() => setEditorOpen(false)}>
                <TaskEditor
                    draft={draft}
                    setDraft={setDraft}
                    teamMembers={teamMembers}
                    isNew={isNew}
                    onCancel={() => setEditorOpen(false)}
                    onSave={saveDraft}
                />
            </Modal>
        </div>
    )
}
