import { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import toast from 'react-hot-toast';
import { calculateDynamicStock, calculateReturnedStock } from '../../utils/inventoryCalc';

export function LowInventoryAlertManager({ onViewChange: _onViewChange }: { onViewChange?: (view: any) => void }) {
  // Low inventory alerts are now centrally managed in the Header Notifications menu
  return null;
}

