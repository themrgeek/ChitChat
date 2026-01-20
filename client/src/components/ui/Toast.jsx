import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useUIStore } from "../../store";

export default function Toast({ message, type = "info" }) {
  const hideToast = useUIStore((state) => state.hideToast);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-primary-500" />,
  };

  const bgColors = {
    success: "bg-green-900/30 border-green-700/50",
    error: "bg-red-900/30 border-red-700/50",
    info: "bg-primary-900/30 border-primary-700/50",
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-slide-up">
      <div
        className={`flex items-center gap-3 p-4 rounded-lg border backdrop-blur-sm ${bgColors[type]}`}
      >
        {icons[type]}
        <p className="flex-1 text-sm text-white">{message}</p>
        <button
          onClick={hideToast}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
}
