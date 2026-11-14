import SearchBar from "@/features/search/components/SearchBar";

export default function HomePage() {
  return (
    <section className="hero">
      <h1>Keithwatch</h1>
      <p>ani-cli companion app</p>
      <SearchBar />
    </section>
  );
}
