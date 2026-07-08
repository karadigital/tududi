import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskOwnerSection from '../TaskOwnerSection';
import * as tasksService from '../../../../utils/tasksService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (_k: string, d: string) => d }),
}));

const CANDIDATES = [
    { id: 1, uid: 'u1', email: 'a@x.com', name: 'Alice' },
    { id: 2, uid: 'u2', email: 'b@x.com', name: 'Bob' },
];

beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => CANDIDATES,
    }) as jest.Mock;
});

afterEach(() => jest.resetAllMocks());

it('transfers ownership and reports the new owner on selection', async () => {
    const spy = jest
        .spyOn(tasksService, 'transferTaskOwner')
        .mockResolvedValue({ uid: 'abc', user_id: 2 } as any);
    const onTransferred = jest.fn();

    render(
        <TaskOwnerSection
            taskUid="abc"
            selectedUserId={1}
            onTransferred={onTransferred}
        />
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button')); // open dropdown
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument(), {
        timeout: 5000,
    });
    fireEvent.click(screen.getByText('Bob'));

    await waitFor(() => expect(spy).toHaveBeenCalledWith('abc', 2));
    expect(onTransferred).toHaveBeenCalledWith(2);
});
