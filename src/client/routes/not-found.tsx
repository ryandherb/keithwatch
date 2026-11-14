import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="empty-state">
      <span className="empty-state__code">404</span>
      <p>This page doesn't exist.</p>
      <Link to="/" className="button">
        Go home
      </Link>
    </div>
  );
}
