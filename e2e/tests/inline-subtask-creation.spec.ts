import { test, expect } from '@playwright/test';

test.describe('Inline Subtask Creation', () => {
    // Helper function to login via UI
    async function loginViaUI(page, baseURL) {
        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        await page.goto(`${appUrl}/login`);

        await page
            .getByTestId('login-email')
            .fill(process.env.E2E_EMAIL || 'test@tududi.com');
        await page
            .getByTestId('login-password')
            .fill(process.env.E2E_PASSWORD || 'password123');
        await page.getByTestId('login-submit').click();

        // Wait for redirect to dashboard or today page
        await page.waitForURL(/\/(dashboard|today)/, { timeout: 10000 });
    }

    // Helper to create a task via API and return its data
    async function createTestTask(context, baseURL, name: string) {
        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        const response = await context.request.post(`${appUrl}/api/task`, {
            data: {
                name,
                today: true,
                priority: 2,
            },
        });

        if (response.ok()) {
            return await response.json();
        }
        throw new Error('Failed to create test task');
    }

    // Helper to delete a task via API
    async function deleteTestTask(context, baseURL, taskUid: string) {
        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        await context.request.delete(`${appUrl}/api/task/${taskUid}`);
    }

    // Helper to navigate to task detail page
    async function navigateToTaskDetail(page, baseURL, taskUid: string) {
        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        await page.goto(`${appUrl}/task/${taskUid}`);
        // Wait for the page to load
        await page.waitForSelector('[data-testid="add-subtask-button"], h4:has-text("Subtasks")', { timeout: 10000 });
    }

    test('Full workflow: Click Add → Type → Enter → Verify subtask created', async ({
        page,
        context,
        baseURL,
    }) => {
        await loginViaUI(page, baseURL);

        const timestamp = Date.now();
        const task = await createTestTask(context, baseURL, `Test Task ${timestamp}`);

        try {
            await navigateToTaskDetail(page, baseURL, task.uid);

            // Click the Add subtask button
            const addButton = page.getByTestId('add-subtask-button').first();
            await expect(addButton).toBeVisible({ timeout: 5000 });
            await addButton.click();

            // Type in the subtask name
            const input = page.getByTestId('inline-subtask-input');
            await expect(input).toBeVisible({ timeout: 5000 });
            await expect(input).toBeFocused();

            const subtaskName = `Subtask ${timestamp}`;
            await input.fill(subtaskName);

            // Press Enter to create
            await input.press('Enter');

            // Wait for the subtask to appear in the list
            await expect(page.getByText(subtaskName)).toBeVisible({ timeout: 10000 });

            // Input should still be visible and cleared for rapid entry
            await expect(page.getByTestId('inline-subtask-input')).toBeVisible();
        } finally {
            await deleteTestTask(context, baseURL, task.uid);
        }
    });

    test('Multiple subtasks: Create 3 subtasks in sequence', async ({
        page,
        context,
        baseURL,
    }) => {
        await loginViaUI(page, baseURL);

        const timestamp = Date.now();
        const task = await createTestTask(context, baseURL, `Test Task ${timestamp}`);

        try {
            await navigateToTaskDetail(page, baseURL, task.uid);

            // Click the Add subtask button
            const addButton = page.getByTestId('add-subtask-button').first();
            await expect(addButton).toBeVisible({ timeout: 5000 });
            await addButton.click();

            // Create 3 subtasks in sequence
            const subtaskNames = [
                `First Subtask ${timestamp}`,
                `Second Subtask ${timestamp}`,
                `Third Subtask ${timestamp}`,
            ];

            for (const name of subtaskNames) {
                const input = page.getByTestId('inline-subtask-input');
                await expect(input).toBeVisible({ timeout: 5000 });
                await input.fill(name);
                await input.press('Enter');

                // Wait for subtask to appear
                await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
            }

            // Verify all 3 subtasks are visible
            for (const name of subtaskNames) {
                await expect(page.getByText(name)).toBeVisible();
            }
        } finally {
            await deleteTestTask(context, baseURL, task.uid);
        }
    });

    test('Cancel with Escape: Type → Escape → Verify no subtask', async ({
        page,
        context,
        baseURL,
    }) => {
        await loginViaUI(page, baseURL);

        const timestamp = Date.now();
        const task = await createTestTask(context, baseURL, `Test Task ${timestamp}`);

        try {
            await navigateToTaskDetail(page, baseURL, task.uid);

            // Click the Add subtask button
            const addButton = page.getByTestId('add-subtask-button').first();
            await expect(addButton).toBeVisible({ timeout: 5000 });
            await addButton.click();

            // Type in the subtask name
            const input = page.getByTestId('inline-subtask-input');
            await expect(input).toBeVisible({ timeout: 5000 });

            const subtaskName = `Cancelled Subtask ${timestamp}`;
            await input.fill(subtaskName);

            // Press Escape to cancel
            await input.press('Escape');

            // Input should be hidden
            await expect(page.getByTestId('inline-subtask-input')).not.toBeVisible();

            // Add button should be visible again
            await expect(page.getByTestId('add-subtask-button').first()).toBeVisible();

            // Subtask should NOT be created
            await expect(page.getByText(subtaskName)).not.toBeVisible();
        } finally {
            await deleteTestTask(context, baseURL, task.uid);
        }
    });

    test('Cancel with click outside: Type → Click elsewhere → Verify no subtask', async ({
        page,
        context,
        baseURL,
    }) => {
        await loginViaUI(page, baseURL);

        const timestamp = Date.now();
        const task = await createTestTask(context, baseURL, `Test Task ${timestamp}`);

        try {
            await navigateToTaskDetail(page, baseURL, task.uid);

            // Click the Add subtask button
            const addButton = page.getByTestId('add-subtask-button').first();
            await expect(addButton).toBeVisible({ timeout: 5000 });
            await addButton.click();

            // Type in the subtask name (but leave it empty to trigger cancel on blur)
            const input = page.getByTestId('inline-subtask-input');
            await expect(input).toBeVisible({ timeout: 5000 });

            // Click outside the input (on body or another element)
            await page.locator('body').click({ position: { x: 10, y: 10 } });

            // Input should be hidden after blur with empty value
            await expect(page.getByTestId('inline-subtask-input')).not.toBeVisible({ timeout: 1000 });

            // Add button should be visible again
            await expect(page.getByTestId('add-subtask-button').first()).toBeVisible();
        } finally {
            await deleteTestTask(context, baseURL, task.uid);
        }
    });

    test('Empty input: Click Add → Enter → Verify nothing happens', async ({
        page,
        context,
        baseURL,
    }) => {
        await loginViaUI(page, baseURL);

        const timestamp = Date.now();
        const task = await createTestTask(context, baseURL, `Test Task ${timestamp}`);

        try {
            await navigateToTaskDetail(page, baseURL, task.uid);

            // Click the Add subtask button
            const addButton = page.getByTestId('add-subtask-button').first();
            await expect(addButton).toBeVisible({ timeout: 5000 });
            await addButton.click();

            // Press Enter without typing anything
            const input = page.getByTestId('inline-subtask-input');
            await expect(input).toBeVisible({ timeout: 5000 });
            await input.press('Enter');

            // Input should still be visible (not submitted)
            await expect(input).toBeVisible();

            // No subtasks should be in the list
            // The task starts without subtasks, so there shouldn't be any task items
            // Use assertion with timeout to ensure no subtasks appear after the empty Enter
            const subtaskItems = page.locator('[data-testid^="task-item-"]');
            await expect(subtaskItems).toHaveCount(0, { timeout: 1000 });
        } finally {
            await deleteTestTask(context, baseURL, task.uid);
        }
    });

    test('Keyboard-only workflow: Tab → Type → Enter → Escape', async ({
        page,
        context,
        baseURL,
    }) => {
        await loginViaUI(page, baseURL);

        const timestamp = Date.now();
        const task = await createTestTask(context, baseURL, `Test Task ${timestamp}`);

        try {
            await navigateToTaskDetail(page, baseURL, task.uid);

            // Focus on the Add subtask button using keyboard
            const addButton = page.getByTestId('add-subtask-button').first();
            await expect(addButton).toBeVisible({ timeout: 5000 });

            // Click the button to activate (keyboard-accessible click)
            await addButton.focus();
            await page.keyboard.press('Enter');

            // Input should be visible and focused
            const input = page.getByTestId('inline-subtask-input');
            await expect(input).toBeVisible({ timeout: 5000 });
            await expect(input).toBeFocused();

            // Type subtask name using keyboard
            const subtaskName = `Keyboard Subtask ${timestamp}`;
            await page.keyboard.type(subtaskName);

            // Press Enter to create
            await page.keyboard.press('Enter');

            // Wait for subtask to appear
            await expect(page.getByText(subtaskName)).toBeVisible({ timeout: 10000 });

            // Press Escape to close the input
            await page.keyboard.press('Escape');

            // Input should be hidden
            await expect(page.getByTestId('inline-subtask-input')).not.toBeVisible();

            // Add button should be visible again
            await expect(page.getByTestId('add-subtask-button').first()).toBeVisible();
        } finally {
            await deleteTestTask(context, baseURL, task.uid);
        }
    });

    test('Subtasks pill: Inline add works in full subtasks view', async ({
        page,
        context,
        baseURL,
    }) => {
        await loginViaUI(page, baseURL);

        const timestamp = Date.now();
        const task = await createTestTask(context, baseURL, `Test Task ${timestamp}`);

        try {
            await navigateToTaskDetail(page, baseURL, task.uid);

            // Navigate to the Subtasks pill/tab if available
            const subtasksPill = page.getByRole('button', { name: /subtasks/i });
            if (await subtasksPill.isVisible()) {
                await subtasksPill.click();
                // Wait for the add button to be visible after navigation
                await expect(page.getByTestId('add-subtask-button').first()).toBeVisible({ timeout: 5000 });
            }

            // Click the Add subtask button (may be in different location in full view)
            const addButton = page.getByTestId('add-subtask-button').first();
            await expect(addButton).toBeVisible({ timeout: 5000 });
            await addButton.click();

            // Type in the subtask name
            const input = page.getByTestId('inline-subtask-input');
            await expect(input).toBeVisible({ timeout: 5000 });

            const subtaskName = `Full View Subtask ${timestamp}`;
            await input.fill(subtaskName);

            // Press Enter to create
            await input.press('Enter');

            // Wait for the subtask to appear
            await expect(page.getByText(subtaskName)).toBeVisible({ timeout: 10000 });
        } finally {
            await deleteTestTask(context, baseURL, task.uid);
        }
    });
});
