import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

let cachedCurrency = 'ZAR';

export function setSystemCurrency(currencyCode: string) {
  cachedCurrency = 'ZAR';
  if (typeof window !== 'undefined') {
    localStorage.setItem('meditrack_currency', 'ZAR');
    window.dispatchEvent(new CustomEvent('meditrack_currency_changed', { detail: 'ZAR' }));
  }
}

export function getSystemCurrency(): string {
  return 'ZAR';
}

export function formatCurrency(amount: number | string | null | undefined, _currency?: string): string {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  const val = isNaN(numericAmount) ? 0 : numericAmount;
  return `R ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
