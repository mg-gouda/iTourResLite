"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type DialogState =
  | { type: "confirm"; title: string; message: string; resolve: (v: boolean) => void }
  | { type: "alert"; title: string; message: string; resolve: () => void }
  | null;

const DialogCtx = createContext<{
  confirm: (message: string, title?: string) => Promise<boolean>;
  showAlert: (message: string, title?: string) => Promise<void>;
}>({
  confirm: async () => false,
  showAlert: async () => {},
});

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>(null);

  const confirm = useCallback((message: string, title = "Are you sure?") => {
    return new Promise<boolean>((resolve) => {
      setState({ type: "confirm", title, message, resolve });
    });
  }, []);

  const showAlert = useCallback((message: string, title = "Error") => {
    return new Promise<void>((resolve) => {
      setState({ type: "alert", title, message, resolve });
    });
  }, []);

  function close(value: boolean) {
    if (state?.type === "confirm") { state.resolve(value); setState(null); }
  }
  function closeAlert() {
    if (state?.type === "alert") { state.resolve(); setState(null); }
  }

  return (
    <DialogCtx.Provider value={{ confirm, showAlert }}>
      {children}

      {state?.type === "confirm" && (
        <Dialog open onOpenChange={() => close(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="size-4 text-destructive" />
                {state.title}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => close(false)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => close(true)}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {state?.type === "alert" && (
        <Dialog open onOpenChange={closeAlert}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-destructive" />
                {state.title}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <DialogFooter>
              <Button size="sm" onClick={closeAlert}>OK</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DialogCtx.Provider>
  );
}

export function useConfirm() { return useContext(DialogCtx).confirm; }
export function useAlert() { return useContext(DialogCtx).showAlert; }
