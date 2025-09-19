export async function loadYearlyComparison({
  currentYear,
  previousYear,
  currentYearStatistics,
  fetchCourseStatistics,
}) {
  const currentStats =
    currentYearStatistics ??
    (await fetchCourseStatistics(currentYear, { updateState: false }));

  const shouldFetchPrevious = typeof previousYear === "number" && previousYear > 0;
  const previousStats = shouldFetchPrevious
    ? await fetchCourseStatistics(previousYear, { updateState: false })
    : [];

  return {
    current: currentStats,
    previous: previousStats,
  };
}
