export function CodeBlock({ children, label }: { children: string; label: string }) {
  return (
    <figure className="code-block">
      <figcaption>{label}</figcaption>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Allow keyboard users to scroll long code samples. */}
      <pre tabIndex={0}>
        <code>{children}</code>
      </pre>
    </figure>
  );
}
