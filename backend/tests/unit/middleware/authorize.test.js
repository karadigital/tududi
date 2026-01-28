const { hasAccess } = require('../../../middleware/authorize');

// Mock permissionsService
jest.mock('../../../services/permissionsService', () => ({
    getAccess: jest.fn(),
}));

const permissionsService = require('../../../services/permissionsService');

describe('hasAccess middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = { currentUser: { id: 999 } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    describe('custom forbidden message', () => {
        it('should return custom forbiddenMessage when access denied', async () => {
            permissionsService.getAccess.mockResolvedValue('none');

            const middleware = hasAccess('rw', 'task', () => 'some-uid', {
                forbiddenMessage: 'Custom forbidden message',
            });

            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Custom forbidden message',
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return default "Forbidden" when no custom message provided', async () => {
            permissionsService.getAccess.mockResolvedValue('none');

            const middleware = hasAccess('rw', 'task', () => 'some-uid');

            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('access granted', () => {
        it('should call next when user has sufficient access', async () => {
            permissionsService.getAccess.mockResolvedValue('rw');

            const middleware = hasAccess('rw', 'task', () => 'some-uid');

            await middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('resource not found', () => {
        it('should return 404 when uid is null', async () => {
            const middleware = hasAccess('rw', 'task', () => null);

            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
        });

        it('should return custom notFoundMessage when uid is null', async () => {
            const middleware = hasAccess('rw', 'task', () => null, {
                notFoundMessage: 'Task not found',
            });

            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Task not found' });
        });
    });
});
