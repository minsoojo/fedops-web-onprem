import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { loginPathFor } from '../../lib/authNavigation';

const ProtectedRoute = ({ component: Component, ...props }) => {
  const user = useAuth();
  const location = useLocation();
  const returnPath = `${location.pathname}${location.search}${location.hash}`;

  return user
    ? <Component {...props} />
    : <Navigate to={loginPathFor(returnPath)} replace />;
};

export default ProtectedRoute;
