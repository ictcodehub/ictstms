import { describe, it, expect } from 'vitest';
import { sortClasses } from './classSort';

describe('sortClasses', () => {
  it('should sort classes by grade number', () => {
    const classes = [
      { id: '1', name: '10A' },
      { id: '2', name: '7A' },
      { id: '3', name: '12A' },
      { id: '4', name: '9A' },
    ];

    const sorted = sortClasses(classes);

    expect(sorted[0].name).toBe('7A');
    expect(sorted[1].name).toBe('9A');
    expect(sorted[2].name).toBe('10A');
    expect(sorted[3].name).toBe('12A');
  });

  it('should sort classes by section when grade is same', () => {
    const classes = [
      { id: '1', name: '10C' },
      { id: '2', name: '10A' },
      { id: '3', name: '10E' },
      { id: '4', name: '10B' },
      { id: '5', name: '10D' },
    ];

    const sorted = sortClasses(classes);

    expect(sorted[0].name).toBe('10A');
    expect(sorted[1].name).toBe('10B');
    expect(sorted[2].name).toBe('10C');
    expect(sorted[3].name).toBe('10D');
    expect(sorted[4].name).toBe('10E');
  });

  it('should handle mixed grades and sections', () => {
    const classes = [
      { id: '1', name: '9B' },
      { id: '2', name: '7A' },
      { id: '3', name: '10C' },
      { id: '4', name: '7B' },
      { id: '5', name: '10A' },
      { id: '6', name: '9A' },
    ];

    const sorted = sortClasses(classes);

    expect(sorted[0].name).toBe('7A');
    expect(sorted[1].name).toBe('7B');
    expect(sorted[2].name).toBe('9A');
    expect(sorted[3].name).toBe('9B');
    expect(sorted[4].name).toBe('10A');
    expect(sorted[5].name).toBe('10C');
  });

  it('should handle classes without section letters', () => {
    const classes = [
      { id: '1', name: '10' },
      { id: '2', name: '7' },
      { id: '3', name: '9' },
    ];

    const sorted = sortClasses(classes);

    expect(sorted[0].name).toBe('7');
    expect(sorted[1].name).toBe('9');
    expect(sorted[2].name).toBe('10');
  });

  it('should handle invalid class names with fallback', () => {
    const classes = [
      { id: '1', name: 'ClassZ' },
      { id: '2', name: 'ClassA' },
      { id: '3', name: '10A' },
    ];

    const sorted = sortClasses(classes);

    expect(sorted[0].name).toBe('10A');
    expect(sorted[1].name).toBe('ClassA');
    expect(sorted[2].name).toBe('ClassZ');
  });

  it('should handle empty name', () => {
    const classes = [
      { id: '1', name: '' },
      { id: '2', name: '10A' },
    ];

    const sorted = sortClasses(classes);

    expect(sorted[0].name).toBe('');
    expect(sorted[1].name).toBe('10A');
  });

  it('should not mutate original array', () => {
    const original = [
      { id: '1', name: '10A' },
      { id: '2', name: '7A' },
    ];
    const originalCopy = [...original];

    sortClasses(original);

    expect(original).toEqual(originalCopy);
  });

  it('should handle empty array', () => {
    const classes = [];
    const sorted = sortClasses(classes);

    expect(sorted).toEqual([]);
  });
});
