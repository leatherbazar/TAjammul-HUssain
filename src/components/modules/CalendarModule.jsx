import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import toast from 'react-hot-toast'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const EVENT_COLORS = [
  { label: 'Red', value: 'var(--red)', bg: 'rgba(220,38,38,0.2)' },
  { label: 'Blue', value: 'var(--blue)', bg: 'rgba(59,130,246,0.2)' },
  { label: 'Green', value: 'var(--green)', bg: 'rgba(34,197,94,0.2)' },
  { label: 'Amber', value: 'var(--amber)', bg: 'rgba(245,158,11,0.2)' },
  { label: 'Purple', value: 'var(--purple)', bg: 'rgba(168,85,247,0.2)' },
]

export default function CalendarModule() {
  const { data, addRecord, deleteRecord } = useApp()
  const today = new Date()
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', color: 'var(--red)', type: 'event', time: '' })

  const events = data.calendarEvents || []

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const calDays = useMemo(() => {
    const days = []
    // Prev month days
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, month: month - 1, year, other: true })
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, month, year, other: false })
    }
    // Next month
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, month: month + 1, year, other: true })
    }
    return days
  }, [year, month, firstDay, daysInMonth, daysInPrevMonth])

  const getDateKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const getEventsForDay = (y, m, d) => {
    const key = getDateKey(y, m, d)
    return events.filter(e => e.date === key)
  }

  const isToday = (d, m) => d === today.getDate() && m === today.getMonth() && year === today.getFullYear()

  const handleDayClick = (dayObj) => {
    if (dayObj.other) return
    const key = getDateKey(dayObj.year, dayObj.month, dayObj.day)
    setSelectedDate(key)
  }

  const handleAddEvent = () => {
    if (!form.title) { toast.error('Event title required.'); return }
    addRecord('calendarEvents', { ...form, date: selectedDate })
    setForm({ title: '', description: '', color: 'var(--red)', type: 'event', time: '' })
    setShowModal(false)
    toast.success('Event added!')
  }

  const selectedEvents = selectedDate ? getEventsForDay(...selectedDate.split('-').map((v, i) => i === 1 ? parseInt(v) - 1 : parseInt(v))) : []

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>📅 <span>Calendar</span> & Notes</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* Calendar Grid */}
        <div className="section-box">
          {/* Month Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>← Prev</button>
            <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 16, fontWeight: 700 }}>
              {MONTHS[month]} {year}
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>Next →</button>
          </div>

          {/* Day Headers */}
          <div className="calendar-grid">
            {DAYS.map(d => <div key={d} className="cal-header">{d}</div>)}
          </div>

          {/* Day Cells */}
          <div className="calendar-grid" style={{ marginTop: 4 }}>
            {calDays.map((dayObj, i) => {
              const dayEvents = dayObj.other ? [] : getEventsForDay(dayObj.year, dayObj.month, dayObj.day)
              const key = getDateKey(dayObj.year, dayObj.month, dayObj.day)
              const isSelected = selectedDate === key

              return (
                <div
                  key={i}
                  className={`cal-day ${isToday(dayObj.day, dayObj.month) ? 'today' : ''} ${dayObj.other ? 'other-month' : ''} ${dayEvents.length > 0 ? 'has-event' : ''}`}
                  style={{
                    cursor: dayObj.other ? 'default' : 'pointer',
                    background: isSelected ? 'rgba(220,38,38,0.2)' : undefined,
                    borderColor: isSelected ? 'var(--red)' : undefined,
                    flexDirection: 'column',
                    gap: 2,
                    padding: 4,
                    position: 'relative',
                  }}
                  onClick={() => handleDayClick(dayObj)}
                >
                  <span style={{ fontSize: 13, fontWeight: isToday(dayObj.day, dayObj.month) ? 800 : 500 }}>{dayObj.day}</span>
                  {dayEvents.slice(0, 2).map(ev => (
                    <div key={ev.id} style={{ width: '80%', height: 3, borderRadius: 2, background: ev.color || 'var(--red)', marginTop: 1 }} />
                  ))}
                  {dayEvents.length > 2 && <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{dayEvents.length - 2}</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Side Panel */}
        <div>
          {/* Today's stats */}
          <div className="section-box" style={{ marginBottom: 16 }}>
            <div className="section-title">📌 Today</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              {today.toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            {getEventsForDay(today.getFullYear(), today.getMonth(), today.getDate()).length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No events today.</div>
            ) : (
              getEventsForDay(today.getFullYear(), today.getMonth(), today.getDate()).map(ev => (
                <div key={ev.id} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--glass)', border: `1px solid ${ev.color || 'var(--red)'}44`, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: ev.color }}>{ev.title}</div>
                  {ev.time && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🕐 {ev.time}</div>}
                </div>
              ))
            )}
          </div>

          {/* Selected day events */}
          {selectedDate && (
            <div className="section-box">
              <div className="section-title" style={{ justifyContent: 'space-between' }}>
                <span>📅 {selectedDate}</span>
                <button className="btn btn-primary btn-xs" onClick={() => setShowModal(true)}>+ Add</button>
              </div>

              {selectedEvents.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>No events. Click + to add.</div>
              ) : (
                selectedEvents.map(ev => (
                  <div key={ev.id} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--glass)', border: `1px solid ${ev.color || 'var(--red)'}44`, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: ev.color }}>{ev.title}</div>
                        {ev.time && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🕐 {ev.time}</div>}
                        {ev.description && <div style={{ fontSize: 12, marginTop: 4 }}>{ev.description}</div>}
                      </div>
                      <button className="btn btn-danger btn-xs" onClick={() => { deleteRecord('calendarEvents', ev.id); toast.success('Event removed.') }}>✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {!selectedDate && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Click a date to view or add events.
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="section-box" style={{ marginTop: 20 }}>
        <div className="section-title">🔔 Upcoming Events</div>
        {events.filter(e => e.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No upcoming events.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {events.filter(e => e.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10).map(ev => (
              <div key={ev.id} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--glass)', border: `1px solid ${ev.color || 'var(--red)'}33` }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{ev.date} {ev.time && `• ${ev.time}`}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: ev.color }}>{ev.title}</div>
                {ev.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{ev.description.slice(0, 60)}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Event Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📅 Add Event — {selectedDate}</div>
            <div className="input-group" style={{ marginBottom: 12 }}>
              <label className="input-label">Title *</label>
              <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title" autoFocus spellCheck />
            </div>
            <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
              <div className="input-group">
                <label className="input-label">Time</label>
                <input type="time" className="input" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Type</label>
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {['event', 'meeting', 'deadline', 'reminder', 'holiday'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="input-group" style={{ marginBottom: 12 }}>
              <label className="input-label">Description / Notes</label>
              <textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} spellCheck />
            </div>
            <div className="input-group" style={{ marginBottom: 16 }}>
              <label className="input-label">Color</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {EVENT_COLORS.map(c => (
                  <div key={c.value} onClick={() => setForm(f => ({ ...f, color: c.value }))}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c.value, cursor: 'pointer', border: form.color === c.value ? '3px solid white' : '2px solid transparent', boxSizing: 'border-box' }} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary w-full" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary w-full" onClick={handleAddEvent}>Add Event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
