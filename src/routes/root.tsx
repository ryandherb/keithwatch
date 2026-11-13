import { Outlet } from "react-router";
import { NavBar } from "@/components/NavBar";

/** Shared layout wrapping every page. Child routes render into <Outlet />. */
export default function RootLayout() {
  return (
    <>
      <NavBar />
      <main className="app">
        <Outlet />
      </main>
    </>
  );
}
