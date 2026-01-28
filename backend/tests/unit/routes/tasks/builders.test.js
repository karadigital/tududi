const {
    buildTaskAttributes,
} = require('../../../../routes/tasks/core/builders');

describe('buildTaskAttributes', () => {
    const userId = 123;
    const timezone = 'America/New_York';

    describe('assigned_to_user_id auto-assignment', () => {
        it('should auto-assign creator when no assignee is specified', () => {
            const body = {
                name: 'Test task',
            };

            const attrs = buildTaskAttributes(body, userId, timezone);

            expect(attrs.assigned_to_user_id).toBe(userId);
        });

        it('should preserve explicit assignee when provided', () => {
            const explicitAssignee = 456;
            const body = {
                name: 'Test task',
                assigned_to_user_id: explicitAssignee,
            };

            const attrs = buildTaskAttributes(body, userId, timezone);

            expect(attrs.assigned_to_user_id).toBe(explicitAssignee);
        });

        it('should preserve explicit null assignee when provided', () => {
            const body = {
                name: 'Test task',
                assigned_to_user_id: null,
            };

            const attrs = buildTaskAttributes(body, userId, timezone);

            expect(attrs.assigned_to_user_id).toBeNull();
        });

        it('should set user_id to creator for new tasks', () => {
            const body = {
                name: 'Test task',
            };

            const attrs = buildTaskAttributes(body, userId, timezone);

            expect(attrs.user_id).toBe(userId);
        });
    });
});
