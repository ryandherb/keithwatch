import { NavLink } from "react-router";

const links = [
  { to: "/", label: "Home" },
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
