import SearchBar from "@/features/search/components/SearchBar";
import { getStatus } from "@/features/status/api/status";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [aniCliMissing, setAniCliMissing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getStatus(controller.signal)
      .then((status) => setAniCliMissing(!status.aniCli.installed))
      .catch(() => { })

    return () => controller.abort();
  }, [])
  return (
    <section className="hero">
      <h1>Keithwatch</h1>
      <p>ani-cli companion app</p>
      {aniCliMissing ?
        <p role="alert">
          ani-cli isn't installed or isn't available on the server's path, so playback will not work. 
          Install it, or set ANI_CLI_BIN to its full path, then reload. 
          For instructions on how to install it, visit <a href="https://github.com/pystardust/ani-cli#install">this page</a>.
        </p> :
        <SearchBar />
      }
    </section>
  );
}
