import React, { useState } from 'react';
import { JournalEntry, supabase } from '../../lib/supabase';
import { useI18n } from '../../i18n/i18nContext';
import toast from 'react-hot-toast';
import { Plus, Trash2, BookOpen, Smile, Meh, Frown } from 'lucide-react';
import { JournalEntryForm } from '../Forms/JournalEntryForm';

interface JournalListProps {
  entries: JournalEntry[];
  onEntriesChange: () => void;
}

export const JournalList: React.FC<JournalListProps> = ({
  entries,
  onEntriesChange,
}) => {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);

  const handleDelete = async (id: string) => {
    if (!confirm(t.journal.confirmDelete)) return;

    const { error } = await supabase.from('journal_entries').delete().eq('id', id);

    if (error) {
      toast.error(t.messages.deleteError);
    } else {
      toast.success(t.messages.deleteSuccess);
      onEntriesChange();
    }
  };

  const getEmotionalIcon = (state?: string | null) => {
    if (!state) return <Meh className="w-4 h-4" />;
    if (state === 'excellent' || state === 'good') return <Smile className="w-4 h-4" />;
    if (state === 'bad' || state === 'terrible') return <Frown className="w-4 h-4" />;
    return <Meh className="w-4 h-4" />;
  };

  const getEmotionalColor = (state?: string | null) => {
    if (!state) return 'text-gray-600 dark:text-gray-400';
    if (state === 'excellent') return 'text-success-green';
    if (state === 'good') return 'text-success-green';
    if (state === 'neutral') return 'text-gray-600 dark:text-gray-400';
    if (state === 'bad') return 'text-danger-red';
    if (state === 'terrible') return 'text-danger-red';
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-amber-700 dark:text-amber-600" />
          <h2 className="text-2xl font-bold text-dark-primary dark:text-white" style={{ fontFamily: 'Georgia, serif' }}>
            {t.journal.title}
          </h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg text-button hover:bg-amber-800 transition-smooth shadow-md"
        >
          <Plus className="w-4 h-4" />
          {t.journal.addEntry}
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="relative bg-amber-50 dark:bg-gray-800 rounded-lg p-12 text-center border-l-4 border-amber-700 shadow-lg">
          <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none"
               style={{
                 backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #8B4513 31px, #8B4513 32px)',
               }}>
          </div>
          <BookOpen className="w-16 h-16 text-amber-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-label-regular text-gray-600 dark:text-gray-400" style={{ fontFamily: 'Georgia, serif' }}>
            {t.journal.noEntries}
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="relative bg-amber-50 dark:bg-gray-800 rounded-lg p-8 border-l-4 border-amber-700 shadow-lg hover:shadow-xl transition-shadow"
              style={{
                backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(139, 69, 19, 0.1) 31px, rgba(139, 69, 19, 0.1) 32px)',
              }}
            >
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-dark-primary dark:text-white mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                    {entry.title}
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-400 font-medium" style={{ fontFamily: 'Georgia, serif' }}>
                    {new Date(entry.date).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="p-2 text-gray-500 hover:text-danger-red hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-fast"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="relative z-10 mb-6 pl-1">
                <p className="text-base leading-8 text-gray-800 dark:text-gray-200 whitespace-pre-wrap"
                   style={{ fontFamily: 'Georgia, serif', lineHeight: '32px' }}>
                  {entry.content}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 relative z-10 pt-4 border-t border-amber-200 dark:border-gray-700">
                {entry.emotional_state && (
                  <div className={`inline-flex items-center gap-2 ${getEmotionalColor(entry.emotional_state)}`}>
                    {getEmotionalIcon(entry.emotional_state)}
                    <span className="text-sm font-medium" style={{ fontFamily: 'Georgia, serif' }}>
                      {t.journal.emotional[entry.emotional_state as keyof typeof t.journal.emotional]}
                    </span>
                  </div>
                )}

                {entry.discipline_score && (
                  <div className="inline-flex items-center gap-2 text-primary-blue">
                    <span className="text-sm font-medium" style={{ fontFamily: 'Georgia, serif' }}>
                      Discipline: {entry.discipline_score}/10
                    </span>
                  </div>
                )}

                {entry.session_pnl !== 0 && (
                  <div className={`inline-flex items-center gap-2 ${
                    entry.session_pnl >= 0 ? 'text-success-green' : 'text-danger-red'
                  }`}>
                    <span className="text-sm font-bold" style={{ fontFamily: 'Georgia, serif' }}>
                      P&L: ${entry.session_pnl.toFixed(2)}
                    </span>
                  </div>
                )}

                {entry.tags && entry.tags.length > 0 && (
                  <>
                    {entry.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-amber-200 dark:bg-gray-700 text-amber-900 dark:text-amber-200 rounded text-xs font-medium"
                        style={{ fontFamily: 'Georgia, serif' }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <JournalEntryForm
          onClose={() => setShowForm(false)}
          onSave={() => {
            setShowForm(false);
            onEntriesChange();
          }}
        />
      )}
    </div>
  );
};
