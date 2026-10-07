# Component design

Use [Writing Resilient Components](https://overreacted.io/writing-resilient-components/) as a design reference. Apply its principles to the registry's TypeScript builders as well as the React docs site.

- Derive output from current inputs on every call or render. Use `initial` or `default` prefixes only when subsequent input changes are intentionally ignored.
- Keep message builders pure. Posting, authentication, and workflow transitions belong in explicit userland handlers.
- Support multiple independent messages and component instances. Route shared action IDs using interaction message context; avoid a global "current sign-in" or shared mutable instance state.
- Keep instance state local. Make intentionally shared application state and its owner explicit.
- Preserve Block Kit field names and meanings, including `url` and `visible_to_user_ids`. Name callbacks for the event they report: a sign-in click is distinct from verified sign-in completion.
- Userland decides when to send a message and how to handle cancellation or authentication. Examples should show that wiring directly.
- Favor behavior that remains correct when inputs change or rendering repeats. Add abstractions and optimizations for concrete needs, and use linting to catch bugs while formatting handles style.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
