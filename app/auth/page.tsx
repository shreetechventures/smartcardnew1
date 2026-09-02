'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Loader2, Mail, Lock, User, Building2, Sparkles, UserCheck, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="auth-loading"><Loader2 size={32} className="spin" /></div>}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const { signIn, signUp, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ companyName: string; role: string } | null>(null);
  const inviteToken = searchParams.get('invite');
  const isRecovery = searchParams.get('type') === 'recovery';
  const [authView, setAuthView] = useState<'main' | 'forgot' | 'reset'>('main');
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (isRecovery) {
      setAuthView('reset');
    }
  }, [isRecovery]);

  useEffect(() => {
    if (!authLoading && session) {
      router.replace('/dashboard');
    }
  }, [session, authLoading, router]);

  useEffect(() => {
    if (inviteToken) {
      setMode('signup');
      (async () => {
        const { data } = await supabase
          .from('invitations')
          .select('email, role, companies(name)')
          .eq('token', inviteToken)
          .eq('status', 'pending')
          .maybeSingle();
        if (data) {
          setEmail(data.email || '');
          const inv = data as any;
          setInviteInfo({ companyName: inv.companies?.name || 'a team', role: inv.role });
        }
      })();
    }
  }, [inviteToken]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const siteUrl = window.location.origin;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${siteUrl}/auth`,
    });
    setLoading(false);
    setResetSent(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (updateError) {
      setError(updateError.message || 'Could not update password. Please try again.');
      return;
    }
    setResetSuccess(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('Please enter your name');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      const { error: signUpError } = await signUp(email, password, fullName);
      if (signUpError) {
        setError(signUpError);
        setLoading(false);
        return;
      }
      router.replace('/dashboard');
    } else {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError('Invalid email or password. Please try again.');
        setLoading(false);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="auth-loading">
        <Loader2 size={32} className="spin" />
      </div>
    );
  }

  if (authView === 'reset' && resetSuccess) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo"><CheckCircle2 size={32} /></div>
            <h1>Password Updated</h1>
            <p>Your password has been changed successfully. You can now sign in with your new password.</p>
          </div>
          <button className="auth-submit" onClick={() => { setAuthView('main'); setMode('signin'); setResetSuccess(false); }}>
            Back to Sign In
          </button>
          <div className="auth-footer">
            <Sparkles size={14} />
            <span>Smart Identity, Smart Business</span>
          </div>
        </div>
      </div>
    );
  }

  if (authView === 'reset') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo"><KeyRound size={32} /></div>
            <h1>Set New Password</h1>
            <p>Enter your new password below.</p>
          </div>
          <form onSubmit={handleResetPassword} className="auth-form">
            <div className="auth-field">
              <Lock size={18} />
              <input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
            </div>
            <div className="auth-field">
              <Lock size={18} />
              <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? <Loader2 size={18} className="spin" /> : 'Update Password'}
            </button>
          </form>
          <div className="auth-footer">
            <Sparkles size={14} />
            <span>Smart Identity, Smart Business</span>
          </div>
        </div>
      </div>
    );
  }

  if (authView === 'forgot') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo"><Mail size={32} /></div>
            <h1>Forgot Password</h1>
            <p>{resetSent ? "If an account exists for this email, we've sent a password reset link. Check your inbox and click the link to set a new password." : "Enter your email address and we'll send you a link to reset your password."}</p>
          </div>
          {resetSent ? (
            <div className="auth-reset-sent">
              <CheckCircle2 size={48} />
              <p>Check your email for the reset link.</p>
              <button className="auth-submit" onClick={() => { setAuthView('main'); setResetSent(false); setResetEmail(''); }}>
                <ArrowLeft size={16} /> Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="auth-form">
              <div className="auth-field">
                <Mail size={18} />
                <input type="email" placeholder="Email address" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required />
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? <Loader2 size={18} className="spin" /> : 'Send Reset Link'}
              </button>
            </form>
          )}
          {!resetSent && (
            <button className="auth-back-link" onClick={() => { setAuthView('main'); setError(''); }}>
              <ArrowLeft size={15} /> Back to Sign In
            </button>
          )}
          <div className="auth-footer">
            <Sparkles size={14} />
            <span>Smart Identity, Smart Business</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Building2 size={32} />
          </div>
          <h1>TheSmartCard</h1>
          <p>{inviteInfo ? `You've been invited to join ${inviteInfo.companyName} as ${inviteInfo.role}. Create your account to accept.` : mode === 'signin' ? 'Welcome back. Sign in to your dashboard.' : 'Create your account and start growing your business.'}</p>
        </div>

        {inviteInfo && (
          <div className="auth-invite-banner">
            <UserCheck size={20} />
            <div>
              <strong>Invitation to join {inviteInfo.companyName}</strong>
              <span>Role: {inviteInfo.role}</span>
            </div>
          </div>
        )}

        <div className="auth-tabs">
          <button className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setError(''); }}>Sign In</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); }}>Sign Up</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div className="auth-field">
              <User size={18} />
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="auth-field">
            <Mail size={18} />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <Lock size={18} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? <Loader2 size={18} className="spin" /> : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>

          {mode === 'signin' && (
            <button type="button" className="auth-forgot-link" onClick={() => { setAuthView('forgot'); setError(''); }}>
              Forgot password?
            </button>
          )}
        </form>

        <div className="auth-footer">
          <Sparkles size={14} />
          <span>Smart Identity, Smart Business</span>
        </div>
      </div>
    </div>
  );
}
