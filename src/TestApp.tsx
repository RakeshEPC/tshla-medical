export default function TestApp() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Test App is Working!</h1>
      <p>If you can see this, React is loading properly.</p>
      <p>Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}
