// Routes reachable without a session. Extracted from AuthGate (v3.1 follow-up
// 10i) because two components now need the same list — AuthGate to decide
// where to redirect, AppShell to decide which chrome to render — and a
// duplicated list would eventually disagree with itself, which fails in the
// worst way: a page that renders app chrome and then redirects you out of it.
//
// `/welcome` is the public landing page. `/set-password` handles both the
// invite and the reset link, and `/forgot-password` is how you request one —
// all three have to work for someone who has no account yet or can't get into
// the one they have, which is the entire point of them.
export const PUBLIC_PATHS = ['/welcome', '/login', '/forgot-password', '/set-password']
