import { ChatGate } from "@chatgate/react";

const installedPackages = ["@chatgate/core@0.3.0", "@chatgate/react@0.3.0"];

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
      <section className="demo-panel" aria-label="ChatGate example">
        <ChatGate
          publicKey="cg_pub_z1lzc3otAHo_jWq0fFq8CDEV"
          organizationId="cmsesv871000cro1lf82msw20"
          userId="customer-1234"
          userName="Customer"
          title="ChatGate support"
        />
      </section>
    </main>
  );
}
