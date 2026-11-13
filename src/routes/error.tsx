import { isRouteErrorResponse, Link, useRouteError } from "react-router";

/** Rendered when a route throws during render or in a loader/action. */
export default function ErrorPage() {
  const error = useRouteError();

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Unknown error";

  return (
    <main className="app">
      <h1>Something went wrong</h1>
      <p>{message}</p>
      <Link to="/">Go home</Link>
    </main>
  );
}
