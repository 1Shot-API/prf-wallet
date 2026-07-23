import { useCallback, useRef, useState } from "react";
import { nextModalId, type ActiveModal } from "./modalTypes";

export function useModalQueue() {
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);
  const modalQueueRef = useRef<ActiveModal[]>([]);

  const advanceQueue = useCallback(() => {
    const next = modalQueueRef.current[0] ?? null;
    setActiveModal(next);
  }, []);

  const removeModal = useCallback(
    (id: string) => {
      modalQueueRef.current = modalQueueRef.current.filter((m) => m.id !== id);
      advanceQueue();
    },
    [advanceQueue],
  );

  const pushModal = useCallback(
    <T,>(
      build: (handlers: {
        id: string;
        resolve: (value: T) => void;
        reject: (error: unknown) => void;
      }) => ActiveModal,
    ): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const id = nextModalId();
        let settled = false;
        const finishResolve = (value: T) => {
          if (settled) return;
          settled = true;
          removeModal(id);
          resolve(value);
        };
        const finishReject = (error: unknown) => {
          if (settled) return;
          settled = true;
          removeModal(id);
          reject(error);
        };
        const modal = build({
          id,
          resolve: finishResolve,
          reject: finishReject,
        });
        modalQueueRef.current.push(modal);
        setActiveModal((current) => current ?? modal);
      });
    },
    [removeModal],
  );

  return { activeModal, pushModal };
}
