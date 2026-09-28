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

let cachedCurrency = 'USD';

export function setSystemCurrency(currencyCode: string) {
  if (currencyCode) {
    cachedCurrency = currencyCode.toUpperCase();
    if (typeof window !== 'undefined') {
      localStorage.setItem('meditrack_currency', cachedCurrency);
      window.dispatchEvent(new CustomEvent('meditrack_currency_changed', { detail: cachedCurrency }));
    }
  }
}

export function getSystemCurrency(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('meditrack_currency');
    if (saved) return saved;
  }
  return cachedCurrency || 'USD';
}

export function formatCurrency(amount: number | string | null | undefined, currency?: string): string {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  const activeCurrency = currency || getSystemCurrency();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeCurrency
    }).format(isNaN(numericAmount) ? 0 : numericAmount);
  } catch {
    return `${activeCurrency} ${(isNaN(numericAmount) ? 0 : numericAmount).toFixed(2)}`;
  }
}
