import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="empty-state">
      <h1 style={{ fontSize: 48, margin: 0 }}>404</h1>
      <p>The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn" style={{ marginTop: 12 }}>Go home</Link>
    </div>
  );
}
