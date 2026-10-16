import toast from 'react-hot-toast';

let lastPlayTime = 0;

export const triggerStatusNotification = (orderId: string, status: string, options: { sound?: boolean, visual?: boolean }) => {
  const now = Date.now();
  if (options.sound && now - lastPlayTime > 3000) { // debounce to avoid spam
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); // Slide up to A5
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
      }
    } catch (e) {
      console.warn('Audio visualization not supported', e);
    }
    lastPlayTime = now;
  }

  if (options.visual) {
    toast(`تنبيه: تحديث حالة الطلب (${orderId}) إلى "${status}"`, {
      icon: '🔔',
      duration: 5000,
      position: 'top-left',
    });
  }
};

