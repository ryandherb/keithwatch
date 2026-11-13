import logo from "@/assets/logo.svg";
import reactLogo from "@/assets/react.svg";

export default function HomePage() {
  return (
    <>
      <div className="logo-container">
        <img src={logo} alt="Bun Logo" className="logo bun-logo" />
        <img src={reactLogo} alt="React Logo" className="logo react-logo" />
      </div>

      <h1>keithwatch</h1>
      <p>
        Edit <code>src/routes/home.tsx</code> and save to test HMR
      </p>
    </>
  );
}
