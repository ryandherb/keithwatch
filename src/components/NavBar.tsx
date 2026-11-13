import { NavLink } from "react-router";

const links = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
];

export function NavBar() {
  return (
    <nav className="navbar">
      {links.map(({ to, label }) => (
        <NavLink key={to} to={to} end>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
