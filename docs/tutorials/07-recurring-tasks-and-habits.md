# Tutorial 7: Recurring Tasks & Habits

**Audience:** All staff
**When:** First month
**Time to complete:** 15 minutes

---

## What You'll Learn

By the end of this tutorial, you will be able to:

- Create recurring tasks for repetitive work
- Choose the right recurrence pattern
- Understand how recurring task instances work
- Track habits with streaks and completion logs
- Use habits for team and personal routines

---

## Part 1: Recurring Tasks

### Why Recurring Tasks?

Many work responsibilities happen on a regular schedule:

- Submit weekly status report every Friday
- Run monthly budget reconciliation
- Review team goals every quarter
- Daily standup preparation
- Send client invoices on the 1st of each month

Instead of manually creating these tasks every time, set them up once as recurring tasks and let Tududi handle the rest.

### Creating a Recurring Task

1. Create a new task (Ctrl+Shift+T or + Create New > Task)
2. Fill in the task name: e.g., "Submit weekly status report"
3. Set the **due date** for the first occurrence
4. Expand the **Recurrence** section
5. Configure the recurrence pattern (see below)
6. Save the task

### Recurrence Patterns

| Pattern | Example | Use Case |
|---------|---------|----------|
| **Daily** | Every day / Every 3 days | Daily standups, daily check-ins |
| **Weekly** | Every week on Monday / Every 2 weeks on Tuesday and Thursday | Weekly reports, biweekly meetings |
| **Monthly** | Every month on the 15th / Every 2 months | Monthly reviews, invoicing |
| **Monthly on Weekday** | First Monday of every month / Third Wednesday | Team meetings on a specific weekday |
| **Monthly on Last Day** | Last day of every month | End-of-month processes |

### Configuring Recurrence Settings

When you expand the Recurrence section, you'll see:

1. **Recurrence Type** — Select from: None, Daily, Weekly, Monthly, Monthly on Weekday, Monthly on Last Day
2. **Interval** — How many periods between occurrences (e.g., "every **2** weeks")
3. **Day selection** — For Weekly: which days of the week. For Monthly on Weekday: which week (First/Second/Third/Fourth/Last) and which day
4. **End Date** (optional) — When the recurrence should stop. Leave blank for indefinite recurring
5. **Completion-based** toggle — Whether the next instance is calculated from the due date or the completion date (see below)

### Due-Date-Based vs. Completion-Based Recurrence

This is an important distinction:

**Due-Date-Based** (default):
- The next instance is calculated from the **original due date**, regardless of when you complete it
- Example: "Every Monday" means Monday, Monday, Monday — even if you complete Monday's task on Wednesday
- **Best for:** Fixed-schedule work like weekly reports, monthly meetings

**Completion-Based:**
- The next instance is calculated from **when you completed the previous one**
- Example: "Every 2 weeks" from the date you mark it done
- **Best for:** Tasks where the interval matters more than the date — like "clean out inbox every 2 weeks" or "review project health every 30 days"

### How Recurring Instances Work

When you create a recurring task:

1. The **first instance** is the task you created, with the due date you set
2. When you complete it, the **next instance** is automatically generated with the new due date
3. Each instance is linked to the **original recurring setup** (called the "parent") — so Tududi knows they're all part of the same repeating task

### Editing the Recurrence Pattern

You can modify the recurrence settings from **any instance**:

1. Open any instance of the recurring task
2. Change the recurrence settings (type, interval, days, etc.)
3. Save — the changes apply to the original recurring setup and all future instances

This means you don't have to find the very first task to make changes — edit from whichever instance is in front of you.

### Ending a Recurring Task

To stop a recurring task:

- **Set an end date:** Edit the recurrence and add an end date — no new instances will be generated after that date
- **Remove recurrence:** Change the recurrence type to "None" — the current instance becomes a regular task and no new instances are generated

### Viewing Recurring Tasks

Recurring tasks appear in all the standard views:

- **Today / Upcoming** — Current and next instances show up like regular tasks
- **Calendar** — Each instance appears on its due date
- **All Tasks** — All active instances are listed
- **Next Iterations** — View upcoming instances of a recurring task to see what's coming

---

## Part 2: Habits

### What Are Habits?

While recurring tasks are about specific deliverables ("Submit the report"), **habits** are about building consistent behaviors ("Review my priorities", "Take a walk", "Update project status").

Habits focus on **streaks and consistency** rather than individual task completion.

### Creating a Habit

1. Navigate to the **Habits** section in the sidebar
2. Click **+ New Habit**
3. Fill in the habit details:
   - **Habit Name** — What are you trying to do consistently? (e.g., "Review team dashboard")
   - **Target Count** — How many times per period? (default: 1)
   - **Frequency Period** — Daily, Weekly, or Monthly
   - **Flexibility Mode** — Flexible or Strict
   - **Streak Mode** — Calendar or Scheduled

4. Save the habit

### Understanding Habit Settings

**Frequency Period:**

| Period | Meaning |
|--------|---------|
| **Daily** | Target must be met every day |
| **Weekly** | Target must be met every week |
| **Monthly** | Target must be met every month |

**Flexibility Mode:**

| Mode | How It Works |
|------|-------------|
| **Flexible** | Missing a day doesn't break your streak immediately — there's some forgiveness |
| **Strict** | Missing even once resets your streak to zero |

**Recommendation:** Start with **Flexible** mode. Strict mode is motivating for some people but demoralizing for others. You can always switch later.

**Streak Mode:**

| Mode | How It Works |
|------|-------------|
| **Calendar** | Streak counts based on calendar days/weeks/months. For a daily habit, did you do it Monday? Tuesday? Wednesday? Each calendar day counts separately |
| **Scheduled** | Streak counts based on the time between completions. More forgiving if you don't do it on the exact same day each time |

**Recommendation:** Start with **Calendar** mode — it's the most intuitive. Switch to Scheduled if you find Calendar too rigid for your habit.

### Logging a Completion

When you've done your habit:

1. Go to the **Habits** section
2. Find the habit
3. Click the **checkmark button** to log a completion

That's it. Your streak updates automatically.

### Reading Your Habit Stats

Click on a habit to see its detail page:

- **Current Streak** — How many consecutive periods you've maintained
- **Best Streak** — Your all-time record
- **Total Completions** — How many times you've completed this habit
- **90-Day Calendar View** — A visual calendar of the last 90 days where completed days are highlighted. Darker colors mean more completions. This makes it easy to spot patterns — for example, you might notice you consistently skip Fridays
- **14-Day Bar Chart** — A bar chart showing how often you completed the habit each of the last 14 days

### The Habits Dashboard

The main Habits page shows overview cards:

- **Total Habits** — How many habits you're tracking
- **Active Streaks** — How many habits have an active streak going
- **Total Completions** — Your lifetime completion count
- **Best Streak** — Your highest streak across all habits

---

## Habits vs. Recurring Tasks: When to Use Which

| Scenario | Use |
|----------|-----|
| "Submit the weekly report by Friday" | **Recurring Task** — It's a specific deliverable with a deadline |
| "Review my priorities every morning" | **Habit** — It's a behavior you want to build |
| "Send monthly invoices on the 1st" | **Recurring Task** — It's a concrete action on a specific date |
| "Exercise 3 times per week" | **Habit** — It's about consistency, not a specific date |
| "Run database backup every Sunday" | **Recurring Task** — It's a defined action on a defined schedule |
| "Check in with my team daily" | **Habit** — It's about building a routine |

**Rule of thumb:** If someone is waiting for a specific output, it's a **recurring task**. If you're trying to build personal or team discipline, it's a **habit**.

---

## Company Use Cases for Habits

### For Individual Contributors

- "Update my task statuses in Tududi every day" (daily)
- "Clear my inbox to zero" (daily)
- "Review upcoming deadlines" (weekly)

### For Managers

- "Check team dashboard for blockers" (daily)
- "One-on-one prep for direct reports" (weekly)
- "Review project health and update states" (weekly)

### For Teams

- "Update sprint board" (daily)
- "Knowledge sharing session" (weekly)
- "Retrospective review" (monthly)

---

## Tips for Success

- **Start small.** Track 2-3 habits, not 10. You can add more once the first ones stick.
- **Use Flexible mode initially.** A broken streak on Day 3 because of a sick day is demoralizing. Flexible mode gives breathing room.
- **Check the 90-day calendar view weekly.** The visual pattern tells you more than the streak number — you can see trends and gaps.
- **Don't confuse habits with tasks.** If you find yourself adding due dates and descriptions to a habit, it should probably be a recurring task instead.

---

## What's Next?

You now know how to automate repetitive work and build consistent routines. Next, you'll learn how to create Custom Views — personalized dashboards that show exactly the tasks you need to see.

Proceed to: **[Tutorial 8: Custom Views — Building Your Personal Dashboard](08-custom-views-personal-dashboard.md)**
