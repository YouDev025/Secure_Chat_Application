import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Auth from './components/Auth';
import Chat from './components/Chat';

const Main: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme ? savedTheme === 'dark' : true;
    document.body.classList.toggle('light-theme', !isDark);
  }, []);

  return user ? <Chat /> : <Auth />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Main />
    </AuthProvider>
  );
};

export default App;
