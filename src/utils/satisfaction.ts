export function convertToTenScale(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  return value > 0 && value <= 5 ? value * 2 : value;
}

interface FormatOptions {
  digits?: number;
  fallback?: string;
  convert?: boolean;
}

export function formatSatisfaction(
  value: number | null | undefined,
  { digits = 1, fallback = '-', convert = false }: FormatOptions = {}
): string {
  const normalized = convert ? convertToTenScale(value) : value;

  if (normalized === null || normalized === undefined || Number.isNaN(normalized)) {
    return fallback;
  }

  return Number(normalized).toFixed(digits);
}
