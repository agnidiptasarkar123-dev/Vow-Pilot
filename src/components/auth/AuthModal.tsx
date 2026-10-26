import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { collaborationClient } from '../../services/collaborationClient';
import { Lock, Mail, User as UserIcon, AlertCircle, Check, Loader2, Server } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const serverUrl = collaborationClient.getState().serverUrl;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        const res = await collaborationClient.login(email, password);
        if (res.success && res.user) {
          setSuccessMsg(`Welcome back, ${res.user.name}!`);
          setTimeout(() => {
            onClose();
            if (onSuccess) onSuccess();
          }, 800);
        } else {
          setError(res.error || 'Login failed. Please check your credentials.');
        }
      } else {
        const res = await collaborationClient.register(name, email, password);
        if (res.success && res.user) {
          setSuccessMsg(`Account created successfully! Welcome, ${res.user.name}.`);
          setTimeout(() => {
            onClose();
            if (onSuccess) onSuccess();
          }, 800);
        } else {
          setError(res.error || 'Registration failed.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'login' ? 'Sign In to VowPilot' : 'Create Your VowPilot Account'}
      description="Access cloud-synchronized events, manage team roles, and collaborate in real time."
      maxWidth="md"
    >
      <div className="space-y-4 text-xs">
        {/* Mode Toggle Tabs */}
        <div className="flex border-b border-[#E6DFD5]">
          <button
            type="button"
            onClick={() => switchMode('login')}
            data-testid="auth-tab-login"
            className={`flex-1 py-2 text-center font-medium border-b-2 transition ${
              mode === 'login'
                ? 'border-[#A2421D] text-[#A2421D] font-bold'
                : 'border-transparent text-[#78716C] hover:text-[#1C1917]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            data-testid="auth-tab-register"
            className={`flex-1 py-2 text-center font-medium border-b-2 transition ${
              mode === 'register'
                ? 'border-[#A2421D] text-[#A2421D] font-bold'
                : 'border-transparent text-[#78716C] hover:text-[#1C1917]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Server Endpoint Notice */}
        <div className="p-2.5 rounded-md bg-[#FAF8F5] border border-[#E6DFD5] text-[11px] text-[#5C554E] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <Server className="w-3.5 h-3.5 text-[#A2421D] shrink-0" />
            <span className="truncate">
              Connecting to: <strong className="font-mono text-[#1C1917]">{serverUrl}</strong>
            </span>
          </div>
          <span className="shrink-0 px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px] uppercase">
            Backend Ready
          </span>
        </div>

        {/* Alert Messages */}
        {error && (
          <div role="alert" className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span className="leading-tight">{error}</span>
          </div>
        )}

        {successMsg && (
          <div role="status" aria-live="polite" className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-name-input" className="block font-medium text-[#1C1917] mb-1">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#78716C]">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
                <input
                  id="auth-name-input"
                  data-testid="auth-name-input"
                  type="text"
                  required
                  placeholder="e.g. Maya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded border border-[#D6CFC7] bg-[#FFFFFF] text-[#1C1917] focus:outline-hidden focus:border-[#A2421D]"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email-input" className="block font-medium text-[#1C1917] mb-1">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#78716C]">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <input
                id="auth-email-input"
                data-testid="auth-email-input"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded border border-[#D6CFC7] bg-[#FFFFFF] text-[#1C1917] focus:outline-hidden focus:border-[#A2421D]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="auth-password-input" className="block font-medium text-[#1C1917] mb-1">
              Password {mode === 'register' && <span className="text-[#78716C] font-normal">(min. 8 characters)</span>}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#78716C]">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <input
                id="auth-password-input"
                data-testid="auth-password-input"
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded border border-[#D6CFC7] bg-[#FFFFFF] text-[#1C1917] focus:outline-hidden focus:border-[#A2421D]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            data-testid="auth-submit-btn"
            className="w-full py-2.5 px-4 bg-[#A2421D] hover:bg-[#863414] text-white font-semibold rounded-md shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{mode === 'login' ? 'Authenticating...' : 'Creating Account...'}</span>
              </>
            ) : (
              <span>{mode === 'login' ? 'Sign In & Connect' : 'Create Account'}</span>
            )}
          </button>
        </form>

        <p className="text-[11px] text-center text-[#78716C] pt-2 border-t border-[#F4EFEA]">
          Passwords are protected using OWASP-compliant Argon2id & scrypt hashing with per-user salt.
        </p>
      </div>
    </Modal>
  );
};
