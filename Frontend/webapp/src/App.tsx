import { useState } from 'react';
import { GatewayView } from './views/gateway/GatewayView';
import { ChatView } from './views/chat/ChatView';
import { AdminShell } from './views/admin/AdminShell';

type Screen = 'gateway' | 'chat' | 'admin';

export default function App() {
  const [screen, setScreen] = useState<Screen>('gateway');

  if (screen === 'chat') return <ChatView />;
  if (screen === 'admin') return <AdminShell onLoggedOut={() => setScreen('gateway')} />;
  return (
    <GatewayView onEnterChat={() => setScreen('chat')} onAdminLoggedIn={() => setScreen('admin')} />
  );
}
