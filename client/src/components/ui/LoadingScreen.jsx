import { Shield } from "lucide-react";

export default function LoadingScreen({ message = "Loading..." }) {
  return (
    <div className="fixed inset-0 bg-cyber-dark flex flex-col items-center justify-center z-50">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-900/30 border border-primary-700 mb-6 animate-pulse-glow">
          <Shield className="w-10 h-10 text-primary-500" />
        </div>
        <div className="loading-spinner mx-auto mb-4"></div>
        <p className="text-primary-700 animate-pulse">{message}</p>
      </div>
    </div>
  );
}
