/**
 * VirtualizedTable Component
 * 
 * High-performance table for datasets.
 * Simplified version without react-window for compatibility.
 * 
 * @author Roneira AI
 * @version 2026
 */

import React, { useCallback, useMemo, CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: number | string;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
}

export interface VirtualizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  maxHeight?: number;
  className?: string;
  onRowClick?: (row: T, index: number) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  stickyHeader?: boolean;
  emptyMessage?: string;
  loading?: boolean;
}

interface TableRowProps<T> {
  index: number;
  style?: CSSProperties;
  row: T;
  columns: Column<T>[];
  onRowClick?: (row: T, index: number) => void;
}

function TableRow<T>({ index, style, row, columns, onRowClick }: TableRowProps<T>) {
  const getCellValue = (column: Column<T>, row: T): unknown => {
    const keys = (column.key as string).split('.');
    let value: unknown = row;
    for (const key of keys) {
      value = (value as Record<string, unknown>)?.[key];
    }
    return value;
  };

  return (
    <motion.div
      style={style}
      className={`
        flex items-center border-b border-white/5
        ${onRowClick ? 'cursor-pointer hover:bg-white/5' : ''}
        transition-colors duration-150
      `}
      onClick={() => onRowClick?.(row, index)}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
    >
      {columns.map((column) => {
        const value = getCellValue(column, row);
        const align = column.align || 'left';

        return (
          <div
            key={column.key as string}
            className={`
              px-4 py-3 flex-shrink-0 truncate
              ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}
            `}
            style={{
              width: column.width || 'auto',
              minWidth: column.minWidth || 80,
              flex: column.width ? 'none' : 1,
            }}
          >
            {column.render ? column.render(value, row, index) : String(value ?? '-')}
          </div>
        );
      })}
    </motion.div>
  );
}

export function VirtualizedTable<T extends object>({
  data,
  columns,
  rowHeight = 52,
  maxHeight = 500,
  className = '',
  onRowClick,
  sortColumn,
  sortDirection,
  onSort,
  stickyHeader = true,
  emptyMessage = 'No data available',
  loading = false,
}: VirtualizedTableProps<T>) {
  const handleSort = useCallback((column: Column<T>) => {
    if (column.sortable && onSort) {
      onSort(column.key as string);
    }
  }, [onSort]);

  const calculateTableWidth = useMemo(() => {
    return columns.reduce((total, col) => {
      const width = typeof col.width === 'number' ? col.width : col.minWidth || 100;
      return total + width;
    }, 0);
  }, [columns]);

  // Empty state
  if (!loading && data.length === 0) {
    return (
      <div className={`glass-card rounded-xl overflow-hidden ${className}`}>
        <div className="flex items-center justify-center h-48 text-slate-500">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-card rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      {stickyHeader && (
        <div 
          className="flex items-center bg-slate-800/50 border-b border-white/10 sticky top-0 z-10"
          style={{ minWidth: calculateTableWidth }}
        >
          {columns.map((column) => {
            const isSorted = sortColumn === column.key;
            const align = column.align || 'left';

            return (
              <div
                key={column.key as string}
                className={`
                  px-4 py-3 flex-shrink-0 font-semibold text-sm text-slate-400 uppercase tracking-wider
                  ${column.sortable ? 'cursor-pointer hover:text-white' : ''}
                  ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}
                `}
                style={{
                  width: column.width || 'auto',
                  minWidth: column.minWidth || 80,
                  flex: column.width ? 'none' : 1,
                }}
                onClick={() => handleSort(column)}
              >
                <span className="inline-flex items-center gap-1">
                  {column.header}
                  {column.sortable && isSorted && (
                    <span className="text-cyan-400">
                      {sortDirection === 'asc' ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full"
          />
        </div>
      )}

      {/* Scrollable rows container */}
      <div 
        className="overflow-auto scrollbar-thin"
        style={{ maxHeight: maxHeight }}
      >
        {data.map((row, index) => (
          <TableRow<T>
            key={index}
            index={index}
            row={row}
            columns={columns}
            onRowClick={onRowClick}
            style={{ height: rowHeight }}
          />
        ))}
      </div>

      {/* Row count footer */}
      <div className="px-4 py-2 text-xs text-slate-500 border-t border-white/5 bg-slate-800/30">
        Showing {data.length} {data.length === 1 ? 'row' : 'rows'}
      </div>
    </div>
  );
}

/**
 * Hook for managing table sorting
 */
export function useTableSort<T>(
  data: T[],
  defaultColumn?: keyof T,
  defaultDirection: 'asc' | 'desc' = 'asc'
) {
  const [sortColumn, setSortColumn] = React.useState<keyof T | undefined>(defaultColumn);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>(defaultDirection);

  const handleSort = useCallback((column: string) => {
    const typedColumn = column as keyof T;
    if (sortColumn === typedColumn) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(typedColumn);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  return {
    sortedData,
    sortColumn: sortColumn as string | undefined,
    sortDirection,
    handleSort,
  };
}

export default VirtualizedTable;
