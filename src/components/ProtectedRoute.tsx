import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
  userId: string | undefined;
}

export function ProtectedRoute({ children, userId }: ProtectedRouteProps) {
  if (!userId) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
