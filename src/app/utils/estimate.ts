export interface EstimateParts {
  hoursLabel: string;
  daysLabel: string | null;
}

export function parseEstimate(value: string | number | null | undefined): EstimateParts | null {
  if (value == null || value === '') {
    return null;
  }

  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return { hoursLabel: String(value), daysLabel: null };
  }

  const days = n / 7;
  const daysLabel = Number.isInteger(days)
    ? days === 1
      ? '1 day'
      : `${days} days`
    : `${Number(days.toFixed(1))} days`;

  const hoursLabel = Number.isInteger(n) ? `${n}h` : `${Number(n.toFixed(1))}h`;
  return { hoursLabel, daysLabel };
}

export function formatEstimate(value: string | number | null | undefined): string {
  const parts = parseEstimate(value);
  if (!parts) {
    return '';
  }
  return parts.daysLabel ? `${parts.hoursLabel} (${parts.daysLabel})` : parts.hoursLabel;
}
