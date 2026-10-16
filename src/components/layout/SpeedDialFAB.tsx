import React, { useState } from 'react';
import { Plus, Package, DollarSign, FileSpreadsheet } from 'lucide-react';
import { useStore } from '../../store';

export function SpeedDialFAB({ onNavigate }: { onNavigate: (view: any) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const userRole = useStore(state => state.currentUserProfile?.role);


  return (
    <div className="fixed bottom-20 right-5 z-40 md:bottom-20 md:right-6 lg:hidden" dir="rtl">
      {isOpen && (
        <div className="absolute bottom-16 right-0 flex flex-col gap-3 items-center animate-in slide-in-from-bottom-4 duration-200">
          <button
            onClick={() => { setIsOpen(false); onNavigate('orders'); }}
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl shadow-lg border border-slate-200 text-sm font-bold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 transition-colors whitespace-nowrap"
          >
            إضافة طلبية <Package className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setIsOpen(false); onNavigate('expenses'); }}
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl shadow-lg border border-slate-200 text-sm font-bold text-slate-700 hover:text-rose-600 hover:bg-rose-50 transition-colors whitespace-nowrap"
          >
            إضافة مصروف <DollarSign className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setIsOpen(false); onNavigate('inventory'); }}
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl shadow-lg border border-slate-200 text-sm font-bold text-slate-700 hover:text-amber-600 hover:bg-amber-50 transition-colors whitespace-nowrap"
          >
            حركة مخزن <FileSpreadsheet className="w-4 h-4" />
          </button>
        </div>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 ${
          isOpen ? 'bg-slate-800 rotate-45' : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'
        }`}
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
