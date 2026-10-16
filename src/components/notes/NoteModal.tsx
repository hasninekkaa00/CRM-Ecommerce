import React, { useState, useEffect } from 'react';
import { X, Check, PaintBucket, Trash2, ListTodo, AlignLeft, Plus } from 'lucide-react';
import { Note, NoteTask } from '../../types';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Partial<Note>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  initialData?: Note | null;
}

const COLORS = [
  '#fef08a', // yellow-200
  '#bbf7d0', // green-200
  '#bfdbfe', // blue-200
  '#fbcfe8', // pink-200
  '#fed7aa', // orange-200
  '#e9d5ff', // purple-200
  '#f3f4f6', // gray-100
];

const CATEGORIES = ['عمل', 'شخصي', 'أفكار', 'أخرى'];

export function NoteModal({ isOpen, onClose, onSave, onDelete, initialData }: NoteModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [category, setCategory] = useState(CATEGORIES[3]);
  const [isChecklist, setIsChecklist] = useState(false);
  const [tasks, setTasks] = useState<NoteTask[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showColors, setShowColors] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title || '');
        setContent(initialData.content || '');
        setColor(initialData.color || COLORS[0]);
        setCategory(initialData.category || CATEGORIES[3]);
        setIsChecklist(initialData.isChecklist || false);
        setTasks(initialData.tasks || []);
      } else {
        setTitle('');
        setContent('');
        setColor(COLORS[0]);
        setCategory(CATEGORIES[3]);
        setIsChecklist(false);
        setTasks([]);
      }
      setShowColors(false);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !content.trim() && tasks.length === 0) return;
    
    setIsSubmitting(true);
    try {
      await onSave({ title, content, color, category, isChecklist, tasks });
      onClose();
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleAddTask = () => {
    setTasks([...tasks, { id: Date.now().toString(), text: '', completed: false }]);
  };
  
  const updateTask = (id: string, updates: Partial<NoteTask>) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
  };
  
  const removeTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
      <div 
        className="w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl flex flex-col relative overflow-hidden transition-colors duration-300"
        style={{ backgroundColor: color }}
      >
        <div className="absolute top-0 right-0 p-3 z-10 flex items-center gap-2">
          <button 
            onClick={() => setShowColors(!showColors)}
            className="p-2 rounded-full bg-black/5 hover:bg-black/10 transition-colors"
            title="تغيير اللون"
          >
            <PaintBucket className="w-4 h-4 text-gray-700" />
          </button>
          
          <button
             onClick={() => setIsChecklist(!isChecklist)}
             className={`p-2 rounded-full transition-colors ${isChecklist ? 'bg-blue-500 text-white' : 'bg-black/5 hover:bg-black/10 text-gray-700'}`}
             title={isChecklist ? "تغيير إلى نص" : "تغيير إلى قائمة مهام"}
          >
             {isChecklist ? <AlignLeft className="w-4 h-4" /> : <ListTodo className="w-4 h-4" />}
          </button>

          <button 
            onClick={onClose}
            className="p-2 rounded-full bg-black/5 hover:bg-black/10 transition-colors"
          >
            <X className="w-4 h-4 text-gray-700" />
          </button>
        </div>

        {showColors && (
          <div className="absolute top-14 right-4 z-20 flex flex-col gap-2 bg-white p-2 rounded-xl shadow-lg border border-black/5">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); setShowColors(false); }}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${c === color ? 'border-gray-800' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col h-full pt-16 p-6 overflow-y-auto">
          <div className="mb-4 flex flex-wrap gap-2">
             {CATEGORIES.map(cat => (
               <button
                 key={cat}
                 type="button"
                 onClick={() => setCategory(cat)}
                 className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${category === cat ? 'bg-black/80 text-white' : 'bg-black/10 text-black/60 hover:bg-black/20'}`}
               >
                 {cat}
               </button>
             ))}
          </div>
          
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="العنوان"
            className="text-xl font-bold bg-transparent border-none outline-none placeholder:text-gray-500/70 mb-4 text-gray-800"
          />
          
          {isChecklist ? (
             <div className="flex-1 flex flex-col gap-2 min-h-[200px]">
               {tasks.map(task => (
                 <div key={task.id} className="flex items-center gap-3 group">
                   <button
                     type="button"
                     onClick={() => updateTask(task.id, { completed: !task.completed })}
                     className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${task.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-400'}`}
                   >
                     {task.completed && <Check className="w-3 h-3" />}
                   </button>
                   <input
                     type="text"
                     value={task.text}
                     onChange={(e) => updateTask(task.id, { text: e.target.value })}
                     className={`flex-1 bg-transparent border-none outline-none text-gray-800 ${task.completed ? 'line-through opacity-50' : ''}`}
                     placeholder="مهمة جديدة..."
                     autoFocus={!task.text}
                   />
                   <button
                     type="button"
                     onClick={() => removeTask(task.id)}
                     className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 text-red-500 rounded-lg transition-all"
                   >
                     <X className="w-4 h-4" />
                   </button>
                 </div>
               ))}
               <button
                 type="button"
                 onClick={handleAddTask}
                 className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-2 py-2 w-fit rounded-lg hover:bg-black/5 mt-2 transition-colors"
               >
                 <Plus className="w-4 h-4" />
                 <span className="text-sm font-bold">إضافة عنصر</span>
               </button>
             </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="اكتب ملاحظاتك هنا..."
              className="flex-1 min-h-[200px] resize-none bg-transparent border-none outline-none placeholder:text-gray-500/70 text-gray-800 leading-relaxed"
              autoFocus
            />
          )}

          <div className="flex justify-between items-center mt-6 pt-4 border-t border-black/10">
            {initialData && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(initialData.id)}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-xl flex items-center gap-2 transition-colors"
                title="حذف"
              >
                <Trash2 className="w-5 h-5" />
                <span className="hidden sm:inline">حذف</span>
              </button>
            ) : <div />}
            <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting || (!title.trim() && !content.trim() && tasks.length === 0)}
              className="px-6 py-2 bg-black/10 hover:bg-black/20 text-gray-800 font-bold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Check className="w-5 h-5" />
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ الملاحظة'}
            </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
