/**
 * Route table. Each page lives in `routes/` — to add a page, create a file
 * there and register it as a child of the root layout below.
 */
import { createBrowserRouter } from "react-router";
import RootLayout from "./routes/root";
import ErrorPage from "./routes/error";
import HomePage from "./routes/home";
import AboutPage from "./routes/about";
import NotFoundPage from "./routes/not-found";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    ErrorBoundary: ErrorPage,
    children: [
      { index: true, Component: HomePage },
      { path: "about", Component: AboutPage },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
