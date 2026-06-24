import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Lock, ExternalLink } from 'lucide-react';

type AccessState =
  | { status: 'loading' }
  | { status: 'granted'; reason: string }
  | { status: 'denied'; reason: string }
  | { status: 'error'; message: string };

interface JournalAccessGateProps {
  children: ReactNode;
}

const TRACKMARKETE_DASHBOARD = 'https://trackmarkete.com/dashboard';

/**
 * Server-checked access gate.
 * Calls the `check-journal-access` edge function with the current user's JWT
 * and the journal id read from VITE_JOURNAL_ID.
 *
 * Renders children only if has_access === true.
 */
export function JournalAccessGate({ children }: JournalAccessGateProps) {
  const [state, setState] = useState<AccessState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const journalId = import.meta.env.VITE_JOURNAL_ID as string | undefined;
      if (!journalId) {
        if (!cancelled) {
          setState({
            status: 'error',
            message:
              "Configuration manquante : VITE_JOURNAL_ID n'est pas défini pour ce déploiement.",
          });
        }
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('check-journal-access', {
          body: { journal_id: journalId },
        });
        if (cancelled) return;

        if (error) {
          setState({ status: 'error', message: error.message ?? 'check-journal-access failed' });
          return;
        }

        if (data?.has_access) {
          setState({ status: 'granted', reason: data.reason ?? 'unknown' });
        } else {
          setState({ status: 'denied', reason: data?.reason ?? 'no_subscription' });
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 text-[#EF4444] animate-spin" />
          <span className="tape-headline text-xs text-white/60">Vérification de l'accès</span>
        </div>
      </div>
    );
  }

  if (state.status === 'granted') {
    return <>{children}</>;
  }

  return <NoAccessScreen state={state} />;
}

function NoAccessScreen({ state }: { state: AccessState }) {
  const headline =
    state.status === 'error' ? 'ERREUR D’ACCÈS' : 'ACCÈS RÉSERVÉ';
  const sub =
    state.status === 'error'
      ? "Impossible de vérifier ton accès pour l'instant."
      : "Cet espace est réservé aux abonnés ayant sélectionné ce journal.";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="tape-card p-8 md:p-10 tape-scanlines">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#EF4444] text-[#0A0A0A] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <span className="tape-headline text-[10px] tracking-[0.2em] text-white/60">
              MIDNIGHT TAPE / SIDE B
            </span>
          </div>

          <h1 className="tape-headline text-5xl md:text-6xl text-white mb-3 leading-none">
            {headline}
          </h1>
          <p className="text-white/80 text-base leading-relaxed mb-6">{sub}</p>

          {state.status === 'error' && (
            <div className="border border-[#EF4444]/40 bg-[#3F0A0A]/40 px-3 py-2 text-xs font-mono text-[#FCA5A5] mb-6">
              {state.message}
            </div>
          )}

          <div className="tape-divider mb-6" />

          <p className="text-sm text-white/70 mb-5">
            Pour écouter cette face : connecte-toi à <span className="text-[#FACC15]">trackmarkete</span>,
            choisis ce journal dans ton tableau de bord, puis reviens ici.
          </p>

          <a
            href={TRACKMARKETE_DASHBOARD}
            target="_blank"
            rel="noreferrer"
            className="tape-btn inline-flex items-center gap-2 px-5 py-3 text-sm"
          >
            Ouvrir mon dashboard
            <ExternalLink className="w-4 h-4" />
          </a>

          {state.status === 'denied' && state.reason && (
            <p className="mt-6 text-[10px] tracking-[0.18em] uppercase text-white/40 font-mono">
              code: {state.reason}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] tracking-[0.2em] uppercase text-white/30 font-mono">
          /// rec — play — pause — stop ///
        </p>
      </div>
    </div>
  );
}

export default JournalAccessGate;
