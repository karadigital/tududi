# Tutorial 9: Subtasks & Complex Work Breakdown

**Audience:** All staff, especially project leads
**When:** First month
**Time to complete:** 10 minutes

---

## What You'll Learn

By the end of this tutorial, you will be able to:

- Break large tasks into subtasks
- Create and manage subtask hierarchies
- Track progress on parent tasks through subtask completion
- Use the task event timeline for audit and history
- Attach files to tasks
- Decide when to use subtasks vs. separate tasks

---

## Why Break Tasks Down?

A task like "Launch the new product page" is too big to act on. Where do you start? How do you track progress? When you break it into smaller pieces, each piece becomes actionable and trackable:

- "Write product page copy" — assignable, measurable, completable
- "Design hero image" — can be assigned to a designer
- "Set up analytics tracking" — can be worked on in parallel
- "QA and cross-browser testing" — clear acceptance criteria

Subtasks transform overwhelming work into manageable steps.

---

## Creating Subtasks

### From a Parent Task

1. Open the task you want to break down
2. Find the **Subtasks** section
3. Click **"Add Subtask"**
4. Type the subtask name
5. The subtask is created as a child of the current task

Repeat to add as many subtasks as needed.

### Subtask Properties

Each subtask is a full task in its own right. It can have:

- Its own **priority**
- Its own **due date**
- Its own **assignee**
- Its own **status**
- Its own **tags**
- Its own **description**

This means you can assign different subtasks to different people, set different due dates, and track them independently.

### Viewing Subtasks

- **From the parent task:** Open the parent task and expand the Subtasks section to see all children
- **In task lists:** Subtasks appear in your normal task views (Today, Upcoming, All Tasks) alongside regular tasks
- **In a project:** Subtasks belonging to a project appear within that project's task list

---

## Tracking Progress

### Parent-Subtask Relationship

When you view a parent task, you can see the overall progress based on how many subtasks are complete:

- 0 of 5 subtasks done = Just started
- 3 of 5 subtasks done = Solid progress
- 5 of 5 subtasks done = Ready to mark the parent as complete

### Completing the Parent

When all subtasks are done, remember to mark the **parent task** as complete as well. The parent task doesn't automatically complete itself when all subtasks are done — this is intentional. You might need to do a final review or quality check after all the pieces are finished before calling the whole thing "done."

---

## Task Change History

Every task in Tududi automatically keeps a complete record of every change made to it — who changed what, and when. You don't need to do anything to enable this; it happens in the background. This is especially valuable when multiple people work on the same task, so you can always see what happened.

### What's Tracked

| Event | Details Recorded |
|-------|-----------------|
| **Status change** | Old status → New status, who changed it, when |
| **Priority change** | Old priority → New priority |
| **Due date change** | Old date → New date |
| **Assignment change** | Assigned to / Unassigned from, by whom |
| **Tag changes** | Tags added or removed |
| **Recurrence changes** | Pattern modifications |
| **Completion** | When completed, by whom, time to completion |

### Viewing the Change History

1. Open any task by clicking on its name
2. In the task detail panel on the right, scroll down to find the **history/events** section
3. Scroll through the chronological list of changes — newest at the top

### Why This Matters

- **Clarity:** If someone asks "why was the due date changed?", you can look it up instead of guessing
- **Handoffs:** When someone new takes over a task, they can read the full history to understand what's happened so far
- **Accountability:** Everyone can see who made changes and when
- **Record keeping:** If your company needs to document who did what for compliance or review purposes, the change history serves as an automatic record

---

## Task Attachments

For tasks that involve documents, images, or other files, use **attachments** to keep everything in one place.

### Uploading an Attachment

1. Open the task by clicking on its name
2. In the task detail panel, scroll down past the description to find the **Attachments** section
3. Click the upload area to select a file from your computer
4. The file is uploaded and displayed with its original filename, size, and type

### What You Can Attach

- Documents (PDF, Word, etc.)
- Images (PNG, JPG, etc.)
- Spreadsheets
- Any other file type

### Managing Attachments

- **View:** Click an attachment to preview or download it
- **Delete:** Remove attachments that are no longer needed
- **File info:** See the original filename, file size, and file type

### When to Use Attachments vs. Notes

| Content Type | Use |
|-------------|-----|
| A file like a contract, mockup, or spreadsheet | **Attachment** — upload it to the specific task that needs it |
| Written information like meeting notes, requirements, or specs | **Project Note** — create it under the Project's Notes tab so the whole team can find it (see Tutorial 3) |
| A brief instruction or quick context for one task | **Task description** — write it in the text area below the task name |

---

## Subtasks vs. Separate Tasks: When to Use Which

This is a common question. Here's a decision guide:

### Use Subtasks When:

- The work items are **parts of a single deliverable** (e.g., sections of a report)
- They share the **same project** and context
- Completing all of them means the parent is "done"
- They represent a **checklist** within a larger piece of work
- They're all assigned to the **same person** or a small team

### Use Separate Tasks When:

- The work items are **independent deliverables** that stand on their own
- They could be assigned to **different teams** with different timelines
- They belong to **different projects**
- There's no meaningful "parent" that ties them together
- Each one might have its own subtasks

### Examples

**Use subtasks:**
```
Parent: "Prepare Q1 Board Presentation"
  └── Subtask: "Gather financial data from Finance"
  └── Subtask: "Create slides for revenue section"
  └── Subtask: "Write talking points for CEO"
  └── Subtask: "Schedule dry run with leadership team"
  └── Subtask: "Incorporate feedback and finalize"
```

**Use separate tasks:**
```
Project: "Q1 Planning"
  ├── Task: "Finalize Q1 budget" (assigned to Finance)
  ├── Task: "Set Q1 OKRs" (assigned to each department lead)
  ├── Task: "Plan Q1 marketing campaign" (assigned to Marketing)
  └── Task: "Prepare Q1 board presentation" (assigned to CEO's office)
```

In the second example, each task is independent, owned by different people, and could have its own subtasks.

---

## Complex Work Breakdown: A Practical Example

Let's walk through breaking down a real project:

### The Project: "Company Website Redesign"

**Step 1:** Create the Project in the appropriate Area, set state to "Planned"

**Step 2:** Create high-level tasks:
- "Define requirements and sitemap"
- "Design new homepage"
- "Design new product pages"
- "Implement frontend"
- "Migrate content"
- "QA and testing"
- "Launch"

**Step 3:** Break down complex tasks into subtasks:

```
Task: "Design new homepage"
  └── "Create wireframes" — Due: Feb 15, Assigned: Sarah
  └── "Design desktop mockup" — Due: Feb 22, Assigned: Sarah
  └── "Design mobile mockup" — Due: Feb 25, Assigned: Sarah
  └── "Get stakeholder approval" — Due: Mar 1, Assigned: Mike, Tag: #review-needed
  └── "Export final assets" — Due: Mar 3, Assigned: Sarah
```

**Step 4:** Attach relevant files:
- Brand guidelines PDF attached to the parent task
- Competitor screenshots attached to the wireframe subtask

**Step 5:** Track progress:
- As Sarah completes each design subtask, the parent shows progress
- When Mike approves, the review subtask is completed
- When all subtasks are done, mark "Design new homepage" as complete

---

## Tips

- **Don't go too deep.** One level of subtasks is usually enough. If you need subtasks of subtasks, you probably need a separate task or project instead.
- **Name subtasks with verbs.** "Write copy" is better than "Copy." Start with an action word.
- **Set due dates on subtasks when they matter.** Not every subtask needs its own due date — sometimes just the parent's due date is enough.
- **Use attachments for context.** A mockup attached to a task is worth a thousand words in the description.

---

## What's Next?

You now know how to manage complex work effectively. The next tutorial is for managers and team leads — learning how to track progress across your team.

Proceed to: **[Tutorial 10: For Managers — Tracking Team Progress](10-for-managers-tracking-team-progress.md)**
