import { SignIn } from "@clerk/nextjs";
import { COLORS } from "@/lib/constants";

export default function SignInPage() {
  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      minHeight: "100vh", 
      background: COLORS.paper 
    }}>
      <SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/" />
    </div>
  );
}
