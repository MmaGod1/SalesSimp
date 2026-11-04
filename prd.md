# SalesSimp: Product Requirements

SalesSimp explains a small seller's PayPal sales in plain words. She taps filters or types a question, and the answer comes back as a short written story, not a chart.

## Who it is for

A small online seller who is not technical, for example a clothing and accessories seller. She has sales data but finds charts, trends and KPIs confusing. She will mostly use a phone, sometimes an iPad.

## The problem

A dashboard shows the shape of her sales (the climb, the dip, the recovery) but only if she can read charts. SalesSimp says the same thing in sentences she can act on, and lets her ask follow-up questions the way she would ask a person.

## How the data and the AI fit together

- **PayPal:** sales come from PayPal's Transaction Search API, using sandbox data. The demo uses a demo shop's sandbox account directly, so there is no seller login.
- **Hybrid demo data:** a few real sandbox payments prove the live PayPal connection. A built-in demo history covering several months, stored in PayPal's response format, gives the month-by-month story. The app says so openly with an "Includes demo history" label and an "About this demo" explanation.
- **Code calculates, AI explains:** all numbers are calculated by ordinary code. The AI has two jobs only: work out which kind of question was typed (and which period and item it means), and put the finished results into friendly sentences. The AI never calculates, changes or invents a number.

## What she sees and does

### 1. First screen

A friendly header with the SalesSimp name. Under it, a short written story of her latest completed month, for example "September was your best month yet, up 20% on August." Below that, a row of tappable filter chips such as "Last 3 months", "This year" and "Pick dates". At the bottom, a text box that says "Ask about your sales", with a few example questions she can tap. Everything sits in one column with large buttons so she can use it with one thumb.

### 2. Tapping a filter

- The story updates in place, straight away, with no page reload.
- The tapped chip stays highlighted.
- The top of the story always names the period it covers, for example "June to September 2026".
- The story describes the whole period in short sentences: how sales moved month by month, the best and slowest month, and the top items.
- Each sentence has a small "show numbers" tap that opens the figures behind it, such as the amount for each month.
- If a filter leaves too little data to say anything useful, she sees a friendly message instead of a thin story.

### 3. Typing a question

- She types something like "How did my dresses do compared to last quarter?" or taps an example question.
- A short "Looking at your sales..." message appears, then the answer arrives as a few plain sentences in the same style as the story, with the same "show numbers" tap and the period named at the top.
- The app answers only these kinds of questions: comparing two periods, the best or slowest month or week, how one item is doing, and totals.
- Anything else, such as "Should I hire someone?" or "How much stock do I have?", gets a kind reply that says what it can answer, with example questions to tap. It never guesses.
- Her question also updates the filter chips to match, so typing and tapping feel like one thing.

### 4. Loading, errors and edge cases

- **Loading:** a calm "Getting your sales from PayPal..." message with soft placeholder blocks where the story will appear, never a blank screen.
- **PayPal unreachable:** "We couldn't reach PayPal just now. Please try again in a minute," with a Try again button. It never shows an old story as if it were fresh.
- **No sales in the period:** a message saying there were no completed sales in that period, with a suggestion to try a wider range.
- **Payments that do not count:** only completed payments count as sales. If some were pending or failed, a small note says how many were left out.
- **Demo history:** the "Includes demo history" label sits near the period, with an "About this demo" tap that explains which sales are real sandbox payments and which are built-in sample data.

## Trust rules

- Every sentence can be traced to the data, through the "show numbers" tap.
- The app never claims anything the data cannot show, such as stock levels.
- Only completed calendar months are compared, and the app says which month it left out.
- Only completed payments count as sales.
- Nothing is stored. PayPal credentials stay on the server and never reach the browser.

## Look and feel

- Midnight navy background (`#0B1B33`) with a subtle vertical fade, emerald accents (`#2EC4A0`, light emerald `#5EE0B8`), and warm cream cards (`#F6F3EC`) with charcoal text.
- Going up uses green with an up-arrow icon. Slowing down uses amber with a down-arrow icon, never red. Colour is never the only signal.
- Text is large and legible: nothing smaller than 16px. Tap targets are at least 44px tall.
- The interactive feel comes from touch: chips that visibly press and stay highlighted, the story fading in when a filter changes, and the "show numbers" panel sliding open.
- Designed at phone width first, with the same single column centred on iPad and laptop.

## Demo path (under three minutes)

1. The problem (about 25 seconds): a client had sales data she could not read.
2. Open SalesSimp on a phone: the story appears, with the "Includes demo history" label.
3. Tap a filter: the story updates in place. Tap "show numbers" on a sentence to prove it is real.
4. Type a question and show the written answer.
5. Ask something it cannot answer and show the friendly reply.
6. Show the PayPal connection: a real sandbox payment appearing in the story, with the PayPal dashboard open beside it.
7. Close: why the AI only explains and never calculates.

## Out of scope for this version

Charts, refunds, payouts, invoices, real money, multiple currencies, seller login, saving data, and any claim about stock.

## Open questions

- **Item filter:** PayPal only shows item names if the payment carried them. Confirm this in the sandbox before promising an item filter.
- **Backdating:** assume sandbox payments carry today's date, which is why the demo history exists.
- **AI provider:** to be decided in the spec.
