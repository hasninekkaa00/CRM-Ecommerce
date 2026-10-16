export function isNoteFromToday(noteText: string): boolean {
  if (!noteText || typeof noteText !== 'string') return false;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  // Standard Arabic/French/ISO date representations
  const dateStr1 = `${year}/${month}/${day}`; // e.g. 2026/08/13
  const dateStr2 = `${year}-${month}-${day}`; // e.g. 2026-08-13
  const dateStr3 = `${day}/${month}/${year}`; // e.g. 13/08/2026
  const dateStr4 = `${day}-${month}-${year}`; // e.g. 13-08-2026

  if (
    noteText.includes(dateStr1) ||
    noteText.includes(dateStr2) ||
    noteText.includes(dateStr3) ||
    noteText.includes(dateStr4)
  ) {
    return true;
  }

  // Fallback to local date check
  const localStr = now.toLocaleDateString();
  if (localStr && noteText.includes(localStr)) {
    return true;
  }

  return false;
}

export type NoteTarget = 'customer' | 'driver';

export function detectNoteTarget(noteText: string): NoteTarget {
  if (!noteText || typeof noteText !== 'string') return 'customer';
  
  if (
    noteText.includes('[🚚') ||
    noteText.includes('ليفرور') ||
    noteText.includes('الموزع') ||
    noteText.includes('السائق') ||
    noteText.includes('عامل التوصيل') ||
    noteText.includes('شركة الشحن')
  ) {
    return 'driver';
  }
  return 'customer';
}

export function formatNoteLine(text: string, target: NoteTarget = 'customer'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12 || 12;
  const formattedHours = String(hours).padStart(2, '0');

  const formattedDate = `${year}/${month}/${day}`;
  const formattedTime = `${formattedHours}:${minutes} ${ampm}`;

  const timeStampHeader = `[📌 ${formattedDate} - ${formattedTime}]`;
  const targetHeader = target === 'driver' ? '[🚚 ملاحظة الليفرور]' : '[👤 ملاحظة الزبون]';

  return `${timeStampHeader} ${targetHeader} ${text}`;
}

