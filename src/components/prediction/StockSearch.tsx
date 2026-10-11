"use client";

import { useDeferredValue, useId, useState } from "react";
import { Search } from "lucide-react";
import { useStockSearch } from "@/lib/hooks/use-prediction";

export interface StockOption {
  symbol: string;
  name: string;
  exchange: string;
}

export function StockSearch({
  value,
  onChange,
  disabled = false,
}: {
  value: StockOption | null;
  onChange: (stock: StockOption | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const deferredQuery = useDeferredValue(query);
  const search = useStockSearch(deferredQuery);
  const awaitingQuery = query.trim() !== deferredQuery.trim();
  const loading = awaitingQuery || search.isLoading;
  const options = loading || search.isError ? [] : search.data?.results ?? [];
  const expanded = open && query.trim().length > 0 && !value;
  const active = options[activeIndex];

  function choose(stock: StockOption) {
    onChange(stock);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
        Stock
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-[2.6rem] h-4 w-4" style={{ color: "var(--color-text-faint)" }} />
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? `${id}-options` : undefined}
        aria-activedescendant={expanded && active ? `${id}-option-${activeIndex}` : undefined}
        aria-describedby={`${id}-help`}
        autoComplete="off"
        disabled={disabled}
        value={value ? value.symbol : query}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange(null);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setOpen(false); setActiveIndex(-1); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setActiveIndex(-1);
          } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length && !value) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => event.key === "ArrowDown"
              ? (index + 1) % options.length
              : (index < 0 ? options.length - 1 : (index - 1 + options.length) % options.length));
          } else if (event.key === "Enter" && expanded && options.length && !loading) {
            event.preventDefault();
            choose(active ?? options[0]);
          }
        }}
        placeholder="Search AAPL, RELIANCE..."
        className="w-full rounded-lg py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-brass)]"
        style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
      />
      <p id={`${id}-help`} className="sr-only">Type a ticker or company. Use arrow keys to choose a result, Enter to select, and Escape to close.</p>

      {expanded && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border shadow-xl" style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}>
          <p role="status" className="px-4 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {loading ? "Searching stocks…" : search.isError ? "Stock search is unavailable. Try your search again." : options.length ? `${options.length} stock${options.length === 1 ? "" : "s"} found` : "No stocks found. Try a ticker or another company name."}
          </p>
          {search.isError && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => void search.refetch()} className="mx-4 mb-3 text-xs underline" style={{ color: "var(--color-text-primary)" }}>Retry stock search</button>}
          <ul id={`${id}-options`} role="listbox" aria-label="Stock search results">
            {!loading && !search.isError && options.map((stock, index) => (
              <li
                key={stock.symbol}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={activeIndex === index}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => choose(stock)}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                style={{ background: activeIndex === index ? "var(--color-surface-offset)" : undefined }}
              >
                <div className="min-w-0 flex-1">
                  <p className="ticker truncate text-xs">{stock.symbol}</p>
                  <p className="truncate text-[11px]" style={{ color: "var(--color-text-muted)" }}>{stock.name}</p>
                </div>
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "var(--color-surface-offset)", color: "var(--color-text-muted)" }}>{stock.exchange}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
