// MINIMAL TEST v2 - Force rebuild
export default function StudyPlay() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'blue',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '48px',
      fontWeight: 'bold',
      zIndex: 99999,
      gap: '20px'
    }}>
      <div style={{ fontSize: '96px' }}>✅</div>
      <div>ROUTING WORKS!</div>
      <div style={{ fontSize: '16px', opacity: 0.8 }}>
        StudyPlay component is mounting correctly via Wouter
      </div>
    </div>
  );
}
