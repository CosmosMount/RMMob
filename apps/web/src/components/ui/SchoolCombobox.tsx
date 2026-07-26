"use client";

import { SchoolCrest } from "@/components/match/SchoolCrest";
import { api } from "@/lib/api";
import { useEffect, useId, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (school: string) => void;
  placeholder?: string;
  /** Allow clearing selection */
  allowClear?: boolean;
  className?: string;
  /** Custom school list (e.g. ranking schools for a robot type). */
  loadOptions?: (query: string) => Promise<string[]>;
};

/**
 * Searchable school picker: type to filter, pick from dropdown.
 */
export function SchoolCombobox({
  value,
  onChange,
  placeholder = "Search school…",
  allowClear = true,
  className,
  loadOptions,
}: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = window.setTimeout(() => {
      const q = query.trim();
      const req = loadOptions
        ? loadOptions(q)
        : api.schools({ q: q || undefined, limit: 40 }).then((r) => r.items);
      req
        .then(setItems)
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 160);
    return () => clearTimeout(t);
  }, [query, open, loadOptions]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(school: string) {
    onChange(school);
    setQuery(school);
    setOpen(false);
  }

  function clear() {
    onChange("");
    setQuery("");
    setOpen(true);
  }

  return (
    <div className={`school-combo ${className || ""}`} ref={rootRef}>
      <div className="school-combo-field">
        <input
          id={id}
          className="input"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && items[0]) {
              e.preventDefault();
              pick(items[0]);
            }
          }}
          autoComplete="off"
        />
        {allowClear && value ? (
          <button type="button" className="school-combo-clear" onClick={clear} aria-label="Clear">
            ×
          </button>
        ) : null}
      </div>
      {open && (
        <ul id={`${id}-list`} className="school-combo-list" role="listbox">
          {loading && <li className="school-combo-empty muted">Loading…</li>}
          {!loading && !items.length && (
            <li className="school-combo-empty muted">No schools</li>
          )}
          {!loading &&
            items.map((s) => (
              <li key={s} role="option" aria-selected={s === value}>
                <button type="button" className="school-combo-option" onClick={() => pick(s)}>
                  <SchoolCrest school={s} size={24} />
                  <span>{s}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
