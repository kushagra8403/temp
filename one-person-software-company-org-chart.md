# The One-Person Software Company: The Full Org Chart

*by Divjot Sahni · EZYE Consulting · ezye.com.au · EZYE OS · Start a Business*

The org chart of a one-person software company: 24 agents, six departments, and the two jobs that stay yours.

Every agent from the reel: what it does, the tool behind it, and the prompt to run it. Plus the business model: build one small app once, and every customer pays for it every month.

## What's inside

- The full org chart: 24 agents across six departments
- The prompts for research, the build, the launch and support
- How to find an app idea in other apps' one-star reviews
- The billing setup that charges monthly and chases failed cards

---

## What you need

You can run the research this afternoon. The first version of the app is a weekend or two. None of this needs a coding background, but you do need to read what Claude builds and test it yourself.

- **Claude Code**, installed and signed in
- **GitHub**, where the code lives
- **Vercel**, to put the app on the internet
- **Supabase**, for the database and logins
- **Stripe**, for the monthly payments
- **Resend**, for the emails the app sends

> **Pro tip:** Every tool on this list has a free plan to start on. One catch: Vercel's free plan is for personal projects, so move to the paid plan before you take your first payment. (See Vercel's free plan rules.)

---

## The business model

An agency gets paid per client, so every new dollar is new work. A software company builds one app, once, and every customer pays for it every month.

- Sell one small app that does one job. Not a platform.
- Find the job inside a big app people already pay for. The reel's example: people paying $89 a month for a business suite who only use the invoice reminders.
- Build that one feature as its own app and charge a fraction. The example: $19 a month.
- The maths from the reel: 100 customers at $19 is $1,900 a month. It is an example, not a promise. Customer 101 costs you almost nothing to serve.
- Your costs are hosting, the database, email and Stripe's fee on each payment. Check each tool's pricing page before you set your price.

> **Pro tip:** Do not copy the big app's name, design or code. Take the complaint, then build your own answer to it.

---

## The org chart

Twenty-four agents in six departments. Each agent is one job with one prompt. Claude Code runs them, and reads three plain files first:

- `product.md` — who the app is for, the one job it does, and what it will not do
- `roadmap.md` — what gets built next, and why
- `voice.md` — how you write

| Department | What its agents do |
|---|---|
| **Research** | Read the 1-star reviews, find the complaint, check search demand, write the spec |
| **Build** | Write the code, test it, review the changes, ship it |
| **Launch** | Build the landing page, write the launch post, email the waitlist, record the demo |
| **Support** | Answer the inbox, turn bugs into tickets, update the help docs, collect feature requests |
| **Billing** | Charge every customer, chase failed cards, ask why they cancel, track monthly revenue |
| **Growth** | Rank the feature requests, write search pages, send onboarding emails, watch the numbers |
| **You** | Pick what to build and approve what ships. Nothing goes live without your yes |

---

## Research

Start with what people already pay for and complain about. A one-star review from a paying customer is the best app idea you will find, because the money is already being spent. Run the prompt first, then work through the steps.

**Inside Claude Code:**

```text
Search Reddit, the App Store, Google Play and Trustpilot for reviews of [type of app, e.g. job management apps for trades] from the last 12 months. Keep only the 1 and 2 star reviews.

Group the complaints. For each group: how many reviews say it, three exact quotes with links, and the price the reviewer says they pay.

Then list every complaint that sounds like "I only use one feature" or "too expensive for what I use".

Save it all to research/[today's date].md.
```

1. Read the file yourself. Open ten of the links and check the quotes are real.
2. Pick the complaint with the most reviews where a small app could do that single job on its own.
3. Check people search for it: type the job into Google and look at what comes up, then check the monthly searches in Google Keyword Planner.
4. Ask Claude Code: *"Read research/[date].md. Write spec.md for the complaint I picked: who it is for, the one job it does, the three screens it needs, what it will NOT do, and the price. One page."*

> **Pro tip:** If the one feature only works because of data inside the big app, it is not a standalone app. Pick the next complaint.

Resource: Apify, for pulling reviews in bulk.

---

## Build

Claude Code writes the app, tests it and gives you a preview link. You tap approve, or you send it back.

**Inside Claude Code:**

```text
Read product.md and spec.md.

Build the app as a web app on Vercel. Use Supabase for the database and logins, and Stripe for a monthly subscription at [price]. Turn on row level security on every table.

Write tests for the three screens and the payment flow. Run them and fix what fails.

Push it to a new branch on GitHub, open a pull request, and give me the preview link. Do not merge.
```

1. Open the preview link on your phone and use the app like a customer would.
2. Make two test accounts and check that one cannot see the other's data.
3. Pay with a Stripe test card and check the account unlocks.
4. If it is right, merge the pull request. That is the approve button. Vercel puts it live.

> **Pro tip:** Row level security is the setting that stops customers seeing each other's data. Do the two-account check every time the database changes.

Resources: Vercel preview links · Supabase row level security · Playwright, for the tests.

---

## Launch

The landing page, the launch post and the waitlist email all come from the same research file, so they use the customer's own words.

**Inside Claude Code:**

```text
Read product.md, voice.md and the research file.

1. Build a landing page: the complaint in plain words as the headline, what the app does, the price, and one button.
2. Write a launch post for Product Hunt, and a shorter one for X and Reddit.
3. Draft the email to the waitlist for launch day.

Do not publish or send anything.
```

1. Put the landing page up before the app is finished, with an email box instead of a buy button. That is your waitlist.
2. Record a 45 second screen demo of the one job being done.
3. On launch day, read everything once, then post and send it yourself.

> **Pro tip:** Read each subreddit's rules before you post. Most allow a launch post if you answer questions and do not spam it.

Resource: Resend docs.

---

## Support

Paying customers email. Run this once a day. Replies and fixes wait for you.

**Inside Claude Code, once a day:**

```text
Read the support emails from the last 24 hours: [paste them, or connect Gmail].

For each one, draft a reply in the voice from voice.md.
- If it is a bug: open a GitHub issue with the steps to reproduce it, fix it on a new branch, run the tests, and open a pull request.
- If it is a feature request: add it to roadmap.md in the customer's own words, with their email.
- If the answer belongs in the help docs, update the page.

Do not send any replies and do not merge anything.
```

> **Pro tip:** Every bug fix is a pull request waiting for your approval, the same as a new feature. Check the preview link before you merge.

---

## Billing

This is the part that pays, and most of it is settings in Stripe, not prompts.

1. Create one product in Stripe with one monthly price.
2. Turn on **Smart Retries**, so Stripe tries a failed card again at a better time.
3. Turn on the **failed payment emails**, so the customer gets a link to update their card.
4. Turn on the **customer portal**, so people can change their card or cancel on their own, and ask for a cancellation reason.
5. Every Friday, export the week from Stripe and ask Claude: who failed, who cancelled and why, and what monthly revenue is now.

> **Pro tip:** Stripe has a test mode and a live mode, each with its own keys. If payments work in the preview and not on the live site, check the live keys are in Vercel.

Resources: Stripe subscriptions · Smart Retries · Failed payment emails · Customer portal.

---

## Growth and the loop

Every feature request becomes next week's build. Support writes the requests into `roadmap.md`, and growth ranks them.

**Inside Claude Code, every Monday:**

```text
Read roadmap.md and product.md.

Rank the feature requests by how many paying customers asked for each. Drop any that break the "will not do" list in product.md.

Write a one-page spec for the top one, and stop. I will approve it before anything gets built.
```

- **Search pages:** one page per question people type into Google about the job your app does.
- **Onboarding emails:** day 1 how to start, day 3 the one thing most people miss, day 7 ask what is missing.
- **The numbers to watch:** sign-ups, paying customers, cancellations, monthly revenue.

> **Pro tip:** Say no to most requests. The app won because it does one job. The "will not do" list in `product.md` is what keeps it that way.

---

## Your two jobs

Everything else runs without you. These two do not.

1. **Pick what to build:** the first complaint, then one feature request a week.
2. **Approve what ships:** every release, reply and post gets your yes before it goes out.

---

## When not to bother

A few things need to be true first.

- You cannot find the complaint in public. Do not build from an idea in your head.
- The app would handle health records, card numbers or other sensitive data. That needs more than this guide.
- You do not want to answer support. Paying customers email, and they expect a reply.
- You need money this month. An agency pays sooner. Software pays later and keeps paying.

Related: Test the idea first · The one-person agency org chart.

---

## Troubleshooting

The first-month problems.

| Problem | Likely cause / fix |
|---|---|
| Works on the preview link, breaks on the live site | A setting is missing in Vercel's production environment |
| Payments work in testing and not live | The app is still using Stripe's test keys |
| A customer can see someone else's data | Row level security is off on a table. Turn it on and run the two-account check |
| Claude keeps adding features you did not ask for | Put them on the "will not do" list in `product.md` |
| Nobody signs up | The complaint was not strong enough. Go back to research before you spend on ads |

---

## What's next

The org chart runs one app. EZYE OS is where you learn to find the offer, price it, and run the system behind it, with the training and the tools in one place.
