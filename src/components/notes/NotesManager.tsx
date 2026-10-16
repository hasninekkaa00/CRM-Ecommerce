import React, { useState, useMemo } from 'react';
import { Plus, Search, Trash2, Edit3, StickyNote } from 'lucide-react';
import { useStore } from '../../store';
import { Note } from '../../types';
import { NoteModal } from './NoteModal';

export function NotesManager() {
  const { notes = [], addNote, updateNote, deleteNote } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const categories = ['all', 'عمل', 'شخصي', 'أفكار', 'أخرى'];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredNotes = useMemo(() => {
    // Deduplicate notes by ID to prevent "two children with the same key" errors
    const uniqueNotes = Array.from(new Map((notes || []).map(n => [n.id, n])).values());
    return uniqueNotes.filter(note => 
      (selectedCategory === 'all' || note.category === selectedCategory) &&
      (note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()))
    ).sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  }, [notes, searchQuery, selectedCategory]);

  const handleOpenAdd = () => {
    setSelectedNote(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (note: Note) => {
    setSelectedNote(note);
    setIsModalOpen(true);
  };

  const handleSaveNote = async (noteData: Partial<Note>) => {
    if (selectedNote) {
      await updateNote(selectedNote.id, noteData);
    } else {
      const newNote: Note = {
        id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        title: noteData.title || '',
        content: noteData.content || '',
        color: noteData.color || '#fef08a',
        category: noteData.category || 'أخرى',
        isChecklist: noteData.isChecklist || false,
        tasks: noteData.tasks || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await addNote(newNote);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };
  
  const confirmDelete = async () => {
    if (confirmDeleteId) {
      await deleteNote(confirmDeleteId);
      setConfirmDeleteId(null);
      if (selectedNote?.id === confirmDeleteId) {
        setIsModalOpen(false);
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50/50 p-4 md:p-6 lg:p-8" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
              <StickyNote className="w-6 h-6" />
            </div>
            المذكرة الشخصية
          </h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">سجل أفكارك وملاحظاتك المهمة لتعود إليها في أي وقت.</p>
        </div>

        <button 
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>ملاحظة جديدة</span>
        </button>
      </div>

      <div className="relative mb-8 max-w-xl">
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث في الملاحظات..."
          className="block w-full pr-11 pl-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all"
        />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pb-10">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white/50 rounded-3xl border border-dashed border-gray-300">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <StickyNote className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">لا توجد ملاحظات</h3>
            <p className="text-gray-500 max-w-sm mb-6">لم تقم بإضافة أي ملاحظات بعد، أو أنه لا توجد نتائج مطابقة لبحثك.</p>
            <button 
              onClick={handleOpenAdd}
              className="px-6 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-colors shadow-sm"
            >
              أضف ملاحظتك الأولى
            </button>
          </div>
        ) : (
          <div className={`grid gap-4 md:gap-6 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 max-w-4xl mx-auto'}`}>
            {filteredNotes.map((note) => (
              <div 
                key={note.id}
                onClick={() => handleOpenEdit(note)}
                className="group relative flex flex-col rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl border border-black/5"
                style={{ backgroundColor: note.color || '#fef08a' }}
              >
                <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <button 
                    onClick={(e) => handleDelete(e, note.id)}
                    className="p-1.5 bg-white/50 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors text-gray-600"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                
                {note.category && (
                  <span className="inline-block px-2 py-0.5 rounded-full bg-black/5 text-xs font-bold mb-2 w-fit">
                    {note.category}
                  </span>
                )}
                {note.title && (
                  <h3 className="font-bold text-gray-900 text-lg mb-2 pr-2 line-clamp-2">
                    {note.title}
                  </h3>
                )}
                
                {note.isChecklist && note.tasks ? (
                  <div className="flex-1 flex flex-col gap-1.5 mt-2 overflow-hidden">
                    {note.tasks.slice(0, 4).map(task => (
                      <div key={task.id} className="flex items-center gap-2 text-sm opacity-90">
                        <div className={`w-3 h-3 rounded-full border ${task.completed ? 'bg-green-500 border-green-500' : 'border-gray-500'}`} />
                        <span className={`truncate ${task.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>{task.text}</span>
                      </div>
                    ))}
                    {note.tasks.length > 4 && <div className="text-xs text-gray-500 mt-1">+{note.tasks.length - 4} مهام أخرى</div>}
                  </div>
                ) : (
                  <p className="text-gray-800 text-sm whitespace-pre-wrap flex-1 opacity-90 line-clamp-6 leading-relaxed">
                    {note.content}
                  </p>
                )}


                <div className="mt-4 pt-4 border-t border-black/5 flex justify-between items-center text-[10px] font-bold text-gray-600/80">
                  <span>
                    {new Date(note.updatedAt || note.createdAt).toLocaleDateString('ar-DZ')}
                  </span>
                  <Edit3 className="w-3.5 h-3.5 opacity-50" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NoteModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveNote}
        initialData={selectedNote}
        onDelete={async (id) => {
          setConfirmDeleteId(id);
        }}
      />
    
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-gray-900 mb-2 text-center">تأكيد حذف الملاحظة</h3>
            <p className="text-gray-500 text-sm font-medium mb-6 text-center">
              هل أنت متأكد من رغبتك في حذف هذه الملاحظة بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl transition-colors shadow-sm"
              >
                تأكيد الحذف
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
