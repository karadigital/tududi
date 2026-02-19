# Tutorial 3: How We Organize Work — Areas, Projects & Tags

**Audience:** All staff
**When:** Day 1 onboarding
**Time to complete:** 15 minutes

---

## What You'll Learn

By the end of this tutorial, you will be able to:

- Understand the organizational hierarchy: Areas, Projects, and Tasks
- Navigate to your department's Area and its Projects
- Create tasks within the correct Project
- Use Project states to communicate initiative health
- Use Tags for cross-cutting organization
- Add Notes to Projects for shared documentation

---

## The Organizational Hierarchy

Tududi organizes work in a clear hierarchy. Think of it as:

```
Area (Department)
  └── Project (Initiative or Deliverable)
        ├── Task (A unit of work)
        │     └── Subtask (A smaller unit within a task)
        └── Note (Documentation or reference)
```

### How This Maps to Your Company

| Tududi Concept | Company Equivalent | Example |
|----------------|-------------------|---------|
| **Area** | Department or business unit | Marketing, Engineering, Finance, Operations |
| **Project** | Initiative, campaign, or deliverable | "Q1 Product Launch", "Website Redesign", "Annual Budget" |
| **Task** | A specific unit of work | "Write launch email copy", "Design homepage mockup" |
| **Tag** | Cross-cutting label | `#urgent`, `#client-acme`, `#review-needed` |

---

## Areas: Your Departments

Areas represent the top level of organization. Your administrator has likely already created Areas matching your company structure.

### Finding Your Area

1. Look at the **sidebar** under the **Areas** section
2. Click on your department's Area (e.g., "Marketing")
3. You'll see the Area detail page showing:
   - **Area name and description**
   - **Projects** within this Area
   - **Members** who belong to this Area

### Area Memberships

Each Area has members with specific roles. Your admin assigns these:

- **Members** can view the Area and its Projects
- **Admins** can manage the Area, add/remove members, and create Projects

You'll only see Areas you're a member of. If you're missing access to an Area, contact your administrator.

---

## Projects: Where Work Lives

Projects are the core unit of organized work. Every meaningful piece of work should live inside a Project.

### Viewing a Project

1. Click a Project name in the sidebar or from within an Area
2. The Project detail page shows:
   - **Project name** (click to edit, if you have permission)
   - **Metrics panel** — Total tasks, completed, overdue, in progress
   - **Tasks tab** — All tasks belonging to this Project
   - **Notes tab** — Documentation and reference notes

### Project States

Projects have states that communicate their health to the team:

| State | Meaning |
|-------|---------|
| **Idea** | Concept stage — not yet committed to |
| **Planned** | Approved and scheduled, but work hasn't started |
| **In Progress** | Actively being worked on |
| **Blocked** | Stalled — waiting on a dependency or decision |
| **Completed** | All work is done |

**Tip:** Keep your project states up to date. Managers use these to get a quick read on initiative health across the department.

### Creating a Task Within a Project

1. Open the Project
2. Find the **"+ Add new task"** input field at the top of the task list
3. Type the task name and press **Enter**
4. The task is automatically associated with this Project

Alternatively, when creating a task from anywhere (using Ctrl+Shift+T or the + Create New button), you can assign it to a Project using the **Project** dropdown in the task modal.

### Project Priorities

Projects themselves can have priorities (separate from individual task priorities):

- Use project priority to signal the overall importance of an initiative
- This helps when your department has multiple active projects competing for attention

### Pinning Projects

If you work on a Project frequently, **pin it** so it always appears at the top of your sidebar:

1. Find the Project in the sidebar
2. Click the **pin icon** next to it
3. Pinned projects appear at the top of the Projects section

You can pin up to **5 projects** at a time.

---

## Tags: Cross-Cutting Organization

While Areas and Projects provide a hierarchical structure, **Tags** let you slice across that hierarchy.

### When to Use Tags

Tags are useful for categorizing work that spans multiple projects:

- `#urgent` — Needs immediate attention regardless of project
- `#client-acme` — All tasks related to a specific client
- `#review-needed` — Tasks waiting for someone's review
- `#Q1-goals` — Tasks tied to quarterly objectives
- `#meeting-prep` — Tasks to complete before meetings

### Adding Tags to a Task

1. Open a task
2. Find the **Tags** section
3. Start typing a tag name — existing tags will appear as suggestions
4. Select an existing tag or type a new one to create it
5. Save the task

You can add multiple tags to a single task.

### Viewing Tasks by Tag

1. Click on **Tags** in the sidebar (or navigate to the Tags page)
2. You'll see all your tags listed
3. Click a tag to see every task and note with that tag applied

This gives you a cross-project view of related work — very useful for tracking things like "all tasks for Client X" across multiple projects and areas.

### Company Tag Conventions

Your team should agree on standard tags. Some common conventions:

- **Status tags:** `#blocked`, `#waiting-on-external`, `#review-needed`
- **Client tags:** `#client-[name]`
- **Priority tags:** `#urgent`, `#quick-win`
- **Category tags:** `#bug`, `#feature`, `#documentation`

---

## Notes: Project Documentation

Notes let you attach documentation, meeting minutes, reference material, or any text-based content to a Project.

### Creating a Note

1. Open a Project and switch to the **Notes** tab
2. Create a new note
3. Fill in:
   - **Title** — A clear, descriptive name
   - **Content** — The body text (supports markdown)
   - **Color** — Choose a color to visually distinguish notes (optional)
   - **Tags** — Add tags for organization (optional)

### What to Use Notes For

- Meeting minutes and decisions
- Project briefs and requirements
- Reference links and resources
- Process documentation
- Team agreements and conventions

---

## Working with Filters and Sorting

When viewing tasks within a Project, you have powerful filtering and sorting options:

### Filters

- **Status filter** — Show All, Active only, or Completed only
- **Assignee filter** — See tasks assigned to a specific person
- **Search** — Type to filter by task name

### Sorting

- **By Status** — Group tasks by their current status
- **By Created Date** — Newest or oldest first
- **By Due Date** — See what's due soonest
- **By Priority** — High priority items first

### Grouping

- **By None** — Flat list
- **By Status** — Tasks grouped under status headers
- **By Assignee** — Tasks grouped by who they're assigned to

**Tip:** The "Group by Assignee" view is especially useful in team meetings to review who's working on what.

---

## Putting It Together: A Real Example

Let's say you're on the Marketing team working on a product launch:

1. **Area:** Marketing (already created by your admin)
2. **Project:** "Spring Product Launch" (state: In Progress)
3. **Tasks within the Project:**
   - "Write press release" — Priority: High, Due: March 1, Tag: `#content`
   - "Design social media graphics" — Priority: Medium, Due: March 5, Assigned to: Sarah
   - "Book launch event venue" — Priority: High, Due: Feb 20, Status: Waiting
   - "Send preview to beta customers" — Priority: Medium, Defer Until: March 10
4. **Notes in the Project:**
   - "Launch Brief" — The approved project brief with goals and KPIs
   - "Brand Guidelines" — Reference for design work
5. **Tags used across projects:**
   - `#spring-launch` — Applied to tasks in Marketing, Sales, and Product projects so you can see all launch-related work in one view

---

## Common Mistakes to Avoid

- **Don't create tasks without a Project.** Orphan tasks get lost. Every task should live in a Project.
- **Don't create duplicate Projects.** Check if a Project already exists before creating a new one.
- **Don't overuse Tags.** 5-10 company-wide standard tags are more useful than 100 personal ones.
- **Do keep Project states updated.** A Project stuck on "In Progress" for months loses credibility.
- **Do use Notes for decisions.** When the team agrees on something in a meeting, document it in a Project Note.

---

## What's Next?

You now understand how work is organized. Next, you'll learn how to collaborate with your team — assigning tasks, sharing projects, and working together.

Proceed to: **[Tutorial 4: Working Together — Task Assignment & Sharing](04-working-together-assignment-sharing.md)**
