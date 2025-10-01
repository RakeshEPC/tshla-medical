export default function SimranPumpLLMDebug() {
  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: 'white',
        minHeight: '100vh',
        color: 'black',
      }}
    >
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>PumpLLM Debug Page - Testing Route</h1>
      <p>If you see this, the route is working!</p>
      <p>Current URL: {window.location.pathname}</p>
      <div style={{ marginTop: '20px' }}>
        <h2>Available Routes:</h2>
        <ul>
          <li>
            <a href="/" style={{ color: 'blue', textDecoration: 'underline' }}>
              Home
            </a>
          </li>
          <li>
            <a href="/test" style={{ color: 'blue', textDecoration: 'underline' }}>
              Test Page
            </a>
          </li>
          <li>
            <a href="/simran/pumpllm" style={{ color: 'blue', textDecoration: 'underline' }}>
              Original PumpLLM
            </a>
          </li>
          <li>
            <a href="/pumpdrive" style={{ color: 'blue', textDecoration: 'underline' }}>
              PumpDrive
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
