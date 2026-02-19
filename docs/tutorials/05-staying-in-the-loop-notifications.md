# Tutorial 5: Staying in the Loop — Notifications

**Audience:** All staff
**When:** Week 1
**Time to complete:** 10 minutes

---

## What You'll Learn

By the end of this tutorial, you will be able to:

- Understand what triggers notifications
- Use the notification center effectively
- Configure your notification preferences per channel
- Set up Task Summary emails
- Avoid notification overload

---

## What Triggers Notifications?

Tududi sends notifications for events that matter to your work. Here are the notification types:

### Task Notifications

| Event | Who Gets Notified |
|-------|------------------|
| **Task assigned to you** | You (the assignee) |
| **Task unassigned from you** | You (the former assignee) |
| **Assigned task completed** | The person who assigned it |
| **Task due soon** | The task owner and assignee |
| **Task overdue** | The task owner and assignee |
| **Defer until date reached** | The task owner |
| **Task status changed** | Subscribers and assignees |

### Project Notifications

| Event | Who Gets Notified |
|-------|------------------|
| **Project due soon** | Project members |
| **Project overdue** | Project members |

You'll only receive notifications for tasks and projects you own, are assigned to, or have subscribed to. You won't be flooded with notifications about work that doesn't involve you.

---

## The Notification Center

### Accessing Notifications

Look for the **bell icon** in the interface header. If you have unread notifications, a **badge** shows the count.

### Reading Notifications

1. Click the **bell icon** to open the notification dropdown
2. You'll see your most recent notifications (up to 20)
3. Each notification shows:
   - **Title** — What happened (e.g., "Task Assigned")
   - **Message** — Details about the event
   - **Timestamp** — When it occurred
   - **Level indicator** — Color-coded by severity:
     - **Blue (Info)** — General updates
     - **Yellow (Warning)** — Approaching deadlines
     - **Red (Error)** — Overdue items or issues
     - **Green (Success)** — Completions and positive updates

### Managing Notifications

For each notification, you can:

- **Mark as read** — Click the notification or use the mark-as-read button
- **Dismiss** — Remove it from your list
- **Delete** — Permanently remove it

To clear everything at once, use the **"Mark All as Read"** button at the top of the notification panel.

---

## Notification Channels

Tududi can reach you through multiple channels. Each can be turned on or off independently:

| Channel | How It Works |
|---------|-------------|
| **In-App** | Notifications appear in the bell icon dropdown within Tududi |
| **Email** | Notifications are sent to your registered email address |
| **Push** | Browser or mobile push notifications |
| **Telegram** | Notifications sent via Telegram bot (requires setup — see Tutorial 12) |

---

## Configuring Your Preferences

This is the most important part of this tutorial. Taking 5 minutes to configure your preferences now will save you from notification fatigue later.

### Accessing Notification Settings

1. Click your **avatar** in the bottom-left of the sidebar
2. Select **Profile Settings**
3. Click the **Notifications** tab (bell icon)

### The Notification Matrix

You'll see a matrix where each **row** is a notification type and each **column** is a channel. Toggle each combination on or off:

```
                        In-App    Email    Push    Telegram
Due Tasks                 [x]      [x]     [ ]      [ ]
Overdue Tasks             [x]      [x]     [x]      [ ]
Due Projects              [x]      [ ]     [ ]      [ ]
Overdue Projects          [x]      [x]     [ ]      [ ]
Task Assigned             [x]      [x]     [ ]      [ ]
Task Completed            [x]      [ ]     [ ]      [ ]
Defer Until Reminder      [x]      [ ]     [ ]      [ ]
...
```

### Recommended Configuration for Most Staff

| Notification Type | In-App | Email | Push | Telegram |
|-------------------|--------|-------|------|----------|
| Task assigned to you | On | On | Off | Off |
| Task unassigned | On | Off | Off | Off |
| Assigned task completed | On | On | Off | Off |
| Task due soon | On | Off | Off | Off |
| Task overdue | On | On | On | Off |
| Project due soon | On | Off | Off | Off |
| Project overdue | On | On | Off | Off |
| Defer until reminder | On | Off | Off | Off |

**The principle:** Use **in-app** for everything so you see it when you're working. Add **email** for things you must not miss (overdue, assignments). Reserve **push** for truly critical alerts only.

---

## Task Summary Emails

Instead of getting individual email notifications for every task event, you can receive a **digest** — a summary of your tasks sent at a regular interval.

### Setting Up Task Summaries

1. Go to **Profile Settings**
2. Find the **Task Summary** section
3. **Enable** task summary emails
4. Choose your **frequency**:

| Frequency | Best For |
|-----------|---------|
| **Daily** | Most staff — one email each morning with your tasks for the day |
| **Weekdays** | Office workers who don't need weekend emails |
| **Weekly** | Light users who check Tududi regularly but want a weekly recap |
| **Every 1-8 hours** | Intensive users who need frequent updates throughout the day |

5. Save your preferences

### Sending a Summary Now

Want to test it? Click the **"Send Now"** button to receive an immediate summary email. This is useful to verify your email is working and to see what the summary looks like.

### What's in a Summary

A task summary email includes:

- Tasks due today
- Overdue tasks
- Tasks assigned to you recently
- Upcoming tasks for the next few days

It's a quick scan you can do from your email inbox without opening Tududi.

---

## Avoiding Notification Overload

Too many notifications are worse than none — you'll start ignoring all of them. Here's how to stay sane:

### The "Less is More" Approach

1. **Start with in-app only.** For your first week, keep everything to in-app notifications only
2. **Notice what you miss.** After a week, if you missed overdue tasks or assignments, add email for those specific types
3. **Never enable push for everything.** Push notifications should be reserved for truly urgent items only

### Signs You Have Too Many Notifications

- You have 50+ unread notifications regularly
- You click "Mark All as Read" without reading them
- You've started ignoring the bell icon entirely

### What to Do

1. Go to **Notification Settings**
2. Turn off email and push for **low-importance** items (task status changes, defer reminders)
3. Keep email on for **high-importance** items (assignments, overdue alerts)
4. Use the **Task Summary email** instead of individual notifications for day-to-day awareness

---

## Quick Reference

| I want to... | Do this... |
|--------------|-----------|
| See my notifications | Click the bell icon in the header |
| Mark all as read | Click "Mark All as Read" at the top of the notification panel |
| Stop email notifications for a type | Profile Settings > Notifications > Toggle off Email for that type |
| Get a daily task digest | Profile Settings > Task Summary > Enable > Set to Daily |
| Stop all push notifications | Profile Settings > Notifications > Toggle off all Push columns |

---

## What's Next?

Now that you know how to stay informed, let's learn how to capture ideas quickly without losing your train of thought — using the Inbox.

Proceed to: **[Tutorial 6: Capturing Ideas Fast — The Inbox](06-capturing-ideas-fast-the-inbox.md)**
