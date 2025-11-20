import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/routes';

/**
 * Smart router component that immediately redirects to the correct checkout
 * based on viewport size, preventing flicker on mobile devices
 */
export function CheckoutRouter() {
  const navigate = useNavigate();

  useEffect(() => {
    // Get query params to preserve flow type (buynow, retry)
    const searchParams = window.location.search;
    
    // Immediately check viewport and redirect
    if (window.innerWidth < 768) {
      // Mobile - redirect to mobile checkout
      navigate(`${ROUTES.MOBILE_CHECKOUT}${searchParams}`, { replace: true });
    } else {
      // Desktop - redirect to desktop checkout
      navigate(`${ROUTES.DESKTOP_CHECKOUT}${searchParams}`, { replace: true });
    }
  }, [navigate]);

  // Return null to prevent any rendering
  return null;
}
