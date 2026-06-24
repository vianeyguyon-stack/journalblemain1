import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Settings as SettingsIcon, Book, Calendar, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface SettingsPageProps {
  user: any;
}

interface Journal {
  id: string;
  name: string;
  description: string;
  url: string;
  is_active: boolean;
}

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  current_period_end: string;
  journal_id: string;
  journals: Journal;
}

interface ChangeRequest {
  id: string;
  requested_journal_id: string;
  status: string;
  reason: string | null;
  requested_at: string;
  journals: Journal;
}

export function Settings({ user }: SettingsPageProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [allJournals, setAllJournals] = useState<Journal[]>([]);
  const [changeRequest, setChangeRequest] = useState<ChangeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [selectedJournalId, setSelectedJournalId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*, journals(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (subError) throw subError;
      setSubscription(subData);

      const { data: journalsData, error: journalsError } = await supabase
        .from('journals')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (journalsError) throw journalsError;
      setAllJournals(journalsData || []);

      const { data: requestData, error: requestError } = await supabase
        .from('journal_change_requests')
        .select('*, journals:requested_journal_id(*)')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();
      if (requestError && requestError.code !== 'PGRST116') throw requestError;
      setChangeRequest(requestData);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des donnees');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJournalId) {
      toast.error('Veuillez selectionner un journal');
      return;
    }
    try {
      setSubmitting(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Non authentifie');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/request-journal-change`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested_journal_id: selectedJournalId, reason: reason.trim() || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erreur lors de la demande');
      toast.success('Demande de changement creee avec succes');
      setShowChangeForm(false);
      setSelectedJournalId('');
      setReason('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la demande de changement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!changeRequest) return;
    try {
      setCancelling(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Non authentifie');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-journal-change-request`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: changeRequest.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erreur lors de l\'annulation');
      toast.success('Demande annulee avec succes');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'annulation');
    } finally {
      setCancelling(false);
    }
  };

  const availableJournals = allJournals.filter((j) => j.id !== subscription?.journal_id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#3B82F6] border-t-transparent" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-10 text-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div className="w-14 h-14 bg-yellow-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-yellow-500" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Aucun abonnement actif</h3>
        <p className="text-sm text-[#6B7280]">Vous devez avoir un abonnement actif pour gerer vos parametres</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="bg-gradient-to-r from-[#1F2937] to-[#111111] rounded-card border border-[#3B82F6]/40 p-6" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-blue/20 rounded-xl flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-primary-blue" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Parametres</h2>
            <p className="text-sm text-[#6B7280]">Gestion de votre journal et abonnement</p>
          </div>
        </div>
      </div>

      <div className="bg-[#111111] rounded-card border border-[#3B82F6]/50 p-6" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div className="flex items-center gap-2.5 mb-5">
          <Book className="w-4.5 h-4.5 text-primary-blue" />
          <h3 className="text-base font-semibold text-white">Gestion du Journal</h3>
        </div>

        <div className="bg-[#000000] rounded-xl border border-[#1F2937] p-5 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest mb-1">Journal actuel</p>
              <p className="text-xl font-bold text-primary-blue truncate">{subscription.journals.name}</p>
              <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">{subscription.journals.description}</p>
              {subscription.journals.url && (
                <a
                  href={subscription.journals.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary-blue hover:text-blue-400 mt-2 transition-fast"
                >
                  Visiter le journal <ChevronRight className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4.5 h-4.5 text-blue-400" />
            </div>
          </div>
        </div>

        {changeRequest ? (
          <div className="bg-[#1F2937]/40 border border-[#3B82F6]/30 rounded-xl p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Demande de changement en cours</h4>
            <p className="text-sm text-[#9CA3AF] mb-1">
              Nouveau journal : <span className="font-semibold text-white">{changeRequest.journals.name}</span>
            </p>
            <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-3">
              <Calendar className="w-3.5 h-3.5" />
              Demande le {new Date(changeRequest.requested_at).toLocaleDateString('fr-FR')}
            </div>
            {changeRequest.reason && (
              <div className="bg-[#000000] rounded-lg p-3 mb-3">
                <p className="text-xs text-[#9CA3AF]"><span className="font-medium text-[#6B7280]">Raison :</span> {changeRequest.reason}</p>
              </div>
            )}
            <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/20 rounded-lg p-3 mb-4">
              <p className="text-xs text-[#93C5FD]">
                Effectif au <strong className="text-white">{new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}</strong>
              </p>
            </div>
            <button
              onClick={handleCancelRequest}
              disabled={cancelling}
              className="px-4 py-2 bg-red-500/15 text-rose-400 border border-red-500/20 rounded-lg text-sm font-medium hover:bg-red-500/25 transition-fast disabled:opacity-40"
            >
              {cancelling ? 'Annulation...' : 'Annuler la demande'}
            </button>
          </div>
        ) : showChangeForm ? (
          <form onSubmit={handleRequestChange} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1.5">
                Nouveau journal *
              </label>
              <select
                value={selectedJournalId}
                onChange={(e) => setSelectedJournalId(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#000000] border border-[#1F2937] text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-fast"
                required
              >
                <option value="">Selectionnez un journal</option>
                {availableJournals.map((journal) => (
                  <option key={journal.id} value={journal.id}>{journal.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1.5">
                Raison (optionnel)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Pourquoi souhaitez-vous changer de journal ?"
                className="w-full px-4 py-2.5 bg-[#000000] border border-[#1F2937] text-white rounded-xl text-sm placeholder-[#374151] focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent transition-fast resize-none"
                rows={3}
              />
            </div>
            <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/20 rounded-lg p-3">
              <p className="text-xs text-[#93C5FD]">
                Effectif au <strong className="text-white">{new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}</strong>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowChangeForm(false); setSelectedJournalId(''); setReason(''); }}
                disabled={submitting}
                className="px-5 py-2.5 bg-[#000000] border border-[#1F2937] text-[#9CA3AF] rounded-xl text-sm font-medium hover:text-white hover:border-[#374151] transition-fast disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedJournalId}
                className="px-5 py-2.5 bg-primary-blue text-white rounded-xl text-sm font-semibold hover:bg-primary-blue-hover transition-smooth disabled:opacity-40"
              >
                {submitting ? 'Envoi...' : 'Envoyer la demande'}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowChangeForm(true)}
            className="px-5 py-2.5 bg-primary-blue text-white rounded-xl text-sm font-semibold hover:bg-primary-blue-hover transition-smooth"
            style={{ boxShadow: '0 4px 14px rgba(59,130,246,0.25)' }}
          >
            Demander un changement de journal
          </button>
        )}
      </div>
    </div>
  );
}
