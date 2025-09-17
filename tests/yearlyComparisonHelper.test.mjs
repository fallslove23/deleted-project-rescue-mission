import test from 'node:test';
import assert from 'node:assert/strict';

import { loadYearlyComparison } from '../src/hooks/yearlyComparisonHelper.js';

test('loadYearlyComparison skips updating state for previous year fetches', async () => {
  const statsByYear = {
    2024: [{ year: 2024, total_satisfaction: 8 }],
    2023: [{ year: 2023, total_satisfaction: 6 }],
  };
  const calls = [];

  async function fetchCourseStatistics(year, options = {}) {
    calls.push({ year, updateState: options.updateState });
    return statsByYear[year] ?? [];
  }

  const result = await loadYearlyComparison({
    currentYear: 2024,
    previousYear: 2023,
    currentYearStatistics: statsByYear[2024],
    fetchCourseStatistics,
  });

  assert.deepStrictEqual(result.current, statsByYear[2024]);
  assert.deepStrictEqual(result.previous, statsByYear[2023]);
  assert.deepStrictEqual(calls, [
    { year: 2023, updateState: false },
  ]);
});

test('loadYearlyComparison fetches both years with updateState disabled when needed', async () => {
  const statsByYear = {
    2024: [{ year: 2024, total_satisfaction: 7 }],
    2022: [{ year: 2022, total_satisfaction: 5 }],
  };
  const calls = [];

  async function fetchCourseStatistics(year, options = {}) {
    calls.push({ year, updateState: options.updateState });
    return statsByYear[year] ?? [];
  }

  const result = await loadYearlyComparison({
    currentYear: 2024,
    previousYear: 2022,
    fetchCourseStatistics,
  });

  assert.deepStrictEqual(result.current, statsByYear[2024]);
  assert.deepStrictEqual(result.previous, statsByYear[2022]);
  assert.deepStrictEqual(calls, [
    { year: 2024, updateState: false },
    { year: 2022, updateState: false },
  ]);
});

test('loadYearlyComparison handles missing previous year gracefully', async () => {
  const statsByYear = {
    2024: [{ year: 2024, total_satisfaction: 9 }],
  };
  const calls = [];

  async function fetchCourseStatistics(year, options = {}) {
    calls.push({ year, updateState: options.updateState });
    return statsByYear[year] ?? [];
  }

  const result = await loadYearlyComparison({
    currentYear: 2024,
    previousYear: 0,
    fetchCourseStatistics,
  });

  assert.deepStrictEqual(result.current, statsByYear[2024]);
  assert.deepStrictEqual(result.previous, []);
  assert.deepStrictEqual(calls, [
    { year: 2024, updateState: false },
  ]);
});
