import { Link, Outlet } from "react-router";
import { NavBar } from "@/components/NavBar";

/** Shared layout wrapping every page. Child routes render into <Outlet />. */
export default function RootLayout() {
  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="brand">
            keithwatch
          </Link>
          <NavBar />
        </div>
      </header>
      <main className="page">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </>
  );
}
