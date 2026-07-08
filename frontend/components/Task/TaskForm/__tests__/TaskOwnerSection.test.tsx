import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskOwnerSection from '../TaskOwnerSection';
import * as tasksService from '../../../../utils/tasksService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (_k: string, d: string) => d }),
}));

const mockShowErrorToast = jest.fn();
jest.mock('../../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: mockShowErrorToast,
    }),
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

    // Trigger is disabled until the candidate fetch resolves; wait for it
    // to enable before opening, so the click isn't dropped under load.
    const trigger = screen.getByRole('button');
    await waitFor(() => expect(trigger).not.toBeDisabled());
    fireEvent.click(trigger); // open dropdown

    fireEvent.click(await screen.findByText('Bob'));

    await waitFor(() => expect(spy).toHaveBeenCalledWith('abc', 2));
    expect(onTransferred).toHaveBeenCalledWith(2);
}, 15000);

it('shows an error toast and does not report a new owner when the transfer fails', async () => {
    const spy = jest
        .spyOn(tasksService, 'transferTaskOwner')
        .mockRejectedValue(new Error('Forbidden'));
    const onTransferred = jest.fn();

    render(
        <TaskOwnerSection
            taskUid="abc"
            selectedUserId={1}
            onTransferred={onTransferred}
        />
    );

    const trigger = screen.getByRole('button');
    await waitFor(() => expect(trigger).not.toBeDisabled());
    fireEvent.click(trigger); // open dropdown

    fireEvent.click(await screen.findByText('Bob'));

    await waitFor(() => expect(spy).toHaveBeenCalledWith('abc', 2));
    await waitFor(() =>
        expect(mockShowErrorToast).toHaveBeenCalledWith(
            'Failed to transfer task owner'
        )
    );
    expect(onTransferred).not.toHaveBeenCalled();
}, 15000);
