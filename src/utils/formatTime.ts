import { format, parseISO } from 'date-fns';
export function formatTime(time: string) {
    if (!time) return '';
    try {
        return format(parseISO(time), 'yyyy-MM-dd HH:mm');
    } catch {
        return '';
    }
}
