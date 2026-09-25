import * as React from "react";
import { useState, useEffect } from "react";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

/**
 * DateTimePicker — substitui <input type='datetime-local'>
 * value: string ISO 'YYYY-MM-DDTHH:mm' (mesmo formato do datetime-local)
 * onChange: (isoString) => void
 */
export function DateTimePicker({ value, onChange, className, placeholder = "Selecionar data e hora" }) {
  const [open, setOpen]       = useState(false);
  const [tab, setTab]         = useState('date'); // 'date' | 'time'
  const [selectedDate, setSelectedDate] = useState(null);
  const [hours, setHours]     = useState('08');
  const [minutes, setMinutes] = useState('00');

  // Sincronizar com valor externo
  useEffect(() => {
    if (!value) { setSelectedDate(null); return; }
    try {
      const d = parseISO(value);
      if (isValid(d)) {
        setSelectedDate(d);
        setHours(String(d.getHours()).padStart(2, '0'));
        setMinutes(String(d.getMinutes()).padStart(2, '0'));
      }
    } catch {}
  }, [value]);

  const emitChange = (date, h, m) => {
    if (!date) return;
    const d = new Date(date);
    d.setHours(Number(h), Number(m), 0, 0);
    onChange(format(d, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleDaySelect = (day) => {
    if (!day) return;
    setSelectedDate(day);
    emitChange(day, hours, minutes);
    setTab('time');
  };

  const handleHours = (h) => {
    const clamped = String(Math.max(0, Math.min(23, Number(h)))).padStart(2, '0');
    setHours(clamped);
    if (selectedDate) emitChange(selectedDate, clamped, minutes);
  };

  const handleMinutes = (m) => {
    const clamped = String(Math.max(0, Math.min(59, Number(m)))).padStart(2, '0');
    setMinutes(clamped);
    if (selectedDate) emitChange(selectedDate, hours, clamped);
  };

  const displayValue = selectedDate && isValid(selectedDate)
    ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) + '  ·  ' + hours + ':' + minutes
    : null;

  const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-all",
            "bg-slate-800/60 border border-slate-700/60 hover:border-amber-500/40",
            "focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20",
            !displayValue && "text-slate-500",
            displayValue && "text-white",
            className
          )}
        >
          <CalendarIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="flex-1 text-left">{displayValue || placeholder}</span>
          <Clock className="w-3 h-3 text-slate-500 flex-shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0 bg-slate-900 border border-slate-700 shadow-2xl shadow-black/60 rounded-xl overflow-hidden"
        align="start"
        side="bottom"
      >
        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            type="button"
            onClick={() => setTab('date')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all",
              tab === 'date'
                ? "text-amber-400 border-b-2 border-amber-400 bg-amber-500/5"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            Data
          </button>
          <button
            type="button"
            onClick={() => setTab('time')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all",
              tab === 'time'
                ? "text-amber-400 border-b-2 border-amber-400 bg-amber-500/5"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            Hora
          </button>
        </div>

        {/* Data */}
        {tab === 'date' && (
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDaySelect}
            locale={ptBR}
            disabled={{ before: new Date() }}
            initialFocus
            classNames={{
              months: "p-3",
              caption: "flex justify-center pt-1 relative items-center mb-2",
              caption_label: "text-sm font-semibold text-white",
              nav_button: "h-7 w-7 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 flex items-center justify-center transition-all",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse",
              head_row: "flex mb-1",
              head_cell: "text-slate-500 rounded w-8 font-normal text-[11px] flex items-center justify-center",
              row: "flex w-full",
              cell: "relative p-0 text-center",
              day: "h-8 w-8 p-0 font-normal text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-all text-sm flex items-center justify-center",
              day_selected: "bg-amber-500 text-black font-bold hover:bg-amber-400 rounded-lg",
              day_today: "border border-amber-500/40 text-amber-300",
              day_outside: "text-slate-600 opacity-50",
              day_disabled: "text-slate-700 opacity-30 cursor-not-allowed",
            }}
          />
        )}

        {/* Hora */}
        {tab === 'time' && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-center gap-3">
              {/* Horas */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Hora</span>
                <div className="h-36 w-16 overflow-y-auto scroll-smooth rounded-lg bg-slate-800 border border-slate-700"
                  style={{ scrollbarWidth: 'none' }}>
                  {HOURS.map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHours(h)}
                      className={cn(
                        "w-full h-9 text-sm font-mono transition-all",
                        hours === h
                          ? "bg-amber-500 text-black font-bold"
                          : "text-slate-300 hover:bg-slate-700"
                      )}
                    >{h}</button>
                  ))}
                </div>
              </div>

              <span className="text-2xl font-bold text-slate-400 mb-1">:</span>

              {/* Minutos */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Min</span>
                <div className="h-36 w-16 overflow-y-auto scroll-smooth rounded-lg bg-slate-800 border border-slate-700"
                  style={{ scrollbarWidth: 'none' }}>
                  {MINUTES.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMinutes(m)}
                      className={cn(
                        "w-full h-9 text-sm font-mono transition-all",
                        minutes === m
                          ? "bg-amber-500 text-black font-bold"
                          : "text-slate-300 hover:bg-slate-700"
                      )}
                    >{m}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-500">
                {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : '—'}
              </span>
              <span className="text-sm font-mono font-bold text-amber-400">{hours}:{minutes}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}