export const getDefaultHeaders = (): Record<string, string> => {
    return {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: window.location.origin,
    };
};

export const getPostHeaders = (): Record<string, string> => {
    return {
        ...getDefaultHeaders(),
        'Content-Type': 'application/json',
    };
};

let isRedirecting = false;

export const handleAuthResponse = async (
    response: Response,
    errorMessage: string
): Promise<Response> => {
    if (!response.ok) {
        if (response.status === 401) {
            if (window.location.pathname !== '/login' && !isRedirecting) {
                isRedirecting = true;
                setTimeout(() => {
                    window.location.href = '/login';
                }, 100);
            }
            throw new Error('Authentication required');
        }
        // Try to extract error message from response body
        try {
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
        } catch (parseError) {
            // If parsing fails, fall back to default message
            if (
                parseError instanceof Error &&
                parseError.message !== errorMessage
            ) {
                throw parseError;
            }
        }
        throw new Error(errorMessage);
    }
    return response;
};

export const isAuthError = (error: any): boolean => {
    return error?.message && error.message.includes('Authentication required');
};
