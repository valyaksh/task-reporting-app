import React, { useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend
} from 'recharts'

/** === helpers: статус → ru/en, неделя ISO, срез последних 6 недель === */
const toUiStatus = (s) =>
    s === 'in_progress'
        ? 'в работе'
        : s === 'done'
            ? 'выполнено'
            : s === 'todo'
                ? 'запланировано'
                : 'запланировано'

const toApiStatus = (s) =>
    s === 'в работе'
        ? 'in_progress'
        : s === 'выполнено'
            ? 'done'
            : s === 'запланировано'
                ? 'todo'
                : s

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return { year: d.getUTCFullYear(), week: weekNo }
}

function fmtWeekLabel(y, w) {
  const ww = String(w).padStart(2, '0')
  return `W${ww}`
}

function lastNWeeksLabels(n = 6) {
  const labels = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i * 7)
    const { year, week } = isoWeek(d)
    labels.push({ year, week, label: fmtWeekLabel(year, week) })
  }
  const map = new Map()
  for (const x of labels) map.set(`${x.year}-${x.week}`, x)
  return Array.from(map.values())
}

/** === основной компонент === */
export default function AnalyticsBlock({ tasks = [] }) {
  const { dataWeekly, dataByStatus } = useMemo(() => {
    const weeks = lastNWeeksLabels(6)
    const createdByKey = new Map(weeks.map(w => [`${w.year}-${w.week}`, 0]))
    const doneByKey = new Map(weeks.map(w => [`${w.year}-${w.week}`, 0]))

    const statusCounts = new Map([
      ['запланировано', 0],
      ['в работе', 0],
      ['выполнено', 0],
    ])

    for (const t of tasks) {
      const rawStatus = (t.status || toApiStatus(t.uiStatus || '') || 'todo').toLowerCase()
      const uiStatus = toUiStatus(rawStatus).toLowerCase()

      statusCounts.set(uiStatus, (statusCounts.get(uiStatus) || 0) + 1)

      if (t.createdAt) {
        const d = new Date(t.createdAt)
        if (!isNaN(d)) {
          const { year, week } = isoWeek(d)
          const k = `${year}-${week}`
          if (createdByKey.has(k)) {
            createdByKey.set(k, (createdByKey.get(k) || 0) + 1)
          }
        }
      }

      if ((rawStatus === 'done' || uiStatus === 'выполнено') && t.updatedAt) {
        const d = new Date(t.updatedAt)
        if (!isNaN(d)) {
          const { year, week } = isoWeek(d)
          const k = `${year}-${week}`
          if (doneByKey.has(k)) {
            doneByKey.set(k, (doneByKey.get(k) || 0) + 1)
          }
        }
      }
    }

    const dataWeekly = weeks.map(w => ({
      week: w.label,
      tasks: createdByKey.get(`${w.year}-${w.week}`) || 0,
      done: doneByKey.get(`${w.year}-${w.week}`) || 0,
    }))

    const dataByStatus = Array.from(statusCounts.entries()).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
    }))

    return { dataWeekly, dataByStatus }
  }, [tasks])

  const hasAny =
      tasks && tasks.length > 0 &&
      (dataWeekly.some(d => d.tasks > 0 || d.done > 0) ||
          dataByStatus.some(d => d.count > 0))

  return (
      <div className="grid lg:grid-cols-3 gap-4">
        {/* === График по неделям === */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-slate-900 dark:text-white">
              Динамика задач по неделям
            </div>
            <span className="text-xs text-slate-500">последние 6 недель</span>
          </div>
          <div className="h-64 mt-3">
            {hasAny ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dataWeekly}>
                    <defs>
                      <linearGradient id="c1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4d9aff" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#4d9aff" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="c2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="week" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Area
                        type="monotone"
                        dataKey="tasks"
                        name="Создано задач"
                        stroke="#4d9aff"
                        fill="url(#c1)"
                    />
                    <Area
                        type="monotone"
                        dataKey="done"
                        name="Завершено"
                        stroke="#10b981"
                        fill="url(#c2)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  Недостаточно данных для графика
                </div>
            )}
          </div>
        </div>

        {/* === Диаграмма по статусам === */}
        <div className="card">
          <div className="font-semibold text-slate-900 dark:text-white">
            Задачи по статусам
          </div>
          <div className="h-64 mt-3">
            {hasAny ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataByStatus}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="status" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="Количество" fill="#4d9aff" />
                  </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  Нет задач для агрегации
                </div>
            )}
          </div>
        </div>
      </div>
  )
}
