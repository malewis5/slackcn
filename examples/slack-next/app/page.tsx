/* oxlint-disable nextjs/no-html-link-for-pages -- OAuth needs a full-page navigation. */
export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <a
        href="/api/slack/install"
        className="rounded-md bg-[#611f69] px-4 py-2 text-sm font-bold text-white"
      >
        Add to Slack
      </a>
    </main>
  );
}
