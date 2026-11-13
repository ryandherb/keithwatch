import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <>
      <h1>404</h1>
      <p>This page doesn't exist.</p>
      <Link to="/">Go home</Link>
    </>
  );
}
