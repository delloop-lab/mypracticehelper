'use client';

import { useState, useEffect } from 'react';
import { X, Smartphone, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed the prompt
    const hasSeenPrompt = localStorage.getItem('pwa-install-prompt-seen');
    
    // Check if it's a mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    // Detect iOS
    const iOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsIOS(iOS);
    
    // Detect Android
    const android = /Android/i.test(navigator.userAgent);
    setIsAndroid(android);

    // Only show on mobile, if not already installed, and if not seen before
    if (isMobile && !isStandalone && !hasSeenPrompt) {
      // Show prompt after a short delay
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000); // Wait 3 seconds before showing

      return () => clearTimeout(timer);
    }

    // Listen for the beforeinstallprompt event (Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Show the install prompt (Android)
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      
      setDeferredPrompt(null);
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-prompt-seen', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in slide-in-from-bottom duration-300 sm:slide-in-from-bottom-0">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-indigo-600" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center mb-2 text-gray-900">
          Install My Practice Helper
        </h2>

        {/* Description */}
        <p className="text-center text-gray-600 mb-6">
          Get quick access from your home screen. Works just like a native app!
        </p>

        {/* Benefits */}
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-700">Fast access from your home screen</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-700">Full-screen app experience</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-700">No app store download needed</p>
          </div>
        </div>

        {/* Instructions based on device */}
        {isIOS && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-900 font-medium mb-2">How to install on iOS:</p>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Tap the Share button <span className="inline-block">📤</span></li>
              <li>Scroll down and tap "Add to Home Screen"</li>
              <li>Tap "Add" in the top right</li>
            </ol>
          </div>
        )}

        {isAndroid && deferredPrompt && (
          <Button
            onClick={handleInstallClick}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-lg font-semibold mb-3"
          >
            <Download className="w-5 h-5 mr-2" />
            Install App
          </Button>
        )}

        {isAndroid && !deferredPrompt && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-green-900 font-medium mb-2">How to install on Android:</p>
            <ol className="text-sm text-green-800 space-y-1 list-decimal list-inside">
              <li>Tap the menu button (⋮) in your browser</li>
              <li>Tap "Install app" or "Add to Home screen"</li>
              <li>Follow the prompts to install</li>
            </ol>
          </div>
        )}

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="w-full text-gray-600 hover:text-gray-800 font-medium py-3 transition-colors"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}
