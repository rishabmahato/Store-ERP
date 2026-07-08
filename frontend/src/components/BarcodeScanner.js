import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScanLine, X } from "lucide-react";

export default function BarcodeScanner({ open, onClose, onDetect }) {
  const [error, setError] = useState("");
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let scanner;
    const start = async () => {
      try {
        scanner = new Html5Qrcode("barcode-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decoded) => {
            onDetect(decoded);
            scanner.stop().then(() => scanner.clear()).catch(() => {});
            onClose();
          },
          () => {}
        );
      } catch (e) {
        setError("Camera unavailable. Use a USB scanner or type the barcode in search.");
      }
    };
    start();
    return () => {
      const s = scannerRef.current;
      if (s && s.isScanning) s.stop().then(() => s.clear()).catch(() => {});
    };
  }, [open, onClose, onDetect]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ fontFamily: "Outfit" }}>
            <ScanLine className="h-5 w-5" />Scan barcode
          </DialogTitle>
        </DialogHeader>
        <div id="barcode-reader" className="rounded-xl overflow-hidden bg-black aspect-video" />
        {error && <div className="text-sm text-destructive">{error}</div>}
        <div className="text-xs text-muted-foreground">
          Point your camera at the barcode. A USB scanner also works: focus the search box and scan.
        </div>
        <Button variant="outline" onClick={onClose}><X className="h-4 w-4 mr-2" />Close</Button>
      </DialogContent>
    </Dialog>
  );
}
