// TEST VERSION - Built at: 2025-11-17 (latest)
export default function StudyPlay() {
  const timestamp = new Date().toISOString();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '32px',
      fontWeight: 'bold',
      zIndex: 999999,
      gap: '30px',
      padding: '40px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '120px', animation: 'pulse 2s infinite' }}>🎮</div>
      <div style={{ fontSize: '48px', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
        NIEUWE VERSIE GELADEN!
      </div>
      <div style={{ fontSize: '20px', opacity: 0.9 }}>
        Commit: a2c0575
      </div>
      <div style={{ fontSize: '16px', opacity: 0.8 }}>
        Component mount time: {timestamp}
      </div>
      <div style={{ fontSize: '16px', opacity: 0.8 }}>
        Als je dit ziet → routing werkt perfect ✅
      </div>
      <div style={{ fontSize: '14px', opacity: 0.7, marginTop: '20px' }}>
        URL: {typeof window !== 'undefined' ? window.location.href : 'SSR'}
      </div>
    </div>
  );
}
