import React, { useState, useEffect, useCallback } from 'react';
import { Lock, ShieldCheck, ShieldAlert, X, LogOut, ArrowRight } from 'lucide-react';
import type { User } from 'firebase/auth';
import { ADMIN_EMAIL, isVerifiedAdminUser, signInWithGoogle, logOut } from '../lib/firebase.ts';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';

interface AdminAuthModalProps {
  isOpen: boolean;
  currentUser: User | null;
  onSuccess: () => void;
  onClose: () => void;
}

export function AdminAuthModal({
  isOpen,
  currentUser,
  onSuccess,
  onClose
}: AdminAuthModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isAuthorized = isVerifiedAdminUser(currentUser);
  const handleCloseSafe = useCallback(() => {
    if (!isSubmitting) onClose();
  }, [isSubmitting, onClose]);
  const dialogRef = useDialogAccessibility(isOpen, handleCloseSafe, !isSubmitting);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setStatusMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const signedInUser = await signInWithGoogle();
      if (!isVerifiedAdminUser(signedInUser)) {
        const attemptedEmail = signedInUser?.email || 'unknown account';
        await logOut().catch(() => {});
        setError(
          `Access denied for ${attemptedEmail}. Admin access is restricted exclusively to the verified business account (${ADMIN_EMAIL}).`
        );
        return;
      }

      setStatusMessage('Verified business Google account authenticated. Opening Admin Workbench...');
      setTimeout(() => {
        onSuccess();
      }, 250);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Google Sign-In window was closed before completing authentication.');
      } else if (code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'this preview domain';
        setError(
          `This domain (${host}) is not yet authorized in Firebase Authentication. Add "${host}" under Firebase Console → purpose-and-glow → Authentication → Settings → Authorized domains, then retry.`
        );
      } else {
        setError(err?.message || 'Google Sign-In failed. Verify Firebase Authentication is enabled for this domain.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchAccount = async () => {
    setError(null);
    await logOut().catch(() => {});
    await handleGoogleSignIn();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={handleCloseSafe}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-auth-title"
        className="relative w-full max-w-md bg-white dark:bg-[#141722] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#272F42] overflow-hidden transition-colors outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#FFF0F5] dark:bg-[#1C2232] border-b border-[#F0C6D6] dark:border-[#272F42] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#C2185B] text-white flex items-center justify-center shadow-xs">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 id="admin-auth-title" className="text-sm font-bold text-[#2D2D2D] dark:text-white font-serif">
                Admin Workbench Authentication
              </h3>
              <p className="text-[11px] text-[#6E5A64] dark:text-slate-400">
                Purpose &amp; Glow Career Solutions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseSafe}
            aria-label="Close admin sign-in dialog"
            className="text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white p-1.5 rounded-md cursor-pointer transition-colors"
            title="Cancel and return to client site"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-1.5 text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#C2185B] dark:text-pink-400">
              Verified Google Sign-In Required
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Sign in with your verified business Google account (<strong className="font-mono">{ADMIN_EMAIL}</strong>) to unlock client inquiries, lead tools, and Admin AI Copilot.
            </p>
          </div>

          {isAuthorized && currentUser ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 truncate">
                    Signed in as {currentUser.email}
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Verified Business Administrator
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onSuccess}
                className="w-full py-2.5 px-4 rounded-xl bg-[#C2185B] hover:bg-[#9C1450] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <span>Open Admin Workbench</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleSwitchAccount}
                disabled={isSubmitting}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1E2333] dark:hover:bg-[#272E42] text-slate-700 dark:text-slate-300 text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Switch Google Account</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-50 dark:bg-[#1E2333] dark:hover:bg-[#272E42] border border-slate-300 dark:border-[#323C56] text-slate-800 dark:text-white text-sm font-semibold inline-flex items-center justify-center gap-2.5 cursor-pointer shadow-xs transition-colors disabled:opacity-60"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                </svg>
                <span>{isSubmitting ? 'Verifying Google Account...' : 'Sign in with Google'}</span>
              </button>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 text-xs text-red-700 dark:text-red-300 flex items-start gap-2"
            >
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {statusMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-[#272F42] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Server &amp; Firestore token enforced</span>
            <span className="font-mono">Firebase Auth</span>
          </div>
        </div>
      </div>
    </div>
  );
}
