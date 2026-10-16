export const getActionPriority = (order: any): { level: 'high' | 'medium' | 'low', days: number } | null => {
  if (!needsAction(order)) return null;
  
  if (order.postponementDate) {
    const pDate = new Date(order.postponementDate);
    const now = new Date();
    if (pDate.setHours(0,0,0,0) <= now.setHours(0,0,0,0)) {
       const diffTime = Math.abs(now.getTime() - pDate.getTime());
       const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
       return { level: 'high', days: diffDays };
    }
  }

  if (!order.trackingHistory || order.trackingHistory.length === 0) return { level: 'low', days: 0 };
  
  const history = [...order.trackingHistory].filter((h: any) => h.remarque || h.status || h.station);
  
  const firstAttempt = history.find((h: any) => {
    const s = (h.status || '').toLowerCase();
    if (s.includes('تحديث يدوي') || s.trim() === 'ملاحظة') return false;

    return s.includes('محاولة') || 
           s.includes('إرجاع') || 
           s.includes('فشل') || 
           s.includes('attempt') || 
           s.includes('echoue') || 
           s.includes('echec') || 
           s.includes('retour');
  });
  
  if (!firstAttempt || !firstAttempt.date) return { level: 'low', days: 0 };
  
  let attemptDate = new Date(firstAttempt.date);
  
  // If the date is invalid, try to parse common formats like "DD/MM/YYYY HH:mm"
  if (isNaN(attemptDate.getTime()) && typeof firstAttempt.date === 'string') {
    const parts = firstAttempt.date.split(/[-/ :]/);
    if (parts.length >= 3) {
      // Assuming DD/MM/YYYY
      const year = parseInt(parts[2].startsWith('20') ? parts[2] : '20' + parts[2]); // very basic handling
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[0]);
      attemptDate = new Date(year, month, day);
    }
  }

  if (isNaN(attemptDate.getTime())) return { level: 'low', days: 0 };
  
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - attemptDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays >= 3) return { level: 'high', days: diffDays };
  if (diffDays >= 1) return { level: 'medium', days: diffDays };
  return { level: 'low', days: diffDays };
};

export const getLastAttemptDate = (order: any): Date | null => {
  if (!order.trackingHistory || order.trackingHistory.length === 0) return null;
  
  const history = [...order.trackingHistory].filter((h: any) => h.remarque || h.status || h.station);
  
  // Find the most recent attempt (since it's not reversed, we grab from the end usually, assuming sorted chronologically, but just in case, we reverse to get the last one or we filter and take the first if it's reverse sorted)
  // Wait, let's look at trackingHistory. The `reverse()` is used in `needsAction` to get chronological order? Or maybe the newest is at the top?
  // In ShippedOrdersList, history is displayed sequentially. Let's just iterate to find the most recent valid date.
  
  const attemptHistory = history.filter((h: any) => {
    const s = (h.status || '').toLowerCase();
    if (s.includes('تحديث يدوي') || s.trim() === 'ملاحظة') return false;

    return s.includes('محاولة') || 
           s.includes('إرجاع') || 
           s.includes('فشل') || 
           s.includes('attempt') || 
           s.includes('echoue') || 
           s.includes('echec') || 
           s.includes('retour');
  });

  if (attemptHistory.length === 0) return null;

  // Since order trackingHistory might be sorted newest first or oldest first depending on the API.
  // We should try to parse the date from the attempts and return the maximum date.
  let maxDate: Date | null = null;

  for (const attempt of attemptHistory) {
    if (!attempt.date) continue;
    
    let attemptDate = new Date(attempt.date);
    
    if (isNaN(attemptDate.getTime()) && typeof attempt.date === 'string') {
      const parts = attempt.date.split(/[-/ :]/);
      if (parts.length >= 3) {
        const yearStr = parts[2].split('T')[0]; // Handle cases like 2024T10:00
        const year = parseInt(yearStr.length === 2 ? '20' + yearStr : yearStr);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[0]);
        attemptDate = new Date(year, month, day);
      }
    }
    
    if (!isNaN(attemptDate.getTime())) {
      if (!maxDate || attemptDate > maxDate) {
        maxDate = attemptDate;
      }
    }
  }

  return maxDate;
};

export const needsAction = (order: any) => {
  if (order.status2 === 'مستلم' || order.status2 === 'مرتجع') return false; 
  
  if (order.postponementDate) {
    const pDate = new Date(order.postponementDate);
    const now = new Date();
    if (pDate.setHours(0,0,0,0) <= now.setHours(0,0,0,0)) {
      return true; // Overdue postponement needs action
    }
  }

  if (!order.trackingHistory || order.trackingHistory.length === 0) return false;
  
  const history = [...order.trackingHistory].filter((h: any) => h.remarque || h.status || h.station).reverse();
  if (history.length === 0) return false;
  
  // Find the most recent manual update or user note, and most recent shipping attempt
  const lastManualUpdateIndex = history.findIndex((h: any) => {
      const s = h.status || '';
      return s.includes('تحديث يدوي') || s.trim() === 'ملاحظة';
  });
  
  if (lastManualUpdateIndex === 0) return false; // The very last thing was a manual update
  
  if (lastManualUpdateIndex !== -1) {
    // If we have a manual update, check if there's a shipping attempt AFTER it
    // history is reversed, so lower index = newer.
    // If the newest attempt item has a higher index (older) than the manual update, then the manual update is newer
    const lastAttemptIndex = history.findIndex((h: any) => {
      const s = (h.status || '').toLowerCase();
      const r = (h.remarque || '').toLowerCase();
      
      // Ignore manual updates or user notes when searching for shipping attempts
      if (s.includes('تحديث يدوي') || s.trim() === 'ملاحظة') return false;

      return s.includes('محاولة') || s.includes('إرجاع') || s.includes('فشل') || 
             s.includes('attempt') || s.includes('echoue') || s.includes('echec') || s.includes('retour') ||
             r.includes('محاولة');
    });
    
    if (lastAttemptIndex !== -1 && lastManualUpdateIndex < lastAttemptIndex) {
      // Manual update is newer than the last attempt -> suppress alert
      return false;
    }
  }
  
  // قلل من تنبيهات: require more than 1 attempt to show "Needs Action" unless priority is extremely high
  return getAttemptCount(order) > 1;
};

export const getAttemptCount = (order: any): number => {
  if (!order.trackingHistory || order.trackingHistory.length === 0) return 0;
  
  let attempts = 0;
  // We should count distinct days of attempts, but counting occurrences is simpler for now,
  // or count if status has "محاولة x" or just tracking strings.
  const history = [...order.trackingHistory].filter((h: any) => h.remarque || h.status || h.station);
  
  for (const h of history) {
    const s = (h.status || '').toLowerCase();
    const r = (h.remarque || '').toLowerCase();
    
    // Ignore manual updates or user notes
    if (s.includes('تحديث يدوي') || s.trim() === 'ملاحظة') continue;

    // Count explicit "attempt x" or just any attempt word.
    if (s.includes('محاولة') || s.includes('إرجاع') || s.includes('فشل') || 
        s.includes('attempt') || s.includes('echoue') || s.includes('echec') || s.includes('retour')) {
      attempts++;
    } else if (r.includes('محاولة')) {
      attempts++;
    }
  }
  
  return attempts;
};
