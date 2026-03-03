import { Shield, ExternalLink, Check, X } from "lucide-react";
import { useAuthStore } from "../store";

export default function TermsModal() {
  const acceptTerms = useAuthStore((state) => state.acceptTerms);

  const handleAccept = () => {
    acceptTerms();
  };

  const handleDecline = () => {
    alert("You must accept the terms to use DOOT.");
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center px-3 py-4 sm:p-4 z-50">
      <div className="cyber-card max-w-lg w-full animate-slide-up max-h-[95dvh] overflow-y-auto scrollbar-hide">
        {/* Header */}
        <div className="text-center mb-4 sm:mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary-900/30 border border-primary-700 mb-3 sm:mb-4">
            <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-primary-500" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold glow-text mb-2">Welcome to DOOT</h2>
          <p className="text-sm sm:text-base text-primary-700">
            Please review and accept our terms before proceeding
          </p>
        </div>

        {/* Content */}
        <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
          <div className="bg-cyber-dark rounded-lg p-4 border border-primary-900">
            <h3 className="text-sm font-semibold text-primary-500 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
              Important Usage Guidelines
            </h3>
            <ul className="space-y-2 text-sm text-primary-700">
              <li className="flex items-start gap-2">
                <span className="text-primary-500 mt-1">•</span>
                DOOT is for{" "}
                <strong className="text-primary-500">
                  legitimate communication only
                </strong>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500 mt-1">•</span>
                All content must comply with applicable laws
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500 mt-1">•</span>
                No illegal activities, harassment, or harmful content
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500 mt-1">•</span>
                File sharing is limited to personal and professional use
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500 mt-1">•</span>
                Copyrighted material must be shared with permission only
              </li>
            </ul>
          </div>

          <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3">
            <p className="text-sm text-red-400 font-medium">
              ⚠️ Violation of these terms will result in immediate account
              termination.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <a
              href="/terms.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 border border-primary-800 rounded-lg text-sm text-primary-600 hover:border-primary-600 hover:text-primary-500 transition-colors"
            >
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
              Terms of Service
            </a>
            <a
              href="/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 border border-primary-800 rounded-lg text-sm text-primary-600 hover:border-primary-600 hover:text-primary-500 transition-colors"
            >
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
              Privacy Policy
            </a>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={handleDecline}
            className="flex-1 terminal-btn-secondary flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <X className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Decline</span>
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 terminal-btn flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <Check className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Accept & Continue</span>
          </button>
        </div>
      </div>
    </div>
  );
}
