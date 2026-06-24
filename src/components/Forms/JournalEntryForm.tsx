import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../i18n/i18nContext';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

interface JournalEntryFormProps {
  onClose: () => void;
  onSave: () => void;
}

export const JournalEntryForm: React.FC<JournalEntryFormProps> = ({
  onClose,
  onSave,
}) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    title: '',
    content: '',
    emotional_state: '' as '' | 'excellent' | 'good' | 'neutral' | 'bad' | 'terrible',
    discipline_score: 5,
    session_pnl: 0,
    trades_count: 0,
    tags: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const tagsArray = formData.tags
        ? formData.tags
            .split(',')
            .map((tag) => tag.trim().toUpperCase())
            .filter((tag) => tag.length > 0)
        : [];

      const { error } = await supabase.from('journal_entries').insert({
        user_id: user.id,
        date: formData.date,
        title: formData.title,
        content: formData.content,
        emotional_state: formData.emotional_state || null,
        discipline_score: formData.discipline_score,
        session_pnl: formData.session_pnl,
        trades_count: formData.trades_count,
        tags: tagsArray,
      });

      if (error) throw error;

      toast.success(t.messages.saveSuccess);
      onSave();
    } catch (error: any) {
      toast.error(error.message || t.messages.saveError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="relative bg-amber-50 dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border-l-4 border-amber-700"
           style={{
             backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(139, 69, 19, 0.08) 31px, rgba(139, 69, 19, 0.08) 32px)',
           }}>
        <div className="sticky top-0 bg-amber-50 dark:bg-gray-800 border-b border-amber-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-xl font-bold text-dark-primary dark:text-white" style={{ fontFamily: 'Georgia, serif' }}>
            {t.journal.addEntry}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-danger-red hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-fast"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 relative z-10">
          <div>
            <label className="block text-sm font-medium text-amber-900 dark:text-amber-400 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
              {t.journal.date}
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-amber-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-dark-primary dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-fast"
              style={{ fontFamily: 'Georgia, serif' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-amber-900 dark:text-amber-400 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
              {t.journal.entryTitle}
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-amber-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-dark-primary dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-fast text-base"
              placeholder="Trading session summary"
              style={{ fontFamily: 'Georgia, serif' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-amber-900 dark:text-amber-400 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
              {t.journal.content}
            </label>
            <textarea
              required
              rows={8}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-4 py-3 border-2 border-amber-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-dark-primary dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-fast resize-none text-base leading-7"
              placeholder="Describe your trading session, what went well, what to improve..."
              style={{ fontFamily: 'Georgia, serif' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-amber-900 dark:text-amber-400 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                {t.journal.emotionalState}
              </label>
              <select
                value={formData.emotional_state}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    emotional_state: e.target.value as any,
                  })
                }
                className="w-full px-4 py-2.5 border-2 border-amber-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-dark-primary dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-fast"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                <option value="">-</option>
                <option value="excellent">{t.journal.emotional.excellent}</option>
                <option value="good">{t.journal.emotional.good}</option>
                <option value="neutral">{t.journal.emotional.neutral}</option>
                <option value="bad">{t.journal.emotional.bad}</option>
                <option value="terrible">{t.journal.emotional.terrible}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-amber-900 dark:text-amber-400 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                {t.journal.disciplineScore} (1-10)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.discipline_score}
                onChange={(e) =>
                  setFormData({ ...formData, discipline_score: parseInt(e.target.value) })
                }
                className="w-full px-4 py-2.5 border-2 border-amber-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-dark-primary dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-fast"
                style={{ fontFamily: 'Georgia, serif' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-amber-900 dark:text-amber-400 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                {t.journal.sessionPnL}
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.session_pnl}
                onChange={(e) =>
                  setFormData({ ...formData, session_pnl: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-4 py-2.5 border-2 border-amber-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-dark-primary dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-fast"
                style={{ fontFamily: 'Georgia, serif' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-amber-900 dark:text-amber-400 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                {t.journal.tradesCount}
              </label>
              <input
                type="number"
                min="0"
                value={formData.trades_count}
                onChange={(e) =>
                  setFormData({ ...formData, trades_count: parseInt(e.target.value) || 0 })
                }
                className="w-full px-4 py-2.5 border-2 border-amber-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-dark-primary dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-fast"
                style={{ fontFamily: 'Georgia, serif' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-amber-900 dark:text-amber-400 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
              {t.journal.tags}
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-amber-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-dark-primary dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-fast"
              placeholder={t.journal.tagsPlaceholder}
              style={{ fontFamily: 'Georgia, serif' }}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-amber-700 text-white px-6 py-3 rounded-lg hover:bg-amber-800 transition-smooth disabled:opacity-50 shadow-md font-medium"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {loading ? t.common.loading : t.common.save}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border-2 border-amber-300 dark:border-gray-600 text-dark-primary dark:text-white rounded-lg hover:bg-amber-100 dark:hover:bg-gray-700 transition-smooth font-medium"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {t.common.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
