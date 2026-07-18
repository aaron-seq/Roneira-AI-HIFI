import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('merges tailwind classes without conflicts', () => {
    expect(cn('p-4', 'bg-red-500')).toBe('p-4 bg-red-500');
  });

  it('resolves tailwind class conflicts', () => {
    expect(cn('px-2', 'p-4')).toBe('p-4');
    expect(cn('p-4', 'px-2')).toBe('p-4 px-2');
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });

  it('handles conditional classes', () => {
    expect(cn('text-lg', true && 'font-bold', false && 'hidden')).toBe('text-lg font-bold');
  });

  it('handles array and object inputs via clsx', () => {
    expect(cn(['text-lg', 'font-bold'], { 'p-4': true, 'm-2': false })).toBe('text-lg font-bold p-4');
  });
});
