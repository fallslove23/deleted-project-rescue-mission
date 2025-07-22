import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md mx-auto">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-4 break-words">Oops! Page not found</p>
        <a href="/" className="text-primary hover:text-primary/80 underline break-words">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
