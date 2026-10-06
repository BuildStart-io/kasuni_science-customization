import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import buildstartLogo from "@/assets/buildstart-logo.png";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let resolved = false;

    const navigateTo = (path: string) => {
      if (!resolved) {
        resolved = true;
        navigate(path, { replace: true });
      }
    };

    // Safety timeout: if getSession hangs, immediately redirect to /auth
    const timer = setTimeout(() => {
      navigateTo("/auth");
    }, 1500);

    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("Auth check warning:", error);
          navigateTo("/auth");
        } else {
          navigateTo(session ? "/dashboard" : "/auth");
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        navigateTo("/auth");
      }
    };

    checkAuth();

    return () => {
      clearTimeout(timer);
      resolved = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4 space-y-4">
      <img src={buildstartLogo} alt="BuildStart" className="h-12 w-12 animate-pulse" />
      <div className="flex items-center space-y-0 space-x-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>Loading BuildStart...</span>
      </div>
    </div>
  );
};

export default Index;

