import { transferTaskOwner } from '../tasksService';

jest.mock('../authUtils', () => ({
    handleAuthResponse: jest.fn().mockResolvedValue(undefined),
    getDefaultHeaders: () => ({}),
    getPostHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ uid: 'abc', user_id: 7 }),
    }) as jest.Mock;
});

afterEach(() => jest.resetAllMocks());

it('POSTs to the transfer-owner endpoint with the new owner id', async () => {
    const result = await transferTaskOwner('abc', 7);
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('task/abc/transfer-owner');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ new_owner_user_id: 7 });
    expect(result).toEqual({ uid: 'abc', user_id: 7 });
});
