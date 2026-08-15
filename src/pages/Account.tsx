import { IconCrown, IconTools } from '@tabler/icons-react';
import React, { useState, type SubmitEvent } from 'react';
import { httpClient, type PublicUser } from 'src/lib/httpClient';
import 'src/pages/Account.css';

interface AccountProps {
  user: PublicUser | null;
  setUser: (user: PublicUser | null) => void;
}

export const Account: React.FC<AccountProps> = ({ user, setUser }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (activeTab === 'register') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (activeTab === 'login') {
        const res = await httpClient.login(username, password);
        if (res.user) {
          setUser(res.user);
          setUsername('');
          setPassword('');
        }
      } else {
        const res = await httpClient.register(username, password);
        if (res.user) {
          setUser(res.user);
          setUsername('');
          setPassword('');
          setConfirmPassword('');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    httpClient.logout();
    setUser(null);
  };

  return (
    <div className="account-area">
      <h2 className="account-header">Account</h2>

      {user ? (
        <div className="account-user-info">
          <div className="user-identity-row">
            <span>
              Signed in as <strong className="username-highlight">{user.username}</strong>
            </span>
            {(user.role === 'admin' || user.role === 'owner') && (
              <span className="role-badge">
                {user.role === 'admin' ? (
                  <IconTools size={16} style={{ verticalAlign: 'middle' }} />
                ) : (
                  <IconCrown size={16} style={{ verticalAlign: 'middle' }} />
                )}
              </span>
            )}
          </div>

          <div className="account-stats-list">
            <div className="stat-item">
              <span className="label">ELO Rating</span>
              <span className="val">{Math.round(user.elo ?? 1200)}</span>
            </div>
            <div className="stat-item">
              <span className="label">Wins</span>
              <span className="val">{user.wins ?? 0}</span>
            </div>
            <div className="stat-item">
              <span className="label">Losses</span>
              <span className="val">{user.losses ?? 0}</span>
            </div>
            <div className="stat-item">
              <span className="label">Draws</span>
              <span className="val">{user.draws ?? 0}</span>
            </div>
          </div>

          <button type="button" className="signout-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="auth-container">
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('login');
                setError(null);
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('register');
                setError(null);
              }}
            >
              Register
            </button>
          </div>

          {error && <div className="auth-error-msg">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-form-group">
              <label htmlFor="auth-username">Username</label>
              <input
                id="auth-username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
              />
            </div>

            <div className="auth-form-group">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {activeTab === 'register' && (
              <div className="auth-form-group">
                <label htmlFor="auth-confirm-password">Confirm Password</label>
                <input
                  id="auth-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {(() => {
                if (loading) return 'Processing...';
                if (activeTab === 'login') return 'Sign In';
                if (activeTab === 'register') return 'Register';
                return '';
              })()}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
