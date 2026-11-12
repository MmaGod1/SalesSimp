# SalesSimp: Your sales, explained in plain words.

## What it does

SalesSimp turns a seller's PayPal sales into a plain-language story. Period filters let sellers choose which months to view. Every story sentence has a "Show numbers" control for its supporting figures. A chat box also lets sellers type questions about their sales.

## Who it's for

Small sellers who find charts and KPIs confusing.

## How it works

- **PayPal:** The server requests a sandbox access token and reads PayPal Transaction Search. Only successful completed payment transactions count as sales. Earlier months come from built-in sample history in PayPal's response format, and the app labels the history as demo data.
- **AI:** The server calls Groq's API using `openai/gpt-oss-20b` by default. Groq classifies typed questions and writes explanations; code performs all calculations. A number check runs before AI explanations are shown. If an explanation fails validation or the explanation call is unavailable, verified template sentences are shown. If question classification fails, the app asks the seller to try again.

## Live demo

[Open the SalesSimp demo](https://sales-simp-8z5ixsnnw-mmagod1s-projects.vercel.app/)

## Run it locally

Requires Node.js 20.9.0 or later.

```sh
npm install
```

Create `.env.local` from `.env.example`, then fill in the server-side values:

```text
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
GROQ_API_KEY=
```

Use PayPal sandbox credentials. Never add real keys, tokens, or client IDs to source control.

```sh
npm run dev
npm test
npm run build
```

## Privacy and security

Secrets stay on the server and must never be committed. Buyer names, email addresses, and transaction IDs are not sent to the AI. The app does not persist sales or conversations; the conversation is held in React state in the browser.

## Known limitations

- The sandbox currently has no completed sales for the live period, so the story relies on built-in sample history.
- Groq can be unavailable. When its explanation fails or does not pass validation, the app uses template sentences; if question understanding fails, the app asks the seller to try again.
- The free AI quota is shared and may be busy.

## Documentation

The product and technical documents are in the repository root:

- [Product requirements](./prd.md)
- [Technical spec](./spec.md)

## Built with

Next.js, React, TypeScript, Tailwind CSS, Vitest, Vercel, PayPal Transaction Search API (sandbox), Groq API, and GitHub Copilot.

## Licence

MIT. See [LICENSE](./LICENSE).
