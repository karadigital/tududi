const {
    validateCriticalPriority,
} = require('../../../../routes/tasks/utils/critical-validation');

describe('Critical Priority Validation', () => {
    describe('validateCriticalPriority', () => {
        it('should pass when priority is not critical', () => {
            expect(() =>
                validateCriticalPriority({ priority: 2 })
            ).not.toThrow();
            expect(() =>
                validateCriticalPriority({ priority: 'high' })
            ).not.toThrow();
            expect(() =>
                validateCriticalPriority({ priority: null })
            ).not.toThrow();
        });

        it('should pass when critical priority has due_date and assigned_to', () => {
            expect(() =>
                validateCriticalPriority({
                    priority: 3,
                    due_date: '2026-01-15',
                    assigned_to_user_id: 1,
                })
            ).not.toThrow();

            expect(() =>
                validateCriticalPriority({
                    priority: 'critical',
                    due_date: '2026-01-15',
                    assigned_to_user_id: 2,
                })
            ).not.toThrow();
        });

        it('should throw when critical priority missing due_date', () => {
            expect(() =>
                validateCriticalPriority({
                    priority: 3,
                    assigned_to_user_id: 1,
                })
            ).toThrow('Critical tasks must have a due date and assignee');
        });

        it('should throw when critical priority missing assigned_to', () => {
            expect(() =>
                validateCriticalPriority({
                    priority: 3,
                    due_date: '2026-01-15',
                })
            ).toThrow('Critical tasks must have a due date and assignee');
        });

        it('should throw when critical priority missing both fields', () => {
            expect(() =>
                validateCriticalPriority({
                    priority: 'critical',
                })
            ).toThrow('Critical tasks must have a due date and assignee');
        });

        it('should check existing task values when updating', () => {
            const existingTask = {
                due_date: '2026-01-15',
                assigned_to_user_id: 1,
            };

            // Update only sets priority to critical, existing task has required fields
            expect(() =>
                validateCriticalPriority({ priority: 3 }, existingTask)
            ).not.toThrow();
        });

        it('should fail if existing task missing required field on update to critical', () => {
            const existingTask = {
                due_date: '2026-01-15',
                assigned_to_user_id: null,
            };

            expect(() =>
                validateCriticalPriority({ priority: 3 }, existingTask)
            ).toThrow('Critical tasks must have a due date and assignee');
        });
    });
});
