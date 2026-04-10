"use client";

import React, { useState, useCallback, useRef } from 'react';
import { X, Delete, ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TouchKeyboardProps {
  visible: boolean;
  onClose: () => void;
  targetRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  size?: 'small' | 'medium' | 'large';
}

const ROWS_LOWER = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const ROWS_UPPER = [
  ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const SIZE_CONFIG = {
  small: { keyH: 'h-9', keyText: 'text-xs', keyMinW: 'min-w-[28px]', maxW: 'max-w-[700px]' },
  medium: { keyH: 'h-11', keyText: 'text-sm', keyMinW: 'min-w-[34px]', maxW: 'max-w-[800px]' },
  large: { keyH: 'h-14', keyText: 'text-base', keyMinW: 'min-w-[40px]', maxW: 'max-w-[900px]' },
};

export default function TouchKeyboard({ visible, onClose, targetRef, size = 'medium' }: TouchKeyboardProps) {
  const [shifted, setShifted] = useState(false);
  const rows = shifted ? ROWS_UPPER : ROWS_LOWER;
  const sc = SIZE_CONFIG[size] ?? SIZE_CONFIG.medium;
  const keyboardRef = useRef<HTMLDivElement>(null);

  const insertChar = useCallback((char: string) => {
    const el = targetRef.current;
    if (!el) return;
    el.focus();
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (nativeInputValueSetter) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const newValue = el.value.substring(0, start) + char + el.value.substring(end);
      nativeInputValueSetter.call(el, newValue);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(() => {
        el.setSelectionRange(start + char.length, start + char.length);
      }, 0);
    }
  }, [targetRef]);

  const handleBackspace = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    el.focus();
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (nativeInputValueSetter) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      let newValue: string;
      if (start !== end) {
        newValue = el.value.substring(0, start) + el.value.substring(end);
      } else if (start > 0) {
        newValue = el.value.substring(0, start - 1) + el.value.substring(start);
      } else {
        return;
      }
      nativeInputValueSetter.call(el, newValue);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(() => {
        const pos = start !== end ? start : Math.max(0, start - 1);
        el.setSelectionRange(pos, pos);
      }, 0);
    }
  }, [targetRef]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    // If click is on the overlay (outside keyboard), dismiss
    if (keyboardRef.current && !keyboardRef.current.contains(e.target as Node)) {
      onClose();
    }
  }, [onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Transparent overlay to catch outside taps */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99]"
            onClick={handleOverlayClick}
          />
          <motion.div
            ref={keyboardRef}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[100] pb-safe"
          >
            <div className="bg-card/98 backdrop-blur-xl border-t border-border/30 shadow-2xl">
              <div className="flex justify-end px-3 pt-2">
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-secondary/70 flex items-center justify-center hover:bg-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className={`px-2 pb-3 pt-1 ${sc.maxW} mx-auto`}>
                {rows.map((row, ri) => (
                  <div key={ri} className="flex justify-center gap-1 mb-1">
                    {ri === 3 && (
                      <button
                        onClick={() => setShifted(s => !s)}
                        className={`${sc.keyH} px-3 rounded-lg font-medium ${sc.keyText} transition-all flex items-center justify-center ${
                          shifted ? 'bg-primary text-primary-foreground' : 'bg-secondary/70 text-foreground hover:bg-secondary'
                        }`}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                    )}
                    {row.map((key) => (
                      <button
                        key={key}
                        onClick={() => insertChar(key)}
                        className={`${sc.keyH} ${sc.keyMinW} px-2 rounded-lg bg-secondary/70 text-foreground font-medium ${sc.keyText} hover:bg-secondary active:bg-primary active:text-primary-foreground transition-all`}
                      >
                        {key}
                      </button>
                    ))}
                    {ri === 3 && (
                      <button
                        onClick={handleBackspace}
                        className={`${sc.keyH} px-3 rounded-lg bg-secondary/70 text-foreground hover:bg-secondary active:bg-destructive active:text-destructive-foreground transition-all flex items-center justify-center`}
                      >
                        <Delete className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex justify-center gap-1">
                  <button
                    onClick={() => insertChar('-')}
                    className={`${sc.keyH} w-11 rounded-lg bg-secondary/70 text-foreground font-medium ${sc.keyText} hover:bg-secondary transition-all`}
                  >
                    -
                  </button>
                  <button
                    onClick={() => insertChar('.')}
                    className={`${sc.keyH} w-11 rounded-lg bg-secondary/70 text-foreground font-medium ${sc.keyText} hover:bg-secondary transition-all`}
                  >
                    .
                  </button>
                  <button
                    onClick={() => insertChar(' ')}
                    className={`${sc.keyH} flex-1 max-w-[400px] rounded-lg bg-secondary/70 text-foreground font-medium ${sc.keyText} hover:bg-secondary active:bg-primary active:text-primary-foreground transition-all`}
                  >
                    space
                  </button>
                  <button
                    onClick={() => insertChar("'")}
                    className={`${sc.keyH} w-11 rounded-lg bg-secondary/70 text-foreground font-medium ${sc.keyText} hover:bg-secondary transition-all`}
                  >
                    &apos;
                  </button>
                  <button
                    onClick={onClose}
                    className={`${sc.keyH} px-4 rounded-lg bg-primary text-primary-foreground font-medium ${sc.keyText} hover:bg-primary/90 transition-all flex items-center gap-1`}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
