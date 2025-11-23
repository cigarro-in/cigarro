import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share, PlusSquare } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InstallPWAProps {
  mobile?: boolean;
  className?: string;
  onCloseMenu?: () => void;
}

export const InstallPWA = ({ mobile, className, onCloseMenu }: InstallPWAProps) => {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if it's iOS
    const isDeviceIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isDeviceIOS);

    // Check if already installed
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    if (isInstalled) {
      setSupportsPWA(false);
      return;
    }

    // Android/Desktop handler
    const handler = (e: any) => {
      e.preventDefault();
      setSupportsPWA(true);
      setPromptInstall(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Show for iOS if not installed
    if (isDeviceIOS && !isInstalled) {
      setSupportsPWA(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const onClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!promptInstall) {
      return;
    }
    promptInstall.prompt();
    const { outcome } = await promptInstall.userChoice;
    
    if (outcome === 'accepted') {
      setSupportsPWA(false);
      if (onCloseMenu) onCloseMenu();
      toast.success('App installed successfully!');
    }
  };

  if (!supportsPWA) {
    return null;
  }

  if (mobile) {
    return (
      <>
        <button
          onClick={onClick}
          className={`flex items-center gap-4 px-6 py-3 text-foreground hover:bg-muted/50 transition-colors duration-200 w-full text-left ${className}`}
        >
          <Download className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
          <span className="font-sans text-base">Install App</span>
        </button>
        
        <Dialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Install Cigarro</DialogTitle>
              <DialogDescription>
                Install our app on your iPhone for the best experience.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="bg-muted/20 p-2 rounded-lg">
                  <Share className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm">1. Tap the <span className="font-semibold">Share</span> button in the browser bar</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-muted/20 p-2 rounded-lg">
                  <PlusSquare className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm">2. Scroll down and select <span className="font-semibold">Add to Home Screen</span></p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={`hidden md:flex gap-2 border-coyote text-coyote hover:bg-coyote/10 hover:text-coyote ${className}`}
        onClick={onClick}
      >
        <Download className="h-4 w-4" />
        Install App
      </Button>
      
      <Dialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install on iOS</DialogTitle>
            <DialogDescription>
              Tap the Share button and select "Add to Home Screen"
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
};
