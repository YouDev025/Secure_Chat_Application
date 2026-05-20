import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Auth from './components/Auth';
import Chat from './components/Chat';

const Main: React.FC = () => {
  const { user } = useAuth();
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
