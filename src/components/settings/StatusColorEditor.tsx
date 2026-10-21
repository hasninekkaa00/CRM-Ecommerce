import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, Palette, RotateCcw } from 'lucide-react';
import { COLOR_SWATCH_PRESETS, DEFAULT_STATUS_COLORS, getContrastingTextColor } from '../../utils/statusColorUtils';

interface StatusColorEditorProps {
  title: string;
  desc: string;
  items: string[];
  statusColors: Record<string, string>;
  onUpdateColor: (status: string, color: string) => void;
  onAdd: (val: string) => void;
  onRemove: (val: string) => void;
  onEdit: (oldVal: string, newVal: string) => void;
  immutableItems?: string[];
}

export function StatusColorEditor({
  title,
  desc,
  items,
  statusColors,
  onUpdateColor,
  onAdd,
  onRemove,
  onEdit,
  immutableItems = []
}: StatusColorEditorProps) {
  const [newVal, setNewVal] = useState('');
  const [newColor, setNewColor] = useState('#dbeafe');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const [activePickerStatus, setActivePickerStatus] = useState<string | null>(null);

  const handleAddClick = () => {
    const trimmed = newVal.trim();
    if (trimmed && !items.includes(trimmed)) {
      onAdd(trimmed);
      onUpdateColor(trimmed, newColor);
      setNewVal('');
      setNewColor('#dbeafe');
    }
  };

  const handleStartEdit = (idx: number, currentVal: string) => {
    setEditingIdx(idx);
    setEditVal(currentVal);
  };

  const handleSaveEdit = (idx: number, oldVal: string) => {
    const trimmed = editVal.trim();
    if (trimmed && trimmed !== oldVal) {
      onEdit(oldVal, trimmed);
      // Migrate color to new name if exists
      if (statusColors[oldVal]) {
        onUpdateColor(trimmed, statusColors[oldVal]);
      }
    }
    setEditingIdx(null);
    setEditVal('');
  };

  const handleCancelEdit = () => {
    setEditingIdx(null);
    setEditVal('');
  };

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 text-right animate-fadeIn" dir="rtl">
      <div className="flex items-center justify-between border-b pb-3 mb-4">
        <div>
          <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
            <Palette className="w-5 h-5 text-indigo-600" />
            {title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
        </div>
        <span className="text-xs font-black bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100">
          {items.length} حالات
        </span>
      </div>

      {/* Add new status input */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
        <input 
          type="text" 
          value={newVal} 
          onChange={(e) => setNewVal(e.target.value)}
          placeholder="أضف حالة جديدة مخصصة..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-500 bg-white"
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddClick(); }}
        />
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold text-gray-600 shrink-0">اللون:</label>
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-8 h-8 rounded-lg cursor-pointer border border-gray-300 p-0.5 bg-white"
            title="اختر لون هذه الحالة عند عرض سطر الطلبية"
          />
          <button 
            onClick={handleAddClick}
            disabled={!newVal.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            إضافة
          </button>
        </div>
      </div>

      {/* Statuses List */}
      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
        {items.map((item: string, idx: number) => {
          const isImmutable = immutableItems.includes(item);
          const isCurrentlyEditing = editingIdx === idx;
          const currentColor = statusColors[item] || DEFAULT_STATUS_COLORS[item] || '#ffffff';
          const textColor = getContrastingTextColor(currentColor);
          const isPickerOpen = activePickerStatus === item;

          return (
            <div 
              key={`${item}-${idx}`} 
              className="p-2.5 rounded-xl border border-slate-100 transition-all duration-150 hover:border-slate-200"
              style={{ backgroundColor: `${currentColor}25` }}
            >
              {isCurrentlyEditing ? (
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    className="flex-1 border border-indigo-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-bold"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(idx, item);
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSaveEdit(idx, item)}
                      className="text-green-600 hover:bg-green-50 p-1.5 rounded-md transition"
                      title="حفظ التعديل"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-gray-400 hover:bg-gray-100 p-1.5 rounded-md transition"
                      title="إلغاء"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-gray-800">
                        {item}
                      </span>
                      {isImmutable && (
                        <span className="text-[10px] bg-indigo-100/70 text-indigo-800 font-extrabold px-1.5 py-0.5 rounded-md border border-indigo-200">
                          أساسي للنظام
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Live preview badge of the row */}
                      <div 
                        style={{ backgroundColor: currentColor, color: textColor }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-black border border-black/10 shadow-2xs flex items-center gap-1.5 cursor-pointer hover:scale-102 transition-transform"
                        onClick={() => setActivePickerStatus(isPickerOpen ? null : item)}
                        title="انقر لتعديل لون هذه الحالة وتلوين سطر الطلبية"
                      >
                        <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: currentColor }} />
                        <span>معاينة السطر: {item}</span>
                      </div>

                      {/* Palette button */}
                      <button
                        type="button"
                        onClick={() => setActivePickerStatus(isPickerOpen ? null : item)}
                        className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 text-[11px] font-bold ${
                          isPickerOpen 
                            ? 'bg-indigo-600 text-white border-indigo-600' 
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                        title="تغيير لون تلوين سطر الطلبية"
                      >
                        <Palette className="w-3.5 h-3.5" />
                        <span>تلوين</span>
                      </button>

                      {/* Edit name */}
                      {!isImmutable && (
                        <button 
                          onClick={() => handleStartEdit(idx, item)}
                          className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition cursor-pointer"
                          title="تعديل اسم الحالة"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete */}
                      {!isImmutable && (
                        <button 
                          onClick={() => onRemove(item)}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer"
                          title="حذف هذه الحالة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Popover / Expandable Palette Selector */}
                  {isPickerOpen && (
                    <div className="p-3 bg-white rounded-xl border border-indigo-200 shadow-lg mt-1 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                        <span className="text-[11px] font-extrabold text-slate-700">
                          اختر لون سطر الطلبية لحالة "{item}":
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const def = DEFAULT_STATUS_COLORS[item] || '#ffffff';
                              onUpdateColor(item, def);
                            }}
                            className="text-[10px] text-indigo-600 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                            title="استعادة اللون الافتراضي"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            افتراضي
                          </button>
                          <button
                            type="button"
                            onClick={() => setActivePickerStatus(null)}
                            className="text-gray-400 hover:text-gray-600 p-0.5 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Swatches Grid */}
                      <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 mb-3">
                        {COLOR_SWATCH_PRESETS.map((swatch) => {
                          const isSelected = currentColor.toLowerCase() === swatch.hex.toLowerCase();
                          return (
                            <button
                              key={swatch.hex}
                              type="button"
                              onClick={() => {
                                onUpdateColor(item, swatch.hex);
                              }}
                              style={{ backgroundColor: swatch.hex }}
                              className={`h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer hover:scale-105 ${
                                isSelected ? 'ring-2 ring-indigo-600 ring-offset-1 border-indigo-600 scale-105' : 'border-black/10'
                              }`}
                              title={swatch.name}
                            >
                              {isSelected && <Check className="w-3 h-3 text-slate-800" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Color Input */}
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={currentColor}
                            onChange={(e) => onUpdateColor(item, e.target.value)}
                            className="w-7 h-7 rounded-md cursor-pointer border border-gray-300 p-0.5 bg-white"
                          />
                          <span className="text-[11px] font-mono font-bold text-slate-700">
                            {currentColor.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-bold">
                          يتم الحفظ تلقائياً في السحابة 💾
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
