# SalesSimp: Technical Spec

This spec turns `prd.md` into a build plan. Anything marked "to verify" must be checked early in the build, not assumed.

## Stack

- **Next.js (App Router), React, TypeScript, Tailwind CSS.** Familiar tools, so the generated code can be reviewed.
- **Vitest** for the pure logic modules only. No UI tests.
- **Vercel** for the public demo.
- **PayPal Transaction Search API** (sandbox) for sales.
- **Groq API** for the AI step, called from the server with plain `fetch`, no extra SDK.
- **Tools used while building:** GitHub Copilot agent, APIMatic Context Plugin (so the agent writes correct PayPal calls), Postman (to try the sandbox calls by hand and document them).

## File structure

```text
SalesSimp/
├── docs/
│   ├── prd.md
│   └── spec.md
├── src/
│   ├── app/
│   │   ├── globals.css            # Tailwind, palette variables, gradients
│   │   ├── layout.tsx             # Root layout, fonts, metadata
│   │   ├── page.tsx               # Client page: period state, story, ask box
│   │   └── api/
│   │       ├── sales/route.ts     # GET: normalized sales for a period (server only)
│   │       └── ask/route.ts       # POST: question in, structured answer out (server only)
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── FilterChips.tsx
│   │   ├── Story.tsx              # Sentences, each with a "show numbers" panel
│   │   ├── AskBox.tsx             # Text box and example questions
│   │   ├── DemoLabel.tsx          # "Includes demo history" and "About this demo"
│   │   └── States.tsx             # Loading, error, empty, unsupported-question views
│   └── lib/
│       ├── paypal/
│       │   ├── client.ts          # Token request, transaction fetching, 31-day windows
│       │   └── normalize.ts       # PayPal response to internal Sale objects
│       ├── demoHistory.ts         # Multi-month demo sales in PayPal's response shape
│       ├── analysis.ts            # Pure calculations (months, totals, trends)
│       ├── analysis.test.ts
│       ├── story.ts               # Sentence templates; each sentence carries its numbers
│       ├── story.test.ts
│       ├── questions.ts           # Allowed question types and validation of AI output
│       ├── questions.test.ts
│       ├── groq.ts                # The two Groq calls and the number check
│       └── types.ts
├── .env.example                   # Placeholder names only, safe to commit
├── .env.local                     # Real secrets, never committed
├── LICENSE                        # MIT
├── README.md
└── package.json
```

## Environment variables (server only)

- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: sandbox credentials from the PayPal developer dashboard.
- `GROQ_API_KEY`: from the Groq console.
- `.env.local` is listed in `.gitignore`. `.env.example` contains the three names with empty values.
- None of these use the `NEXT_PUBLIC_` prefix, so they never reach the browser.

## How the data flows

1. The page asks `/api/sales` for the selected period.
2. The route gets a PayPal access token, then calls Transaction Search for the period in windows of at most 31 days (to verify), following pages until all results are read.
3. `normalize.ts` turns each transaction into a simple `Sale`: id, date, amount, currency, status, and item names if present. Buyer names and emails are dropped at this point and never travel further.
4. Only completed payments count as sales. Others are counted and reported in a small note.
5. The route merges live sales with the demo history and marks each sale's source as `live` or `demo`.
6. `analysis.ts` calculates everything from the merged sales, and `story.ts` turns the results into sentences, each carrying the numbers behind it for the "show numbers" panel.
7. The calculations run in plain TypeScript and the browser only receives finished results.

## How the AI step works

Two small Groq calls, both from `/api/ask`, and neither one calculates anything.

1. **Understand the question.** Groq is given the typed question and the list of allowed question types, and must return only JSON: the question type, the period and the item, if any. `questions.ts` validates that JSON. Unknown types, periods outside the data and item names that do not exist all become an "unsupported" reply.
2. **Explain the result.** Code calculates the answer, then Groq is given only the finished numbers and asked to write a few plain sentences.
3. **Number check.** Every number in the explanation must appear in the numbers Groq was given. If any does not, or if Groq fails or times out, the app uses the template sentences from `story.ts` instead. The seller always gets a correct answer.

Allowed question types: compare two periods, best or slowest month or week, how one item is doing, totals.

What is sent to Groq: the question, finished totals and item names with their revenue. Never buyer details, transaction ids or raw PayPal responses.

## Demo history and live sales

- `demoHistory.ts` holds about four completed months of fictional sales for a demo shop, in PayPal's response shape and generated relative to today, so the completed-month rules behave the same whenever the demo is opened.
- Real sandbox payments carry today's date (assumed, to verify). They fall in the current, unfinished month, so they appear as a "This month so far" sentence and are left out of month comparisons, which follows the completed-months rule.
- The "Includes demo history" label and "About this demo" panel explain this to anyone using the app.
- Currency is taken from the data, and the app handles one currency only. The sandbox account's currency is to verify.

## Important failure modes

- **PayPal token or transaction call fails** (bad credentials, network, rate limit): the page shows the "couldn't reach PayPal" message with Try again. It never shows stale data as fresh. Secrets are never logged or returned.
- **Sandbox returns no transactions or an empty period:** the empty-period message. With the demo history merged in, the app still works.
- **Transactions are slow to appear** (can take up to three hours): create real sandbox payments well before recording the video.
- **Groq fails, times out or returns bad JSON:** the question falls back to a friendly "I couldn't work that out, try one of these" reply. If only the explanation fails, the template sentences are shown.
- **Number check fails:** use the template sentences. Never show the unchecked text.
- **Unsupported question:** the kind reply with example questions. No guessing.

## What was simplified and why

- **Demo shop's sandbox account directly:** no seller login or OAuth flow, because it takes days and does not help the demo.
- **Hybrid data:** sandbox payments cannot be backdated (assumed), so a demo history gives the month-by-month story.
- **No database, no accounts:** nothing is stored. Each visit fetches fresh.
- **Fixed question types:** free typing, but a short list of answerable questions, so answers stay correct.
- **No charts, no dashboard library:** the whole point is words.
- **Plain `fetch` for Groq:** one fewer dependency.

## Decisions

- **AI provider: Groq.** Already used and working in a previous project, free tier, and PayPal provides no model of its own.
- **Partner tools:** APIMatic and Postman are used for building and testing the PayPal side. No other partner is used.
- **Stack: Next.js, TypeScript, Tailwind, Vitest, Vercel.**
- **Server-only secrets and nothing stored.**

## Build order (slices)

0. **Setup and first PayPal call:** create the Next.js project, add `.env.local`, make a first real call that returns sandbox transactions, and start creating sandbox payments.
1. **The story from demo history:** analysis, story and the first screen with filter chips, "show numbers" and the period named. Includes the palette and mobile layout.
2. **Live PayPal data:** the merge, the "This month so far" sentence, the demo label and the loading and error states.
3. **Ask:** the Groq calls, validation, number check, unsupported replies and chips that follow the question.
4. **Ship:** phone and iPad checks, deploy on Vercel, README with setup, a note on the AI tools and partners used, and the demo video.

Each slice ends with `npm test`, `npm run build` and a hands-on check, then a commit with a reviewed file list.

## To verify early in the build

- The sandbox Transaction Search call works with the default app and returns data. Check the 31-day limit and paging.
- Whether sandbox payments can carry item names, which decides whether the item filter and item questions are possible.
- The currency of the sandbox business account.
- That `.env.local` is ignored by git before the first commit.
- Groq's current free-tier limits and the model to use, from Groq's own documentation.
