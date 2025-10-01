export default function CleanTest() {
  return (
    <div
      style={{
        backgroundColor: '#ff0000',
        color: 'white',
        fontSize: '32px',
        fontWeight: 'bold',
        textAlign: 'center',
        padding: '100px 20px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <h1 style={{ fontSize: '48px', marginBottom: '30px' }}>🚨 CLEAN TEST PAGE WORKING!</h1>

      <p style={{ fontSize: '24px', marginBottom: '20px' }}>
        If you see this bright red page, React is working!
      </p>

      <div
        style={{
          fontSize: '18px',
          backgroundColor: 'rgba(255,255,255,0.2)',
          padding: '20px',
          borderRadius: '10px',
          marginTop: '30px',
        }}
      >
        <p>
          <strong>URL:</strong>{' '}
          {typeof window !== 'undefined' ? window.location.href : 'Loading...'}
        </p>
        <p>
          <strong>Time:</strong> {new Date().toLocaleTimeString()}
        </p>
      </div>

      <div style={{ marginTop: '40px' }}>
        <a
          href="/pumpdrive/unified"
          style={{
            color: 'white',
            fontSize: '20px',
            textDecoration: 'underline',
            display: 'block',
            margin: '10px 0',
          }}
        >
          → Go to Assessment Page
        </a>
        <a
          href="/pumpdrive/results"
          style={{
            color: 'white',
            fontSize: '20px',
            textDecoration: 'underline',
            display: 'block',
            margin: '10px 0',
          }}
        >
          → Go to Results Page
        </a>
      </div>
    </div>
  );
}
