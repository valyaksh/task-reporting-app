import React, { useMemo, useState } from 'react'
import { User, PencilLine, Trash2, Plus } from 'lucide-react'
import useJsonData from '../hooks/useJsonData'

/**
 * Вкладка «Команда» с CRUD через GitHub (team.json в репозитории)
 * Требуется настроить:
 *  VITE_REPO_PROVIDER=github
 *  VITE_REPO_OWNER=...
 *  VITE_REPO_NAME=...
 *  VITE_REPO_BRANCH=main
 *  VITE_REPO_BASEPATH=public/data
 * А также залогиниться через auth (см. src/services/auth.js), чтобы в localStorage был токен.
 */

export default function Team() {
    const { data, setData, loading, error, pullFromRepo, pushToRepo } = useJsonData('team.json', {
        repoEnabled: true,     // читаем/пишем в репозиторий
        autoPull: true,        // при монтировании подтянем свежие данные
    })

    const [modal, setModal] = useState({ open: false, draft: emptyMember() })
    const list = useMemo(() => Array.isArray(data) ? data : [], [data])

    const onCreate = () => setModal({ open: true, draft: emptyMember() })
    const onEdit = (m) => setModal({ open: true, draft: { ...m } })

    const onDelete = async (m) => {
        if (!confirm(`Удалить сотрудника «${m.name}»?`)) return
        const next = list.filter(x => x.id !== m.id)
        setData(next)
        try {
            await pushToRepo(`chore(team): remove ${m.id}`, next)
        } catch (e) {
            alert('Не удалось удалить в репозитории: ' + (e?.message || e))
            setData(list)
        }
    }

    const onSave = async (draft) => {
        const trimmed = normalizeDraft(draft)
        // существует?
        const exists = list.some(x => x.id === trimmed.id)
        const now = new Date().toISOString()
        let next
        if (exists) {
            next = list.map(x => x.id === trimmed.id ? { ...x, ...trimmed, updatedAt: now } : x)
        } else {
            next = [...list, { ...trimmed, createdAt: now, updatedAt: now }]
        }
        setData(next)
        try {
            await pushToRepo(
                exists
                    ? `chore(team): update ${trimmed.id}`
                    : `feat(team): add ${trimmed.name} (${trimmed.id})`,
                next
            )
            setModal({ open: false, draft: emptyMember() })
        } catch (e) {
            alert('Не удалось сохранить в репозитории: ' + (e?.message || e))
            setData(list)
        }
    }

    return (
        <div className="space-y-4">
            <div className="card flex items-center justify-between">
                <div className="font-semibold text-slate-900 dark:text-white">Команда</div>
                <div className="flex items-center gap-2">
                    <button className="btn" onClick={pullFromRepo} disabled={loading}>Обновить</button>
                    <button className="btn btn-primary flex items-center gap-2" onClick={onCreate}>
                        <Plus size={16}/> Добавить
                    </button>
                </div>
            </div>

            {error && (
                <div className="card border-red-300 text-red-800 dark:text-red-200">
                    Ошибка: {String(error?.message || error)}
                </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map(member => (
                    <div key={member.id} className="card flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-brand-600 text-white grid place-items-center overflow-hidden">
                            {member.avatarUrl ? (
                                <img src={member.avatarUrl} alt={member.name} className="h-12 w-12 object-cover rounded-xl"/>
                            ) : (
                                <User size={22} />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900 dark:text-white truncate">{member.name}</div>
                            <div className="text-sm text-slate-500 truncate">{member.role || '—'}</div>
                            {member.email && <div className="text-sm text-slate-500 truncate">{member.email}</div>}
                        </div>
                        <div className="flex items-center gap-1">
                            <button className="icon-btn" title="Редактировать" onClick={()=>onEdit(member)}>
                                <PencilLine size={18}/>
                            </button>
                            <button className="icon-btn" title="Удалить" onClick={()=>onDelete(member)}>
                                <Trash2 size={18}/>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {modal.open && (
                <EditModal
                    value={modal.draft}
                    onClose={()=>setModal({ open:false, draft: emptyMember() })}
                    onSave={onSave}
                />
            )}
        </div>
    )
}

function emptyMember() {
    return { id: '', name: '', role: '', email: '', avatarUrl: '' }
}

function normalizeDraft(d) {
    const id = (d.id || slugify(d.name)).trim()
    if (!id) throw new Error('Требуется id или имя')
    return { ...d, id, name: d.name?.trim() }
}

function slugify(str = '') {
    return String(str)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-_.]/g, '')
        .replace(/-+/g, '-')
}

function EditModal({ value, onClose, onSave }) {
    const [draft, setDraft] = useState(value)
    const [busy, setBusy] = useState(false)

    const submit = async (e) => {
        e.preventDefault()
        try {
            setBusy(true)
            await onSave(draft)
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-xl">
                <form onSubmit={submit} className="p-4 space-y-3">
                    <div className="text-lg font-semibold">{value?.id ? 'Редактировать' : 'Добавить сотрудника'}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="ID" tip="Уникальный, латиницей. Если пусто — сгенерируется из имени.">
                            <input className="input" value={draft.id || ''} onChange={e=>setDraft(d => ({...d, id: e.target.value}))} placeholder="anna.ivanova"/>
                        </Field>
                        <Field label="Имя">
                            <input className="input" value={draft.name || ''} onChange={e=>setDraft(d => ({...d, name: e.target.value}))} placeholder="Анна Иванова" required/>
                        </Field>
                        <Field label="Роль">
                            <input className="input" value={draft.role || ''} onChange={e=>setDraft(d => ({...d, role: e.target.value}))} placeholder="BI-инженер"/>
                        </Field>
                        <Field label="Email">
                            <input className="input" value={draft.email || ''} onChange={e=>setDraft(d => ({...d, email: e.target.value}))} placeholder="anna@example.com"/>
                        </Field>
                        <Field className="sm:col-span-2" label="Avatar URL" tip="Необязательно">
                            <input className="input" value={draft.avatarUrl || ''} onChange={e=>setDraft(d => ({...d, avatarUrl: e.target.value}))} placeholder="https://.../avatar.png"/>
                        </Field>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" className="btn" onClick={onClose} disabled={busy}>Отмена</button>
                        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить'}</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function Field({ label, tip, className = '', children }) {
    return (
        <label className={`space-y-1 ${className}`}>
            <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <span>{label}</span>
                {tip && <span className="text-xs text-slate-400">{tip}</span>}
            </div>
            {children}
        </label>
    )
}

/*
  Под это ожидается файл team.json в {VITE_REPO_BASEPATH}/team.json, где структура — массив объектов:
  [
    { "id": "anna", "name": "Анна", "role": "Руководитель проектов", "email": "anna@example.com", "avatarUrl": "https://...", "createdAt": "2025-11-01T12:00:00.000Z", "updatedAt": "2025-11-01T12:00:00.000Z" }
  ]
*/
