import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
}

/**
 * ProtectedRoute - Wraps routes that require authentication.
 * Redirects to home page if user is not authenticated.
 * Can optionally require admin access.
 */
export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    // Show nothing while loading auth state to prevent flash
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-creme">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-canyon" />
            </div>
        );
    }

    // Not authenticated - redirect to home
    if (!user) {
        // Store the attempted URL for redirect after login
        sessionStorage.setItem('redirectAfterLogin', location.pathname);
        return <Navigate to="/" replace />;
    }

    // Require admin access
    if (requireAdmin && !user.isAdmin) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
