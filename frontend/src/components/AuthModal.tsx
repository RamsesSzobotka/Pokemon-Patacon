import React, { useState } from 'react';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import '../styles/AuthModal.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'signin' | 'signup';

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccessMessage(null);
    setLoading(false);
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInLoaded || !signIn) return;

    setLoading(true);
    setError(null);

    try {
      const signInAttempt = await signIn.create({
        identifier: email,
      });

      const result = await signInAttempt.prepareFirstFactor({
        strategy: 'password',
        password,
      });

      if (result.status === 'complete') {
        await setActiveSignIn({ session: result.createdSessionId });
        setSuccessMessage('¡Sesión iniciada!');
        setTimeout(() => {
          resetForm();
          onClose();
        }, 1000);
      } else {
        setError('Verificación adicional requerida. Revisa tu email.');
      }
    } catch (err: any) {
      const message = err.errors?.[0]?.message
        || err.errors?.[0]?.longMessage
        || 'Error al iniciar sesión. Verifica tus credenciales.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Guardar username temporalmente para que useAuthSession lo envíe al backend
      if (username.trim()) {
        sessionStorage.setItem('patacon_pending_username', username.trim());
      }

      const result = await signUp.create({
        emailAddress: email,
        password,
      });

      if (result.status === 'complete') {
        await setActiveSignUp({ session: result.createdSessionId });
        setSuccessMessage('¡Cuenta creada!');
        setTimeout(() => {
          resetForm();
          onClose();
        }, 1000);
      } else {
        setError('Verifica tu email para completar el registro.');
      }
    } catch (err: any) {
      const message = err.errors?.[0]?.message
        || err.errors?.[0]?.longMessage
        || 'Error al crear la cuenta.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>✕</button>

        <div className="auth-modal-header">
          <img src="/assets/Title.png" alt="Pokémon Patacon" className="auth-modal-logo" />
          <h2 className="auth-modal-title">
            {mode === 'signin' ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}
          </h2>
        </div>

        <div className="auth-modal-tabs">
          <button
            className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => switchMode('signin')}
          >
            INICIAR SESIÓN
          </button>
          <button
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            REGISTRARSE
          </button>
        </div>

        {error && (
          <div className="auth-error">
            <span>⚠</span>
            <p>{error}</p>
          </div>
        )}
        {successMessage && (
          <div className="auth-success">
            <span>✓</span>
            <p>{successMessage}</p>
          </div>
        )}

        <form
          className="auth-form"
          onSubmit={mode === 'signin' ? handleSignIn : handleSignUp}
        >
          <label className="auth-label">EMAIL</label>
          <input
            type="email"
            className="auth-input"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            autoFocus
          />

          {mode === 'signup' && (
            <>
              <label className="auth-label">NOMBRE DE USUARIO</label>
              <input
                type="text"
                className="auth-input"
                placeholder="Ash Ketchum"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                minLength={2}
                maxLength={20}
              />
            </>
          )}

          <label className="auth-label">CONTRASEÑA</label>
          <input
            type="password"
            className="auth-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            minLength={8}
          />

          {mode === 'signup' && (
            <>
              <label className="auth-label">CONFIRMAR CONTRASEÑA</label>
              <input
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
              />
            </>
          )}

          <button
            type="submit"
            className={`auth-submit-btn ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading
              ? 'PROCESANDO...'
              : mode === 'signin'
              ? '🔴 INICIAR SESIÓN'
              : '🔴 CREAR CUENTA'
            }
          </button>
        </form>

        <div className="auth-divider">
          <span>O CONTINÚA CON</span>
        </div>

        <div className="auth-oauth-buttons">
          <button className="auth-oauth-btn google" onClick={() => {
            if (signIn) {
              signIn.authenticateWithRedirect({
                strategy: 'oauth_google',
                redirectUrl: '/sso-callback',
                redirectUrlComplete: '/splash',
              });
            }
          }}>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Google</span>
          </button>
        </div>

        <p className="auth-footer-text">
          {mode === 'signin'
            ? '¿No tienes cuenta? '
            : '¿Ya tienes cuenta? '}
          <button
            className="auth-mode-switch"
            onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            {mode === 'signin' ? 'REGISTRARSE' : 'INICIAR SESIÓN'}
          </button>
        </p>
      </div>
    </div>
  );
}
