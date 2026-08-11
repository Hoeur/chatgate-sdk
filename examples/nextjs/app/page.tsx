import { SupportChat } from "@/features/support-chat/support-chat";

const installedPackages = ["@chatgate/core@0.2.0", "@chatgate/react@0.2.0"];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="intro" aria-labelledby="sample-title">
        <p className="eyebrow">Full SDK verification</p>
        <h1 id="sample-title">ChatGate SDK for Next.js</h1>
        <p className="lede">
          This app exercises the complete ChatGate customer conversation contract:
          text, images, files, voice, replies, reactions, presence, typing, read
          receipts, history, REST, uploads, and Socket.IO.
        </p>
        <ul className="package-list" aria-label="Installed packages">
          {installedPackages.map((packageName) => (
            <li key={packageName}>{packageName}</li>
          ))}
        </ul>
      </section>
      <SupportChat />
    </main>
  );
}
