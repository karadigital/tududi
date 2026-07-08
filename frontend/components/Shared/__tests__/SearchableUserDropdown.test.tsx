import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchableUserDropdown from '../SearchableUserDropdown';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (_k: string, d: string) => d }),
}));

const USERS = [
    { id: 1, uid: 'u1', email: 'a@x.com', name: 'Alice' },
    { id: 2, uid: 'u2', email: 'b@x.com', name: 'Bob' },
];

beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => USERS,
    }) as jest.Mock;
});

afterEach(() => jest.resetAllMocks());

it('fetches from the custom fetchPath', async () => {
    render(
        <SearchableUserDropdown
            selectedUserId={null}
            onChange={async () => {}}
            fetchPath="task/abc/owner-candidates"
        />
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('task/abc/owner-candidates');
});

it('hides the Unassigned option when allowUnassigned is false', async () => {
    render(
        <SearchableUserDropdown
            selectedUserId={1}
            onChange={async () => {}}
            allowUnassigned={false}
        />
    );
    // open the dropdown
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
    expect(screen.queryByText('Unassigned')).not.toBeInTheDocument();
}, 10000);
