import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { generateKeyPair } from '../utils/crypto';
import { Shield } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        const response = await axios.post(`${BACKEND_URL}/api/auth/login`, { email, password });
        login(response.data.user, response.data.token, rememberMe);
      } else {
        const publicKey = await generateKeyPair();
        
        await axios.post(`${BACKEND_URL}/api/auth/register`, {
          username,
          email,
          password,
          publicKey: JSON.stringify(publicKey)
        });
        
        setIsLogin(true);
        setError('Registration successful. Please log in.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'An error occurred');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-circle">
            <Shield size={32} />
          </div>
          <h2 className="auth-title">
            {isLogin ? 'SecureChat' : 'Create Account'}
          </h2>
          <p className="auth-subtitle">
            {isLogin ? 'Sign in to access your secure messages' : 'Get started with end-to-end encrypted chat'}
          </p>
        </div>

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="auth-input-wrapper">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="auth-input"
                required
              />
            </div>
          )}
          
          <div className="auth-input-wrapper">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              autoComplete="username"
              required
            />
          </div>
          
          <div className="auth-input-wrapper">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {isLogin && (
            <label className="auth-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="auth-remember-checkbox"
              />
              <span>Remember me</span>
            </label>
          )}

          <button type="submit" className="auth-btn">
            {isLogin ? 'Sign In' : 'Register'}
          </button>
        </form>

        <div className="auth-footer">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <span 
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }} 
            className="auth-link"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Auth;
