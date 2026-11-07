import { useState } from "react";

export default function CalendarDatePicker({ value, onChange, placeholder = "Choose date" }) {
  const selected = value ? new Date(`${value}T12:00:00`) : new Date();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = view.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  function chooseDay(day) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${year}-${mm}-${dd}`);
    setOpen(false);
  }
  return <div className="calendar-picker">
    <button type="button" className="calendar-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
      <span>{value ? selected.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : placeholder}</span><span aria-hidden="true">▦</span>
    </button>
    {open && <div className="calendar-popover">
      <div className="calendar-header"><button type="button" aria-label="Previous month" onClick={() => setView(new Date(year, month - 1, 1))}>‹</button><strong>{monthLabel}</strong><button type="button" aria-label="Next month" onClick={() => setView(new Date(year, month + 1, 1))}>›</button></div>
      <div className="calendar-grid calendar-weekdays">{['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => <span key={d}>{d}</span>)}</div>
      <div className="calendar-grid">{cells.map((day, i) => day ? <button type="button" key={`${year}-${month}-${day}`} className={value === `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` ? 'selected' : ''} onClick={() => chooseDay(day)}>{day}</button> : <span key={`blank-${i}`} />)}</div>
      <div className="calendar-footer"><button type="button" onClick={() => { const today = new Date(); setView(new Date(today.getFullYear(), today.getMonth(), 1)); chooseDay(today.getDate()); }}>Today</button><button type="button" onClick={() => { onChange(''); setOpen(false); }}>Clear</button></div>
    </div>}
  </div>;
}
