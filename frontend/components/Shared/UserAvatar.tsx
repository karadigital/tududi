import React from 'react';
import { getApiPath } from '../../config/paths';

interface UserAvatarProps {
    avatarImage?: string;
    name?: string;
    email: string;
    size?: 'sm' | 'md';
}

const sizeClasses = {
    sm: { container: 'h-6 w-6', text: 'text-xs' },
    md: { container: 'h-8 w-8', text: 'text-sm' },
};

const UserAvatar: React.FC<UserAvatarProps> = ({
    avatarImage,
    name,
    email,
    size = 'md',
}) => {
    const displayName = name || email;
    const classes = sizeClasses[size];

    if (avatarImage) {
        return (
            <img
                src={getApiPath(avatarImage)}
                alt={displayName}
                className={`${classes.container} rounded-full object-cover`}
            />
        );
    }

    return (
        <div
            className={`${classes.container} rounded-full bg-blue-500 flex items-center justify-center text-white ${classes.text}`}
        >
            {displayName?.[0]?.toUpperCase() ?? '?'}
        </div>
    );
};

export default UserAvatar;
