import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { 
  Shield, 
  ShieldAlert, 
  Terminal, 
  Activity, 
  Lock, 
  Unlock, 
  Eye, 
  Hash, 
  Zap, 
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Menu,
  ChevronRight,
  Database,
  Cpu
} from 'lucide-react';
import './App.css';

// --- Components ---

const Sidebar = ({ currentMode, activePage, setActivePage, resetSystem, sysStatus }) => {
  const menuItems = [
    { id: 'landing', label: 'Dashboard', icon: Activity },
    { id: 'hack', label: 'Hack Module', icon: Zap },
    { id: 'logs', label: 'Security Logs', icon: Terminal },
    { id: 'devices', label: 'Device Monitor', icon: Cpu },
    { id: 'comparison', label: 'Security Comparison', icon: Shield },
  ];

  return (
    <aside className="glass-card" style={{ 
      width: '280px', 
      height: '100%', 
      borderRadius: '0', 
      borderLeft: 'none', 
      borderTop: 'none', 
      borderBottom: 'none',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 10
    }}>
      <div style={{ padding: '2rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className={currentMode === 'secure' ? 'glow-green' : 'glow-red'}>
          <ShieldAlert size={32} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.1rem', margin: 0, letterSpacing: '0.05em' }}>GUARD_PROTOCOL</h2>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.2em' }}>SEC_MONITOR_SYS_V1</span>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '1rem' }}>
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem',
              marginBottom: '0.5rem',
              borderRadius: '8px',
              color: activePage === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: activePage === item.id ? 'var(--surface-hover)' : 'transparent',
              borderLeft: activePage === item.id ? `3px solid ${currentMode === 'secure' ? 'var(--green)' : 'var(--red)'}` : '3px solid transparent'
            }}
          >
            <item.icon size={20} />
            <span style={{ fontWeight: 500 }}>{item.label}</span>
          </button>
        ))}
      </nav>

      <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Security Mode</span>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button 
              disabled
              style={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '0.8rem',
                borderRadius: '4px',
                background: currentMode === 'insecure' ? 'rgba(255, 62, 62, 0.1)' : 'transparent',
                border: `1px solid ${currentMode === 'insecure' ? 'var(--red)' : 'var(--border-color)'}`,
                color: currentMode === 'insecure' ? 'var(--red)' : 'var(--text-secondary)',
                cursor: 'default'
              }}
            >
              INSECURE
            </button>
            <button 
              disabled
              style={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '0.8rem',
                borderRadius: '4px',
                background: currentMode === 'secure' ? 'rgba(0, 255, 157, 0.1)' : 'transparent',
                border: `1px solid ${currentMode === 'secure' ? 'var(--green)' : 'var(--border-color)'}`,
                color: currentMode === 'secure' ? 'var(--green)' : 'var(--text-secondary)',
                cursor: 'default'
              }}
            >
              SECURE
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          <Activity size={14} className={sysStatus.serialConnected ? "animate-pulse glow-green" : "glow-red"} />
          <span>{sysStatus.serialConnected ? 'Hardware Connected' : 'Hardware Offline'}</span>
        </div>
        <button 
          onClick={resetSystem}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '0.75rem',
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        >
          <Zap size={14} /> RESET SYSTEM
        </button>
      </div>
    </aside>
  );
};

const Header = ({ currentMode, sysStatus }) => {
  return (
    <header style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: '2rem' 
    }}>
      <div>
        <h1 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {sysStatus.alarm ? <AlertTriangle className="glow-red animate-pulse" /> : <Shield className={currentMode === 'secure' ? 'glow-green' : 'glow-red'} />}
          {currentMode === 'secure' ? 'Secure Authentication System' : 'Standard Authentication System'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: sysStatus.serialConnected ? 'var(--green)' : 'var(--red)',
            display: 'inline-block'
          }}></span>
          {sysStatus.serialConnected ? 'Hardware System Online' : 'Hardware System Disconnected'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>DOOR STATE</div>
            <div className={sysStatus.doorOpen ? 'glow-green' : 'glow-red'} style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
              {sysStatus.doorOpen ? 'OPEN' : 'LOCKED'}
            </div>
          </div>
          <Lock size={20} className={sysStatus.doorOpen ? 'glow-green' : 'glow-red'} />
        </div>
        
        <div className="glass-card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>ALARM STATUS</div>
            <div className={sysStatus.alarm ? 'glow-red animate-pulse' : 'text-primary'} style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
              {sysStatus.alarm ? 'ACTIVE' : 'IDLE'}
            </div>
          </div>
          <Activity size={20} className={sysStatus.alarm ? 'glow-red animate-pulse' : 'glow-blue'} />
        </div>
      </div>
    </header>
  );
};

// --- Main App ---

function App() {
  const [currentMode, setMode] = useState('insecure'); // 'insecure' or 'secure'
  const [activePage, setActivePage] = useState('landing');
  const [sysStatus, setSysStatus] = useState({
    doorOpen: false,
    alarm: false,
    lockout: false,
    networkTraffic: [],
    logs: [],
    networkStatus: 'CONNECTING',
    serialConnected: false,
    socketConnected: false,
    rfidStatus: 'READY',
    cardStatus: 'NONE',
    lastSniffedPin: null,
    availablePorts: [],
    rfidVersion: '0x00',
    activePort: null,
    serialLogs: []
  });

  // --- Socket Integration ---
  const socketRef = useRef(null);

  useEffect(() => {
    // Connect to backend
    socketRef.current = io('http://localhost:5001');

    socketRef.current.on('connect', () => {
      console.log('Connected to security backend');
      setSysStatus(prev => ({ ...prev, socketConnected: true }));
    });

    socketRef.current.on('disconnect', () => {
      console.log('Lost connection to backend');
      setSysStatus(prev => ({ ...prev, socketConnected: false }));
    });

    socketRef.current.on('system_state', (state) => {
      // Sync local state with backend source of truth
      setMode(state.mode.toLowerCase());
      setSysStatus(prev => ({
        ...prev,
        doorOpen: state.doorState === 'OPEN',
        alarm: state.alarmStatus === 'ACTIVE',
        lockout: state.lockout,
        rfidRequired: state.rfidRequired,
        rfidStatus: state.rfidStatus,
        cardStatus: state.cardStatus,
        serialConnected: state.serialConnected,
        networkStatus: state.networkStatus,
        activePort: state.activePort,
        lastDisplayPin: state.lastDisplayPin, // Sync the hashed/plain PIN
        actualPin: state.actualPin,
        isWaitingForCard: state.isWaitingForCard,
        lastSniffedPin: state.lastSniffedPin,
        availablePorts: state.availablePorts || [],
        rfidVersion: state.rfidVersion
      }));
    });

    socketRef.current.on('logs_history', (history) => {
      setSysStatus(prev => ({ ...prev, logs: history }));
    });

    socketRef.current.on('new_log', (log) => {
      setSysStatus(prev => {
        const newLogs = [log, ...prev.logs].slice(0, 100);
        // If the log is from ESP32, add to serial terminal too
        const newSerialLogs = log.source === 'DOOR_ESP32' 
          ? [log.message, ...prev.serialLogs].slice(0, 10) 
          : prev.serialLogs;
          
        return {
          ...prev,
          logs: newLogs,
          serialLogs: newSerialLogs
        };
      });
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const addLog = useCallback((message, type = 'INFO', source = 'DASHBOARD') => {
    const newLog = {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString(),
      message,
      type: type.toUpperCase(),
      source
    };
    setSysStatus(prev => ({
      ...prev,
      logs: [newLog, ...prev.logs].slice(0, 100)
    }));
  }, []);

  const resetSystem = () => {
    // Trigger reset on backend
    fetch('http://localhost:5001/api/reset', { method: 'POST' });
    addLog('System reset requested.', 'INFO');
  };

  return (
    <div className="app-container">
      <Sidebar 
        currentMode={currentMode} 
        activePage={activePage} 
        setActivePage={setActivePage} 
        resetSystem={resetSystem}
        sysStatus={sysStatus}
      />
      
      <main className="main-content">
        <div className="scanline"></div>
        <Header currentMode={currentMode} sysStatus={sysStatus} />
        
        {activePage === 'landing' && <LandingView setActivePage={setActivePage} currentMode={currentMode} sysStatus={sysStatus} />}
        {activePage === 'hack' && <HackView currentMode={currentMode} sysStatus={sysStatus} setSysStatus={setSysStatus} addLog={addLog} />}
        {activePage === 'logs' && <LogsView logs={sysStatus.logs} />}
        {activePage === 'devices' && <DeviceMonitorView sysStatus={sysStatus} />}
        {activePage === 'comparison' && <ComparisonView />}
      </main>
    </div>
  );
}

// --- Dashboard Components ---

const SystemStatusCards = ({ currentMode, sysStatus }) => {
  const stats = [
    { label: 'ACTIVE MODE', value: currentMode.toUpperCase(), icon: Shield, color: currentMode === 'secure' ? 'var(--green)' : 'var(--red)' },
    { label: 'WIFI STATUS', value: (sysStatus.networkStatus || 'OFFLINE').toUpperCase(), icon: Zap, color: sysStatus.networkStatus === 'CONNECTED' ? 'var(--blue)' : sysStatus.networkStatus === 'CONNECTING' ? 'var(--amber)' : 'var(--red)' },
    { label: 'CARD STATUS', value: (sysStatus.cardStatus || 'NONE').toUpperCase(), icon: Database, color: sysStatus.cardStatus === 'REGISTERED' ? 'var(--green)' : 'var(--text-muted)' },
    { label: 'HARDWARE', value: sysStatus.serialConnected ? 'CONNECTED' : 'OFFLINE', icon: Activity, color: sysStatus.serialConnected ? 'var(--green)' : 'var(--red)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
      {stats.map(s => (
        <div key={s.label} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
          <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', color: s.color }}>
            <s.icon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>{s.label}</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: s.color }}>{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const LandingView = ({ setActivePage, currentMode, sysStatus }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', flex: 1 }}>
      <SystemStatusCards currentMode={currentMode} sysStatus={sysStatus} />
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', flex: 1 }}>
        <button 
          onClick={() => setActivePage('hack')}
          className="glass-card" 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '1.5rem',
            border: '2px solid transparent',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--red)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
        >
          <div style={{ padding: '2rem', borderRadius: '50%', background: 'rgba(255, 62, 62, 0.1)', color: 'var(--red)' }}>
            <Zap size={64} className="glow-red" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>HACK</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '300px' }}>
              Simulate Brute Force and Network Sniffing attacks to test system vulnerabilities.
            </p>
          </div>
        </button>

        <button 
          onClick={() => setActivePage('logs')}
          className="glass-card" 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '1.5rem',
            border: '2px solid transparent'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--blue)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
        >
          <div style={{ padding: '2rem', borderRadius: '50%', background: 'rgba(0, 212, 255, 0.1)', color: 'var(--blue)' }}>
            <Terminal size={64} className="glow-blue" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>WATCH LOGS</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '300px' }}>
              Monitor real-time security events, access attempts, and system status.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};

// --- Hack Module Components ---

const BruteForceModule = ({ currentMode, sysStatus, addLog }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentPin, setCurrentPin] = useState('000');
  const [attempts, setAttempts] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Sync state with backend lockout
  const status = sysStatus.lockout ? 'LOCKED' : (isRunning ? 'RUNNING' : (sysStatus.doorOpen ? 'SUCCESS' : 'READY'));

  // Validation and Auto-Reset logic
  useEffect(() => {
    if (!sysStatus.serialConnected) {
      setErrorMessage('Attack blocked: Device not connected');
      setIsRunning(false);
    } else if (currentMode === 'secure') {
      setErrorMessage('ATTACK BLOCKED: High-entropy PIN detected. Brute force ineffective.');
      setIsRunning(false);
    } else if (!sysStatus.actualPin) {
      setErrorMessage('Sistemde kurulu bir şifre yok veya backend henüz senkronize olmadı. Önce şifre oluşturun.');
      setIsRunning(false);
    } else if (!sysStatus.lastSniffedPin) {
      setErrorMessage('Lütfen önce Sniffer ile ağdan bir şifre paketi yakalayın.');
      setIsRunning(false);
    } else if (sysStatus.isSniffedPinValid === false) {
      setErrorMessage('Ağda yakalanan şifre paketi geçersiz (hatalı şifre denemesi). Lütfen doğru şifre içeren bir paket yakalayın.');
      setIsRunning(false);
    } else if (sysStatus.lockout) {
      setErrorMessage('SYSTEM LOCKED: Too many failed attempts. Reset the door hardware.');
      setIsRunning(false);
    } else if (sysStatus.doorOpen) {
      setErrorMessage('SUCCESS: Door Unlocked!');
    } else {
      setErrorMessage('');
    }
  }, [sysStatus.serialConnected, currentMode, sysStatus.actualPin, sysStatus.lastSniffedPin, sysStatus.isSniffedPinValid, sysStatus.lockout, sysStatus.doorOpen]);

  // Reset module when new PIN is detected in the system
  const lastPinRef = useRef(sysStatus.lastSniffedPin);
  useEffect(() => {
    if (sysStatus.lastSniffedPin !== lastPinRef.current) {
        lastPinRef.current = sysStatus.lastSniffedPin;
        setAttempts(0);
        setIsRunning(false);
        setCurrentPin('000');
        addLog(`ALERT: New PIN target intercepted (${sysStatus.lastSniffedPin}). Attack module re-armed.`, 'WARNING');
    }
  }, [sysStatus.lastSniffedPin, addLog]);

  useEffect(() => {
    let interval;
    if (isRunning && !sysStatus.lockout && !sysStatus.doorOpen) {
      interval = setInterval(() => {
        setAttempts(prev => prev + 1);
        
        if (currentMode === 'insecure') {
          // Ağdan dinlenen son şifreyi kırmaya çalışıyoruz (Kullanıcı yanlış girdiyse yanlış şifre kırılır)
          const targetPin = sysStatus.lastSniffedPin || '123';
          
          if (attempts > 35 && isRunning) {
            setCurrentPin(targetPin);
            setIsRunning(false);
            
            // Asıl doğrulamayı ESP32 yapacak. Biz sadece deniyoruz.
            setErrorMessage('');
            addLog(`Brute Force extracted PIN ${targetPin}. Sending to door for verification...`, 'INFO');
            
            // Kapıya auth gönderiyoruz
            fetch('http://localhost:5001/api/send-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: `AUTH;MODE=UNSAFE;PIN=${targetPin}` })
            });
            return;
          }

          const nextPin = String(Math.floor(Math.random() * 999)).padStart(3, '0');
          const displayPin = (attempts > 25 && Math.random() > 0.6) ? targetPin : nextPin;
          setCurrentPin(displayPin);
        } else {
          // SECURE MODE: Random 9-digit attempts that NEVER succeed
          const nextPin = String(Math.floor(Math.random() * 999999999)).padStart(9, '0');
          setCurrentPin(nextPin);
          
          if (attempts > 50) {
            setIsRunning(false);
            setErrorMessage('ATTACK FAILED: Complexity threshold exceeded. System locked down.');
            addLog('SECURITY ALERT: Brute force attempt blocked by encryption layer.', 'DANGER');
            
            fetch('http://localhost:5001/api/send-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'LOCKOUT' })
            });
          }
        }
      }, 60);
    } else if (sysStatus.lockout || sysStatus.doorOpen) {
        setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, attempts, currentMode, sysStatus.lockout, sysStatus.doorOpen, sysStatus.lastSniffedPin, addLog]);

  const startAttack = () => {
    setIsRunning(true);
    setAttempts(0);
    addLog(`Initiating Brute Force Attack on ${currentMode.toUpperCase()} target...`, 'WARNING');
  };

  const stopAttack = () => {
    setIsRunning(false);
    addLog('Brute Force Attack halted by operator.', 'INFO');
  };

  return (
    <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Hash size={18} /> Brute Force Simulation
        </h3>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>SEARCH SPACE: {currentMode === 'insecure' ? '1,000' : '1,000,000,000'}</span>
      </div>

      <div style={{ background: '#000', padding: '2rem', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>TESTING COMBINATION</div>
        <div className="mono" style={{ fontSize: '3rem', letterSpacing: '0.2em', color: status === 'SUCCESS' ? 'var(--green)' : status === 'LOCKED' ? 'var(--red)' : 'var(--text-primary)' }}>
          {currentPin}
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '2rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>ATTEMPTS</div>
            <div className="mono">{attempts}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>STATUS</div>
            <div className={status === 'SUCCESS' ? 'glow-green' : status === 'LOCKED' ? 'glow-red' : 'glow-blue'}>{status}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
        {errorMessage && (
          <div style={{ padding: '0.75rem', background: 'rgba(255, 62, 62, 0.1)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: '4px', fontSize: '0.8rem', textAlign: 'center' }}>
            <AlertTriangle size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
            {errorMessage}
          </div>
        )}
        
        {!isRunning ? (
          <button 
            onClick={startAttack}
            disabled={!!errorMessage}
            style={{ 
              flex: 1, 
              padding: '1rem', 
              background: !!errorMessage ? 'rgba(255,255,255,0.05)' : 'var(--red)', 
              color: !!errorMessage ? 'var(--text-muted)' : 'white', 
              borderRadius: '8px', 
              fontWeight: 'bold',
              cursor: !!errorMessage ? 'not-allowed' : 'pointer'
            }}
          >
            START ATTACK
          </button>
        ) : (
          <button 
            onClick={stopAttack}
            style={{ flex: 1, padding: '1rem', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: '8px', fontWeight: 'bold' }}
          >
            STOP ATTACK
          </button>
        )}
      </div>
    </div>
  );
};

const SniffingModule = ({ currentMode, sysStatus, addLog }) => {
  const [isSniffing, setIsSniffing] = useState(false);
  const [localPackets, setLocalPackets] = useState([]);
  const lastProcessedId = useRef(null);
  
  // Real network traffic interception based on sysStatus logs
  useEffect(() => {
    if (sysStatus.logs.length === 0) return;
    
    if (!isSniffing) {
        lastProcessedId.current = sysStatus.logs[0].id;
        return;
    }

    // Find all new logs since last processed
    const newLogs = [];
    for (let i = 0; i < sysStatus.logs.length; i++) {
        if (sysStatus.logs[i].id === lastProcessedId.current) break;
        newLogs.unshift(sysStatus.logs[i]); // Add in chronological order
    }
    
    if (newLogs.length === 0) return;
    lastProcessedId.current = sysStatus.logs[0].id;

    const isSecure = currentMode === 'secure';

    setLocalPackets(prev => {
        let updatedPackets = [...prev];
        
        newLogs.forEach(log => {
            const eventType = log.meta?.eventType;
            if (!eventType) return;

            if (eventType === 'PIN_SNIFFED' || eventType === 'PIN_UPDATE' || eventType === 'PIN_HASH_UPDATE' || eventType === 'DATA_SNIFFED') {
                const isData = eventType === 'DATA_SNIFFED' || isSecure;
                const payload = isData ? `AUTH;MODE=SAFE;DATA=${sysStatus.lastDisplayPin}` : `AUTH;MODE=UNSAFE;PIN=${sysStatus.lastDisplayPin}`;
                
                let message = 'Şifre paketi yakalandı... Kapının tepkisi bekleniyor.';
                if (isData) message = 'Gelen şifre hash ile saklanıyor, anlamsız paket!';
                
                const newPacket = {
                    id: log.id,
                    time: log.time,
                    src: '192.168.4.1',
                    dst: '192.168.4.2',
                    payload: payload,
                    readable: !isSecure,
                    message: message
                };
                updatedPackets = [newPacket, ...updatedPackets];
            } 
            else if (eventType === 'ACCESS_GRANTED') {
                if (updatedPackets.length > 0) {
                    updatedPackets[0] = { ...updatedPackets[0], message: '✅ Doğru şifre girildi! Kapı açıldı. Şifre doğrulandı.' };
                }
            }
            else if (eventType === 'ACCESS_DENIED') {
                if (updatedPackets.length > 0) {
                    updatedPackets[0] = { ...updatedPackets[0], message: '❌ Yanlış şifre denemesi! Kapı reddetti.' };
                }
            }
        });
        
        return updatedPackets.slice(0, 50);
    });

  }, [sysStatus.logs, currentMode, isSniffing, sysStatus.lastDisplayPin]);

  return (
    <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Eye size={18} /> Network Sniffer
        </h3>
        <button 
          onClick={() => {
              setIsSniffing(!isSniffing);
              if (!isSniffing) {
                  setLocalPackets([{
                      id: Date.now(), time: new Date().toLocaleTimeString().split(' ')[0],
                      src: 'SYSTEM', dst: 'BROADCAST', payload: 'STARTING PACKET CAPTURE...', readable: true, message: 'Ağ dinleniyor...'
                  }]);
              }
          }}
          style={{ 
            padding: '0.4rem 1rem', 
            borderRadius: '20px', 
            background: isSniffing ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
            border: `1px solid ${isSniffing ? 'var(--blue)' : 'var(--border-color)'}`,
            color: isSniffing ? 'var(--blue)' : 'var(--text-secondary)',
            fontSize: '0.8rem'
          }}
        >
          {isSniffing ? 'SNIFFING...' : 'START SNIFFER'}
        </button>
      </div>

      <div style={{ flex: 1, background: '#05070a', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr', padding: '0.5rem 1rem', background: 'var(--surface-color)', fontSize: '0.7rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
          <span>TIME</span>
          <span>SOURCE</span>
          <span>PAYLOAD / DETECTED</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {!isSniffing && localPackets.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Sniffer offline. Click Start Sniffer to monitor traffic.
            </div>
          ) : localPackets.length === 1 && localPackets[0].src === 'SYSTEM' ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)', fontSize: '0.8rem', animation: 'pulse 2s infinite' }}>
              Listening for password inputs on the network...
            </div>
          ) : (
            localPackets.map(p => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr', padding: '0.5rem', fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', color: p.readable ? 'var(--amber)' : 'var(--text-secondary)' }}>
                <span className="mono">{p.time}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.src}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span className="mono" style={{ color: p.readable ? 'var(--red)' : 'inherit' }}>{p.payload}</span>
                    {p.message && <span style={{ color: p.readable ? 'var(--amber)' : 'var(--green)', fontSize: '0.65rem' }}>↳ {p.message}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const DeviceMonitorView = ({ sysStatus }) => {
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const remotePinLocked = sysStatus.rfidRequired || (sysStatus.lastEvent || '').includes('MODE_SAFE');

  return (
    <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cpu size={18} /> Hardware Device Manager
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
          <span className="animate-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)' }}></span>
          System Online: {sysStatus.rfidVersion !== '0x00' ? 'RFID Healthy' : 'RFID Error'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {/* Hardware Status Cards */}
        <div className="glass-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>RFID MODULE HEALTH</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: sysStatus.rfidVersion !== '0x00' ? 'var(--green)' : 'var(--red)' }}>
                    {sysStatus.rfidVersion !== '0x00' ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>VERSION: {sysStatus.rfidVersion}</span>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: sysStatus.rfidVersion !== '0x00' ? 'var(--text-secondary)' : 'var(--red)' }}>
                {sysStatus.rfidVersion !== '0x00' ? 'SPI communication stable.' : 'Check MISO/MOSI/SCK/SS connections!'}
            </div>
        </div>
        {sysStatus.availablePorts.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Activity size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p>No serial devices detected. Check your USB connections.</p>
          </div>
        ) : (
          sysStatus.availablePorts.map(port => {
            const isActive = sysStatus.serialConnected && port.path === sysStatus.activePort;
            return (
              <div key={port.path} className="glass-card" style={{ 
                background: 'rgba(255,255,255,0.02)', 
                border: isActive ? '1px solid var(--green)' : '1px solid var(--border-color)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isActive ? 'var(--green)' : 'var(--text-primary)' }}>{port.path}</div>
                  <div style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: isActive ? 'rgba(0, 255, 157, 0.1)' : 'rgba(255,255,255,0.05)', color: isActive ? 'var(--green)' : 'var(--text-secondary)' }}>
                    {isActive ? 'ACTIVE LINK' : 'AVAILABLE'}
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Manufacturer:</span>
                    <span>{port.manufacturer || 'Generic Device'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Hardware ID:</span>
                    <span className="mono" style={{ fontSize: '0.7rem' }}>{port.vendorId ? `${port.vendorId}:${port.productId}` : 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Serial Number:</span>
                    <span className="mono" style={{ fontSize: '0.7rem' }}>{port.serialNumber || 'Unknown'}</span>
                  </div>
                </div>

                {isActive && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(0, 255, 157, 0.1)', color: 'var(--green)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={12} className="animate-pulse" />
                    Receiving live telemetry...
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="glass-card" style={{ marginTop: '1rem', background: 'rgba(0, 212, 255, 0.05)', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
        <h4 style={{ color: 'var(--blue)', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={14} /> REMOTE PIN CONFIGURATION
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!isVerified ? (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <input 
                type="text" 
                value={currentPinInput}
                onChange={(e) => setCurrentPinInput(e.target.value)}
                placeholder="Enter Current System PIN to unlock configuration"
                disabled={remotePinLocked}
                style={{ flex: 1, padding: '0.75rem', background: '#000', border: '1px solid var(--border-color)', color: remotePinLocked ? 'var(--text-muted)' : 'white', borderRadius: '4px', fontSize: '0.8rem', cursor: remotePinLocked ? 'not-allowed' : 'text' }}
              />
              <button 
                onClick={() => {
                  if (remotePinLocked) return alert('Remote PIN updates are disabled in secure mode.');
                  if (!sysStatus.actualPin) {
                    alert('Sistemde kurulu bir şifre yok veya backend henüz senkronize olmadı. Önce şifre oluşturun.');
                    return;
                  }
                  if (currentPinInput === sysStatus.actualPin) {
                    setIsVerified(true);
                    alert('Mevcut şifre doğrulandı! Şimdi yeni şifreyi girebilirsiniz.');
                  } else {
                    alert('HATALI MEVCUT ŞİFRE!');
                  }
                }}
                disabled={remotePinLocked}
                style={{ padding: '0.75rem 1.5rem', background: remotePinLocked ? 'rgba(255,255,255,0.08)' : 'var(--amber)', color: remotePinLocked ? 'var(--text-muted)' : 'black', border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: remotePinLocked ? 'not-allowed' : 'pointer' }}
              >
                VERIFY CURRENT PIN
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <input 
                type="text" 
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value)}
                placeholder="Enter New PIN (e.g. 999)"
                disabled={remotePinLocked}
                style={{ flex: 1, padding: '0.75rem', background: '#000', border: '1px solid var(--border-color)', color: remotePinLocked ? 'var(--text-muted)' : 'white', borderRadius: '4px', fontSize: '0.8rem', cursor: remotePinLocked ? 'not-allowed' : 'text' }}
              />
              <button 
                onClick={() => {
                  if (remotePinLocked) return alert('Remote PIN updates are disabled in secure mode.');
                  const pin = newPinInput.trim();
                  if(!/^([0-9]{3}|[0-9]{9})$/.test(pin)) {
                    alert('PIN must be exactly 3 digits for insecure mode or 9 digits for secure mode.');
                    return;
                  }
                  fetch('http://localhost:5001/api/send-command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command: `PIN=${pin}` })
                  })
                    .then(res => res.json())
                    .then(data => {
                        alert(data.success ? `Update command sent: ${pin}` : data.message);
                        if(data.success) {
                            setIsVerified(false);
                            setCurrentPinInput('');
                            setNewPinInput('');
                        }
                    })
                    .catch(() => alert('Backend connection failed.'));
                }}
                disabled={remotePinLocked}
                style={{ padding: '0.75rem 1.5rem', background: remotePinLocked ? 'rgba(255,255,255,0.08)' : 'var(--blue)', color: remotePinLocked ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: remotePinLocked ? 'not-allowed' : 'pointer' }}
              >
                UPDATE PIN
              </button>
            </div>
          )}
        </div>
        <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
          *This bypasses the keypad. The command "PIN=XXXX" will be sent directly to the hardware.
        </p>
      </div>

      <div className="glass-card" style={{ marginTop: '1rem', background: '#000', border: '1px solid var(--border-color)', padding: '1rem' }}>
        <h4 style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>LIVE SERIAL DATA (RAW)</span>
            <span className="animate-pulse" style={{ color: 'var(--green)' }}>● RECEIVING</span>
        </h4>
        <div className="mono" style={{ fontSize: '0.75rem', height: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse', gap: '2px' }}>
            {sysStatus.serialLogs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>Waiting for hardware messages...</div>
            ) : (
                sysStatus.serialLogs.map((log, i) => (
                    <div key={i} style={{ color: log.startsWith('[RAW]') ? 'var(--text-secondary)' : 'var(--green)' }}>
                        {log}
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
};

const HackView = ({ currentMode, sysStatus, setSysStatus, addLog }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', flex: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', height: '100%' }}>
        <BruteForceModule currentMode={currentMode} sysStatus={sysStatus} addLog={addLog} />
        <SniffingModule currentMode={currentMode} sysStatus={sysStatus} addLog={addLog} />
      </div>
      
      <div className="glass-card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.5rem', background: 'rgba(255, 62, 62, 0.1)', borderRadius: '4px' }}>
            <AlertTriangle size={20} className="glow-red" />
          </div>
          <div>
            <h4 style={{ fontSize: '0.9rem' }}>Attack Vector Analysis</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {currentMode === 'insecure' 
                ? 'CRITICAL: System is vulnerable to credential harvest and rapid brute force. No encryption detected.' 
                : 'SECURE: End-to-end encryption active. Brute force protection (lockout) is engaged.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const LogsView = ({ logs }) => {
  const getTypeColor = (type) => {
    switch (type) {
      case 'SUCCESS': return 'var(--green)';
      case 'ALERT': return 'var(--red)';
      case 'DANGER': return 'var(--red)';
      case 'WARNING': return 'var(--amber)';
      default: return 'var(--blue)';
    }
  };

  return (
    <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Terminal size={18} /> System Event Timeline
        </h3>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>REAL-TIME MONITORING ACTIVE</span>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {logs.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            No events recorded yet.
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} style={{ 
              display: 'grid', 
              gridTemplateColumns: '100px 80px 1fr', 
              padding: '0.75rem 1rem', 
              background: 'rgba(255,255,255,0.02)', 
              borderRadius: '4px',
              borderLeft: `2px solid ${getTypeColor(log.type)}`
            }}>
              <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>[{log.time}]</span>
              <span className="mono" style={{ fontSize: '0.7rem', fontWeight: 'bold', color: getTypeColor(log.type) }}>{log.type}</span>
              <span style={{ fontSize: '0.85rem' }}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const ComparisonView = () => {
  const features = [
    { name: 'Password Complexity', insecure: '3 Digits (Weak)', secure: '9 Digits (Strong)' },
    { name: 'RFID Authentication', insecure: 'None', secure: 'Required (MFA)' },
    { name: 'Communication', insecure: 'Plaintext (Readable)', secure: 'Encrypted (AES/Hash)' },
    { name: 'Brute Force Resistance', insecure: 'None (Bypassable)', secure: 'High (Lockout/Alarm)' },
    { name: 'Network Sniffing', insecure: 'Vulnerable', secure: 'Resistant' },
    { name: 'Physical Feedback', insecure: 'LED Only', secure: 'Buzzer + Lockout' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', flex: 1 }}>
      <div className="glass-card" style={{ borderTop: '4px solid var(--red)' }}>
        <h2 style={{ color: 'var(--red)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Unlock size={24} /> Insecure System
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {features.map(f => (
            <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255, 62, 62, 0.05)', borderRadius: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{f.name}</span>
              <span style={{ fontWeight: 500 }}>{f.insecure}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ borderTop: '4px solid var(--green)' }}>
        <h2 style={{ color: 'var(--green)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lock size={24} /> Secure System
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {features.map(f => (
            <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0, 255, 157, 0.05)', borderRadius: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{f.name}</span>
              <span style={{ fontWeight: 500 }}>{f.secure}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
