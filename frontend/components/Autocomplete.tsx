"use client";
import { useEffect, useRef, useState } from "react";

export default function Autocomplete({
  placeholder,
  value,
  onChange,
  fetcher,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  fetcher: (q: string) => Promise<string[]>;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const debounce = useRef<number | null>(null);

  useEffect(() => {
    if (!value) {
      setItems([]);
      return;
    }
    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      try {
        setItems(await fetcher(value));
      } catch {
        setItems([]);
      }
    }, 200);
  }, [value, fetcher]);

  return (
    <div className="relative w-full">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="input"
      />
      {open && items.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-soft max-h-60 overflow-auto animate-fade-in">
          {items.map((s) => (
            <li
              key={s}
              onMouseDown={() => {
                onChange(s);
                setOpen(false);
              }}
              className="px-4 py-2.5 cursor-pointer hover:bg-brand/5 hover:text-brand text-sm transition first:rounded-t-xl last:rounded-b-xl"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
